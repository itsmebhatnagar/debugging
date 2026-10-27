import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const competitions = await prisma.competition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rounds: {
          orderBy: { order: "asc" }
        },
        _count: {
          select: { rounds: true, participants: true }
        }
      }
    });

    return NextResponse.json(competitions);
  } catch (error: any) {
    console.error("GET /api/quizzes error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const competition = await prisma.competition.create({
      data: {
        name,
        description: description || "",
        status: "DRAFT"
      }
    });

    return NextResponse.json(competition, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quizzes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
