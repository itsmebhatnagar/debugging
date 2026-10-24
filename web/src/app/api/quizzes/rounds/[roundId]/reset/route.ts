import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resetRoundAdmin } from "@/app/actions/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { roundId } = await params;
    await resetRoundAdmin(roundId);

    return NextResponse.json({ success: true, message: "Round reset successfully" });
  } catch (error: any) {
    console.error("POST /api/quizzes/rounds/[roundId]/reset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
