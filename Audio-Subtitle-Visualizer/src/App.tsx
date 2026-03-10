import React, { useEffect, useRef, useState, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Parser from 'srt-parser-2';
import { 
  Play, 
  Pause, 
  FileAudio, 
  FileText, 
  SkipBack, 
  SkipForward,
  Volume2,
  VolumeX,
  Search,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  AlertTriangle,
  Activity,
  RotateCcw,
  Download,
  Trash2,
  Plus,
  X,
  Save
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Subtitle {
  id: string;
  startTime: string;
  startSeconds: number;
  endTime: string;
  endSeconds: number;
  text: string;
}

interface Anomaly {
  startTime: number;
  endTime: number;
}

interface WaveformRowProps {
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  rowDuration: number;
  subtitles: Subtitle[];
  anomalies: Anomaly[];
  currentTime: number;
  onSeek: (time: number) => void;
  onAddSubtitle: (startTime: number) => void;
  onEditSubtitle: (subtitle: Subtitle) => void;
}

/**
 * WaveformRow Component
 * Renders a single row of the wrapped waveform with its subtitles.
 */
const WaveformRow: React.FC<WaveformRowProps> = ({ 
  buffer, 
  startTime, 
  duration, 
  rowDuration, 
  subtitles, 
  anomalies,
  currentTime, 
  onSeek,
  onAddSubtitle,
  onEditSubtitle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(Math.min(startTime + rowDuration, duration) * sampleRate);
    const samplesInRow = endSample - startSample;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 1;

    const step = Math.ceil(samplesInRow / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const index = startSample + (i * step) + j;
        if (index < endSample) {
          const datum = channelData[index];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();

    // Draw anomalies (loud un-subtitled segments)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Red highlight
    anomalies.forEach(anomaly => {
      if (anomaly.startTime >= startTime + rowDuration || anomaly.endTime <= startTime) return;
      
      const startX = Math.max(0, ((anomaly.startTime - startTime) / rowDuration) * width);
      const endX = Math.min(width, ((anomaly.endTime - startTime) / rowDuration) * width);
      ctx.fillRect(startX, 0, endX - startX, height);
      
      // Add a small red line at the top for visibility
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(startX, 0, endX - startX, 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    });

    // Draw progress overlay
    if (currentTime >= startTime && currentTime < startTime + rowDuration) {
      const progressX = ((currentTime - startTime) / rowDuration) * width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(0, 0, progressX, height);
      
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    } else if (currentTime >= startTime + rowDuration) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, width, height);
    }
  }, [buffer, startTime, rowDuration, duration, currentTime]);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTime = startTime + (x / rect.width) * rowDuration;
    onSeek(clickedTime);
  };

  return (
    <div className="relative group mb-8 last:mb-0">
      {/* Time Markers */}
      <div className="flex justify-between text-[9px] font-mono opacity-30 mb-1 uppercase tracking-tighter">
        <span>{startTime.toFixed(1)}s</span>
        <span>{(startTime + rowDuration / 2).toFixed(1)}s</span>
        <span>{Math.min(startTime + rowDuration, duration).toFixed(1)}s</span>
      </div>

      {/* Waveform Canvas */}
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="h-20 bg-[#141414] rounded-lg cursor-pointer relative overflow-hidden border border-white/5 hover:border-white/20 transition-colors"
      >
        <canvas ref={canvasRef} className="w-full h-full" />
        
        {/* Anomaly Add Buttons */}
        {anomalies.map((anomaly, idx) => {
          if (anomaly.startTime >= startTime + rowDuration || anomaly.endTime <= startTime) return null;
          const centerTime = (anomaly.startTime + anomaly.endTime) / 2;
          const left = ((centerTime - startTime) / rowDuration) * 100;
          
          return (
            <button
              key={`anomaly-${idx}`}
              onClick={(e) => { e.stopPropagation(); onAddSubtitle(anomaly.startTime); }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-20"
              style={{ left: `${left}%` }}
              title="Add subtitle here"
            >
              <Plus size={12} />
            </button>
          );
        })}
      </div>

      {/* Subtitles Track */}
      <div className="relative h-12 mt-2">
        {subtitles.map((s) => {
          // Only render if it overlaps with this row
          if (s.startSeconds >= startTime + rowDuration || s.endSeconds <= startTime) return null;

          const startPos = ((s.startSeconds - startTime) / rowDuration) * 100;
          const endPos = ((s.endSeconds - startTime) / rowDuration) * 100;
          
          // Clip to row boundaries
          const clippedStart = Math.max(0, startPos);
          const clippedEnd = Math.min(100, endPos);
          const clippedWidth = clippedEnd - clippedStart;

          const isActive = currentTime >= s.startSeconds && currentTime <= s.endSeconds;

          return (
            <div
              key={s.id}
              onClick={(e) => { e.stopPropagation(); onEditSubtitle(s); }}
              className={cn(
                "absolute h-full rounded-md p-1.5 text-[10px] leading-tight overflow-hidden cursor-pointer transition-all border",
                isActive 
                  ? "bg-[#141414] text-[#E4E3E0] border-[#E4E3E0]/30 z-10 shadow-lg scale-[1.02]" 
                  : "bg-white/40 text-[#141414]/70 border-[#141414]/10 hover:bg-white/60"
              )}
              style={{ 
                left: `${clippedStart}%`, 
                width: `${clippedWidth}%`,
                minWidth: '20px'
              }}
              title={s.text}
            >
              <div className="truncate ui-monospace italic">{s.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DEFAULT_THRESHOLD = 0.15;

export default function App() {
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [amplitudeThreshold, setAmplitudeThreshold] = useState(DEFAULT_THRESHOLD);
  const [isEditingActiveSubtitle, setIsEditingActiveSubtitle] = useState(false);
  const [activeSubtitleEditText, setActiveSubtitleEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Zoom: Seconds per line
  const [secondsPerLine, setSecondsPerLine] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize Hidden WaveSurfer for audio engine
  useEffect(() => {
    const ws = WaveSurfer.create({
      container: document.createElement('div'), // Hidden
      waveColor: '#4a4a4a',
      progressColor: '#ffffff',
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (time) => setCurrentTime(time));
    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setDecodedBuffer(ws.getDecodedData() || null);
    });

    wavesurfer.current = ws;

    return () => {
      ws.destroy();
    };
  }, []);

  const processAudioFile = (file: File) => {
    if (wavesurfer.current) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      wavesurfer.current.load(url);
    }
  };

  const processSrtFile = (file: File) => {
    setSrtFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parser = new Parser();
      const parsed = parser.fromSrt(content);
      setSubtitles(parsed.map(s => ({
        id: s.id,
        startTime: s.startTime,
        startSeconds: s.startSeconds,
        endTime: s.endTime,
        endSeconds: s.endSeconds,
        text: s.text
      })));
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const name = file.name.toLowerCase();
      if (file.type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3')) {
        processAudioFile(file);
      } else if (name.endsWith('.srt')) {
        processSrtFile(file);
      }
    });
  };

  const togglePlay = () => wavesurfer.current?.playPause();
  const skip = (seconds: number) => {
    if (wavesurfer.current) {
      wavesurfer.current.setTime(wavesurfer.current.getCurrentTime() + seconds);
    }
  };

  const handleSeek = (time: number, shouldScroll = false) => {
    if (wavesurfer.current) {
      const targetTime = Math.max(0, Math.min(time, duration));
      wavesurfer.current.setTime(targetTime);
      
      if (shouldScroll) {
        const rowIndex = Math.floor(targetTime / secondsPerLine);
        const rowId = `row-${rowIndex * secondsPerLine}`;
        const element = document.getElementById(rowId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    wavesurfer.current?.setVolume(val);
    if (val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    wavesurfer.current?.setVolume(newMute ? 0 : volume);
  };

  // Detect loud segments without subtitles
  useEffect(() => {
    if (!decodedBuffer || subtitles.length === 0) {
      setAnomalies([]);
      return;
    }

    const channelData = decodedBuffer.getChannelData(0);
    const sampleRate = decodedBuffer.sampleRate;
    const duration = decodedBuffer.duration;
    
    const detected: Anomaly[] = [];
    const chunkSize = 0.1; // 100ms chunks
    const samplesPerChunk = Math.floor(chunkSize * sampleRate);
    
    let currentAnomaly: Anomaly | null = null;

    for (let i = 0; i < duration; i += chunkSize) {
      const startSample = Math.floor(i * sampleRate);
      const endSample = Math.min(startSample + samplesPerChunk, channelData.length);
      
      let maxAmp = 0;
      for (let j = startSample; j < endSample; j++) {
        const amp = Math.abs(channelData[j]);
        if (amp > maxAmp) maxAmp = amp;
      }

      const isLoud = maxAmp > amplitudeThreshold;
      const hasSubtitle = subtitles.some(s => i >= s.startSeconds - 0.05 && i <= s.endSeconds + 0.05);

      if (isLoud && !hasSubtitle) {
        if (!currentAnomaly) {
          currentAnomaly = { startTime: i, endTime: i + chunkSize };
        } else {
          currentAnomaly.endTime = i + chunkSize;
        }
      } else {
        if (currentAnomaly) {
          // Only add if it's long enough to be significant (e.g. > 150ms)
          if (currentAnomaly.endTime - currentAnomaly.startTime > 0.15) {
            detected.push(currentAnomaly);
          }
          currentAnomaly = null;
        }
      }
    }
    if (currentAnomaly && currentAnomaly.endTime - currentAnomaly.startTime > 0.15) {
      detected.push(currentAnomaly);
    }

    setAnomalies(detected);
  }, [decodedBuffer, subtitles, amplitudeThreshold]);

  const jumpToNextAnomaly = () => {
    const next = anomalies.find(a => a.startTime > currentTime + 0.1);
    if (next) {
      handleSeek(next.startTime, true);
    } else if (anomalies.length > 0) {
      handleSeek(anomalies[0].startTime, true); // Loop back
    }
  };

  const formatSecondsToSrtTime = (seconds: number) => {
    const date = new Date(0);
    date.setSeconds(seconds);
    const ms = Math.floor((seconds % 1) * 1000);
    return date.toISOString().substring(11, 19) + ',' + ms.toString().padStart(3, '0');
  };

  const handleAddSubtitle = (startTime: number) => {
    const newSub: Subtitle = {
      id: (subtitles.length + 1).toString(),
      startTime: formatSecondsToSrtTime(startTime),
      startSeconds: startTime,
      endTime: formatSecondsToSrtTime(startTime + 2),
      endSeconds: startTime + 2,
      text: 'New subtitle'
    };
    setSubtitles(prev => [...prev, newSub].sort((a, b) => a.startSeconds - b.startSeconds));
    startEditingSubtitle(newSub);
  };

  const handleSaveSubtitle = (updated: Subtitle) => {
    setSubtitles(prev => {
      const exists = prev.find(s => s.id === updated.id);
      if (exists) {
        return prev.map(s => s.id === updated.id ? updated : s).sort((a, b) => a.startSeconds - b.startSeconds);
      } else {
        return [...prev, updated].sort((a, b) => a.startSeconds - b.startSeconds);
      }
    });
  };

  const startEditingSubtitle = (s: Subtitle) => {
    handleSeek(s.startSeconds, true);
    setIsEditingActiveSubtitle(true);
    setActiveSubtitleEditText(s.text);
  };

  const handleDeleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
    setIsEditingActiveSubtitle(false);
  };

  const exportSrt = () => {
    const parser = new Parser();
    const srtContent = parser.toSrt(subtitles.map(s => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      text: s.text
    })));
    
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = audioFile ? `${audioFile.name.split('.')[0]}.srt` : 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const name = file.name.toLowerCase();
      if (file.type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3')) {
        processAudioFile(file);
      } else if (name.endsWith('.srt')) {
        processSrtFile(file);
      }
    });
  };

  const rows = useMemo(() => {
    if (!duration) return [];
    const count = Math.ceil(duration / secondsPerLine);
    return Array.from({ length: count }, (_, i) => i * secondsPerLine);
  }, [duration, secondsPerLine]);

  const currentSubtitle = subtitles.find(
    s => currentTime >= s.startSeconds && currentTime <= s.endSeconds
  );

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]"
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-[#E4E3E0] pointer-events-none">
          <LayoutGrid size={80} className="mb-6 animate-bounce" />
          <h2 className="text-4xl font-serif italic">Drop files to import</h2>
          <p className="mt-4 font-mono opacity-50 uppercase tracking-widest">WAV, MP3, or SRT</p>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#141414] py-3 px-4 flex flex-col md:flex-row justify-between items-center gap-3 sticky top-0 bg-[#E4E3E0]/80 backdrop-blur-md z-50">
        <div>
          <h1 className="text-lg font-serif italic tracking-tight">Multi-Line Audio Sync</h1>
          <p className="text-[9px] font-mono opacity-50 uppercase tracking-widest mt-0.5">Wrapped Waveform & Timeline View</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[#141414]/20 rounded-full bg-white/30">
            <button onClick={() => setSecondsPerLine(prev => Math.min(60, prev + 5))} className="hover:opacity-60" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] font-mono w-12 text-center">{secondsPerLine}s</span>
            <button onClick={() => setSecondsPerLine(prev => Math.max(5, prev - 5))} className="hover:opacity-60" title="Zoom In">
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Threshold Control */}
          <div className="flex items-center gap-3 px-4 py-1.5 border border-[#141414]/20 rounded-full bg-white/30">
            <Activity size={14} className="opacity-50" />
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase opacity-50 leading-none mb-1">Sensitivity</span>
              <input 
                type="range" 
                min="0.01" 
                max="0.5" 
                step="0.01" 
                value={amplitudeThreshold} 
                onChange={(e) => setAmplitudeThreshold(parseFloat(e.target.value))}
                className="w-20 h-1 bg-[#141414]/10 rounded-lg appearance-none cursor-pointer accent-[#141414]"
              />
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono w-8 text-right">{(amplitudeThreshold * 100).toFixed(0)}%</span>
                {anomalies.length > 0 && (
                  <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                    {anomalies.length}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setAmplitudeThreshold(DEFAULT_THRESHOLD)}
                className="text-[8px] font-mono uppercase opacity-40 hover:opacity-100 flex items-center gap-0.5 transition-opacity"
                title="Reset to default (15%)"
              >
                <RotateCcw size={8} />
                Reset
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 px-5 py-2 border border-[#141414] rounded-full cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-all text-sm font-medium bg-white/50 shadow-sm hover:shadow-md active:scale-95">
            <LayoutGrid size={18} />
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-bold">Import Project</span>
              <span className="text-[9px] opacity-60 uppercase mt-0.5">Select WAV & SRT</span>
            </div>
            <input 
              type="file" 
              multiple 
              accept="audio/wav,audio/mpeg,.srt" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          {(audioFile || srtFile) && (
            <div className="hidden md:flex items-center gap-4 px-4 py-2 border border-[#141414]/10 rounded-full bg-white/20 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", audioFile ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                <span className={cn(audioFile ? "opacity-100" : "opacity-30")}>AUDIO</span>
              </div>
              <div className="w-px h-3 bg-[#141414]/10" />
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", srtFile ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                <span className={cn(srtFile ? "opacity-100" : "opacity-30")}>SRT</span>
              </div>
            </div>
          )}

          {anomalies.length > 0 && (
            <button 
              onClick={jumpToNextAnomaly}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg hover:bg-red-600 transition-all animate-pulse hover:animate-none group"
              title="Jump to next loud gap"
            >
              <AlertTriangle size={14} className="group-hover:rotate-12 transition-transform" />
              <span>Next Gap ({anomalies.findIndex(a => a.startTime > currentTime) + 1 || 1}/{anomalies.length})</span>
            </button>
          )}

          {subtitles.length > 0 && (
            <button 
              onClick={exportSrt}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] rounded-full text-xs font-bold shadow-lg hover:opacity-80 transition-all"
              title="Export SRT"
            >
              <Download size={14} />
              <span>Export SRT</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-4 px-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Multi-line Waveform View */}
        <div className="lg:col-span-3 space-y-4">
          {decodedBuffer ? (
            <div className="space-y-2">
              {rows.map((startTime) => (
                <div key={startTime} id={`row-${startTime}`}>
                  <WaveformRow 
                    buffer={decodedBuffer}
                    startTime={startTime}
                    duration={duration}
                    rowDuration={secondsPerLine}
                    subtitles={subtitles}
                    anomalies={anomalies}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    onAddSubtitle={handleAddSubtitle}
                    onEditSubtitle={startEditingSubtitle}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-[#141414]/10 rounded-3xl opacity-30">
              <LayoutGrid size={64} strokeWidth={1} className="mb-4" />
              <p className="font-serif italic text-xl">Load an audio file to generate the multi-line view</p>
            </div>
          )}
        </div>

        {/* Right Column: Active Display & Search */}
        <div className="space-y-4 lg:sticky lg:top-32 h-fit">
          {/* Active Subtitle Card */}
          <div
            className={cn(
              "bg-[#141414] text-[#E4E3E0] rounded-xl p-3 shadow-xl min-h-[120px] flex flex-col justify-center transition-all border",
              isEditingActiveSubtitle ? "border-white/40 ring-2 ring-white/5" : "border-transparent"
            )}
            onDoubleClick={() => {
              if (currentSubtitle) {
                setIsEditingActiveSubtitle(true);
                setActiveSubtitleEditText(currentSubtitle.text);
              }
            }}
          >
            {currentSubtitle ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-[5px] font-mono opacity-40 uppercase tracking-widest">
                    {isEditingActiveSubtitle ? 'Editing Mode' : 'Now Playing'} • {currentSubtitle.startTime.split(',')[0]}
                  </div>
                  {isEditingActiveSubtitle && (
                    <div className="text-[4px] font-mono opacity-40 uppercase">Enter to Save</div>
                  )}
                </div>

                {isEditingActiveSubtitle ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={activeSubtitleEditText}
                      onChange={(e) => setActiveSubtitleEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveSubtitle({ ...currentSubtitle, text: activeSubtitleEditText });
                          setIsEditingActiveSubtitle(false);
                        }
                        if (e.key === 'Escape') {
                          setIsEditingActiveSubtitle(false);
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-md p-1.5 text-sm ui-monospace leading-relaxed focus:outline-none focus:border-white/30 resize-none text-[#E4E3E0]"
                      rows={5}
                    />
                    <div className="flex justify-between items-center">
                      <button 
                        onClick={() => handleDeleteSubtitle(currentSubtitle.id)}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 text-[10px] font-mono uppercase tracking-widest transition-colors"
                      >
                        <Trash2 size={8} />
                      </button>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setIsEditingActiveSubtitle(false)}
                          className="text-[10px] font-mono uppercase opacity-40 hover:opacity-100 transition-opacity"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            handleSaveSubtitle({ ...currentSubtitle, text: activeSubtitleEditText });
                            setIsEditingActiveSubtitle(false);
                          }}
                          className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-[10px] font-mono uppercase tracking-widest transition-colors font-bold"
                        >
                          <Save size={8} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-base font-serif italic leading-relaxed cursor-text select-none group relative">
                    "{currentSubtitle.text}"
                    <span className="absolute -bottom-5 left-0 text-[7px] font-mono opacity-0 group-hover:opacity-30 transition-opacity uppercase">Double-click to edit</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="opacity-30 text-center italic font-serif">
                Silence or awaiting dialogue...
              </div>
            )}
          </div>

          {/* Playback Bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#141414]/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono opacity-50">
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => skip(-5)} className="hover:opacity-60"><SkipBack size={18} /></button>
                <button 
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-[#141414] text-[#E4E3E0] flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
                </button>
                <button onClick={() => skip(5)} className="hover:opacity-60"><SkipForward size={18} /></button>
              </div>
              <div className="text-[10px] font-mono opacity-50">
                {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleMute} className="opacity-50 hover:opacity-100">
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="flex-1 accent-[#141414] h-1"
              />
            </div>
          </div>

          {/* Search & List */}
          <div className="bg-white/50 rounded-2xl border border-[#141414]/10 flex flex-col max-h-[400px]">
            <div className="p-3 border-b border-[#141414]/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                <input 
                  type="text" 
                  placeholder="Search dialogue..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border border-[#141414]/10 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-[#141414]/30"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {subtitles.filter(s => s.text.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                <div
                  key={s.id}
                  onClick={() => handleSeek(s.startSeconds, true)}
                  onDoubleClick={() => startEditingSubtitle(s)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg text-[11px] transition-colors cursor-pointer group",
                    currentSubtitle?.id === s.id ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-white"
                  )}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="opacity-50">{s.startTime.split(',')[0]}</div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteSubtitle(s.id); }}
                        className="opacity-0 group-hover:opacity-40 hover:opacity-100 text-red-500 transition-all"
                        title="Delete Subtitle"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="opacity-0 group-hover:opacity-30 text-[8px] uppercase font-mono">Double-click to edit</div>
                    </div>
                  </div>
                  <div className="line-clamp-2 font-serif italic">{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#141414]/10 flex justify-between items-center opacity-30 text-[9px] font-mono uppercase tracking-widest">
        <div>Wrapped View Mode Active</div>
        <div>Scale: {secondsPerLine}s per line</div>
        <div>© 2024 AudioSync Labs</div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(20, 20, 20, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
