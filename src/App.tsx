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
  Film
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

  // 8000 Hz 16-bit mono provides high speech clarity while keeping base64 payload efficient
  const targetSampleRate = 8000;
  const maxSec = audioBuffer.duration; // Extract complete audio duration without cutoffs for long-form videos up to 1 hour
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
  const [captionFontSize, setCaptionFontSize] = useState<number>(25);
  const [captionStyle, setCaptionStyle] = useState<string>('Bold Clean');
  const [captionColor, setCaptionColor] = useState<string>('#ffffff');
  const [captionPosition, setCaptionPosition] = useState<string>('Bottom');
  const [animationType, setAnimationType] = useState<CaptionAnimationType>('pop-bounce');

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

  // Active caption at current playback time
  const activeCaptionAtCurrentTime = captions.find(
    c => currentTime >= c.startSec && currentTime <= c.endSec
  );

  // Trigger file selection
  const triggerImport = () => {
    fileInputRef.current?.click();
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

  // Media upload handler
  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/') && !file.name.match(/\.(mp4|webm|mov|mkv|mp3|wav|m4a)$/i)) {
      setStatusMessage('Import Failed: Please choose a valid video or audio file (MP4, WebM, MOV) under 2GB.');
      setStatusType('error');
      return;
    }

    if (file.size > 2000 * 1024 * 1024) {
      setStatusMessage('File Too Large: Please upload a media file under 2GB.');
      setStatusType('error');
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoSrc(url);
    setHasMedia(true);
    setStatusMessage(`Loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Click "Generate Captions" to transcribe with AI.`);
    setStatusType('success');

    setTimeout(() => {
      document.getElementById('main-studio-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
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

  // 2D Dragging Logic for Caption Positioning
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

  // Video Export (Full duration & preserved audio)
  const handleExportBurnedVideo = async () => {
    const video = videoRef.current;
    if (!video) {
      setStatusMessage('Video element not ready.');
      setStatusType('error');
      return;
    }
    video.pause();
    setIsPlaying(false);

    setIsExporting(true);
    setExportProgress(10);
    setStatusMessage('Initiating server render pipeline with preserved audio...');
    setStatusType('info');

    // Attempt 1: Server-Side FFmpeg Render
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
            const serverDurationHeader = parseFloat(serverResp.headers.get('X-Video-Duration') || '0');
            const probedDur = await verifyBlobDuration(exportedBlob);
            const verifiedDuration = probedDur > 0 ? probedDur : (serverDurationHeader > 0 ? serverDurationHeader : (duration || 20));
            const targetDuration = duration || 20;

            const mp4Blob = new Blob([exportedBlob], { type: 'video/mp4' });
            const downloadUrl = URL.createObjectURL(mp4Blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'captionfree-export.mp4';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try {
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
              } catch (e) {}
            }, 5000);

            setExportProgress(100);
            setStatusMessage(`Export complete! Exported ${Math.round(verifiedDuration)}s video with preserved audio.`);
            setStatusType('success');
            setIsExporting(false);
            return;
          }
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
          sourceNode.connect(audioCtx.destination);
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

      video.muted = false;
      video.pause();

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
              ctx.lineWidth = Math.max(4, baseSize * 0.16);
              ctx.lineJoin = 'miter';
              ctx.miterLimit = 2;
              ctx.strokeStyle = '#000000';
              ctx.strokeText(word, cursorX, yPos);

              ctx.fillStyle = isActive ? '#10b981' : (captionColor || '#ffffff');
              ctx.fillText(word, cursorX, yPos);
              ctx.restore();

              if (!isRtl) cursorX += wWidth + spaceWidth;
              else cursorX -= spaceWidth;
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

      video.pause();
      video.currentTime = origTime;
      video.muted = origMuted;
      if (origPlaying) video.play();

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
      {/* Sticky Navigation Header */}
      <header className="flex justify-between items-center px-[5%] py-[15px] bg-black/90 backdrop-blur-md sticky top-0 z-50 border-b border-[#1f1f23]">
        <div className="flex items-center gap-3">
          <a href="#" className="text-[22px] font-[800] text-[#10b981] no-underline tracking-tight">
            Caption Free
          </a>
          <span className="hidden sm:inline-block text-xs text-[#a1a1aa] font-medium border-l border-[#1f1f23] pl-2.5">
            AI Caption Studio
          </span>
        </div>

        <nav className="flex items-center gap-5">
          <a href="#" className="text-[#ffffff] text-[14px] font-[600] transition-colors hover:text-[#10b981]">Home</a>
          <a href="#faq-section" className="text-[#a1a1aa] text-[14px] font-[600] transition-colors hover:text-[#ffffff]">FAQ</a>
          <a href="#about-section" className="text-[#a1a1aa] text-[14px] font-[600] transition-colors hover:text-[#ffffff]">About</a>
          {hasMedia && (
            <button
              onClick={handleExportBurnedVideo}
              disabled={isExporting}
              className="ml-2 bg-[#10b981] hover:bg-[#059669] text-black font-bold py-1.5 px-4 rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExporting ? `Exporting (${exportProgress}%)` : 'Export Video'}</span>
            </button>
          )}
        </nav>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] w-full mx-auto px-5 py-10 flex-1">
        
        {/* Hero Section */}
        <section className="text-center py-[40px] pb-[60px]" id="landing-hero">
          <h1 className="text-[34px] sm:text-[46px] font-[900] leading-[1.2] mb-[15px] tracking-[-1px] text-white">
            Every word deserves the spotlight.
          </h1>
          <p className="text-[#a1a1aa] text-[15px] sm:text-[17px] max-w-[580px] mx-auto mb-[30px]">
            Turn your media into engaging, easy-to-follow captions. Choose your language, personalize the look, and create a style that feels like yours.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={triggerImport}
              className="bg-[#10b981] hover:bg-[#059669] text-black font-[700] px-8 py-3.5 rounded-lg text-[15px] cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2"
            >
              <span>＋</span> Import Media
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,audio/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Feature Summary Cards (Hidden when workspace is expanded) */}
          {!hasMedia && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-[50px]">
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl text-left hover:border-[#10b981]/50 transition-colors">
                <h3 className="text-[16px] font-bold text-[#10b981] mb-2">✦ AI Caption Generation</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">Prepare your media files for instant audio speech recognition workflow.</p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl text-left hover:border-[#10b981]/50 transition-colors">
                <h3 className="text-[16px] font-bold text-[#10b981] mb-2">文 Multiple Languages</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">Full optimization support for English, Urdu, Roman Urdu, and Arabic scripts.</p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl text-left hover:border-[#10b981]/50 transition-colors">
                <h3 className="text-[16px] font-bold text-[#10b981] mb-2">▣ Visual Caption Styles</h3>
                <p className="text-[13px] text-[#a1a1aa] leading-[1.4]">Easily adapt custom sizing, layout placement, backgrounds, and fonts.</p>
              </div>
            </div>
          )}
        </section>

        {/* Studio Workspace Section */}
        {hasMedia && (
          <section className="border-t border-[#1f1f23] pt-10 mt-5 transition-all duration-500" id="main-studio-workspace">
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

                {/* Video Container */}
                <div
                  ref={videoContainerRef}
                  onTouchStart={handlePreviewTouchStart}
                  onTouchMove={handlePreviewTouchMove}
                  onTouchEnd={handlePreviewTouchEnd}
                  className="relative w-full aspect-[9/16] max-h-[520px] bg-[#050505] rounded-lg border border-[#1f1f23] overflow-hidden flex items-center justify-center group select-none"
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

                  {/* Live Caption Overlay Layer */}
                  {activeCaptionAtCurrentTime && activeCaptionAtCurrentTime.text.trim() && (
                    <div
                      onPointerDown={handleCaptionPointerDown}
                      style={{
                        left: `${captionXPercent}%`,
                        top: `${captionYPercent}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute z-30 max-w-[90%] text-center cursor-move transition-transform duration-75 select-none ${
                        isDraggingCaption ? 'ring-2 ring-[#10b981] ring-offset-2 ring-offset-black rounded px-2 py-1 bg-black/40' : ''
                      }`}
                    >
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
                        className={`font-black tracking-tight leading-tight ${
                          captionStyle === 'Green Highlight' ? 'text-[#10b981]' : ''
                        }`}
                      >
                        {activeCaptionAtCurrentTime.text}
                      </p>
                    </div>
                  )}
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

              {/* Right Panel: Caption Studio Configuration */}
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl flex flex-col gap-5">
                <h2 className="text-[18px] font-bold text-white flex items-center gap-2 pb-2 border-b border-[#1f1f23]">
                  <Sparkles className="w-4 h-4 text-[#10b981]" />
                  <span>Caption Studio Configuration</span>
                </h2>

                {/* Form Row 1: Language */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="caption-language" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Language</label>
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

                {/* Form Row 2: Font Size */}
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

                {/* Form Row 3: Caption Style */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="caption-style" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Style</label>
                  <select
                    id="caption-style"
                    value={captionStyle}
                    onChange={(e) => setCaptionStyle(e.target.value)}
                    className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer"
                  >
                    <option value="Bold Clean">Bold Clean</option>
                    <option value="Minimal">Minimal</option>
                    <option value="White Text with Shadow">White Text with Shadow</option>
                    <option value="Green Highlight">Green Highlight</option>
                  </select>
                </div>

                {/* Form Row 4: Caption Color */}
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

                {/* Form Row 5: Caption Position */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="caption-position" className="text-[13px] font-[600] text-[#a1a1aa]">Caption Position</label>
                  <select
                    id="caption-position"
                    value={captionPosition}
                    onChange={(e) => handlePositionChange(e.target.value)}
                    className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] transition-colors cursor-pointer"
                  >
                    <option value="Bottom">Bottom</option>
                    <option value="Center">Center</option>
                    <option value="Top">Top</option>
                  </select>
                </div>

                {/* Form Row 6: Font Family & Custom Font Upload */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[13px] font-[600] text-[#a1a1aa]">Font Family</label>
                    <button
                      type="button"
                      onClick={() => customFontInputRef.current?.click()}
                      className="text-xs text-[#10b981] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FolderUp className="w-3 h-3" />
                      <span>+ Custom Font</span>
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
                    {allFonts.map((f) => (
                      <option key={f.name} value={f.name}>{f.name} ({f.category})</option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2.5 mt-2 pt-2 border-t border-[#1f1f23]">
                  <button
                    type="button"
                    onClick={handleGenerateCaptions}
                    disabled={isTranscribing}
                    className="flex-1 bg-[#10b981] hover:bg-[#059669] text-black font-[700] py-3.5 px-5 rounded-lg text-[15px] cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Captions</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportBurnedVideo}
                    disabled={isExporting}
                    className="bg-[#151519] hover:bg-[#1f1f23] text-white font-[600] border border-[#1f1f23] hover:border-[#10b981] py-3 px-4 rounded-lg text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-[#10b981]" />}
                    <span>Export Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetStudio}
                    className="bg-[#151519] hover:bg-red-950/40 text-white font-[600] border border-[#1f1f23] hover:border-red-800 py-3 px-4 rounded-lg text-[14px] cursor-pointer transition-colors"
                  >
                    Remove Media
                  </button>
                </div>

                {/* Subtitle File Exports & Copy */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#1f1f23]">
                  <button
                    type="button"
                    onClick={() => handleExportSubtitleFile('srt')}
                    className="flex-1 bg-[#151519] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white text-xs py-2 px-2 rounded-lg font-medium border border-[#1f1f23] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>.SRT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportSubtitleFile('vtt')}
                    className="flex-1 bg-[#151519] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white text-xs py-2 px-2 rounded-lg font-medium border border-[#1f1f23] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>.VTT</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCaptions}
                    className="bg-[#151519] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white text-xs py-2 px-3 rounded-lg font-medium border border-[#1f1f23] flex items-center gap-1 cursor-pointer"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <p className="text-[12px] text-[#a1a1aa] mt-1 leading-[1.5]">
                  Connected to Gemini 2.5 Flash / Hugging Face Whisper API for speech recognition.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* FAQ & About Section */}
        <section className="mt-[80px] border-t border-[#1f1f23] pt-[50px]" id="faq-section">
          <h2 className="text-center text-[26px] font-bold mb-[30px] text-white">Frequently Asked Questions</h2>
          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl mb-[15px]">
            <h3 className="text-[15px] font-semibold mb-1.5 text-white">Can I upload my own video?</h3>
            <p className="text-[13px] text-[#a1a1aa] leading-[1.5]">Yes. Select Import Media to choose any long-form video or audio file up to 1 hour (2GB).</p>
          </div>
          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl mb-[15px]">
            <h3 className="text-[15px] font-semibold mb-1.5 text-white">Which languages are listed?</h3>
            <p className="text-[13px] text-[#a1a1aa] leading-[1.5]">The studio includes full optimization support for English, Urdu, Roman Urdu, Arabic, Hindi, Spanish, and 7+ other languages.</p>
          </div>
          <div className="bg-[#0a0a0c] border border-[#1f1f23] p-5 rounded-xl mb-[15px]" id="about-section">
            <h3 className="text-[15px] font-semibold mb-1.5 text-white">About Caption Free</h3>
            <p className="text-[13px] text-[#a1a1aa] leading-[1.5]">Caption Free is an AI caption studio interface for importing media, generating automatic speech captions, and customizing layout appearance for short-form content.</p>
          </div>
        </section>
      </main>

      {/* Processing Overlay Modal */}
      {(isTranscribing || isExporting) && (
        <div className="fixed inset-0 w-full h-full bg-black/98 z-[1000] flex flex-col justify-center items-center p-4">
          <h2 className="text-2xl font-bold text-white mb-2">
            {isTranscribing ? 'Generating AI Captions...' : 'Exporting Video...'}
          </h2>
          <div className="w-[280px] bg-[#111115] h-[6px] rounded-[3px] my-[20px] overflow-hidden border border-[#1f1f23]">
            <div
              style={{ width: `${isTranscribing ? transcribeProgress : exportProgress}%` }}
              className="h-full bg-[#10b981] transition-all duration-200"
            />
          </div>
          <p className="text-sm text-[#a1a1aa]">
            {isTranscribing ? transcribeStatusText : `Encoding full video duration (${exportProgress}%)`}
          </p>
        </div>
      )}
    </div>
  );
}
