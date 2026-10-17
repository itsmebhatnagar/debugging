import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: competitionId } = await params

  try {
    const comp = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        rounds: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              include: {
                starterCodes: true,
                testCases: {
                  where: { isHidden: false },
                  select: { input: true, expected: true }
                }
              }
            }
          }
        }
      }
    })

    if (!comp) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    if (comp.status === "WAITING" || comp.status === "DRAFT") {
      return NextResponse.json({
        userId: session?.user?.id,
        status: "WAITING",
        competitionName: comp.name,
        description: comp.description
      })
    }

    if (comp.status === "COUNTDOWN") {
      const firstRound = comp.rounds[0]
      const startedAt = comp.startedAt ? new Date(comp.startedAt).getTime() : Date.now()
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
      const remainingSeconds = Math.max(0, 60 - elapsedSeconds)

      if (remainingSeconds <= 0 && firstRound) {
        // 60s countdown finished! Automatically transition to Round 1 ACTIVE
        const { activateRound } = await import("@/lib/competition-engine")
        await activateRound(competitionId, firstRound.order)

        // Reload updated competition
        return GET(req, { params })
      }

      return NextResponse.json({
        userId: session?.user?.id,
        status: "COUNTDOWN",
        competitionName: comp.name,
        countdownSeconds: remainingSeconds,
        roundName: firstRound?.name || "Quest for the Lost Treasure"
      })
    }

    if (comp.status === "ENDED") {
      return NextResponse.json({
        userId: session?.user?.id,
        status: "ENDED",
        competitionName: comp.name
      })
    }

    // Active round
    const activeRound = comp.rounds.find(r => r.status === "ACTIVE")
    if (!activeRound) {
      return NextResponse.json({
        userId: session?.user?.id,
        status: "WAITING_ROUND",
        competitionName: comp.name
      })
    }

    // Fetch user's compile attempts count and submission status per question
    const questionIds = activeRound.questions.map(q => q.id)

    // Fetch attempts, submissions, drafts, participant status, and disqualifications in parallel
    const [attempts, submissions, drafts, participant, dqEvent] = await Promise.all([
      prisma.compileAttempt.groupBy({
        by: ["questionId"],
        where: {
          userId: session.user.id,
          questionId: { in: questionIds }
        },
        _count: { id: true }
      }),
      prisma.submission.findMany({
        where: {
          userId: session.user.id,
          questionId: { in: questionIds }
        },
        select: {
          questionId: true,
          status: true
        }
      }),
      prisma.draftCode.findMany({
        where: {
          userId: session.user.id,
          questionId: { in: questionIds }
        }
      }),
      prisma.competitionParticipant.findUnique({
        where: {
          competitionId_userId: {
            competitionId,
            userId: session.user.id
          }
        }
      }),
      prisma.competitionEvent.findFirst({
        where: {
          competitionId,
          userId: session.user.id,
          eventType: "PARTICIPANT_DISQUALIFIED"
        },
        orderBy: { createdAt: "desc" }
      })
    ])

    const attemptMap = attempts.reduce((acc, curr) => {
      acc[curr.questionId] = curr._count.id
      return acc
    }, {} as Record<string, number>)

    const submissionMap = submissions.reduce((acc, curr) => {
      acc[curr.questionId] = curr.status
      return acc
    }, {} as Record<string, string>)

    const draftMap = drafts.reduce((acc, curr) => {
      acc[curr.questionId] = { code: curr.code, language: curr.language }
      return acc
    }, {} as Record<string, { code: string; language: string }>)

    const isDisqualified = participant?.status === "DISQUALIFIED" || !!dqEvent
    let dqReason: string | null = null
    if (dqEvent?.payload) {
      try {
        dqReason = JSON.parse(dqEvent.payload).reason || "FULLSCREEN_EXIT"
      } catch {
        dqReason = "FULLSCREEN_EXIT"
      }
    } else if (participant?.status === "DISQUALIFIED") {
      dqReason = "ADMIN_DISQUALIFIED"
    }

    const participantStatus = isDisqualified ? "DISQUALIFIED" : (participant?.status || "WAITING")

    // If participant is specifically set to WAITING (has not started/attempted the round yet)
    if (participantStatus === "WAITING") {
      return NextResponse.json({
        userId: session?.user?.id,
        status: "WAITING",
        participantStatus: "WAITING",
        competitionName: comp.name,
        isDisqualified: false,
        dqReason: null,
        roundName: activeRound.name,
        roundOrder: activeRound.order
      })
    }

    // NOTICE: PER SPECIFICATION, THE TIMER RUNS IN BACKEND AND IS NOT SENT TO THE USER SCREEN!
    return NextResponse.json({
      userId: session?.user?.id,
      status: "ACTIVE_ROUND",
      participantStatus,
      competitionName: comp.name,
      isDisqualified,
      dqReason,
      round: {
        id: activeRound.id,
        name: activeRound.name,
        order: activeRound.order,
        maxCompileAttempts: activeRound.maxCompileAttempts,
        questions: activeRound.questions.map(q => ({
          id: q.id,
          title: q.title,
          description: q.description,
          points: q.points,
          starterCodes: q.starterCodes,
          testCases: q.testCases
        }))
      },
      userState: {
        attempts: attemptMap,
        submissions: submissionMap,
        drafts: draftMap
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized Admin Only" }, { status: 401 })
  }

  const { id: competitionId } = await params
  const { status } = await req.json()

  try {
    const comp = await prisma.competition.update({
      where: { id: competitionId },
      data: { status }
    })
    
    // Also reset the rounds and clear all participant data if restarting
    if (status === "ACTIVE") {
       await prisma.round.updateMany({
         where: { competitionId },
         data: { status: "ACTIVE" }
       })

       // Fetch all question IDs in this competition to clear related user data
       const rounds = await prisma.round.findMany({
         where: { competitionId },
         select: { id: true, questions: { select: { id: true } } }
       })
       
       const questionIds = rounds.flatMap(r => r.questions.map(q => q.id))

       if (questionIds.length > 0) {
         // Wipe compile attempts so they get 5/5 again
         await prisma.compileAttempt.deleteMany({
           where: { questionId: { in: questionIds } }
         })
         
         // Wipe submissions (and their cascading scores/AI analyses)
         await prisma.submission.deleteMany({
           where: { questionId: { in: questionIds } }
         })

         // Wipe drafts
         await prisma.draftCode.deleteMany({
           where: { questionId: { in: questionIds } }
         })
       }

       // Wipe overall competition participant scores
       await prisma.competitionParticipant.deleteMany({
         where: { competitionId }
       })

       // Wipe disqualification records on competition restart
       await prisma.competitionEvent.deleteMany({
         where: {
           competitionId,
           eventType: "PARTICIPANT_DISQUALIFIED"
         }
       })
    }
    
    return NextResponse.json({ success: true, comp })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
