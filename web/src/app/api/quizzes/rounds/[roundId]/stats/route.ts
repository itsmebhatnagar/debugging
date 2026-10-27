import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { roundId } = await params;
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        competition: true,
        questions: { select: { id: true } }
      }
    });

    if (!round) {
      return NextResponse.json({
        roundId,
        totalParticipants: 0,
        active: 0,
        submitted: 0
      });
    }

    const questionIds = round.questions.map(q => q.id);

    const [totalParticipants, active, uniqueSubmitters] = await Promise.all([
      prisma.competitionParticipant.count({
        where: { competitionId: round.competitionId }
      }),
      prisma.competitionParticipant.count({
        where: {
          competitionId: round.competitionId,
          status: { in: ["QUALIFIED", "ACTIVE"] }
        }
      }),
      questionIds.length > 0
        ? prisma.submission.groupBy({
            by: ["userId"],
            where: { questionId: { in: questionIds } }
          })
        : []
    ]);

    return NextResponse.json({
      roundId,
      totalParticipants,
      active,
      submitted: uniqueSubmitters.length
    });
  } catch (error: any) {
    console.error("GET /api/quizzes/rounds/[roundId]/stats error:", error);
    return NextResponse.json(
      { roundId: "", totalParticipants: 0, active: 0, submitted: 0 },
      { status: 200 }
    );
  }
}

