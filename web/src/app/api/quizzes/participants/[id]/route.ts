import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { broadcastEvent } from "@/lib/realtime";

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
    await prisma.competitionParticipant.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, score } = body;

    const data: any = {};
    if (status) data.status = status;
    if (typeof score === "number") data.score = score;

    const updated = await prisma.competitionParticipant.update({
      where: { id },
      data,
      include: { user: true }
    });

    // Broadcast status change
    await broadcastEvent(updated.competitionId, "participant_status_changed", {
      competitionId: updated.competitionId,
      userId: updated.userId,
      status: updated.status,
      userName: updated.user?.name,
      userEmail: updated.user?.email
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
