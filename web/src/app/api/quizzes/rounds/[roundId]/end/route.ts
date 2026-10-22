import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { endRoundAdmin } from "@/app/actions/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { roundId } = await params;
    await endRoundAdmin(roundId);

    return NextResponse.json({ success: true, message: "Round ended successfully" });
  } catch (error: unknown) {
    console.error("POST /api/quizzes/rounds/[roundId]/end error:", error);
    const message = error instanceof Error ? error.message : "Failed to end round";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
