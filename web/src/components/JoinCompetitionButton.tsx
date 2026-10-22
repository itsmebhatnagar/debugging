"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { joinActiveRound } from "@/app/actions/participant"

export function JoinCompetitionButton({ competitionId }: { competitionId: string }) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      const result = await joinActiveRound(competitionId)
      if (!result.success) {
        setError(result.error || "Could not join the active stage.")
        return
      }

      router.push(`/competition/${competitionId}`)
    } catch (joinError: unknown) {
      setError(joinError instanceof Error ? joinError.message : "Could not join the active stage.")
    } finally {
      setJoining(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleJoin}
        disabled={joining}
        className="block w-full text-center border border-[#d4af37]/40 bg-[#d4af37]/5 hover:bg-[#d4af37]/20 disabled:opacity-60 rounded-xl py-4 font-cinzel font-bold tracking-[0.2em] text-[#d4af37] text-xs uppercase transition-all"
      >
        {joining ? "JOINING STAGE..." : "JOIN BATTLE NOW"}
      </button>
      {error && <p role="alert" className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  )
}
