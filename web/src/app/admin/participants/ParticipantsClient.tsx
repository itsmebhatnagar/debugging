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
  EchonaModal,
  useEchonaToast
} from "@/components/ui/EchonaUI";
import { 
  updateParticipantStatus, 
  enrollAllUsersAsParticipants,
  deleteUserFromDatabase,
  deleteParticipantEntry 
} from "@/app/actions/admin";
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
  const [deleteTarget, setDeleteTarget] = useState<{
    userId: string;
    userName: string | null;
    userEmail: string;
    competitionId: string;
    role?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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

  // Delete user permanently from database (cascades to all records)
  const handleDeleteUserFromDb = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteUserFromDatabase(deleteTarget.userId);
      if (res.success) {
        showToast("success", "USER PURGED", `${deleteTarget.userName || "User"} (${deleteTarget.userEmail}) deleted permanently from database.`);
        setParticipants(prev => prev.filter(p => p.userId !== deleteTarget.userId));
        setDeleteTarget(null);
      } else {
        showToast("error", "ERROR", "Failed to delete user from database.");
      }
    } catch (err: any) {
      showToast("error", "ERROR", err.message || "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Remove participant from this competition fleet only
  const handleRemoveParticipantOnly = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteParticipantEntry(deleteTarget.competitionId, deleteTarget.userId);
      if (res.success) {
        showToast("success", "REMOVED FROM FLEET", `${deleteTarget.userName || "Sailor"} removed from this expedition.`);
        setParticipants(prev => prev.filter(p => !(p.userId === deleteTarget.userId && p.competitionId === deleteTarget.competitionId)));
        setDeleteTarget(null);
      } else {
        showToast("error", "ERROR", "Failed to remove participant.");
      }
    } catch (err: any) {
      showToast("error", "ERROR", err.message || "Failed to remove participant.");
    } finally {
      setIsDeleting(false);
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
    <div className="p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto space-y-4">
      <ToastComponent />

      {/* ── Page Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#C7A04A]/30 pb-3 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[#C7A04A]/50 bg-[#17100C] flex items-center justify-center shadow-lg shrink-0">
            <CrewEmblem className="w-6 h-6 sm:w-7 sm:h-7 text-[#E2C36A]" />
          </div>
          <div>
            <h1 
              className="text-2xl sm:text-3xl text-[#F4E7C7] tracking-wider uppercase font-bold"
              style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
            >
              Participant Fleet
            </h1>
            <p className="text-[#E7D19A]/80 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold">
              Live Sailor Statuses, Qualification Overrides & Manifest
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <EchonaButton 
            variant="secondary" 
            onClick={handleRestoreSampleCrew}
            disabled={isBulkLoading}
            className="text-[9px] sm:text-[10px] px-2.5 py-1.5 border-[#C7A04A]/40 text-[#C7A04A]"
          >
            RESTORE SAMPLE CREW
          </EchonaButton>
          <EchonaButton 
            variant="secondary" 
            onClick={handleEnrollAll}
            disabled={isBulkLoading}
            className="text-[9px] sm:text-[10px] px-2.5 py-1.5"
          >
            ENROLL ALL USERS
          </EchonaButton>
          <EchonaButton 
            variant="secondary" 
            onClick={handleResetAllToWaiting}
            disabled={isBulkLoading}
            className="text-[9px] sm:text-[10px] px-2.5 py-1.5 border-amber-500/50 text-amber-300"
          >
            SET ALL WAITING
          </EchonaButton>
        </div>
      </header>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total */}
        <div className="p-[1px] rounded-sm bg-gradient-to-b from-[#C7A04A] to-[#8B5E34] shadow-md">
          <div className="bg-[#17100C] p-3 sm:p-3.5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1 left-1 w-1.5 h-1.5" />
            <Rivet className="absolute top-1 right-1 w-1.5 h-1.5" />
            <p className="text-[#C7A04A] text-[9px] font-black uppercase tracking-[0.2em] mb-1">Total Crew</p>
            <p className="text-2xl sm:text-3xl font-pirate text-[#F4E7C7]">{stats.total}</p>
          </div>
        </div>

        {/* Waiting */}
        <div className="p-[1px] rounded-sm bg-gradient-to-b from-amber-500/60 to-amber-900/60 shadow-md">
          <div className="bg-[#17100C] p-3 sm:p-3.5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1 left-1 w-1.5 h-1.5" />
            <Rivet className="absolute top-1 right-1 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-amber-400 text-[9px] font-black uppercase tracking-[0.2em]">Waiting</p>
            </div>
            <p className="text-2xl sm:text-3xl font-pirate text-amber-300">{stats.waiting}</p>
          </div>
        </div>

        {/* Qualified */}
        <div className="p-[1px] rounded-sm bg-gradient-to-b from-emerald-500/60 to-emerald-900/60 shadow-md">
          <div className="bg-[#17100C] p-3 sm:p-3.5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1 left-1 w-1.5 h-1.5" />
            <Rivet className="absolute top-1 right-1 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">Qualified</p>
            </div>
            <p className="text-2xl sm:text-3xl font-pirate text-emerald-300">{stats.qualified}</p>
          </div>
        </div>

        {/* Disqualified */}
        <div className="p-[1px] rounded-sm bg-gradient-to-b from-red-500/60 to-red-900/60 shadow-md">
          <div className="bg-[#17100C] p-3 sm:p-3.5 rounded-sm relative overflow-hidden flex flex-col items-center text-center">
            <Rivet className="absolute top-1 left-1 w-1.5 h-1.5" />
            <Rivet className="absolute top-1 right-1 w-1.5 h-1.5" />
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <p className="text-red-400 text-[9px] font-black uppercase tracking-[0.2em]">Disqualified</p>
            </div>
            <p className="text-2xl sm:text-3xl font-pirate text-red-300">{stats.disqualified}</p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="bg-[#17100C] border border-[#8B5E34]/30 p-3 rounded-sm flex flex-col md:flex-row justify-between items-center gap-3 shadow-md">
        {/* Search */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search sailors by name, email or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#080706] border border-[#8B5E34]/40 rounded-sm px-3 py-1.5 text-xs text-[#F4E7C7] focus:outline-none focus:border-[#C7A04A] placeholder:text-[#8B5E34]/60 tracking-wider"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "WAITING", "QUALIFIED", "DISQUALIFIED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-2.5 py-1 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-all ${
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
              className="w-full bg-[#080706] border border-[#8B5E34]/40 text-[#E7D19A] text-xs font-bold tracking-widest px-3 py-1.5 outline-none uppercase"
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
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1240px]">
            <thead>
              <tr className="bg-[#17100C] border-b border-[#C7A04A]/30">
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap min-w-[200px]">Pirate Sailor</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap min-w-[210px]">Contact</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap min-w-[230px]">Expedition</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap text-center min-w-[100px]">Score</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap text-center min-w-[230px]">Live Status</th>
                <th className="px-4 py-3.5 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] whitespace-nowrap text-right min-w-[320px] pr-6">Actions</th>
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
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#17100C] border border-[#C7A04A]/40 flex items-center justify-center shrink-0">
                            <CrewEmblem className="w-5 h-5 text-[#C7A04A]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#F4E7C7] tracking-wider uppercase whitespace-nowrap">
                              {p.user?.name || "Unknown Sailor"}
                            </div>
                            <div className="text-[10px] text-[#8B5E34] font-mono whitespace-nowrap">
                              ID: {p.userId.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 align-middle text-xs text-[#E7D19A]/80 font-mono whitespace-nowrap">
                        <div>{p.user?.email}</div>
                        {p.user?.mobile && (
                          <div className="text-[#C7A04A] text-[10px] mt-0.5">{p.user.mobile}</div>
                        )}
                      </td>

                      {/* Expedition */}
                      <td className="px-4 py-3.5 align-middle text-xs font-semibold text-[#E7D19A] tracking-wider uppercase whitespace-nowrap">
                        {p.competition?.name || "Echona Pirate Clash"}
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                        <span className="font-pirate text-xl text-[#10B981]">{p.score}</span>
                        <span className="text-[10px] text-[#8B5E34] font-bold ml-1 uppercase">PTS</span>
                      </td>

                      {/* Current Live Status Badge */}
                      <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                        {status === "QUALIFIED" ? (
                          <span className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 border border-emerald-500/70 text-emerald-400 whitespace-nowrap shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span>QUALIFIED (IN BATTLE)</span>
                          </span>
                        ) : status === "DISQUALIFIED" ? (
                          <span className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-950/70 border border-red-500/70 text-red-400 whitespace-nowrap shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                            <span>DISQUALIFIED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 border border-amber-500/70 text-amber-400 whitespace-nowrap shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <span>WAITING (NOT STARTED)</span>
                          </span>
                        )}
                      </td>

                      {/* Actions: Live status + Delete */}
                      <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap pr-6">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <div className="inline-flex items-center gap-1 bg-[#17100C] border border-[#8B5E34]/40 p-1 rounded-sm shadow-inner">
                            {/* WAITING */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(p.competitionId, p.userId, "WAITING", p.user?.name)}
                              disabled={isUpdating || isDeleting}
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
                              disabled={isUpdating || isDeleting}
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
                              disabled={isUpdating || isDeleting}
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

                          {/* DELETE BUTTON */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({
                              userId: p.userId,
                              userName: p.user?.name || null,
                              userEmail: p.user?.email || "Unknown",
                              competitionId: p.competitionId,
                              role: p.user?.role
                            })}
                            disabled={isUpdating || isDeleting}
                            className="px-2.5 py-1.5 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-all bg-red-950/70 border border-red-600/70 text-red-300 hover:bg-red-900 hover:text-white hover:border-red-400 disabled:opacity-40 flex items-center gap-1 shadow-md shrink-0"
                            title="Expel / Delete user from fleet or database"
                          >
                            <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>DELETE</span>
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

      {/* ── Deletion Confirmation Modal ── */}
      <EchonaModal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="EXPEL SAILOR ENTRY"
      >
        <div className="space-y-4">
          <div className="bg-[#17100C]/90 border border-[#8B5E34]/40 p-4 rounded-sm text-left shadow-inner">
            <div className="text-[10px] uppercase font-bold text-[#C7A04A] tracking-[0.2em] mb-1">
              Sailor Identification
            </div>
            <div className="text-base font-bold text-[#F4E7C7] tracking-wider uppercase">
              {deleteTarget?.userName || "Anonymous Sailor"}
            </div>
            <div className="text-xs text-[#E7D19A]/80 font-mono mt-0.5">
              {deleteTarget?.userEmail}
            </div>
            <div className="text-[10px] text-[#8B5E34] font-mono mt-1">
              UUID: {deleteTarget?.userId}
            </div>
            {deleteTarget?.role === "ADMIN" && (
              <div className="mt-2.5 text-[10px] bg-amber-500/20 border border-amber-500/50 text-amber-300 px-2 py-1 rounded-sm inline-block font-bold tracking-wider">
                NOTICE: This user account has an ADMIN role.
              </div>
            )}
          </div>

          <p className="text-xs text-[#2B1710] font-semibold leading-relaxed">
            Please choose the desired expulsion action for this sailor. You can either remove them solely from this competition expedition, or permanently purge their entire account and history from the database.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Action 1: Remove from Fleet Manifest Only */}
            <button
              type="button"
              onClick={handleRemoveParticipantOnly}
              disabled={isDeleting}
              className="flex flex-col items-start p-3 bg-[#17100C] border border-[#8B5E34] hover:border-[#C7A04A] text-left rounded-sm transition-all group disabled:opacity-50 shadow-md"
            >
              <span className="text-xs font-bold text-[#F4E7C7] group-hover:text-[#E2C36A] uppercase tracking-wider flex items-center gap-1.5">
                Remove From Fleet Only
              </span>
              <span className="text-[10px] text-[#E7D19A]/70 mt-1.5 leading-snug">
                Removes entry from this competition fleet. The user account and login remain active.
              </span>
            </button>

            {/* Action 2: Purge Entire User from Database */}
            <button
              type="button"
              onClick={handleDeleteUserFromDb}
              disabled={isDeleting}
              className="flex flex-col items-start p-3 bg-red-950/80 border border-red-600 hover:border-red-400 text-left rounded-sm transition-all group disabled:opacity-50 shadow-md"
            >
              <span className="text-xs font-bold text-red-300 group-hover:text-red-100 uppercase tracking-wider flex items-center gap-1.5">
                Delete From Database
              </span>
              <span className="text-[10px] text-red-200/80 mt-1.5 leading-snug">
                Permanent cascade purge. Deletes user account, submissions, scores, draft code, and login credentials.
              </span>
            </button>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#8B5E34]/30">
            <EchonaButton
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="!text-[#8B5E34] hover:!text-[#2B1710]"
            >
              Cancel
            </EchonaButton>
          </div>
        </div>
      </EchonaModal>
    </div>
  );
}
