import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AdminControlDeck } from "./AdminControlDeck"
import { getLiveAdminData } from "@/app/actions/admin"
import { Spotlight } from "@/components/ui/spotlight"

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    redirect("/login")
  }

  // Find the primary tournament
  let competition = await prisma.competition.findFirst({
    orderBy: { createdAt: "desc" }
  })

  if (!competition) {
    const { seedPirateChampionship } = await import("@/lib/seed-championship")
    competition = await seedPirateChampionship()
  }

  const liveData = await getLiveAdminData(competition.id)

  return (
    <div className="relative min-h-screen flex flex-col pt-24 lg:pt-16 pb-16 lg:pb-8 px-4 lg:px-6 z-10 text-[#f4ede0] overflow-x-hidden">
      <div className="relative z-10 mx-auto max-w-7xl px-2 sm:px-6 py-4 lg:py-6 w-full">
        {/* Massive Spotlight Wrapper for the entire Admin Deck */}
        <div className="relative w-full overflow-hidden rounded-[2rem] bg-[#d4af37]/20 p-[2px] shadow-2xl">
          <Spotlight className="from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl" size={600} />
          
          <div className="relative w-full h-full rounded-[2rem] bg-[#1a1714]/25 backdrop-blur-md p-4 sm:p-6 md:p-8 flex flex-col border border-[#d4af37]/10">
            <AdminControlDeck initialData={liveData} />
          </div>
        </div>
      </div>
    </div>
  )
}
