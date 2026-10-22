"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BulkImportModal } from '@/components/admin/BulkImportModal';
import { 
  EchonaButton, EchonaInput, EchonaConfirmDialog, 
  EchonaStatus, EchonaLoader, EchonaEmptyState, EchonaTabs, useEchonaToast 
} from '@/components/ui/EchonaUI';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { CompassRose } from '@/components/icons/CompassRose';
import { CrewEmblem } from '@/components/icons/CrewEmblem';
import { Anchor } from '@/components/icons/Anchor';
import { Rivet } from '@/components/icons/Rivet';
import { deduplicateByUserDetails } from '@/lib/deduplicate';

export default function QuizManagerPage() {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'rounds' | 'participants'>('rounds');
  const [participants, setParticipants] = useState<any[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { showToast, ToastComponent } = useEchonaToast();

  // Forms states
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [newRound, setNewRound] = useState({
    name: '', questionTimer: '', overallTimer: '', marksPerCorrect: '1', marksPerWrong: '0'
  });

  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    username: '', password: '', name: '', college: '', email: '', phone: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'round'|'participant', id: string} | null>(null);

  const fetchQuizData = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQuiz(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}/participants`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setParticipants(deduplicateByUserDetails(data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQuizData();
    fetchParticipants();
  }, [quizId]);

  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [isSubmittingParticipant, setIsSubmittingParticipant] = useState(false);

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRound) return;
    setIsSubmittingRound(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newRound.name,
          questionTimer: newRound.questionTimer ? parseInt(newRound.questionTimer) : null,
          overallTimer: newRound.overallTimer ? parseInt(newRound.overallTimer) * 60 : null,
          marksPerCorrect: parseFloat(newRound.marksPerCorrect),
          marksPerWrong: parseFloat(newRound.marksPerWrong)
        })
      });
      if (res.ok) {
        setShowRoundForm(false);
        setNewRound({ name: '', questionTimer: '', overallTimer: '', marksPerCorrect: '1', marksPerWrong: '0' });
        showToast('success', 'STAGE CHARTED', 'New voyage stage has been successfully plotted.');
        fetchQuizData();
      } else {
        showToast('error', 'NAVIGATION ERROR', 'Failed to chart this stage.');
      }
    } catch (err) {
      showToast('error', 'NAVIGATION ERROR', 'Network error occurred.');
    } finally {
      setIsSubmittingRound(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    
    if (deleteConfirm.type === 'round') {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/rounds/${deleteConfirm.id}`, { method: 'DELETE', credentials: 'include' });
        showToast('success', 'STAGE REMOVED', 'The stage has been erased from the log.');
        fetchQuizData();
      } catch (e) {
        showToast('error', 'ERROR', 'Could not erase stage.');
      }
    } else if (deleteConfirm.type === 'participant') {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/participants/${deleteConfirm.id}`, { method: 'DELETE', credentials: 'include' });
        showToast('success', 'CREW MEMBER DISMISSED', 'Participant removed from manifest.');
        fetchParticipants();
      } catch (e) {
        showToast('error', 'ERROR', 'Could not dismiss crew member.');
      }
    }
    setDeleteConfirm(null);
  };

  const handleActivateQuiz = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'READY' }) // or ACTIVE
      });
      if (res.ok) {
        showToast('success', 'EXPEDITION READY', 'The expedition is now ready to begin.');
        fetchQuizData();
      } else {
        showToast('error', 'ERROR', 'Could not activate the expedition.');
      }
    } catch (err) {
      showToast('error', 'ERROR', 'Network error occurred.');
    }
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingParticipant) return;
    setIsSubmittingParticipant(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newParticipant)
      });
      if (res.ok) {
        setShowParticipantForm(false);
        setNewParticipant({ username: '', password: '', name: '', college: '', email: '', phone: '' });
        showToast('success', 'CREW MEMBER ADDED', 'Participant successfully signed the manifest.');
        fetchParticipants();
      } else {
        showToast('error', 'ERROR', 'Failed to add crew member.');
      }
    } catch (err) {
      showToast('error', 'ERROR', 'Network error occurred.');
    } finally {
      setIsSubmittingParticipant(false);
    }
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleResetQuiz = async () => {
    if (!confirm("Are you sure you want to RESET the entire debugging challenge? All scores, submissions, and progress across all rounds will be wiped clean!")) return;
    setActionLoading("RESET_QUIZ");
    try {
      const res = await fetch(`/api/quizzes/${quizId}/reset`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('success', 'EXPEDITION RESET', 'The whole expedition has been reset.');
        fetchQuizData();
        fetchParticipants();
      } else {
        showToast('error', 'ERROR', 'Could not reset expedition.');
      }
    } catch {
      showToast('error', 'ERROR', 'Network error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartQuiz = async () => {
    if (!confirm("Are you sure you want to RESTART the entire debugging challenge? All previous answers will be wiped and Round 1 will be activated!")) return;
    setActionLoading("RESTART_QUIZ");
    try {
      const res = await fetch(`/api/quizzes/${quizId}/restart`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('success', 'EXPEDITION RESTARTED', 'Expedition restarted. Round 1 is now active!');
        fetchQuizData();
        fetchParticipants();
      } else {
        showToast('error', 'ERROR', 'Could not restart expedition.');
      }
    } catch {
      showToast('error', 'ERROR', 'Network error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreSeed = async () => {
    if (!confirm("Restore database seed? This will restore all standard pirate championship questions in all 3 rounds!")) return;
    setActionLoading("RESTORE_SEED");
    try {
      const res = await fetch('/api/admin/restore-seed', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('success', 'DATABASE RESTORED', 'All 3 rounds and questions seeded successfully!');
        fetchQuizData();
        fetchParticipants();
      } else {
        showToast('error', 'ERROR', 'Failed to restore seed.');
      }
    } catch {
      showToast('error', 'ERROR', 'Network error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetRound = async (roundId: string) => {
    if (!confirm("Reset this specific round? Submissions for this round will be cleared!")) return;
    setActionLoading(`RESET_${roundId}`);
    try {
      const res = await fetch(`/api/quizzes/rounds/${roundId}/reset`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('success', 'STAGE RESET', 'Stage has been reset.');
        fetchQuizData();
      }
    } catch {
      showToast('error', 'ERROR', 'Failed to reset stage.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartRound = async (roundId: string) => {
    if (!confirm("Restart this specific round immediately?")) return;
    setActionLoading(`RESTART_${roundId}`);
    try {
      const res = await fetch(`/api/quizzes/rounds/${roundId}/restart`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('success', 'STAGE RESTARTED', 'Stage is now active.');
        fetchQuizData();
      }
    } catch {
      showToast('error', 'ERROR', 'Failed to restart stage.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-10"><EchonaLoader /></div>;
  if (!quiz) return <EchonaEmptyState title="EXPEDITION LOST" description="The requested log entry could not be found." />;

  return (
    <div className="p-4 sm:p-6 lg:p-7 max-w-[1500px] w-full mx-auto space-y-4">
      <ToastComponent />
      
      {/* ── Header ── */}
      <header className="mb-4 border-b border-[#8B5E34]/30 pb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <Link href="/admin/quizzes" className="text-[#C7A04A] hover:text-[#F4E7C7] text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2 mb-2 transition-colors">
            <span className="text-base">←</span> RETURN TO CAPTAIN'S LOG
          </Link>
          <div className="flex items-center gap-3">
            <TreasureMap className="w-8 h-8 sm:w-10 sm:h-10 text-[#C7A04A]" />
            <div>
              <p className="text-[#8B5E34] text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase mb-0.5">Expedition Log</p>
              <h2 className="text-2xl sm:text-3xl text-[#F4E7C7] font-bold tracking-wider" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                {quiz.name}
              </h2>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:items-end gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#8B5E34] text-[10px] uppercase font-bold tracking-[0.2em]">Status</span>
            <div className="bg-[#17100C] border border-[#C7A04A]/30 px-3 py-1 rounded-sm shadow-inner">
              <EchonaStatus status={quiz.status} />
            </div>
          </div>

          {/* Reset / Restart Quiz Global Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <EchonaButton 
              variant="secondary" 
              onClick={handleRestoreSeed}
              disabled={actionLoading !== null}
              className="text-[10px] px-3 py-2 border-[#C7A04A]/40 text-[#C7A04A]"
            >
              {actionLoading === "RESTORE_SEED" ? "RESTORING..." : "⚓ RESTORE QUESTIONS"}
            </EchonaButton>
            <EchonaButton 
              variant="secondary" 
              onClick={handleResetQuiz}
              disabled={actionLoading !== null}
              className="text-[10px] px-3 py-2"
            >
              {actionLoading === "RESET_QUIZ" ? "RESETTING..." : "⟳ RESET DEBUGGING"}
            </EchonaButton>
            <EchonaButton 
              variant="primary" 
              onClick={handleRestartQuiz}
              disabled={actionLoading !== null}
              className="text-[10px] px-3 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white"
            >
              {actionLoading === "RESTART_QUIZ" ? "RESTARTING..." : "▶ RESTART DEBUGGING"}
            </EchonaButton>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="mb-8">
        <EchonaTabs 
          tabs={[
            { id: 'rounds', label: 'VOYAGE STAGES', icon: <CompassRose className="w-4 h-4" /> },
            { id: 'participants', label: 'CREW MANIFEST', icon: <CrewEmblem className="w-4 h-4" /> }
          ]} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* ── Main Content Area ── */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* ════════ ROUNDS TAB ════════ */}
          {activeTab === 'rounds' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#E7D19A] text-lg font-bold tracking-[0.15em] uppercase" style={{ fontFamily: '"Cinzel", serif' }}>
                  Voyage Stages <span className="text-[#8B5E34] text-sm">({quiz.rounds?.length || 0})</span>
                </h3>
                <EchonaButton onClick={() => setShowRoundForm(!showRoundForm)} variant={showRoundForm ? 'ghost' : 'primary'}>
                  {showRoundForm ? 'CANCEL' : '+ ADD STAGE'}
                </EchonaButton>
              </div>

              {/* Add Round Form */}
              {showRoundForm && (
                <div className="mb-8 p-[1px] bg-gradient-to-b from-[#8B5E34] to-[#2B1710] rounded-sm">
                  <div className="bg-[#17100C] p-6 relative overflow-hidden">
                    <form onSubmit={handleCreateRound} className="relative z-10 grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <EchonaInput label="STAGE NAME" required value={newRound.name} onChange={(e: any) => setNewRound({...newRound, name: e.target.value})} placeholder="e.g. The Deep Waters" />
                      </div>
                      <EchonaInput label="QUESTION TIMER (SEC)" type="number" value={newRound.questionTimer} onChange={(e: any) => setNewRound({...newRound, questionTimer: e.target.value})} placeholder="Optional" />
                      <EchonaInput label="OVERALL TIMER (MIN)" type="number" value={newRound.overallTimer} onChange={(e: any) => setNewRound({...newRound, overallTimer: e.target.value})} placeholder="Optional" />
                      <EchonaInput label="MARKS (CORRECT)" type="number" step="0.5" required value={newRound.marksPerCorrect} onChange={(e: any) => setNewRound({...newRound, marksPerCorrect: e.target.value})} />
                      <EchonaInput label="MARKS (WRONG)" type="number" step="0.5" required value={newRound.marksPerWrong} onChange={(e: any) => setNewRound({...newRound, marksPerWrong: e.target.value})} />
                      <div className="col-span-2 flex justify-end pt-4 border-t border-[#8B5E34]/30">
                        <EchonaButton type="submit">CHART STAGE</EchonaButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Rounds List */}
              {quiz.rounds?.length === 0 ? (
                <EchonaEmptyState title="NO VOYAGE STAGES CHARTED" description="Add your first stage to chart this expedition's course." />
              ) : (
                <div className="space-y-4">
                  {quiz.rounds?.map((round: any, index: number) => (
                    <div key={round.id} className="group relative p-[1px] bg-gradient-to-r from-[#5A1712] via-[#2B1710] to-[#17100C] rounded-sm transition-transform hover:-translate-y-1">
                      <div className="bg-[#080706] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[#741714]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-center gap-4 relative z-10">
                          <div className="w-10 h-10 flex items-center justify-center rounded-sm bg-[#17100C] border border-[#C7A04A]/30 text-[#C7A04A] font-bold font-pirate text-xl">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="text-[#F4E7C7] font-bold tracking-widest uppercase mb-1">{round.name}</h4>
                            <div className="flex gap-4 text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase">
                              <span><strong className="text-[#10B981]">+{round.marksPerCorrect}</strong> / <strong className="text-[#741714]">-{round.marksPerWrong}</strong> PTS</span>
                              {round.questionTimer && <span>{round.questionTimer}S Q-TIMER</span>}
                              {round.overallTimer && <span className="ml-2">{Math.round(round.overallTimer / 60)}M OVERALL</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 relative z-10">
                          <button
                            type="button"
                            onClick={() => handleResetRound(round.id)}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1.5 rounded-sm border border-[#C7A04A]/30 bg-[#17100C] text-[#C7A04A] hover:text-[#F4E7C7] hover:border-[#C7A04A] text-[9px] font-bold tracking-wider uppercase transition-colors"
                            title="Reset this stage to pending"
                          >
                            ⟳ RESET
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestartRound(round.id)}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1.5 rounded-sm border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 hover:text-emerald-200 text-[9px] font-bold tracking-wider uppercase transition-colors"
                            title="Restart this stage immediately"
                          >
                            ▶ RESTART
                          </button>
                          <Link href={`/admin/quizzes/${quizId}/rounds/${round.id}`} className="group/btn relative inline-flex items-center justify-center px-4 py-2 rounded-sm uppercase tracking-widest text-[10px] font-bold text-[#E7D19A]" style={{ background: 'linear-gradient(to bottom, #2B1710, #17100C)', border: '1px solid rgba(199, 160, 74, 0.4)' }}>
                            <span className="relative z-10 group-hover/btn:text-[#F4E7C7]">OPEN LOG</span>
                          </Link>
                          <button onClick={() => setDeleteConfirm({type: 'round', id: round.id})} className="text-[#741714] hover:text-[#E2C36A] px-2 transition-colors">
                            <Anchor className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ PARTICIPANTS TAB ════════ */}
          {activeTab === 'participants' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#E7D19A] text-lg font-bold tracking-[0.15em] uppercase" style={{ fontFamily: '"Cinzel", serif' }}>
                  Crew Manifest <span className="text-[#8B5E34] text-sm">({participants.length})</span>
                </h3>
                <div className="flex gap-3">
                  <EchonaButton variant="secondary" onClick={() => {
                    let csv = 'Name,Username,Password,College\n';
                    participants.forEach(p => {
                      csv += `"${p.name}","${p.username}","${p.plainPassword || 'echona2025'}","${p.college || ''}"\n`;
                    });
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${quiz?.name || 'debugging'}_crew_credentials.csv`;
                    a.click();
                  }}>
                    DOWNLOAD CREDENTIALS
                  </EchonaButton>
                  <EchonaButton variant="secondary" onClick={() => setImportModalOpen(true)}>
                    IMPORT CREW MANIFEST
                  </EchonaButton>
                  <EchonaButton onClick={() => setShowParticipantForm(!showParticipantForm)} variant={showParticipantForm ? 'ghost' : 'primary'}>
                    {showParticipantForm ? 'CANCEL' : '+ ADD CREW MEMBER'}
                  </EchonaButton>
                </div>
              </div>

              {/* Add Participant Form */}
              {showParticipantForm && (
                <div className="mb-8 p-[1px] bg-gradient-to-b from-[#8B5E34] to-[#2B1710] rounded-sm">
                  <div className="bg-[#17100C] p-6 relative overflow-hidden">
                    <form onSubmit={handleCreateParticipant} className="relative z-10 grid grid-cols-2 gap-6">
                      <EchonaInput label="USERNAME (LOGIN ID)" required value={newParticipant.username} onChange={(e: any) => setNewParticipant({...newParticipant, username: e.target.value})} />
                      <EchonaInput label="PASSWORD" value={newParticipant.password} onChange={(e: any) => setNewParticipant({...newParticipant, password: e.target.value})} placeholder="Default: echona2026" />
                      <EchonaInput label="FULL NAME" value={newParticipant.name} onChange={(e: any) => setNewParticipant({...newParticipant, name: e.target.value})} />
                      <EchonaInput label="COLLEGE / INSTITUTION" value={newParticipant.college} onChange={(e: any) => setNewParticipant({...newParticipant, college: e.target.value})} />
                      <div className="col-span-2 flex justify-end pt-4 border-t border-[#8B5E34]/30">
                        <EchonaButton type="submit">SIGN MANIFEST</EchonaButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Participants Table */}
              <div className="border border-[#8B5E34]/40 bg-[#080706] rounded-sm overflow-hidden shadow-xl">
                <div className="overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-[#17100C] border-b border-[#C7A04A]/30">
                        <th className="px-4 py-3 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Crew Member</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Institution</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12">
                            <EchonaEmptyState title="NO CREW ABOARD" description="Add participants manually or import a crew manifest." />
                          </td>
                        </tr>
                      ) : (
                        participants.map((p, idx) => (
                          <tr key={p.id} className={`border-b border-[#8B5E34]/20 hover:bg-[#17100C]/50 transition-colors ${idx % 2 === 0 ? 'bg-[#0a0504]' : 'bg-[#080706]'}`}>
                            <td className="px-4 py-3 flex items-center gap-3">
                              <CrewEmblem className="w-6 h-6 text-[#8B5E34]" />
                              <div>
                                <div className="text-sm font-bold text-[#F4E7C7] tracking-wider uppercase">{p.name || '-'}</div>
                                <div className="text-[10px] text-[#8B5E34] font-bold tracking-[0.2em] uppercase">@{p.username}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-[#E7D19A] tracking-wider uppercase">{p.college || '-'}</td>
                            <td className="px-4 py-3">
                              <EchonaStatus status={p.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => setDeleteConfirm({type: 'participant', id: p.id})} className="text-[#741714] hover:text-[#E2C36A] font-bold text-[10px] uppercase tracking-widest px-2 transition-colors">
                                DISMISS
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar (Expedition Manifest) ── */}
        <div className="space-y-6">
          <div className="p-[1px] rounded-sm bg-gradient-to-b from-[#C7A04A] to-[#8B5E34] shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
            <div className="bg-[#17100C] p-6 relative overflow-hidden text-center">
              <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 2px)' }} />
              
              <Rivet className="absolute top-2 left-2 w-2 h-2" />
              <Rivet className="absolute top-2 right-2 w-2 h-2" />
              <Rivet className="absolute bottom-2 left-2 w-2 h-2" />
              <Rivet className="absolute bottom-2 right-2 w-2 h-2" />

              <h4 className="text-[#C7A04A] font-black uppercase tracking-[0.2em] text-xs mb-6 border-b border-[#C7A04A]/30 pb-4 relative z-10">
                <Anchor className="w-4 h-4 mx-auto mb-2" />
                EXPEDITION MANIFEST
              </h4>
              
              <div className="space-y-4 relative z-10">
                <div>
                  <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">STAGES</p>
                  <p className="text-[#F4E7C7] text-2xl font-pirate">{quiz.rounds?.length || 0}</p>
                </div>
                <div>
                  <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">ACTIVE CREW</p>
                  <p className="text-[#F4E7C7] text-2xl font-pirate">{participants.length}</p>
                </div>
                <div>
                  <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">MAX CREW LIMIT</p>
                  <p className="text-[#F4E7C7] text-xl font-pirate">{quiz.maxParticipants ? quiz.maxParticipants.toString().padStart(2, '0') : '∞'}</p>
                </div>
              </div>
              
              {quiz.status === 'DRAFT' && (
                <div className="mt-8 pt-6 border-t border-[#8B5E34]/30 relative z-10">
                  <EchonaButton onClick={handleActivateQuiz} className="w-full text-[10px]">
                    MARK AS READY
                  </EchonaButton>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Confirm Delete Dialog ── */}
      <EchonaConfirmDialog 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title={deleteConfirm?.type === 'round' ? "ERASE VOYAGE STAGE?" : "DISMISS CREW MEMBER?"}
        message={deleteConfirm?.type === 'round' 
          ? "This will permanently delete this stage and all associated questions. This action cannot be undone." 
          : "This will remove this crew member from the expedition manifest permanently."}
        confirmText={deleteConfirm?.type === 'round' ? "ERASE STAGE" : "DISMISS MEMBER"}
        cancelText="CANCEL"
        isDanger={true}
      />

      {/* ── Bulk Import Modal ── */}
      {importModalOpen && (
        <BulkImportModal
          importType="participants"
          targetId={String(quizId)}
          onClose={() => setImportModalOpen(false)}
          onImportComplete={() => {
            showToast('success', 'MANIFEST CHARTED', 'Crew members imported successfully.');
            setImportModalOpen(false);
            fetchParticipants();
          }}
        />
      )}
    </div>
  );
};
