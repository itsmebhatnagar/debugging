"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IntroSequence } from "@/components/IntroSequence";

interface LandingViewProps {
  session?: any;
}

export function LandingView({ session }: LandingViewProps) {
  const [introComplete, setIntroComplete] = useState(false);
  const router = useRouter();

  const handleQuestBegin = () => {
    setIntroComplete(true);
    if (session?.user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen text-pirate-bone flex flex-col font-sans bg-[#000000]">
      {!introComplete && (
        <IntroSequence onComplete={handleQuestBegin} />
      )}
    </div>
  );
}
