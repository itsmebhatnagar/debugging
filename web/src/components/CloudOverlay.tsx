"use client";

import { usePathname } from "next/navigation";

export function CloudOverlay() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/competition/")) return null;

  return (
    <div className="cloud-overlay fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-25">
      {/* 
        We use ultra-large radial gradients stretching across the screen, animated with CSS keyframes, 
        to simulate slow-moving volumetric fog/clouds like the White Desert reference.
      */}
      <div className="absolute top-[10%] -left-[50%] w-[200%] h-[150%] animate-clouds-slow"
           style={{
             background: 'radial-gradient(ellipse at center, rgba(214, 199, 176, 0.15) 0%, rgba(214, 199, 176, 0.05) 40%, transparent 70%)',
             filter: 'blur(60px)',
             transform: 'rotate(-5deg)'
           }} />
           
      <div className="absolute top-[30%] -left-[20%] w-[150%] h-[120%] animate-clouds-medium animation-delay-4000"
           style={{
             background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.1) 0%, rgba(214, 199, 176, 0.03) 50%, transparent 70%)',
             filter: 'blur(80px)',
             transform: 'rotate(10deg)'
           }} />
           
      <div className="absolute -bottom-[20%] -left-[80%] w-[250%] h-[100%] animate-clouds-fast animation-delay-2000"
           style={{
             background: 'radial-gradient(ellipse at center, rgba(214, 199, 176, 0.12) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 80%)',
             filter: 'blur(100px)'
           }} />
    </div>
  );
}
