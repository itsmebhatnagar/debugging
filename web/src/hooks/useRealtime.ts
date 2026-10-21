"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

// In production, this should be an absolute URL via env var
const REALTIME_SERVER_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001"

export function useRealtime(competitionId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!competitionId) return

    const newSocket = io(REALTIME_SERVER_URL, {
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
    })

    newSocket.on("connect", () => {
      setSocket(newSocket)
      setConnected(true)
      newSocket.emit("join_competition", competitionId)
    })

    newSocket.on("disconnect", () => {
      setConnected(false)
    })

    newSocket.on("connect_error", () => {
      setConnected(false)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [competitionId])

  return { socket, connected }
}
