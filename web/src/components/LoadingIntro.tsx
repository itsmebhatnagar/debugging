"use client";

import { useEffect, useState, useRef } from "react";

export function LoadingIntro() {
  const [showIntro, setShowIntro] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Attempt autoplay; fallback to muted if browser blocks unmuted autoplay
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        video.muted = true;
        video.play().catch((err) => {
          console.warn("Video autoplay failed:", err);
        });
      });
    }
  }, []);

  const finishIntro = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      setShowIntro(false);
    }, 1200);
  };

  // Optional: Click anywhere during playback to unmute if browser initially muted it
  const handleContainerClick = () => {
    if (videoRef.current && videoRef.current.muted) {
      videoRef.current.muted = false;
    }
  };

  if (!showIntro) return null;

  return (
    <div
      onClick={handleContainerClick}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0d0a08] transition-opacity duration-1000 ease-in-out transform-gpu will-change-opacity ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src="/echona_ink_intro.mp4"
        className="w-full h-full object-cover absolute inset-0"
        playsInline
        autoPlay
        muted
        preload="auto"
        onEnded={finishIntro}
      />
    </div>
  );
}
