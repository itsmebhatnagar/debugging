import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { seedPirateChampionship } from "@/lib/seed-championship";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const comp = await seedPirateChampionship();

    return NextResponse.json({
      success: true,
      message: "Database seed and all 3 rounds of questions successfully restored!",
      competitionId: comp.id
    });
  } catch (error: any) {
    console.error("POST /api/admin/restore-seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
