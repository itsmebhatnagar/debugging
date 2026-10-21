"use client";

import { usePathname } from "next/navigation";

export function PageBackground() {
  const pathname = usePathname();

  // The landing page uses the video scroll sequence, so no static background needed there.
  if (pathname === "/") return null;

  // Keep the arena independent of third-party image requests.
  if (pathname.includes("/competition/")) {
    return (
      <div 
        className="fixed inset-0 -z-40 bg-[radial-gradient(ellipse_at_50%_20%,rgba(35,63,95,0.7),transparent_58%),linear-gradient(180deg,#111827_0%,#080d18_70%)]"
      >
        <div className="absolute inset-0 bg-[#1a1714]/70" />
      </div>
    );
  }

  // Profile, Dashboard, Admin, Login, Register get the custom user background.
  return (
    <div 
      className="fixed inset-0 -z-40 bg-[#080d18] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "linear-gradient(rgba(8,13,24,.78), rgba(8,13,24,.88)), url('/images/dashboard-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-[#1a1714]/80" />
    </div>
  );
}
