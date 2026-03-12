import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { Upload, Copy, Filter, Layers, ZoomIn, ZoomOut, RefreshCw, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FlameNode, ParsedFlamegraph } from './types';
import { parseCollapsed, parseJSON, parseSVG, formatForAI } from './utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [data, setData] = useState<ParsedFlamegraph | null>(null);
  const [minPercent, setMinPercent] = useState(0.1);
  const [maxDepth, setMaxDepth] = useState(20);
  const [selectedNode, setSelectedNode] = useState<FlameNode | null>(null);
  const [copying, setCopying] = useState(false);
  const [zoomedNode, setZoomedNode] = useState<d3.HierarchyRectangularNode<FlameNode> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingMessage(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Use timeout to allow loading UI to show up before heavy parsing
      setTimeout(() => {
        processContent(content, file.name);
      }, 50);
    };
    reader.readAsText(file);
  };

  const processContent = (content: string, fileName: string) => {
    setLoadingMessage(`Parsing ${fileName}...`);
    try {
      if (fileName.endsWith('.json')) {
        setData(parseJSON(JSON.parse(content)));
      } else if (fileName.endsWith('.svg')) {
        setData(parseSVG(content));
      } else {
        setData(parseCollapsed(content));
      }
      setError(null);
      setSelectedNode(null);
      setZoomedNode(null);
    } catch (err) {
      console.error(err);
      setError("Failed to parse file. Please ensure it's a valid JSON, SVG, or collapsed stack format.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    setLoadingMessage("Fetching demo file...");
    try {
      const response = await fetch('./flamegraph_demo.svg');
      const content = await response.text();
      processContent(content, 'flamegraph_demo.svg');
    } catch (err) {
      setError("Failed to load demo file.");
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    setCopying(true);
    // Use the zoomed node as the root for copy if zoomed, otherwise use data.root
    const rootToCopy = zoomedNode ? zoomedNode.data : data.root;
    const text = formatForAI(rootToCopy, data.totalValue, maxDepth, minPercent);
    await navigator.clipboard.writeText(text);
    setTimeout(() => setCopying(false), 2000);
  };

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth - 32; // padding
    const rowHeight = 24;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = d3.hierarchy(data.root)
      .sum(d => d.children?.length ? 0 : d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<FlameNode>()
      .size([width, (root.height + 1) * rowHeight]);

    partition(root);

    // Scales for zooming
    const x = d3.scaleLinear()
      .domain([zoomedNode ? zoomedNode.x0 : 0, zoomedNode ? zoomedNode.x1 : width])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([zoomedNode ? zoomedNode.y0 : 0, (root.height + 1) * rowHeight])
      .range([0, (root.height + 1 - (zoomedNode ? zoomedNode.depth : 0)) * rowHeight]);

    const color = d3.scaleOrdinal(d3.schemeObservable10);

    const nodes = root.descendants().filter(d => {
      const p = (d.value! / data.totalValue) * 100;
      // If zoomed, only show descendants of zoomedNode
      const isDescendant = !zoomedNode || (d.x0 >= zoomedNode.x0 && d.x1 <= zoomedNode.x1 && d.y0 >= zoomedNode.y0);
      const relativeDepth = d.depth - (zoomedNode ? zoomedNode.depth : 0);
      return p >= minPercent && relativeDepth <= maxDepth && isDescendant;
    });

    const cell = svg.selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.data);
        setZoomedNode(d);
      });

    cell.append("rect")
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("height", rowHeight - 1)
      .attr("fill", d => color(d.data.name))
      .attr("opacity", 0.8)
      .attr("class", "transition-all duration-300 hover:opacity-100");

    // Use a nested SVG to provide automatic clipping for the text
    const textContainer = cell.append("svg")
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("height", rowHeight - 1);

    textContainer.append("text")
      .attr("x", 4)
      .attr("y", "50%")
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("fill", "#fff")
      .style("pointer-events", "none")
      .text(d => {
        const w = x(d.x1) - x(d.x0);
        if (w < 15) return ""; // Lowered threshold significantly
        const p = (d.value! / data.totalValue) * 100;
        return `${d.data.name} (${p.toFixed(1)}%)`;
      });

    const maxRenderedDepth = d3.max(nodes, d => d.depth) || 0;
    const visibleLevels = maxRenderedDepth - (zoomedNode ? zoomedNode.depth : 0) + 1;
    svg.attr("height", visibleLevels * rowHeight);

  }, [data, minPercent, maxDepth, zoomedNode]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans p-6 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-2xl border border-gray-100">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-orange-100 rounded-full animate-pulse"></div>
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin absolute inset-0" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{loadingMessage || "Processing..."}</p>
              <p className="text-sm text-gray-500 mt-1">Please wait while we analyze the data</p>
            </div>
          </div>
        </div>
      )}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="w-8 h-8 text-orange-500" />
            FlameAI
          </h1>
          <p className="text-sm text-gray-500 mt-1 italic">Interactive Flamegraph Analyzer for AI</p>
        </div>

        <div className="flex items-center gap-3">
          {zoomedNode && (
            <button 
              onClick={() => setZoomedNode(null)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg shadow-sm hover:bg-orange-100 transition-all text-sm font-medium text-orange-600"
            >
              <ZoomOut className="w-4 h-4" />
              Reset Zoom
            </button>
          )}

          <button 
            onClick={loadDemo}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all text-sm font-medium text-gray-600"
          >
            <Layers className="w-4 h-4" />
            Load Demo
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">Upload File</span>
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".json,.txt,.svg" />
          </label>
          
          <button 
            onClick={handleCopy}
            disabled={!data}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all text-sm font-medium",
              data 
                ? "bg-orange-500 text-white hover:bg-orange-600" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {copying ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copying ? "Copied!" : zoomedNode ? "Copy Zoomed Area" : "Copy for AI"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-1 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Filter className="w-3 h-3" />
              Filters
            </h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Min Percentage</label>
                  <span className="text-xs font-mono text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{minPercent}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  step="0.1" 
                  value={minPercent} 
                  onChange={(e) => setMinPercent(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">
                    {zoomedNode ? "Depth from Selection" : "Max Depth"}
                  </label>
                  <span className="text-xs font-mono text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{maxDepth}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={maxDepth} 
                  onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Selection Details
            </h2>
            {selectedNode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Function Name</label>
                  <p className="text-sm font-mono break-all bg-gray-50 p-2 rounded border border-gray-100">{selectedNode.name}</p>
                </div>
                <div className="flex justify-between">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase">Value</label>
                    <p className="text-sm font-medium">{selectedNode.value.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase">Total %</label>
                    <p className="text-sm font-medium text-orange-600">
                      {data ? ((selectedNode.value / data.totalValue) * 100).toFixed(2) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Click a block to see details</p>
            )}
          </section>
        </aside>

        {/* Main Viewport */}
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-center gap-3">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <div 
            ref={containerRef}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] relative"
          >
            {!data ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Flamegraph Loaded</h3>
                <p className="text-sm max-w-xs">
                  Upload a JSON or collapsed stack file to start analyzing performance data.
                </p>
              </div>
            ) : (
              <div className="p-4 overflow-x-auto">
                <svg ref={svgRef} className="w-full" />
              </div>
            )}
          </div>

          {data && (
            <div className="bg-gray-900 rounded-2xl p-6 text-gray-300 font-mono text-xs overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-500 uppercase tracking-widest text-[10px] font-bold">AI Optimized Export Preview</h3>
                <span className="text-[10px] bg-gray-800 px-2 py-1 rounded">Markdown Tree Format</span>
              </div>
              <pre className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
                {formatForAI(zoomedNode ? zoomedNode.data : data.root, data.totalValue, 5, minPercent)}
                {maxDepth > 5 && "... (truncated in preview)"}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
