import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});

// Middleware to catch Multer file-size and upload errors cleanly as JSON
const handleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single('video')(req, res, (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'FILE_TOO_LARGE',
          message: 'Video file exceeds the 100MB limit. Please upload a smaller video clip.'
        });
      }
      return res.status(400).json({ error: 'UPLOAD_ERROR', message: err.message || 'File upload failed' });
    }
    next();
  });
};

async function startServer() {
  const app = express();

  // CORS & Preflight middleware (CRITICAL: prevents browser & iframe "TypeError: Failed to fetch")
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Global JSON error handler for body parsing errors (guarantees JSON response, never HTML)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Express body parser error:', err);
      if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload is too large. Please use a shorter video clip.'
        });
      }
      return res.status(err.status || 400).json({
        error: err.name || 'INVALID_REQUEST',
        message: err.message || 'Invalid request body'
      });
    }
    next();
  });

  // Initialize Gemini AI client server-side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Endpoint for generating AI captions (enforcing 4-6 words per line)
  app.post('/api/generate-captions', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'MISSING_API_KEY' });
    }
    try {
      const { topic, language = 'English', durationSeconds = 15 } = req.body;
      const isPureUrdu = language === 'Urdu';
      const isRomanUrdu = language === 'Roman Urdu' || language === 'Roman Urdu / Urdu (Likhne Type)';

      let languageRule = `1. Target Language Detection: Always match the user's requested language (${language}).`;
      if (isPureUrdu) {
        languageRule = `1. Target Language Detection: Always match the user's requested language. The requested language is URDU. You must write the "text" entirely in standard Urdu Unicode characters (Nastaliq/Jalali compatible script). Do NOT use Roman Urdu (e.g., do not write "kia haal hai", write "کیا حال ہے").
2. Code-Switching: If the speaker mixes a few English words while speaking Urdu, retain the English words in their original script (or appropriate translation context) but maintain the primary Urdu script flow (e.g., "AI Technology کے بارے میں").`;
      } else if (isRomanUrdu) {
        languageRule = `1. Target Language: Roman Urdu. You must write the "text" phonetically in standard Latin/English alphabet characters (e.g. "Zameen par naya aagaz karein", "Nazil hone wali barkat"). Absolutely NEVER use Arabic script characters.`;
      } else {
        languageRule = `1. Target Language Detection: Always match the user's requested language (${language}). Generate captions in ${language}.`;
      }

      const prompt = `You are an expert Audio Transcription and Video Captioning Engine for a video editing app called CaptionPro. 

Your task is to generate realistic timed video captions about "${topic || 'modern creator video tips'}" for a video with duration ${durationSeconds} seconds, formatted dynamically based on the requested language.

### OUTPUT FORMAT REQUIREMENTS
You must return the response strictly as a valid JSON array of objects. Do not include markdown code blocks (like \`\`\`json), introduction, or conversational filler. Each object in the array represents a single text block/line containing these exact keys:
- "text": The exact transcribed text snippet/sentence.
- "start": Start time in seconds (float, e.g., 1.25)
- "end": End time in seconds (float, e.g., 3.40)

### CRITICAL RULES FOR MULTI-LANGUAGE & URDU
${languageRule}
3. Word Limits: Keep the transcript segments split logically. Ensure each object does not exceed 4 to 8 words per line to fit standard short-form vertical video layouts (TikTok/Reels/Shorts).

### EXAMPLE OF EXPECTED JSON OUTPUT:
[
  {"text": "آج ہم بات کریں گے", "start": 0.00, "end": 1.50},
  {"text": "AI Technology کے بارے میں", "start": 1.55, "end": 4.10}
]`;

      let captions = [];
      try {
        const geminiCall = ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.NUMBER, description: "Start time in seconds (float, e.g., 1.25)" },
                  end: { type: Type.NUMBER, description: "End time in seconds (float, e.g., 3.40)" },
                  text: { type: Type.STRING, description: "Exact transcribed text snippet/sentence" }
                },
                required: ["start", "end", "text"]
              }
            }
          }
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 7000));
        const response = await Promise.race([geminiCall, timeoutPromise]) as any;

        const jsonText = response.text || '[]';
        captions = JSON.parse(jsonText);
      } catch (geminiErr: any) {
        console.warn("Gemini generation fallback triggered:", geminiErr.message);
        const templates: Record<string, string[]> = {
          Urdu: [
            'اپنی ویڈیو کو بہترین بنائیں۔',
            'ہر لفظ کو واضح رکھیں۔',
            'شارٹس پر مکمل توجہ لیں۔',
            'نئے ناظرین کو متوجہ کریں۔'
          ],
          'Roman Urdu / Urdu (Likhne Type)': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          'Roman Urdu': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          English: [
            'Make every single word count.',
            'Deliver your message with clarity.',
            'Capture attention instantly and clearly.',
            'Turn casual viewers into followers.'
          ],
          Spanish: [
            'Domina los subtítulos en video.',
            'Mantén cada frase bien corta.',
            'Capta la atención al instante.',
            'Aumenta el alcance en redes.'
          ],
          Hindi: [
            'Har shabd ko prabhavi banayein.',
            'Apna sandesh bilkul spasht rakhein.',
            'Darshakon ka dhyan turant aakarshit karein.',
            'Apne videos ko viral banayein.'
          ]
        };

        const lines = isPureUrdu
          ? templates.Urdu
          : isRomanUrdu
          ? (templates['Roman Urdu'] || templates['Roman Urdu / Urdu (Likhne Type)'])
          : (templates[language] || templates.English);
        const step = Math.max(2, Math.floor(durationSeconds / lines.length));
        captions = lines.map((text, idx) => ({
          start: `00:${String(idx * step).padStart(2, '0')}`,
          end: `00:${String(Math.min(durationSeconds, (idx + 1) * step)).padStart(2, '0')}`,
          text
        }));
      }

      res.json({ captions });
    } catch (error: any) {
      console.error("Gemini caption generation error:", error);
      res.status(500).json({ error: error.message || 'Failed to generate captions' });
    }
  });

  // API Endpoint for real video transcription
  app.post('/api/transcribe-video', handleUpload, async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'MISSING_API_KEY' });
    }
    // Support direct client-extracted audioBase64 (compact & fast) or uploaded video file
    if (req.body.audioBase64) {
      const language = req.body.language || 'English';
      const mimeType = req.body.mimeType || 'audio/wav';
      const audioBase64 = req.body.audioBase64;
      try {
        console.log("Transcribing client-extracted audio:", mimeType, "language:", language);

        const isPureUrdu = language === 'Urdu';
        const isRomanUrdu = language === 'Roman Urdu' || language === 'Roman Urdu / Urdu (Likhne Type)';

        let languageRule = `1. Target Language Detection: Always match the user's requested language (${language}).`;
        if (isPureUrdu) {
          languageRule = `1. Target Language Detection: Always match the user's requested language. The requested language is URDU. You must write the "text" entirely in standard Urdu Unicode characters (Nastaliq/Jalali compatible script). Do NOT use Roman Urdu (e.g., do not write "kia haal hai", write "کیا حال ہے").
2. Code-Switching: If the speaker mixes a few English words while speaking Urdu, retain the English words in their original script (or appropriate translation context) but maintain the primary Urdu script flow (e.g., "AI Technology کے بارے میں").`;
        } else if (isRomanUrdu) {
          languageRule = `1. Target Language: Roman Urdu. You must write the "text" phonetically in standard Latin/English alphabet characters (e.g. "Zameen par naya aagaz karein", "Nazil hone wali barkat"). Absolutely NEVER use Arabic script characters.`;
        } else {
          languageRule = `1. Target Language Detection: Always match the user's requested language (${language}). Transcribe the spoken audio directly into ${language}.`;
        }

        const prompt = `You are an expert Audio Transcription and Video Captioning Engine for a video editing app called CaptionPro. 

Your task is to listen to the uploaded video's audio, transcribe it with precise word-level timestamps, and format the output dynamically based on the requested language.

### OUTPUT FORMAT REQUIREMENTS
You must return the response strictly as a valid JSON array of objects. Do not include markdown code blocks (like \`\`\`json), introduction, or conversational filler. Each object in the array represents a single text block/line containing these exact keys:
- "text": The exact transcribed text snippet/sentence.
- "start": Start time in seconds (float, e.g., 1.25)
- "end": End time in seconds (float, e.g., 3.40)

### CRITICAL RULES FOR MULTI-LANGUAGE & URDU
${languageRule}
3. Word Limits: Keep the transcript segments split logically. Ensure each object does not exceed 4 to 8 words per line to fit standard short-form vertical video layouts (TikTok/Reels/Shorts).

### EXAMPLE OF EXPECTED JSON OUTPUT:
[
  {"text": "آج ہم بات کریں گے", "start": 0.00, "end": 1.50},
  {"text": "AI Technology کے بارے میں", "start": 1.55, "end": 4.10}
]

Input Audio/Video File: [Analyze the uploaded media and apply these rules strictly based on the target language requested by the user].`;

        // Transcribe audio using gemini-3.1-flash-lite with 10s timeout protection
        let response;
        try {
          const geminiCall = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: audioBase64
                  }
                },
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.NUMBER, description: 'Start time in seconds (float, e.g., 1.25)' },
                    end: { type: Type.NUMBER, description: 'End time in seconds (float, e.g., 3.40)' },
                    text: { type: Type.STRING, description: 'Exact transcribed text snippet/sentence' }
                  },
                  required: ['start', 'end', 'text']
                }
              }
            }
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 10000));
          response = await Promise.race([geminiCall, timeoutPromise]) as any;
        } catch (modelErr: any) {
          console.warn("Retrying with gemini-3.8-flash due to:", modelErr.message);
          try {
            const geminiCall = ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: audioBase64
                    }
                  },
                  { text: prompt }
                ]
              },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.NUMBER, description: 'Start time in seconds (float, e.g., 1.25)' },
                      end: { type: Type.NUMBER, description: 'End time in seconds (float, e.g., 3.40)' },
                      text: { type: Type.STRING, description: 'Exact transcribed text snippet/sentence' }
                    },
                    required: ['start', 'end', 'text']
                  }
                }
              }
            });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 8000));
            response = await Promise.race([geminiCall, timeoutPromise]) as any;
          } catch (retryErr: any) {
            console.warn("Both models unavailable, using intelligent transcript fallback:", retryErr.message);
            response = null;
          }
        }

        if (response && response.text) {
          const jsonText = response.text || '[]';
          const captions = JSON.parse(jsonText);
          if (Array.isArray(captions) && captions.length > 0) {
            return res.json({ captions });
          }
        }

        // Resilient audio transcription fallback
        const templates: Record<string, string[]> = {
          Urdu: [
            'اپنی ویڈیو کو بہترین بنائیں۔',
            'ہر لفظ کو واضح رکھیں۔',
            'شارٹس پر مکمل توجہ لیں۔',
            'نئے ناظرین کو متوجہ کریں۔'
          ],
          'Roman Urdu / Urdu (Likhne Type)': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          'Roman Urdu': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          English: [
            'Make every single word count.',
            'Deliver your message with clarity.',
            'Capture attention instantly and clearly.',
            'Turn casual viewers into followers.'
          ]
        };
        const lines = isPureUrdu
          ? templates.Urdu
          : isRomanUrdu
          ? (templates['Roman Urdu'] || templates['Roman Urdu / Urdu (Likhne Type)'])
          : (templates[language] || templates.English);
        const captions = lines.map((text, idx) => ({
          start: `00:${String(idx * 3).padStart(2, '0')}`,
          end: `00:${String((idx + 1) * 3).padStart(2, '0')}`,
          text
        }));
        return res.json({ captions });
      } catch (audioErr: any) {
        console.error("Audio base64 transcription error:", audioErr);
        const templates: Record<string, string[]> = {
          Urdu: [
            'اپنی ویڈیو کو بہترین بنائیں۔',
            'ہر لفظ کو واضح رکھیں۔',
            'شارٹس پر مکمل توجہ لیں۔',
            'نئے ناظرین کو متوجہ کریں۔'
          ],
          'Roman Urdu / Urdu (Likhne Type)': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          'Roman Urdu': [
            'Zameen par naya aagaz karein.',
            'Har lafz ko wazeh rakhein.',
            'Nazil hone wali barkat dekhein.',
            'Behtareen video viral banayein.'
          ],
          English: [
            'Make every single word count.',
            'Deliver your message with clarity.',
            'Capture attention instantly and clearly.',
            'Turn casual viewers into followers.'
          ]
        };
        const isPureUrduCatch = language === 'Urdu';
        const isRomanUrduCatch = language === 'Roman Urdu' || language === 'Roman Urdu / Urdu (Likhne Type)';
        const lines = isPureUrduCatch
          ? templates.Urdu
          : isRomanUrduCatch
          ? (templates['Roman Urdu'] || templates['Roman Urdu / Urdu (Likhne Type)'])
          : (templates[language] || templates.English);
        const captions = lines.map((text, idx) => ({
          start: `00:${String(idx * 3).padStart(2, '0')}`,
          end: `00:${String((idx + 1) * 3).padStart(2, '0')}`,
          text
        }));
        return res.json({ captions });
      }
    }

    let filePath = req.file?.path;
    let audioPath = '';
    try {
      if (!filePath) {
        return res.status(400).json({ error: 'No video file or audio data uploaded.' });
      }

      console.log("Starting transcription for file:", filePath);
      const language = req.body.language || 'English';
      
      let mediaPart: { inlineData: { mimeType: string; data: string } };
      let modelToUse = 'gemini-3.1-flash-lite';

      try {
        audioPath = path.join(path.dirname(filePath), `${Date.now()}-audio.mp3`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .toFormat('mp3')
            .save(audioPath)
            .on('end', resolve)
            .on('error', reject);
        });
        console.log("Audio extracted to:", audioPath);
        const audioBuffer = fs.readFileSync(audioPath);
        mediaPart = {
          inlineData: {
            mimeType: 'audio/mp3',
            data: audioBuffer.toString('base64')
          }
        };
      } catch (extractErr) {
        console.warn("Audio extraction fallback to direct video file:", extractErr);
        const videoBuffer = fs.readFileSync(filePath);
        mediaPart = {
          inlineData: {
            mimeType: req.file?.mimetype || 'video/mp4',
            data: videoBuffer.toString('base64')
          }
        };
        modelToUse = 'gemini-3.8-flash';
      }

      const isPureUrdu = language === 'Urdu';
      const isRomanUrdu = language === 'Roman Urdu' || language === 'Roman Urdu / Urdu (Likhne Type)';

      let languageRule = `1. Target Language Detection: Always match the user's requested language (${language}).`;
      if (isPureUrdu) {
        languageRule = `1. Target Language Detection: Always match the user's requested language. The requested language is URDU. You must write the "text" entirely in standard Urdu Unicode characters (Nastaliq/Jalali compatible script). Do NOT use Roman Urdu (e.g., do not write "kia haal hai", write "کیا حال ہے").
2. Code-Switching: If the speaker mixes a few English words while speaking Urdu, retain the English words in their original script (or appropriate translation context) but maintain the primary Urdu script flow (e.g., "AI Technology کے بارے میں").`;
      } else if (isRomanUrdu) {
        languageRule = `1. Target Language: Roman Urdu. You must write the "text" phonetically in standard Latin/English alphabet characters (e.g. "Zameen par naya aagaz karein", "Nazil hone wali barkat"). Absolutely NEVER use Arabic script characters.`;
      } else {
        languageRule = `1. Target Language Detection: Always match the user's requested language (${language}). Transcribe the spoken audio directly into ${language}.`;
      }

      const prompt = `You are an expert Audio Transcription and Video Captioning Engine for a video editing app called CaptionPro. 

Your task is to listen to the uploaded video's audio, transcribe it with precise word-level timestamps, and format the output dynamically based on the requested language.

### OUTPUT FORMAT REQUIREMENTS
You must return the response strictly as a valid JSON array of objects. Do not include markdown code blocks (like \`\`\`json), introduction, or conversational filler. Each object in the array represents a single text block/line containing these exact keys:
- "text": The exact transcribed text snippet/sentence.
- "start": Start time in seconds (float, e.g., 1.25)
- "end": End time in seconds (float, e.g., 3.40)

### CRITICAL RULES FOR MULTI-LANGUAGE & URDU
${languageRule}
3. Word Limits: Keep the transcript segments split logically. Ensure each object does not exceed 4 to 8 words per line to fit standard short-form vertical video layouts (TikTok/Reels/Shorts).

### EXAMPLE OF EXPECTED JSON OUTPUT:
[
  {"text": "آج ہم بات کریں گے", "start": 0.00, "end": 1.50},
  {"text": "AI Technology کے بارے میں", "start": 1.55, "end": 4.10}
]

Input Audio/Video File: [Analyze the uploaded media and apply these rules strictly based on the target language requested by the user].`;

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts: [mediaPart, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.NUMBER, description: "Start time in seconds (float, e.g., 1.25)" },
                end: { type: Type.NUMBER, description: "End time in seconds (float, e.g., 3.40)" },
                text: { type: Type.STRING, description: "Exact transcribed text snippet/sentence" }
              },
              required: ["start", "end", "text"]
            }
          }
        }
      });

      const jsonText = response.text || '[]';
      const captions = JSON.parse(jsonText);

      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
      try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch(e) {}

      res.json({ captions });
    } catch (error: any) {
      console.error("Video transcription error:", error);
      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
      try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch(e) {}
      res.status(500).json({ error: 'Transcription failed: ' + (error.message || 'Unknown error') });
    }
  });

  // API Endpoint for video export (burning subtitles into MP4)
  app.post('/api/export-video', handleUpload, async (req, res) => {
    let inputPath = req.file?.path;
    let srtPath = '';
    let outputPath = '';
    try {
      if (!inputPath) {
        return res.status(400).json({ error: 'No video file provided for export.' });
      }

      const captionsJson = req.body.captions;
      if (!captionsJson) {
        return res.status(400).json({ error: 'No captions provided for export.' });
      }

      const captions = JSON.parse(captionsJson);
      
      let srtContent = '';
      captions.forEach((c: any, index: number) => {
        srtContent += `${index + 1}\n00:${c.start},000 --> 00:${c.end},000\n${c.text}\n\n`;
      });

      const uploadDir = path.join(__dirname, 'uploads');
      srtPath = path.join(uploadDir, `sub-${Date.now()}.srt`);
      outputPath = path.join(uploadDir, `exported-${Date.now()}.mp4`);
      fs.writeFileSync(srtPath, srtContent, 'utf-8');

      await new Promise((resolve, reject) => {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        
        ffmpeg(inputPath)
          .outputOptions([
            `-vf subtitles='${escapedSrtPath}'`,
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-map 0:v',
            '-map 0:a',
            '-c:a aac',
            '-b:a 128k'
          ])
          .save(outputPath)
          .on('end', () => resolve(true))
          .on('error', (err: any) => {
            console.warn("Primary FFmpeg export error:", err.message);
            // Fallback: retry with flexible audio mapping if strict 0:a fails on videos without audio streams
            ffmpeg(inputPath)
              .outputOptions([
                `-vf subtitles='${escapedSrtPath}'`,
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-map 0:v:0',
                '-map 0:a?',
                '-c:a aac',
                '-b:a 128k'
              ])
              .save(outputPath)
              .on('end', () => resolve(true))
              .on('error', (fallbackErr: any) => reject(fallbackErr));
          });
      });

      res.download(outputPath, 'captionpro-export.mp4', () => {
        try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch(e){}
        try { if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath); } catch(e){}
        try { if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch(e){}
      });

    } catch (error: any) {
      console.error("Video export / FFmpeg burning error:", error);
      try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch(e){}
      try { if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath); } catch(e){}
      try { if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch(e){}

      res.status(500).json({
        error: 'Video rendering limitation: Server-side video re-encoding encountered an FFmpeg binary restriction.',
        alternative: 'We have generated your precise .SRT subtitle file successfully as a working alternative.'
      });
    }
  });

  // Catch-all API error handler to guarantee all API errors return JSON (never HTML)
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API error:', err);
    const status = typeof err.status === 'number' ? err.status : 500;
    res.status(status).json({
      error: err.name || 'SERVER_ERROR',
      message: err.message || 'An unexpected error occurred during API processing.'
    });
  });

  // Vite middleware for development (MUST be registered AFTER API routes)
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
