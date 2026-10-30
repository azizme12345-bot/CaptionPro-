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
  Zap,
  HelpCircle,
  Film,
  X,
  Clock
} from 'lucide-react';

export type AspectRatio = '9:16' | '1:1' | '3:4' | '4:3' | '16:9';
export type CaptionAnimationType = 'pop-bounce' | 'karaoke-jump' | 'neon-pulse' | 'marker-box' | 'flash-gold' | 'fade-in';
export type PageType = 'home' | 'editor' | 'about';
export type StudioTab = 'captions' | 'text' | 'style';

export interface CaptionSegment {
  id: string;
  start: string; // "00:00"
  end: string;   // "00:03"
  startSec: number;
  endSec: number;
  text: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSize: number; // 12 to 80
  fontFamily: string;
  color: string;
  backgroundColor: string; // 'transparent', '#000000cc', '#10b981', '#ef4444', '#facc15'
  showBackground: boolean;
  shadow: boolean;
  allVideo: boolean;
  startSec: number;
  endSec: number;
}

export interface FontOption {
  name: string;
  category: 'English' | 'Urdu / Arabic' | 'Custom';
  family: string;
}

const PRESET_FONTS: FontOption[] = [
  // English Fonts (15 Creator Styles)
  { name: 'Plus Jakarta Sans', category: 'English', family: "'Plus Jakarta Sans', sans-serif" },
  { name: 'Inter', category: 'English', family: "'Inter', sans-serif" },
  { name: 'Montserrat', category: 'English', family: "'Montserrat', sans-serif" },
  { name: 'Anton', category: 'English', family: "'Anton', Impact, sans-serif" },
  { name: 'Bebas Neue', category: 'English', family: "'Bebas Neue', sans-serif" },
  { name: 'Poppins', category: 'English', family: "'Poppins', sans-serif" },
  { name: 'League Spartan', category: 'English', family: "'League Spartan', sans-serif" },
  { name: 'Archivo Black', category: 'English', family: "'Archivo Black', sans-serif" },
  { name: 'Oswald', category: 'English', family: "'Oswald', sans-serif" },
  { name: 'Outfit', category: 'English', family: "'Outfit', sans-serif" },
  { name: 'Righteous', category: 'English', family: "'Righteous', cursive" },
  { name: 'Syne', category: 'English', family: "'Syne', sans-serif" },
  { name: 'Caveat', category: 'English', family: "'Caveat', cursive" },
  { name: 'Playfair Display', category: 'English', family: "'Playfair Display', serif" },
  { name: 'Impact', category: 'English', family: "Impact, Haettenschweiler, 'Arial Black', sans-serif" },
  // Urdu / Arabic Fonts (6 Standard & Calligraphic)
  { name: 'Noto Nastaliq Urdu', category: 'Urdu / Arabic', family: "'Noto Nastaliq Urdu', serif" },
  { name: 'Jameel Noori Nastaleeq', category: 'Urdu / Arabic', family: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" },
  { name: 'Amiri', category: 'Urdu / Arabic', family: "'Amiri', serif" },
  { name: 'Tajawal', category: 'Urdu / Arabic', family: "'Tajawal', sans-serif" },
  { name: 'Cairo', category: 'Urdu / Arabic', family: "'Cairo', sans-serif" },
  { name: 'Almarai', category: 'Urdu / Arabic', family: "'Almarai', sans-serif" }
];

const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

// Configurable Export Server URL - defaults to internal /api/export-video or an external server (e.g. Render.com / VPS) via VITE_EXPORT_SERVER_URL
export const EXPORT_SERVER_URL = (import.meta as any).env?.VITE_EXPORT_SERVER_URL || '/api/export-video';

const SUPPORTED_LANGUAGES = [
  'English',
  'Urdu',
  'Roman Urdu',
  'Arabic',
  'Hindi',
  'Spanish',
  'French',
  'German',
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

// Helper to format seconds to mm:ss or mm:ss.s with decimal precision
function formatSecondsToTime(totalSec: number): string {
  if (isNaN(totalSec) || totalSec < 0) return '00:00';
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const wholeS = Math.floor(secs);
  const tenths = Math.floor((secs % 1) * 10);
  if (tenths > 0) {
    return `${String(mins).padStart(2, '0')}:${String(wholeS).padStart(2, '0')}.${tenths}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(wholeS).padStart(2, '0')}`;
}

// Dynamic chunking algorithm: splits subtitle segments into word groups with accurate sub-second interpolation
function splitIntoWordChunks(segments: CaptionSegment[], maxWords: number): CaptionSegment[] {
  const result: CaptionSegment[] = [];

  for (const seg of segments) {
    const rawWords = seg.text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length <= maxWords) {
      result.push(seg);
      continue;
    }

    const totalWords = rawWords.length;
    const totalDuration = Math.max(0.4, seg.endSec - seg.startSec);
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

      const roundedStart = parseFloat(currentStart.toFixed(2));
      const roundedEnd = parseFloat(chunkEnd.toFixed(2));

      result.push({
        id: `chunk-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        start: formatSecondsToTime(roundedStart),
        end: formatSecondsToTime(roundedEnd),
        startSec: roundedStart,
        endSec: Math.max(roundedStart + 0.3, roundedEnd),
        text: chunkWords.join(' ')
      });
      currentStart = chunkEnd;
    }
  }

  return result.sort((a, b) => a.startSec - b.startSec);
}

// Extract audio from video file into crisp 16kHz mono WAV base64 string matching Whisper and Gemini speech models
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

  // 16000 Hz 16-bit mono provides studio speech clarity matching speech recognition acoustic models
  const targetSampleRate = 16000;
  const maxSec = audioBuffer.duration;
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
  // Page Routing State (Task 1: Exactly 3 pages - Home, Editor, About)
  const [currentPage, setCurrentPage] = useState<PageType>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#editor') return 'editor';
      if (hash === '#about') return 'about';
    }
    return 'home';
  });

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${page}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#editor') setCurrentPage('editor');
      else if (hash === '#about') setCurrentPage('about');
      else if (hash === '#home' || !hash) setCurrentPage('home');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Media state
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [hasMedia, setHasMedia] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  // Captions state
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [maxWordsPerLine, setMaxWordsPerLine] = useState<number>(5);

  // Caption Styling state (Matching Caption Free options)
  const [captionFontSize, setCaptionFontSize] = useState<number>(32);
  const [captionStyle, setCaptionStyle] = useState<string>('Bold Clean');
  const [captionColor, setCaptionColor] = useState<string>('#ffffff');
  const [captionPosition, setCaptionPosition] = useState<string>('Bottom');
  const [animationType, setAnimationType] = useState<CaptionAnimationType>('pop-bounce');

  // Studio Navigation Tabs (Task 5: Separate Text tool from Captions, like CapCut)
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('captions');

  // Text Tool Overlays State (Task 5)
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextOverlayId, setSelectedTextOverlayId] = useState<string | null>(null);
  const [isDraggingTextId, setIsDraggingTextId] = useState<string | null>(null);

  // Typography & Custom Fonts
  const [selectedFont, setSelectedFont] = useState<string>('Plus Jakarta Sans');
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);

  // Pinch-to-zoom state
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const pinchRef = useRef<{ initialDistance: number; initialFontSize: number }>({
    initialDistance: 0,
    initialFontSize: 25
  });

  // 2D Draggable Position
  const [captionXPercent, setCaptionXPercent] = useState<number>(50);
  const [captionYPercent, setCaptionYPercent] = useState<number>(80);
  const [isDraggingCaption, setIsDraggingCaption] = useState<boolean>(false);

  // Operation status & loading
  const [statusMessage, setStatusMessage] = useState<string>('Import a media file to start configuring your AI captions.');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [transcribeStatusText, setTranscribeStatusText] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportElapsedSec, setExportElapsedSec] = useState<number>(0);
  const [exportStatusDetail, setExportStatusDetail] = useState<string>('Preparing video stream...');
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);
  const fontDropdownRef = useRef<HTMLDivElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  // Active font computation
  const allFonts = [...PRESET_FONTS, ...customFonts];
  const activeFontObj = allFonts.find(f => f.name === selectedFont) || PRESET_FONTS[0];
  const activeFontFamily = activeFontObj.family;

  // Active caption at current playback time with sub-second audio sync tolerance
  const activeCaptionAtCurrentTime = captions.find(
    c => currentTime >= (c.startSec - 0.04) && currentTime <= (c.endSec + 0.04)
  );

  // Drag and drop state for video import
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Trigger file selection reliably across all platforms
  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

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
      setStatusMessage('Playback prevented by browser policy. Click video to play.');
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

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  // Media upload handler (Fixes all import bugs: supports all video/audio formats, probes exact duration and dimensions, cleans old blobs)
  const processUploadedFile = (file: File) => {
    if (!file) return;

    const validVideoExts = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv|mp3|wav|m4a|aac|flac)$/i;
    const isVideoOrAudio = file.type.startsWith('video/') || file.type.startsWith('audio/') || validVideoExts.test(file.name);
    
    if (!isVideoOrAudio) {
      setStatusMessage('Import Failed: Please choose a valid video file (MP4, WebM, MOV, MKV) up to 2GB.');
      setStatusType('error');
      return;
    }

    if (file.size > 2000 * 1024 * 1024) {
      setStatusMessage('File Too Large: Please upload a media file under 2GB.');
      setStatusType('error');
      return;
    }

    // Revoke previous blob if exists to avoid memory leaks
    if (videoSrc && videoSrc.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoSrc); } catch (e) {}
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoSrc(url);
    setHasMedia(true);
    navigateTo('editor');

    // Preload video to extract duration accurately (preserve default 9:16 ratio)
    const probeVid = document.createElement('video');
    probeVid.preload = 'metadata';
    probeVid.onloadedmetadata = () => {
      if (probeVid.duration && isFinite(probeVid.duration) && probeVid.duration > 0) {
        setDuration(probeVid.duration);
      }
    };
    probeVid.src = url;

    setStatusMessage(`Loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Click "Generate Captions" to transcribe with AI.`);
    setStatusType('success');
  };

  const handleLoadSampleVideo = async () => {
    try {
      setStatusMessage('Loading demo video for testing...');
      setStatusType('info');
      const resp = await fetch(SAMPLE_VIDEO_URL);
      if (!resp.ok) throw new Error('Sample fetch failed');
      const blob = await resp.blob();
      const file = new File([blob], 'demo-sample.mp4', { type: 'video/mp4' });
      processUploadedFile(file);
    } catch {
      setVideoSrc(SAMPLE_VIDEO_URL);
      setVideoFileName('demo-sample.mp4');
      setHasMedia(true);
      navigateTo('editor');
      setStatusMessage('Loaded demo sample video. Ready to generate captions.');
      setStatusType('success');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    // Crucial: reset input value so selecting the same file triggers onChange again!
    if (e.target) {
      e.target.value = '';
    }
  };

  // Reset Studio View (Remove Media)
  const resetStudio = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (videoSrc && videoSrc.startsWith('blob:')) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoFile(null);
    setVideoSrc('');
    setVideoFileName('');
    setCaptions([]);
    setHasMedia(false);
    setIsPlaying(false);
    setStatusMessage('Media removed. Select "Import Media" to upload a video.');
    setStatusType('info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Position change handler (Bottom, Center, Top)
  const handlePositionChange = (pos: string) => {
    setCaptionPosition(pos);
    if (pos === 'Top') {
      setCaptionYPercent(10);
      setCaptionXPercent(50);
    } else if (pos === 'Center') {
      setCaptionYPercent(45);
      setCaptionXPercent(50);
    } else {
      setCaptionYPercent(80);
      setCaptionXPercent(50);
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

  // ==========================================
  // Task 5: Text Tool Handlers (CapCut Style)
  // ==========================================
  const handleAddTextOverlay = (customPreset?: { text: string; bg?: string; color?: string; yPercent?: number }) => {
    const newId = 'text_' + Date.now();
    const newOverlay: TextOverlay = {
      id: newId,
      text: customPreset?.text || 'Type your text here...',
      xPercent: 50,
      yPercent: customPreset?.yPercent ?? 30,
      fontSize: 28,
      fontFamily: activeFontFamily,
      color: customPreset?.color || '#ffffff',
      backgroundColor: customPreset?.bg || 'transparent',
      showBackground: !!customPreset?.bg && customPreset.bg !== 'transparent',
      shadow: true,
      allVideo: true,
      startSec: 0,
      endSec: Math.max(5, duration || 15)
    };
    setTextOverlays(prev => [...prev, newOverlay]);
    setSelectedTextOverlayId(newId);
    setActiveStudioTab('text');
    setStatusMessage('Added new text layer! Drag on video to position.');
    setStatusType('success');
  };

  const handleUpdateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    if (selectedTextOverlayId === id) setSelectedTextOverlayId(null);
    setStatusMessage('Text layer removed.');
    setStatusType('info');
  };

  const handleDuplicateTextOverlay = (id: string) => {
    const orig = textOverlays.find(t => t.id === id);
    if (!orig) return;
    const dupId = 'text_' + Date.now();
    const dup: TextOverlay = {
      ...orig,
      id: dupId,
      yPercent: Math.min(90, orig.yPercent + 7),
      text: orig.text + ' (Copy)'
    };
    setTextOverlays(prev => [...prev, dup]);
    setSelectedTextOverlayId(dupId);
    setStatusMessage('Text layer duplicated.');
    setStatusType('info');
  };

  const handleTextPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedTextOverlayId(id);
    setIsDraggingTextId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // 2D Dragging Logic for Caption & Text Positioning (Task 6 & Task 5)
  const handleCaptionPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCaption(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!videoContainerRef.current) return;
    if (!isDraggingCaption && !isDraggingTextId) return;

    const rect = videoContainerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    const rawXPercent = (relativeX / rect.width) * 100;
    const rawYPercent = (relativeY / rect.height) * 100;
    const clampedX = Math.max(5, Math.min(95, Math.round(rawXPercent)));
    const clampedY = Math.max(5, Math.min(95, Math.round(rawYPercent)));

    if (isDraggingCaption) {
      setCaptionXPercent(clampedX);
      setCaptionYPercent(clampedY);
    } else if (isDraggingTextId) {
      setTextOverlays(prev => prev.map(t => t.id === isDraggingTextId ? { ...t, xPercent: clampedX, yPercent: clampedY } : t));
    }
  }, [isDraggingCaption, isDraggingTextId]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingCaption) {
      setIsDraggingCaption(false);
      setStatusMessage(`Caption position set to X: ${captionXPercent}%, Y: ${captionYPercent}%.`);
      setStatusType('info');
    }
    if (isDraggingTextId) {
      setIsDraggingTextId(null);
      setStatusMessage('Text layer position updated.');
      setStatusType('info');
    }
  }, [isDraggingCaption, isDraggingTextId, captionXPercent, captionYPercent]);

  useEffect(() => {
    if (isDraggingCaption || isDraggingTextId) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingCaption, isDraggingTextId, handlePointerMove, handlePointerUp]);

  // Pinch-to-zoom on captions
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
        const newFontSize = Math.max(10, Math.min(80, Math.round(pinchRef.current.initialFontSize * scale)));
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
    setStatusMessage(`Dynamic-split captions to maximum ${wordsLimit} words per line.`);
    setStatusType('success');
  };

  // Add new caption clip
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
      text: 'New punchy caption text'
    };
    const updated = [...captions, newClip].sort((a, b) => a.startSec - b.startSec);
    setCaptions(updated);
    setSelectedClipId(newId);
    setStatusMessage(`Added caption clip at ${newClip.start}.`);
    setStatusType('info');
  };

  // Split selected caption
  const handleSplitCaption = () => {
    const selected = captions.find(c => c.id === selectedClipId);
    if (!selected) {
      setStatusMessage('Select a caption block in the timeline to split.');
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
    setStatusMessage(`Split caption at ${firstEnd}.`);
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
      content = `WEBVTT - Exported by Caption Free\n\n` + captions.map((c, i) => `${i + 1}\n00:${c.start}.000 --> 00:${c.end}.000\n${c.text}\n`).join('\n');
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

  // AI Speech-to-text Transcription using Gemini 2.5 Flash / Hugging Face Whisper
  const handleGenerateCaptions = async () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }

    if (!videoFile && !videoSrc) {
      setStatusMessage("Please import a media file first to transcribe real audio.");
      setStatusType("error");
      return;
    }

    setCaptions([]);
    setSelectedClipId('');
    setIsTranscribing(true);
    setTranscribeProgress(15);
    setTranscribeStatusText(`Connecting to AI Speech Recognition Engine (${language})...`);
    setStatusMessage(`Transcribing real audio with AI in ${language}...`);
    setStatusType('info');

    const progressTimer = setInterval(() => {
      setTranscribeProgress(prev => {
        if (prev < 30) {
          setTranscribeStatusText('Extracting audio track (16kHz mono)...');
          return prev + 5;
        } else if (prev < 65) {
          setTranscribeStatusText(`Transcribing speech with Gemini / Whisper (${language})...`);
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
        try {
          setTranscribeStatusText("Extracting audio from media file...");
          const audioBase64 = await extractAudioBase64(videoFile);
          setTranscribeStatusText(`Sending audio to AI Engine (${language})...`);
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
        setStatusMessage(data.message || `AI transcription failed: ${data.error || 'Server error'}`);
        setStatusType("error");
        setTranscribeStatusText(`Failed: ${data.message || data.error}`);
        return;
      }

      setTranscribeProgress(95);
      setTranscribeStatusText("Finalizing captions...");

      const captionsData = data.captions;
      if (!captionsData || !Array.isArray(captionsData) || captionsData.length === 0) {
        setStatusMessage("No spoken dialogue was detected in this media's audio track.");
        setStatusType("info");
        setTranscribeStatusText("No speech detected.");
        return;
      }

      const parsed: CaptionSegment[] = captionsData.map((item: any, idx: number) => {
        let startSec = typeof item.startSec === 'number'
          ? item.startSec
          : parseTimeToSeconds(item.start ?? 0);
        let endSec = typeof item.endSec === 'number'
          ? item.endSec
          : parseTimeToSeconds(item.end ?? (startSec + 1.8));

        startSec = parseFloat(Math.max(0, startSec).toFixed(2));
        endSec = parseFloat(Math.max(startSec + 0.3, endSec).toFixed(2));

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
          endSec,
          text: (item.text || '').trim()
        };
      });

      const enforcedChunks = splitIntoWordChunks(parsed, maxWordsPerLine);
      enforcedChunks.sort((a, b) => a.startSec - b.startSec);

      setTranscribeProgress(100);
      setTranscribeStatusText("Complete!");
      setCaptions(enforcedChunks);
      if (enforcedChunks.length > 0) {
        setSelectedClipId(enforcedChunks[0].id);
      }
      setStatusMessage(`Successfully transcribed ${enforcedChunks.length} segments with AI (${language})!`);
      setStatusType('success');
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("Transcription error:", err);
      setStatusMessage(`Caption Generation Incomplete: ${err.message || 'Please check your audio track.'}`);
      setStatusType("error");
      setTranscribeStatusText("Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Cancel active video export cleanly
  const handleCancelExport = () => {
    if (exportAbortControllerRef.current) {
      exportAbortControllerRef.current.abort();
      exportAbortControllerRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }
    setIsExporting(false);
    setExportProgress(0);
    setStatusMessage('Video export canceled.');
    setStatusType('info');
  };

  // Video Export (Full duration & preserved audio - strictly pauses background video)
  const handleExportBurnedVideo = async () => {
    const video = videoRef.current;
    if (!video) {
      setStatusMessage('Video element not ready.');
      setStatusType('error');
      return;
    }
    // CRITICAL (Task 4): Guarantee video does NOT keep playing during export
    video.pause();
    video.muted = true;
    setIsPlaying(false);

    setIsExporting(true);
    setExportProgress(5);
    setExportElapsedSec(0);
    setExportStatusDetail('Preparing media and subtitle synchronization...');

    exportAbortControllerRef.current = new AbortController();
    const abortSignal = exportAbortControllerRef.current.signal;

    // Timer to track seconds elapsed for Wink-style time indicator
    const exportTimer = setInterval(() => {
      setExportElapsedSec(s => s + 1);
    }, 1000);

    // Smooth progress simulation while server renders
    const progressSimulator = setInterval(() => {
      setExportProgress(prev => {
        if (prev < 30) {
          setExportStatusDetail('Uploading video to render engine...');
          return prev + 4;
        } else if (prev < 75) {
          setExportStatusDetail('Encoding full-duration MP4 with faststart & preserved audio...');
          return prev + 2;
        } else if (prev < 90) {
          setExportStatusDetail('Burning synchronized subtitles and finalizing container...');
          return prev + 1;
        }
        return prev;
      });
    }, 350);

    // Attempt 1: Server-Side FFmpeg Render
    try {
      let fileToUpload: File | Blob | null = videoFile;
      if (!fileToUpload && videoSrc) {
        try {
          const resp = await fetch(videoSrc, { signal: abortSignal });
          if (resp.ok) {
            fileToUpload = await resp.blob();
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') return;
          console.warn("Could not fetch remote videoSrc for server render:", fetchErr);
        }
      }

      if (fileToUpload) {
        setExportProgress(30);
        setExportStatusDetail('Encoding full-duration MP4 with preserved audio...');
        
        const formData = new FormData();
        formData.append('video', fileToUpload, videoFileName || 'video.mp4');
        formData.append('captions', JSON.stringify(captions));

        const serverResp = await fetch(EXPORT_SERVER_URL, {
          method: 'POST',
          body: formData,
          signal: abortSignal
        });

        if (serverResp.ok) {
          clearInterval(progressSimulator);
          setExportProgress(95);
          setExportStatusDetail('Finalizing download and verifying duration...');
          const exportedBlob = await serverResp.blob();

          if (exportedBlob && exportedBlob.size > 1000) {
            const serverDurationHeader = parseFloat(serverResp.headers.get('X-Video-Duration') || '0');
            const probedDur = await verifyBlobDuration(exportedBlob);
            const verifiedDuration = probedDur > 0 ? probedDur : (serverDurationHeader > 0 ? serverDurationHeader : (duration || 20));

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
            setExportStatusDetail('Video exported successfully!');
            setStatusMessage(`Export complete! Exported ${Math.round(verifiedDuration)}s video with preserved audio.`);
            setStatusType('success');
            setTimeout(() => {
              setIsExporting(false);
              setExportProgress(0);
            }, 800);
            return;
          }
        }
      }
    } catch (serverErr: any) {
      if (serverErr.name === 'AbortError') return;
      console.warn("Server render pipeline fallback to client engine:", serverErr);
    } finally {
      clearInterval(exportTimer);
      clearInterval(progressSimulator);
      const vid = videoRef.current;
      if (vid) {
        vid.pause();
        setIsPlaying(false);
      }
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
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

      if (isMobile && rawHeight > 720) {
        const ratio = rawWidth / rawHeight;
        rawHeight = 720;
        rawWidth = Math.round(rawHeight * ratio);
      }

      let width = rawWidth % 2 !== 0 ? rawWidth - 1 : rawWidth;
      let height = rawHeight % 2 !== 0 ? rawHeight - 1 : rawHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas 2D context not supported');

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
        setStatusMessage('Error: This browser cannot export compatible video. Please use Chrome or Safari.');
        setStatusType('error');
        return;
      }

      const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
      canvasStream = canvas.captureStream(30);

      try {
        if ((video as any).captureStream) {
          const vidCaptured = (video as any).captureStream();
          if (vidCaptured.getAudioTracks().length > 0) audioStream = vidCaptured;
        } else if ((video as any).mozCaptureStream) {
          const vidCaptured = (video as any).mozCaptureStream();
          if (vidCaptured.getAudioTracks().length > 0) audioStream = vidCaptured;
        }

        if (!audioStream) {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
          const sourceNode = audioCtx.createMediaElementSource(video);
          const destNode = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);
          // Pure recording stream - do NOT output to speakers during export
          audioStream = destNode.stream;
        }
      } catch (audioErr) {
        console.warn("Audio capture fallback warning:", audioErr);
      }

      combinedStream = new MediaStream();
      if (canvasStream) canvasStream.getVideoTracks().forEach(track => combinedStream!.addTrack(track));
      if (audioStream) audioStream.getAudioTracks().forEach(track => combinedStream!.addTrack(track));

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
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = (e) => reject(e);
      });

      // Strict Task 4 requirement: video must NOT keep playing audibly or in background
      video.muted = true;
      video.pause();
      setIsPlaying(false);

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

      const exactDuration = await getExactVideoDuration(video);
      const targetDuration = Math.max(exactDuration, video.duration || 0, duration || 0, 5);

      recorder.start(250);
      await video.play().catch(() => {});

      await new Promise<void>((resolve) => {
        let isResolved = false;

        const drawFrame = () => {
          if (isResolved) return;

          const currentTime = video.currentTime;
          const isFinished = (currentTime >= (targetDuration - 0.1)) || (video.ended && currentTime >= (targetDuration - 0.5));

          if (isFinished) {
            isResolved = true;
            ctx.drawImage(video, 0, 0, width, height);
            resolve();
            return;
          }

          if (video.paused && currentTime < (targetDuration - 0.5)) {
            video.play().catch(() => {});
          }

          const pct = Math.min(99, Math.round((currentTime / targetDuration) * 100));
          setExportProgress(pct);

          ctx.drawImage(video, 0, 0, width, height);

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

            const isRtl = /[\u0600-\u06FF]/.test(activeClip.text);
            const spaceWidth = ctx.measureText(' ').width;
            const wordWidths = words.map(w => ctx.measureText(isRtl ? w : w.toUpperCase()).width);
            const totalLineWidth = wordWidths.reduce((a, b) => a + b, 0) + spaceWidth * Math.max(0, words.length - 1);

            const minMargin = width * 0.02;
            let cursorX = Math.max(minMargin, Math.min(width - totalLineWidth - minMargin, xCenter - (totalLineWidth / 2)));

            if (isRtl) cursorX = xCenter + (totalLineWidth / 2);

            for (let wIdx = 0; wIdx < words.length; wIdx++) {
              const rawWord = words[wIdx];
              const word = isRtl ? rawWord : rawWord.toUpperCase();
              const isActive = wIdx === activeWordIdx;
              const wWidth = wordWidths[wIdx];

              if (isRtl) cursorX -= wWidth;

              ctx.save();
              ctx.textAlign = 'left';

              // Task 7: Professional Caption Animations in Canvas Export
              let wordY = yPos;
              let isMarkerBox = false;

              if (isActive) {
                if (animationType === 'karaoke-jump') {
                  wordY = yPos - (baseSize * 0.15);
                } else if (animationType === 'neon-pulse') {
                  ctx.shadowColor = '#10b981';
                  ctx.shadowBlur = baseSize * 0.45;
                } else if (animationType === 'flash-gold') {
                  ctx.shadowColor = '#facc15';
                  ctx.shadowBlur = baseSize * 0.4;
                } else if (animationType === 'marker-box') {
                  isMarkerBox = true;
                  ctx.save();
                  ctx.fillStyle = '#10b981';
                  const pad = baseSize * 0.15;
                  ctx.beginPath();
                  if ((ctx as any).roundRect) {
                    (ctx as any).roundRect(cursorX - pad, wordY - (baseSize * 0.6), wWidth + (pad * 2), baseSize * 1.2, 6);
                  } else {
                    ctx.rect(cursorX - pad, wordY - (baseSize * 0.6), wWidth + (pad * 2), baseSize * 1.2);
                  }
                  ctx.fill();
                  ctx.restore();
                }
              }

              if (!isMarkerBox) {
                ctx.lineWidth = Math.max(4, baseSize * 0.16);
                ctx.lineJoin = 'miter';
                ctx.miterLimit = 2;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(word, cursorX, wordY);
              }

              if (isActive) {
                if (isMarkerBox) {
                  ctx.fillStyle = '#000000';
                } else if (animationType === 'flash-gold') {
                  ctx.fillStyle = '#facc15';
                } else if (animationType === 'neon-pulse') {
                  ctx.fillStyle = '#34d399';
                } else {
                  ctx.fillStyle = '#10b981';
                }
              } else {
                ctx.fillStyle = captionColor || '#ffffff';
              }

              ctx.fillText(word, cursorX, wordY);
              ctx.restore();

              if (!isRtl) cursorX += wWidth + spaceWidth;
              else cursorX -= spaceWidth;
            }

            ctx.restore();
          }

          // Task 5: Render Custom Text Tool Overlays in Export
          for (const textItem of textOverlays) {
            const isVisible = textItem.allVideo || (currentTime >= textItem.startSec && currentTime <= textItem.endSec);
            if (!isVisible || !textItem.text.trim()) continue;

            ctx.save();
            const textFontSize = Math.max(12, Math.round(textItem.fontSize * (height / 720)));
            ctx.font = `bold ${textFontSize}px ${textItem.fontFamily}`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            const tX = width * (textItem.xPercent / 100);
            const tY = height * (textItem.yPercent / 100);

            const textLines = textItem.text.split('\n');
            const lineHeight = textFontSize * 1.25;
            const totalTextHeight = textLines.length * lineHeight;
            const startY = tY - (totalTextHeight / 2) + (lineHeight / 2);

            for (let lIdx = 0; lIdx < textLines.length; lIdx++) {
              const line = textLines[lIdx];
              const curY = startY + (lIdx * lineHeight);
              const textMetrics = ctx.measureText(line);

              // Background box / badge if configured
              if (textItem.showBackground && textItem.backgroundColor !== 'transparent') {
                ctx.save();
                ctx.fillStyle = textItem.backgroundColor;
                const padX = textFontSize * 0.4;
                const padY = textFontSize * 0.2;
                const boxW = textMetrics.width + (padX * 2);
                const boxH = textFontSize * 1.1 + (padY * 2);
                const boxX = tX - (boxW / 2);
                const boxY = curY - (boxH / 2);
                ctx.beginPath();
                if ((ctx as any).roundRect) {
                  (ctx as any).roundRect(boxX, boxY, boxW, boxH, 8);
                } else {
                  ctx.rect(boxX, boxY, boxW, boxH);
                }
                ctx.fill();
                ctx.restore();
              }

              if (textItem.shadow) {
                ctx.save();
                ctx.lineWidth = Math.max(3, textFontSize * 0.15);
                ctx.strokeStyle = '#000000';
                ctx.strokeText(line, tX, curY);
                ctx.restore();
              }

              ctx.fillStyle = textItem.color;
              ctx.fillText(line, tX, curY);
            }
            ctx.restore();
          }

          requestAnimationFrame(drawFrame);
        };

        requestAnimationFrame(drawFrame);
      });

      if (recorder.state === 'recording') {
        try { recorder.requestData(); } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
        recorder.stop();
      }

      // Keep video paused after export
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);

      const outputBlob = await renderPromise;
      let finalBlob = outputBlob;

      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `captionfree-export.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        } catch (e) {}
      }, 5000);

      setStatusMessage(`Exported video (${Math.round(targetDuration)}s full duration) with audio.`);
      setStatusType('success');
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusMessage(`Export failed: ${err.message || 'Error recording video'}`);
      setStatusType('error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      try {
        if (combinedStream) combinedStream.getTracks().forEach(track => track.stop());
        if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
        if (audioStream) audioStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      chunks.length = 0;
    }
  };

  // Video time & metadata event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration || 15);
    const onEnded = () => setIsPlaying(false);

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
    <div className="min-h-screen bg-[#000000] text-[#ffffff] flex flex-col font-sans selection:bg-[#10b981] selection:text-black">
      {/* Sticky Navigation Header (Clean 3-Page Structure: Home, Editor, About) */}
      <header className="flex justify-between items-center px-[5%] py-[15px] bg-black/90 backdrop-blur-md sticky top-0 z-50 border-b border-[#1f1f23]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('home')}
            className="text-[22px] font-[800] text-[#10b981] no-underline tracking-tight bg-transparent border-0 cursor-pointer p-0 text-left hover:opacity-90 transition-opacity"
          >
            CaptionPro
          </button>
          <span className="hidden sm:inline-block text-xs text-[#a1a1aa] font-medium border-l border-[#1f1f23] pl-2.5">
            AI Video Studio
          </span>
        </div>

        <nav className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => navigateTo('home')}
            className={`px-3 py-1.5 rounded-lg text-[14px] font-[600] transition-colors cursor-pointer border-0 ${
              currentPage === 'home'
                ? 'text-[#10b981] bg-[#10b981]/10 font-bold'
                : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateTo('editor')}
            className={`px-3 py-1.5 rounded-lg text-[14px] font-[600] transition-colors cursor-pointer border-0 ${
              currentPage === 'editor'
                ? 'text-[#10b981] bg-[#10b981]/10 font-bold'
                : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => navigateTo('about')}
            className={`px-3 py-1.5 rounded-lg text-[14px] font-[600] transition-colors cursor-pointer border-0 ${
              currentPage === 'about'
                ? 'text-[#10b981] bg-[#10b981]/10 font-bold'
                : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            About
          </button>
          {hasMedia && (
            <button
              onClick={handleExportBurnedVideo}
              disabled={isExporting}
              className="ml-2 bg-[#10b981] hover:bg-[#059669] text-black font-bold py-1.5 px-3.5 rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExporting ? `Exporting (${exportProgress}%)` : 'Export Video'}</span>
            </button>
          )}
        </nav>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] w-full mx-auto px-5 py-8 flex-1">
        
        {/* PAGE 1: Home Page (Landing, Intro, Features) */}
        {currentPage === 'home' && (
          <section className="text-center py-6 pb-12" id="landing-hero">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" />
              <span>CaptionPro • AI Video Caption Studio</span>
            </div>

            <h1 className="text-[34px] sm:text-[48px] font-[900] leading-[1.2] mb-[15px] tracking-[-1px] text-white max-w-[820px] mx-auto">
              Every word deserves the spotlight.
            </h1>
            <p className="text-[#a1a1aa] text-[15px] sm:text-[17px] max-w-[620px] mx-auto mb-[30px]">
              Turn your Reels, TikTok, and YouTube Shorts into engaging, viral content with synchronized AI captions. Customize typography, colors, and burn subtitles into MP4 with preserved audio.
            </p>

            <div className="flex items-center justify-center gap-3.5 flex-wrap">
              <button
                onClick={triggerImport}
                className="bg-[#10b981] hover:bg-[#059669] text-black font-[700] px-7 py-3.5 rounded-lg text-[15px] cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Import Media</span>
              </button>
              <button
                onClick={() => navigateTo('editor')}
                className="bg-[#151519] hover:bg-[#1f1f23] text-white font-[600] border border-[#1f1f23] hover:border-[#10b981] px-6 py-3.5 rounded-lg text-[15px] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Film className="w-4 h-4 text-[#10b981]" />
                <span>Open Editor</span>
              </button>
              <button
                onClick={handleLoadSampleVideo}
                className="bg-transparent hover:bg-[#151519] text-[#a1a1aa] hover:text-white font-[500] px-4 py-3.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#10b981]" />
                <span>Try Demo Video</span>
              </button>
            </div>

            {/* Feature Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-[48px] text-left">
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl hover:border-[#10b981]/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">
                  ✦
                </div>
                <h3 className="text-[16px] font-bold text-white mb-2">AI Caption Generation</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">
                  High-precision speech recognition detects spoken audio and creates accurate timestamped subtitles in seconds.
                </p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl hover:border-[#10b981]/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">
                  文
                </div>
                <h3 className="text-[16px] font-bold text-white mb-2">Multiple Languages</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">
                  Full optimization for English, Urdu (Unicode & Nastaliq), Roman Urdu, Arabic, Hindi, Spanish, and 7+ languages.
                </p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl hover:border-[#10b981]/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">
                  ▣
                </div>
                <h3 className="text-[16px] font-bold text-white mb-2">Visual Caption Styles</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">
                  Kinetic animations, font range sliders, custom font imports, and 2D touch drag positioning on video.
                </p>
              </div>
            </div>

            {/* How It Works Steps */}
            <div className="bg-[#0a0a0c] border border-[#1f1f23] p-7 sm:p-8 rounded-2xl text-left my-8">
              <h2 className="text-xl font-bold text-white mb-6 text-center">How CaptionPro Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex flex-col gap-2 p-4 bg-[#050507] rounded-xl border border-[#1f1f23]">
                  <span className="text-xs font-mono font-bold text-[#10b981] bg-[#10b981]/10 w-6 h-6 rounded flex items-center justify-center">1</span>
                  <h4 className="font-bold text-white text-sm">Upload Video</h4>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">Import any video up to 2GB directly from your mobile device or desktop computer.</p>
                </div>
                <div className="flex flex-col gap-2 p-4 bg-[#050507] rounded-xl border border-[#1f1f23]">
                  <span className="text-xs font-mono font-bold text-[#10b981] bg-[#10b981]/10 w-6 h-6 rounded flex items-center justify-center">2</span>
                  <h4 className="font-bold text-white text-sm">Auto-Generate Captions</h4>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">AI engine automatically transcribes spoken audio into synchronized word-level captions.</p>
                </div>
                <div className="flex flex-col gap-2 p-4 bg-[#050507] rounded-xl border border-[#1f1f23]">
                  <span className="text-xs font-mono font-bold text-[#10b981] bg-[#10b981]/10 w-6 h-6 rounded flex items-center justify-center">3</span>
                  <h4 className="font-bold text-white text-sm">Style & Export Full Video</h4>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">Pick fonts, animations, and positions, then export the full video duration with audio.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 2: Editor Page (All caption editing tools) */}
        {currentPage === 'editor' && (
          <div className="flex flex-col gap-6">
            {/* If no media loaded in Editor: show clean import dropzone */}
            {!hasMedia ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`bg-[#0a0a0c] border-2 rounded-2xl p-8 sm:p-12 text-center max-w-[680px] mx-auto my-6 w-full transition-all ${
                  isDraggingOver
                    ? 'border-[#10b981] bg-[#10b981]/10 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.01]'
                    : 'border-dashed border-[#1f1f23] hover:border-[#10b981]/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center mx-auto mb-4 text-[#10b981]">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isDraggingOver ? 'Drop video here to import!' : 'CaptionPro Editor'}
                </h2>
                <p className="text-sm text-[#a1a1aa] max-w-[460px] mx-auto mb-6 leading-relaxed">
                  Drop your video file here or click below to import (MP4, WebM, MOV) up to 2GB. Full duration and original audio are 100% preserved.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={triggerImport}
                    className="bg-[#10b981] hover:bg-[#059669] text-black font-bold px-6 py-3 rounded-lg text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import Video</span>
                  </button>
                  <button
                    onClick={handleLoadSampleVideo}
                    className="bg-[#151519] hover:bg-[#1f1f23] text-white font-semibold border border-[#1f1f23] hover:border-[#10b981] px-5 py-3 rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#10b981]" />
                    <span>Try Demo Sample Video</span>
                  </button>
                </div>
              </div>
            ) : (
              <section className="transition-all duration-500" id="main-studio-workspace">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7">
              
              {/* Left Panel: Media Player & Subtitle Timeline */}
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1f1f23]">
                  <h2 className="text-[18px] font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#10b981]" />
                    <span>Media Player</span>
                  </h2>
                  <span className="text-xs font-mono text-[#a1a1aa] bg-[#000000] px-2 py-0.5 rounded border border-[#1f1f23]">
                    X: {captionXPercent}% • Y: {captionYPercent}%
                  </span>
                </div>

                {/* Video Ratio / Frame Selector (Change 5: 9:16 | 16:9 | 1:1 | 3:4 | 4:3) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#050507] rounded-xl border border-[#1f1f23]">
                  <span className="text-xs font-semibold text-[#a1a1aa] flex items-center gap-1.5 pl-0.5">
                    <Square className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>Frame Ratio:</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['9:16', '16:9', '1:1', '3:4', '4:3'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => {
                          setAspectRatio(ratio);
                          setStatusMessage(`Frame ratio set to ${ratio}.`);
                          setStatusType('info');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                          aspectRatio === ratio
                            ? 'bg-[#10b981] text-black border-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-[#000000] text-[#a1a1aa] border-[#1f1f23] hover:text-white hover:border-[#10b981]/50'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Container Frame */}
                <div className="w-full flex justify-center items-center py-1">
                  <div
                    ref={videoContainerRef}
                    onTouchStart={handlePreviewTouchStart}
                    onTouchMove={handlePreviewTouchMove}
                    onTouchEnd={handlePreviewTouchEnd}
                    className={`relative w-full ${
                      aspectRatio === '9:16'
                        ? 'aspect-[9/16] max-w-[320px] max-h-[520px]'
                        : aspectRatio === '16:9'
                        ? 'aspect-[16/9] max-w-[560px] max-h-[360px]'
                        : aspectRatio === '1:1'
                        ? 'aspect-square max-w-[420px] max-h-[420px]'
                        : aspectRatio === '3:4'
                        ? 'aspect-[3/4] max-w-[360px] max-h-[480px]'
                        : 'aspect-[4/3] max-w-[480px] max-h-[380px]'
                    } bg-[#050505] rounded-xl border border-[#1f1f23] overflow-hidden flex items-center justify-center group select-none transition-all duration-300 shadow-xl`}
                  >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                    onClick={togglePlay}
                  />

                  {/* Live Caption Overlay Layer with Real-Time Word-Level Timing (Task 7 Animations) */}
                  {activeCaptionAtCurrentTime && activeCaptionAtCurrentTime.text.trim() && (() => {
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
                        style={{
                          left: `${captionXPercent}%`,
                          top: `${captionYPercent}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute z-30 max-w-[90%] text-center cursor-move transition-transform duration-75 select-none ${
                          isDraggingCaption ? 'ring-2 ring-[#10b981] ring-offset-2 ring-offset-black rounded px-3 py-1.5 bg-black/50 shadow-xl' : 'hover:outline-dashed hover:outline-1 hover:outline-[#10b981]/50 rounded'
                        }`}
                      >
                        {isDraggingCaption && (
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#10b981] text-black text-[10px] font-bold px-2 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap shadow">
                            Captions: X {captionXPercent}% • Y {captionYPercent}%
                          </span>
                        )}
                        <p
                          style={{
                            fontSize: `${captionFontSize}px`,
                            color: captionColor,
                            fontFamily: activeFontFamily,
                            textShadow: captionStyle === 'White Text with Shadow'
                              ? '2px 2px 5px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.8)'
                              : captionStyle === 'Bold Clean'
                              ? '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000'
                              : 'none',
                          }}
                          className="font-black tracking-tight leading-tight inline-flex flex-wrap justify-center gap-x-1.5"
                        >
                          {words.map((word, wIdx) => {
                            const isCurrentWord = wIdx === activeWordIdx;
                            let animClass = '';
                            if (isCurrentWord) {
                              if (animationType === 'karaoke-jump') animClass = 'anim-karaoke-jump text-[#10b981]';
                              else if (animationType === 'neon-pulse') animClass = 'anim-neon-pulse text-[#34d399]';
                              else if (animationType === 'marker-box') animClass = 'anim-marker-box';
                              else if (animationType === 'flash-gold') animClass = 'anim-flash-gold';
                              else if (animationType === 'fade-in') animClass = 'anim-fade-in text-[#10b981]';
                              else animClass = 'anim-pop-bounce text-[#10b981]';
                            }

                            return (
                              <span
                                key={wIdx}
                                className={`transition-all duration-75 inline-block ${animClass} ${
                                  !isCurrentWord && captionStyle === 'Green Highlight' ? 'text-[#10b981]' : ''
                                }`}
                              >
                                {word}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Task 5: Custom Text Tool Overlays (CapCut Style Separate Text Layers) */}
                  {textOverlays.map(textItem => {
                    const isVisible = textItem.allVideo || (currentTime >= textItem.startSec && currentTime <= textItem.endSec);
                    if (!isVisible) return null;
                    const isSelected = selectedTextOverlayId === textItem.id;
                    const isCurrentlyDragging = isDraggingTextId === textItem.id;

                    return (
                      <div
                        key={textItem.id}
                        onPointerDown={(e) => handleTextPointerDown(textItem.id, e)}
                        style={{
                          left: `${textItem.xPercent}%`,
                          top: `${textItem.yPercent}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`absolute z-40 max-w-[90%] text-center cursor-move transition-transform duration-75 select-none ${
                          isSelected
                            ? 'ring-2 ring-[#10b981] ring-offset-2 ring-offset-black rounded px-2.5 py-1 bg-black/40 shadow-xl'
                            : 'hover:ring-1 hover:ring-[#10b981]/50 rounded'
                        } ${isCurrentlyDragging ? 'scale-105' : ''}`}
                      >
                        {isSelected && (
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#10b981] text-black text-[10px] font-bold px-2 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap shadow">
                            Text: X {textItem.xPercent}% • Y {textItem.yPercent}%
                          </span>
                        )}
                        <div
                          style={{
                            fontSize: `${textItem.fontSize}px`,
                            color: textItem.color,
                            fontFamily: textItem.fontFamily,
                            backgroundColor: textItem.showBackground ? textItem.backgroundColor : 'transparent',
                            padding: textItem.showBackground ? '4px 14px' : '0px',
                            borderRadius: textItem.showBackground ? '8px' : '0px',
                            textShadow: textItem.shadow
                              ? '2px 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)'
                              : 'none',
                          }}
                          className="font-bold tracking-tight leading-snug whitespace-pre-wrap inline-block"
                        >
                          {textItem.text || 'Enter text...'}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>

                <p className="text-[12px] text-[#a1a1aa] mt-1 flex items-center justify-between" id="media-name">
                  <span className="truncate max-w-[280px]">File: {videoFileName || 'Selected Video'}</span>
                  <span>Duration: {formatSecondsToTime(duration)}</span>
                </p>

                {/* Subtitle Timeline & Segment List */}
                {captions.length > 0 && (
                  <div className="border-t border-[#1f1f23] pt-4 mt-2 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                        Subtitles ({captions.length} Clips)
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleAddCaption}
                          className="bg-[#151519] hover:bg-[#1f1f23] text-white text-xs px-2.5 py-1 rounded border border-[#1f1f23] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-[#10b981]" />
                          <span>Add Clip</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSplitCaption}
                          className="bg-[#151519] hover:bg-[#1f1f23] text-white text-xs px-2.5 py-1 rounded border border-[#1f1f23] flex items-center gap-1 cursor-pointer"
                        >
                          <Scissors className="w-3 h-3 text-[#10b981]" />
                          <span>Split</span>
                        </button>
                      </div>
                    </div>

                    <div ref={transcriptListRef} className="max-h-[200px] overflow-y-auto pr-1 flex flex-col gap-2">
                      {captions.map((seg) => {
                        const isSelected = seg.id === selectedClipId;
                        const isActiveNow = currentTime >= seg.startSec && currentTime <= seg.endSec;
                        return (
                          <div
                            key={seg.id}
                            onClick={() => handleSelectBlock(seg)}
                            className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex flex-col gap-1.5 ${
                              isSelected
                                ? 'bg-[#151519] border-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : isActiveNow
                                ? 'bg-[#151519]/80 border-[#10b981]/50'
                                : 'bg-[#000000] border-[#1f1f23] hover:border-[#1f1f23]/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                              <span className="font-mono text-[#10b981] font-semibold">{seg.start} → {seg.end}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteCaption(seg.id); }}
                                className="text-[#a1a1aa] hover:text-red-400 p-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={seg.text}
                              onChange={(e) => handleUpdateText(seg.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-[#000000] border border-[#1f1f23] text-white px-2 py-1 rounded text-xs focus:border-[#10b981] outline-none"
                              style={{ fontFamily: activeFontFamily }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Caption Studio Configuration with CapCut-style Tabs (Tasks 5, 6, 7, 8) */}
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl flex flex-col gap-5">
                {/* 3-Tab Header (Task 5: Separate Text tool from Captions, like CapCut) */}
                <div className="flex items-center gap-1.5 p-1 bg-[#000000] rounded-xl border border-[#1f1f23]">
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('captions')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                      activeStudioTab === 'captions'
                        ? 'bg-[#10b981] text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-[#a1a1aa] bg-transparent hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Captions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('text')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                      activeStudioTab === 'text'
                        ? 'bg-[#10b981] text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-[#a1a1aa] bg-transparent hover:text-white'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>Text Tool</span>
                    {textOverlays.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-black/40 text-[10px] font-mono flex items-center justify-center font-bold">
                        {textOverlays.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('style')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                      activeStudioTab === 'style'
                        ? 'bg-[#10b981] text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-[#a1a1aa] bg-transparent hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Styles & Fonts</span>
                  </button>
                </div>

                {/* ============================================================ */}
                {/* TAB 1: CAPTIONS CONFIGURATION & PROFESSIONAL ANIMATIONS     */}
                {/* ============================================================ */}
                {activeStudioTab === 'captions' && (
                  <div className="flex flex-col gap-4">
                    {/* Language Selector */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="caption-language" className="text-[13px] font-[600] text-[#a1a1aa] flex items-center justify-between">
                        <span>Caption Language</span>
                        <span className="text-[11px] text-[#10b981] font-mono">13+ Supported</span>
                      </label>
                      <select
                        id="caption-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>

                    {/* Task 7: Professional Caption Animations (TikTok & Reels creator styles) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-[600] text-[#a1a1aa] flex items-center justify-between">
                        <span>Caption Animation Style (TikTok / Reels)</span>
                        <span className="text-[11px] text-[#10b981] font-mono">Creator FX</span>
                      </label>
                      <select
                        value={animationType}
                        onChange={(e) => setAnimationType(e.target.value as CaptionAnimationType)}
                        className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer font-medium"
                      >
                        <option value="pop-bounce">💥 Pop / Bounce (Hormozi & MrBeast Scale)</option>
                        <option value="karaoke-jump">🦘 Karaoke Jump (TikTok Bouncing Word)</option>
                        <option value="neon-pulse">⚡ Neon Glow Pulse (Cyberpunk / EDM Reels)</option>
                        <option value="marker-box">🖍️ Marker Box (CapCut Highlight Badge)</option>
                        <option value="flash-gold">🌟 Gold Flame Flash (Viral Keyword Flash)</option>
                        <option value="fade-in">✨ Smooth Fade In (Clean & Minimalist)</option>
                      </select>
                    </div>

                    {/* Subtitle Style */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="caption-style" className="text-[13px] font-[600] text-[#a1a1aa]">Visual Style Preset</label>
                      <select
                        id="caption-style"
                        value={captionStyle}
                        onChange={(e) => setCaptionStyle(e.target.value)}
                        className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer"
                      >
                        <option value="Bold Clean">Bold Clean (Black Contour Stroke)</option>
                        <option value="White Text with Shadow">White Text with Heavy Drop Shadow</option>
                        <option value="Green Highlight">Green Accent Highlight</option>
                        <option value="Minimal">Minimal (Subtle Flat Text)</option>
                      </select>
                    </div>

                    {/* Words Per Line Chunking (Change 2: 1 to 10 in a single horizontal row) */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[13px] font-[600] text-[#a1a1aa]">Words Per Line</label>
                        <span className="text-xs text-[#10b981] font-mono font-bold">{maxWordsPerLine} {maxWordsPerLine === 1 ? 'word' : 'words'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              setMaxWordsPerLine(count);
                              if (captions.length > 0) {
                                setCaptions(prev => splitIntoWordChunks(prev, count));
                              }
                            }}
                            className={`flex-1 min-w-[28px] h-8 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer flex items-center justify-center shrink-0 ${
                              maxWordsPerLine === count
                                ? 'bg-[#10b981] text-black border-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                : 'bg-[#000000] border-[#1f1f23] text-[#a1a1aa] hover:text-white hover:border-[#10b981]/50'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Feature 1: Caption Color Picker */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="caption-color" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          id="caption-color"
                          type="color"
                          value={captionColor}
                          onChange={(e) => setCaptionColor(e.target.value)}
                          className="w-12 h-10 bg-[#000000] border border-[#1f1f23] p-1 rounded-lg cursor-pointer"
                        />
                        <span className="font-mono text-xs text-[#a1a1aa] uppercase">{captionColor}</span>
                      </div>
                    </div>

                    {/* Feature 2: Caption Position (Top, Middle, Bottom) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-[600] text-[#a1a1aa]">Caption Position</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Top', 'Middle', 'Bottom'] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => {
                              if (pos === 'Top') {
                                setCaptionPosition('Top');
                                setCaptionYPercent(15);
                                setCaptionXPercent(50);
                              } else if (pos === 'Middle') {
                                setCaptionPosition('Center');
                                setCaptionYPercent(50);
                                setCaptionXPercent(50);
                              } else {
                                setCaptionPosition('Bottom');
                                setCaptionYPercent(80);
                                setCaptionXPercent(50);
                              }
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              (pos === 'Top' && captionYPercent < 30) ||
                              (pos === 'Middle' && captionYPercent >= 30 && captionYPercent <= 65) ||
                              (pos === 'Bottom' && captionYPercent > 65)
                                ? 'bg-[#10b981] text-black border-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-[#000000] text-[#a1a1aa] border-[#1f1f23] hover:text-white hover:border-[#10b981]/50'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Feature 3: Font Size Slider (Range 12 to 72, default 32) */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label htmlFor="font-size" className="text-[13px] font-[600] text-[#a1a1aa]">Font Size</label>
                        <span className="text-xs text-[#10b981] font-mono font-bold">{captionFontSize}px</span>
                      </div>
                      <input
                        id="font-size"
                        type="range"
                        min={12}
                        max={72}
                        step={1}
                        value={captionFontSize}
                        onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#000000] border border-[#1f1f23] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                      />
                    </div>

                    {/* Generate Captions Primary Trigger */}
                    <button
                      type="button"
                      onClick={handleGenerateCaptions}
                      disabled={isTranscribing}
                      className="mt-2 bg-[#10b981] hover:bg-[#059669] text-black font-[700] py-3.5 px-5 rounded-lg text-[15px] cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating AI Subtitles...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Generate Captions with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: TEXT TOOL (TASK 5 - SEPARATE FROM CAPTIONS, CAPCUT)  */}
                {/* ============================================================ */}
                {activeStudioTab === 'text' && (() => {
                  const selectedOverlay = textOverlays.find(t => t.id === selectedTextOverlayId) || textOverlays[0];

                  return (
                    <div className="flex flex-col gap-4">
                      {/* Top Action Bar */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1f1f23]">
                        <span className="text-xs text-[#a1a1aa] font-medium">Custom Freeform Text Layers</span>
                        <button
                          type="button"
                          onClick={() => handleAddTextOverlay()}
                          className="bg-[#10b981] hover:bg-[#059669] text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Text</span>
                        </button>
                      </div>

                      {/* Quick Creator Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddTextOverlay({ text: '🔥 WATCH TILL END!', bg: '#ef4444', color: '#ffffff', yPercent: 20 })}
                          className="px-2.5 py-1 rounded bg-[#151519] hover:bg-[#1f1f23] text-xs text-zinc-300 border border-[#1f1f23] cursor-pointer"
                        >
                          + Hook Badge
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddTextOverlay({ text: '@yourhandle', bg: 'transparent', color: '#10b981', yPercent: 12 })}
                          className="px-2.5 py-1 rounded bg-[#151519] hover:bg-[#1f1f23] text-xs text-zinc-300 border border-[#1f1f23] cursor-pointer"
                        >
                          + Watermark
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddTextOverlay({ text: 'FOLLOW FOR PART 2', bg: '#000000cc', color: '#facc15', yPercent: 86 })}
                          className="px-2.5 py-1 rounded bg-[#151519] hover:bg-[#1f1f23] text-xs text-zinc-300 border border-[#1f1f23] cursor-pointer"
                        >
                          + Call to Action
                        </button>
                      </div>

                      {/* Layer Selection Chips if multiple layers exist */}
                      {textOverlays.length > 0 ? (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {textOverlays.map((t, idx) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTextOverlayId(t.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all border cursor-pointer ${
                                selectedOverlay?.id === t.id
                                  ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                                  : 'bg-[#000000] border-[#1f1f23] text-[#a1a1aa] hover:text-white'
                              }`}
                            >
                              Layer {idx + 1}: {t.text.slice(0, 12) || 'Text'}...
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#1f1f23] text-center my-2">
                          <Type className="w-6 h-6 text-[#10b981] mx-auto mb-2 opacity-80" />
                          <p className="text-xs text-[#a1a1aa] mb-2">No custom text layers yet.</p>
                          <button
                            type="button"
                            onClick={() => handleAddTextOverlay()}
                            className="bg-[#10b981] text-black font-bold px-4 py-2 rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Your First Text</span>
                          </button>
                        </div>
                      )}

                      {/* Selected Layer Editor */}
                      {selectedOverlay && (
                        <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-[#050507] border border-[#1f1f23]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1">
                              <Type className="w-3.5 h-3.5 text-[#10b981]" />
                              <span>Edit Text Layer</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateTextOverlay(selectedOverlay.id)}
                                title="Duplicate Layer"
                                className="p-1.5 rounded bg-[#151519] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white border border-[#1f1f23] cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTextOverlay(selectedOverlay.id)}
                                title="Delete Layer"
                                className="p-1.5 rounded bg-[#151519] hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-[#1f1f23] hover:border-red-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Freeform Text Input */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-[#a1a1aa]">Text Content</label>
                            <textarea
                              rows={2}
                              value={selectedOverlay.text}
                              onChange={(e) => handleUpdateTextOverlay(selectedOverlay.id, { text: e.target.value })}
                              placeholder="Type freely on video..."
                              className="w-full bg-[#000000] border border-[#1f1f23] text-white p-2.5 rounded-lg text-sm outline-none focus:border-[#10b981] resize-none"
                              style={{ fontFamily: selectedOverlay.fontFamily }}
                            />
                          </div>

                          {/* Font Size Slider */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-medium text-[#a1a1aa]">Font Size</label>
                              <span className="text-xs text-[#10b981] font-mono font-bold">{selectedOverlay.fontSize}px</span>
                            </div>
                            <input
                              type="range"
                              min={12}
                              max={80}
                              value={selectedOverlay.fontSize}
                              onChange={(e) => handleUpdateTextOverlay(selectedOverlay.id, { fontSize: parseInt(e.target.value, 10) })}
                              className="w-full h-2 bg-[#000000] border border-[#1f1f23] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                            />
                          </div>

                          {/* Font Family */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-[#a1a1aa]">Typography</label>
                            <select
                              value={selectedOverlay.fontFamily}
                              onChange={(e) => handleUpdateTextOverlay(selectedOverlay.id, { fontFamily: e.target.value })}
                              className="w-full bg-[#000000] border border-[#1f1f23] text-white p-2.5 rounded-lg text-xs outline-none focus:border-[#10b981] cursor-pointer"
                            >
                              {allFonts.map((f) => (
                                <option key={f.name} value={f.family}>{f.name} ({f.category})</option>
                              ))}
                            </select>
                          </div>

                          {/* Colors & Background Badge */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-[#a1a1aa]">Text Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={selectedOverlay.color}
                                  onChange={(e) => handleUpdateTextOverlay(selectedOverlay.id, { color: e.target.value })}
                                  className="w-10 h-8 bg-[#000000] border border-[#1f1f23] p-0.5 rounded cursor-pointer"
                                />
                                <span className="text-[11px] font-mono text-[#a1a1aa] uppercase">{selectedOverlay.color}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-[#a1a1aa]">Background Box</label>
                              <select
                                value={selectedOverlay.showBackground ? selectedOverlay.backgroundColor : 'transparent'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateTextOverlay(selectedOverlay.id, {
                                    showBackground: val !== 'transparent',
                                    backgroundColor: val
                                  });
                                }}
                                className="w-full bg-[#000000] border border-[#1f1f23] text-white p-2 rounded-lg text-xs outline-none focus:border-[#10b981] cursor-pointer"
                              >
                                <option value="transparent">None (Transparent)</option>
                                <option value="#000000cc">Black Box Pill</option>
                                <option value="#10b981">Emerald Green Pill</option>
                                <option value="#ef4444">Red Hook Pill</option>
                                <option value="#facc15">Neon Yellow Tag</option>
                                <option value="#06b6d4">Cyber Cyan Banner</option>
                              </select>
                            </div>
                          </div>

                          {/* Position Shortcuts */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex justify-between items-center text-xs text-[#a1a1aa]">
                              <span>Position (Drag on video anytime)</span>
                              <span className="font-mono text-[#10b981]">X {selectedOverlay.xPercent}% • Y {selectedOverlay.yPercent}%</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateTextOverlay(selectedOverlay.id, { xPercent: 50, yPercent: 18 })}
                                className="py-1.5 px-2 bg-[#000000] hover:bg-[#151519] border border-[#1f1f23] rounded text-[11px] text-zinc-300 cursor-pointer"
                              >
                                Top Header
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateTextOverlay(selectedOverlay.id, { xPercent: 50, yPercent: 50 })}
                                className="py-1.5 px-2 bg-[#000000] hover:bg-[#151519] border border-[#1f1f23] rounded text-[11px] text-zinc-300 cursor-pointer"
                              >
                                Center Screen
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateTextOverlay(selectedOverlay.id, { xPercent: 50, yPercent: 82 })}
                                className="py-1.5 px-2 bg-[#000000] hover:bg-[#151519] border border-[#1f1f23] rounded text-[11px] text-zinc-300 cursor-pointer"
                              >
                                Bottom Callout
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ============================================================ */}
                {/* TAB 3: STYLES & FONTS (TASKS 6 & 8: FONTS & DRAG/PINCH ZOOM) */}
                {/* ============================================================ */}
                {activeStudioTab === 'style' && (
                  <div className="flex flex-col gap-4">
                    {/* Task 8: Font Selector with 21 Preset Fonts + Custom Imported Font */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[13px] font-[600] text-[#a1a1aa]">Active Font Family</label>
                        <button
                          type="button"
                          onClick={() => customFontInputRef.current?.click()}
                          className="text-xs text-[#10b981] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <FolderUp className="w-3.5 h-3.5" />
                          <span>+ Import Font File</span>
                        </button>
                        <input
                          type="file"
                          ref={customFontInputRef}
                          accept=".ttf,.otf,.woff,.woff2"
                          className="hidden"
                          onChange={handleImportCustomFont}
                        />
                      </div>
                      <select
                        value={selectedFont}
                        onChange={(e) => setSelectedFont(e.target.value)}
                        className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer"
                      >
                        <optgroup label="Custom Imported Fonts">
                          {customFonts.map((f) => (
                            <option key={f.name} value={f.name}>✦ {f.name} (Custom File)</option>
                          ))}
                        </optgroup>
                        <optgroup label="English Fonts (15 Creator Styles)">
                          {PRESET_FONTS.filter(f => f.category === 'English').map((f) => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Urdu & Arabic Calligraphy (6 Styles)">
                          {PRESET_FONTS.filter(f => f.category === 'Urdu / Arabic').map((f) => (
                            <option key={f.name} value={f.name}>{f.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Task 6: Caption Font Size with Range Slider & Live Display */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label htmlFor="font-size" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Font Size</label>
                        <span className="text-xs text-[#10b981] font-mono font-bold">{captionFontSize}px</span>
                      </div>
                      <input
                        id="font-size"
                        type="range"
                        min={12}
                        max={72}
                        step={1}
                        value={captionFontSize}
                        onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#000000] border border-[#1f1f23] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                      />
                    </div>

                    {/* Caption Color */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="caption-color" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Text Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          id="caption-color"
                          type="color"
                          value={captionColor}
                          onChange={(e) => setCaptionColor(e.target.value)}
                          className="w-12 h-10 bg-[#000000] border border-[#1f1f23] p-1 rounded-lg cursor-pointer"
                        />
                        <span className="font-mono text-xs text-[#a1a1aa] uppercase">{captionColor}</span>
                      </div>
                    </div>

                    {/* Task 6: Touch Drag & Pinch-to-zoom status */}
                    <div className="p-4 rounded-xl bg-[#000000] border border-[#1f1f23] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-[#10b981]" />
                          <span>Interactive Positioning</span>
                        </span>
                        <span className="text-xs font-mono text-[#10b981]">
                          X: {captionXPercent}% • Y: {captionYPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                        • Drag captions directly on the video player with touch or mouse.<br />
                        • Pinch with two fingers on mobile to zoom font size up or down.<br />
                        • Custom text layers can also be dragged freely anywhere.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCaptionXPercent(50);
                          setCaptionYPercent(80);
                          setStatusMessage('Caption position reset to bottom center.');
                          setStatusType('info');
                        }}
                        className="mt-1 py-1 px-3 bg-[#151519] hover:bg-[#1f1f23] border border-[#1f1f23] rounded text-xs text-zinc-300 self-start cursor-pointer"
                      >
                        Reset Position (Bottom Center)
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons (Change 4: Bottom export removed, top nav has the only Export button. Change 3: SRT/VTT/Copy removed) */}
                <div className="mt-2 pt-3 border-t border-[#1f1f23]">
                  <button
                    type="button"
                    onClick={resetStudio}
                    className="w-full bg-[#151519] hover:bg-red-950/40 text-zinc-300 hover:text-white font-[600] border border-[#1f1f23] hover:border-red-800 py-3 px-4 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 text-red-400" />
                    <span>Remove Media</span>
                  </button>
                </div>

                <p className="text-[12px] text-[#a1a1aa] mt-1 leading-[1.5]">
                  Connected to Gemini 2.5 Flash / Hugging Face Whisper API for speech recognition.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    )}

    {/* PAGE 3: About Page (Information about CaptionPro) */}
    {currentPage === 'about' && (
      <section className="py-6 max-w-[820px] mx-auto text-left" id="about-section">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-semibold mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>About CaptionPro</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
          Studio-Grade AI Captions for Modern Creators
        </h1>
        <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed mb-8">
          CaptionPro is a dedicated AI video caption studio engineered for short-form creators publishing to TikTok, Instagram Reels, and YouTube Shorts. We empower creators to produce polished, animated subtitles with zero 3-second export cutoffs, preserved audio, and authentic multi-language typography.
        </p>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <span className="text-[#10b981] font-black">✔</span> Full-Duration Export
            </h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Never worry about 3-second cutoffs. Every export retains 100% of the original video duration, valid container metadata, and frame timing.
            </p>
          </div>

          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <span className="text-[#10b981] font-black">✔</span> Audio Stream Preservation
            </h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Your voice track, background beats, and ambient sound are mapped directly with AAC 128k audio preservation so your video sounds punchy and clear.
            </p>
          </div>

          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <span className="text-[#10b981] font-black">✔</span> Native Urdu Nastaliq & Fonts
            </h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Specialized typography support for Urdu Nastaliq, Roman Urdu, Arabic, English, and user-imported custom font files (.ttf, .otf, .woff2).
            </p>
          </div>

          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl">
            <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <span className="text-[#10b981] font-black">✔</span> Flexible Subtitle Exports
            </h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Burn styled animated subtitles directly into the video or download industry-standard .SRT and .VTT files for your video editor.
            </p>
          </div>
        </div>

        {/* Specifications Table */}
        <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl mb-8">
          <h3 className="font-bold text-white text-sm mb-4">Supported Technical Specifications</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-[#050507] rounded-lg border border-[#1f1f23]">
              <span className="text-[11px] text-[#a1a1aa] block mb-1">Max File Size</span>
              <span className="font-mono font-bold text-[#10b981] text-sm">Up to 2GB</span>
            </div>
            <div className="p-3 bg-[#050507] rounded-lg border border-[#1f1f23]">
              <span className="text-[11px] text-[#a1a1aa] block mb-1">Max Duration</span>
              <span className="font-mono font-bold text-[#10b981] text-sm">Up to 1 Hour</span>
            </div>
            <div className="p-3 bg-[#050507] rounded-lg border border-[#1f1f23]">
              <span className="text-[11px] text-[#a1a1aa] block mb-1">Video Formats</span>
              <span className="font-mono font-bold text-white text-sm">MP4, WebM, MOV</span>
            </div>
            <div className="p-3 bg-[#050507] rounded-lg border border-[#1f1f23]">
              <span className="text-[11px] text-[#a1a1aa] block mb-1">AI Engines</span>
              <span className="font-mono font-bold text-white text-sm">Whisper + Gemini</span>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-white text-base mb-1">Ready to create subtitles?</h4>
            <p className="text-xs text-[#a1a1aa]">Launch the CaptionPro Editor and get your video captioned in minutes.</p>
          </div>
          <button
            onClick={() => navigateTo('editor')}
            className="bg-[#10b981] hover:bg-[#059669] text-black font-bold px-6 py-3 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <Film className="w-4 h-4" />
            <span>Open Editor</span>
          </button>
        </div>
      </section>
    )}
  </main>

      {/* Persistent global file input for 100% reliable import across all views */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.3gp,.flv,.wmv,.mp3,.wav,.m4a"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Processing Overlay Modal (Task 4: CapCut Animated Border + Wink Circular Progress Ring) */}
      {(isTranscribing || isExporting) && (
        <div className="fixed inset-0 w-full h-full bg-black/85 backdrop-blur-md z-[1000] flex flex-col justify-center items-center p-4 select-none">
          {/* CapCut Animated Border Card */}
          <div className="relative p-[2px] rounded-3xl capcut-border-glow max-w-[380px] w-full border border-[#10b981]/50 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <div className="bg-[#0a0a0c] p-7 sm:p-9 rounded-[22px] flex flex-col items-center text-center relative overflow-hidden">
              {/* Radial ambient glow blobs */}
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#10b981]/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#10b981]/10 rounded-full blur-2xl pointer-events-none" />

              {/* Pro Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-[11px] font-semibold tracking-wider uppercase mb-3">
                <Sparkles className="w-3 h-3" />
                <span>{isExporting ? 'CapCut Pro Export' : 'AI Speech Transcription'}</span>
              </div>

              {/* Title */}
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
                {isExporting ? 'Exporting Video' : 'Generating Captions'}
              </h3>

              {/* Wink App Circular Progress Ring */}
              <div className="relative w-36 h-36 my-2 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                  {/* Background Track Ring */}
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke="#1f1f23"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Animated Progress Ring */}
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke="#10b981"
                    strokeWidth="7"
                    strokeDasharray="339.29"
                    strokeDashoffset={
                      339.29 -
                      ((isExporting ? exportProgress : transcribeProgress) / 100) * 339.29
                    }
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-300 ease-out"
                  />
                </svg>

                {/* Ring Center: Percentage + Elapsed Time */}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                    {Math.round(isExporting ? exportProgress : transcribeProgress)}%
                  </span>
                  <span className="text-[11px] font-mono text-[#10b981] mt-1.5 flex items-center gap-1 font-semibold">
                    <Clock className="w-3 h-3" />
                    {formatSecondsToTime(
                      isExporting ? exportElapsedSec : Math.round((transcribeProgress / 100) * 15)
                    )}
                  </span>
                </div>
              </div>

              {/* Status Details */}
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-4 min-h-[36px] flex items-center justify-center max-w-[280px]">
                {isExporting ? exportStatusDetail : transcribeStatusText}
              </p>

              {/* Video Paused & Guarantee Status */}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400 bg-black/60 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span>Video playback paused in background</span>
              </div>

              {/* Cancel Button */}
              {isExporting && (
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="mt-5 px-5 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
