"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Cinematic two-phase intro — seamless black-to-black handoff.
 * 
 * Phase 1: echona_ink_intro.mp4 plays → fades to black naturally.
 * Phase 2: Scroll animation starts from near-black frame #1.
 *          User scrolls → pirate ship emerges from darkness.
 * 
 * The transition is invisible because both end/start in black.
 * No gimmicks. Just cinema.
 */

const FRAME_COUNT = 240;
const IMG_PATH = (i: number) => `/frames/frame_${String(i).padStart(4, '0')}.webp`;

interface IntroSequenceProps {
  onComplete: () => void;
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<'ink' | 'scroll'>('ink');
  const [loadProgress, setLoadProgress] = useState(0);
  const [framesLoaded, setFramesLoaded] = useState(false);
  const [scrollFrac, setScrollFrac] = useState(0);

  // ═══════════════════════════════════════════════════════
  // 1. Preload frames in background during video playback
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = new Array(FRAME_COUNT);

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = IMG_PATH(i + 1);
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
        if (loadedCount === FRAME_COUNT) {
          imagesRef.current = images;
          setFramesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        setLoadProgress(Math.floor((loadedCount / FRAME_COUNT) * 100));
      };
      images[i] = img;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════
  // 2. Play video → switch to scroll on end
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      // Seamless handoff: video ends on black, scroll starts on black
      window.scrollTo(0, 0);
      setPhase('scroll');
    };

    video.addEventListener('ended', handleEnded);
    video.play().catch(() => {});

    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  // ═══════════════════════════════════════════════════════
  // 3. Draw frame (cover-fit)
  // ═══════════════════════════════════════════════════════
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imagesRef.current[frameIndex];
    if (!canvas || !ctx || !img || !img.complete) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    const sx = (cw - sw) / 2;
    const sy = (ch - sh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh);
  }, []);

  // ═══════════════════════════════════════════════════════
  // 4. Scroll → frame mapping
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'scroll' || !framesLoaded) return;

    drawFrame(0);

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollTop = window.scrollY;
        const maxScroll = container.scrollHeight - window.innerHeight;
        const fraction = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        const frameIndex = Math.min(
          Math.floor(fraction * (FRAME_COUNT - 1)),
          FRAME_COUNT - 1
        );

        if (frameIndex !== currentFrameRef.current) {
          currentFrameRef.current = frameIndex;
          drawFrame(frameIndex);
        }

        setScrollFrac(fraction);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const handleResize = () => drawFrame(currentFrameRef.current);
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, framesLoaded, drawFrame]);

  // ═══════════════════════════════════════════════════════
  // 5. Begin Quest exit
  // ═══════════════════════════════════════════════════════
  const handleBeginQuest = () => {
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
  };

  const showScrollHint = phase === 'scroll' && scrollFrac < 0.08;
  const showButton = phase === 'scroll' && scrollFrac > 0.85;

  // ═══════════════════════════════════════════════════════
  // 6. Render
  // ═══════════════════════════════════════════════════════

  // PHASE: INK VIDEO
  if (phase === 'ink') {
    return (
      <div className="fixed inset-0 z-[200] bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src="/echona_ink_intro.mp4"
          muted
          playsInline
          preload="auto"
        />

      </div>
    );
  }

  // PHASE: SCROLL ANIMATION
  return (
    <div
      ref={scrollContainerRef}
      className="intro-scroll-container relative bg-black"
      style={{ height: '500vh' }}
    >
      <div className="scroll-viewport sticky top-0 h-screen w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: 'block' }}
        />

        {/* Custom Pirate Top Scroll Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] z-[100] bg-black/60 shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          <div 
            className="h-full bg-white origin-left will-change-transform"
            style={{ 
              transform: `scaleX(${scrollFrac})`, 
              boxShadow: '0 0 12px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,1)',
              transition: 'transform 0.1s ease-out'
            }} 
          />
        </div>

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        {/* Scroll hint */}
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-16 pointer-events-none"
          style={{
            opacity: showScrollHint ? 1 : 0,
            transition: 'opacity 0.8s ease',
          }}
        >
          <p
            className="font-pirate tracking-[0.4em] uppercase text-sm select-none mb-3"
            style={{
              color: '#D4AF37',
              textShadow: '0 0 20px rgba(212,175,55,0.3)',
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

        {/* Begin Quest */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center"
          style={{
            opacity: showButton ? 1 : 0,
            pointerEvents: showButton ? 'auto' : 'none',
            transition: 'opacity 0.8s ease',
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="font-pirate text-4xl md:text-6xl text-[#E8DFC8] tracking-widest drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] mb-4 select-none">
              The Quest Begins
            </h2>
            <p className="text-gray-400 text-lg mb-10 italic select-none">
              Your fate awaits beyond the horizon.
            </p>
            <button
              onClick={handleBeginQuest}
              className="px-12 py-5 bg-[#7A1F1F]/90 backdrop-blur-sm text-[#E8DFC8] font-pirate text-xl md:text-2xl uppercase tracking-[0.2em] border-2 border-[#D4AF37]/50 cursor-pointer relative overflow-hidden group shadow-[0_0_40px_rgba(122,31,31,0.5)] hover:shadow-[0_0_60px_rgba(212,175,55,0.3)] hover:scale-105 transition-all duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.15)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10">Unfurl The Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
