"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { requestCompile, submitSolution, saveDraftCode } from "@/lib/competition-engine"

export async function compileCode(questionId: string, language: string, code: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized: Please log in first." }
  }

  try {
    const attempt = await requestCompile(session.user.id, questionId, language, code)
    return { success: true, attempt }
  } catch (error: any) {
    const isExceeded = error.message.includes("ATTEMPT LIMIT EXHAUSTED")
    return {
      success: false,
      error: error.message,
      autoSubmitted: isExceeded
    }
  }
}

export async function submitFinalCode(questionId: string, language: string, code: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized: Please log in first." }
  }

  try {
    const submission = await submitSolution(session.user.id, questionId, language, code, false)
    return { success: true, submission }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function saveDraft(questionId: string, language: string, code: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    await saveDraftCode(session.user.id, questionId, language, code)
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function getUserQuestionStatus(questionId: string) {
  const session = await auth()
  if (!session?.user?.id) return null

  const userId = session.user.id

  const attempts = await prisma.compileAttempt.findMany({
    where: { userId, questionId },
    orderBy: { createdAt: "desc" }
  })

  const latestSubmission = await prisma.submission.findFirst({
    where: { userId, questionId },
    orderBy: { createdAt: "desc" },
    include: { score: true }
  })

  const draft = await prisma.draftCode.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId
      }
    }
  })

  return {
    attemptsCount: attempts.length,
    attempts,
    latestSubmission,
    draft
  }
}

export async function startRoundNow(competitionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  // Set participant status to QUALIFIED so they are marked as actively in round
  await prisma.competitionParticipant.upsert({
    where: {
      competitionId_userId: {
        competitionId,
        userId: session.user.id
      }
    },
    update: { status: "QUALIFIED" },
    create: {
      competitionId,
      userId: session.user.id,
      score: 0,
      status: "QUALIFIED"
    }
  })

  // Check if competition is in COUNTDOWN state
  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { rounds: { orderBy: { order: "asc" } } }
  })

  if (!comp) return { success: false, error: "Competition not found" }

  // If already ACTIVE, return success
  if (comp.status === "ACTIVE") {
    return { success: true }
  }

  // Activate Round 1
  const firstRound = comp.rounds[0]
  if (!firstRound) return { success: false, error: "No rounds configured" }

  const { activateRound } = await import("@/lib/competition-engine")
  await activateRound(competitionId, firstRound.order)

  return { success: true }
}

export async function recordDisqualification(competitionId: string, reason: string = "FULLSCREEN_EXIT") {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  const userId = session.user.id
  try {
    // Update participant status to DISQUALIFIED
    await prisma.competitionParticipant.updateMany({
      where: { competitionId, userId },
      data: { status: "DISQUALIFIED" }
    })

    // Persist disqualification in database so it remains locked even across page refresh
    await prisma.competitionEvent.create({
      data: {
        competitionId,
        userId,
        eventType: "PARTICIPANT_DISQUALIFIED",
        payload: JSON.stringify({
          reason,
          userName: session.user.name,
          userEmail: session.user.email,
          at: new Date().toISOString()
        })
      }
    })

    const { broadcastEvent } = await import("@/lib/realtime")
    await broadcastEvent(competitionId, "participant_disqualified", {
      competitionId,
      userId,
      reason,
      userName: session.user.name,
      userEmail: session.user.email
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Automatically submits all questions in the round when a participant violates fullscreen or tab switching rules.
 */
export async function autoSubmitRound(
  competitionId: string,
  roundId: string,
  codes: Record<string, string>,
  language: string,
  reason: string = "FULLSCREEN_EXIT"
) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Unauthorized" }

  const userId = session.user.id

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        questions: {
          include: { starterCodes: true }
        }
      }
    })

    if (!round) return { success: false, error: "Round not found" }

    // Fetch existing submissions and drafts in parallel
    const [existingSubmissions, drafts] = await Promise.all([
      prisma.submission.findMany({
        where: {
          userId,
          questionId: { in: round.questions.map((q) => q.id) }
        }
      }),
      prisma.draftCode.findMany({
        where: {
          userId,
          questionId: { in: round.questions.map((q) => q.id) }
        }
      })
    ])

    const submittedQIds = new Set(existingSubmissions.map((s) => s.questionId))
    const draftMap = new Map(drafts.map((d) => [d.questionId, d.code]))

    // Submit remaining unsubmitted questions concurrently
    const submitPromises = round.questions
      .filter((q) => !submittedQIds.has(q.id))
      .map(async (q) => {
        let codeToSubmit = codes[q.id]
        if (!codeToSubmit || !codeToSubmit.trim()) {
          const draftCode = draftMap.get(q.id)
          if (draftCode) {
            codeToSubmit = draftCode
          } else {
            const starter = q.starterCodes.find((s) => s.language === language) || q.starterCodes[0]
            codeToSubmit = starter?.code || `// Autosubmitted solution\nfunction solve() {}\n`
          }
        }

        try {
          const sub = await submitSolution(userId, q.id, language, codeToSubmit, true)
          if (sub?.id) {
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
            fetch(`${baseUrl}/api/submissions/evaluate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ submissionId: sub.id })
            }).catch(() => {})
          }
        } catch (subErr) {
          console.error(`Failed to auto-submit solution for question ${q.id}:`, subErr)
        }
      })

    await Promise.all(submitPromises)

    // Record disqualification and broadcast to admin
    await recordDisqualification(competitionId, reason)

    return { success: true }
  } catch (err: any) {
    console.error("autoSubmitRound error:", err)
    return { success: false, error: err.message }
  }
}

