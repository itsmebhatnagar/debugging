import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const rounds = await prisma.round.findMany({
      where: { competitionId: id },
      include: {
        _count: { select: { questions: true } }
      },
      orderBy: { order: "asc" }
    });

    const formatted = rounds.map(r => ({
      ...r,
      overallTimer: r.durationSeconds,
      marksPerCorrect: 100,
      marksPerWrong: 0,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingCount = await prisma.round.count({ where: { competitionId: id } });
    const order = typeof body.order === "number" ? body.order : existingCount + 1;
    const durationSeconds = body.overallTimer || (body.durationMinutes ? body.durationMinutes * 60 : 25 * 60);

    const round = await prisma.round.create({
      data: {
        competitionId: id,
        name: body.name || `Voyage Stage ${order}`,
        order,
        durationSeconds,
        maxCompileAttempts: body.maxCompileAttempts || 5,
        status: "PENDING"
      }
    });

    return NextResponse.json(round, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
