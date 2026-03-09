/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Upload, Scissors, Download, Play, Pause, RotateCcw, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Helper to convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  return new Blob([bufferArray], { type: "audio/wav" });
}

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);

  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const regionsRef = useRef<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'audio/wav') {
      setAudioFile(file);
      setTrimmedBlob(null);
      
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setStartTime(0);
      setEndTime(decodedBuffer.duration);
    } else if (file) {
      alert('Please upload a valid WAV file.');
    }
  };

  useEffect(() => {
    if (!containerRef.current || !audioFile) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#312e81',
      barWidth: 2,
      barRadius: 3,
      height: 128,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

    ws.loadBlob(audioFile);

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      setEndTime(dur);
      
      // Create initial region
      regions.addRegion({
        start: 0,
        end: dur,
        color: 'rgba(79, 70, 229, 0.2)',
        drag: true,
        resize: true,
      });
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    regions.on('region-updated', (region: any) => {
      setStartTime(region.start);
      setEndTime(region.end);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioFile]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const handleStartTimeChange = (val: string) => {
    const time = parseFloat(val);
    if (!isNaN(time) && time >= 0 && time < endTime) {
      setStartTime(time);
      const region = regionsRef.current?.getRegions()[0];
      if (region) region.update({ start: time });
    }
  };

  const handleEndTimeChange = (val: string) => {
    const time = parseFloat(val);
    if (!isNaN(time) && time > startTime && time <= duration) {
      setEndTime(time);
      const region = regionsRef.current?.getRegions()[0];
      if (region) region.update({ end: time });
    }
  };

  const trimAudio = async () => {
    if (!audioBuffer) return;
    setIsTrimming(true);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioBuffer.sampleRate;
      const startOffset = Math.floor(startTime * sampleRate);
      const endOffset = Math.floor(endTime * sampleRate);
      const frameCount = endOffset - startOffset;

      const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        sampleRate
      );

      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        const channelData = audioBuffer.getChannelData(i);
        const newChannelData = newBuffer.getChannelData(i);
        for (let j = 0; j < frameCount; j++) {
          newChannelData[j] = channelData[startOffset + j];
        }
      }

      const blob = audioBufferToWav(newBuffer);
      setTrimmedBlob(blob);
    } catch (error) {
      console.error('Error trimming audio:', error);
      alert('Failed to trim audio.');
    } finally {
      setIsTrimming(false);
    }
  };

  const downloadTrimmed = () => {
    if (!trimmedBlob) return;
    const url = URL.createObjectURL(trimmedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trimmed_${audioFile?.name || 'audio.wav'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setAudioFile(null);
    setAudioBuffer(null);
    setTrimmedBlob(null);
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-serif italic mb-2"
          >
            WAV Trimmer
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-stone-500 uppercase tracking-widest text-xs"
          >
            Professional Grade Audio Slicing
          </motion.p>
        </header>

        <main className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          {!audioFile ? (
            <div className="p-12 text-center">
              <label className="cursor-pointer group">
                <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-indigo-50 transition-colors">
                  <Upload className="w-8 h-8 text-stone-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <span className="text-lg font-medium text-stone-700 block mb-1">Upload WAV File</span>
                <span className="text-sm text-stone-400">Drag and drop or click to browse</span>
                <input type="file" accept=".wav" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="p-6 md:p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-medium truncate max-w-[200px] md:max-w-md">{audioFile.name}</h2>
                    <p className="text-xs text-stone-400 uppercase tracking-tighter">
                      {duration.toFixed(2)}s • WAV Audio
                    </p>
                  </div>
                </div>
                <button 
                  onClick={reset}
                  className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-8 relative">
                <div ref={containerRef} className="w-full bg-stone-50 rounded-2xl border border-stone-100 p-4" />
                <div className="flex justify-between mt-2 text-[10px] font-mono text-stone-400 uppercase tracking-widest">
                  <span>0:00</span>
                  <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest">
                    <Clock className="w-3 h-3" /> Selection Range
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <span className="block text-[10px] text-stone-400 mb-1 ml-1">START</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={startTime.toFixed(2)}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] text-stone-400 mb-1 ml-1">END</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={endTime.toFixed(2)}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={togglePlay}
                      className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-xl py-3 hover:bg-stone-800 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                      <span className="text-sm font-medium uppercase tracking-widest">{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                    <button 
                      onClick={() => wavesurferRef.current?.stop()}
                      className="p-3 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={trimAudio}
                  disabled={isTrimming}
                  className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-3"
                >
                  {isTrimming ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Scissors className="w-5 h-5" />
                  )}
                  {isTrimming ? 'Processing...' : 'Trim Selection'}
                </button>

                <AnimatePresence>
                  {trimmedBlob && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={downloadTrimmed}
                      className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3"
                    >
                      <Download className="w-5 h-5" />
                      Download Trimmed WAV
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-12 text-center text-stone-400 text-[10px] uppercase tracking-[0.2em]">
          Built for precision • WAV Format Only
        </footer>
      </div>
    </div>
  );
}
