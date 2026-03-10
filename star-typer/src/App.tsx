/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Shield, Zap, Trophy, Play, RefreshCw, Keyboard, Volume2, VolumeX, Heart } from 'lucide-react';
import { soundService } from './services/soundService';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const INITIAL_SPEED = 0.5;
const SPEED_INCREMENT = 0.05;
const SPAWN_RATE = 2000; // ms
const MIN_SPAWN_RATE = 800;

const WORDS = [
  "star", "nova", "void", "ship", "laser", "plasma", "nebula", "galaxy", "comet", "orbit",
  "proton", "electron", "neutron", "atom", "energy", "matter", "space", "time", "light", "dark",
  "planet", "moon", "sun", "earth", "mars", "venus", "jupiter", "saturn", "uranus", "neptune",
  "asteroid", "meteor", "pulsar", "quasar", "blackhole", "gravity", "vacuum", "cosmos", "rocket", "shuttle",
  "engine", "thrust", "vector", "matrix", "quantum", "physics", "science", "future", "beyond", "infinity"
];

// --- Types ---
interface Word {
  id: number;
  text: string;
  typed: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [customWords, setCustomWords] = useState<string[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [wordSource, setWordSource] = useState<'DEFAULT' | 'AI' | 'URL'>('DEFAULT');
  const [lives, setLives] = useState(5);

  // Game Refs
  const wordsRef = useRef<Word[]>([]);
  const targetWordIdRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);
  const speedRef = useRef(INITIAL_SPEED);
  const spawnRateRef = useRef(SPAWN_RATE);
  const scoreRef = useRef(0);
  const wordsEliminatedRef = useRef(0);
  const levelRef = useRef(1);
  const customWordsRef = useRef<string[] | null>(null);
  const livesRef = useRef(5);

  // Sync customWords state to ref
  useEffect(() => {
    customWordsRef.current = customWords;
  }, [customWords]);

  // --- Game Logic ---

  const spawnWord = useCallback(() => {
    const isFast = Math.random() < 0.15; // 15% 概率生成高速单词
    // Use customWords from ref (to avoid stale closure), fallback to default WORDS
    const wordList = customWordsRef.current && customWordsRef.current.length > 0
      ? customWordsRef.current
      : WORDS;
    const baseText = wordList[Math.floor(Math.random() * wordList.length)];
    const x = Math.random() * (CANVAS_WIDTH - 100) + 50;
    const id = Date.now() + Math.random();
    
    let color = '#60a5fa'; // 默认蓝色
    let speedMultiplier = (0.8 + Math.random() * 0.4);
    let text = baseText;

    if (isFast) {
      // 高速拦截者设计：短小、极快、粉色
      color = '#f472b6'; 
      speedMultiplier = 1.5 + Math.random() * 0.3; 
      text = baseText.substring(0, Math.min(baseText.length, 4)); // 缩短单词
    } else {
      if (text.length > 6) color = '#f87171'; // 红色（长单词）
      else if (text.length > 4) color = '#fbbf24'; // 黄色（中等）
    }

    wordsRef.current.push({
      id,
      text,
      typed: '',
      x,
      y: -20,
      speed: speedRef.current * speedMultiplier,
      color
    });
  }, []);

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1.0,
        color
      });
    }
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING') return;

    // Spawn words
    if (time - lastSpawnTimeRef.current > spawnRateRef.current) {
      spawnWord();
      lastSpawnTimeRef.current = time;
    }

    // Update words
    for (let i = wordsRef.current.length - 1; i >= 0; i--) {
      const word = wordsRef.current[i];
      word.y += word.speed;
      if (word.y > CANVAS_HEIGHT - 40) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        soundService.playExplosion();
        wordsRef.current.splice(i, 1); // Remove the word that reached the bottom
        if (livesRef.current <= 0) {
          setGameState('GAMEOVER');
          soundService.playGameOver();
        }
      }
    }

    // Update particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Difficulty scaling: Level up every 15 words
    if (!isZenMode && wordsEliminatedRef.current >= levelRef.current * 15) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      speedRef.current += SPEED_INCREMENT;
      spawnRateRef.current = Math.max(MIN_SPAWN_RATE, spawnRateRef.current - 100);
      soundService.playLevelUp();
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background stars (static-ish)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * CANVAS_WIDTH;
      const y = (Math.cos(i * 543.21) * 0.5 + 0.5) * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw words
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    wordsRef.current.forEach(word => {
      const isTarget = word.id === targetWordIdRef.current;
      const isFast = word.speed > speedRef.current * 1.5;
      
      // Draw laser if target
      if (isTarget) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
        ctx.lineTo(word.x, word.y + 10);
        ctx.stroke();
      }

      // Shadow/Glow
      ctx.shadowBlur = isTarget ? 20 : (isFast ? 15 : 5);
      ctx.shadowColor = word.color;

      // Draw "FAST" indicator for interceptors
      if (isFast) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = word.color;
        ctx.fillText('HIGH SPEED', word.x, word.y - 25);
        ctx.font = 'bold 20px "JetBrains Mono", monospace';
      }

      // Typed part
      ctx.fillStyle = '#ffffff';
      const typedWidth = ctx.measureText(word.typed).width;
      const fullWidth = ctx.measureText(word.text).width;
      const startX = word.x - fullWidth / 2;

      ctx.fillText(word.typed, startX + typedWidth / 2, word.y);

      // Untyped part
      ctx.fillStyle = word.color;
      ctx.globalAlpha = isTarget ? 1 : 0.7;
      const untypedText = word.text.substring(word.typed.length);
      ctx.fillText(untypedText, startX + typedWidth + ctx.measureText(untypedText).width / 2, word.y);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    // Draw particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw ship
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.lineTo(CANVAS_WIDTH / 2 - 15, CANVAS_HEIGHT - 10);
    ctx.lineTo(CANVAS_WIDTH / 2 + 15, CANVAS_HEIGHT - 10);
    ctx.closePath();
    ctx.fill();
  };

  const gameLoop = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      update(time);
      draw(ctx);
    }
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState]);

  // --- Input Handling ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      const char = e.key.toLowerCase();
      if (char.length !== 1) return;

      if (targetWordIdRef.current === null) {
        // Find a word starting with this char
        const match = wordsRef.current.find(w => w.text[0] === char);
        if (match) {
          targetWordIdRef.current = match.id;
          match.typed = char;
          soundService.playLaser();
          checkWordComplete(match);
        }
      } else {
        const target = wordsRef.current.find(w => w.id === targetWordIdRef.current);
        if (target) {
          const nextChar = target.text[target.typed.length];
          if (char === nextChar) {
            target.typed += char;
            soundService.playLaser();
            checkWordComplete(target);
          }
        }
      }
    };

    const checkWordComplete = (word: Word) => {
      if (word.typed === word.text) {
        createExplosion(word.x, word.y, word.color);
        soundService.playExplosion();
        wordsRef.current = wordsRef.current.filter(w => w.id !== word.id);
        targetWordIdRef.current = null;
        wordsEliminatedRef.current += 1;
        scoreRef.current += word.text.length * 10;
        setScore(scoreRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // --- Controls ---

  const startGame = (useCustom: boolean = false) => {
    if (useCustom && (!customWords || customWords.length === 0)) {
      return;
    }
    wordsRef.current = [];
    particlesRef.current = [];
    targetWordIdRef.current = null;
    scoreRef.current = 0;
    wordsEliminatedRef.current = 0;
    levelRef.current = 1;
    livesRef.current = 5;
    setScore(0);
    setLevel(1);
    setLives(5);
    speedRef.current = INITIAL_SPEED;
    spawnRateRef.current = SPAWN_RATE;
    setGameState('PLAYING');
    if (isZenMode) {
      soundService.startZenMusic();
    }
  };

  useEffect(() => {
    if (gameState === 'GAMEOVER' || gameState === 'START') {
      soundService.stopZenMusic();
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      if (score > highScore) setHighScore(score);
    }
  }, [gameState, score, highScore]);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundService.setEnabled(newState);
  };

  const handleFetchWords = async () => {
    if (!urlInput) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/fetch-words?url=${encodeURIComponent(urlInput)}`);
      const data = await response.json();
      if (data.error) {
        setFetchError(data.error);
      } else {
        setCustomWords(data.words);
        // Start game with custom words
        wordsRef.current = [];
        particlesRef.current = [];
        targetWordIdRef.current = null;
        scoreRef.current = 0;
        wordsEliminatedRef.current = 0;
        levelRef.current = 1;
        setScore(0);
        setLevel(1);
        speedRef.current = INITIAL_SPEED;
        spawnRateRef.current = SPAWN_RATE;
        setGameState('PLAYING');
      }
    } catch (err) {
      setFetchError("Failed to connect to server");
    } finally {
      setIsFetching(false);
    }
  };

  const handleGenerateAIWords = async () => {
    if (!domainInput.trim()) return;
    setIsGeneratingAI(true);
    setAiError(null);
    setModelProgress(0);

    try {
      const { pipeline, env } = await import('@huggingface/transformers');

      // env.backends.onnx.logLevel = 'info';
      env.remoteHost = 'https://modelscope.cn';
      // const modelId = 'HuggingFaceTB/SmolLM2-360M-Instruct';
      const modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';

      console.log(`start load model ${modelId}...`);
      const generator = await pipeline('text-generation', modelId, {
          device: 'webgpu',
          dtype: 'q4', // 4-bit quantization for faster inference
          progress_callback: (p) => {
              if (p.status === 'progress') {
                  setModelProgress(p.progress);
              }
          },
      });
      setModelProgress('load finished, start generate words...');
      const prompt = `according to "${domainInput}", Generate 50 unique, professional terms. `;
      const messages = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
      ];
      const output = await generator(messages, { max_new_tokens: 2048, do_sample: false, enable_thinking: false });
      const generatedText = output[0].generated_text.at(-1).content

      const uniqueWords = extractWords(generatedText)
      if (uniqueWords.length > 5) {
        setCustomWords(uniqueWords);

        // Start game
        wordsRef.current = [];
        particlesRef.current = [];
        targetWordIdRef.current = null;
        scoreRef.current = 0;
        wordsEliminatedRef.current = 0;
        levelRef.current = 1;
        setScore(0);
        setLevel(1);
        speedRef.current = INITIAL_SPEED;
        spawnRateRef.current = SPAWN_RATE;
        setGameState('PLAYING');
        if (isZenMode) {
          soundService.startZenMusic();
        }
      } else {
        setAiError(`只生成 ${uniqueWords.length} 个词汇，请尝试其他领域。`);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      setAiError("WebGPU 或模型加载失败。请确认浏览器支持 WebGPU。");
    } finally {
      setIsGeneratingAI(false);
      setModelProgress(null);
    }
  };

  const extractWords = (text) => {
    const words = text
      .split(/\s+/)                         // 按空格分割
      .map(w => w.replace(/[^a-zA-Z]/g, "")) // 去掉非字母
      .filter(w => w.length >= 3)            // 去掉短词
      .filter(w => !w.includes("'"))         // 去掉包含 '
      .map(w => w.toLowerCase());            // 统一大小写

    return [...new Set(words)];              // 去重
  }
  const handleStartMission = async () => {
    if (wordSource === 'AI') {
      await handleGenerateAIWords();
    } else if (wordSource === 'URL') {
      await handleFetchWords();
    } else {
      setCustomWords(null);
      startGame();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans overflow-hidden">
      {/* Header Stats */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Score</span>
            <span className="text-2xl font-mono leading-none">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Level</span>
            <span className="text-2xl font-mono leading-none">{level}</span>
          </div>
        </div>
        <div className="flex gap-4 items-center pointer-events-auto">
          <button
            onClick={toggleSound}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title={soundEnabled ? "Mute Sound" : "Unmute Sound"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-white/60" /> : <VolumeX className="w-5 h-5 text-red-400" />}
          </button>
          <div className="flex flex-col items-end">
          </div>
        </div>
        <div className="flex gap-1">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">High Score</span>
            <span className="text-xl font-mono leading-none text-white/60">{highScore.toString().padStart(6, '0')}</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <Heart
              key={i}
              className={`w-5 h-5 ${i < lives ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            />
          ))}
        </div>
      </div>

      {/* Game Canvas Container */}
      <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-2">
                  <h1 className="text-7xl font-bold tracking-tighter italic flex items-center justify-center gap-4">
                    STAR <span className="text-blue-500">TYPER</span>
                  </h1>
                  <p className="text-white/40 uppercase tracking-[0.3em] text-xs">Interstellar Typing Combat System</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="p-4 border border-white/10 rounded-xl bg-white/5 flex flex-col items-center gap-2">
                    <Keyboard className="w-5 h-5 text-blue-400" />
                    <span className="text-[10px] uppercase font-bold text-white/60">Type to Shoot</span>
                  </div>
                  <div className="p-4 border border-white/10 rounded-xl bg-white/5 flex flex-col items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] uppercase font-bold text-white/60">Fast Reflexes</span>
                  </div>
                  <div className="p-4 border border-white/10 rounded-xl bg-white/5 flex flex-col items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold text-white/60">Defend Ship</span>
                  </div>
                </div>

                <div className="space-y-6 max-w-lg mx-auto w-full bg-white/5 p-8 rounded-3xl border border-white/10">
                  {/* Word Source Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Word Source</span>
                      <div className="flex bg-black/40 p-1 rounded-full border border-white/5">
                        {(['DEFAULT', 'AI', 'URL'] as const).map((source) => (
                          <button
                            key={source}
                            onClick={() => setWordSource(source)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                              wordSource === source ? 'bg-blue-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'
                            }`}
                          >
                            {source}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="min-h-[60px] flex flex-col justify-center">
                      {wordSource === 'AI' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                          <input
                            type="text"
                            placeholder="输入领域 / Domain (e.g. 经济学，Physics, AI)"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            className="w-full px-6 py-3 bg-black/40 border border-white/10 rounded-full focus:outline-none focus:border-emerald-500 transition-all text-sm"
                          />
                          {modelProgress !== null && (
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${modelProgress}%` }}
                              />
                            </div>
                          )}
                          {isGeneratingAI && !modelProgress && (
                            <p className="text-emerald-400 text-[10px] uppercase font-bold text-center animate-pulse">
                              正在加载模型 / Loading model...
                            </p>
                          )}
                          {aiError && <p className="text-red-400 text-[10px] uppercase font-bold text-center">{aiError}</p>}
                        </motion.div>
                      )}
                      {wordSource === 'URL' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                          <input
                            type="text"
                            placeholder="Enter URL (e.g. https://example.com)"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className="w-full px-6 py-3 bg-black/40 border border-white/10 rounded-full focus:outline-none focus:border-blue-500 transition-all text-sm"
                          />
                          {fetchError && <p className="text-red-400 text-[10px] uppercase font-bold text-center">{fetchError}</p>}
                        </motion.div>
                      )}
                      {wordSource === 'DEFAULT' && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white/40 text-xs italic">
                          Using standard interstellar vocabulary
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {/* Game Mode Selection */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Game Mode</span>
                      <div className="flex bg-black/40 p-1 rounded-full border border-white/5">
                        <button
                          onClick={() => setIsZenMode(false)}
                          className={`px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            !isZenMode ? 'bg-amber-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => setIsZenMode(true)}
                          className={`px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            isZenMode ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          Zen
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-white/20 uppercase font-bold tracking-widest">
                      {isZenMode ? "Infinite loop • No level up • Classical music" : "Progressive difficulty • Level up system • Combat sounds"}
                    </p>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleStartMission}
                    disabled={isGeneratingAI || isFetching}
                    className={`group relative w-full px-12 py-5 font-bold uppercase tracking-[0.2em] rounded-full transition-all duration-500 flex items-center justify-center gap-4 overflow-hidden shadow-2xl ${
                      isGeneratingAI || isFetching 
                        ? 'bg-white/10 text-white/20 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-blue-500 hover:text-white scale-100 hover:scale-[1.02]'
                    }`}
                  >
                    {isGeneratingAI || isFetching ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>
                          {isGeneratingAI 
                            ? (modelProgress !== null ? modelProgress : 'Loading AI Model...') 
                            : 'Fetching URL Content...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>Initiate Mission</span>
                      </>
                    )}
                    
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-6xl font-bold tracking-tighter text-white">Game Over</h2>
                  <p className="text-white/60 uppercase tracking-widest text-sm">Thanks for playing</p>
                </div>

                <div className="flex justify-center gap-12 py-8 border-y border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-white/40">Final Score</span>
                    <span className="text-4xl font-mono">{score}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-white/40">Level Reached</span>
                    <span className="text-4xl font-mono">{level}</span>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={startGame}
                    className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full hover:bg-blue-500 hover:text-white transition-all duration-300 flex items-center gap-3"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Play Again
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Instructions */}
      <div className="mt-8 text-white/20 text-[10px] uppercase tracking-[0.5em] font-bold">
        Use your keyboard to destroy incoming words
      </div>
    </div>
  );
}
