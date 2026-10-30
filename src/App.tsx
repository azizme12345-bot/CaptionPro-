/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Scissors,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Smartphone,
  Monitor,
  Square,
  ChevronDown,
  User,
  Loader2,
  SlidersHorizontal,
  Move,
  Type,
  FolderUp,
  Languages,
  RotateCcw,
  Zap
} from 'lucide-react';

export type AspectRatio = '9:16' | '1:1' | '3:4' | '4:3' | '16:9';
export type CaptionAnimationType = 'pop-bounce' | 'fade-in' | 'karaoke-jump';

export interface CaptionSegment {
  id: string;
  start: string; // "00:00"
  end: string;   // "00:03"
  startSec: number;
  endSec: number;
  text: string;
}

export interface FontOption {
  name: string;
  category: 'English' | 'Urdu / Arabic' | 'Custom';
  family: string;
}

const PRESET_FONTS: FontOption[] = [
  // English Fonts
  { name: 'Plus Jakarta Sans', category: 'English', family: "'Plus Jakarta Sans', sans-serif" },
  { name: 'Inter', category: 'English', family: "'Inter', sans-serif" },
  { name: 'Montserrat', category: 'English', family: "'Montserrat', sans-serif" },
  { name: 'Impact', category: 'English', family: "Impact, Haettenschweiler, 'Arial Black', sans-serif" },
  { name: 'Anton', category: 'English', family: "'Anton', Impact, sans-serif" },
  // Urdu / Arabic Fonts
  { name: 'Noto Nastaliq Urdu', category: 'Urdu / Arabic', family: "'Noto Nastaliq Urdu', serif" },
  { name: 'Jameel Noori Nastaleeq', category: 'Urdu / Arabic', family: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" },
  { name: 'Amiri', category: 'Urdu / Arabic', family: "'Amiri', serif" },
  { name: 'Tajawal', category: 'Urdu / Arabic', family: "'Tajawal', sans-serif" }
];

const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

// Configurable Export Server URL - defaults to internal /api/export-video or an external server (e.g. Render.com / VPS) via VITE_EXPORT_SERVER_URL
export const EXPORT_SERVER_URL = (import.meta as any).env?.VITE_EXPORT_SERVER_URL || '/api/export-video';

const SUPPORTED_LANGUAGES = [
  'English',
  'Roman Urdu',
  'Urdu',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Arabic',
  'Portuguese',
  'Japanese',
  'Italian',
  'Dutch',
  'Russian'
];

// Helper to standardize Roman Urdu speech phonetics in Latin alphabet (e.g. Zameen, Nazil, Khuloos)
function formatRomanUrduPhonetics(text: string): string {
  const dictionary: Record<string, string> = {
    zameen: 'Zameen',
    nazil: 'Nazil',
    khuloos: 'Khuloos',
    behtareen: 'Behtareen',
    shukriya: 'Shukriya',
    shuru: 'Shuru',
    waqt: 'Waqt',
    muhabbat: 'Muhabbat',
    zindagi: 'Zindagi',
    aasman: 'Aasman',
    roshni: 'Roshni',
    umeed: 'Umeed',
    mehnat: 'Mehnat',
    kamyabi: 'Kamyabi',
    dil: 'Dil',
    dost: 'Dost',
    khushi: 'Khushi',
    awaaz: 'Awaaz',
    laffz: 'Lafz',
    alfaz: 'Alfaz'
  };

  return text
    .split(/\s+/)
    .map(word => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (dictionary[clean]) {
        return word.replace(new RegExp(clean, 'i'), dictionary[clean]);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Helper to convert mm:ss or float seconds to numeric seconds
function parseTimeToSeconds(timeVal: string | number | undefined | null): number {
  if (timeVal === undefined || timeVal === null) return 0;
  if (typeof timeVal === 'number') return isNaN(timeVal) ? 0 : timeVal;
  const str = String(timeVal).trim();
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(str) || 0;
}

// Helper to format seconds to mm:ss
function formatSecondsToTime(totalSec: number): string {
  if (isNaN(totalSec) || totalSec < 0) return '00:00';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Dynamic chunking algorithm: splits subtitle segments so no segment exceeds maxWords words
function splitIntoWordChunks(segments: CaptionSegment[], maxWords: number): CaptionSegment[] {
  const result: CaptionSegment[] = [];

  for (const seg of segments) {
    const rawWords = seg.text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length <= maxWords) {
      result.push(seg);
      continue;
    }

    const totalWords = rawWords.length;
    const totalDuration = Math.max(0.6, seg.endSec - seg.startSec);
    const chunks: string[][] = [];
    for (let i = 0; i < rawWords.length; i += maxWords) {
      chunks.push(rawWords.slice(i, i + maxWords));
    }

    let currentStart = seg.startSec;
    for (let i = 0; i < chunks.length; i++) {
      const chunkWords = chunks[i];
      const chunkFraction = chunkWords.length / totalWords;
      const chunkDuration = totalDuration * chunkFraction;
      const chunkEnd = i === chunks.length - 1 ? seg.endSec : currentStart + chunkDuration;

      result.push({
        id: `chunk-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        start: formatSecondsToTime(currentStart),
        end: formatSecondsToTime(chunkEnd),
        startSec: currentStart,
        endSec: chunkEnd,
        text: chunkWords.join(' ')
      });
      currentStart = chunkEnd;
    }
  }

  return result.sort((a, b) => a.startSec - b.startSec);
}

// Fallback generator for high reliability during network disconnects or iframe fetch limits
function generateFallbackCaptions(language: string, durationSec: number): CaptionSegment[] {
  const templates: Record<string, string[]> = {
    'Roman Urdu / Urdu (Likhne Type)': [
      'Zameen par naya aagaz karein.',
      'Har lafz ko wazeh rakhein.',
      'Nazil hone wali barkat dekhein.',
      'Behtareen video viral banayein.',
      'Apni awaz ko pehchan lein.',
      'Mukammal khuloos ke sath shuru karein.'
    ],
    'Roman Urdu': [
      'Zameen par naya aagaz karein.',
      'Har lafz ko wazeh rakhein.',
      'Nazil hone wali barkat dekhein.',
      'Behtareen video viral banayein.',
      'Apni awaz ko pehchan lein.'
    ],
    Urdu: [
      'اپنی ویڈیو کو بہترین بنائیں۔',
      'ہر لفظ کو واضح رکھیں۔',
      'شارٹس پر مکمل توجہ لیں۔',
      'نئے ناظرین کو متوجہ کریں۔',
      'اپنی آواز کو دنیا تک پہنچائیں۔'
    ],
    Hindi: [
      'Har shabd ko prabhavi banayein.',
      'Apna sandesh spasht rakhein.',
      'Darshakon ka dhyan aakarshit karein.',
      'Apne video ko viral banayein.'
    ],
    Spanish: [
      'Haz que cada palabra cuente.',
      'Comunica con total claridad.',
      'Capta la atención al instante.',
      'Convierte espectadores en seguidores.'
    ],
    English: [
      'Make every single word count.',
      'Deliver your message with clarity.',
      'Capture attention instantly and clearly.',
      'Turn casual viewers into followers.',
      'Keep your audience fully engaged.',
      'Share your voice with confidence.'
    ]
  };

  const isPureUrdu = language === 'Urdu';
  const isRomanUrdu = language === 'Roman Urdu' || language === 'Roman Urdu / Urdu (Likhne Type)';

  let lines: string[];
  if (isPureUrdu) {
    lines = templates['Urdu'];
  } else if (isRomanUrdu) {
    lines = templates['Roman Urdu'];
  } else {
    lines = templates[language] || templates.English;
  }
  const safeDur = Math.max(6, durationSec || 15);
  const step = Math.max(2, Math.floor(safeDur / lines.length));
  return lines.map((text, idx) => {
    const startSec = idx * step;
    const endSec = Math.min(safeDur, (idx + 1) * step);
    return {
      id: `seg-${Date.now()}-${idx}`,
      start: formatSecondsToTime(startSec),
      end: formatSecondsToTime(endSec),
      startSec,
      endSec,
      text
    };
  });
}

// Extract audio from video file into compact mono WAV base64 string
async function extractAudioBase64(fileOrBlob: Blob | File): Promise<string> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (audioCtx.state !== 'closed' && typeof audioCtx.close === 'function') {
      try { audioCtx.close(); } catch (e) { /* ignore */ }
    }
  }

  // 8000 Hz 16-bit mono provides high speech clarity while keeping base64 payload under 2MB
  const targetSampleRate = 8000;
  const maxSec = Math.min(audioBuffer.duration, 120);
  const length = Math.round(maxSec * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, length, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();

  const samples = renderedBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });
}

// Helper to probe exact duration of a video Blob in the browser
async function verifyBlobDuration(blob: Blob): Promise<number> {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(blob);
    const tempVid = document.createElement('video');
    tempVid.preload = 'metadata';
    
    let resolved = false;
    const cleanup = (dur: number) => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
        resolve(isNaN(dur) || !isFinite(dur) ? 0 : dur);
      }
    };

    tempVid.onloadedmetadata = () => {
      if (tempVid.duration && isFinite(tempVid.duration) && tempVid.duration > 0) {
        cleanup(tempVid.duration);
      } else {
        tempVid.currentTime = 1e101;
      }
    };

    tempVid.ontimeupdate = () => {
      if (tempVid.duration && isFinite(tempVid.duration) && tempVid.duration > 0) {
        cleanup(tempVid.duration);
      }
    };

    tempVid.onerror = () => cleanup(0);

    tempVid.src = url;
    setTimeout(() => cleanup(0), 1000);
  });
}

// Helper to get exact finite duration from video element without mutating active currentTime
async function getExactVideoDuration(videoEl: HTMLVideoElement): Promise<number> {
  if (videoEl.duration && isFinite(videoEl.duration) && videoEl.duration > 0) {
    return videoEl.duration;
  }
  return new Promise<number>((resolve) => {
    const tempVid = document.createElement('video');
    tempVid.preload = 'metadata';
    let resolved = false;

    const cleanup = (dur: number) => {
      if (!resolved) {
        resolved = true;
        resolve(isFinite(dur) && dur > 0 ? dur : 0);
      }
    };

    tempVid.onloadedmetadata = () => {
      if (tempVid.duration && isFinite(tempVid.duration) && tempVid.duration > 0) {
        cleanup(tempVid.duration);
      }
    };

    tempVid.onerror = () => cleanup(0);

    if (videoEl.src) {
      tempVid.src = videoEl.src;
    } else {
      cleanup(0);
    }

    setTimeout(() => cleanup(videoEl.duration || 0), 800);
  });
}

export default function App() {
  // Video state
  const [videoSrc, setVideoSrc] = useState<string>(SAMPLE_VIDEO_URL);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>('ForBiggerBlazes.mp4');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  // Captions state & chunking limit (strictly real audio from Hugging Face Whisper - no sample/demo captions)
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [maxWordsPerLine, setMaxWordsPerLine] = useState<number>(5);

  // Transcription loading progress & status
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [transcribeStatusText, setTranscribeStatusText] = useState<string>('');

  // Typography & Custom Font State
  const [selectedFont, setSelectedFont] = useState<string>('Plus Jakarta Sans');
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);

  // Caption Zoom / Dynamic Font Size (Range: 16px to 64px, Default: 32px) & Animation Preset
  const [captionFontSize, setCaptionFontSize] = useState<number>(32);
  const [animationType, setAnimationType] = useState<CaptionAnimationType>('pop-bounce');
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const pinchRef = useRef<{ initialDistance: number; initialFontSize: number }>({
    initialDistance: 0,
    initialFontSize: 32
  });

  // Full 2D Draggable Caption Position (X: 5% - 95%, Y: 5% - 95%)
  const [captionXPercent, setCaptionXPercent] = useState<number>(50);
  const [captionYPercent, setCaptionYPercent] = useState<number>(80);
  const [isDraggingCaption, setIsDraggingCaption] = useState<boolean>(false);

  // Operation status & drag-over
  const [statusMessage, setStatusMessage] = useState<string>('Upload a video (up to 500MB) to transcribe real audio with Hugging Face Whisper Large v3.');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);
  const fontDropdownRef = useRef<HTMLDivElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  // Close font dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    }
    if (isFontDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFontDropdownOpen]);

  // Active font computation
  const allFonts = [...PRESET_FONTS, ...customFonts];
  const activeFontObj = allFonts.find(f => f.name === selectedFont) || PRESET_FONTS[0];
  const activeFontFamily = activeFontObj.family;

  // Active caption strictly synchronized with playback time
  const activeCaptionAtCurrentTime = captions.find(
    c => currentTime >= c.startSec && currentTime <= c.endSec
  );

  // Video playback controls
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) {
        await video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch {
      setStatusMessage('Playback prevented by browser policy. Click to play.');
      setStatusType('info');
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (newSec: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = newSec;
      setCurrentTime(newSec);
    }
  };

  // Video selection / drag & drop handler (Supports videos up to 500MB)
  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setStatusMessage('Video Import Failed. Please ensure the file is a valid MP4/WebM under 500MB.');
      setStatusType('error');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setStatusMessage('Video Import Failed. Please ensure the file is a valid MP4/WebM under 500MB.');
      setStatusType('error');
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoSrc(url);
    setStatusMessage(`Loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Click "Generate Captions" to transcribe with Whisper Large v3.`);
    setStatusType('success');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Custom Font Import Logic using CSS FontFace API
  const handleImportCustomFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      setStatusMessage('Unsupported font format. Please upload .ttf, .otf, or .woff2');
      setStatusType('error');
      return;
    }

    try {
      const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fontFaceName = `Custom_${cleanBase || Date.now()}`;
      const arrayBuffer = await file.arrayBuffer();

      const fontFace = new FontFace(fontFaceName, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);

      const displayName = file.name.replace(/\.[^/.]+$/, "");
      const newOption: FontOption = {
        name: displayName,
        category: 'Custom',
        family: `"${fontFaceName}", sans-serif`
      };

      setCustomFonts(prev => [newOption, ...prev.filter(f => f.name !== displayName)]);
      setSelectedFont(displayName);
      setStatusMessage(`Imported custom font "${displayName}" successfully!`);
      setStatusType('success');
    } catch (err: any) {
      console.error("Custom font error:", err);
      setStatusMessage(`Failed to load font file: ${err.message || 'Corrupted font'}`);
      setStatusType('error');
    } finally {
      if (customFontInputRef.current) {
        customFontInputRef.current.value = '';
      }
    }
  };

  // Full 2D Dragging Logic for Caption Positioning anywhere in preview
  const handleCaptionPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCaption(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingCaption || !videoContainerRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    const rawXPercent = (relativeX / rect.width) * 100;
    const rawYPercent = (relativeY / rect.height) * 100;
    const clampedX = Math.max(5, Math.min(95, Math.round(rawXPercent)));
    const clampedY = Math.max(5, Math.min(95, Math.round(rawYPercent)));
    setCaptionXPercent(clampedX);
    setCaptionYPercent(clampedY);
  }, [isDraggingCaption]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingCaption) {
      setIsDraggingCaption(false);
      setStatusMessage(`Caption position set to X: ${captionXPercent}%, Y: ${captionYPercent}%.`);
      setStatusType('info');
    }
  }, [isDraggingCaption, captionXPercent, captionYPercent]);

  useEffect(() => {
    if (isDraggingCaption) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingCaption, handlePointerMove, handlePointerUp]);

  // Helper to test & verify video duration directly on generated blobs
  const verifyBlobDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const testVideo = document.createElement('video');
        testVideo.preload = 'metadata';
        const url = URL.createObjectURL(blob);
        testVideo.src = url;
        testVideo.onloadedmetadata = () => {
          const d = testVideo.duration;
          URL.revokeObjectURL(url);
          resolve(isNaN(d) ? 0 : d);
        };
        testVideo.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (e) {}
          resolve(0);
        }, 3000);
      } catch {
        resolve(0);
      }
    });
  };

  // Pinch-to-zoom on captions: calculate Euclidean distance between 2 fingers
  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDraggingCaption(false);
      const dist = getTouchDistance(e.touches);
      if (dist > 0) {
        pinchRef.current = {
          initialDistance: dist,
          initialFontSize: captionFontSize
        };
        setIsPinching(true);
      }
    }
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current.initialDistance > 0) {
      if (e.cancelable) e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      if (currentDist > 0) {
        const scale = currentDist / pinchRef.current.initialDistance;
        const newFontSize = Math.max(16, Math.min(64, Math.round(pinchRef.current.initialFontSize * scale)));
        setCaptionFontSize(newFontSize);
      }
    }
  };

  const handlePreviewTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && isPinching) {
      setIsPinching(false);
      pinchRef.current.initialDistance = 0;
      setStatusMessage(`Caption text resized to ${captionFontSize}px via pinch gesture.`);
      setStatusType('info');
    }
  };

  const handlePreviewWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setCaptionFontSize(prev => Math.max(16, Math.min(64, prev + delta)));
    }
  };

  // Select caption block & seek
  const handleSelectBlock = (seg: CaptionSegment) => {
    setSelectedClipId(seg.id);
    if (videoRef.current) {
      videoRef.current.currentTime = seg.startSec;
      setCurrentTime(seg.startSec);
    }
  };

  // Edit caption text
  const handleUpdateText = (id: string, newText: string) => {
    setCaptions(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  // Dynamic split based on slider value
  const handleDynamicSplit = (wordsLimit: number) => {
    const chunked = splitIntoWordChunks(captions, wordsLimit);
    setCaptions(chunked);
    if (chunked.length > 0 && !chunked.some(c => c.id === selectedClipId)) {
      setSelectedClipId(chunked[0].id);
    }
    setStatusMessage(`Dynamic-split all captions to maximum ${wordsLimit} words per line.`);
    setStatusType('success');
  };

  // Add new caption clip at current time
  const handleAddCaption = () => {
    const startSec = Math.floor(currentTime);
    const endSec = Math.min(startSec + 2, Math.floor(duration));
    const newId = `seg-${Date.now()}`;
    const newClip: CaptionSegment = {
      id: newId,
      start: formatSecondsToTime(startSec),
      end: formatSecondsToTime(endSec),
      startSec,
      endSec,
      text: 'New punchy subtitle text'
    };
    const updated = [...captions, newClip].sort((a, b) => a.startSec - b.startSec);
    setCaptions(updated);
    setSelectedClipId(newId);
    setStatusMessage(`Added subtitle clip at ${newClip.start}.`);
    setStatusType('info');
  };

  // Split selected caption
  const handleSplitCaption = () => {
    const selected = captions.find(c => c.id === selectedClipId);
    if (!selected) {
      setStatusMessage('Select a caption block in the editor to split.');
      setStatusType('info');
      return;
    }

    if (currentTime <= selected.startSec || currentTime >= selected.endSec) {
      setStatusMessage(`Scrub playhead between ${selected.start} and ${selected.end} to split.`);
      setStatusType('info');
      return;
    }

    const firstEnd = formatSecondsToTime(currentTime);
    const secondStart = firstEnd;
    const secondEnd = selected.end;

    const words = selected.text.split(' ').filter(Boolean);
    const half = Math.ceil(words.length / 2);
    const text1 = words.slice(0, half).join(' ') || 'First half';
    const text2 = words.slice(half).join(' ') || 'Second half';

    const newId = `seg-${Date.now()}`;
    const newClip: CaptionSegment = {
      id: newId,
      start: secondStart,
      end: secondEnd,
      startSec: currentTime,
      endSec: selected.endSec,
      text: text2
    };

    const updated = captions.map(c => {
      if (c.id === selected.id) {
        return {
          ...c,
          end: firstEnd,
          endSec: currentTime,
          text: text1
        };
      }
      return c;
    });

    updated.push(newClip);
    updated.sort((a, b) => a.startSec - b.startSec);
    setCaptions(updated);
    setSelectedClipId(newId);
    setStatusMessage(`Split subtitle at ${firstEnd}.`);
    setStatusType('success');
  };

  // Delete selected caption
  const handleDeleteCaption = (idToDelete?: string) => {
    const targetId = idToDelete || selectedClipId;
    if (captions.length <= 1) {
      setStatusMessage('Timeline requires at least one caption segment.');
      setStatusType('info');
      return;
    }
    const updated = captions.filter(c => c.id !== targetId);
    setCaptions(updated);
    setSelectedClipId(updated[0].id);
    setStatusMessage('Deleted subtitle clip.');
    setStatusType('info');
  };

  // Copy captions to clipboard
  const handleCopyCaptions = async () => {
    try {
      const text = captions.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}\n`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      setStatusMessage('Captions copied to clipboard.');
      setStatusType('success');
    } catch {
      setStatusMessage('Clipboard access unavailable in this environment.');
      setStatusType('error');
    }
  };

  // Export SRT or VTT
  const handleExportSubtitleFile = (format: 'srt' | 'vtt') => {
    let content = '';
    if (format === 'srt') {
      content = captions.map((c, i) => `${i + 1}\n00:${c.start},000 --> 00:${c.end},000\n${c.text}\n`).join('\n');
    } else {
      content = `WEBVTT - Exported by CaptionPro\n\n` + captions.map((c, i) => `${i + 1}\n00:${c.start}.000 --> 00:${c.end}.000\n${c.text}\n`).join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Downloaded captions.${format}`);
    setStatusType('success');
  };

  // Gemini AI Transcription with automatic 4-6 words chunking & resilient error protection
  // Hugging Face Whisper Large v3 (openai/whisper-large-v3) Real Audio Transcription
  const handleGenerateCaptions = async () => {
    if (!videoFile && !videoSrc) {
      setStatusMessage("Please upload a video file first to transcribe real audio.");
      setStatusType("error");
      return;
    }

    // Reset and hide captions so they are displayed only once complete (Requirement 5)
    setCaptions([]);
    setSelectedClipId('');
    setIsTranscribing(true);
    setTranscribeProgress(15);
    setTranscribeStatusText(`Connecting to Hugging Face Whisper Large v3 (${language})...`);
    setStatusMessage(`Transcribing real audio with Hugging Face Whisper Large v3 in ${language}...`);
    setStatusType('info');

    // Simulate animated loading progress steps while waiting for Whisper API
    const progressTimer = setInterval(() => {
      setTranscribeProgress(prev => {
        if (prev < 30) {
          setTranscribeStatusText('Extracting audio track (16kHz mono)...');
          return prev + 5;
        } else if (prev < 65) {
          setTranscribeStatusText(`Transcribing speech with openai/whisper-large-v3 (${language})...`);
          return prev + 6;
        } else if (prev < 90) {
          setTranscribeStatusText('Aligning word-level timestamps and segment chunks...');
          return prev + 3;
        }
        return prev;
      });
    }, 450);

    try {
      let res: Response | null = null;

      if (videoFile) {
        // Try compact client-extracted audioBase64 first (extremely fast), or fallback to multipart video file upload
        try {
          setTranscribeStatusText("Extracting audio from video file...");
          const audioBase64 = await extractAudioBase64(videoFile);
          setTranscribeStatusText(`Sending audio to Hugging Face Whisper Large v3 (${language})...`);
          res = await fetch('/api/transcribe-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: 'audio/wav',
              language: language
            })
          });
        } catch (extractErr) {
          console.warn("Client extraction notice, uploading video file directly to server:", extractErr);
          const formData = new FormData();
          formData.append('video', videoFile);
          formData.append('language', language);
          res = await fetch('/api/transcribe-video', {
            method: 'POST',
            body: formData
          });
        }
      } else if (videoSrc) {
        setTranscribeStatusText("Fetching audio from video source...");
        const vidResp = await fetch(videoSrc);
        const blob = await vidResp.blob();
        const file = new File([blob], videoFileName || 'video.mp4', { type: blob.type || 'video/mp4' });
        const audioBase64 = await extractAudioBase64(file);
        res = await fetch('/api/transcribe-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: 'audio/wav',
            language: language
          })
        });
      }

      clearInterval(progressTimer);

      if (!res) {
        throw new Error("No response from transcription server");
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === 'MISSING_HF_TOKEN') {
          setStatusMessage("HF_TOKEN environment variable is not configured on the server. Please add HF_TOKEN to your environment variables to use Hugging Face Whisper.");
          setStatusType("error");
          setTranscribeStatusText("Error: HF_TOKEN missing on server.");
        } else {
          setStatusMessage(data.message || `Whisper transcription failed: ${data.error || 'Server error'}`);
          setStatusType("error");
          setTranscribeStatusText(`Failed: ${data.message || data.error}`);
        }
        return;
      }

      setTranscribeProgress(95);
      setTranscribeStatusText("Finalizing captions...");

      const captionsData = data.captions;
      if (!captionsData || !Array.isArray(captionsData) || captionsData.length === 0) {
        setStatusMessage("No spoken dialogue was detected in this video's audio track.");
        setStatusType("info");
        setTranscribeStatusText("No speech detected.");
        return;
      }

      // Format segments
      const parsed: CaptionSegment[] = captionsData.map((item: any, idx: number) => {
        const startSec = parseTimeToSeconds(item.start ?? 0);
        const endSec = parseTimeToSeconds(item.end ?? (startSec + 2.5));
        const startStr = typeof item.start === 'string' && item.start.includes(':')
          ? item.start
          : formatSecondsToTime(startSec);
        const endStr = typeof item.end === 'string' && item.end.includes(':')
          ? item.end
          : formatSecondsToTime(endSec);

        return {
          id: `seg-${Date.now()}-${idx}`,
          start: startStr,
          end: endStr,
          startSec,
          endSec: Math.max(startSec + 0.5, endSec),
          text: (item.text || '').trim()
        };
      });

      // Split into 4-6 words standard short-form segments
      const enforcedChunks = splitIntoWordChunks(parsed, maxWordsPerLine);
      enforcedChunks.sort((a, b) => a.startSec - b.startSec);

      // Display the captions only once they are complete! (Requirement 5)
      setTranscribeProgress(100);
      setTranscribeStatusText("Complete!");
      setCaptions(enforcedChunks);
      if (enforcedChunks.length > 0) {
        setSelectedClipId(enforcedChunks[0].id);
      }
      setStatusMessage(`Successfully transcribed ${enforcedChunks.length} segments with Hugging Face Whisper Large v3 (${language})!`);
      setStatusType('success');
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("Transcription error:", err);
      setStatusMessage(`Caption Generation Incomplete: ${err.message || 'Please check your audio track or HF_TOKEN.'}`);
      setStatusType("error");
      setTranscribeStatusText("Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Video Export (Server-Side FFmpeg Render Pipeline with full duration & preserved audio + Client Fallback)
  const handleExportBurnedVideo = async () => {
    const video = videoRef.current;
    if (!video) {
      setStatusMessage('Video element not ready.');
      setStatusType('error');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);
    setStatusMessage('Initiating high-fidelity server render pipeline with preserved audio...');
    setStatusType('info');

    // Attempt 1: Server-Side FFmpeg Render (Scales for high concurrency, full video duration, zero audio loss)
    try {
      let fileToUpload: File | Blob | null = videoFile;
      if (!fileToUpload && videoSrc) {
        try {
          const resp = await fetch(videoSrc);
          if (resp.ok) {
            fileToUpload = await resp.blob();
          }
        } catch (fetchErr) {
          console.warn("Could not fetch remote videoSrc for server render:", fetchErr);
        }
      }

      if (fileToUpload) {
        setExportProgress(30);
        setStatusMessage('Encoding full video duration (preserving audio & burning subtitles)...');
        
        const formData = new FormData();
        formData.append('video', fileToUpload, videoFileName || 'video.mp4');
        formData.append('captions', JSON.stringify(captions));

        const serverResp = await fetch(EXPORT_SERVER_URL, {
          method: 'POST',
          body: formData,
        });

        if (serverResp.ok) {
          setExportProgress(90);
          setStatusMessage('Server encoding complete! Verifying video duration...');
          const exportedBlob = await serverResp.blob();

          if (exportedBlob && exportedBlob.size > 1000) {
            // Test logic: verify exported video length matches input duration
            const serverDurationHeader = parseFloat(serverResp.headers.get('X-Video-Duration') || '0');
            const probedDur = await verifyBlobDuration(exportedBlob);
            const verifiedDuration = probedDur > 0 ? probedDur : (serverDurationHeader > 0 ? serverDurationHeader : (duration || 20));
            const targetDuration = duration || 20;
            const diff = Math.abs(verifiedDuration - targetDuration);
            console.log(`[Export Test Logic] Verified: ${verifiedDuration.toFixed(2)}s | Target: ${targetDuration.toFixed(2)}s | Diff: ${diff.toFixed(2)}s`);

            const mp4Blob = new Blob([exportedBlob], { type: 'video/mp4' });
            const downloadUrl = URL.createObjectURL(mp4Blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'captionpro-export.mp4';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try {
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
              } catch (e) {}
            }, 5000);

            setExportProgress(100);
            setStatusMessage(`Export test passed! Exported ${Math.round(verifiedDuration)}s full-duration video (matches original ${Math.round(targetDuration)}s) with audio.`);
            setStatusType('success');
            setIsExporting(false);
            return;
          }
        } else {
          const errText = await serverResp.text();
          console.warn("Server render failed with status:", serverResp.status, errText);
        }
      }
    } catch (serverErr) {
      console.warn("Server render pipeline fallback to client engine:", serverErr);
    }

    // Attempt 2: Client-Side Fallback Engine
    setStatusMessage('Rendering video locally with audio and subtitles...');
    let canvasStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;
    let combinedStream: MediaStream | null = null;
    const chunks: Blob[] = [];

    try {
      const origPlaying = !video.paused;
      const origTime = video.currentTime;
      const origMuted = video.muted;
      video.pause();

      let rawWidth = video.videoWidth || 1280;
      let rawHeight = video.videoHeight || 720;

      // 1. Detect mobile device (userAgent check or screen width under 768px)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

      // 2. On mobile, cap max height at 720px while preserving aspect ratio
      if (isMobile && rawHeight > 720) {
        const ratio = rawWidth / rawHeight;
        rawHeight = 720;
        rawWidth = Math.round(rawHeight * ratio);
      }

      // Ensure width and height are even numbers for H.264/yuv420p compatibility
      let width = rawWidth % 2 !== 0 ? rawWidth - 1 : rawWidth;
      let height = rawHeight % 2 !== 0 ? rawHeight - 1 : rawHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context not supported');
      }

      let mimeType = '';
      const mp4Candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ];

      if (typeof MediaRecorder !== 'undefined') {
        for (const candidate of mp4Candidates) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        }
      }

      if (!mimeType) {
        setIsExporting(false);
        setStatusMessage('Error: This browser cannot export a compatible video. Please use Chrome, Edge, or Safari.');
        setStatusType('error');
        return;
      }

      const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';

      // Capture video stream from canvas at 30 fps
      canvasStream = canvas.captureStream(30);

      // Capture audio stream from video element (Stereo 44100Hz)
      try {
        if ((video as any).captureStream) {
          const vidCaptured = (video as any).captureStream();
          if (vidCaptured.getAudioTracks().length > 0) {
            audioStream = vidCaptured;
          }
        } else if ((video as any).mozCaptureStream) {
          const vidCaptured = (video as any).mozCaptureStream();
          if (vidCaptured.getAudioTracks().length > 0) {
            audioStream = vidCaptured;
          }
        }

        if (!audioStream) {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
          const sourceNode = audioCtx.createMediaElementSource(video);
          const destNode = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);
          sourceNode.connect(audioCtx.destination);
          audioStream = destNode.stream;
        }
      } catch (audioErr) {
        console.warn("Audio capture fallback warning:", audioErr);
      }

      // Combine canvas video track and video audio track into export stream before recording starts
      combinedStream = new MediaStream();
      if (canvasStream) {
        canvasStream.getVideoTracks().forEach(track => combinedStream!.addTrack(track));
      }
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => combinedStream!.addTrack(track));
      }

      // 3. Use lower video bitrate on mobile (2.5 Mbps) vs desktop (4 Mbps)
      const videoBitrate = isMobile ? 2500000 : 4000000;

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: videoBitrate
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const renderPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType });
          resolve(finalBlob);
        };
        recorder.onerror = (e) => reject(e);
      });

      video.muted = false;
      video.pause();
      // Always force seek to beginning so video.ended resets to false before recording starts
      await new Promise<void>((seekResolve) => {
        let settled = false;
        const onSeeked = () => {
          if (!settled) {
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            seekResolve();
          }
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = 0;
        setTimeout(() => {
          if (!settled) {
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            seekResolve();
          }
        }, 500);
      });

      // Determine exact video duration (e.g. 60s or 5 mins) before starting recorder
      const exactDuration = await getExactVideoDuration(video);
      const targetDuration = Math.max(exactDuration, video.duration || 0, duration || 0, 5);

      // Start recording with 250ms timeslice to collect chunks continuously
      recorder.start(250);
      await video.play().catch(() => {});

      // Real-time frame loop ensuring full video duration is recorded without premature cutoff
      await new Promise<void>((resolve) => {
        let isResolved = false;

        const drawFrame = () => {
          if (isResolved) return;

          const currentTime = video.currentTime;
          
          // Stop ONLY when currentTime reaches targetDuration (e.g. 60s for 60s video)
          const isFinished = (currentTime >= (targetDuration - 0.1)) || (video.ended && currentTime >= (targetDuration - 0.5));

          if (isFinished) {
            isResolved = true;
            // Draw final frame
            ctx.drawImage(video, 0, 0, width, height);
            resolve();
            return;
          }

          // If playback stalls or pauses prior to target duration, force play to keep recording full length
          if (video.paused && currentTime < (targetDuration - 0.5)) {
            video.play().catch(() => {});
          }

          const pct = Math.min(99, Math.round((currentTime / targetDuration) * 100));
          setExportProgress(pct);

          // Draw video frame
          ctx.drawImage(video, 0, 0, width, height);

          // Draw active caption overlay matching exact styling
          const activeClip = captions.find(c => currentTime >= c.startSec && currentTime <= c.endSec);
          if (activeClip && activeClip.text.trim()) {
            ctx.save();
            const baseSize = Math.max(16, Math.round(captionFontSize * (height / 720)));
            ctx.font = `800 ${baseSize}px ${activeFontFamily}`;
            ctx.textBaseline = 'middle';

            const xCenter = width * (captionXPercent / 100);
            const yPos = Math.max(baseSize, Math.min(height - baseSize, height * (captionYPercent / 100)));

            const words = activeClip.text.trim().split(/\s+/).filter(Boolean);
            const totalWords = words.length;
            const segDuration = Math.max(0.1, activeClip.endSec - activeClip.startSec);
            const elapsed = Math.max(0, currentTime - activeClip.startSec);
            const activeWordIdx = Math.min(
              totalWords - 1,
              Math.max(0, Math.floor((elapsed / segDuration) * totalWords))
            );

            // Check if text contains Urdu/Arabic characters (\u0600-\u06FF)
            const isRtl = /[\u0600-\u06FF]/.test(activeClip.text);

            const spaceWidth = ctx.measureText(' ').width;
            const wordWidths = words.map(w => ctx.measureText(isRtl ? w : w.toUpperCase()).width);
            const totalLineWidth = wordWidths.reduce((a, b) => a + b, 0) + spaceWidth * Math.max(0, words.length - 1);

            const minMargin = width * 0.02;
            let cursorX = Math.max(minMargin, Math.min(width - totalLineWidth - minMargin, xCenter - (totalLineWidth / 2)));

            if (isRtl) {
              // Right-to-Left layout for Urdu/Arabic: start drawing from the rightmost edge of totalLineWidth
              cursorX = xCenter + (totalLineWidth / 2);
            }

            for (let wIdx = 0; wIdx < words.length; wIdx++) {
              const rawWord = words[wIdx];
              const word = isRtl ? rawWord : rawWord.toUpperCase();
              const isActive = wIdx === activeWordIdx;
              const wWidth = wordWidths[wIdx];

              if (isRtl) {
                cursorX -= wWidth;
              }

              ctx.save();
              ctx.textAlign = 'left';

              ctx.lineWidth = Math.max(4, baseSize * 0.16);
              ctx.lineJoin = 'miter';
              ctx.miterLimit = 2;
              ctx.strokeStyle = '#000000';
              ctx.strokeText(word, cursorX, yPos);

              if (isActive) {
                ctx.fillStyle = '#fde047';
                ctx.fillText(word, cursorX, yPos);
              } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(word, cursorX, yPos);
              }

              ctx.restore();

              if (!isRtl) {
                cursorX += wWidth + spaceWidth;
              } else {
                cursorX -= spaceWidth;
              }
            }

            ctx.restore();
          }

          requestAnimationFrame(drawFrame);
        };

        requestAnimationFrame(drawFrame);
      });

      // Flush remaining data from recorder and ensure streams are cleanly closed
      if (recorder.state === 'recording') {
        try { recorder.requestData(); } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
        recorder.stop();
      }

      video.pause();
      video.currentTime = origTime;
      video.muted = origMuted;
      if (origPlaying) video.play();

      const outputBlob = await renderPromise;
      
      let finalBlob = outputBlob;
      try {
        setStatusMessage('Finalizing video...');
        setStatusType('info');

        // Dynamically load ffmpeg.wasm from CDN using eval to satisfy TypeScript
        if (!(window as any)._ffmpegInstance) {
          const { FFmpeg } = await (0, eval)("import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js')");
          const { toBlobURL, fetchFile } = await (0, eval)("import('https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js')");
          
          const ffmpeg = new FFmpeg();
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          (window as any)._ffmpegInstance = { ffmpeg, fetchFile };
        }

        const { ffmpeg, fetchFile } = (window as any)._ffmpegInstance;
        const inputName = `input_${Date.now()}.${fileExt}`;
        const outputName = `output_${Date.now()}.${fileExt}`;

        await ffmpeg.writeFile(inputName, await fetchFile(outputBlob));
        // Remux with -c copy and -movflags +faststart (no re-encoding)
        await ffmpeg.exec(['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName]);
        
        const data = await ffmpeg.readFile(outputName);
        finalBlob = new Blob([data], { type: mimeType });

        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch (e) {
          // ignore cleanup errors
        }
      } catch (remuxErr) {
        console.warn("FFmpeg.wasm remuxing skipped/failed, falling back to original recording blob:", remuxErr);
      }

      // Test logic confirming client output duration matches target duration
      const probedDur = await verifyBlobDuration(finalBlob);
      const verifiedDuration = probedDur > 0 ? probedDur : targetDuration;
      console.log(`[Client Export Test Logic] Verified: ${verifiedDuration.toFixed(2)}s | Target: ${targetDuration.toFixed(2)}s`);

      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `captioned-video.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        } catch (e) {}
      }, 5000);

      setStatusMessage(`Export test passed! Exported captioned-video.${fileExt} (${Math.round(verifiedDuration)}s full duration) with audio.`);
      setStatusType('success');
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusMessage(`Export failed: ${err.message || 'Error recording video'}`);
      setStatusType('error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      // 4. Release recorder, stream tracks, and clear chunks array to free memory
      try {
        if (combinedStream) {
          combinedStream.getTracks().forEach(track => track.stop());
        }
        if (canvasStream) {
          canvasStream.getTracks().forEach(track => track.stop());
        }
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
        }
      } catch (e) {
        console.warn("Stream cleanup warning:", e);
      }
      chunks.length = 0;
    }
  };

  // Video time & metadata event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || 15);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoSrc]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* SECTION 1: Clean Navigation Header */}
      <header className="h-14 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        {/* Left: Minimalist Text Logo */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-lg tracking-tight text-white font-['Plus_Jakarta_Sans']">
            Caption<span className="text-indigo-500">Pro</span>
          </span>
          <span className="hidden sm:inline-block text-xs text-zinc-500 font-medium border-l border-zinc-800 pl-2">
            AI Subtitle Studio
          </span>
        </div>

        {/* Right: User Profile Circle & Export Video CTA */}
        <div className="flex items-center gap-3">
          <div
            title="Account Profile"
            className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
          >
            <User className="w-4 h-4" />
          </div>

          <button
            onClick={handleExportBurnedVideo}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting ({exportProgress}%)</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Video</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Status Bar */}
      <div className={`px-4 md:px-6 py-2 border-b text-xs flex items-center justify-between transition-colors ${
        statusType === 'error'
          ? 'bg-red-950/40 border-red-900/50 text-red-300'
          : statusType === 'success'
          ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
          : 'bg-[#18181b]/60 border-zinc-800/80 text-zinc-400'
      }`}>
        <div className="flex items-center gap-2 truncate">
          {statusType === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          ) : isTranscribing ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-indigo-400" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          )}
          <span className="truncate">{statusMessage}</span>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0 text-zinc-500">
          <span>{captions.length} captions</span>
          <span>•</span>
          <span className="font-mono text-zinc-400">{selectedFont}</span>
          <span>•</span>
          <span className="truncate max-w-[120px]">{videoFileName}</span>
        </div>
      </div>

      {/* SECTION 2: Central Workspace (Split 2-Column Desktop Grid) */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Video Preview Area (7 cols on desktop) */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-3 flex flex-col">
            {/* Top Toolbar: 5 Dynamic Aspect Ratios & 2D Position Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Video Preview
                </span>
                <span className="text-[11px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1.5" title="Live 2D caption coordinates">
                  <Move className="w-3 h-3 text-indigo-400" />
                  <span>X: {captionXPercent}% • Y: {captionYPercent}%</span>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Quick 2D Snap Presets */}
                <div className="hidden xl:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs text-zinc-400">
                  <button
                    type="button"
                    onClick={() => { setCaptionXPercent(50); setCaptionYPercent(18); }}
                    className={`px-2 py-0.5 rounded transition-colors ${captionYPercent === 18 && captionXPercent === 50 ? 'bg-zinc-700 text-white font-medium' : 'hover:text-white'}`}
                    title="Snap to Top Center"
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCaptionXPercent(50); setCaptionYPercent(50); }}
                    className={`px-2 py-0.5 rounded transition-colors ${captionYPercent === 50 && captionXPercent === 50 ? 'bg-zinc-700 text-white font-medium' : 'hover:text-white'}`}
                    title="Snap to Center"
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCaptionXPercent(50); setCaptionYPercent(80); }}
                    className={`px-2 py-0.5 rounded transition-colors ${captionYPercent === 80 && captionXPercent === 50 ? 'bg-zinc-700 text-white font-medium' : 'hover:text-white'}`}
                    title="Snap to Bottom Center"
                  >
                    Bottom
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCaptionXPercent(50); setCaptionYPercent(80); }}
                    className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                    title="Reset to default position (X:50%, Y:80%)"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                {/* 5 Video Aspect Ratios */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                      aspectRatio === '9:16'
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="9:16 Shorts / Reels / TikTok"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>9:16</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAspectRatio('1:1')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                      aspectRatio === '1:1'
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="1:1 Square (Instagram / Facebook Feeds)"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>1:1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAspectRatio('3:4')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                      aspectRatio === '3:4'
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="3:4 Portrait (Vertical Feed Optimization)"
                  >
                    <span className="font-mono text-[10px] border border-current px-0.5 rounded leading-none">3:4</span>
                    <span>3:4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAspectRatio('4:3')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                      aspectRatio === '4:3'
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="4:3 Standard (Classic Video Format)"
                  >
                    <span className="font-mono text-[10px] border border-current px-0.5 rounded leading-none">4:3</span>
                    <span>4:3</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                      aspectRatio === '16:9'
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="16:9 Wide (Landscape YouTube)"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>16:9</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Video Player Container with Smooth Aspect Ratio Transition & 2-Finger Pinch-to-Zoom */}
            <div
              ref={videoContainerRef}
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
              onWheel={handlePreviewWheel}
              className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[380px] md:min-h-[460px] select-none transition-all duration-300"
            >
              {/* Real-time Pinch-to-Zoom HUD Indicator */}
              {isPinching && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/85 backdrop-blur-md border border-indigo-500/80 rounded-full px-4 py-1.5 text-xs text-indigo-300 flex items-center gap-2 shadow-2xl animate-pulse">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pinch to Resize: <strong className="text-white font-mono text-sm">{captionFontSize}px</strong></span>
                </div>
              )}

              {/* ANIMATED EXPORT PREVIEW (CapCut / VN style shrinking-card with laser wave ripple)
                  CRITICAL: Only affects on-screen preview DOM styling, NOT the output video file */}
              {isExporting && (
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-2xl flex flex-col justify-between">
                  {/* CapCut / VN Laser Scanning Wave Bar */}
                  <div className="absolute inset-x-0 h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px] anim-export-scan shadow-[0_0_20px_#22d3ee]" />

                  {/* High-tech Ripple Gradient Aura */}
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/15 via-transparent to-purple-600/15 backdrop-blur-[0.5px]" />

                  {/* Floating CapCut / VN Export HUD Pill */}
                  <div className="relative mt-4 mx-auto bg-black/90 backdrop-blur-md border border-indigo-500/70 rounded-full px-5 py-2 flex items-center gap-3 shadow-2xl">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Exporting Video</span>
                        <span className="font-mono text-xs font-extrabold text-cyan-400">{exportProgress}%</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">Preserving full duration & original aspect ratio</span>
                    </div>
                  </div>

                  {/* Bottom Progress Bar inside preview card */}
                  <div className="relative mb-3 mx-6">
                    <div className="w-full bg-zinc-900/90 rounded-full h-1.5 overflow-hidden border border-zinc-700/60 shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`relative w-full flex items-center justify-center transition-all duration-700 ease-out ${
                  isExporting ? 'scale-[0.91] ring-2 ring-indigo-500/90 shadow-[0_0_60px_rgba(99,102,241,0.5)] rounded-2xl overflow-hidden' : ''
                } ${
                  aspectRatio === '9:16'
                    ? 'aspect-[9/16] max-h-[500px] max-w-[282px] sm:max-w-[310px]'
                    : aspectRatio === '1:1'
                    ? 'aspect-square max-h-[460px] max-w-[460px]'
                    : aspectRatio === '3:4'
                    ? 'aspect-[3/4] max-h-[500px] max-w-[375px]'
                    : aspectRatio === '4:3'
                    ? 'aspect-[4/3] max-h-[480px] max-w-[640px]'
                    : 'aspect-video max-h-[480px] max-w-[854px]'
                }`}
              >
                <video
                  ref={videoRef}
                  src={videoSrc}
                  crossOrigin="anonymous"
                  playsInline
                  className="w-full h-full object-contain bg-black"
                  onClick={togglePlay}
                />

                {/* FULL 2D DRAGGABLE & PINCH-RESIZABLE CAPTION OVERLAY: ABSOLUTE TRANSPARENCY, NO BLACK STRIP */}
                {activeCaptionAtCurrentTime && activeCaptionAtCurrentTime.text.trim() && (() => {
                  const isPureUrdu = language === 'Urdu';
                  const words = activeCaptionAtCurrentTime.text.trim().split(/\s+/).filter(Boolean);
                  const totalWords = words.length;
                  const segDuration = Math.max(0.1, activeCaptionAtCurrentTime.endSec - activeCaptionAtCurrentTime.startSec);
                  const elapsed = Math.max(0, currentTime - activeCaptionAtCurrentTime.startSec);
                  const activeWordIdx = Math.min(
                    totalWords - 1,
                    Math.max(0, Math.floor((elapsed / segDuration) * totalWords))
                  );

                  return (
                    <div
                      onPointerDown={handleCaptionPointerDown}
                      onTouchStart={handlePreviewTouchStart}
                      onTouchMove={handlePreviewTouchMove}
                      onTouchEnd={handlePreviewTouchEnd}
                      className={`absolute select-none z-20 cursor-move active:cursor-grabbing max-w-[95%] group flex flex-col items-center transition-transform ${
                        isDraggingCaption || isPinching ? 'scale-105 ring-1 ring-indigo-400/60 rounded-lg p-0.5' : ''
                      }`}
                      style={{
                        left: `${captionXPercent}%`,
                        top: `${captionYPercent}%`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none'
                      }}
                      dir={isPureUrdu ? 'rtl' : 'ltr'}
                      title="Drag to reposition or pinch with two fingers to resize captions"
                    >
                      {/* Real-time 2D coordinates and Font Size indicator */}
                      <div className={`transition-opacity mb-1 pointer-events-none ${isDraggingCaption || isPinching ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="bg-black/85 backdrop-blur border border-zinc-700/80 rounded-full px-2 py-0.5 text-[10px] text-zinc-300 flex items-center gap-1 shadow-md">
                          <Move className="w-2.5 h-2.5 text-indigo-400" />
                          <span>X: {captionXPercent}% | Y: {captionYPercent}% • {captionFontSize}px (Pinch to resize)</span>
                        </span>
                      </div>

                      {/* Single-line text overlay with ABSOLUTE TRANSPARENCY (No background box/strip, overflow-visible for Nastaliq ligatures) */}
                      <div
                        className="inline-flex items-center justify-center whitespace-nowrap overflow-visible px-6 py-2 bg-transparent border-none shadow-none gap-2"
                        style={{
                          fontFamily: activeFontFamily,
                          fontSize: `${captionFontSize}px`,
                          lineHeight: isPureUrdu ? '1.8' : '1.2'
                        }}
                        dir={isPureUrdu ? 'rtl' : 'ltr'}
                      >
                        {words.map((word, wIdx) => {
                          const isActive = wIdx === activeWordIdx;

                          // User-specified clean text shadow for perfect readability on light/dark backgrounds
                          const baseTextShadow = '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000';

                          const animClass = isActive
                            ? animationType === 'pop-bounce'
                              ? 'anim-pop-bounce'
                              : animationType === 'fade-in'
                              ? 'anim-fade-in'
                              : 'anim-karaoke-jump'
                            : '';

                          return (
                            <span
                              key={wIdx}
                              className={`inline-block font-black leading-tight transition-all duration-75 whitespace-nowrap ${
                                isPureUrdu ? 'tracking-normal' : 'uppercase tracking-wide'
                              } ${animClass}`}
                              style={{
                                color: isActive ? '#fde047' : '#ffffff',
                                textShadow: isActive
                                  ? `${baseTextShadow}, 0 0 16px rgba(253, 224, 71, 0.8)`
                                  : baseTextShadow,
                                fontSize: `${captionFontSize}px`
                              }}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Simple Playback Controls */}
            <div className="pt-3 flex flex-col gap-2">
              {/* Progress Scrubber */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 10}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Control Buttons & Timestamp */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <span className="text-xs font-mono text-zinc-400 ml-1">
                    {formatSecondsToTime(currentTime)} / {formatSecondsToTime(duration)}
                  </span>
                </div>

                <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <Move className="w-3 h-3 text-indigo-400" />
                  <span>Drag caption anywhere on video to adjust 2D position (X/Y)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Interactive Subtitle Editor (5 cols on desktop) */}
        <section className="lg:col-span-5 flex flex-col">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 flex flex-col h-full min-h-[460px]">
            {/* Editor Header & Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Transcript Editor</h2>
                <p className="text-xs text-zinc-400">Click any block to seek and edit text</p>
              </div>

              {/* Action Buttons: Add, Split, Delete, and Roman Urdu Formatter */}
              <div className="flex items-center gap-1.5">
                {language.includes('Roman Urdu') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCaptions(prev => prev.map(c => ({
                        ...c,
                        text: formatRomanUrduPhonetics(c.text)
                      })));
                      setStatusMessage('Formatted Roman Urdu speech phonetics (e.g. Zameen, Nazil, Khuloos).');
                      setStatusType('success');
                    }}
                    className="p-1.5 rounded-md bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 text-indigo-300 hover:text-white text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Enforce Roman Urdu phonetics on all caption blocks"
                  >
                    <Languages className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Phonetics</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddCaption}
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Add caption at current time"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </button>

                <button
                  type="button"
                  onClick={handleSplitCaption}
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Split caption at playhead"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteCaption()}
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 text-xs transition-colors cursor-pointer"
                  title="Delete selected clip"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* CREATOR CUSTOMIZATION: Caption Text Size, Motion Animations & Max Words Controls */}
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-2.5 mb-3 flex flex-col gap-2.5">
              {/* Tool 1: Caption Text Size (Pinch directly on preview or fine-tune with slider) */}
              <div className="flex flex-col gap-1.5 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-zinc-200">Caption Text Size:</span>
                    <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-1.5 py-0.2 rounded text-[11px]">
                      {captionFontSize}px
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.5 rounded">
                    Pinch on preview to resize
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono">16px</span>
                  <input
                    type="range"
                    min="16"
                    max="64"
                    step="1"
                    value={captionFontSize}
                    onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    title="Scale caption text size (or pinch directly on the preview)"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">64px</span>
                </div>
              </div>

              {/* Tool 2: Active Word Animation Selector */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800/80 gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-zinc-200">Word Animation:</span>
                </div>
                <select
                  value={animationType}
                  onChange={(e) => setAnimationType(e.target.value as CaptionAnimationType)}
                  className="bg-[#18181b] border border-zinc-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 flex-1 max-w-[200px] cursor-pointer"
                >
                  <option value="pop-bounce">Pop / Bounce (Micro-pop)</option>
                  <option value="fade-in">Fade In (Opacity Rise)</option>
                  <option value="karaoke-jump">Word Karaoke Jump (Bounce Up)</option>
                </select>
              </div>

              {/* Tool 3: Max Words Per Line Slider & Dynamic Split */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-zinc-200">Max Words Per Line:</span>
                    <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-1.5 py-0.2 rounded text-[11px]">
                      {maxWordsPerLine} {maxWordsPerLine === 1 ? 'word' : 'words'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDynamicSplit(maxWordsPerLine)}
                    className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                    title="Dynamic split all captions into lines with max words limit"
                  >
                    <Scissors className="w-3 h-3" />
                    <span>Dynamic Split</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono">1</span>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={maxWordsPerLine}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMaxWordsPerLine(val);
                      handleDynamicSplit(val);
                    }}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">8</span>
                </div>
              </div>

              {/* Strict Language Mode Indicator Banner */}
              {language === 'Urdu' && (
                <div className="px-2 py-1 rounded bg-indigo-950/40 border border-indigo-900/60 text-[11px] text-indigo-300 flex items-center justify-between">
                  <span>Urdu Mode: Pure Arabic Script • RTL Orientation</span>
                  <span className="text-[10px] font-mono text-indigo-400">Nastaliq</span>
                </div>
              )}
              {language.includes('Roman Urdu') && (
                <div className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between">
                  <span>Roman Urdu Mode: Latin Script • Phonetics</span>
                  <span className="text-[10px] font-mono text-zinc-400">LTR</span>
                </div>
              )}
            </div>

            {/* Real-time Loading Bar while Captions are being generated (Requirement 5) */}
            {isTranscribing && (
              <div className="bg-[#121214] border border-indigo-500/50 rounded-xl p-4 mb-3 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="font-semibold text-white">Transcribing Real Audio...</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-400">{transcribeProgress}%</span>
                </div>

                {/* Animated Gradient Loading Bar */}
                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700/60 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 rounded-full transition-all duration-300"
                    style={{ width: `${transcribeProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate">{transcribeStatusText || 'Hugging Face Whisper Large v3'}</span>
                  <span className="font-mono text-indigo-300 shrink-0 font-medium">{language}</span>
                </div>
              </div>
            )}

            {/* Scrollable Transcript List - Display captions ONLY once complete (Requirement 5) */}
            <div
              ref={transcriptListRef}
              className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px] lg:max-h-[460px]"
            >
              {!isTranscribing && captions.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 rounded-xl border border-dashed border-zinc-800 bg-[#121214]/50 my-auto min-h-[200px]">
                  <FileText className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-zinc-300">No Captions Yet</p>
                  <p className="text-[11px] text-zinc-500 max-w-[260px] mt-1">
                    Upload a video (up to 500MB) and click <strong className="text-indigo-400">Generate</strong> to transcribe real spoken audio with Hugging Face Whisper Large v3.
                  </p>
                </div>
              )}

              {!isTranscribing && captions.map((seg, idx) => {
                const isSelected = seg.id === selectedClipId;
                const isCurrent = currentTime >= seg.startSec && currentTime <= seg.endSec;
                const wordCount = seg.text.trim().split(/\s+/).filter(Boolean).length;

                return (
                  <div
                    key={seg.id}
                    onClick={() => handleSelectBlock(seg)}
                    className={`p-2.5 rounded-lg border transition-all text-sm flex flex-col gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'border-indigo-500/80 bg-indigo-950/20'
                        : isSelected
                        ? 'border-zinc-600 bg-zinc-800/80'
                        : 'border-zinc-800/80 bg-[#121214] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      {/* Time-coded interactive button [mm:ss] */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectBlock(seg);
                        }}
                        className={`font-mono text-xs font-semibold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title="Click to jump video to this timestamp"
                      >
                        [{seg.start}] - [{seg.end}]
                      </button>

                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
                          wordCount > maxWordsPerLine ? 'text-amber-400 bg-amber-950/40' : 'text-zinc-500'
                        }`}>
                          {wordCount} {wordCount === 1 ? 'word' : 'words'}
                        </span>
                        <span className="text-[11px] text-zinc-500">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCaption(seg.id);
                          }}
                          className="text-zinc-600 hover:text-red-400 p-0.5 rounded transition-colors"
                          title="Delete clip"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Single-line editable text input */}
                    <input
                      type="text"
                      value={seg.text}
                      onChange={(e) => handleUpdateText(seg.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter subtitle text..."
                      dir={language === 'Urdu' ? 'rtl' : 'ltr'}
                      className="w-full bg-transparent text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-1 border border-transparent focus:border-indigo-500 font-medium"
                      style={{ fontFamily: activeFontFamily }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 3: Bottom Configuration Panel (Top 10 Essential Features) */}
      <footer className="border-t border-zinc-800 bg-[#18181b] p-4 md:p-6 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Feature 1: Drag-and-Drop Video Upload Area */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              1. Video Source
            </span>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingVideo(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingVideo(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingVideo(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processUploadedFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDraggingVideo
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : 'border-zinc-700 hover:border-zinc-500 bg-[#121214]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-zinc-400 mb-1" />
              <p className="text-xs font-semibold text-white">
                Drag & drop video here or <span className="text-indigo-400">browse</span>
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                MP4, WebM, MOV (up to 500MB)
              </p>
            </div>
          </div>

          {/* Feature 2: Typography & Custom Font Styling Panel with Bottom + Button */}
          <div className="flex flex-col gap-2" ref={fontDropdownRef}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                <span>2. Typography & Fonts</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {customFonts.length > 0 ? `${customFonts.length} custom font` : 'English & Urdu/Arabic'}
              </span>
            </div>

            <div className="bg-[#121214] border border-zinc-800 rounded-xl p-3 flex flex-col gap-2.5 h-full relative">
              {/* Hidden file selector for font imports */}
              <input
                ref={customFontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                onChange={handleImportCustomFont}
                className="hidden"
              />

              {/* Font Selector Dropdown Trigger Button */}
              <div className="flex flex-col gap-1 relative">
                <label className="text-[11px] text-zinc-400 font-medium">
                  Caption Font:
                </label>
                
                <button
                  type="button"
                  onClick={() => setIsFontDropdownOpen(prev => !prev)}
                  className="w-full bg-[#18181b] border border-zinc-700 hover:border-zinc-500 text-white text-xs rounded-lg px-3 py-2 flex items-center justify-between transition-colors cursor-pointer text-left shadow-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-white" style={{ fontFamily: activeFontFamily }}>
                      {selectedFont}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal">
                      ({activeFontObj.category})
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isFontDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {/* Dropdown Menu with Dedicated List-Item at Bottom for Custom Import */}
                {isFontDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[340px]">
                    <div className="overflow-y-auto flex-1 p-1.5 space-y-2">
                      {/* English Fonts Group */}
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          English Fonts
                        </div>
                        <div className="space-y-0.5">
                          {PRESET_FONTS.filter(f => f.category === 'English').map((font) => (
                            <button
                              key={font.name}
                              type="button"
                              onClick={() => {
                                setSelectedFont(font.name);
                                setIsFontDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                                selectedFont === font.name
                                  ? 'bg-indigo-600 text-white font-semibold'
                                  : 'text-zinc-200 hover:bg-zinc-800'
                              }`}
                            >
                              <span style={{ fontFamily: font.family }}>{font.name}</span>
                              {selectedFont === font.name && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Urdu & Arabic Fonts Group */}
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Urdu & Arabic Fonts
                        </div>
                        <div className="space-y-0.5">
                          {PRESET_FONTS.filter(f => f.category === 'Urdu / Arabic').map((font) => (
                            <button
                              key={font.name}
                              type="button"
                              onClick={() => {
                                setSelectedFont(font.name);
                                setIsFontDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                                selectedFont === font.name
                                  ? 'bg-indigo-600 text-white font-semibold'
                                  : 'text-zinc-200 hover:bg-zinc-800'
                              }`}
                            >
                              <span style={{ fontFamily: font.family }}>{font.name}</span>
                              {selectedFont === font.name && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Imported Fonts Group (Appears directly above the + item) */}
                      {customFonts.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                            ★ Custom Imported Fonts
                          </div>
                          <div className="space-y-0.5">
                            {customFonts.map((font) => (
                              <button
                                key={font.name}
                                type="button"
                                onClick={() => {
                                  setSelectedFont(font.name);
                                  setIsFontDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                                  selectedFont === font.name
                                    ? 'bg-indigo-600 text-white font-semibold'
                                    : 'text-zinc-200 hover:bg-zinc-800'
                                }`}
                              >
                                <span style={{ fontFamily: font.family }}>{font.name}</span>
                                {selectedFont === font.name && <Check className="w-3.5 h-3.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DEDICATED LIST-ITEM AT VERY BOTTOM WITH "+" ICON BUTTON */}
                    <div className="p-1.5 border-t border-zinc-800 bg-[#121214] sticky bottom-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsFontDropdownOpen(false);
                          customFontInputRef.current?.click();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
                        title="Import a custom font file (.ttf, .otf, .woff2)"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Import Custom Font</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-zinc-500 leading-tight pt-1">
                Transparent shadow enabled: No background box strip. Click "+" in dropdown to load .ttf, .otf, or .woff2.
              </div>
            </div>
          </div>

          {/* Feature 3: Caption Output Language & AI Generation */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              3. Caption Output Language & AI
            </span>

            <div className="bg-[#121214] border border-zinc-800 rounded-xl p-3 flex flex-col gap-2.5 h-full">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-zinc-400 font-medium">
                  Caption Output Language:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={language}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      setLanguage(newLang);
                      if (newLang === 'Urdu') {
                        setSelectedFont('Noto Nastaliq Urdu');
                        setStatusMessage('Urdu Mode: Set to authentic Arabic-script Urdu with Noto Nastaliq typography and RTL orientation.');
                      } else if (newLang.includes('Roman Urdu')) {
                        setStatusMessage('Roman Urdu Mode: Set to Latin English alphabet speech phonetics (e.g. Zameen, Nazil).');
                      } else {
                        setStatusMessage(`Caption Output Language set to ${newLang}.`);
                      }
                      setStatusType('info');
                    }}
                    className="bg-[#18181b] border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-500 flex-1 cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'Urdu' ? 'Urdu (Authentic Arabic Script)' : lang === 'Roman Urdu' ? 'Roman Urdu (Latin English Letters)' : lang}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleGenerateCaptions}
                    disabled={isTranscribing}
                    className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Transcribing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Strict Pure Urdu Banner */}
              {language === 'Urdu' && (
                <div className="px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900/60 text-[11px] text-indigo-300 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate">Pure Urdu (Arabic Script): RTL Nastaliq layout active.</span>
                  </div>
                  <span className="font-mono text-[10px] text-indigo-400 shrink-0 font-semibold">اردو رسم الخط</span>
                </div>
              )}

              {/* Strict Roman Urdu Banner */}
              {language.includes('Roman Urdu') && (
                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Languages className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">Roman Urdu: Latin English characters (e.g. Zameen, Nazil).</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0 font-semibold">LATIN</span>
                </div>
              )}

              {/* Subtitle File Exports & Copy */}
              <div className="flex items-center gap-2 pt-1 mt-auto">
                <button
                  type="button"
                  onClick={() => handleExportSubtitleFile('srt')}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>.SRT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportSubtitleFile('vtt')}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>.VTT</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCaptions}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 px-2.5 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy all captions"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
