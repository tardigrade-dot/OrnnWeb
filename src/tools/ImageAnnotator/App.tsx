/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RotateCcw, Type, Hash, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Marker {
  x: number; // percentage (0-1)
  y: number; // percentage (0-1)
  label: string;
}

type LabelType = 'number' | 'letter';

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [labelType, setLabelType] = useState<LabelType>('number');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to generate next label
  const getNextLabel = (index: number, type: LabelType) => {
    if (type === 'number') {
      return (index + 1).toString();
    } else {
      // A, B, C... Z, AA, AB...
      let label = '';
      let n = index;
      while (n >= 0) {
        label = String.fromCharCode((n % 26) + 65) + label;
        n = Math.floor(n / 26) - 1;
      }
      return label;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setMarkers([]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!image || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newMarker: Marker = {
      x,
      y,
      label: getNextLabel(markers.length, labelType),
    };

    setMarkers([...markers, newMarker]);
  };

  const resetMarkers = () => {
    setMarkers([]);
  };

  const toggleLabelType = () => {
    const newType = labelType === 'number' ? 'letter' : 'number';
    setLabelType(newType);
    // Re-label existing markers
    setMarkers(prev => prev.map((m, i) => ({ ...m, label: getNextLabel(i, newType) })));
  };

  const removeLastMarker = () => {
    setMarkers(prev => prev.slice(0, -1));
  };

  const saveImage = () => {
    if (!image) return;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Draw markers
    const baseSize = Math.max(canvas.width, canvas.height) * 0.02; // Scale marker size relative to image
    const fontSize = baseSize * 0.8;
    
    markers.forEach((marker) => {
      const px = marker.x * canvas.width;
      const py = marker.y * canvas.height;

      // Draw circle background
      ctx.beginPath();
      ctx.arc(px, py, baseSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; // Tailwind red-500
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = baseSize * 0.1;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.label, px, py);
    });

    // Download
    const link = document.createElement('a');
    link.download = 'annotated-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-red-100">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-200">
              <ImageIcon size={18} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Image Annotator</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {image && (
              <>
                <button
                  onClick={toggleLabelType}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 hover:bg-zinc-50 transition-colors text-sm font-medium"
                  title="Switch between Numbers and Letters"
                >
                  {labelType === 'number' ? <Hash size={14} /> : <Type size={14} />}
                  {labelType === 'number' ? 'Numbers' : 'Letters'}
                </button>
                <button
                  onClick={removeLastMarker}
                  className="p-2 rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors"
                  title="Remove Last Marker"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={resetMarkers}
                  className="p-2 rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors"
                  title="Reset All"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={saveImage}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Download size={18} />
                  <span>Save</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {!image ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
          >
            <label 
              className={`
                relative group cursor-pointer
                flex flex-col items-center justify-center
                w-full max-w-2xl mx-auto aspect-video
                border-2 border-dashed rounded-3xl
                transition-all duration-300
                ${isDragging ? 'border-red-500 bg-red-50' : 'border-zinc-300 bg-white hover:border-zinc-400'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => { setImage(img); setMarkers([]); };
                    img.src = event.target?.result as string;
                  };
                  reader.readAsDataURL(file);
                }
              }}
            >
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform duration-300">
                <Upload size={32} />
              </div>
              <div className="mt-6 text-center">
                <p className="text-xl font-semibold text-zinc-800">Upload an image to start</p>
                <p className="text-zinc-500 mt-2">Click or drag and drop your image here</p>
              </div>
            </label>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-full flex justify-center">
              <div 
                ref={containerRef}
                onClick={handleCanvasClick}
                className="relative cursor-crosshair shadow-2xl rounded-lg overflow-hidden bg-zinc-200"
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '80vh',
                }}
              >
                <img 
                  src={image.src} 
                  alt="To annotate" 
                  className="block max-w-full max-h-[80vh] select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                
                {/* Render markers */}
                <AnimatePresence>
                  {markers.map((marker, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute w-6 h-6 md:w-8 md:h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xs md:text-sm font-bold shadow-lg border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ 
                        left: `${marker.x * 100}%`, 
                        top: `${marker.y * 100}%` 
                      }}
                    >
                      {marker.label}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Click anywhere on the image to add a marker</span>
              </div>
              <div className="w-px h-4 bg-zinc-200"></div>
              <span>{markers.length} markers added</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-zinc-200 text-center text-zinc-400 text-sm">
        <p>© 2026 Image Annotator • Original Resolution Preserved</p>
      </footer>
    </div>
  );
}
