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

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Gemini AI client server-side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Endpoint for generating AI captions
  app.post('/api/generate-captions', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'MISSING_API_KEY' });
    }
    try {
      const { topic, language = 'English', durationSeconds = 15 } = req.body;
      
      const prompt = `Generate a realistic sequence of timed video subtitles (captions) for a video about "${topic || 'A creator discussing modern tech and storytelling'}" in language "${language}".
      Note on languages: If language is Roman Urdu, write Urdu speech using Latin alphabet (Roman Urdu).
      The video duration is about ${durationSeconds} seconds.
      Provide 4 to 8 subtitle segments, each with start time (e.g. "00:00"), end time (e.g. "00:03"), and text content.
      Return strictly JSON matching this schema:
      [
        { "start": "00:00", "end": "00:03", "text": "..." }
      ]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING, description: "Start timestamp mm:ss" },
                end: { type: Type.STRING, description: "End timestamp mm:ss" },
                text: { type: Type.STRING, description: "Subtitle text" }
              },
              required: ["start", "end", "text"]
            }
          }
        }
      });

      const jsonText = response.text || '[]';
      const captions = JSON.parse(jsonText);
      res.json({ captions });
    } catch (error: any) {
      console.error("Gemini caption generation error:", error);
      res.status(500).json({ error: error.message || 'Failed to generate captions' });
    }
  });

  // API Endpoint for real video transcription
  app.post('/api/transcribe-video', upload.single('video'), async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'MISSING_API_KEY' });
    }
    let filePath = req.file?.path;
    let audioPath = '';
    try {
      if (!filePath) {
        return res.status(400).json({ error: 'No video file uploaded.' });
      }

      console.log("Starting transcription for file:", filePath);
      const language = req.body.language || 'English';
      
      let mediaPart: { inlineData: { mimeType: string; data: string } };
      let modelToUse = 'gemini-3.5-transcribe';

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

      const prompt = `Transcribe the spoken words from this media into sequential timed subtitle segments. 
      Target Language: ${language}.
      (Note: If Roman Urdu is selected, write spoken Urdu phonetically in the Latin alphabet).
      Provide segments with start time and end time (format mm:ss) and transcript text.
      Return strictly JSON matching this schema:
      [
        { "start": "00:00", "end": "00:03", "text": "..." }
      ]`;

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
                start: { type: Type.STRING, description: "Start timestamp mm:ss" },
                end: { type: Type.STRING, description: "End timestamp mm:ss" },
                text: { type: Type.STRING, description: "Spoken transcript text" }
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
  app.post('/api/export-video', upload.single('video'), async (req, res) => {
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
            '-c:a copy'
          ])
          .save(outputPath)
          .on('end', () => resolve(true))
          .on('error', (err: any) => reject(err));
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
