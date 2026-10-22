"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  startCompetition,
  activateRound,
  endRound,
  endCompetition,
  getCurrentRound
} from "@/lib/competition-engine"
import { seedPirateChampionship } from "@/lib/seed-championship"
import { runAICompetitionEvaluation } from "@/lib/ai-debugger"
import { C_STARTER_CODE, CODE_LANGUAGE } from "@/lib/code-language"

async function checkAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: Captain's Quarters (Admin) access only!")
  }
  return session
}

export async function deleteCompetition(competitionId: string) {
  await checkAdmin()
  await prisma.competition.delete({ where: { id: competitionId } })
  redirect("/admin/competitions")
}

export async function deleteRound(roundId: string) {
  await checkAdmin()
  const round = await prisma.round.findUnique({ where: { id: roundId } })
  if (!round) throw new Error("Round not found")
  await prisma.round.delete({ where: { id: roundId } })
  redirect(`/admin/competitions/${round.competitionId}`)
}

export async function triggerSeedChampionship() {
  await checkAdmin()
  const comp = await seedPirateChampionship()
  revalidatePath("/admin/competitions")
  revalidatePath(`/admin/competitions/${comp.id}`)
  return { success: true, competitionId: comp.id }
}

export async function createCompetition(formData: FormData) {
  await checkAdmin()
  const name = formData.get("name") as string
  const description = formData.get("description") as string

  if (!name) throw new Error("Name is required")

  const comp = await prisma.competition.create({
    data: { name, description, status: "WAITING" },
  })

  revalidatePath("/admin/competitions")
  redirect(`/admin/competitions/${comp.id}`)
}

export async function startTestAdmin(competitionId: string) {
  await checkAdmin()
  const comp = await startCompetition(competitionId)
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/competition/${competitionId}`)
  return { success: true, status: comp.status }
}

export async function activateRoundAdmin(competitionId: string, roundOrder: number) {
  await checkAdmin()
  const round = await activateRound(competitionId, roundOrder)
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/competition/${competitionId}`)
  return { success: true, round }
}

export async function startRoundAdmin(roundId: string) {
  await checkAdmin()

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { competitionId: true, order: true }
  })

  if (!round) throw new Error("Round not found")

  const startedRound = await activateRound(round.competitionId, round.order)
  revalidatePath("/admin/live")
  revalidatePath(`/admin/competitions/${round.competitionId}`)
  revalidatePath(`/competition/${round.competitionId}`)

  return { success: true, round: startedRound }
}

export async function endTestAdmin(competitionId: string) {
  await checkAdmin()
  const result = await endCompetition(competitionId)
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/admin/competitions/${competitionId}/leaderboard`)
  revalidatePath(`/competition/${competitionId}`)
  return {
    success: true,
    top3Winners: result.top3Winners,
    allParticipants: result.allParticipants
  }
}

export async function createRound(competitionId: string, formData: FormData) {
  await checkAdmin()

  const name = formData.get("name") as string
  const durationSeconds = parseInt(formData.get("durationSeconds") as string, 10)
  const maxCompileAttempts = parseInt(formData.get("maxCompileAttempts") as string, 10)
  const order = parseInt(formData.get("order") as string, 10)

  if (!name || isNaN(durationSeconds) || isNaN(maxCompileAttempts) || isNaN(order)) {
    throw new Error("Invalid round data")
  }

  await prisma.round.create({
    data: {
      competitionId,
      name,
      durationSeconds,
      maxCompileAttempts,
      order,
    },
  })

  revalidatePath(`/admin/competitions/${competitionId}`)
  redirect(`/admin/competitions/${competitionId}`)
}

export async function createQuestionWithStarterCodes(roundId: string, formData: FormData) {
  await checkAdmin()

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { competition: true }
  })

  if (!round) throw new Error("Round not found")

  const title = (formData.get("title") as string)?.trim()
  const description = (formData.get("description") as string)?.trim()
  const points = parseInt(formData.get("points") as string, 10)
  const jsStarter = (formData.get("jsStarter") as string) || ""
  const pyStarter = (formData.get("pyStarter") as string) || ""
  const cppStarter = (formData.get("cppStarter") as string) || ""
  const cStarter = (formData.get("cStarter") as string) || ""
  const javaStarter = (formData.get("javaStarter") as string) || ""

  const testInput1 = (formData.get("testInput1") as string) || ""
  const testExpected1 = (formData.get("testExpected1") as string) || ""
  const testInput2 = (formData.get("testInput2") as string) || ""
  const testExpected2 = (formData.get("testExpected2") as string) || ""

  if (!title || !description || isNaN(points)) {
    throw new Error("Title, description, and points are required")
  }

  const question = await prisma.question.create({
    data: {
      roundId,
      title,
      description,
      points,
    },
  })

  // Starter codes
  if (cStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "c", code: cStarter }
    })
  }
  if (cppStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "cpp", code: cppStarter }
    })
  }
  if (javaStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "java", code: javaStarter }
    })
  }
  if (pyStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "python", code: pyStarter }
    })
  }
  if (jsStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "javascript", code: jsStarter }
    })
  }

  // Test cases
  if (testExpected1.trim()) {
    await prisma.testCase.create({
      data: {
        questionId: question.id,
        input: testInput1,
        expected: testExpected1,
        isHidden: false
      }
    })
  }
  if (testExpected2.trim()) {
    await prisma.testCase.create({
      data: {
        questionId: question.id,
        input: testInput2,
        expected: testExpected2,
        isHidden: true
      }
    })
  }

  revalidatePath(`/admin/rounds/${roundId}`)
  redirect(`/admin/rounds/${roundId}`)
}

export async function updateQuestionWithStarterCodes(questionId: string, formData: FormData) {
  await checkAdmin()

  const title = (formData.get("title") as string)?.trim()
  const description = (formData.get("description") as string)?.trim()
  const points = parseInt(formData.get("points") as string, 10)
  const jsStarter = (formData.get("jsStarter") as string) || ""
  const pyStarter = (formData.get("pyStarter") as string) || ""
  const cppStarter = (formData.get("cppStarter") as string) || ""
  const cStarter = (formData.get("cStarter") as string) || ""
  const javaStarter = (formData.get("javaStarter") as string) || ""

  const testInput1 = (formData.get("testInput1") as string) || ""
  const testExpected1 = (formData.get("testExpected1") as string) || ""
  const testInput2 = (formData.get("testInput2") as string) || ""
  const testExpected2 = (formData.get("testExpected2") as string) || ""
  const testInput3 = (formData.get("testInput3") as string) || ""
  const testExpected3 = (formData.get("testExpected3") as string) || ""

  if (!title || !description || isNaN(points)) {
    throw new Error("Title, description, and points are required")
  }

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      title,
      description,
      points,
    },
  })

  // Clear existing starter codes and test cases
  await prisma.starterCode.deleteMany({ where: { questionId } })
  await prisma.testCase.deleteMany({ where: { questionId } })

  // Re-create Starter codes
  if (cStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "c", code: cStarter }
    })
  }
  if (cppStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "cpp", code: cppStarter }
    })
  }
  if (javaStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "java", code: javaStarter }
    })
  }
  if (pyStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "python", code: pyStarter }
    })
  }
  if (jsStarter.trim()) {
    await prisma.starterCode.create({
      data: { questionId: question.id, language: "javascript", code: jsStarter }
    })
  }

  // Re-create Test cases
  if (testExpected1.trim()) {
    await prisma.testCase.create({
      data: {
        questionId: question.id,
        input: testInput1,
        expected: testExpected1,
        isHidden: false
      }
    })
  }
  if (testExpected2.trim()) {
    await prisma.testCase.create({
      data: {
        questionId: question.id,
        input: testInput2,
        expected: testExpected2,
        isHidden: true
      }
    })
  }
  if (testExpected3.trim()) {
    await prisma.testCase.create({
      data: {
        questionId: question.id,
        input: testInput3,
        expected: testExpected3,
        isHidden: true
      }
    })
  }

  redirect(`/admin/rounds/${question.roundId}`)
}

export async function uploadStarterCode(questionId: string, language: string, code: string) {
  await checkAdmin()
  return await prisma.starterCode.upsert({
    where: {
      questionId_language: {
        questionId,
        language
      }
    },
    update: { code },
    create: {
      questionId,
      language,
      code
    }
  })
}

export async function getLiveAdminData(competitionId: string) {
  await checkAdmin()

  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      rounds: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            include: {
              starterCodes: true,
              _count: { select: { submissions: true, compileAttempts: true } }
            }
          }
        }
      },
      participants: {
        include: {
          user: true,
          scores: true
        }
      }
    }
  })

  if (!comp) return null

  // Active round with remaining backend timer (visible ONLY to Admin)
  const activeRound = comp.rounds.find(r => r.status === "ACTIVE")
  let secondsRemaining = 0
  if (activeRound && activeRound.startedAt) {
    const elapsed = Math.floor((Date.now() - new Date(activeRound.startedAt).getTime()) / 1000)
    secondsRemaining = Math.max(0, activeRound.durationSeconds - elapsed)
  }

  // AI Evaluation if test ended
  let evaluation = null
  if (comp.status === "ENDED") {
    try {
      evaluation = await runAICompetitionEvaluation(competitionId)
    } catch (e) {
      console.error("Evaluation fetch error:", e)
    }
  }

  // Fetch all disqualified participants for this competition
  const dqEvents = await prisma.competitionEvent.findMany({
    where: {
      competitionId,
      eventType: "PARTICIPANT_DISQUALIFIED"
    },
    orderBy: { createdAt: "desc" }
  })

  const disqualifiedSailors: Record<string, string> = {}
  dqEvents.forEach((ev) => {
    if (ev.userId && !disqualifiedSailors[ev.userId]) {
      try {
        const payload = JSON.parse(ev.payload || "{}")
        disqualifiedSailors[ev.userId] = payload.reason || "FULLSCREEN_EXIT"
      } catch {
        disqualifiedSailors[ev.userId] = "FULLSCREEN_EXIT"
      }
    }
  })

  return {
    competition: comp,
    activeRound,
    secondsRemaining,
    evaluation,
    disqualifiedSailors
  }
}

export type ParticipantStatus = "QUALIFIED" | "DISQUALIFIED" | "WAITING"

export async function updateParticipantStatus(
  competitionId: string,
  userId: string,
  status: ParticipantStatus,
  reason: string = "ADMIN_OVERRIDE"
) {
  const session = await checkAdmin()

  // Verify participant exists
  const participant = await prisma.competitionParticipant.findUnique({
    where: {
      competitionId_userId: {
        competitionId,
        userId
      }
    },
    include: { user: true }
  })

  if (!participant) {
    throw new Error("Participant not enrolled in this competition.")
  }

  // 1. Update status on CompetitionParticipant record
  await prisma.competitionParticipant.update({
    where: {
      competitionId_userId: {
        competitionId,
        userId
      }
    },
    data: { status }
  })

  const { broadcastEvent } = await import("@/lib/realtime")

  if (status === "DISQUALIFIED") {
    // Record disqualification event in database
    await prisma.competitionEvent.create({
      data: {
        competitionId,
        userId,
        eventType: "PARTICIPANT_DISQUALIFIED",
        payload: JSON.stringify({
          reason,
          by: session.user?.name || "Admin",
          at: new Date().toISOString()
        })
      }
    })

    // Broadcast realtime disqualification event
    await broadcastEvent(competitionId, "participant_disqualified", {
      competitionId,
      userId,
      reason,
      status: "DISQUALIFIED"
    })
  } else {
    // If QUALIFIED or WAITING, purge any active disqualification events
    await prisma.competitionEvent.deleteMany({
      where: {
        competitionId,
        userId,
        eventType: "PARTICIPANT_DISQUALIFIED"
      }
    })
  }

  // Broadcast realtime status change to all participants and admins
  await broadcastEvent(competitionId, "participant_status_changed", {
    competitionId,
    userId,
    status,
    reason: status === "DISQUALIFIED" ? reason : null,
    userName: participant.user.name,
    userEmail: participant.user.email
  })

  revalidatePath(`/admin`)
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/admin/competitions/${competitionId}/leaderboard`)
  revalidatePath(`/competition/${competitionId}`)

  return { success: true, status }
}

export async function resetCompetitionAdmin(competitionId: string) {
  await checkAdmin()
  const { broadcastEvent } = await import("@/lib/realtime")

  // 1. Reset competition status
  await prisma.competition.update({
    where: { id: competitionId },
    data: {
      status: "WAITING",
      startedAt: null,
      endedAt: null,
    }
  })

  // 2. Reset all rounds to PENDING
  await prisma.round.updateMany({
    where: { competitionId },
    data: {
      status: "PENDING",
      startedAt: null,
      endsAt: null,
    }
  })

  // 3. Clear submissions, compile attempts, draft codes
  const questions = await prisma.question.findMany({
    where: { round: { competitionId } },
    select: { id: true }
  })
  const questionIds = questions.map(q => q.id)

  if (questionIds.length > 0) {
    await prisma.aIAnalysis.deleteMany({
      where: { submission: { questionId: { in: questionIds } } }
    })
    await prisma.score.deleteMany({
      where: { submission: { questionId: { in: questionIds } } }
    })
    await prisma.compileAttempt.deleteMany({
      where: { questionId: { in: questionIds } }
    })
    await prisma.submission.deleteMany({
      where: { questionId: { in: questionIds } }
    })
    await prisma.draftCode.deleteMany({
      where: { questionId: { in: questionIds } }
    })
  }

  // 4. Reset participant scores and live status to WAITING
  await prisma.competitionParticipant.updateMany({
    where: { competitionId },
    data: {
      score: 0,
      status: "WAITING"
    }
  })

  // 5. Purge all competition events (including disqualifications)
  await prisma.competitionEvent.deleteMany({
    where: { competitionId }
  })

  // 6. Broadcast reset to all participants and admin screens
  await broadcastEvent(competitionId, "competition_reset", {
    competitionId,
    message: "The Captain has reset the voyage. All scores, timers, and statuses have been restored."
  })
  await broadcastEvent(competitionId, "test_ended", {
    competitionId,
    status: "WAITING"
  })

  revalidatePath("/admin")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/live")
  revalidatePath("/admin/participants")
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/competition/${competitionId}`)
  revalidatePath("/dashboard")

  return { success: true }
}

export async function restartCompetitionAdmin(competitionId: string) {
  await checkAdmin()
  // Reset everything first
  await resetCompetitionAdmin(competitionId)

  // Then activate round 1
  const firstRound = await prisma.round.findFirst({
    where: { competitionId, order: 1 }
  })
  if (firstRound) {
    await activateRoundAdmin(competitionId, 1)
  }

  revalidatePath("/admin")
  revalidatePath("/admin/live")
  revalidatePath("/admin/participants")
  revalidatePath(`/admin/competitions/${competitionId}`)
  revalidatePath(`/competition/${competitionId}`)

  return { success: true }
}

export async function resetRoundAdmin(roundId: string) {
  await checkAdmin()
  const { broadcastEvent } = await import("@/lib/realtime")

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { questions: { select: { id: true } } }
  })

  if (!round) throw new Error("Round not found")

  // Reset round
  await prisma.round.update({
    where: { id: roundId },
    data: {
      status: "PENDING",
      startedAt: null,
      endsAt: null
    }
  })

  // Delete submissions for this round's questions
  const qIds = round.questions.map(q => q.id)
  if (qIds.length > 0) {
    await prisma.aIAnalysis.deleteMany({
      where: { submission: { questionId: { in: qIds } } }
    })
    await prisma.score.deleteMany({
      where: { submission: { questionId: { in: qIds } } }
    })
    await prisma.compileAttempt.deleteMany({
      where: { questionId: { in: qIds } }
    })
    await prisma.submission.deleteMany({
      where: { questionId: { in: qIds } }
    })
    await prisma.draftCode.deleteMany({
      where: { questionId: { in: qIds } }
    })
  }

  const participants = await prisma.competitionParticipant.findMany({
    where: { competitionId: round.competitionId },
    select: {
      id: true,
      scores: { select: { pointsEarned: true } }
    }
  })
  await Promise.all(participants.map(participant =>
    prisma.competitionParticipant.update({
      where: { id: participant.id },
      data: {
        score: participant.scores.reduce((total, score) => total + score.pointsEarned, 0)
      }
    })
  ))

  if (round.status === "ACTIVE") {
    const activeRound = await prisma.round.findFirst({
      where: { competitionId: round.competitionId, status: "ACTIVE" },
      select: { id: true }
    })

    if (!activeRound) {
      await prisma.competition.update({
        where: { id: round.competitionId },
        data: { status: "WAITING", startedAt: null }
      })
    }
  }

  // Broadcast event
  await broadcastEvent(round.competitionId, "round_reset", {
    roundId,
    roundName: round.name,
    message: `Round ${round.order} has been reset by the Captain.`
  })

  revalidatePath("/admin")
  revalidatePath("/admin/live")
  revalidatePath(`/admin/competitions/${round.competitionId}`)
  revalidatePath(`/admin/rounds/${roundId}`)

  return { success: true }
}

export async function restartRoundAdmin(roundId: string) {
  await checkAdmin()

  // Reset round data first
  await resetRoundAdmin(roundId)

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { competitionId: true, order: true }
  })

  if (!round) throw new Error("Round not found")

  const updatedRound = await activateRound(round.competitionId, round.order)

  revalidatePath("/admin")
  revalidatePath("/admin/live")
  revalidatePath(`/admin/competitions/${round.competitionId}`)
  revalidatePath(`/admin/rounds/${roundId}`)

  return { success: true, round: updatedRound }
}

export async function enrollAllUsersAsParticipants(competitionId: string) {
  await checkAdmin()
  const users = await prisma.user.findMany()

  for (const u of users) {
    await prisma.competitionParticipant.upsert({
      where: {
        competitionId_userId: {
          competitionId,
          userId: u.id
        }
      },
      update: {},
      create: {
        competitionId,
        userId: u.id,
        score: 0,
        status: "WAITING"
      }
    })
  }

  revalidatePath("/admin/participants")
  revalidatePath(`/admin/competitions/${competitionId}`)
  return { success: true, count: users.length }
}

export async function deleteUserFromDatabase(userId: string) {
  const session = await checkAdmin()

  if (session.user?.id === userId) {
    throw new Error("Cannot delete your own active admin account!")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!user) {
    throw new Error("User entry not found in database.")
  }

  // Delete user from database (cascades to participants, scores, submissions, etc.)
  await prisma.user.delete({
    where: { id: userId }
  })

  revalidatePath("/admin")
  revalidatePath("/admin/participants")
  revalidatePath("/admin/competitions")

  return { success: true, deletedUser: user }
}

export async function deleteParticipantEntry(competitionId: string, userId: string) {
  await checkAdmin()

  await prisma.competitionParticipant.deleteMany({
    where: {
      competitionId,
      userId
    }
  })

  revalidatePath("/admin")
  revalidatePath("/admin/participants")
  revalidatePath(`/admin/competitions/${competitionId}`)

  return { success: true }
}
