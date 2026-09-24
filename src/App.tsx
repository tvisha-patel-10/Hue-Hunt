/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, ArrowRight, ChevronLeft, Share2, Volume2, VolumeX } from 'lucide-react';
import { ColorHSL, RoundResult, FUN_MESSAGES } from './types';
import { oklab, differenceEuclidean } from 'culori';
import { sounds } from './audio';

const TOTAL_ROUNDS = 3;

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'memorize' | 'guess' | 'reveal' | 'results'>('start');
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [targetColor, setTargetColor] = useState<ColorHSL>({ h: 0, s: 0, l: 0 });
  const [userGuess, setUserGuess] = useState<ColorHSL>({ h: 180, s: 50, l: 50 });
  const [results, setResults] = useState<RoundResult[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Throttle slider sounds so it feels responsive without overwhelming
  const lastSliderAudioTime = useRef<number>(0);

  const toggleSound = () => {
    const next = !soundEnabled;
    sounds.enabled = next;
    setSoundEnabled(next);
    if (next) {
      sounds.playClick();
    }
  };

  const playSliderAudio = (ratio: number) => {
    const now = performance.now();
    if (now - lastSliderAudioTime.current > 45) {
      lastSliderAudioTime.current = now;
      sounds.playSliderTick(ratio);
    }
  };

  const generateRandomColor = () => {
    return {
      h: Math.floor(Math.random() * 360),
      s: Math.floor(Math.random() * 60) + 30, // 30-90%
      l: Math.floor(Math.random() * 40) + 30, // 30-70%
    };
  };

  const startNextRound = useCallback((_r: number) => {
    const color = generateRandomColor();
    setTargetColor(color);
    setUserGuess({ h: 180, s: 50, l: 50 });
    setCountdown(3);
    setGameState('memorize');
    sounds.playTick(false);
  }, []);

  const startGame = () => {
    sounds.playClick();
    setRound(1);
    setResults([]);
    startNextRound(1);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'memorize' && countdown > 0) {
      timer = setTimeout(() => {
        const nextVal = countdown - 1;
        setCountdown(nextVal);
        if (nextVal > 0) {
          sounds.playTick(false);
        } else {
          sounds.playTick(true);
        }
      }, 1000);
    } else if (gameState === 'memorize' && countdown === 0) {
      setGameState('guess');
    }
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  const calculateScore = (target: ColorHSL, guess: ColorHSL) => {
    const targetCulori = { mode: 'hsl' as const, h: target.h, s: target.s / 100, l: target.l / 100 };
    const guessCulori = { mode: 'hsl' as const, h: guess.h, s: guess.s / 100, l: guess.l / 100 };
    
    const targetOklab = oklab(targetCulori);
    const guessOklab = oklab(guessCulori);
    
    const diff = differenceEuclidean('oklab');
    const distance = diff(targetOklab, guessOklab);
    
    const maxDistance = 0.25;
    const accuracyRaw = Math.max(0, 1 - (distance / maxDistance));
    
    const accuracy = Math.pow(accuracyRaw, 0.7);
    const score = Math.floor(accuracy * 1000);
    
    return { score, accuracy: Math.floor(accuracy * 100) };
  };

  const handleReveal = () => {
    const { score, accuracy } = calculateScore(targetColor, userGuess);
    const newResult: RoundResult = { target: targetColor, guess: userGuess, score, accuracy };
    setResults(prev => [...prev, newResult]);
    setGameState('reveal');
    sounds.playReveal();
  };

  const handleNext = () => {
    sounds.playClick();
    if (round < TOTAL_ROUNDS) {
      setRound(prev => prev + 1);
      startNextRound(round + 1);
    } else {
      setGameState('results');
      sounds.playFanfare();
    }
  };

  const hslToCss = (hsl: ColorHSL) => `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  const getFunMessage = (accuracy: number) => {
    if (accuracy >= 98) return FUN_MESSAGES.perfect[Math.floor(Math.random() * FUN_MESSAGES.perfect.length)];
    if (accuracy >= 90) return FUN_MESSAGES.good[Math.floor(Math.random() * FUN_MESSAGES.good.length)];
    if (accuracy >= 70) return FUN_MESSAGES.average[Math.floor(Math.random() * FUN_MESSAGES.average.length)];
    return FUN_MESSAGES.bad[Math.floor(Math.random() * FUN_MESSAGES.bad.length)];
  };

  const handleShare = async () => {
    sounds.playClick();
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const text = `I scored ${totalScore} points in Hue Hunt! Can you beat my visual memory? 🎨✨`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hue Hunt', text, url });
      } catch {
        // User dismissed share dialog
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
      } catch {
        // Clipboard fallback
      }
    }
  };

  const currentTotalScore = results.reduce((sum, r) => sum + r.score, 0);
  const avgAccuracy = results.length > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / results.length) 
    : 0;

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-y-auto overflow-x-hidden selection:bg-black selection:text-white">
      {/* Sound Toggle Button */}
      <button
        onClick={toggleSound}
        className="fixed top-4 right-4 z-50 p-2.5 bg-white/80 backdrop-blur-md hover:bg-white border border-gray-200/60 rounded-full shadow-sm text-gray-700 hover:text-black transition-all cursor-pointer"
        aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
        title={soundEnabled ? 'Mute sound' : 'Enable sound'}
      >
        {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="text-gray-400" />}
      </button>

      <AnimatePresence mode="wait">
        {gameState === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto w-full"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-400 to-pink-500 mb-8 shadow-lg" />
            <h1 className="text-4xl font-extrabold tracking-tighter mb-4">HUE HUNT</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Test your visual memory. Memorize the color, then recreate it perfectly across 3 rounds.
            </p>
            
            <div className="w-full space-y-3 mb-8">
              <button
                onClick={startGame}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
              >
                START GAME
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'memorize' && (
          <motion.div
            key="memorize"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-between p-8 text-white"
            style={{ backgroundColor: hslToCss(targetColor) }}
          >
            <div className="flex justify-between w-full font-bold tracking-widest text-xs opacity-80 pr-12">
              <span>ROUND {round} OF {TOTAL_ROUNDS}</span>
              <span>SCORE: {currentTotalScore}</span>
            </div>
            
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-9xl font-black opacity-20"
            >
              {countdown}
            </motion.div>

            <div className="font-bold tracking-widest text-sm mb-8">
              MEMORIZE THE COLOR
            </div>
          </motion.div>
        )}

        {gameState === 'guess' && (
          <motion.div
            key="guess"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full min-h-full"
          >
            <div className="flex justify-between w-full font-bold tracking-widest text-[10px] text-gray-400 mb-8 pt-4 pr-10">
              <span>ROUND {round} OF {TOTAL_ROUNDS}</span>
              <span>SCORE: {currentTotalScore}</span>
            </div>

            <div className="flex-1 flex flex-col space-y-8">
              <div 
                className="w-full aspect-square rounded-[40px] shadow-inner flex items-center justify-center transition-colors duration-200"
                style={{ backgroundColor: hslToCss(userGuess) }}
              >
                <span className="text-white/50 font-bold tracking-widest text-sm uppercase">Your Guess</span>
              </div>

              <div className="w-full space-y-10 bg-gray-50 p-8 rounded-[40px] mb-8">
                <div className="space-y-4">
                  <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <span>Hue</span>
                    <span className="text-black">{userGuess.h}°</span>
                  </div>
                  <input 
                    type="range" min="0" max="360" value={userGuess.h}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' 
                    }}
                    aria-label="Hue"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setUserGuess(prev => ({ ...prev, h: val }));
                      playSliderAudio(val / 360);
                    }}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <span>Saturation</span>
                    <span className="text-black">{userGuess.s}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" value={userGuess.s}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{ 
                      background: `linear-gradient(to right, hsl(${userGuess.h}, 0%, ${userGuess.l}%), hsl(${userGuess.h}, 100%, ${userGuess.l}%))` 
                    }}
                    aria-label="Saturation"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setUserGuess(prev => ({ ...prev, s: val }));
                      playSliderAudio(val / 100);
                    }}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <span>Brightness</span>
                    <span className="text-black">{userGuess.l}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" value={userGuess.l}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{ 
                      background: `linear-gradient(to right, #000, hsl(${userGuess.h}, ${userGuess.s}%, 50%), #fff)` 
                    }}
                    aria-label="Brightness"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setUserGuess(prev => ({ ...prev, l: val }));
                      playSliderAudio(val / 100);
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleReveal}
                className="w-full py-6 bg-black text-white rounded-[32px] font-black text-lg hover:bg-gray-900 active:scale-95 transition-all mb-12 shadow-xl shadow-black/10 cursor-pointer"
              >
                REVEAL
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'reveal' && results.length > 0 && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative"
          >
            <div className="flex-1 flex flex-col">
              <div className="min-h-[50vh] w-full relative" style={{ backgroundColor: hslToCss(results[results.length - 1].target) }}>
                <div className="absolute top-8 left-8 text-white/50 font-bold tracking-widest text-xs">ORIGINAL</div>
              </div>
              <div className="min-h-[50vh] w-full relative" style={{ backgroundColor: hslToCss(results[results.length - 1].guess) }}>
                <div className="absolute bottom-8 left-8 text-white/50 font-bold tracking-widest text-xs">YOUR GUESS</div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 z-10 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-[32px] sm:rounded-[48px] shadow-2xl text-center w-full max-w-xs my-auto"
                >
                  <div className="text-6xl font-black mb-1">{results[results.length - 1].accuracy}%</div>
                  <div className="text-[10px] font-bold text-gray-400 tracking-[0.2em] mb-1 uppercase">Accuracy</div>
                  <div className="text-xl font-bold mb-6 text-gray-900">+{results[results.length - 1].score} PTS</div>
                  
                  <div className="h-px bg-gray-100 w-12 mx-auto mb-6" />
                  
                  <p className="text-lg font-semibold mb-8">
                    {getFunMessage(results[results.length - 1].accuracy)}
                  </p>

                  <button
                    onClick={handleNext}
                    className="w-full py-4 bg-black text-white rounded-3xl font-bold flex items-center justify-center gap-2 hover:gap-4 transition-all cursor-pointer"
                  >
                    {round < TOTAL_ROUNDS ? 'GO NEXT' : 'SEE RESULTS'}
                    <ArrowRight size={20} />
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col p-6 overflow-y-auto max-w-md mx-auto w-full"
          >
            <div className="flex items-center justify-between mb-8 pr-10">
              <button 
                onClick={() => {
                  sounds.playClick();
                  setGameState('start');
                }} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer" 
                aria-label="Go to start"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-bold tracking-tight">YOUR SCORE</h2>
              <div className="w-10" />
            </div>

            <div className="bg-gray-50 rounded-[40px] p-8 mb-6 text-center">
              <div className="text-6xl font-black mb-1">
                {avgAccuracy}%
              </div>
              <div className="text-[10px] font-bold text-gray-400 tracking-[0.2em] mb-4 uppercase">Avg Accuracy</div>
              <div className="text-lg font-bold text-gray-600">
                {currentTotalScore} TOTAL POINTS
              </div>
            </div>

            {/* Round Breakdown */}
            <div className="space-y-3 mb-8">
              <div className="text-[10px] font-bold text-gray-400 tracking-widest px-4 uppercase">
                Round Breakdown
              </div>
              {results.map((res, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-gray-400 w-5">#{i + 1}</div>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: hslToCss(res.target) }}
                        title="Original"
                      />
                      <div 
                        className="w-6 h-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: hslToCss(res.guess) }}
                        title="Your Guess"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-gray-900">{res.accuracy}%</span>
                    <span className="text-xs text-gray-400 ml-2">+{res.score} pts</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={startGame}
                className="w-full py-5 bg-black text-white rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-gray-900 cursor-pointer transition-colors"
              >
                PLAY AGAIN
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={handleShare}
                className="w-full py-4 text-gray-500 font-bold flex items-center justify-center gap-2 hover:text-black transition-colors cursor-pointer"
              >
                <Share2 size={18} />
                SHARE SCORE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
