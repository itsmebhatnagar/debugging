import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ParticipantsClient } from "./ParticipantsClient";
import { deduplicateByUserDetails } from "@/lib/deduplicate";

import { cookies } from "next/headers";
import { readAdminToken } from "@/lib/admin-token";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  const session = await auth();
  let isAdmin = session?.user?.role === "ADMIN";

  if (!isAdmin) {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("admin_token")?.value;
    if (adminToken) {
      try {
        const decoded = await readAdminToken(adminToken);
        if (decoded) {
          isAdmin = true;
        }
      } catch {}
    }
  }

  if (!isAdmin) {
    redirect("/admin/login");
  }

  // Fetch participants with user and competition details
  const [participants, competitions] = await Promise.all([
    prisma.competitionParticipant.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.competition.findMany({
      select: {
        id: true,
        name: true,
        status: true
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const sanitizedParticipants = participants.map(p => ({
    id: p.id,
    competitionId: p.competitionId,
    userId: p.userId,
    score: p.score,
    status: (p.status as "WAITING" | "QUALIFIED" | "DISQUALIFIED") || "WAITING",
    createdAt: p.createdAt.toISOString(),
    user: {
      id: p.user?.id || p.userId,
      name: p.user?.name || "Unknown Sailor",
      email: p.user?.email || "",
      mobile: p.user?.mobile || null,
      role: p.user?.role || "USER"
    },
    competition: p.competition ? {
      id: p.competition.id,
      name: p.competition.name,
      status: p.competition.status
    } : undefined
  }));

  // Deduplicate participants: if 2 or more share same name, check details.
  // If details are also identical, discard one; if details differ, keep both.
  const deduplicatedParticipants = deduplicateByUserDetails(sanitizedParticipants, {
    getScore: (p) => p.score
  });

  return (
    <ParticipantsClient 
      initialParticipants={deduplicatedParticipants} 
      competitions={competitions} 
    />
  );
}
