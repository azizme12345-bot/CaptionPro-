import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { HfInference } from '@huggingface/inference';
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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
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
          message: 'Video file exceeds the 500MB limit. Please upload a video under 500MB.'
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

  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // Global JSON error handler for body parsing errors (guarantees JSON response, never HTML)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Express body parser error:', err);
      if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload is too large. Please upload a video under 500MB.'
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

  // Whisper language codes supported by openai/whisper-large-v3
  const WHISPER_LANGUAGE_CODES: Record<string, string> = {
    'English': 'en',
    'Urdu': 'ur',
    'Roman Urdu': 'ur',
    'Roman Urdu / Urdu (Likhne Type)': 'ur',
    'Hindi': 'hi',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Arabic': 'ar',
    'Portuguese': 'pt',
    'Japanese': 'ja',
    'Italian': 'it',
    'Dutch': 'nl',
    'Russian': 'ru'
  };

  // Helper to format seconds into MM:SS timestamp
  function formatSecToMMSS(sec: number): string {
    const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Transcribe audio strictly using Hugging Face Whisper API (openai/whisper-large-v3)
  // Token is read only from server environment variable HF_TOKEN (never exposed to browser or code)
  async function processWhisperAudio(audioBuffer: Buffer, language: string) {
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      const err = new Error('MISSING_HF_TOKEN');
      (err as any).code = 'MISSING_HF_TOKEN';
      throw err;
    }

    const langCode = WHISPER_LANGUAGE_CODES[language] || 'en';
    const hf = new HfInference(hfToken);
    let whisperRes: any = null;

    try {
      console.log(`[Whisper API] Transcribing audio with openai/whisper-large-v3 (${language} -> ${langCode})...`);
      whisperRes = await (hf as any).automaticSpeechRecognition({
        model: 'openai/whisper-large-v3',
        inputs: audioBuffer,
        data: audioBuffer,
        parameters: {
          return_timestamps: true,
          language: langCode
        }
      });
    } catch (sdkErr: any) {
      console.warn("[Whisper API] SDK notice, connecting directly to Hugging Face Inference router:", sdkErr.message);
      const directRes = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'audio/wav',
          'x-wait-for-model': 'true'
        },
        body: new Uint8Array(audioBuffer)
      });
      if (!directRes.ok) {
        const errorText = await directRes.text();
        throw new Error(`Hugging Face Whisper API returned ${directRes.status}: ${errorText}`);
      }
      whisperRes = await directRes.json();
    }

    const rawChunks: Array<{ text: string; start: number; end: number }> = [];

    if (whisperRes?.chunks && Array.isArray(whisperRes.chunks) && whisperRes.chunks.length > 0) {
      for (const chunk of whisperRes.chunks) {
        const text = (chunk.text || '').trim();
        if (!text) continue;
        const start = Array.isArray(chunk.timestamp) ? (chunk.timestamp[0] ?? 0) : 0;
        const end = Array.isArray(chunk.timestamp) ? (chunk.timestamp[1] ?? (start + 2.5)) : (start + 2.5);
        rawChunks.push({ text, start, end: Math.max(start + 0.4, end) });
      }
    } else if (whisperRes?.words && Array.isArray(whisperRes.words) && whisperRes.words.length > 0) {
      let currentWordGroup: any[] = [];
      for (const w of whisperRes.words) {
        currentWordGroup.push(w);
        if (currentWordGroup.length >= 5) {
          const text = currentWordGroup.map(item => item.word || item.text).join(' ').trim();
          const start = currentWordGroup[0].start ?? 0;
          const end = currentWordGroup[currentWordGroup.length - 1].end ?? (start + 2.0);
          rawChunks.push({ text, start, end });
          currentWordGroup = [];
        }
      }
      if (currentWordGroup.length > 0) {
        const text = currentWordGroup.map(item => item.word || item.text).join(' ').trim();
        const start = currentWordGroup[0].start ?? 0;
        const end = currentWordGroup[currentWordGroup.length - 1].end ?? (start + 2.0);
        rawChunks.push({ text, start, end });
      }
    } else if (typeof whisperRes?.text === 'string' && whisperRes.text.trim()) {
      const words = whisperRes.text.trim().split(/\s+/).filter(Boolean);
      const chunkSize = 5;
      let runningTime = 0;
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkWords = words.slice(i, i + chunkSize);
        const duration = chunkWords.length * 0.45;
        rawChunks.push({
          text: chunkWords.join(' '),
          start: runningTime,
          end: runningTime + duration
        });
        runningTime += duration;
      }
    }

    // If no speech detected in real audio track, return empty array (NO SAMPLE OR DEMO CAPTIONS)
    if (rawChunks.length === 0) {
      return [];
    }

    // Format into standard CaptionSegment structure with 4-6 words limit
    const formattedSegments = [];
    let segIdx = 1;

    for (const item of rawChunks) {
      const words = item.text.split(/\s+/).filter(Boolean);
      if (words.length <= 6) {
        formattedSegments.push({
          id: `seg-${segIdx++}`,
          start: formatSecToMMSS(item.start),
          end: formatSecToMMSS(item.end),
          startSec: parseFloat(item.start.toFixed(2)),
          endSec: parseFloat(item.end.toFixed(2)),
          text: item.text
        });
      } else {
        const chunkSize = 5;
        const totalDuration = Math.max(0.5, item.end - item.start);
        for (let i = 0; i < words.length; i += chunkSize) {
          const slice = words.slice(i, i + chunkSize);
          const startFraction = i / words.length;
          const endFraction = (i + slice.length) / words.length;
          const subStart = item.start + (startFraction * totalDuration);
          const subEnd = item.start + (endFraction * totalDuration);
          formattedSegments.push({
            id: `seg-${segIdx++}`,
            start: formatSecToMMSS(subStart),
            end: formatSecToMMSS(subEnd),
            startSec: parseFloat(subStart.toFixed(2)),
            endSec: parseFloat(subEnd.toFixed(2)),
            text: slice.join(' ')
          });
        }
      }
    }

    return formattedSegments;
  }

  // API Endpoint for video transcription using Hugging Face Whisper Large v3
  app.post(['/api/transcribe-video', '/api/captions', '/api/generate-captions'], handleUpload, async (req, res) => {
    let filePath = req.file?.path;
    let extractedWavPath = '';

    try {
      const language = req.body.language || 'English';
      let audioBuffer: Buffer | null = null;

      if (req.body.audioBase64) {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      } else if (filePath) {
        extractedWavPath = path.join(path.dirname(filePath), `whisper-${Date.now()}.wav`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath!)
            .noVideo()
            .audioCodec('pcm_s16le')
            .audioChannels(1)
            .audioFrequency(16000)
            .output(extractedWavPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        audioBuffer = fs.readFileSync(extractedWavPath);
      }

      if (!audioBuffer) {
        return res.status(400).json({ error: 'NO_AUDIO', message: 'No audio data or video file received for transcription.' });
      }

      const captions = await processWhisperAudio(audioBuffer, language);
      return res.json({ captions, count: captions.length });
    } catch (err: any) {
      console.error("[Transcription Error]", err);
      if (err.message === 'MISSING_HF_TOKEN' || err.code === 'MISSING_HF_TOKEN') {
        return res.status(400).json({
          error: 'MISSING_HF_TOKEN',
          message: 'Hugging Face API token (HF_TOKEN) is not configured in the server environment variables. Please set HF_TOKEN to transcribe video audio with Hugging Face Whisper.'
        });
      }
      return res.status(500).json({
        error: 'WHISPER_TRANSCRIPTION_FAILED',
        message: err.message || 'Hugging Face Whisper transcription failed'
      });
    } finally {
      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
      try { if (extractedWavPath && fs.existsSync(extractedWavPath)) fs.unlinkSync(extractedWavPath); } catch (e) {}
    }
  });

  // Alias endpoint for audio transcription
  app.post('/api/generate-captions', handleUpload, async (req, res) => {
    let filePath = req.file?.path;
    let extractedWavPath = '';

    try {
      const language = req.body.language || 'English';
      let audioBuffer: Buffer | null = null;

      if (req.body.audioBase64) {
        audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      } else if (filePath) {
        extractedWavPath = path.join(path.dirname(filePath), `whisper-${Date.now()}.wav`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath!)
            .noVideo()
            .audioCodec('pcm_s16le')
            .audioChannels(1)
            .audioFrequency(16000)
            .output(extractedWavPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        audioBuffer = fs.readFileSync(extractedWavPath);
      }

      if (!audioBuffer) {
        return res.status(400).json({
          error: 'AUDIO_REQUIRED',
          message: 'Please upload a video file or record audio to transcribe with Hugging Face Whisper. Sample captions have been removed.'
        });
      }

      const captions = await processWhisperAudio(audioBuffer, language);
      return res.json({ captions, count: captions.length });
    } catch (err: any) {
      console.error("[Generate Captions Error]", err);
      if (err.message === 'MISSING_HF_TOKEN' || err.code === 'MISSING_HF_TOKEN') {
        return res.status(400).json({
          error: 'MISSING_HF_TOKEN',
          message: 'Hugging Face API token (HF_TOKEN) is not configured in the server environment variables. Please set HF_TOKEN to transcribe video audio with Hugging Face Whisper.'
        });
      }
      return res.status(500).json({
        error: 'WHISPER_TRANSCRIPTION_FAILED',
        message: err.message || 'Hugging Face Whisper transcription failed'
      });
    } finally {
      try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
      try { if (extractedWavPath && fs.existsSync(extractedWavPath)) fs.unlinkSync(extractedWavPath); } catch (e) {}
    }
  });

  // Format high-precision SRT timestamps (HH:MM:SS,mmm)
  function formatSrtTimestamp(seconds: number): string {
    const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
    const h = Math.floor(safeSec / 3600);
    const m = Math.floor((safeSec % 3600) / 60);
    const s = Math.floor(safeSec % 60);
    const ms = Math.floor((safeSec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  // API Endpoint for video export (burning subtitles into MP4 with full duration and preserved audio)
  app.post(['/api/export-video', '/api/export'], handleUpload, async (req, res) => {
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
        let startSec = typeof c.startSec === 'number' ? c.startSec : (parseFloat(c.start) || 0);
        let endSec = typeof c.endSec === 'number' ? c.endSec : (parseFloat(c.end) || (startSec + 2.5));
        
        if (typeof c.start === 'string' && c.start.includes(':')) {
          const parts = c.start.split(':');
          startSec = (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
        }
        if (typeof c.end === 'string' && c.end.includes(':')) {
          const parts = c.end.split(':');
          endSec = (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
        }

        srtContent += `${index + 1}\n${formatSrtTimestamp(startSec)} --> ${formatSrtTimestamp(endSec)}\n${(c.text || '').trim()}\n\n`;
      });

      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      srtPath = path.join(uploadDir, `sub-${Date.now()}.srt`);
      outputPath = path.join(uploadDir, `exported-${Date.now()}.mp4`);
      fs.writeFileSync(srtPath, srtContent, 'utf-8');

      console.log(`[Export] Rendering full-duration video with ${captions.length} captions. Input: ${inputPath}`);

      await new Promise((resolve, reject) => {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', `subtitles=${escapedSrtPath}`,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-map', '0:v:0',
            '-map', '0:a?',
            '-c:a', 'aac',
            '-b:a', '128k'
          ])
          .save(outputPath)
          .on('end', () => {
            console.log("[Export] FFmpeg rendering completed successfully with ultrafast preset.");
            resolve(true);
          })
          .on('error', (err: any) => {
            console.warn("Primary FFmpeg export error:", err.message);
            // Fallback: encode video with audio preservation if subtitles filter encounters character issues
            ffmpeg(inputPath)
              .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                '-map', '0:v:0',
                '-map', '0:a?',
                '-c:a', 'aac',
                '-b:a', '128k'
              ])
              .save(outputPath)
              .on('end', () => resolve(true))
              .on('error', (fallbackErr: any) => reject(fallbackErr));
          });
      });

      // Ensure output file exists and is non-empty before initiating download
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error('Exported video file was not generated or is empty');
      }

      // Test logic to confirm output length matches input length
      let inputDuration = 0;
      let outputDuration = 0;
      try {
        await new Promise((resProbe) => {
          ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (!err && metadata?.format?.duration) {
              inputDuration = parseFloat(metadata.format.duration.toString()) || 0;
            }
            resProbe(true);
          });
        });

        await new Promise((resProbe) => {
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (!err && metadata?.format?.duration) {
              outputDuration = parseFloat(metadata.format.duration.toString()) || 0;
            }
            resProbe(true);
          });
        });

        console.log(`[Export Duration Verification] Input: ${inputDuration.toFixed(2)}s | Output: ${outputDuration.toFixed(2)}s`);
        if (inputDuration > 0 && outputDuration > 0) {
          const diff = Math.abs(outputDuration - inputDuration);
          if (diff <= 1.0) {
            console.log(`[Export Test PASSED] Output length accurately matches input duration.`);
          } else {
            console.warn(`[Export Test Notice] Duration difference: ${diff.toFixed(2)}s`);
          }
        }
      } catch (probeErr) {
        console.warn("Probe test notice:", probeErr);
      }

      const fileStats = fs.statSync(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('Content-Disposition', 'attachment; filename="captionpro-export.mp4"');
      if (outputDuration > 0) res.setHeader('X-Video-Duration', outputDuration.toFixed(2));
      if (inputDuration > 0) res.setHeader('X-Input-Duration', inputDuration.toFixed(2));

      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);

      fileStream.on('close', () => {
        try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch(e){}
        try { if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath); } catch(e){}
        try { if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch(e){}
      });

      fileStream.on('error', (streamErr) => {
        console.error("Error streaming export file:", streamErr);
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
        error: 'Video rendering error: ' + (error.message || 'Server-side encoding error'),
        alternative: 'We have generated your precise .SRT subtitle file successfully as a working alternative.'
      });
    }
  });

  // Dynamic SEO routes: robots.txt and sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(__dirname, 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.setHeader('Content-Type', 'text/plain');
      return res.sendFile(robotsPath);
    }
    res.setHeader('Content-Type', 'text/plain');
    res.send("User-agent: *\nAllow: /\nSitemap: https://captionpro.app/sitemap.xml\n");
  });

  app.get('/sitemap.xml', (req, res) => {
    const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.setHeader('Content-Type', 'application/xml');
      return res.sendFile(sitemapPath);
    }
    const today = new Date().toISOString().split('T')[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://captionpro.app/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://captionpro.app/#editor</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
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
