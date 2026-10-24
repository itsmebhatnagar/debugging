import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { updateParticipantStatus, enrollAllUsersAsParticipants } from "@/app/actions/admin";
import { deduplicateByUserDetails } from "@/lib/deduplicate";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");

    const where: any = {};
    if (competitionId) {
      where.competitionId = competitionId;
    }

    const participants = await prisma.competitionParticipant.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true,
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Deduplicate: if 2 or more users share the same name, check details.
    // If details are also identical, discard one; if details differ, keep both.
    const deduplicatedParticipants = deduplicateByUserDetails(participants, {
      getScore: (p) => p.score,
    });

    // Also get all competitions for filter dropdowns
    const competitions = await prisma.competition.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ participants: deduplicatedParticipants, competitions });
  } catch (error: any) {
    console.error("GET /api/admin/participants error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { action, competitionId, userId, status, reason } = body;

    if (action === "enroll_all") {
      const res = await enrollAllUsersAsParticipants(competitionId);
      return NextResponse.json(res);
    }

    if (action === "update_status" || status) {
      if (!competitionId || !userId || !status) {
        return NextResponse.json({ error: "competitionId, userId, and status are required" }, { status: 400 });
      }
      const res = await updateParticipantStatus(competitionId, userId, status, reason || "ADMIN_OVERRIDE");
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/participants error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const competitionId = searchParams.get("competitionId");
    const mode = searchParams.get("mode") || "user"; // "user" or "participant"

    if (!userId) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    if (mode === "participant" && competitionId) {
      await prisma.competitionParticipant.deleteMany({
        where: { competitionId, userId }
      });
      return NextResponse.json({ success: true, message: "Participant entry removed from fleet" });
    } else {
      // Prevent deleting own logged-in admin account
      if (session.user?.id === userId) {
        return NextResponse.json({ error: "Cannot delete your own active admin account!" }, { status: 400 });
      }

      // Delete user entirely from database (cascades to all participants, scores, submissions, etc.)
      await prisma.user.delete({
        where: { id: userId }
      });
      return NextResponse.json({ success: true, message: "User permanently deleted from database" });
    }
  } catch (error: any) {
    console.error("DELETE /api/admin/participants error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
