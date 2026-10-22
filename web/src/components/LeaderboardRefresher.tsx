"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function LeaderboardRefresher({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    const socketUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
    const socket = io(socketUrl, {
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
    });
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 200);
    };

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_competition", competitionId);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("leaderboard_updated", refresh);
    socket.on("submission_created", refresh);
    socket.on("round_ended", refresh);
    socket.on("test_ended", refresh);

    const fallbackRefresh = window.setInterval(() => {
      if (!socket.connected) refresh();
    }, 30_000);
    return () => {
      window.clearInterval(fallbackRefresh);
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [competitionId, router]);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        connected
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
      {connected ? "Live updates connected" : "Reconnecting; refresh fallback active"}
    </span>
  );
}
