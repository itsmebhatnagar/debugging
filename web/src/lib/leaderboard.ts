import { prisma } from "@/lib/prisma"
import { deduplicateByUserDetails } from "@/lib/deduplicate"
import { bestScoreByQuestion } from "@/lib/score-calculation"

export async function getCompetitionLeaderboard(competitionId: string) {
  const [competition, participants] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: {
        rounds: {
          orderBy: { order: "asc" },
          select: { id: true, order: true, name: true },
        },
      },
    }),
    prisma.competitionParticipant.findMany({
      where: { competitionId },
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true } },
        scores: {
          select: {
            pointsEarned: true,
            createdAt: true,
            submission: {
              select: { question: { select: { id: true, roundId: true } } },
            },
          },
        },
      },
    }),
  ])

  if (!competition) throw new Error("Competition not found")

  const leaderboard = participants.map((participant) => {
    const bestScores = bestScoreByQuestion(participant.scores.map((score) => ({
      questionId: score.submission.question.id,
      pointsEarned: score.pointsEarned,
    })))
    const roundScores = competition.rounds.map((round) => ({
      ...round,
      score: [...bestScores].reduce((total, [questionId, pointsEarned]) => {
        const score = participant.scores.find((item) => item.submission.question.id === questionId)
        return total + (score?.submission.question.roundId === round.id ? pointsEarned : 0)
      }, 0),
    }))
    const totalScore = roundScores.reduce((total, round) => total + round.score, 0)
    const lastUpdate = participant.scores.reduce(
      (latest, score) => score.createdAt > latest ? score.createdAt : latest,
      new Date(0),
    )

    return {
      id: participant.id,
      userId: participant.userId,
      name: participant.user.name || participant.user.email.split("@")[0],
      email: participant.user.email,
      mobile: participant.user.mobile,
      roundScores,
      totalScore,
      lastUpdate,
    }
  })

  leaderboard.sort((left, right) =>
    right.totalScore - left.totalScore || left.lastUpdate.getTime() - right.lastUpdate.getTime(),
  )

  // Deduplicate: if 2 or more users have the same name, check details.
  // If details are also the same, discard one; if details differ, keep both.
  const deduplicated = deduplicateByUserDetails(leaderboard, {
    getScore: (p) => p.totalScore,
  })

  return deduplicated.map((participant, index) => ({ ...participant, rank: index + 1 }))
}
