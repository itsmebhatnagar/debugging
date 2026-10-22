"use client";

import React, { useState, useMemo } from "react";
import { 
  CrewEmblem 
} from "@/components/icons/CrewEmblem";
import { 
  CompassRose 
} from "@/components/icons/CompassRose";
import { 
  Rivet 
} from "@/components/icons/Rivet";
import { 
  Anchor 
} from "@/components/icons/Anchor";
import {
  EchonaButton,
  EchonaEmptyState,
  useEchonaToast
} from "@/components/ui/EchonaUI";
import { updateParticipantStatus, enrollAllUsersAsParticipants } from "@/app/actions/admin";
import { deduplicateByUserDetails } from "@/lib/deduplicate";

interface ParticipantItem {
  id: string;
  competitionId: string;
  userId: string;
  score: number;
  status: "WAITING" | "QUALIFIED" | "DISQUALIFIED";
  createdAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    mobile?: string | null;
    role?: string;
  };
  competition?: {
    id: string;
    name: string;
    status: string;
  };
}

interface ParticipantsClientProps {
  initialParticipants: ParticipantItem[];
  competitions: Array<{ id: string; name: string; status: string }>;
}

export function ParticipantsClient({ initialParticipants, competitions }: ParticipantsClientProps) {
  const [participants, setParticipants] = useState<ParticipantItem[]>(() => deduplicateByUserDetails(initialParticipants || []));
  const [selectedCompId, setSelectedCompId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState<boolean>(false);

  const { showToast, ToastComponent } = useEchonaToast();

  // Metrics
  const stats = useMemo(() => {
    const total = participants.length;
    const waiting = participants.filter(p => p.status === "WAITING").length;
    const qualified = participants.filter(p => p.status === "QUALIFIED").length;
    const disqualified = participants.filter(p => p.status === "DISQUALIFIED").length;
    return { total, waiting, qualified, disqualified };
  }, [participants]);

  // Filtered List
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      if (selectedCompId !== "ALL" && p.competitionId !== selectedCompId) {
        return false;
      }
      if (selectedStatus !== "ALL" && p.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (p.user?.name || "").toLowerCase();
        const email = (p.user?.email || "").toLowerCase();
        const mobile = (p.user?.mobile || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !mobile.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [participants, selectedCompId, selectedStatus, searchQuery]);

  // Refresh participants from API
  const refreshParticipants = async () => {
    try {
      const res = await fetch("/api/admin/participants", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setParticipants(deduplicateByUserDetails(data.participants || []));
      }
    } catch (e) {
      console.error("Failed to refresh participants:", e);
    }
  };

  // Change individual participant status
  const handleStatusChange = async (
    competitionId: string, 
    userId: string, 
    newStatus: "WAITING" | "QUALIFIED" | "DISQUALIFIED",
    userName?: string | null
  ) => {
    setUpdatingUserId(userId);
    
    // Optimistic UI update
    setParticipants(prev => prev.map(p => 
      (p.userId === userId && p.competitionId === competitionId) ? { ...p, status: newStatus } : p
    ));

    try {
      const res = await updateParticipantStatus(competitionId, userId, newStatus, "ADMIN_OVERRIDE");
      if (res.success) {
        showToast("success", "STATUS UPDATED", `${userName || "Sailor"} marked as ${newStatus}`);
      } else {
        showToast("error", "ERROR", "Failed to update status");
        refreshParticipants();
      }
    } catch (err: any) {
      showToast("error", "ERROR", err.message || "Failed to update status");
      refreshParticipants();
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Reset all to WAITING
  const handleResetAllToWaiting = async () => {
    if (!confirm("Are you sure you want to mark ALL participants as WAITING?")) return;
    setIsBulkLoading(true);
    try {
      const activeCompetitionId = selectedCompId !== "ALL" ? selectedCompId : competitions[0]?.id;
      if (!activeCompetitionId) return;

      const promises = filteredParticipants.map(p => 
        updateParticipantStatus(p.competitionId, p.userId, "WAITING", "ADMIN_RESET_ALL")
      );
      await Promise.all(promises);

      setParticipants(prev => prev.map(p => ({ ...p, status: "WAITING" })));
      showToast("success", "STATUS RESET", "All selected participants are now marked as WAITING.");
    } catch {
      showToast("error", "ERROR", "Could not reset all statuses.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Enroll all registered users
  const handleEnrollAll = async () => {
    setIsBulkLoading(true);
    try {
      const targetCompId = selectedCompId !== "ALL" ? selectedCompId : competitions[0]?.id;
      if (!targetCompId) {
        showToast("error", "ERROR", "Please select a competition first.");
        return;
      }

      await enrollAllUsersAsParticipants(targetCompId);
      showToast("success", "CREW ENROLLED", "All registered users are now enrolled in the competition.");
      await refreshParticipants();
    } catch (e: any) {
      showToast("error", "ERROR", e.message || "Failed to enroll users.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Restore sample pirates
  const handleRestoreSampleCrew = async () => {
    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/admin/restore-seed", { method: "POST", credentials: "include" });
      if (res.ok) {
        showToast("success", "FLEET RESTORED", "Sample pirate crew and questions seeded successfully!");
        await refreshParticipants();
      } else {
        showToast("error", "ERROR", "Failed to restore seed.");
      }
    } catch {
      showToast("error", "ERROR", "Network error occurred.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <ToastComponent />

      {/* ── Page Header ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#C7A04A]/30 pb-6 relative">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border border-[#C7A04A]/50 bg-[#17100C] flex items-center justify-center shadow-lg">
            <CrewEmblem className="w-8 h-8 text-[#E2C36A]" />
          </div>
          <div>
            <h1 
              className="text-3xl md:text-4xl text-[#F4E7C7] mb-1 tracking-wider uppercase font-bold"
              style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
            >
              Participant Fleet
            </h1>
            <p className="text-[#E7D19A]/80 text-xs tracking-[0.2em] uppercase font-bold">
              Live Sailor Statuses, Qualification Overrides & Manifest
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <EchonaButton 
            variant="secondary" 
            onClick={handleRestoreSampleCrew}
            disabled={isBulkLoading}
            className="text-[10px] px-3 py-2 border-[#C7A04A]/40 text-[#C7A04A]"
          >
            ⚓ RESTORE SAMPLE CREW
          </EchonaButton>
          <EchonaButton 
            variant="secondary" 
            onClick={handleEnrollAll}
            disabled={isBulkLoading}
            className="text-[10px] px-3 py-2"
          >
            + ENROLL ALL USERS
          </EchonaButton>
          <EchonaButton 
            variant="secondary" 
            onClick={handleResetAllToWaiting}
            disabled={isBulkLoading}
            className="text-[10px] px-3 py-2 border-amber-500/50 text-amber-300"
          >
            ⟳ SET ALL WAITING
          </EchonaButton>
        </div>
      </header>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total */}
        <div className="p-1 rounded-sm bg-gradient-to-b from-[#C7A04A] to-[#8B5E34] shadow-xl">
          <div className="bg-[#17100C] p-5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
            <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
            <p className="text-[#C7A04A] text-[10px] font-black uppercase tracking-[0.25em] mb-2">Total Crew</p>
            <p className="text-3xl font-pirate text-[#F4E7C7]">{stats.total}</p>
          </div>
        </div>

        {/* Waiting */}
        <div className="p-1 rounded-sm bg-gradient-to-b from-amber-500/60 to-amber-900/60 shadow-xl">
          <div className="bg-[#17100C] p-5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
            <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-amber-400 text-[10px] font-black uppercase tracking-[0.25em]">Waiting</p>
            </div>
            <p className="text-3xl font-pirate text-amber-300">{stats.waiting}</p>
          </div>
        </div>

        {/* Qualified */}
        <div className="p-1 rounded-sm bg-gradient-to-b from-emerald-500/60 to-emerald-900/60 shadow-xl">
          <div className="bg-[#17100C] p-5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
            <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.25em]">Qualified</p>
            </div>
            <p className="text-3xl font-pirate text-emerald-300">{stats.qualified}</p>
          </div>
        </div>

        {/* Disqualified */}
        <div className="p-1 rounded-sm bg-gradient-to-b from-red-500/60 to-red-900/60 shadow-xl">
          <div className="bg-[#17100C] p-5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
            <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.25em]">Disqualified</p>
            </div>
            <p className="text-3xl font-pirate text-red-300">{stats.disqualified}</p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="bg-[#17100C] border border-[#8B5E34]/30 p-4 rounded-sm flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
        {/* Search */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search sailors by name, email or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#080706] border border-[#8B5E34]/40 rounded-sm px-4 py-2 text-xs text-[#F4E7C7] focus:outline-none focus:border-[#C7A04A] placeholder:text-[#8B5E34]/60 tracking-wider"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "WAITING", "QUALIFIED", "DISQUALIFIED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-sm text-[10px] font-bold tracking-wider uppercase transition-all ${
                selectedStatus === status
                  ? status === "QUALIFIED"
                    ? "bg-emerald-500/30 border border-emerald-400 text-emerald-300 shadow-md"
                    : status === "DISQUALIFIED"
                    ? "bg-red-500/30 border border-red-400 text-red-300 shadow-md"
                    : status === "WAITING"
                    ? "bg-amber-500/30 border border-amber-400 text-amber-300 shadow-md"
                    : "bg-[#C7A04A]/30 border border-[#C7A04A] text-[#F4E7C7] shadow-md"
                  : "bg-[#080706] border border-[#8B5E34]/30 text-[#8B5E34] hover:text-[#E7D19A]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Competition Dropdown */}
        {competitions.length > 1 && (
          <div className="w-full md:w-auto">
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="w-full bg-[#080706] border border-[#8B5E34]/40 text-[#E7D19A] text-xs font-bold tracking-widest px-3 py-2 outline-none uppercase"
            >
              <option value="ALL">ALL EXPEDITIONS</option>
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Participants Table ── */}
      <div className="border border-[#8B5E34]/40 bg-[#080706] rounded-sm overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#17100C] border-b border-[#C7A04A]/30">
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Pirate Sailor</th>
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Contact</th>
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Expedition</th>
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Bounty Score</th>
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] text-center">Live Status</th>
              <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] text-right">Change Live Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-16">
                  <EchonaEmptyState 
                    title="NO SAILORS FOUND" 
                    description="No participants match your search criteria. Enroll registered users or restore the sample fleet."
                  />
                </td>
              </tr>
            ) : (
              filteredParticipants.map((p, idx) => {
                const isUpdating = updatingUserId === p.userId;
                const status = p.status || "WAITING";

                return (
                  <tr 
                    key={p.id}
                    className={`border-b border-[#8B5E34]/20 hover:bg-[#17100C]/60 transition-colors ${
                      idx % 2 === 0 ? 'bg-[#0a0504]' : 'bg-[#080706]'
                    }`}
                  >
                    {/* Name & ID */}
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#17100C] border border-[#C7A04A]/40 flex items-center justify-center shrink-0">
                        <CrewEmblem className="w-5 h-5 text-[#C7A04A]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#F4E7C7] tracking-wider uppercase">
                          {p.user?.name || "Unknown Sailor"}
                        </div>
                        <div className="text-[10px] text-[#8B5E34] font-mono">
                          ID: {p.userId.slice(-8)}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-4 text-xs text-[#E7D19A]/80 font-mono">
                      <div>{p.user?.email}</div>
                      {p.user?.mobile && (
                        <div className="text-[#C7A04A] text-[10px] mt-0.5">{p.user.mobile}</div>
                      )}
                    </td>

                    {/* Expedition */}
                    <td className="p-4 text-xs font-semibold text-[#E7D19A] tracking-wider uppercase">
                      {p.competition?.name || "Echona Pirate Clash"}
                    </td>

                    {/* Score */}
                    <td className="p-4">
                      <span className="font-pirate text-xl text-[#10B981]">{p.score}</span>
                      <span className="text-[10px] text-[#8B5E34] font-bold ml-1 uppercase">PTS</span>
                    </td>

                    {/* Current Live Status Badge */}
                    <td className="p-4 text-center">
                      {status === "QUALIFIED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 border border-emerald-500/70 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          QUALIFIED (IN BATTLE)
                        </span>
                      ) : status === "DISQUALIFIED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-950/70 border border-red-500/70 text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                          DISQUALIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 border border-amber-500/70 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          WAITING (NOT STARTED)
                        </span>
                      )}
                    </td>

                    {/* Option to change live status */}
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1 bg-[#17100C] border border-[#8B5E34]/40 p-1 rounded-sm shadow-inner">
                        {/* WAITING */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(p.competitionId, p.userId, "WAITING", p.user?.name)}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-all ${
                            status === "WAITING"
                              ? "bg-amber-500/30 border border-amber-400 text-amber-300 shadow-sm"
                              : "text-[#8B5E34] hover:text-amber-300 hover:bg-amber-500/10"
                          } disabled:opacity-50`}
                          title="Mark as Waiting (Not started)"
                        >
                          WAITING
                        </button>

                        {/* QUALIFIED */}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(p.competitionId, p.userId, "QUALIFIED", p.user?.name)}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-all ${
                            status === "QUALIFIED"
                              ? "bg-emerald-500/30 border border-emerald-400 text-emerald-300 shadow-sm"
                              : "text-[#8B5E34] hover:text-emerald-300 hover:bg-emerald-500/10"
                          } disabled:opacity-50`}
                          title="Mark as Qualified (In Battle / Active)"
                        >
                          QUALIFIED
                        </button>

                        {/* DISQUALIFIED */}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Disqualify ${p.user?.name || "this sailor"}? They will be locked out.`)) {
                              handleStatusChange(p.competitionId, p.userId, "DISQUALIFIED", p.user?.name);
                            }
                          }}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-all ${
                            status === "DISQUALIFIED"
                              ? "bg-red-500/30 border border-red-500 text-red-300 shadow-sm"
                              : "text-[#8B5E34] hover:text-red-400 hover:bg-red-500/10"
                          } disabled:opacity-50`}
                          title="Disqualify sailor"
                        >
                          DISQUALIFY
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
