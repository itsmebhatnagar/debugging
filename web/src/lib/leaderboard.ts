import { prisma } from "@/lib/prisma"

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
        user: { select: { name: true, email: true } },
        scores: {
          select: {
            pointsEarned: true,
            createdAt: true,
            submission: {
              select: { question: { select: { roundId: true } } },
            },
          },
        },
      },
    }),
  ])

  if (!competition) throw new Error("Competition not found")

  const leaderboard = participants.map((participant) => {
    const roundScores = competition.rounds.map((round) => ({
      ...round,
      score: participant.scores.reduce(
        (total, score) =>
          total + (score.submission.question.roundId === round.id ? score.pointsEarned : 0),
        0,
      ),
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
      roundScores,
      totalScore,
      lastUpdate,
    }
  })

  leaderboard.sort((left, right) =>
    right.totalScore - left.totalScore || left.lastUpdate.getTime() - right.lastUpdate.getTime(),
  )

  return leaderboard.map((participant, index) => ({ ...participant, rank: index + 1 }))
}
