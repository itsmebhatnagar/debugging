import type { ExecutionVerdict } from "./execution/types"

export interface QuestionScore {
  questionId: string
  pointsEarned: number
}

export function pointsForVerdict(verdict: ExecutionVerdict, questionPoints: number): number {
  return verdict === "Accepted" ? questionPoints : 0
}

export function bestScoreByQuestion(scores: QuestionScore[]): Map<string, number> {
  const bestScores = new Map<string, number>()
  for (const score of scores) {
    const currentBest = bestScores.get(score.questionId)
    if (currentBest === undefined || score.pointsEarned > currentBest) {
      bestScores.set(score.questionId, score.pointsEarned)
    }
  }
  return bestScores
}

export function totalBestQuestionScore(scores: QuestionScore[]): number {
  return [...bestScoreByQuestion(scores).values()].reduce((total, points) => total + points, 0)
}
