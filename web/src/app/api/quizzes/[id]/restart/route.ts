import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { restartCompetitionAdmin } from "@/app/actions/admin";

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
    await restartCompetitionAdmin(id);

    return NextResponse.json({ success: true, message: "Expedition restarted successfully" });
  } catch (error: any) {
    console.error("POST /api/quizzes/[id]/restart error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
