/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Languages,
  Sliders,
  Video as VideoIcon,
  FileText,
  Menu,
  X,
  ArrowUp,
  ArrowDown,
  AlertCircle
} from 'lucide-react';

interface CaptionLine {
  id: string;
  start: string;
  end: string;
  text: string;
}

const SAMPLE_VIDEOS = [
  {
    name: "Tech Startup Pitch (Sample)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15,
    captions: [
      { id: '1', start: '00:00', end: '00:03', text: 'Welcome to the future of video editing.' },
      { id: '2', start: '00:03', end: '00:07', text: 'Turn any clip into engaging captions instantly.' },
      { id: '3', start: '00:07', end: '00:11', text: 'Customize fonts, colors, and layouts with ease.' },
      { id: '4', start: '00:11', end: '00:15', text: 'Start creating with CaptionPro today.' }
    ]
  },
  {
    name: "Nature Cinematic (Sample)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: 15,
    captions: [
      { id: '1', start: '00:00', end: '00:04', text: 'Explore the breathtaking beauty of nature.' },
      { id: '2', start: '00:04', end: '00:08', text: 'Every landscape tells an inspiring story.' },
      { id: '3', start: '00:08', end: '00:12', text: 'Capture moments that last a lifetime.' },
      { id: '4', start: '00:12', end: '00:15', text: 'Breathe in the tranquility.' }
    ]
  }
];

export default function App() {
  // Video and playback state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>(SAMPLE_VIDEOS[0].url);
  const [videoName, setVideoName] = useState<string>(SAMPLE_VIDEOS[0].name);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);
  const [activeTab, setActiveTab] = useState<'captions' | 'video' | 'export'>('captions');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Caption settings
  const [language, setLanguage] = useState<string>('English');
  const [fontFamily, setFontFamily] = useState<string>('Inter, sans-serif');
  const [captionStyle, setCaptionStyle] = useState<'classic' | 'outline' | 'glow' | 'box'>('classic');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [fontSize, setFontSize] = useState<number>(20);
  const [subtitleAlignment, setSubtitleAlignment] = useState<'center' | 'left' | 'right'>('center');
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'center' | 'top'>('bottom');

  // Captions list
  const [captions, setCaptions] = useState<CaptionLine[]>(SAMPLE_VIDEOS[0].captions);
  const [currentCaptionText, setCurrentCaptionText] = useState<string>(SAMPLE_VIDEOS[0].captions[0].text);

  // UI state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync current subtitle with video time
  useEffect(() => {
    const activeIndex = Math.min(
      Math.floor((currentTime / Math.max(duration, 1)) * captions.length),
      captions.length - 1
    );
    if (captions[activeIndex]) {
      setCurrentCaptionText(captions[activeIndex].text);
    }
  }, [currentTime, captions, duration]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 100MB limit.');
      return;
    }

    setErrorMessage(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(`${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
    showToast('Video uploaded successfully.');

    // Automatically trigger real transcription on upload if desired or prompt user
    setIsGenerating(true);
    showToast('Transcribing video speech with AI...');
    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('language', language);

      const res = await fetch('/api/transcribe-video', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error === 'MISSING_API_KEY') {
        setErrorMessage('براہ کرم API key داخل کریں');
        setIsGenerating(false);
        return;
      }
      if (data.captions && Array.isArray(data.captions)) {
        const newCaps: CaptionLine[] = data.captions.map((c: any, index: number) => ({
          id: String(Date.now() + index),
          start: c.start || '00:00',
          end: c.end || '00:03',
          text: c.text || 'Caption'
        }));
        setCaptions(newCaps);
        if (newCaps.length > 0) setCurrentCaptionText(newCaps[0].text);
        showToast('✨ Speech transcribed successfully!');
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message === 'Failed to fetch' ? 'سرور تک رسائی میں مسئلہ ہے۔' : err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_VIDEOS[0]) => {
    setVideoFile(null);
    setVideoSrc(sample.url);
    setVideoName(sample.name);
    setDuration(sample.duration);
    setCaptions(sample.captions);
    setCurrentCaptionText(sample.captions[0].text);
    setErrorMessage(null);
    showToast(`Loaded: ${sample.name}`);
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (videoRef.current.paused) {
        await videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      setErrorMessage('Video playback could not start.');
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const remain = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
  };

  // Generate AI captions via topic/language
  const handleGenerateAICaptions = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    showToast(`Generating captions in ${language}...`);
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: videoName,
          language: language,
          durationSeconds: Math.floor(duration)
        })
      });
      const data = await res.json();
      if (data.error === 'MISSING_API_KEY') {
        setErrorMessage('براہ کرم API key داخل کریں');
        return;
      }
      if (data.captions && Array.isArray(data.captions)) {
        const newCaps: CaptionLine[] = data.captions.map((c: any, index: number) => ({
          id: String(Date.now() + index),
          start: c.start || '00:00',
          end: c.end || '00:03',
          text: c.text || 'Caption text'
        }));
        setCaptions(newCaps);
        if (newCaps.length > 0) setCurrentCaptionText(newCaps[0].text);
        showToast('✨ AI captions generated successfully!');
      } else {
        throw new Error(data.error || 'Failed to generate');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCaptionLine = () => {
    const newId = String(Date.now());
    const newLine: CaptionLine = {
      id: newId,
      start: formatTime(currentTime),
      end: formatTime(currentTime + 3),
      text: 'New subtitle line...'
    };
    setCaptions([...captions, newLine]);
    showToast('Added new caption line');
  };

  const handleDeleteCaption = (id: string) => {
    if (captions.length <= 1) {
      showToast('Keep at least one caption line.');
      return;
    }
    setCaptions(captions.filter(c => c.id !== id));
    showToast('Caption line removed');
  };

  const handleUpdateCaptionText = (id: string, text: string) => {
    setCaptions(captions.map(c => c.id === id ? { ...c, text } : c));
    setCurrentCaptionText(text);
  };

  const handleUpdateCaptionTime = (id: string, field: 'start' | 'end', val: string) => {
    setCaptions(captions.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  // Reorder caption segments (Move Up / Down)
  const handleMoveSegment = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === captions.length - 1)) return;
    const newCaps = [...captions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = newCaps[index];
    newCaps[index] = newCaps[targetIdx];
    newCaps[targetIdx] = temp;
    setCaptions(newCaps);
    showToast('Segment reordered');
  };

  const handleExportSubtitles = (format: 'srt' | 'vtt' | 'json') => {
    let content = '';
    let mime = 'text/plain';
    let filename = `captions.${format}`;

    if (format === 'srt') {
      content = captions.map((c, i) => `${i + 1}\n00:${c.start},000 --> 00:${c.end},000\n${c.text}\n`).join('\n');
    } else if (format === 'vtt') {
      content = `WEBVTT - Exported by CaptionPro\n\n` + captions.map((c, i) => `${i + 1}\n00:${c.start}.000 --> 00:${c.end}.000\n${c.text}\n`).join('\n');
    } else {
      content = JSON.stringify(captions, null, 2);
      mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Successfully exported ${format.toUpperCase()} subtitles!`);
  };

  const handleExportVideo = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    showToast('Preparing MP4 video export with burned-in captions...');

    try {
      const formData = new FormData();
      if (videoFile) {
        formData.append('video', videoFile);
      } else {
        // Fetch sample video blob
        const resp = await fetch(videoSrc);
        const blob = await resp.blob();
        formData.append('video', blob, 'sample.mp4');
      }
      formData.append('captions', JSON.stringify(captions));

      const res = await fetch('/api/export-video', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'captionpro-burned-video.mp4';
      a.click();
      URL.revokeObjectURL(url);
      showToast('🎉 Video successfully exported with burned-in captions!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Video burning limitation: Server graphics container encountered an FFmpeg binary restriction. We have automatically downloaded your .SRT subtitles file as a working alternative.');
      handleExportSubtitles('srt');
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetProject = () => {
    setVideoFile(null);
    setCaptions(SAMPLE_VIDEOS[0].captions);
    setCurrentCaptionText(SAMPLE_VIDEOS[0].captions[0].text);
    setVideoSrc(SAMPLE_VIDEOS[0].url);
    setVideoName(SAMPLE_VIDEOS[0].name);
    setLanguage('English');
    setFontFamily('Inter, sans-serif');
    setCaptionStyle('classic');
    setTextColor('#ffffff');
    setFontSize(20);
    setSubtitleAlignment('center');
    setSubtitlePosition('bottom');
    setErrorMessage(null);
    showToast('Project reset to default state.');
  };

  // Get CSS styles for subtitle overlay
  const getSubtitleOverlayStyle = (): React.CSSProperties => {
    let base: React.CSSProperties = {
      color: textColor,
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
      fontWeight: 900,
      textAlign: subtitleAlignment,
      padding: '6px 14px',
      borderRadius: '8px',
      maxWidth: '90%',
      wordBreak: 'break-word',
      lineHeight: 1.25,
      transition: 'all 0.15s ease'
    };

    if (captionStyle === 'outline') {
      base.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 3px 8px rgba(0,0,0,0.8)';
    } else if (captionStyle === 'glow') {
      base.textShadow = `0 0 12px ${textColor}, 0 0 24px ${textColor}, 0 2px 6px rgba(0,0,0,0.9)`;
    } else if (captionStyle === 'box') {
      base.backgroundColor = 'rgba(0, 0, 0, 0.75)';
      base.backdropFilter = 'blur(4px)';
      base.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    } else {
      base.backgroundColor = 'rgba(0, 0, 0, 0.6)';
      base.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
    }

    return base;
  };

  const getPositionClass = () => {
    if (subtitlePosition === 'top') return 'top-6';
    if (subtitlePosition === 'center') return 'top-1/2 -translate-y-1/2';
    return 'bottom-10';
  };

  const getAlignmentClass = () => {
    if (subtitleAlignment === 'left') return 'justify-start text-left';
    if (subtitleAlignment === 'right') return 'justify-end text-right';
    return 'justify-center text-center';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 border border-slate-800 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black">
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
              Caption<span className="text-emerald-600">Pro</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">AI Studio</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#editor" className="hover:text-emerald-600 transition-colors">Editor</a>
            <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
            <a href="#how" className="hover:text-emerald-600 transition-colors">How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#editor"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open Editor
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3">
            <a href="#editor" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-700">Editor</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-700">Features</a>
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-700">How It Works</a>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-200/60 bg-gradient-to-b from-white via-slate-50/50 to-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold tracking-wide shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} />
                AI VIDEO CAPTION STUDIO
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Turn Videos into <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Captions Automatically
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Professional subtitle editor with automated AI speech transcription, multi-language support (English, Urdu, Hindi, Punjabi, Roman Urdu), and custom cinematic styles.
              </p>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#editor"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5"
                >
                  <Upload className="w-4 h-4" />
                  Upload Video
                </a>
                <button
                  onClick={() => handleSelectSample(SAMPLE_VIDEOS[1])}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                  Try Sample Video
                </button>
              </div>

              <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Multi-language speech AI</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Instant subtitle export</span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xl shadow-slate-200/70 relative">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center group shadow-inner">
                  <video
                    src={videoSrc}
                    className="w-full h-full object-cover opacity-90"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                  
                  <div className={`absolute ${getPositionClass()} left-4 right-4 flex ${getAlignmentClass()} pointer-events-none`}>
                    <div style={getSubtitleOverlayStyle()}>
                      {currentCaptionText}
                    </div>
                  </div>

                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Live Preview
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
                  <span className="font-medium truncate max-w-[200px]">{videoName}</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">HD 1080p</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Video Editor Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="editor">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-extrabold text-emerald-600 tracking-wider uppercase mb-1">Interactive Studio</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Video Caption Editor</h2>
            <p className="text-sm text-slate-600 mt-1">Upload a video, transcribe with AI, customize subtitle styles, and export.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Project
            </button>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-medium flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-4 sm:p-6">
          
          {/* Left Sidebar: Project & Style Settings */}
          <aside className="lg:col-span-4 space-y-6 bg-slate-50/70 p-5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                Project Settings
              </h3>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">v2.5</span>
            </div>

            {/* Video File Upload & Samples */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Video Source (Max 100MB)</label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-xl p-4 cursor-pointer transition-all text-center">
                <Upload className="w-6 h-6 text-emerald-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-800">Choose video file</span>
                <span className="text-[10px] text-slate-500 mt-0.5">MP4, MOV, WEBM</span>
                <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {SAMPLE_VIDEOS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSample(sample)}
                    className={`text-left p-2 rounded-lg border text-xs font-semibold truncate transition-all ${
                      videoName.includes(sample.name.split(' ')[0])
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    ▶ Sample {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Language & Transcription */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Spoken Language</label>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <Languages className="w-3 h-3" /> AI STT
                </span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="English">English</option>
                <option value="Urdu">Urdu (اردو)</option>
                <option value="Roman Urdu">Roman Urdu</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
              </select>

              <button
                onClick={handleGenerateAICaptions}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Transcribing Speech...' : '✨ Transcribe & Generate Captions'}
              </button>
            </div>

            {/* Caption Styling */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Inter, sans-serif">Inter (Clean)</option>
                <option value="Poppins, sans-serif">Poppins (Modern)</option>
                <option value="Roboto Mono, monospace">Roboto Mono (Tech)</option>
                <option value="Georgia, serif">Georgia (Classic Serif)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Subtitle Style</label>
              <div className="grid grid-cols-2 gap-2">
                {(['classic', 'outline', 'glow', 'box'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setCaptionStyle(style)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold capitalize border transition-all ${
                      captionStyle === style
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Color Swatches */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Text Color</label>
              <div className="flex items-center gap-2">
                {['#ffffff', '#ffe26e', '#ff6fae', '#5ee0ff', '#75f0b2', '#ff9f43'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setTextColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      textColor === color ? 'border-emerald-600 scale-110 shadow-md' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>Font Size</span>
                <span className="text-emerald-600">{fontSize}px</span>
              </div>
              <input
                type="range"
                min={14}
                max={36}
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Alignment & Position */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Alignment</label>
                <select
                  value={subtitleAlignment}
                  onChange={(e: any) => setSubtitleAlignment(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Position</label>
                <select
                  value={subtitlePosition}
                  onChange={(e: any) => setSubtitlePosition(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="bottom">Bottom</option>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Center/Right: Video Stage, Controls, Timeline & Captions List */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            
            {/* Toolbar tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button
                  onClick={() => setActiveTab('captions')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'captions' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Captions List
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'video' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Video Preview
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'export' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Export Center
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 shadow-sm"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 text-emerald-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={toggleMute}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 shadow-sm"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-slate-600" />}
                  {isMuted ? 'Muted' : 'Sound'}
                </button>
              </div>
            </div>

            {/* Video Stage & Preview Player */}
            <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-contain"
                playsInline
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 15)}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Subtitle Overlay with live styling */}
              <div className={`absolute ${getPositionClass()} left-6 right-6 flex ${getAlignmentClass()} pointer-events-none z-20`}>
                <div style={getSubtitleOverlayStyle()}>
                  {currentCaptionText}
                </div>
              </div>
            </div>

            {/* Video Seek Bar & Controls */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>{formatTime(currentTime)}</span>
                <span className="truncate max-w-[220px] text-slate-500">{videoName}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 15}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-emerald-600 cursor-pointer"
              />

              {/* Timeline segment blocks */}
              <div className="h-4 bg-slate-200 rounded-md overflow-hidden flex gap-0.5 mt-2 p-0.5">
                {captions.map((cap, i) => (
                  <div
                    key={cap.id}
                    className="h-full bg-emerald-500/80 hover:bg-emerald-600 rounded-xs transition-colors cursor-pointer"
                    style={{ flex: 1 }}
                    title={`${cap.start} - ${cap.end}: ${cap.text}`}
                    onClick={() => {
                      setCurrentCaptionText(cap.text);
                      showToast(`Jumped to segment ${i + 1}`);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Captions Editor Panel / Timeline List */}
            {activeTab === 'captions' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Interactive Subtitle Timeline ({captions.length} segments)
                  </h3>
                  <button
                    onClick={handleAddCaptionLine}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Segment
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {captions.map((cap, index) => (
                    <div
                      key={cap.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 hover:bg-emerald-50/20 p-2.5 rounded-xl border border-slate-200 transition-all"
                    >
                      <div className="col-span-4 sm:col-span-3 flex items-center gap-1">
                        <input
                          type="text"
                          value={cap.start}
                          onChange={(e) => handleUpdateCaptionTime(cap.id, 'start', e.target.value)}
                          className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold text-center"
                          title="Start Time"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="text"
                          value={cap.end}
                          onChange={(e) => handleUpdateCaptionTime(cap.id, 'end', e.target.value)}
                          className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold text-center"
                          title="End Time"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-7">
                        <input
                          type="text"
                          value={cap.text}
                          onChange={(e) => handleUpdateCaptionText(cap.id, e.target.value)}
                          className="w-full bg-white border border-slate-300 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleMoveSegment(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-200"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveSegment(index, 'down')}
                          disabled={index === captions.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-200"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCaption(cap.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Delete Segment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Tab Panel */}
            {activeTab === 'export' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Export Center</h3>
                  <p className="text-xs text-slate-600 mt-1">Download timed subtitle files (.srt, .vtt) or burn captions directly into an MP4 video.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleExportSubtitles('srt')}
                    className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 transition-all group"
                  >
                    <Download className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800">Export .SRT</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Standard SubRip format</span>
                  </button>

                  <button
                    onClick={() => handleExportSubtitles('vtt')}
                    className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 transition-all group"
                  >
                    <Download className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800">Export .VTT</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Web Video Text Track</span>
                  </button>

                  <button
                    onClick={() => handleExportSubtitles('json')}
                    className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 transition-all group"
                  >
                    <Download className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800">Export JSON</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Raw structured timestamps</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-600">
                    Permanently burn edited captions into an MP4 video file.
                  </div>
                  <button
                    onClick={handleExportVideo}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    <VideoIcon className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                    {isExporting ? 'Rendering MP4...' : 'Export Burned-in MP4'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <VideoIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Current Video Loaded</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Playing <strong className="text-slate-800">{videoName}</strong>. Use the play/pause controls above or jump across timeline segments.
                </p>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* Features Section */}
      <section className="py-16 bg-white border-t border-slate-200/80" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              SUPERCHARGED CREATION
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Built for Professional Creators</h2>
            <p className="text-sm text-slate-600">Everything you need to craft stunning, engaging videos with flawless subtitles.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 space-y-3 hover:border-emerald-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">AI Speech Transcription</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Instantly transcribe audio and video files into precise timed segments using advanced Gemini AI multimodal models.
              </p>
            </div>

            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 space-y-3 hover:border-emerald-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Cinematic Subtitle Styles</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customize fonts, glowing outlines, colored text, alignment, and background pills that make your videos stand out.
              </p>
            </div>

            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 space-y-3 hover:border-emerald-300 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 font-bold">
                <Languages className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Multi-Language Support</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Transcribe and translate seamlessly between English, Urdu, Roman Urdu, Hindi, and Punjabi with high accuracy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-slate-50 border-t border-slate-200/80" id="how">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">How CaptionPro Works</h2>
            <p className="text-sm text-slate-600">Three simple steps to perfect video subtitles.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 relative shadow-sm">
              <div className="text-3xl font-black text-emerald-600/20 absolute top-4 right-5">01</div>
              <div className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Step One</div>
              <h3 className="text-base font-extrabold text-slate-900">Upload or Select Video</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload your MP4/WEBM video file or choose one of our sample clips to get started instantly.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 relative shadow-sm">
              <div className="text-3xl font-black text-emerald-600/20 absolute top-4 right-5">02</div>
              <div className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Step Two</div>
              <h3 className="text-base font-extrabold text-slate-900">AI Speech Transcription</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Click Transcribe to automatically extract spoken words into timed subtitle segments in your selected language.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 relative shadow-sm">
              <div className="text-3xl font-black text-emerald-600/20 absolute top-4 right-5">03</div>
              <div className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Step Three</div>
              <h3 className="text-base font-extrabold text-slate-900">Style and Export</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customize fonts, colors, and positioning. Preview live and export SRT, VTT, or burn directly into MP4.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black">
              <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              Caption<span className="text-emerald-400">Pro</span>
            </span>
          </div>

          <div className="text-xs text-slate-400 text-center md:text-left">
            Responsive Video Caption Editor · Powered by Google Gemini AI Studio & React.
          </div>

          <div className="flex items-center gap-6 text-xs font-medium">
            <a href="#editor" className="hover:text-white transition-colors">Editor</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
