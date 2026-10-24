import { getLeaderboard } from "@/app/actions/leaderboard"
import { prisma } from "@/lib/prisma"
import LeaderboardRefresher from "@/components/LeaderboardRefresher"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminLeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  let isAdmin = session?.user?.role === "ADMIN"

  if (!isAdmin) {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const adminToken = cookieStore.get("admin_token")?.value
    if (adminToken) {
      try {
        const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString())
        if (decoded?.role === "ADMIN") isAdmin = true
      } catch {}
    }
  }

  if (!isAdmin) redirect("/admin/login")

  const { id: competitionId } = await params
  
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      name: true,
      rounds: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, name: true },
      },
    },
  })
  if (!competition) return notFound()

  const leaderboard = await getLeaderboard(competitionId)

  return (
    <div className="p-4 sm:p-6 lg:p-7 max-w-[1500px] w-full mx-auto text-[#d4cbb3] font-sans space-y-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-col gap-3 border-b-2 border-[#8b7355] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-widest text-[#d4af37]">ADMIN BOUNTY BOARD</h1>
            <p className="mt-1 text-sm text-[#8b7355]">{competition.name}</p>
            <div className="mt-2"><LeaderboardRefresher competitionId={competitionId} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/admin/competitions/${competitionId}/export?type=leaderboard`} className="rounded border border-[#d4af37]/50 px-3 py-2 text-sm font-bold text-[#d4af37] hover:bg-[#d4af37]/10">
              Download leaderboard CSV
            </a>
            <a href={`/api/admin/competitions/${competitionId}/export?type=participants`} className="rounded border border-[#8b7355] px-3 py-2 text-sm font-bold text-[#d4cbb3] hover:bg-white/5">
              Download participants CSV
            </a>
            <Link href={`/admin/competitions/${competitionId}`} className="px-3 py-2 text-sm text-[#8b7355] underline hover:text-[#d4cbb3]">
              Back to Details
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border-2 border-[#8b7355] bg-[#2a2a2a] shadow-2xl shadow-black">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b-2 border-[#8b7355] bg-[#0a0a0a]">
              <tr>
                <th className="px-6 py-4 text-xl font-bold text-[#d4af37]">Rank</th>
                <th className="px-6 py-4 text-xl font-bold text-[#d4af37]">Pirate</th>
                {competition.rounds.map((round) => (
                  <th key={round.id} className="px-4 py-4 text-right text-sm font-bold text-[#d4af37]">
                    Round {round.order}
                  </th>
                ))}
                <th className="px-6 py-4 text-right text-xl font-bold text-[#d4af37]">Bounty (Score)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((participant) => (
                <tr 
                  key={participant.id} 
                  className="border-b border-[#8b7355] last:border-0 hover:bg-[#1e1e1e] transition-colors"
                >
                  <td className="px-6 py-4 text-2xl font-bold text-[#d4cbb3]">{participant.rank}</td>
                  <td className="px-6 py-4 text-xl text-[#d4cbb3]">
                    {participant.name}
                  </td>
                  {participant.roundScores.map((round) => (
                    <td key={round.id} className="px-4 py-4 text-right text-lg text-[#d4cbb3]">
                      {round.score}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right text-2xl font-bold text-[#d4af37]">{participant.totalScore}</td>
                </tr>
              ))}
              
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={3 + competition.rounds.length} className="px-6 py-12 text-center text-[#8b7355]">
                    No bounties claimed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
