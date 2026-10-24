import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { deduplicateByUserDetails } from "@/lib/deduplicate";

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
        competition: {
          include: {
            participants: {
              include: { user: true },
              orderBy: { score: "desc" }
            }
          }
        }
      }
    });

    if (!round) return NextResponse.json([], { status: 200 });

    const participants = round.competition?.participants || [];
    const formatted = participants.map((p, idx) => ({
      id: p.id,
      rank: idx + 1,
      totalScore: p.score,
      qualificationStatus: p.status,
      participant: {
        id: p.userId,
        name: p.user?.name || "Sailor",
        username: p.user?.email ? p.user.email.split("@")[0] : p.userId,
        college: "The Seven Seas Academy",
        email: p.user?.email || "",
        mobile: p.user?.mobile || ""
      }
    }));

    // Deduplicate: if 2 or more users share the same name, check details.
    // If details are also identical, discard one; if details differ, keep both.
    const deduplicated = deduplicateByUserDetails(formatted, {
      getScore: (p) => p.totalScore
    });

    const ranked = deduplicated.map((p, idx) => ({
      ...p,
      rank: idx + 1
    }));

    return NextResponse.json(ranked);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
