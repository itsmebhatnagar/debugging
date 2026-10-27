import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getExecutionService } from "./execution"
import { broadcastEvent } from "./realtime"
import { analyzeSubmission, runAICompetitionEvaluation } from "./ai-debugger"
import { assertSupportedLanguage, C_STARTER_CODE, CODE_LANGUAGE, normalizeLanguage } from "./code-language"
import { ExecutionResult } from "./execution/types"

function executionOutputLines(result: ExecutionResult): string[] {
  const output: string[] = []
  if (result.compilerVersion) output.push(`Compiler: ${result.compilerVersion}`)

  if (result.compileOutput) output.push(`Compiler output:\n${result.compileOutput.trimEnd()}`)
  if (result.stdout) output.push(`Program output:\n${result.stdout.trimEnd()}`)
  if (result.stderr) output.push(`Error output:\n${result.stderr.trimEnd()}`)
  output.push(`Execution time: ${result.time}s`)
  return output
}

function formatExecutionResult(result: ExecutionResult): string {
  const statusMsg = result.passed
    ? "PASSED: Program ran successfully."
    : result.compileOutput
      ? "FAILED: Compilation error."
      : result.statusId === 5
        ? "FAILED: Time Limit Exceeded."
        : "FAILED: Execution failed or wrong output."

  return [statusMsg, ...executionOutputLines(result)].join("\n")
}

/**
 * Returns the currently active round for a competition, calculating endsAt
 */
export async function getCurrentRound(competitionId: string) {
  const round = await prisma.round.findFirst({
    where: {
      competitionId,
      status: "ACTIVE",
    },
    orderBy: { order: "asc" },
    include: {
      questions: {
        include: {
          starterCodes: true,
          testCases: { where: { isHidden: false } }
        }
      }
    }
  })

  if (!round || !round.startedAt) return null

  const endsAt = new Date(round.startedAt.getTime() + round.durationSeconds * 1000)
  return { ...round, endsAt }
}

/**
 * Starts a test / competition: sets status to COUNTDOWN and broadcasts to all participants
 */
export async function startCompetition(competitionId: string) {
  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      rounds: { orderBy: { order: "asc" } }
    }
  })

  if (!comp) throw new Error("Competition not found")

  const updatedComp = await prisma.competition.update({
    where: { id: competitionId },
    data: {
      status: "COUNTDOWN",
      startedAt: new Date()
    }
  })

  const firstRound = comp.rounds[0]
  const firstRoundName = firstRound?.name || "Quest for the Lost Treasure"

  await broadcastEvent(competitionId, "test_starting", {
    competitionId,
    countdownSeconds: 60,
    roundName: firstRoundName,
    roundOrder: 1,
    message: "Battle commences in 60 seconds! Prepare your codes and hoist the sails!"
  })

  return updatedComp
}

/**
 * Activates a specific round (Round 1, 2, or 3)
 */
export async function activateRound(competitionId: string, roundOrder: number = 1) {
  // End any previously active rounds first
  await prisma.round.updateMany({
    where: { competitionId, status: "ACTIVE" },
    data: { status: "ENDED", endsAt: new Date() }
  })

  const round = await prisma.round.findFirst({
    where: { competitionId, order: roundOrder },
    include: {
      questions: {
        include: {
          starterCodes: true,
          testCases: { where: { isHidden: false } }
        }
      }
    }
  })

  if (!round) throw new Error(`Round ${roundOrder} not found for competition`)

  const updatedRound = await prisma.round.update({
    where: { id: round.id },
    data: {
      status: "ACTIVE",
      startedAt: new Date(),
    }
  })

  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "ACTIVE" }
  })

  await prisma.competitionEvent.create({
    data: {
      competitionId,
      roundId: round.id,
      eventType: "ROUND_STARTED",
      payload: JSON.stringify({ roundName: round.name, roundOrder: round.order })
    }
  })

  // Broadcast to all participants that round has begun
  await broadcastEvent(competitionId, "round_started", {
    roundId: round.id,
    roundName: round.name,
    roundOrder: round.order,
    startedAt: updatedRound.startedAt,
    durationSeconds: round.durationSeconds,
    maxCompileAttempts: round.maxCompileAttempts,
    questions: round.questions.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      points: q.points,
      starterCodes: q.starterCodes
    }))
  })

  return updatedRound
}

/**
 * Force ends a round
 */
export async function endRound(roundId: string) {
  const existingRound = await prisma.round.findUnique({
    where: { id: roundId },
    select: { status: true }
  })

  if (!existingRound) throw new Error("Round not found")
  if (existingRound.status !== "ACTIVE") throw new Error("Only an active stage can be ended")

  const round = await prisma.round.update({
    where: { id: roundId },
    data: {
      status: "ENDED",
      endsAt: new Date(),
    },
  })

  await prisma.competitionEvent.create({
    data: {
      competitionId: round.competitionId,
      roundId,
      eventType: "ROUND_ENDED",
    },
  })

  await broadcastEvent(round.competitionId, "round_ended", { roundId, roundName: round.name })
  return round
}

/**
 * Critical path: Validates attempt count and atomic auto-submit if attempt exceeded
 */
export async function requestCompile(
  userId: string,
  questionId: string,
  language: string,
  code: string
) {
  assertSupportedLanguage(language)
  language = normalizeLanguage(language)

  // 1. Fetch question and round
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { round: true },
  })
  
  if (!question) {
    throw new Error("Question not found")
  }

  const round = question.round
  if (round.status !== "ACTIVE") {
    throw new Error("This round is not currently active")
  }

  // Verify participant registration
  const participant = await prisma.competitionParticipant.findUnique({
    where: {
      competitionId_userId: {
        competitionId: round.competitionId,
        userId,
      },
    },
  })

  if (!participant) {
    // Automatically register them as participant if not already
    await prisma.competitionParticipant.create({
      data: {
        competitionId: round.competitionId,
        userId,
        score: 0
      }
    })
  }

  // Count existing attempts atomically
  const attemptCount = await prisma.compileAttempt.count({
    where: {
      userId,
      questionId,
    },
  })

  // CRITICAL REQUIREMENT:
  // If user exceeds compile attempts (e.g. 6th attempt on max 5, 4th on max 3, 3rd on max 2):
  // Show error and AUTOMATICALLY SUBMIT in admin panel!
  if (attemptCount >= round.maxCompileAttempts) {
    // Auto-submit current solution
    const autoSubmission = await submitSolution(userId, questionId, language, code, true)

    await broadcastEvent(round.competitionId, "attempt_exceeded", {
      userId,
      questionId,
      maxAttempts: round.maxCompileAttempts,
      attemptNumber: attemptCount + 1,
      submissionId: autoSubmission.id
    })

    throw new Error(
      `ATTEMPT LIMIT EXHAUSTED! You have used all ${round.maxCompileAttempts}/${round.maxCompileAttempts} compile attempts for this challenge. Your solution has been AUTOMATICALLY SUBMITTED to the Captain's panel!`
    )
  }

  // Record this compile attempt
  const attempt = await prisma.compileAttempt.create({
    data: {
      userId,
      questionId,
      language,
      code,
      result: "PENDING",
    },
  })

  // Execute Code against public test cases
  const execService = getExecutionService()
  const publicTestCases = await prisma.testCase.findMany({
    where: { questionId, isHidden: false }
  })

  let executionResult = ""
  try {
    if (publicTestCases.length === 0) {
      const res = await execService.execute({
        language,
        code,
        input: "",
        expectedOutput: ""
      })
      executionResult = formatExecutionResult(res)
    } else {
      const tc = publicTestCases[0]
      const res = await execService.execute({
        language,
        code,
        input: tc.input,
        expectedOutput: tc.expected
      })

      executionResult = [
        `${res.passed ? "PASSED" : "FAILED"}: Public test case 1`,
        `Input:\n${tc.input || "(empty)"}`,
        `Expected:\n${tc.expected || "(empty)"}`,
        ...executionOutputLines(res),
      ].join("\n")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error"
    await prisma.compileAttempt.update({
      where: { id: attempt.id },
      data: { result: `Execution failed: ${message}` }
    })
    throw error
  }

  await prisma.compileAttempt.update({
    where: { id: attempt.id },
    data: { result: executionResult }
  })

  // Broadcast live compile event to Admin panel
  await broadcastEvent(round.competitionId, "compile_attempt_logged", {
    userId,
    questionId,
    attemptNumber: attemptCount + 1,
    maxAttempts: round.maxCompileAttempts,
    result: executionResult
  })

  return {
    id: attempt.id,
    attemptNumber: attemptCount + 1,
    maxAttempts: round.maxCompileAttempts,
    remainingAttempts: round.maxCompileAttempts - (attemptCount + 1),
    result: executionResult
  }
}

/**
 * Final submission handler
 */
export async function submitSolution(
  userId: string,
  questionId: string,
  language: string,
  code: string,
  isAutoSubmit: boolean = false
) {
  assertSupportedLanguage(language)
  language = normalizeLanguage(language)

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { round: true },
  })
  
  if (!question) throw new Error("Question not found")
  const round = question.round

  // Create submission record
  const submission = await prisma.submission.create({
    data: {
      userId,
      questionId,
      language,
      code,
      status: "PENDING",
    },
  })

  // Run against ALL test cases (public + hidden) concurrently
  const execService = getExecutionService()
  const allTestCases = await prisma.testCase.findMany({
    where: { questionId }
  })

  let passedCount = 0
  let allPassed = true
  let totalTimeMs = 0
  let executionLogs = ""

  if (allTestCases.length > 0) {
    const results = await Promise.all(
      allTestCases.map(tc =>
        execService.execute({
          language,
          code,
          input: tc.input,
          expectedOutput: tc.expected
        })
      )
    )

    results.forEach((res) => {
      totalTimeMs += res.time
      if (res.passed) {
        passedCount++
        executionLogs += `Test Case passed.\n`
      } else {
        allPassed = false
        executionLogs += `Test Case failed. Output: ${res.stdout || res.stderr}\n`
      }
    })
  } else {
    // Execute without inputs to get baseline execution info
    const res = await execService.execute({ language, code, input: "", expectedOutput: "" })
    totalTimeMs += res.time
    executionLogs += res.passed ? `Execution passed: ${res.stdout}\n` : `Execution failed: ${res.stderr || res.stdout}\n`
  }

  const totalPoints = question.points || 100
  
  // Baseline points based purely on execution
  const pointsEarned = allTestCases.length > 0
    ? Math.round((passedCount / allTestCases.length) * totalPoints)
    : (code.length > 10 ? totalPoints : 0)

  const finalSubmission = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "ACCEPTED" // Instantly show accepted as requested
    }
  })

  // Create PENDING AI Analysis record
  await prisma.aIAnalysis.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      correctness: Math.round((pointsEarned / totalPoints) * 100),
      codeQuality: 0,
      bugs: !allPassed ? "Some tests failed" : "None detected",
      feedback: "AI Evaluation Pending...",
      status: "PENDING"
    },
    update: {
      feedback: "AI Evaluation Pending...",
      status: "PENDING"
    }
  })

  // Find or create participant
  let participant = await prisma.competitionParticipant.findUnique({
    where: {
      competitionId_userId: {
        competitionId: round.competitionId,
        userId
      }
    }
  })

  if (!participant) {
    participant = await prisma.competitionParticipant.create({
      data: {
        competitionId: round.competitionId,
        userId,
        score: pointsEarned
      }
    })
  }

  // Record Score
  await prisma.score.upsert({
    where: { submissionId: finalSubmission.id },
    create: {
      submissionId: finalSubmission.id,
      participantId: participant.id,
      pointsEarned,
      passedCases: passedCount,
      totalCases: allTestCases.length
    },
    update: {
      pointsEarned,
      passedCases: passedCount,
      totalCases: allTestCases.length
    }
  })

  // Update participant cumulative score
  const allParticipantScores = await prisma.score.findMany({
    where: { participantId: participant.id }
  })
  const totalAccumulatedScore = allParticipantScores.reduce((sum, s) => sum + s.pointsEarned, 0)
  await prisma.competitionParticipant.update({
    where: { id: participant.id },
    data: { score: totalAccumulatedScore }
  })

  // AI Analysis is already handled synchronously above via evaluateCodeScore.

  // Broadcast submission and leaderboard update
  await broadcastEvent(round.competitionId, "submission_created", {
    userId,
    questionId,
    submissionId: finalSubmission.id,
    isAutoSubmit,
    pointsEarned,
    status: finalSubmission.status
  })

  await broadcastEvent(round.competitionId, "leaderboard_updated", {
    competitionId: round.competitionId
  })

  return finalSubmission
}

/**
 * Saves draft code for seamless crash/auto-submit resilience
 */
export async function saveDraftCode(
  userId: string,
  questionId: string,
  language: string,
  code: string
) {
  assertSupportedLanguage(language)
  language = normalizeLanguage(language)

  return await prisma.draftCode.upsert({
    where: {
      userId_questionId: {
        userId,
        questionId
      }
    },
    create: {
      userId,
      questionId,
      language,
      code
    },
    update: {
      language,
      code
    }
  })
}

/**
 * Closes the entire competition, auto-submits all participants' latest codes,
 * executes AI code evaluation across all submissions, and crowns the Top 3 Winners!
 */
export async function endCompetition(competitionId: string) {
  // 1. Mark competition and all rounds as ENDED
  await prisma.competition.update({
    where: { id: competitionId },
    data: {
      status: "ENDED",
      endedAt: new Date()
    }
  })

  await prisma.round.updateMany({
    where: { competitionId },
    data: {
      status: "ENDED",
      endsAt: new Date()
    }
  })

  // 2. Bulk fetch all participants, questions, existing submissions, and drafts
  const [participants, questions] = await Promise.all([
    prisma.competitionParticipant.findMany({ where: { competitionId } }),
    prisma.question.findMany({ where: { round: { competitionId } } })
  ])

  const userIds = participants.map(p => p.userId)
  const questionIds = questions.map(q => q.id)

  const [existingSubs, allDrafts] = await Promise.all([
    prisma.submission.findMany({
      where: {
        userId: { in: userIds },
        questionId: { in: questionIds }
      },
      select: { userId: true, questionId: true }
    }),
    prisma.draftCode.findMany({
      where: {
        userId: { in: userIds },
        questionId: { in: questionIds }
      }
    })
  ])

  const submittedKeySet = new Set(existingSubs.map(s => `${s.userId}_${s.questionId}`))
  const draftMap = new Map(allDrafts.map(d => [`${d.userId}_${d.questionId}`, d]))

  // 3. Batch auto-submit missing submissions concurrently
  const missingTasks: Array<() => Promise<any>> = []
  for (const p of participants) {
    for (const q of questions) {
      const key = `${p.userId}_${q.id}`
      if (!submittedKeySet.has(key)) {
        const draft = draftMap.get(key)
        const draftLang = draft?.language ? normalizeLanguage(draft.language) : CODE_LANGUAGE
        const codeToSubmit = draft?.code || C_STARTER_CODE
        missingTasks.push(() =>
          submitSolution(p.userId, q.id, draftLang, codeToSubmit, true).catch(e =>
            console.error(`Error auto-submitting for user ${p.userId} question ${q.id}:`, e)
          )
        )
      }
    }
  }

  // Execute in parallel batches of 8 to maintain optimal server load
  const BATCH_SIZE = 8
  for (let i = 0; i < missingTasks.length; i += BATCH_SIZE) {
    await Promise.all(missingTasks.slice(i, i + BATCH_SIZE).map(fn => fn()))
  }

  // 4. Broadcast test_ended immediately so clients are unblocked
  await broadcastEvent(competitionId, "test_ended", {
    competitionId,
    endedAt: new Date(),
    message: "The Captain has ended the test. All tests have been automatically submitted!"
  })

  // 5. Run AI Evaluation asynchronously in the background
  // This prevents the Next.js server action from timing out on large sets!
  runAICompetitionEvaluation(competitionId).then(async ({ allParticipants, top3Winners }) => {
    // Broadcast when evaluation is fully complete
    await broadcastEvent(competitionId, "ai_evaluation_completed", {
      competitionId,
      top3Winners
    })
  }).catch(e => {
    console.error("Background AI Evaluation failed:", e)
  })

  return {
    success: true,
    // Return empty placeholders to UI instantly; they will update via socket when AI finishes
    allParticipants: [],
    top3Winners: []
  }
}
