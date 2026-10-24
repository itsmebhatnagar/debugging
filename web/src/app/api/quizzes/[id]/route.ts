import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        rounds: {
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: { questions: true }
            }
          }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: { rounds: true, participants: true }
        }
      }
    });

    if (!competition) {
      return NextResponse.json({ error: "Expedition not found" }, { status: 404 });
    }

    return NextResponse.json(competition);
  } catch (error: any) {
    console.error("GET /api/quizzes/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.competition.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/quizzes/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
