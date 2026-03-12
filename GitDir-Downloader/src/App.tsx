/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Github, 
  Download, 
  Folder, 
  File, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Search,
  ArrowRight,
  Key,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

type AppStatus = 'idle' | 'fetching' | 'downloading' | 'zipping' | 'success' | 'error';

export default function App() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string; path: string } | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('gh_token', token);
    } else {
      localStorage.removeItem('gh_token');
    }
  }, [token]);

  const parseGitHubUrl = (inputUrl: string) => {
    try {
      const urlObj = new URL(inputUrl);
      if (urlObj.hostname !== 'github.com') {
        throw new Error('Please enter a valid GitHub URL');
      }

      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        throw new Error('Invalid GitHub repository URL');
      }

      const owner = parts[0];
      const repo = parts[1];
      
      // Handle tree URLs: github.com/owner/repo/tree/branch/path
      let branch = 'main';
      let path = '';

      if (parts[2] === 'tree' && parts.length > 3) {
        branch = parts[3];
        path = parts.slice(4).join('/');
      } else if (parts.length > 2) {
        // Fallback or other formats
        path = parts.slice(2).join('/');
      }

      return { owner, repo, branch, path };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid URL');
    }
  };

  const getHeaders = () => {
    const headers: HeadersInit = {};
    if (token.trim()) {
      headers['Authorization'] = `token ${token.trim()}`;
    }
    return headers;
  };

  const fetchDirectoryContents = async (owner: string, repo: string, path: string, branch: string): Promise<GitHubFile[]> => {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(apiUrl, { headers: getHeaders() });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token in settings to increase limits.');
      }
      if (response.status === 404) {
        throw new Error('Directory not found. Check if the URL is correct and the repository is public (or provide a token for private repos).');
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  };

  const getAllFilesRecursive = async (owner: string, repo: string, path: string, branch: string): Promise<GitHubFile[]> => {
    const contents = await fetchDirectoryContents(owner, repo, path, branch);
    let files: GitHubFile[] = [];

    for (const item of contents) {
      if (item.type === 'file') {
        files.push(item);
      } else if (item.type === 'dir') {
        const subFiles = await getAllFilesRecursive(owner, repo, item.path, branch);
        files = [...files, ...subFiles];
      }
    }

    return files;
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus('fetching');
    setError(null);
    setProgress({ total: 0, current: 0 });

    try {
      const { owner, repo, branch, path } = parseGitHubUrl(url);
      setRepoInfo({ owner, repo, path });

      // 1. Fetch all file metadata recursively
      const allFiles = await getAllFilesRecursive(owner, repo, path, branch);
      
      if (allFiles.length === 0) {
        throw new Error('No files found in this directory.');
      }

      setProgress({ total: allFiles.length, current: 0 });
      setStatus('downloading');

      // 2. Download each file and add to ZIP
      const zip = new JSZip();
      
      // We'll process downloads in small batches to avoid overwhelming the browser/network
      const batchSize = 5;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(async (file) => {
          if (!file.download_url) return;
          
          const response = await fetch(file.download_url, { headers: getHeaders() });
          if (!response.ok) throw new Error(`Failed to download ${file.path}`);
          
          const blob = await response.blob();
          
          const pathSegments = path.split('/').filter(Boolean);
          const prefixToRemove = pathSegments.slice(0, -1).join('/');
          const zipPath = prefixToRemove 
            ? file.path.replace(`${prefixToRemove}/`, '') 
            : file.path;

          zip.file(zipPath, blob);
          setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }));
      }

      // 3. Generate and save ZIP
      setStatus('zipping');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = `${path.split('/').pop() || repo}.zip`;
      saveAs(zipBlob, fileName);

      setStatus('success');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Github size={20} />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">GitDir Downloader</h1>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              GitHub <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Hero Section */}
          <section className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Download any GitHub directory.
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Paste a GitHub folder URL to download all its contents as a single ZIP archive. 
              Fast, recursive, and open-source.
            </p>
          </section>

          {/* Input Form */}
          <section className="max-w-2xl mx-auto space-y-4">
            <form onSubmit={handleDownload} className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/tree/main/path/to/dir"
                className="w-full pl-12 pr-32 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              />
              <button
                type="submit"
                disabled={!url.trim() || (status !== 'idle' && status !== 'success' && status !== 'error')}
                className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center gap-2"
              >
                {status === 'fetching' || status === 'downloading' || status === 'zipping' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    Download <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Token Input Directly Below */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Key size={18} />
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="GitHub Token (Optional, e.g. ghp_...)"
                className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-slate-900 placeholder:text-slate-400"
                disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              />
              {token && (
                <button 
                  onClick={() => setToken('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-slate-400 px-2">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Recursive fetching</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} /> ZIP bundling</span>
              <span className="flex items-center gap-1">
                {token ? <CheckCircle2 size={12} className="text-emerald-500" /> : <CheckCircle2 size={12} />} 
                {token ? 'Token active' : 'No login required'}
              </span>
            </div>
          </section>

          {/* Status & Progress */}
          <AnimatePresence mode="wait">
            {(status !== 'idle' || error) && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <div className={cn(
                  "p-6 rounded-2xl border shadow-sm",
                  status === 'error' ? "bg-red-50 border-red-100" : "bg-white border-slate-200"
                )}>
                  {status === 'error' ? (
                    <div className="flex items-start gap-4 text-red-700">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertCircle size={24} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold">Download Failed</h3>
                        <p className="text-sm opacity-90">{error}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button 
                            onClick={() => setStatus('idle')}
                            className="text-xs font-bold uppercase tracking-wider hover:underline"
                          >
                            Try Again
                          </button>
                          {!token && (
                            <button 
                              onClick={() => {
                                setStatus('idle');
                              }}
                              className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:underline"
                            >
                              Check Token
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : status === 'success' ? (
                    <div className="flex items-start gap-4 text-emerald-700">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold">Download Complete!</h3>
                        <p className="text-sm opacity-90">
                          Successfully bundled {progress.total} files into a ZIP archive.
                        </p>
                        <button 
                          onClick={() => setStatus('idle')}
                          className="mt-2 text-xs font-bold uppercase tracking-wider hover:underline"
                        >
                          Download Another
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            {status === 'fetching' ? <Search size={20} /> : <Download size={20} />}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {status === 'fetching' ? 'Analyzing Repository...' : 
                               status === 'downloading' ? 'Downloading Files...' : 
                               'Creating Archive...'}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : 'Connecting to GitHub...'}
                            </p>
                          </div>
                        </div>
                        {status === 'downloading' && (
                          <span className="text-sm font-mono font-medium text-slate-400">
                            {progress.current} / {progress.total}
                          </span>
                        )}
                      </div>

                      {status === 'downloading' && (
                        <div className="space-y-2">
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold text-center">
                            Processing batch...
                          </p>
                        </div>
                      )}

                      {status === 'zipping' && (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="animate-spin text-indigo-500" />
                            <p className="text-sm text-slate-500 animate-pulse">Compressing files into ZIP...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Examples */}
          <section className="max-w-2xl mx-auto pt-8 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Try these examples</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  name: 'Candle Examples',
                  url: 'https://github.com/huggingface/candle/tree/main/candle-examples/examples/based',
                  desc: 'HuggingFace Candle ML framework examples'
                },
                {
                  name: 'Lucide Icons',
                  url: 'https://github.com/lucide-icons/lucide/tree/main/icons',
                  desc: 'The core SVG icon set'
                }
              ].map((example) => (
                <button
                  key={example.url}
                  onClick={() => setUrl(example.url)}
                  className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-indigo-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{example.name}</span>
                    <Folder size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{example.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-sm text-slate-400">
          Built with React, Tailwind CSS, and JSZip. 
          <br />
          Respects GitHub API rate limits.
        </p>
      </footer>
    </div>
  );
}
