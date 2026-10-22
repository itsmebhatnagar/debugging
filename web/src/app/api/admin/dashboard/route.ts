import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const [totalQuizzes, totalParticipants, totalRounds, activeQuiz] = await Promise.all([
      prisma.competition.count(),
      prisma.competitionParticipant.count(),
      prisma.round.count(),
      prisma.competition.findFirst({
        where: {
          status: { in: ["ACTIVE", "COUNTDOWN"] }
        },
        include: {
          rounds: {
            where: { status: "ACTIVE" },
            take: 1
          },
          _count: {
            select: { participants: true, rounds: true }
          }
        }
      })
    ]);

    let activeRoundName = "No active round";
    if (activeQuiz) {
      if (activeQuiz.rounds.length > 0) {
        activeRoundName = activeQuiz.rounds[0].name;
      } else {
        const totalRoundsForQuiz = activeQuiz._count.rounds;
        activeRoundName = totalRoundsForQuiz > 0 ? `1 / ${totalRoundsForQuiz}` : "Setting Sails";
      }
    }

    return NextResponse.json({
      stats: {
        totalQuizzes,
        totalParticipants,
        totalRounds,
        activeQuiz: activeQuiz
          ? {
              id: activeQuiz.id,
              name: activeQuiz.name,
              status: activeQuiz.status,
              currentRound: activeRoundName,
              activeCrew: activeQuiz._count.participants
            }
          : null
      }
    });
  } catch (error: any) {
    console.error("Admin dashboard API error:", error);
    return NextResponse.json(
      {
        stats: {
          totalQuizzes: 0,
          totalParticipants: 0,
          totalRounds: 0,
          activeQuiz: null
        },
        error: error.message
      },
      { status: 500 }
    );
  }
}
