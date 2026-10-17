"use client";

import { useEffect, useRef, useCallback } from "react";

const TOTAL_FRAMES = 120;

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

  // Helper to find the best available frame (exact -> nearest previous -> nearest next)
  const getBestFrame = useCallback((targetIdx: number): HTMLImageElement | null => {
    const images = imagesRef.current;
    const clampedIdx = Math.max(0, Math.min(targetIdx, TOTAL_FRAMES - 1));

    // 1. Direct hit
    if (images[clampedIdx]?.complete && (images[clampedIdx]?.naturalWidth || 0) > 0) {
      return images[clampedIdx];
    }

    // 2. Scan backwards for the closest previous frame
    for (let i = clampedIdx - 1; i >= 0; i--) {
      if (images[i]?.complete && (images[i]?.naturalWidth || 0) > 0) {
        return images[i];
      }
    }

    // 3. Scan forwards for the closest next frame
    for (let i = clampedIdx + 1; i < TOTAL_FRAMES; i++) {
      if (images[i]?.complete && (images[i]?.naturalWidth || 0) > 0) {
        return images[i];
      }
    }

    return null;
  }, []);

  // Draw current frame to canvas using object-fit: cover math
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
    if (!img) return; // Keep canvas as is, NEVER wipe with black!

    const imgWidth = img.naturalWidth || 1280;
    const imgHeight = img.naturalHeight || 720;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvas.width / canvas.height;

    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > imgRatio) {
      drawHeight = canvas.width / imgRatio;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    lastDrawnIndex.current = targetIdx;
  }, [getBestFrame]);

  // Handle canvas sizing for Retina / High-DPI screens
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    drawCurrentFrame(currentFrame.current, true);
  }, [drawCurrentFrame]);

  // Preload all frames progressively with concurrency
  useEffect(() => {
    let isCancelled = false;
    const images = imagesRef.current;

    const getFrameUrl = (index: number) => {
      const frameNumber = (index + 1).toString().padStart(4, "0");
      return `/assets/video-frames/frame_${frameNumber}.webp`;
    };

    // Load a single frame and return a promise
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

          // If frame 0 is loaded, draw immediately to show instant initial frame
          if (index === 0 && lastDrawnIndex.current === -1) {
            drawCurrentFrame(0, true);
          } else {
            // If the newly loaded frame is close to current view, redraw for crisp quality
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
      });
    };

    // Preload strategy: Eager load first 10 frames, then stream the rest concurrently
    const startPreload = async () => {
      // 1. First 10 frames high priority
      for (let i = 0; i < Math.min(10, TOTAL_FRAMES); i++) {
        await loadSingleFrame(i);
        if (isCancelled) return;
      }

      // 2. Concurrently load all remaining frames in parallel pool of 6
      const remainingIndices: number[] = [];
      for (let i = 10; i < TOTAL_FRAMES; i++) {
        remainingIndices.push(i);
      }

      const CONCURRENCY = 6;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < remainingIndices.length && !isCancelled) {
          const frameIdx = remainingIndices[currentIndex++];
          await loadSingleFrame(frameIdx);
        }
      };

      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
    };

    startPreload();

    return () => {
      isCancelled = true;
    };
  }, [drawCurrentFrame]);

  // Main scroll & animation controller
  useEffect(() => {
    // Canvas sizing setup
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize, { passive: true });

    // Handle scroll calculation based on track position
    const handleScroll = () => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;
      if (totalScrollable <= 0) return;

      const currentScroll = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));

      targetFrame.current = progress * (TOTAL_FRAMES - 1);

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

    // Render loop with smooth damping
    const renderLoop = () => {
      const diff = targetFrame.current - currentFrame.current;

      if (Math.abs(diff) > 0.002) {
        currentFrame.current += diff * 0.18; // smooth 0.18 responsiveness
        drawCurrentFrame(currentFrame.current);
      } else if (Math.abs(diff) > 0) {
        currentFrame.current = targetFrame.current;
        drawCurrentFrame(currentFrame.current);
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initial triggers
    handleScroll();
    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updateCanvasSize, drawCurrentFrame]);

  return (
    <>
      {/* FIXED BACKGROUND CANVAS */}
      <div className="fixed inset-0 w-full h-full -z-50 bg-[#1a1714]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full transform-gpu"
          style={{
            willChange: "contents",
          }}
        />
        {/* Subtle cinematic vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1714]/40 via-transparent to-[#1a1714]/80 pointer-events-none" />
      </div>

      {/* HERO TITLE OVERLAY - Fades & floats out smoothly on scroll */}
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
        {/* Scroll Indicator at the bottom of the initial viewport */}
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
