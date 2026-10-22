"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Universal Responsive Scroll Interactive Voyage Sequence.
 * 
 * Works smoothly across all screen sizes (Desktop 4K/1440p/1080p, Laptops, Tablets, Mobile):
 * - Device-pixel-ratio aware canvas backing store (retina sharp, zero GPU buffer re-allocations).
 * - Aspect-ratio cover fit: dynamically adapts to ultrawide, 16:9, and mobile portrait displays.
 * - Fluid momentum interpolation (lerp): absorbs desktop mouse wheel discrete ticks for 60fps/120fps motion.
 * - Closest-frame fallback: never flashes black if a frame is still buffering.
 * - Sticky viewport with 100dvh fallback for mobile and desktop browser chrome.
 */

const TOTAL_FRAMES = 240;
const IMG_PATH = (i: number) => `/frames/frame_${String(i).padStart(4, '0')}.webp`;

interface IntroSequenceProps {
  onComplete: () => void;
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number>(0);
  const [scrollFrac, setScrollFrac] = useState(0);

  // Exit animation when clicking "Unfurl The Map"
  const handleBeginQuest = useCallback(() => {
    gsap.to('.scroll-viewport', {
      scale: 1.8,
      opacity: 0,
      filter: 'blur(20px)',
      duration: 1.2,
      ease: 'power3.in',
      onComplete: () => {
        window.scrollTo(0, 0);
        setTimeout(onComplete, 200);
      },
    });
  }, [onComplete]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const images: (HTMLImageElement | null)[] = new Array(TOTAL_FRAMES).fill(null);
    const loadedFrames = new Set<number>();

    let targetProgress = 0;
    let currentProgress = 0;
    let lastDrawnIndex = -1;

    // Responsive aspect-ratio cover fit
    const drawImageToCanvas = (img: HTMLImageElement) => {
      const cw = canvas.width;
      const ch = canvas.height;
      if (cw === 0 || ch === 0) return;

      const iw = img.naturalWidth || 1920;
      const ih = img.naturalHeight || 1080;
      const imgRatio = iw / ih;
      const canvasRatio = cw / ch;

      let drawW = cw;
      let drawH = ch;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
        drawW = cw;
        drawH = cw / imgRatio;
        offsetY = (ch - drawH) / 2;
      } else {
        drawH = ch;
        drawW = ch * imgRatio;
        offsetX = (cw - drawW) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    };

    // Render frame with closest loaded frame fallback (never blank)
    const renderFrameAt = (frameIndex: number) => {
      const clamped = Math.max(1, Math.min(frameIndex, TOTAL_FRAMES));
      let targetImg = images[clamped - 1];

      if (!targetImg || !targetImg.complete || (targetImg.naturalWidth || 0) === 0) {
        let closest = -1;
        let minDiff = Infinity;
        for (const loaded of loadedFrames) {
          const diff = Math.abs(loaded - clamped);
          if (diff < minDiff) {
            minDiff = diff;
            closest = loaded;
          }
        }
        if (closest !== -1) {
          targetImg = images[closest - 1];
        }
      }

      if (targetImg && targetImg.complete && (targetImg.naturalWidth || 0) > 0) {
        drawImageToCanvas(targetImg);
        lastDrawnIndex = clamped;
      }
    };

    // Resize canvas buffer ONLY on window resize (not on every draw)
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      if (lastDrawnIndex > 0) {
        renderFrameAt(lastDrawnIndex);
      }
    };

    resizeCanvas();

    // Priority 1: Load frame 1 immediately and paint
    const firstImg = new Image();
    firstImg.src = IMG_PATH(1);
    images[0] = firstImg;
    firstImg.onload = () => {
      loadedFrames.add(1);
      resizeCanvas();
      renderFrameAt(1);
    };

    // Preload remaining frames
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = IMG_PATH(i);
      const idx = i;
      img.onload = () => {
        loadedFrames.add(idx);
        if (lastDrawnIndex === idx) {
          renderFrameAt(idx);
        }
      };
      images[i - 1] = img;
    }

    // Measure scroll progress relative to stage
    const updateScrollMetrics = () => {
      const rect = stage.getBoundingClientRect();
      const distance = stage.offsetHeight - window.innerHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0;
      targetProgress = progress;
      setScrollFrac(progress);
    };

    // 60fps/120fps fluid momentum interpolation loop (absorbs desktop mouse wheel jumps)
    const renderLoop = () => {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) > 0.0002) {
        currentProgress += diff * 0.18;
        if (Math.abs(targetProgress - currentProgress) < 0.0005) {
          currentProgress = targetProgress;
        }
        const targetFrameIndex = Math.min(
          TOTAL_FRAMES,
          Math.max(1, Math.round(currentProgress * (TOTAL_FRAMES - 1)) + 1)
        );
        renderFrameAt(targetFrameIndex);
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    updateScrollMetrics();
    window.addEventListener('scroll', updateScrollMetrics, { passive: true });
    window.addEventListener('resize', () => {
      resizeCanvas();
      updateScrollMetrics();
    });

    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('scroll', updateScrollMetrics);
      window.removeEventListener('resize', resizeCanvas);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const showScrollHint = scrollFrac < 0.08;
  const showButton = scrollFrac > 0.85;

  return (
    <div
      ref={stageRef}
      className="intro-scroll-container relative bg-black w-full"
      style={{ height: '450vh' }}
    >
      <div className="scroll-viewport sticky top-0 h-screen h-[100dvh] w-full overflow-hidden">
        {/* High-fidelity Responsive Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ objectFit: 'cover' }}
        />

        {/* Custom Pirate Top Scroll Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] z-[100] bg-black/60 shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          <div 
            className="h-full bg-white origin-left will-change-transform"
            style={{ 
              transform: `scaleX(${scrollFrac})`, 
              boxShadow: '0 0 12px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,1)',
              transition: 'transform 0.08s ease-out'
            }} 
          />
        </div>

        {/* Cinematic Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        {/* Scroll hint (bounces on desktop and mobile until user scrolls) */}
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-12 sm:pb-16 pointer-events-none"
          style={{
            opacity: showScrollHint ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          <p
            className="font-pirate tracking-[0.4em] uppercase text-xs sm:text-sm select-none mb-3"
            style={{
              color: '#D4AF37',
              textShadow: '0 0 20px rgba(212,175,55,0.4)',
            }}
          >
            Scroll to sail
          </p>
          <div className="animate-bounce">
            <svg
              className="w-5 h-5 mx-auto"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="#D4AF37"
              style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.4))' }}
            >
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* The Quest Begins Milestone overlay */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4"
          style={{
            opacity: showButton ? 1 : 0,
            pointerEvents: showButton ? 'auto' : 'none',
            transition: 'opacity 0.8s ease',
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
          <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto">
            <h2 className="font-pirate text-3xl sm:text-5xl md:text-6xl text-[#E8DFC8] tracking-widest drop-shadow-[0_0_20px_rgba(0,0,0,0.9)] mb-3 select-none">
              The Quest Begins
            </h2>
            <p className="text-gray-300 text-sm sm:text-base md:text-lg mb-8 sm:mb-10 italic select-none">
              Your fate awaits beyond the horizon.
            </p>
            <button
              onClick={handleBeginQuest}
              className="px-8 sm:px-12 py-4 sm:py-5 bg-[#7A1F1F]/90 backdrop-blur-sm text-[#E8DFC8] font-pirate text-lg sm:text-xl md:text-2xl uppercase tracking-[0.2em] border-2 border-[#D4AF37]/60 cursor-pointer relative overflow-hidden group shadow-[0_0_40px_rgba(122,31,31,0.6)] hover:shadow-[0_0_60px_rgba(212,175,55,0.4)] hover:scale-105 transition-all duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.2)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10">Unfurl The Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
