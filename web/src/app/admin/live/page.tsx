import { prisma } from "@/lib/prisma";
import { LiveControlClient } from "./LiveControlClient";

export const dynamic = "force-dynamic";

export default async function LiveControlPage() {
  let competitions: any[] = [];
  try {
    competitions = await prisma.competition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rounds: {
          orderBy: { order: "asc" }
        },
        _count: {
          select: { rounds: true, participants: true }
        }
      }
    });
  } catch (err) {
    console.error("Error fetching competitions for live deck:", err);
  }

  // Serialize Date objects for React Client Component
  const serialized = competitions.map(c => ({
    ...c,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
    rounds: (c.rounds || []).map((r: any) => ({
      ...r,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date().toISOString(),
      startTime: r.startTime ? r.startTime.toISOString() : null,
      endTime: r.endTime ? r.endTime.toISOString() : null,
    }))
  }));

  return <LiveControlClient initialQuizzes={serialized} />;
}
