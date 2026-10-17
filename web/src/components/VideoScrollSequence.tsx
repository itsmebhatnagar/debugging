"use client";

import { useEffect, useRef, useCallback } from "react";

const TOTAL_FRAMES = 120;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

export function VideoScrollSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const heroOverlayRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const targetFrame = useRef(0);
  const currentFrame = useRef(0);
  const lastDrawnIndex = useRef(-1);
  const rafIdRef = useRef<number | null>(null);
  const isTickingRef = useRef(false);

  // Helper to find the best available frame
  const getBestFrame = useCallback((targetIdx: number): HTMLImageElement | null => {
    const images = imagesRef.current;
    const clampedIdx = Math.max(0, Math.min(targetIdx, TOTAL_FRAMES - 1));

    // 1. Direct hit
    if (images[clampedIdx]?.complete && (images[clampedIdx]?.naturalWidth || 0) > 0) {
      return images[clampedIdx];
    }

    // 2. Scan backwards
    for (let i = clampedIdx - 1; i >= 0; i--) {
      if (images[i]?.complete && (images[i]?.naturalWidth || 0) > 0) {
        return images[i];
      }
    }

    // 3. Scan forwards
    for (let i = clampedIdx + 1; i < TOTAL_FRAMES; i++) {
      if (images[i]?.complete && (images[i]?.naturalWidth || 0) > 0) {
        return images[i];
      }
    }

    return null;
  }, []);

  // Instant 1:1 hardware blit (1280x720) - GPU handles object-fit: cover scaling
  const drawCurrentFrame = useCallback((frameFloat: number, forceRedraw = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const targetIdx = Math.max(0, Math.min(Math.round(frameFloat), TOTAL_FRAMES - 1));
    if (!forceRedraw && targetIdx === lastDrawnIndex.current) {
      return;
    }

    const img = getBestFrame(targetIdx);
    if (!img) return; // Keep canvas as is, NEVER wipe with black

    ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    lastDrawnIndex.current = targetIdx;
  }, [getBestFrame]);

  // Preload frames in background with asynchronous off-thread decoding
  useEffect(() => {
    let isCancelled = false;
    const images = imagesRef.current;

    const getFrameUrl = (index: number) => {
      const frameNumber = (index + 1).toString().padStart(4, "0");
      return `/assets/video-frames/frame_${frameNumber}.webp`;
    };

    const loadSingleFrame = (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (images[index]) {
          resolve();
          return;
        }

        const img = new Image();
        img.src = getFrameUrl(index);

        img.onload = () => {
          if (isCancelled) return;
          images[index] = img;

          // Draw immediately on first frame
          if (index === 0 && lastDrawnIndex.current === -1) {
            drawCurrentFrame(0, true);
          } else {
            const currentIdx = Math.round(currentFrame.current);
            if (Math.abs(currentIdx - index) <= 1) {
              drawCurrentFrame(currentFrame.current, true);
            }
          }
          resolve();
        };

        img.onerror = () => {
          resolve();
        };

        if (typeof img.decode === "function") {
          img.decode().catch(() => {});
        }
      });
    };

    const startPreload = async () => {
      // 1. Eager load first 8 frames sequentially for instant start
      for (let i = 0; i < Math.min(8, TOTAL_FRAMES); i++) {
        await loadSingleFrame(i);
        if (isCancelled) return;
      }

      // 2. Concurrently load all remaining frames in pool of 8
      const remainingIndices: number[] = [];
      for (let i = 8; i < TOTAL_FRAMES; i++) {
        remainingIndices.push(i);
      }

      const CONCURRENCY = 8;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < remainingIndices.length && !isCancelled) {
          const frameIdx = remainingIndices[currentIndex++];
          await loadSingleFrame(frameIdx);
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    };

    startPreload();

    return () => {
      isCancelled = true;
    };
  }, [drawCurrentFrame]);

  // Main scroll & animation controller
  useEffect(() => {
    let maxScroll = Math.max(1, window.innerHeight * 3);

    const updateDimensions = () => {
      maxScroll = Math.max(1, window.innerHeight * 3);
      drawCurrentFrame(currentFrame.current, true);
    };

    const updateVisuals = (progress: number) => {
      // Hero Title Overlay fadeout & float
      const overlay = heroOverlayRef.current;
      if (overlay) {
        const fadeProgress = Math.min(1, progress / 0.18);
        const opacity = (1 - fadeProgress).toFixed(3);
        const translateY = (-fadeProgress * 40).toFixed(1);
        overlay.style.opacity = opacity;
        overlay.style.transform = `translateY(${translateY}px)`;
        overlay.style.visibility = fadeProgress >= 1 ? "hidden" : "visible";
      }

      // Scroll indicator fadeout
      const indicator = scrollIndicatorRef.current;
      if (indicator) {
        const indicatorProgress = Math.min(1, progress / 0.04);
        indicator.style.opacity = (0.7 * (1 - indicatorProgress)).toFixed(3);
        indicator.style.visibility = indicatorProgress >= 1 ? "hidden" : "visible";
      }
    };

    // Responsive tick loop (runs only when animating, sleeps when settled)
    const tick = () => {
      const diff = targetFrame.current - currentFrame.current;

      if (Math.abs(diff) > 0.01) {
        // Snappy, buttery smooth 0.35 factor: zero lag behind user scroll
        currentFrame.current += diff * 0.35;
        drawCurrentFrame(currentFrame.current);
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        currentFrame.current = targetFrame.current;
        drawCurrentFrame(currentFrame.current);
        isTickingRef.current = false;
        rafIdRef.current = null;
      }
    };

    const requestTick = () => {
      if (!isTickingRef.current) {
        isTickingRef.current = true;
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    // Zero-reflow scroll handler
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const progress = Math.max(0, Math.min(1, scrollY / maxScroll));

      targetFrame.current = progress * (TOTAL_FRAMES - 1);
      updateVisuals(progress);
      requestTick();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateDimensions, { passive: true });

    // Initial draw & setup
    handleScroll();
    drawCurrentFrame(0, true);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateDimensions);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [drawCurrentFrame]);

  return (
    <>
      {/* FIXED BACKGROUND CANVAS */}
      <div className="fixed inset-0 w-full h-full -z-50 bg-[#1a1714] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute inset-0 w-full h-full object-cover transform-gpu pointer-events-none"
          style={{
            willChange: "contents",
          }}
        />
        {/* Subtle cinematic vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1714]/40 via-transparent to-[#1a1714]/80 pointer-events-none" />
      </div>

      {/* HERO TITLE OVERLAY */}
      <div
        ref={heroOverlayRef}
        id="hero-title-overlay"
        className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-40 transition-none will-change-transform"
      >
        <img
          src="/echona-logo.png"
          alt="ECHONA"
          className="w-[90vw] max-w-[800px] h-auto object-contain drop-shadow-[0_0_40px_rgba(212,175,55,0.5)] mb-6"
        />
        <p className="mt-4 font-garamond italic text-2xl md:text-4xl text-[#d6c7b0] tracking-[0.2em] drop-shadow-lg text-center max-w-3xl px-4">
          The Brethren Court of Competitive Programming
        </p>
      </div>

      {/* SCROLL TRACK (400vh) */}
      <div ref={trackRef} style={{ height: "400vh" }} className="w-full relative pointer-events-none">
        {/* Scroll Indicator */}
        <div
          ref={scrollIndicatorRef}
          className="absolute top-[85vh] left-1/2 -translate-x-1/2 flex flex-col items-center opacity-70 animate-bounce pointer-events-none"
        >
          <span className="text-[10px] tracking-[0.3em] font-cinzel text-[#d6c7b0] mb-2 uppercase drop-shadow-md">
            Scroll to Explore
          </span>
          <svg className="w-5 h-5 text-[#d6c7b0] drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </>
  );
}
