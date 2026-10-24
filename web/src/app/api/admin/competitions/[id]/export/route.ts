import { prisma } from "@/lib/prisma"
import { getCompetitionLeaderboard } from "@/lib/leaderboard"
import { deduplicateByUserDetails } from "@/lib/deduplicate"
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/admin-auth"

function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function csvResponse(rows: Array<Array<string | number>>, filename: string) {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(request)
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const { id: competitionId } = await params
  const reportType = request.nextUrl.searchParams.get("type")

  try {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true },
    })
    if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 })

    if (reportType === "leaderboard") {
      const leaderboard = await getCompetitionLeaderboard(competitionId)
      const rounds = leaderboard[0]?.roundScores ?? (await prisma.round.findMany({
        where: { competitionId },
        orderBy: { order: "asc" },
        select: { id: true, order: true, name: true },
      })).map((round) => ({ ...round, score: 0 }))

      return csvResponse([
        ["Name", ...rounds.map((round) => `Round ${round.order}: ${round.name}`), "Total Score"],
        ...leaderboard.map((participant) => [
          participant.name,
          ...participant.roundScores.map((round) => round.score),
          participant.totalScore,
        ]),
      ], "leaderboard.csv")
    }

    if (reportType === "participants") {
      const participants = await prisma.competitionParticipant.findMany({
        where: { competitionId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, mobile: true } } },
      })

      // Deduplicate: if 2 or more users share the same name, check details.
      // If details are also identical, discard one; if details differ, keep both.
      const deduplicated = deduplicateByUserDetails(participants, {
        getScore: (p) => p.score,
      })

      return csvResponse([
        ["Name", "Email", "Status", "Joined At"],
        ...deduplicated.map((participant) => [
          participant.user.name || participant.user.email.split("@")[0],
          participant.user.email,
          participant.status,
          participant.createdAt.toISOString(),
        ]),
      ], "participants.csv")
    }

    return NextResponse.json({ error: "Choose leaderboard or participants export" }, { status: 400 })
  } catch (error) {
    console.error("[Admin CSV export]", error)
    return NextResponse.json({ error: "Could not create the requested CSV export" }, { status: 500 })
  }
}
