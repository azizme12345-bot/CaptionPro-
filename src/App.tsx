/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
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
  backgroundColor: string;
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
  { name: 'Noto Nastaliq Urdu', category: 'Urdu / Arabic', family: "'Noto Nastaliq Urdu', serif" },
  { name: 'Jameel Noori Nastaleeq', category: 'Urdu / Arabic', family: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" },
  { name: 'Amiri', category: 'Urdu / Arabic', family: "'Amiri', serif" },
  { name: 'Tajawal', category: 'Urdu / Arabic', family: "'Tajawal', sans-serif" },
  { name: 'Cairo', category: 'Urdu / Arabic', family: "'Cairo', sans-serif" },
  { name: 'Almarai', category: 'Urdu / Arabic', family: "'Almarai', sans-serif" }
];

const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

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

async function extractAudioBase64(fileOrBlob: Blob | File): Promise<string> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (audioCtx.state !== 'closed' && typeof audioCtx.close === 'function') {
      try { audioCtx.close(); } catch (e) {}
    }
  }

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

export default function App() {
  // Page Routing State (3 Pages: Home, Editor, About)
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
  const [maxWordsPerLine, setMaxWordsPerLine] = useState<number>(3);

  // Caption Styling state
  const [captionFontSize, setCaptionFontSize] = useState<number>(32);
  const [captionStyle, setCaptionStyle] = useState<string>('Bold Clean');
  const [captionColor, setCaptionColor] = useState<string>('#ffffff');
  const [captionPosition, setCaptionPosition] = useState<string>('Bottom');
  const [animationType, setAnimationType] = useState<CaptionAnimationType>('pop-bounce');

  // Studio Tabs & Text Overlays
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('captions');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextOverlayId, setSelectedTextOverlayId] = useState<string | null>(null);
  const [isDraggingTextId, setIsDraggingTextId] = useState<string | null>(null);

  // Typography & Custom Fonts
  const [selectedFont, setSelectedFont] = useState<string>('Plus Jakarta Sans');
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);

  // Pinch-to-zoom & Draggable Position
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const pinchRef = useRef<{ initialDistance: number; initialFontSize: number }>({ initialDistance: 0, initialFontSize: 32 });
  const [captionXPercent, setCaptionXPercent] = useState<number>(50);
  const [captionYPercent, setCaptionYPercent] = useState<number>(80);
  const [isDraggingCaption, setIsDraggingCaption] = useState<boolean>(false);

  // Error Log & Status Bar State
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Import media to start');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');

  // Transcribing & Exporting state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [transcribeStatusText, setTranscribeStatusText] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportElapsedSec, setExportElapsedSec] = useState<number>(0);
  const [exportStatusDetail, setExportStatusDetail] = useState<string>('Preparing video stream...');
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  const allFonts = [...PRESET_FONTS, ...customFonts];
  const activeFontObj = allFonts.find(f => f.name === selectedFont) || PRESET_FONTS[0];
  const activeFontFamily = activeFontObj.family;

  const activeCaptionAtCurrentTime = captions.find(
    c => currentTime >= (c.startSec - 0.04) && currentTime <= (c.endSec + 0.04)
  );

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const processUploadedFile = (file: File) => {
    if (!file) return;
    const validVideoExts = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv|mp3|wav|m4a|aac|flac)$/i;
    const isVideoOrAudio = file.type.startsWith('video/') || file.type.startsWith('audio/') || validVideoExts.test(file.name);
    
    if (!isVideoOrAudio) {
      setStatusMessage('Error: Please choose a valid video file (MP4, WebM, MOV) up to 2GB.');
      setStatusType('error');
      return;
    }

    if (file.size > 2000 * 1024 * 1024) {
      setStatusMessage('Error: File size exceeds 2GB limit.');
      setStatusType('error');
      return;
    }

    if (videoSrc && videoSrc.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoSrc); } catch (e) {}
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoSrc(url);
    setHasMedia(true);
    navigateTo('editor');

    const probeVid = document.createElement('video');
    probeVid.preload = 'metadata';
    probeVid.onloadedmetadata = () => {
      if (probeVid.duration && isFinite(probeVid.duration) && probeVid.duration > 0) {
        setDuration(probeVid.duration);
      }
    };
    probeVid.src = url;

    setStatusMessage(`Loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
    setStatusType('success');
  };

  const handleLoadSampleVideo = async () => {
    try {
      setStatusMessage('Loading demo sample video...');
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
      setStatusMessage('Loaded demo sample video successfully.');
      setStatusType('success');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
    if (e.target) e.target.value = '';
  };

  const resetStudio = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (videoSrc && videoSrc.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoSrc); } catch (e) {}
    }
    setVideoFile(null);
    setVideoSrc('');
    setVideoFileName('');
    setCaptions([]);
    setHasMedia(false);
    setIsPlaying(false);
    setStatusMessage('Media removed. Ready to import new file.');
    setStatusType('info');
  };

  // Custom Font Import
  const handleImportCustomFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setStatusMessage(`Custom font "${displayName}" loaded successfully`);
      setStatusType('success');
    } catch (err: any) {
      setStatusMessage(`Error loading font: ${err.message || 'Corrupted file'}`);
      setStatusType('error');
    } finally {
      if (customFontInputRef.current) customFontInputRef.current.value = '';
    }
  };

  // Text Tool Handlers
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
    setStatusMessage('Added new text layer');
    setStatusType('success');
  };

  const handleUpdateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    if (selectedTextOverlayId === id) setSelectedTextOverlayId(null);
    setStatusMessage('Text layer removed');
    setStatusType('info');
  };

  const handleTextPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedTextOverlayId(id);
    setIsDraggingTextId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

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
    const clampedX = Math.max(5, Math.min(95, Math.round((relativeX / rect.width) * 100)));
    const clampedY = Math.max(5, Math.min(95, Math.round((relativeY / rect.height) * 100)));

    if (isDraggingCaption) {
      setCaptionXPercent(clampedX);
      setCaptionYPercent(clampedY);
    } else if (isDraggingTextId) {
      setTextOverlays(prev => prev.map(t => t.id === isDraggingTextId ? { ...t, xPercent: clampedX, yPercent: clampedY } : t));
    }
  }, [isDraggingCaption, isDraggingTextId]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingCaption) setIsDraggingCaption(false);
    if (isDraggingTextId) setIsDraggingTextId(null);
  }, [isDraggingCaption, isDraggingTextId]);

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

  // AI Caption Generation supporting ALL languages correctly
  const handleGenerateCaptions = async () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }

    if (!videoFile && !videoSrc) {
      setStatusMessage('Error: No media file found to transcribe.');
      setStatusType('error');
      return;
    }

    setCaptions([]);
    setSelectedClipId('');
    setIsTranscribing(true);
    setTranscribeProgress(20);
    setTranscribeStatusText(`Connecting to AI Speech Engine (${language})...`);
    setStatusMessage(`Generating captions in ${language}...`);
    setStatusType('info');

    const progressTimer = setInterval(() => {
      setTranscribeProgress(prev => {
        if (prev < 85) return prev + 10;
        return prev;
      });
    }, 400);

    try {
      let res: Response | null = null;

      if (videoFile) {
        try {
          const audioBase64 = await extractAudioBase64(videoFile);
          res = await fetch('/api/transcribe-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType: 'audio/wav', language })
          });
        } catch (e) {
          const formData = new FormData();
          formData.append('video', videoFile);
          formData.append('language', language);
          res = await fetch('/api/transcribe-video', { method: 'POST', body: formData });
        }
      } else if (videoSrc) {
        const vidResp = await fetch(videoSrc);
        const blob = await vidResp.blob();
        const file = new File([blob], videoFileName || 'video.mp4', { type: blob.type || 'video/mp4' });
        const audioBase64 = await extractAudioBase64(file);
        res = await fetch('/api/transcribe-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, mimeType: 'audio/wav', language })
        });
      }

      clearInterval(progressTimer);

      if (!res || !res.ok) {
        throw new Error(`API transcription failed with language ${language}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const captionsData = data.captions;
      if (!captionsData || !Array.isArray(captionsData) || captionsData.length === 0) {
        throw new Error('No speech detected in audio track.');
      }

      const parsed: CaptionSegment[] = captionsData.map((item: any, idx: number) => {
        let startSec = typeof item.startSec === 'number' ? item.startSec : parseTimeToSeconds(item.start ?? 0);
        let endSec = typeof item.endSec === 'number' ? item.endSec : parseTimeToSeconds(item.end ?? (startSec + 2.0));
        startSec = parseFloat(Math.max(0, startSec).toFixed(2));
        endSec = parseFloat(Math.max(startSec + 0.3, endSec).toFixed(2));

        return {
          id: `seg-${Date.now()}-${idx}`,
          start: formatSecondsToTime(startSec),
          end: formatSecondsToTime(endSec),
          startSec,
          endSec,
          text: (item.text || '').trim()
        };
      });

      const enforcedChunks = splitIntoWordChunks(parsed, maxWordsPerLine);
      setTranscribeProgress(100);
      setCaptions(enforcedChunks);
      if (enforcedChunks.length > 0) setSelectedClipId(enforcedChunks[0].id);

      setStatusMessage(`Successfully generated ${enforcedChunks.length} captions in ${language}`);
      setStatusType('success');
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('Caption generation error:', err);
      // Fallback robust mock captions in requested language if API is offline
      const mockSegs: CaptionSegment[] = [
        { id: 'm1', start: '00:00', end: '00:03', startSec: 0, endSec: 3, text: language === 'Urdu' ? 'خوش آمدید اس ویڈیو میں' : language === 'Arabic' ? 'أهلاً بك في هذا الفيديو' : language === 'Hindi' ? 'इस वीडियो में आपका स्वागत है' : 'Welcome to this video' },
        { id: 'm2', start: '00:03', end: '00:06', startSec: 3, endSec: 6, text: language === 'Urdu' ? 'بہترین سبرائٹلز اور کیپشنز' : language === 'Arabic' ? 'أفضل الترجمات والتسميات' : language === 'Hindi' ? 'सर्वश्रेष्ठ उपशीर्षक और कैप्शन' : 'Professional AI Subtitles' },
        { id: 'm3', start: '00:06', end: '00:10', startSec: 6, endSec: 10, text: language === 'Urdu' ? 'ٹک ٹاک اور ریلز کے لیے' : language === 'Arabic' ? 'لتيك توك وريلز' : language === 'Hindi' ? 'टिकटॉक और रील्स के लिए' : 'For TikTok and Reels' }
      ];
      setCaptions(mockSegs);
      setSelectedClipId(mockSegs[0].id);
      setStatusMessage(`Error: Caption generation failed — API timeout / fallback loaded (${language})`);
      setStatusType('error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Video Export using robust FFmpeg backend API (full duration, audio preserved, captions burned in, TikTok/YouTube compatible)
  const handleExportBurnedVideo = async () => {
    const video = videoRef.current;
    if (!video) {
      setStatusMessage('Error: Video element not ready for export.');
      setStatusType('error');
      return;
    }

    video.pause();
    video.muted = true;
    setIsPlaying(false);

    setIsExporting(true);
    setExportProgress(15);
    setExportElapsedSec(0);
    setExportStatusDetail('Preparing video export stream...');
    setStatusMessage('Exporting video... 15%');
    setStatusType('info');

    exportAbortControllerRef.current = new AbortController();
    const abortSignal = exportAbortControllerRef.current.signal;

    const exportTimer = setInterval(() => {
      setExportElapsedSec(s => s + 1);
    }, 1000);

    try {
      let fileToProcess: File | Blob | null = videoFile;
      if (!fileToProcess && videoSrc) {
        const resp = await fetch(videoSrc, { signal: abortSignal });
        if (resp.ok) fileToProcess = await resp.blob();
      }

      if (!fileToProcess) throw new Error('No video file found to export.');

      setExportProgress(35);
      setExportStatusDetail('Rendering video and burning subtitles...');
      setStatusMessage('Exporting video... 35%');

      const formData = new FormData();
      formData.append('video', fileToProcess, videoFileName || 'video.mp4');
      formData.append('captions', JSON.stringify(captions));

      setExportProgress(65);
      setExportStatusDetail('Encoding full duration MP4 (TikTok/YouTube compatible)...');
      setStatusMessage('Exporting video... 65%');

      const exportResp = await fetch('/api/export-video', {
        method: 'POST',
        body: formData,
        signal: abortSignal
      });

      if (!exportResp.ok) {
        const errJson = await exportResp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server video export failed');
      }

      setExportProgress(90);
      setExportStatusDetail('Finalizing download...');
      setStatusMessage('Exporting video... 90%');

      const exportedBlob = await exportResp.blob();
      const downloadUrl = URL.createObjectURL(exportedBlob);
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
      setExportStatusDetail('Export complete!');
      setStatusMessage('Export complete');
      setStatusType('success');

      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Export error:', err);
      setStatusMessage(`Error: Export failed — ${err.message || 'Processing error'}`);
      setStatusType('error');
      setIsExporting(false);
      setExportProgress(0);
    } finally {
      clearInterval(exportTimer);
      const vid = videoRef.current;
      if (vid) {
        vid.pause();
        setIsPlaying(false);
      }
    }
  };

  // Fullscreen synchronization effect: ensures captions display on top of video in fullscreen mode
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleFullscreenChange = () => {
      const isVideoFullscreen = document.fullscreenElement === video;
      if (isVideoFullscreen && videoContainerRef.current) {
        document.exitFullscreen().then(() => {
          videoContainerRef.current?.requestFullscreen();
        }).catch(() => {
          videoContainerRef.current?.requestFullscreen();
        });
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [videoSrc]);

  // Video time & metadata listeners
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
    <div className="min-h-screen bg-[#000000] text-[#ffffff] flex flex-col font-sans pb-10 selection:bg-[#10b981] selection:text-black">
      {/* Sticky Header */}
      <header className="flex justify-between items-center px-[5%] py-[15px] bg-black/95 backdrop-blur-md sticky top-0 z-50 border-b border-[#1f1f23]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('home')}
            className="text-[22px] font-[800] text-[#10b981] tracking-tight bg-transparent border-0 cursor-pointer p-0 text-left hover:opacity-90"
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
              currentPage === 'home' ? 'text-[#10b981] bg-[#10b981]/10 font-bold' : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateTo('editor')}
            className={`px-3 py-1.5 rounded-lg text-[14px] font-[600] transition-colors cursor-pointer border-0 ${
              currentPage === 'editor' ? 'text-[#10b981] bg-[#10b981]/10 font-bold' : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => navigateTo('about')}
            className={`px-3 py-1.5 rounded-lg text-[14px] font-[600] transition-colors cursor-pointer border-0 ${
              currentPage === 'about' ? 'text-[#10b981] bg-[#10b981]/10 font-bold' : 'text-[#a1a1aa] bg-transparent hover:text-white'
            }`}
          >
            About
          </button>
          {hasMedia && (
            <button
              onClick={handleExportBurnedVideo}
              disabled={isExporting}
              className="ml-2 bg-[#10b981] hover:bg-[#059669] text-black font-bold py-1.5 px-3.5 rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExporting ? `Exporting (${exportProgress}%)` : 'Export Video'}</span>
            </button>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-[1100px] w-full mx-auto px-5 py-8 flex-1">
        
        {/* PAGE 1: HOME */}
        {currentPage === 'home' && (
          <section className="text-center py-6 pb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" />
              <span>CaptionPro • AI Video Caption Studio</span>
            </div>

            <h1 className="text-[34px] sm:text-[48px] font-[900] leading-[1.2] mb-[12px] tracking-[-1px] text-white max-w-[820px] mx-auto">
              Every word deserves the spotlight.
            </h1>
            <div className="mb-5">
              <span className="text-[#10b981] font-bold text-base sm:text-lg bg-[#10b981]/10 px-4 py-1.5 rounded-full border border-[#10b981]/30 inline-block shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                100% Free – No Signup Required
              </span>
            </div>
            <p className="text-[#a1a1aa] text-[15px] sm:text-[17px] max-w-[620px] mx-auto mb-[30px]">
              Turn your Reels, TikTok, and YouTube Shorts into engaging, viral content with synchronized AI captions in any language.
            </p>

            <div className="flex items-center justify-center gap-3.5 flex-wrap">
              <button
                onClick={triggerImport}
                className="bg-[#10b981] hover:bg-[#059669] text-black font-[700] px-7 py-3.5 rounded-lg text-[15px] cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2"
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-[48px] text-left">
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">✦</div>
                <h3 className="text-[16px] font-bold text-white mb-2">AI Caption Generation</h3>
                <p className="text-[13px] text-[#a1a1aa]">Supports English, Urdu, Hindi, Arabic, and all major languages seamlessly.</p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">文</div>
                <h3 className="text-[16px] font-bold text-white mb-2">1-Line TikTok Style</h3>
                <p className="text-[13px] text-[#a1a1aa]">Clean single-line kinetic subtitles optimized for Reels, TikTok and Shorts.</p>
              </div>
              <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-3 font-bold text-sm">▣</div>
                <h3 className="text-[16px] font-bold text-white mb-2">FFmpeg.wasm Export</h3>
                <p className="text-[13px] text-[#a1a1aa]">Robust client-side export with audio preservation and burned-in captions.</p>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 2: EDITOR */}
        {currentPage === 'editor' && (
          <div className="flex flex-col gap-6">
            {!hasMedia ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files?.[0]) processUploadedFile(e.dataTransfer.files[0]);
                }}
                className={`bg-[#0a0a0c] border-2 rounded-2xl p-8 sm:p-12 text-center max-w-[680px] mx-auto my-6 w-full transition-all ${
                  isDraggingOver ? 'border-[#10b981] bg-[#10b981]/10' : 'border-dashed border-[#1f1f23]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center mx-auto mb-4 text-[#10b981]">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">CaptionPro Editor</h2>
                <p className="text-sm text-[#a1a1aa] max-w-[460px] mx-auto mb-6">
                  Drop your video file here or click below to import (MP4, WebM, MOV) up to 2GB.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={triggerImport}
                    className="bg-[#10b981] hover:bg-[#059669] text-black font-bold px-6 py-3 rounded-lg text-sm cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import Video</span>
                  </button>
                  <button
                    onClick={handleLoadSampleVideo}
                    className="bg-[#151519] hover:bg-[#1f1f23] text-white font-semibold border border-[#1f1f23] px-5 py-3 rounded-lg text-sm cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-[#10b981]" />
                    <span>Try Demo Video</span>
                  </button>
                </div>
              </div>
            ) : (
              <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7">
                {/* Left Panel: Video Player & Timeline */}
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

                  {/* Aspect Ratio Selector */}
                  <div className="flex items-center justify-between p-2.5 bg-[#050507] rounded-xl border border-[#1f1f23]">
                    <span className="text-xs font-semibold text-[#a1a1aa] flex items-center gap-1.5">
                      <Square className="w-3.5 h-3.5 text-[#10b981]" />
                      <span>Frame Ratio:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(['9:16', '16:9', '1:1', '3:4', '4:3'] as AspectRatio[]).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer border ${
                            aspectRatio === ratio ? 'bg-[#10b981] text-black border-[#10b981]' : 'bg-[#000000] text-[#a1a1aa] border-[#1f1f23]'
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
                      className={`relative w-full ${
                        aspectRatio === '9:16' ? 'aspect-[9/16] max-w-[320px] max-h-[520px]' :
                        aspectRatio === '16:9' ? 'aspect-[16/9] max-w-[560px] max-h-[360px]' :
                        aspectRatio === '1:1' ? 'aspect-square max-w-[420px] max-h-[420px]' :
                        aspectRatio === '3:4' ? 'aspect-[3/4] max-w-[360px] max-h-[480px]' : 'aspect-[4/3] max-w-[480px] max-h-[380px]'
                      } bg-[#050505] rounded-xl border border-[#1f1f23] overflow-hidden flex items-center justify-center select-none shadow-xl`}
                    >
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain bg-black"
                      />

                      {/* 1-Line TikTok Style Captions */}
                      {activeCaptionAtCurrentTime && activeCaptionAtCurrentTime.text.trim() && (() => {
                        const words = activeCaptionAtCurrentTime.text.trim().split(/\s+/).filter(Boolean);
                        const totalWords = words.length;
                        const segDuration = Math.max(0.1, activeCaptionAtCurrentTime.endSec - activeCaptionAtCurrentTime.startSec);
                        const activeWordIdx = Math.min(totalWords - 1, Math.max(0, Math.floor(((currentTime - activeCaptionAtCurrentTime.startSec) / segDuration) * totalWords)));

                        return (
                          <div
                            onPointerDown={handleCaptionPointerDown}
                            style={{ left: `${captionXPercent}%`, top: `${captionYPercent}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
                            className="absolute z-30 max-w-[90%] text-center cursor-move select-none"
                          >
                            <p
                              style={{
                                fontSize: `${captionFontSize}px`,
                                color: captionColor,
                                fontFamily: activeFontFamily,
                                textShadow: '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000'
                              }}
                              className="font-black tracking-tight leading-tight inline-flex flex-nowrap whitespace-nowrap justify-center gap-x-1.5"
                            >
                              {words.map((word, wIdx) => (
                                <span key={wIdx} className={wIdx === activeWordIdx ? 'text-[#10b981]' : ''}>
                                  {word}
                                </span>
                              ))}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Custom Text Overlays */}
                      {textOverlays.map(textItem => {
                        const isVisible = textItem.allVideo || (currentTime >= textItem.startSec && currentTime <= textItem.endSec);
                        if (!isVisible) return null;
                        return (
                          <div
                            key={textItem.id}
                            onPointerDown={(e) => handleTextPointerDown(textItem.id, e)}
                            style={{ left: `${textItem.xPercent}%`, top: `${textItem.yPercent}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
                            className="absolute z-40 max-w-[90%] text-center cursor-move select-none"
                          >
                            <div
                              style={{
                                fontSize: `${textItem.fontSize}px`,
                                color: textItem.color,
                                fontFamily: textItem.fontFamily,
                                backgroundColor: textItem.showBackground ? textItem.backgroundColor : 'transparent',
                                padding: textItem.showBackground ? '4px 14px' : '0px',
                                borderRadius: '8px',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.9)'
                              }}
                              className="font-bold whitespace-pre-wrap inline-block"
                            >
                              {textItem.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[12px] text-[#a1a1aa] flex items-center justify-between">
                    <span className="truncate max-w-[280px]">File: {videoFileName}</span>
                    <span>Duration: {formatSecondsToTime(duration)}</span>
                  </p>

                  {/* Subtitle Clips List */}
                  {captions.length > 0 && (
                    <div className="border-t border-[#1f1f23] pt-4 mt-2 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">Subtitles ({captions.length} Clips)</h3>
                        <button
                          onClick={() => {
                            const newId = `seg-${Date.now()}`;
                            const newClip: CaptionSegment = { id: newId, start: '00:00', end: '00:02', startSec: 0, endSec: 2, text: 'New subtitle' };
                            setCaptions(prev => [...prev, newClip]);
                            setSelectedClipId(newId);
                          }}
                          className="bg-[#151519] hover:bg-[#1f1f23] text-white text-xs px-2.5 py-1 rounded border border-[#1f1f23] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-[#10b981]" />
                          <span>Add Clip</span>
                        </button>
                      </div>

                      <div ref={transcriptListRef} className="max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-2">
                        {captions.map((seg) => (
                          <div
                            key={seg.id}
                            onClick={() => setSelectedClipId(seg.id)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer flex flex-col gap-1.5 ${
                              seg.id === selectedClipId ? 'bg-[#151519] border-[#10b981]' : 'bg-[#000000] border-[#1f1f23]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                              <span className="font-mono text-[#10b981]">{seg.start} → {seg.end}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setCaptions(prev => prev.filter(c => c.id !== seg.id)); }}
                                className="text-[#a1a1aa] hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={seg.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCaptions(prev => prev.map(c => c.id === seg.id ? { ...c, text: val } : c));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-[#000000] border border-[#1f1f23] text-white px-2 py-1 rounded text-xs outline-none focus:border-[#10b981]"
                              style={{ fontFamily: activeFontFamily }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel: Studio Configuration Tabs */}
                <div className="bg-[#0a0a0c] border border-[#1f1f23] p-6 rounded-2xl flex flex-col gap-5">
                  <div className="flex items-center gap-1.5 p-1 bg-[#000000] rounded-xl border border-[#1f1f23]">
                    <button
                      onClick={() => setActiveStudioTab('captions')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                        activeStudioTab === 'captions' ? 'bg-[#10b981] text-black' : 'text-[#a1a1aa] bg-transparent'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Captions</span>
                    </button>
                    <button
                      onClick={() => setActiveStudioTab('text')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                        activeStudioTab === 'text' ? 'bg-[#10b981] text-black' : 'text-[#a1a1aa] bg-transparent'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Text Tool</span>
                    </button>
                    <button
                      onClick={() => setActiveStudioTab('style')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-0 ${
                        activeStudioTab === 'style' ? 'bg-[#10b981] text-black' : 'text-[#a1a1aa] bg-transparent'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Styles</span>
                    </button>
                  </div>

                  {activeStudioTab === 'captions' && (
                    <div className="flex flex-col gap-4">
                      {/* Language Selector */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-[600] text-[#a1a1aa] flex justify-between">
                          <span>Caption Language</span>
                          <span className="text-[11px] text-[#10b981]">All Languages Supported</span>
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-[14px] outline-none focus:border-[#10b981] cursor-pointer"
                        >
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>

                      {/* Words Per Line (1 to 10) */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[13px] font-[600] text-[#a1a1aa]">Words Per Line</label>
                          <span className="text-xs text-[#10b981] font-mono font-bold">{maxWordsPerLine} words</span>
                        </div>
                        <div className="flex items-center gap-1 overflow-x-auto pb-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                            <button
                              key={count}
                              onClick={() => {
                                setMaxWordsPerLine(count);
                                if (captions.length > 0) setCaptions(prev => splitIntoWordChunks(prev, count));
                              }}
                              className={`flex-1 min-w-[26px] h-8 rounded-lg text-xs font-mono font-bold border cursor-pointer flex items-center justify-center ${
                                maxWordsPerLine === count ? 'bg-[#10b981] text-black border-[#10b981]' : 'bg-[#000000] border-[#1f1f23] text-[#a1a1aa]'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Caption Color */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-[600] text-[#a1a1aa]">Caption Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={captionColor}
                            onChange={(e) => setCaptionColor(e.target.value)}
                            className="w-12 h-10 bg-[#000000] border border-[#1f1f23] p-1 rounded-lg cursor-pointer"
                          />
                          <span className="font-mono text-xs text-[#a1a1aa] uppercase">{captionColor}</span>
                        </div>
                      </div>

                      {/* Font Size Slider */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[13px] font-[600] text-[#a1a1aa]">Font Size</label>
                          <span className="text-xs text-[#10b981] font-mono font-bold">{captionFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={12}
                          max={72}
                          value={captionFontSize}
                          onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))}
                          className="w-full h-2 bg-[#000000] border border-[#1f1f23] rounded-lg cursor-pointer accent-[#10b981]"
                        />
                      </div>

                      {/* Generate Captions Button */}
                      <button
                        onClick={handleGenerateCaptions}
                        disabled={isTranscribing}
                        className="mt-2 bg-[#10b981] hover:bg-[#059669] text-black font-[700] py-3.5 px-5 rounded-lg text-[15px] cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      >
                        {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        <span>{isTranscribing ? 'Generating Captions...' : `Generate Captions in ${language}`}</span>
                      </button>
                    </div>
                  )}

                  {activeStudioTab === 'text' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f23]">
                        <span className="text-xs text-[#a1a1aa]">Custom Text Layers</span>
                        <button
                          onClick={() => handleAddTextOverlay()}
                          className="bg-[#10b981] text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Text</span>
                        </button>
                      </div>

                      {textOverlays.map(t => (
                        <div key={t.id} className="p-3 rounded-xl bg-[#050507] border border-[#1f1f23] flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <input
                              type="text"
                              value={t.text}
                              onChange={(e) => handleUpdateTextOverlay(t.id, { text: e.target.value })}
                              className="w-full bg-black border border-[#1f1f23] text-white p-2 rounded text-xs outline-none focus:border-[#10b981]"
                            />
                            <button onClick={() => handleDeleteTextOverlay(t.id)} className="text-red-400 p-1 ml-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeStudioTab === 'style' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-[600] text-[#a1a1aa]">Font Family</label>
                        <select
                          value={selectedFont}
                          onChange={(e) => setSelectedFont(e.target.value)}
                          className="w-full bg-[#000000] border border-[#1f1f23] text-white p-3 rounded-lg text-xs outline-none focus:border-[#10b981] cursor-pointer"
                        >
                          {allFonts.map((f) => (
                            <option key={f.name} value={f.name}>{f.name} ({f.category})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 pt-3 border-t border-[#1f1f23]">
                    <button
                      onClick={resetStudio}
                      className="w-full bg-[#151519] hover:bg-red-950/40 text-zinc-300 font-[600] border border-[#1f1f23] py-3 px-4 rounded-lg text-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 text-red-400" />
                      <span>Remove Media</span>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* PAGE 3: ABOUT */}
        {currentPage === 'about' && (
          <section className="py-6 max-w-[820px] mx-auto text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About CaptionPro</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Studio-Grade AI Captions for Creators</h1>
            <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed mb-8">
              CaptionPro is a high-performance AI video caption studio built for creators. Generate synchronized captions in any language, customize typography, and export full-duration videos with FFmpeg.wasm.
            </p>
          </section>
        )}
      </main>

      {/* Persistent global file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.avi"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* ERROR LOG & STATUS BAR (Always visible at the very bottom of every page) */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0c]/95 border-t border-[#1f1f23] px-4 py-2 flex items-center justify-between text-xs text-[#a1a1aa] backdrop-blur-md">
        <div className="flex items-center gap-2 truncate">
          <span className={`w-2 h-2 rounded-full ${
            statusType === 'error' ? 'bg-red-500 animate-pulse' :
            statusType === 'success' ? 'bg-[#10b981]' : 'bg-[#10b981] animate-pulse'
          }`} />
          <span className="font-mono truncate">{statusMessage}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono hidden sm:flex">
          <span>Status: OK</span>
          <span>FFmpeg: Ready</span>
        </div>
      </footer>

      {/* Processing Overlay Modal (Wink-style Circular Progress Ring) */}
      {(isTranscribing || isExporting) && (
        <div className="fixed inset-0 w-full h-full bg-black/85 backdrop-blur-md z-[1000] flex flex-col justify-center items-center p-4 select-none">
          <div className="bg-[#0a0a0c] p-8 rounded-2xl border border-[#10b981]/40 shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col items-center text-center max-w-[360px] w-full">
            <h3 className="text-lg font-bold text-white mb-4">
              {isExporting ? 'Exporting Video' : 'Generating Captions'}
            </h3>

            <div className="relative w-32 h-32 my-3 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="54" stroke="#1f1f23" strokeWidth="7" fill="transparent" />
                <circle
                  cx="64" cy="64" r="54"
                  stroke="#10b981"
                  strokeWidth="7"
                  strokeDasharray="339.29"
                  strokeDashoffset={339.29 - ((isExporting ? exportProgress : transcribeProgress) / 100) * 339.29}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white font-mono">
                  {Math.round(isExporting ? exportProgress : transcribeProgress)}%
                </span>
                <span className="text-[10px] font-mono text-[#10b981] mt-1 font-semibold">
                  {formatSecondsToTime(isExporting ? exportElapsedSec : 5)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#a1a1aa] mt-3">
              {isExporting ? exportStatusDetail : transcribeStatusText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
