"use server"

import { getCompetitionLeaderboard } from "@/lib/leaderboard"

export async function getLeaderboard(competitionId: string) {
  return getCompetitionLeaderboard(competitionId)
}
