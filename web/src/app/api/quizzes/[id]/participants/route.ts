import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { deduplicateByUserDetails } from "@/lib/deduplicate";

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
    const participants = await prisma.competitionParticipant.findMany({
      where: { competitionId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const formatted = participants.map(p => ({
      id: p.id,
      competitionId: p.competitionId,
      userId: p.userId,
      username: p.user?.email ? p.user.email.split('@')[0] : p.userId,
      name: p.user?.name || "Unknown Sailor",
      email: p.user?.email || "-",
      mobile: p.user?.mobile || "-",
      phone: p.user?.mobile || "-",
      score: p.score,
      status: p.status, // WAITING, QUALIFIED, DISQUALIFIED
      createdAt: p.createdAt
    }));

    // Deduplicate: if 2 or more users have the same name, check details.
    // If details are also identical, discard one; if details differ, keep both.
    const deduplicated = deduplicateByUserDetails(formatted, {
      getScore: (p) => p.score,
    });

    return NextResponse.json(deduplicated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id: competitionId } = await params;
    const body = await req.json();

    let user = null;
    if (body.userId) {
      user = await prisma.user.findUnique({ where: { id: body.userId } });
    } else if (body.email) {
      user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: body.email,
            name: body.name || body.username || "Pirate Sailor",
            mobile: body.phone || body.mobile,
            role: "USER"
          }
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User could not be identified or created" }, { status: 400 });
    }

    const participant = await prisma.competitionParticipant.upsert({
      where: {
        competitionId_userId: {
          competitionId,
          userId: user.id
        }
      },
      update: {
        status: body.status || "WAITING"
      },
      create: {
        competitionId,
        userId: user.id,
        score: 0,
        status: body.status || "WAITING"
      },
      include: { user: true }
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
