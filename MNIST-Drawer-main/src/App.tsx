/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import { Eraser, Pencil, Trash2, Download, Settings2, Grid3X3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CANVAS_SIZE = 280;
const MNIST_SIZE = 28;
const SCALE_FACTOR = CANVAS_SIZE / MNIST_SIZE;

export default function App() {
  const [lines, setLines] = useState<any[]>([]);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [exportScale, setExportScale] = useState<number>(1);
  const [showGrid, setShowGrid] = useState(true);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Handle drawing
  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    // replace last
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    generatePreview();
  };

  const clearCanvas = () => {
    setLines([]);
    setPreviewUrl('');
  };

  const generatePreview = () => {
    if (!stageRef.current) return;
    
    // Create a temporary canvas to downsample
    const canvas = document.createElement('canvas');
    canvas.width = MNIST_SIZE;
    canvas.height = MNIST_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // MNIST style: Black background, White strokes
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, MNIST_SIZE, MNIST_SIZE);
    
    ctx.strokeStyle = 'white';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2; // Roughly 2 pixels in 28x28 space

    lines.forEach(line => {
      ctx.beginPath();
      ctx.globalCompositeOperation = line.tool === 'eraser' ? 'destination-out' : 'source-over';
      const points = line.points;
      if (points.length < 2) return;
      
      ctx.moveTo(points[0] / SCALE_FACTOR, points[1] / SCALE_FACTOR);
      for (let i = 2; i < points.length; i += 2) {
        ctx.lineTo(points[i] / SCALE_FACTOR, points[i+1] / SCALE_FACTOR);
      }
      ctx.stroke();
    });

    setPreviewUrl(canvas.toDataURL());
  };

  const downloadImage = () => {
    if (!previewUrl) return;
    
    const finalSize = MNIST_SIZE * exportScale;
    const canvas = document.createElement('canvas');
    canvas.width = finalSize;
    canvas.height = finalSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable smoothing for pixelated look if scale > 1
    ctx.imageSmoothingEnabled = false;
    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, finalSize, finalSize);
      const link = document.createElement('a');
      link.download = `mnist_digit_${exportScale}x.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = previewUrl;
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 border-b border-[#141414] pb-4 flex justify-between items-end">
          <div>
            <h1 className="font-serif italic text-4xl mb-1">MNIST Drawer</h1>
            <p className="text-xs uppercase tracking-widest opacity-60 font-mono">Handwritten Digit Tool v1.0</p>
          </div>
          <div className="text-right font-mono text-[10px] opacity-40 uppercase">
            Status: Ready<br />
            Resolution: 28x28 px
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left: Drawing Area */}
          <div className="md:col-span-7 space-y-4">
            <div className="relative border border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="absolute -top-3 left-4 bg-[#E4E3E0] px-2 text-[10px] font-mono uppercase border border-[#141414]">
                Input_Canvas
              </div>
              
              <div className="p-4 flex justify-center items-center">
                <div className="relative cursor-crosshair bg-black" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
                  {showGrid && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-20"
                      style={{
                        backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                        backgroundSize: `${SCALE_FACTOR}px ${SCALE_FACTOR}px`
                      }}
                    />
                  )}
                  <Stage
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                    ref={stageRef}
                  >
                    <Layer>
                      {lines.map((line, i) => (
                        <Line
                          key={i}
                          points={line.points}
                          stroke="white"
                          strokeWidth={20} // Scaled width for 280x280
                          tension={0.5}
                          lineCap="round"
                          lineJoin="round"
                          globalCompositeOperation={
                            line.tool === 'eraser' ? 'destination-out' : 'source-over'
                          }
                        />
                      ))}
                    </Layer>
                  </Stage>
                </div>
              </div>

              {/* Toolbar */}
              <div className="border-t border-[#141414] p-2 flex items-center gap-2 bg-[#F5F5F3]">
                <button
                  onClick={() => setTool('pencil')}
                  className={cn(
                    "p-2 border border-[#141414] transition-colors",
                    tool === 'pencil' ? "bg-[#141414] text-white" : "hover:bg-white"
                  )}
                  title="Pencil"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={cn(
                    "p-2 border border-[#141414] transition-colors",
                    tool === 'eraser' ? "bg-[#141414] text-white" : "hover:bg-white"
                  )}
                  title="Eraser"
                >
                  <Eraser size={18} />
                </button>
                <div className="w-px h-6 bg-[#141414] mx-1 opacity-20" />
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn(
                    "p-2 border border-[#141414] transition-colors",
                    showGrid ? "bg-[#141414] text-white" : "hover:bg-white"
                  )}
                  title="Toggle Grid"
                >
                  <Grid3X3 size={18} />
                </button>
                <div className="flex-1" />
                <button
                  onClick={clearCanvas}
                  className="p-2 border border-[#141414] hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-mono uppercase"
                >
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
            </div>
            
            <div className="font-mono text-[10px] opacity-60 leading-relaxed">
              * DRAW A SINGLE DIGIT (0-9) IN THE CENTER OF THE CANVAS.<br />
              * MNIST DATASET USES 28X28 PIXELS GRAYSCALE IMAGES.<br />
              * THE PREVIEW SHOWS THE ACTUAL RESOLUTION USED FOR EXPORT.
            </div>
          </div>

          {/* Right: Preview & Export */}
          <div className="md:col-span-5 space-y-6">
            {/* Preview Section */}
            <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="bg-[#141414] text-white px-3 py-1 text-[10px] font-mono uppercase flex justify-between items-center">
                <span>MNIST_Preview</span>
                <span>28 x 28</span>
              </div>
              <div className="p-8 flex flex-col items-center justify-center bg-[#F5F5F3]">
                <div className="relative border border-[#141414] bg-black p-1">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-28 h-28" 
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-28 h-28 flex items-center justify-center text-[#141414] opacity-20 italic text-[10px] font-serif">
                      No Data
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[10px] font-mono uppercase opacity-40">Actual Size (Scaled 4x for visibility)</p>
              </div>
            </div>

            {/* Export Settings */}
            <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="bg-[#141414] text-white px-3 py-1 text-[10px] font-mono uppercase flex items-center gap-2">
                <Settings2 size={12} />
                <span>Export_Settings</span>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">Pixel Scale</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 4, 8].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setExportScale(scale)}
                        className={cn(
                          "py-2 border border-[#141414] font-mono text-xs transition-colors",
                          exportScale === scale ? "bg-[#141414] text-white" : "hover:bg-[#F5F5F3]"
                        )}
                      >
                        {scale}x
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] font-mono opacity-40">
                    Result: {28 * exportScale} x {28 * exportScale} px
                  </p>
                </div>

                <button
                  disabled={!previewUrl}
                  onClick={downloadImage}
                  className={cn(
                    "w-full py-3 border border-[#141414] flex items-center justify-center gap-2 font-mono uppercase text-sm transition-all",
                    previewUrl 
                      ? "bg-[#141414] text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)]" 
                      : "opacity-20 cursor-not-allowed"
                  )}
                >
                  <Download size={18} />
                  Save Image
                </button>
              </div>
            </div>

            {/* Meta Info */}
            <div className="p-4 border border-[#141414] border-dashed font-mono text-[10px] space-y-2">
              <div className="flex justify-between">
                <span className="opacity-40">FORMAT:</span>
                <span>PNG (RGBA)</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-40">COLOR_SPACE:</span>
                <span>GRAYSCALE_EQUIV</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-40">ENCODING:</span>
                <span>BASE64_DATA_URL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
