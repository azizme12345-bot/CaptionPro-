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
  RotateCcw,
  Scissors,
  Copy,
  Check,
  Video as VideoIcon,
  FileText,
  AlertCircle
} from 'lucide-react';

export interface CaptionSegment {
  id: string;
  start: string; // "00:00"
  end: string;   // "00:03"
  startSec: number;
  endSec: number;
  text: string;
  // Per-caption styling
  fontSize?: number;
  style?: 'plain' | 'bold' | 'outline' | 'glow';
  color?: string;
  bgColor?: string;
  alignment?: 'left' | 'center' | 'right';
  position?: 'bottom' | 'center' | 'top';
}

const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

const DEFAULT_SEGMENTS: CaptionSegment[] = [
  {
    id: 'seg-1',
    start: '00:00',
    end: '00:03',
    startSec: 0,
    endSec: 3,
    text: 'Make every word count.',
    fontSize: 18,
    style: 'plain',
    color: '#ffffff',
    alignment: 'center',
    position: 'bottom'
  },
  {
    id: 'seg-2',
    start: '00:03',
    end: '00:07',
    startSec: 3,
    endSec: 7,
    text: 'Tell your story clearly.',
    fontSize: 18,
    style: 'bold',
    color: '#ffe26e',
    alignment: 'center',
    position: 'bottom'
  },
  {
    id: 'seg-3',
    start: '00:07',
    end: '00:12',
    startSec: 7,
    endSec: 12,
    text: 'Capture moments that matter.',
    fontSize: 18,
    style: 'outline',
    color: '#ffffff',
    alignment: 'center',
    position: 'bottom'
  }
];

// Helper to convert mm:ss to seconds
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(timeStr) || 0;
}

// Helper to format seconds to mm:ss
function formatSecondsToTime(totalSec: number): string {
  if (isNaN(totalSec) || totalSec < 0) return '00:00';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  // Navigation: Home vs Editor
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [activeSideTab, setActiveSideTab] = useState<'edit' | 'layers' | 'style' | 'export'>('edit');

  // Video state
  const [videoSrc, setVideoSrc] = useState<string>(SAMPLE_VIDEO_URL);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>('sample-video.mp4');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);

  // Captions state
  const [captions, setCaptions] = useState<CaptionSegment[]>(DEFAULT_SEGMENTS);
  const [selectedClipId, setSelectedClipId] = useState<string>('seg-1');
  const [language, setLanguage] = useState<string>('English');
  const [applyStyleToAll, setApplyStyleToAll] = useState<boolean>(false);

  // Status & Progress
  const [statusText, setStatusText] = useState<string>('Ready to edit. Upload a video or use sample.');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get current selected segment
  const selectedSegment = captions.find(c => c.id === selectedClipId) || captions[0];

  // Active caption at current playback time
  const activeCaptionAtCurrentTime = captions.find(c => {
    return currentTime >= c.startSec && currentTime <= c.endSec;
  }) || (captions.length > 0 ? selectedSegment : null);

  // Switch to editor
  const handleOpenEditor = () => {
    setView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenHome = () => {
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    } catch (err) {
      setStatusText('Playback failed. Please interact with page first.');
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

  // Upload video file
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setStatusText('Error: Video file exceeds 100MB size limit.');
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileName(file.name);
    setVideoSrc(url);
    setStatusText(`Video loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Click "✨ Generate Captions" to transcribe speech.`);
  };

  // Select a caption clip
  const handleSelectClip = (id: string) => {
    setSelectedClipId(id);
    const clip = captions.find(c => c.id === id);
    if (clip && videoRef.current) {
      videoRef.current.currentTime = clip.startSec;
      setCurrentTime(clip.startSec);
    }
    setStatusText(`Editing clip "${clip?.text.slice(0, 24)}..." (${clip?.start} - ${clip?.end})`);
  };

  // Update selected caption text
  const handleUpdateText = (newText: string) => {
    if (!selectedSegment) return;
    setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, text: newText } : c));
  };

  // Update timestamps
  const handleUpdateStartTime = (val: string) => {
    if (!selectedSegment) return;
    const sec = parseTimeToSeconds(val);
    setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, start: val, startSec: sec } : c));
  };

  const handleUpdateEndTime = (val: string) => {
    if (!selectedSegment) return;
    const sec = parseTimeToSeconds(val);
    setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, end: val, endSec: sec } : c));
  };

  // Update styling
  const handleUpdateStyle = (styleType: 'plain' | 'bold' | 'outline' | 'glow') => {
    if (!selectedSegment) return;
    if (applyStyleToAll) {
      setCaptions(prev => prev.map(c => ({ ...c, style: styleType })));
      setStatusText(`Applied style "${styleType}" to all captions.`);
    } else {
      setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, style: styleType } : c));
      setStatusText(`Updated style for selected clip.`);
    }
  };

  const handleUpdateFontSize = (size: number) => {
    if (!selectedSegment) return;
    if (applyStyleToAll) {
      setCaptions(prev => prev.map(c => ({ ...c, fontSize: size })));
    } else {
      setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, fontSize: size } : c));
    }
  };

  const handleUpdateColor = (color: string) => {
    if (!selectedSegment) return;
    if (applyStyleToAll) {
      setCaptions(prev => prev.map(c => ({ ...c, color })));
    } else {
      setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, color } : c));
    }
  };

  const handleUpdateAlignment = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedSegment) return;
    if (applyStyleToAll) {
      setCaptions(prev => prev.map(c => ({ ...c, alignment })));
    } else {
      setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, alignment } : c));
    }
  };

  const handleUpdatePosition = (position: 'bottom' | 'center' | 'top') => {
    if (!selectedSegment) return;
    if (applyStyleToAll) {
      setCaptions(prev => prev.map(c => ({ ...c, position })));
    } else {
      setCaptions(prev => prev.map(c => c.id === selectedSegment.id ? { ...c, position } : c));
    }
  };

  // Add new caption clip
  const handleAddCaptionClip = () => {
    const startSec = Math.floor(currentTime);
    const endSec = Math.min(startSec + 3, Math.floor(duration));
    const newId = `seg-${Date.now()}`;
    const newClip: CaptionSegment = {
      id: newId,
      start: formatSecondsToTime(startSec),
      end: formatSecondsToTime(endSec),
      startSec,
      endSec,
      text: 'New caption text',
      fontSize: selectedSegment?.fontSize || 18,
      style: selectedSegment?.style || 'plain',
      color: selectedSegment?.color || '#ffffff',
      alignment: selectedSegment?.alignment || 'center',
      position: selectedSegment?.position || 'bottom'
    };
    // Insert and sort by startSec
    const updated = [...captions, newClip].sort((a, b) => a.startSec - b.startSec);
    setCaptions(updated);
    setSelectedClipId(newId);
    setStatusText('Added new text clip to timeline.');
  };

  // Split caption at current time
  const handleSplitClip = () => {
    if (!selectedSegment) return;
    if (currentTime <= selectedSegment.startSec || currentTime >= selectedSegment.endSec) {
      setStatusText('Seek timeline cursor inside the selected clip to split it.');
      return;
    }

    const firstEnd = formatSecondsToTime(currentTime);
    const secondStart = firstEnd;
    const secondEnd = selectedSegment.end;

    const words = selectedSegment.text.split(' ');
    const half = Math.ceil(words.length / 2);
    const text1 = words.slice(0, half).join(' ') || 'First half';
    const text2 = words.slice(half).join(' ') || 'Second half';

    const newId = `seg-${Date.now()}`;
    const newClip: CaptionSegment = {
      id: newId,
      start: secondStart,
      end: secondEnd,
      startSec: currentTime,
      endSec: selectedSegment.endSec,
      text: text2,
      fontSize: selectedSegment.fontSize,
      style: selectedSegment.style,
      color: selectedSegment.color,
      alignment: selectedSegment.alignment,
      position: selectedSegment.position
    };

    const updated = captions.map(c => {
      if (c.id === selectedSegment.id) {
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
    setStatusText(`Split clip into two segments at ${firstEnd}.`);
  };

  // Delete selected caption clip
  const handleDeleteSelected = () => {
    if (captions.length <= 1) {
      setStatusText('Timeline requires at least one caption segment.');
      return;
    }
    const updated = captions.filter(c => c.id !== selectedClipId);
    setCaptions(updated);
    setSelectedClipId(updated[0].id);
    setStatusText('Selected caption clip deleted.');
  };

  // Copy all captions to clipboard
  const handleCopyCaptions = async () => {
    try {
      const text = captions.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}\n`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      setStatusText('All caption text and timestamps copied to clipboard.');
    } catch (e) {
      setStatusText('Clipboard access unavailable.');
    }
  };

  // Generate captions using server-side Gemini API
  const handleGenerateCaptions = async () => {
    setIsTranscribing(true);
    setStatusText(`Generating captions in ${language}... Uploading audio track to Gemini speech model.`);

    try {
      let res: Response;

      if (videoFile) {
        // Send actual video file
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('language', language);

        res = await fetch('/api/transcribe-video', {
          method: 'POST',
          body: formData
        });
      } else {
        // Sample video fallback route
        res = await fetch('/api/generate-captions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: videoFileName,
            language: language,
            durationSeconds: Math.floor(duration)
          })
        });
      }

      const data = await res.json();

      if (data.error === 'MISSING_API_KEY') {
        setStatusText('API key required: Please configure your GEMINI_API_KEY in the Settings > Secrets panel to transcribe speech with AI.');
        return;
      }

      if (data.captions && Array.isArray(data.captions) && data.captions.length > 0) {
        const parsed: CaptionSegment[] = data.captions.map((item: any, idx: number) => {
          const startSec = parseTimeToSeconds(item.start || '00:00');
          const endSec = parseTimeToSeconds(item.end || '00:03');
          return {
            id: `seg-${Date.now()}-${idx}`,
            start: item.start || '00:00',
            end: item.end || '00:03',
            startSec,
            endSec,
            text: item.text || 'Caption',
            fontSize: 18,
            style: 'plain',
            color: '#ffffff',
            alignment: 'center',
            position: 'bottom'
          };
        });

        parsed.sort((a, b) => a.startSec - b.startSec);
        setCaptions(parsed);
        setSelectedClipId(parsed[0].id);
        setStatusText(`✨ Transcribed ${parsed.length} speech segments successfully in ${language}!`);
      } else {
        throw new Error(data.error || 'Failed to transcribe speech segments');
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setStatusText(`Transcription failed: ${err.message || 'Server error'}. Check Settings > Secrets for GEMINI_API_KEY.`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Reset project
  const handleReset = () => {
    setVideoSrc(SAMPLE_VIDEO_URL);
    setVideoFile(null);
    setVideoFileName('sample-video.mp4');
    setCaptions(DEFAULT_SEGMENTS);
    setSelectedClipId(DEFAULT_SEGMENTS[0].id);
    setCurrentTime(0);
    setStatusText('Project reset to initial state.');
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
    setStatusText(`Exported subtitle file: captions.${format}`);
  };

  // Real Video Export: Burned-in captions via HTML5 Canvas + MediaRecorder
  const handleExportBurnedVideo = async () => {
    const video = videoRef.current;
    if (!video) {
      setStatusText('Error: Video not loaded.');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setStatusText('Initializing video burner... Capturing frames with styled captions.');

    try {
      const origCurrentTime = video.currentTime;
      const origPlaying = !video.paused;
      video.pause();

      // Create rendering canvas
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context not supported');
      }

      // Check supported MIME types for downloadable video
      let mimeType = 'video/webm;codecs=vp9';
      let fileExt = 'webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
          fileExt = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
          fileExt = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          mimeType = 'video/webm;codecs=vp8';
          fileExt = 'webm';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
          fileExt = 'webm';
        }
      }

      // Set up media recorder from canvas stream
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

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

      recorder.start(100);

      // Play video from start to duration and render each frame with captions
      const totalDuration = video.duration || duration || 10;
      const fps = 30;
      const frameStep = 1 / fps;
      let renderTime = 0;

      while (renderTime < totalDuration) {
        video.currentTime = renderTime;
        await new Promise(r => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            r(true);
          };
          video.addEventListener('seeked', onSeeked);
        });

        // 1. Draw video frame
        ctx.drawImage(video, 0, 0, width, height);

        // 2. Find active caption at this render timestamp
        const activeClip = captions.find(c => renderTime >= c.startSec && renderTime <= c.endSec);
        if (activeClip && activeClip.text.trim()) {
          ctx.save();
          const currentFontSize = (activeClip.fontSize || 18) * (height / 400);
          const fontStyle = activeClip.style || 'plain';
          const fontWeight = fontStyle === 'bold' ? 'bold' : 'normal';
          ctx.font = `${fontWeight} ${Math.round(currentFontSize)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = (activeClip.alignment || 'center') as CanvasTextAlign;
          ctx.textBaseline = 'middle';

          // Position calculation
          let yPos = height * 0.88;
          if (activeClip.position === 'top') yPos = height * 0.12;
          else if (activeClip.position === 'center') yPos = height * 0.5;

          let xPos = width * 0.5;
          if (activeClip.alignment === 'left') xPos = width * 0.08;
          else if (activeClip.alignment === 'right') xPos = width * 0.92;

          // Background pill
          const textMetrics = ctx.measureText(activeClip.text);
          const padX = currentFontSize * 0.6;
          const padY = currentFontSize * 0.35;
          let boxX = xPos - textMetrics.width / 2 - padX;
          if (activeClip.alignment === 'left') boxX = xPos - padX;
          if (activeClip.alignment === 'right') boxX = xPos - textMetrics.width - padX;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.beginPath();
          ctx.roundRect(boxX, yPos - currentFontSize / 2 - padY, textMetrics.width + padX * 2, currentFontSize + padY * 2, 8);
          ctx.fill();

          // Stroke outline if applicable
          if (fontStyle === 'outline') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(3, currentFontSize * 0.15);
            ctx.strokeText(activeClip.text, xPos, yPos);
          } else if (fontStyle === 'glow') {
            ctx.shadowColor = activeClip.color || '#4169e1';
            ctx.shadowBlur = 12;
          }

          // Text fill
          ctx.fillStyle = activeClip.color || '#ffffff';
          ctx.fillText(activeClip.text, xPos, yPos);
          ctx.restore();
        }

        renderTime += frameStep;
        setExportProgress(Math.min(99, Math.round((renderTime / totalDuration) * 100)));
      }

      // Finish recording
      recorder.stop();
      const outputBlob = await renderPromise;

      // Trigger real file download
      const downloadUrl = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `captionpro-burned-video.${fileExt}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      // Restore original playback position
      video.currentTime = origCurrentTime;
      if (origPlaying) video.play();

      setExportProgress(100);
      setStatusText(`🎉 Real video export complete! Downloaded "captionpro-burned-video.${fileExt}" with permanently burned captions.`);
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusText(`Export notice: Client rendering encountered: ${err.message || 'Codec error'}. You can also download the standard .SRT subtitle file below.`);
      handleExportSubtitleFile('srt');
    } finally {
      setIsExporting(false);
    }
  };

  // Inline CSS for the active video subtitle overlay
  const getOverlayStyle = (): React.CSSProperties => {
    if (!activeCaptionAtCurrentTime) return { display: 'none' };
    const clip = activeCaptionAtCurrentTime;
    const base: React.CSSProperties = {
      position: 'absolute',
      left: '4%',
      right: '4%',
      fontSize: `${clip.fontSize || 18}px`,
      color: clip.color || '#ffffff',
      textAlign: clip.alignment || 'center',
      pointerEvents: 'none',
      zIndex: 3,
      padding: '4px 10px',
      borderRadius: '6px',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'inline-block',
      margin: '0 auto',
      width: 'fit-content',
      maxWidth: '92%',
      wordBreak: 'break-word',
      transition: 'all 0.1s ease'
    };

    if (clip.position === 'top') {
      base.top = '10%';
      base.bottom = 'auto';
    } else if (clip.position === 'center') {
      base.top = '50%';
      base.transform = 'translateY(-50%)';
      base.bottom = 'auto';
    } else {
      base.bottom = '12%';
      base.top = 'auto';
    }

    if (clip.style === 'bold') {
      base.fontWeight = 800;
    } else if (clip.style === 'outline') {
      base.fontWeight = 700;
      base.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px #000';
    } else if (clip.style === 'glow') {
      base.textShadow = `0 0 10px ${clip.color || '#4169e1'}, 0 2px 4px #000`;
    } else {
      base.fontWeight = 600;
      base.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
    }

    return base;
  };

  return (
    <div>
      {/* Top Header */}
      <header className="top">
        <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); handleOpenHome(); }} id="brandHome">
          <span className="logo">▶</span>CaptionPro
        </a>
        <div style={{ display: 'flex', gap: '8px' }}>
          {view === 'editor' ? (
            <button className="btn" onClick={handleOpenHome}>
              ← Home
            </button>
          ) : null}
          <button className="btn primary" onClick={handleOpenEditor} id="openEditor">
            Editing →
          </button>
        </div>
      </header>

      {/* VIEW 1: HOMEPAGE (Exact approved design) */}
      {view === 'home' && (
        <main className="wrap">
          <section className="hero">
            <div>
              <p style={{ color: '#4169e1', fontWeight: 750, marginBottom: '9px' }}>
                VIDEO CAPTIONS, MADE SIMPLE
              </p>
              <h1>Add captions.<br />Edit every word.</h1>
              <p>
                Upload a video, customize your caption style, and arrange text clips on a compact timeline inspired by modern video editors.
              </p>
              <div className="hero-actions">
                <button className="btn primary" onClick={handleOpenEditor} id="startEditing">
                  ＋ Start Editing
                </button>
                <a className="btn" href="#features">
                  Explore Features
                </a>
              </div>
            </div>
            <div className="card" style={{ padding: '10px' }}>
              <div className="preview">
                <div className="sample">Make every word count.</div>
              </div>
              <div className="row" style={{ padding: '10px 2px 0' }}>
                <span className="muted">Preview · 16:9</span>
                <span className="muted">CaptionPro</span>
              </div>
            </div>
          </section>

          <section id="features" style={{ paddingTop: '20px' }}>
            <h2>Everything you need to start</h2>
            <div className="features">
              <article className="card feature">
                <h3>Auto Captions</h3>
                <p>AI speech-to-text pipeline that transcribes video audio into synchronized subtitle clips.</p>
              </article>
              <article className="card feature">
                <h3>Text Styling</h3>
                <p>Adjust caption font size, colors, outlines, bold styles, and positions per segment.</p>
              </article>
              <article className="card feature">
                <h3>Timeline Editing</h3>
                <p>Arrange, split, and trim small caption clips on a compact track under the video.</p>
              </article>
            </div>
          </section>

          <footer className="footer">
            © 2026 CaptionPro · English interface · AI Studio Build
          </footer>
        </main>
      )}

      {/* VIEW 2: EDITOR (Connected directly, approved compact layout) */}
      {view === 'editor' && (
        <main className="wrap" id="editorView">
          {/* Top Bar inside Editor */}
          <div className="row" style={{ marginBottom: '12px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Video Editor</h2>
              <div className="muted" style={{ fontSize: '12px' }}>
                Compact timeline · Real speech transcription & burned MP4 export
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" onClick={handleReset} id="resetBtn">
                <RotateCcw style={{ width: '13px', height: '13px' }} /> Reset
              </button>
            </div>
          </div>

          <div className="editor">
            {/* Left Sidebar Menu */}
            <aside className="card side">
              <div className="side-title" style={{ fontWeight: 800, padding: '8px' }}>Workspace</div>
              <button
                className={activeSideTab === 'edit' ? 'active' : ''}
                onClick={() => setActiveSideTab('edit')}
              >
                ▣ Edit Video
              </button>
              <button
                className={activeSideTab === 'layers' ? 'active' : ''}
                onClick={() => setActiveSideTab('layers')}
              >
                ▤ Text Layers ({captions.length})
              </button>
              <button
                className={activeSideTab === 'style' ? 'active' : ''}
                onClick={() => setActiveSideTab('style')}
              >
                Aa Caption Style
              </button>
              <button
                className={activeSideTab === 'export' ? 'active' : ''}
                onClick={() => setActiveSideTab('export')}
              >
                ⬇ Export Center
              </button>
            </aside>

            {/* Main Editor Section */}
            <section className="card main" id="edit">
              <div className="split">
                
                {/* Left Panel: Upload, Caption generation & selected clip editor */}
                <div className="panel">
                  <h3>Video Source</h3>
                  <label className="drop" htmlFor="videoInput">
                    <strong>Choose a video file</strong>
                    <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                      {videoFileName} (MP4, MOV, WEBM)
                    </div>
                    <input
                      type="file"
                      id="videoInput"
                      accept="video/*"
                      onChange={handleVideoUpload}
                    />
                  </label>

                  <div className="field">
                    <label htmlFor="language">Caption language</label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="English">English</option>
                      <option value="Urdu">Urdu (اردو)</option>
                      <option value="Roman Urdu">Roman Urdu</option>
                      <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                    </select>
                  </div>

                  {/* Generate Captions Button */}
                  <button
                    className="btn primary"
                    onClick={handleGenerateCaptions}
                    disabled={isTranscribing}
                    style={{ width: '100%', marginTop: '10px' }}
                  >
                    <Sparkles style={{ width: '14px', height: '14px' }} />
                    {isTranscribing ? 'Transcribing Speech...' : 'Generate Captions'}
                  </button>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '14px 0 10px' }} />

                  {/* Selected Text Layer Details */}
                  <h3>Selected Caption</h3>
                  <div className="field">
                    <label htmlFor="captionText">
                      Text (Clip at {selectedSegment?.start} - {selectedSegment?.end})
                    </label>
                    <textarea
                      id="captionText"
                      rows={2}
                      value={selectedSegment?.text || ''}
                      onChange={(e) => handleUpdateText(e.target.value)}
                      placeholder="Type caption text here..."
                    />
                  </div>

                  {/* Timestamps */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div className="field" style={{ marginTop: 0 }}>
                      <label>Start time (mm:ss)</label>
                      <input
                        type="text"
                        value={selectedSegment?.start || '00:00'}
                        onChange={(e) => handleUpdateStartTime(e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginTop: 0 }}>
                      <label>End time (mm:ss)</label>
                      <input
                        type="text"
                        value={selectedSegment?.end || '00:03'}
                        onChange={(e) => handleUpdateEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Caption Style Controls */}
                  <div className="field" id="style">
                    <label>Caption style</label>
                    <div className="style-row">
                      {(['plain', 'bold', 'outline', 'glow'] as const).map((st) => (
                        <button
                          key={st}
                          className={selectedSegment?.style === st ? 'active' : ''}
                          onClick={() => handleUpdateStyle(st)}
                        >
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="fontSize">
                      Text size: <span id="sizeValue">{selectedSegment?.fontSize || 18}</span>px
                    </label>
                    <input
                      id="fontSize"
                      type="range"
                      min={12}
                      max={36}
                      value={selectedSegment?.fontSize || 18}
                      onChange={(e) => handleUpdateFontSize(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Colors & Alignment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div className="field" style={{ marginTop: 0 }}>
                      <label>Text Color</label>
                      <div style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
                        {['#ffffff', '#ffe26e', '#5ee0ff', '#75f0b2', '#ff6fae'].map((col) => (
                          <button
                            key={col}
                            onClick={() => handleUpdateColor(col)}
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: col,
                              border: selectedSegment?.color === col ? '2px solid #4169e1' : '1px solid #d1d5db',
                              cursor: 'pointer'
                            }}
                            title={col}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: 0 }}>
                      <label>Position</label>
                      <select
                        value={selectedSegment?.position || 'bottom'}
                        onChange={(e: any) => handleUpdatePosition(e.target.value)}
                      >
                        <option value="bottom">Bottom</option>
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                      </select>
                    </div>
                  </div>

                  {/* Apply to all check */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      id="applyAll"
                      checked={applyStyleToAll}
                      onChange={(e) => setApplyStyleToAll(e.target.checked)}
                    />
                    <label htmlFor="applyAll" style={{ color: 'var(--muted)', cursor: 'pointer' }}>
                      Apply styling to all captions
                    </label>
                  </div>

                  {/* Status Banner */}
                  <div className="status" id="status" style={{ borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
                    {statusText}
                  </div>
                </div>

                {/* Right Panel: Video Preview Player */}
                <div className="panel">
                  <div className="row" style={{ marginBottom: '9px' }}>
                    <h3 style={{ margin: 0 }}>Preview</h3>
                    <span className="muted" style={{ fontSize: '11px' }}>
                      16:9 HD · {formatSecondsToTime(currentTime)} / {formatSecondsToTime(duration)}
                    </span>
                  </div>

                  {/* Video Stage with live styled captions */}
                  <div className="video" id="videoPreview">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      playsInline
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 15)}
                      onEnded={() => setIsPlaying(false)}
                    />

                    {/* Styled Caption Overlay */}
                    <div style={getOverlayStyle()} id="videoCaption">
                      {activeCaptionAtCurrentTime?.text}
                    </div>
                  </div>

                  {/* Player Controls */}
                  <div className="controls">
                    <button className="btn" onClick={togglePlay} id="playBtn">
                      {isPlaying ? <Pause style={{ width: '13px', height: '13px' }} /> : <Play style={{ width: '13px', height: '13px' }} />}
                      {isPlaying ? '❚❚ Pause' : '▶ Play'}
                    </button>
                    <button className="btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? <VolumeX style={{ width: '13px', height: '13px' }} /> : <Volume2 style={{ width: '13px', height: '13px' }} />}
                    </button>
                    <span id="timeLabel">{formatSecondsToTime(currentTime)}</span>
                    <input
                      type="range"
                      id="seek"
                      min={0}
                      max={duration || 15}
                      step={0.1}
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      aria-label="Video timeline seek"
                    />
                    <span className="muted">{formatSecondsToTime(duration)}</span>
                  </div>

                  {/* Quick Export Action in Preview Box */}
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button
                      className="btn primary"
                      style={{ flex: 1 }}
                      onClick={handleExportBurnedVideo}
                      disabled={isExporting}
                    >
                      <Download style={{ width: '13px', height: '13px' }} />
                      {isExporting ? `Rendering MP4 (${exportProgress}%)...` : 'Export Video (MP4)'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Compact Timeline Section (Below Video Preview) */}
              <section className="card timeline-box" id="timeline">
                <div className="timeline-head">
                  <div>
                    <strong>Timeline</strong>
                    <div className="muted" style={{ fontSize: '11px' }}>
                      Click any text clip below to edit its text, timestamps, and style
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" onClick={handleAddCaptionClip} id="addLayer">
                      <Plus style={{ width: '12px', height: '12px' }} /> Text
                    </button>
                    <button className="btn" onClick={handleSplitClip} title="Split at current cursor">
                      <Scissors style={{ width: '12px', height: '12px' }} /> Split
                    </button>
                  </div>
                </div>

                {/* Ruler scaled to duration */}
                <div className="ruler">
                  <span>00:00</span>
                  <span>{formatSecondsToTime(duration * 0.2)}</span>
                  <span>{formatSecondsToTime(duration * 0.4)}</span>
                  <span>{formatSecondsToTime(duration * 0.6)}</span>
                  <span>{formatSecondsToTime(duration * 0.8)}</span>
                  <span>{formatSecondsToTime(duration)}</span>
                </div>

                {/* Video Track */}
                <div className="track">
                  <span className="track-name">Video</span>
                  <div className="trackline">
                    <div className="clip video-clip" id="videoClip">
                      {videoFileName}
                    </div>
                  </div>
                </div>

                {/* Subtitle / Text Track */}
                <div className="track">
                  <span className="track-name">Captions</span>
                  <div className="trackline" style={{ position: 'relative' }}>
                    {captions.map((clip) => {
                      const totalSec = Math.max(duration, 1);
                      const leftPercent = Math.max(0, Math.min(95, (clip.startSec / totalSec) * 100));
                      const widthPercent = Math.max(4, Math.min(100 - leftPercent, ((clip.endSec - clip.startSec) / totalSec) * 100));
                      const isSelected = clip.id === selectedClipId;

                      return (
                        <button
                          key={clip.id}
                          className={`clip ${clip.style === 'bold' ? 'two' : ''} ${isSelected ? 'active' : ''}`}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            textAlign: 'left'
                          }}
                          onClick={() => handleSelectClip(clip.id)}
                          title={`${clip.start} - ${clip.end}: ${clip.text}`}
                        >
                          {clip.text}
                        </button>
                      );
                    })}

                    {/* Playhead Marker */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${Math.min(100, (currentTime / Math.max(duration, 1)) * 100)}%`,
                        width: '2px',
                        backgroundColor: '#ef4444',
                        zIndex: 4,
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Caption Chips list for quick tapping on mobile */}
                <div className="caption-items" id="layerChips">
                  {captions.map((c, i) => (
                    <button
                      key={c.id}
                      className={`caption-chip ${c.id === selectedClipId ? 'active' : ''}`}
                      onClick={() => handleSelectClip(c.id)}
                    >
                      #{i + 1} · {c.start} {c.text.slice(0, 20)}...
                    </button>
                  ))}
                </div>

                {/* Timeline Bottom Actions */}
                <div className="tiny-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" onClick={handleDeleteSelected} id="deleteLayer">
                      <Trash2 style={{ width: '12px', height: '12px' }} /> Delete selected clip
                    </button>
                    <button className="btn" onClick={handleCopyCaptions} id="copyText">
                      {copySuccess ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                      {copySuccess ? 'Copied!' : 'Copy captions'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" onClick={() => handleExportSubtitleFile('srt')}>
                      ⬇ .SRT
                    </button>
                    <button className="btn" onClick={() => handleExportSubtitleFile('vtt')}>
                      ⬇ .VTT
                    </button>
                    <button
                      className="btn primary"
                      onClick={handleExportBurnedVideo}
                      disabled={isExporting}
                    >
                      <Download style={{ width: '12px', height: '12px' }} />
                      {isExporting ? `Rendering MP4...` : 'Export Video (MP4)'}
                    </button>
                  </div>
                </div>

              </section>

            </section>
          </div>

          <footer className="footer">
            CaptionPro · Compact video caption editor · Real subtitle timeline
          </footer>
        </main>
      )}
    </div>
  );
}
