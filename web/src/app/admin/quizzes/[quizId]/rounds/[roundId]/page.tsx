"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BulkImportModal } from '@/components/admin/BulkImportModal';
import { 
  EchonaButton, EchonaInput, EchonaConfirmDialog, 
  EchonaLoader, EchonaEmptyState, EchonaTabs, useEchonaToast 
} from '@/components/ui/EchonaUI';
import { CompassRose } from '@/components/icons/CompassRose';
import { QuillMap } from '@/components/icons/QuillMap';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { Anchor } from '@/components/icons/Anchor';
import { CrewEmblem } from '@/components/icons/CrewEmblem';

export default function RoundManagerPage() {
  const { quizId, roundId } = useParams();
  const [round, setRound] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { showToast, ToastComponent } = useEchonaToast();

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '', marks: '', negativeMarks: '', explanation: '',
    options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const resQuiz = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${quizId}`, { credentials: 'include' });
      if (resQuiz.ok) {
        const quizData = await resQuiz.json();
        const r = quizData.rounds.find((rnd: any) => rnd.id === roundId);
        setRound(r);
      }

      const resQ = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/rounds/${roundId}/questions`, { credentials: 'include' });
      if (resQ.ok) setQuestions(await resQ.json());

      const resS = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/rounds/${roundId}/scoreboard`, { credentials: 'include' });
      if (resS.ok) setScoreboard(await resS.json());

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [roundId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/rounds/${roundId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: newQuestion.text,
          marks: newQuestion.marks !== '' ? parseFloat(newQuestion.marks) : null,
          negativeMarks: newQuestion.negativeMarks !== '' ? parseFloat(newQuestion.negativeMarks) : null,
          explanation: newQuestion.explanation,
          options: newQuestion.options.filter(o => o.text.trim() !== '')
        })
      });
      if (res.ok) {
        setShowQuestionForm(false);
        setNewQuestion({
          text: '', marks: '', negativeMarks: '', explanation: '',
          options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
        });
        showToast('success', 'QUESTION CHARTED', 'The question has been added to this stage.');
        fetchData();
      } else {
        showToast('error', 'ERROR', 'Could not add question.');
      }
    } catch (err) {
      showToast('error', 'ERROR', 'Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if(!deleteConfirm) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/questions/${deleteConfirm}`, { method: 'DELETE', credentials: 'include' });
      showToast('success', 'QUESTION REMOVED', 'The question has been struck from the record.');
      fetchData();
    } catch (e) {
      showToast('error', 'ERROR', 'Could not remove question.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleOptionChange = (index: number, field: string, value: any) => {
    const opts = [...newQuestion.options];
    (opts[index] as any)[field] = value;
    if (field === 'isCorrect' && value === true) {
      opts.forEach((o, i) => { if (i !== index) o.isCorrect = false; });
    }
    setNewQuestion({ ...newQuestion, options: opts });
  };

  const exportResults = () => {
    if (scoreboard.length === 0) return;
    const header = "Rank,Username,Name,College,Total Score,Status\n";
    const rows = scoreboard.map((s, index) => 
      `${index + 1},${s.participant.username},"${s.participant.name}","${s.participant.college}",${s.totalScore},${s.qualificationStatus}`
    ).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${round?.name || 'Round'}_Results.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('success', 'LOG EXPORTED', 'The scoreboard has been downloaded as a manifest.');
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleResetRound = async () => {
    if (!confirm("Are you sure you want to RESET this stage? All test attempts and submissions for this round will be cleared!")) return;
    setActionLoading("RESET");
    try {
      const res = await fetch(`/api/quizzes/rounds/${roundId}/reset`, { method: "POST", credentials: "include" });
      if (res.ok) {
        showToast("success", "STAGE RESET", "The stage has been reset to pending state.");
        fetchData();
      } else {
        showToast("error", "ERROR", "Failed to reset stage.");
      }
    } catch {
      showToast("error", "ERROR", "Network error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartRound = async () => {
    if (!confirm("Are you sure you want to RESTART this stage? All previous answers will be wiped and the stage will start immediately!")) return;
    setActionLoading("RESTART");
    try {
      const res = await fetch(`/api/quizzes/rounds/${roundId}/restart`, { method: "POST", credentials: "include" });
      if (res.ok) {
        showToast("success", "STAGE RESTARTED", "The stage is now actively running with fresh attempts.");
        fetchData();
      } else {
        showToast("error", "ERROR", "Failed to restart stage.");
      }
    } catch {
      showToast("error", "ERROR", "Network error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-10"><EchonaLoader text="CHARTING STAGE..." /></div>;
  if (!round) return <EchonaEmptyState title="STAGE LOST" description="The requested stage could not be found." />;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <ToastComponent />
      
      {/* ── Header ── */}
      <header className="mb-10 border-b border-[#8B5E34]/30 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Link href={`/admin/quizzes/${quizId}`} className="text-[#C7A04A] hover:text-[#F4E7C7] text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2 mb-4 transition-colors">
            <span className="text-lg">←</span> RETURN TO EXPEDITION LOG
          </Link>
          <div className="flex items-center gap-4">
            <CompassRose className="w-12 h-12 text-[#C7A04A]" />
            <div>
              <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Stage Management</p>
              <h2 className="text-3xl text-[#F4E7C7] font-bold tracking-wider uppercase" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                {round.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Reset & Restart Round Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <EchonaButton 
            variant="secondary" 
            onClick={handleResetRound}
            disabled={actionLoading !== null}
            className="text-[10px] px-3 py-2"
          >
            {actionLoading === "RESET" ? "RESETTING..." : "⟳ RESET STAGE"}
          </EchonaButton>
          <EchonaButton 
            variant="primary" 
            onClick={handleRestartRound}
            disabled={actionLoading !== null}
            className="text-[10px] px-3 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:brightness-110"
          >
            {actionLoading === "RESTART" ? "RESTARTING..." : "▶ RESTART STAGE"}
          </EchonaButton>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="mb-8">
        <EchonaTabs 
          tabs={[
            { id: 'questions', label: 'QUESTIONS', icon: <QuillMap className="w-4 h-4" /> },
            { id: 'results', label: 'LIVE SCOREBOARD', icon: <TreasureMap className="w-4 h-4" /> }
          ]} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      <div className="space-y-6">
        {/* ════════ QUESTIONS TAB ════════ */}
        {activeTab === 'questions' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[#E7D19A] text-lg font-bold tracking-[0.15em] uppercase" style={{ fontFamily: '"Cinzel", serif' }}>
                Stage Questions <span className="text-[#8B5E34] text-sm">({questions.length})</span>
              </h3>
              <div className="flex gap-3">
                <EchonaButton variant="secondary" onClick={() => setImportModalOpen(true)}>
                  IMPORT QUESTIONS
                </EchonaButton>
                <EchonaButton onClick={() => setShowQuestionForm(!showQuestionForm)} variant={showQuestionForm ? 'ghost' : 'primary'}>
                  {showQuestionForm ? 'CANCEL' : '+ ADD QUESTION'}
                </EchonaButton>
              </div>
            </div>

            {/* Add Question Form */}
            {showQuestionForm && (
              <div className="mb-8 p-[1px] bg-gradient-to-b from-[#8B5E34] to-[#2B1710] rounded-sm">
                <div className="bg-[#17100C] p-6 relative overflow-hidden">
                  <form onSubmit={handleCreateQuestion} className="relative z-10 grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <div className="flex flex-col">
                        <label className="text-[#8B5E34] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 pl-1">QUESTION TEXT</label>
                        <div className="relative">
                          <textarea
                            required
                            value={newQuestion.text}
                            onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                            className="w-full bg-[#17100C] border border-[#8B5E34] rounded-sm px-4 py-3 text-[#F4E7C7] text-sm focus:outline-none focus:border-[#C7A04A] transition-all placeholder:text-[#E7D19A]/30 shadow-inner min-h-[80px]"
                            placeholder="Enter the challenge..."
                          />
                        </div>
                      </div>
                    </div>
                    
                    <EchonaInput label="MARKS (+) [Optional]" type="number" step="0.5" value={newQuestion.marks} placeholder={`Default: ${round?.marksPerCorrect || 1}`} onChange={(e: any) => setNewQuestion({...newQuestion, marks: e.target.value})} />
                    <EchonaInput label="NEGATIVE MARKS (-) [Optional]" type="number" step="0.5" value={newQuestion.negativeMarks} placeholder={`Default: ${round?.marksPerWrong || 0}`} onChange={(e: any) => setNewQuestion({...newQuestion, negativeMarks: e.target.value})} />

                    <div className="col-span-2">
                      <label className="text-[#8B5E34] text-[10px] font-bold uppercase tracking-[0.2em] mb-3 block pl-1">OPTIONS (SELECT CORRECT ANSWER)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newQuestion.options.map((opt, i) => (
                          <div key={i} className={`flex items-center gap-3 p-2 border rounded-sm transition-colors ${opt.isCorrect ? 'border-[#10B981] bg-[#10B981]/10' : 'border-[#8B5E34]/50 bg-[#080706]'}`}>
                            <div className="relative flex items-center justify-center">
                              <input 
                                type="radio" 
                                name="correctOpt" 
                                checked={opt.isCorrect} 
                                onChange={() => handleOptionChange(i, 'isCorrect', true)} 
                                className="w-5 h-5 opacity-0 absolute cursor-pointer"
                              />
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${opt.isCorrect ? 'border-[#10B981]' : 'border-[#8B5E34]'}`}>
                                {opt.isCorrect && <div className="w-2 h-2 rounded-full bg-[#10B981]" />}
                              </div>
                            </div>
                            <input 
                              type="text" 
                              placeholder={`Option ${i+1}`} 
                              value={opt.text} 
                              onChange={e => handleOptionChange(i, 'text', e.target.value)} 
                              className="flex-1 bg-transparent border-none text-[#F4E7C7] text-sm focus:outline-none placeholder:text-[#8B5E34]/50" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-end pt-4 border-t border-[#8B5E34]/30">
                      <EchonaButton type="submit">SAVE QUESTION</EchonaButton>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-4">
              {questions.length === 0 ? (
                <EchonaEmptyState title="NO QUESTIONS CHARTED" description="Add your first question or import a manifest." />
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="relative p-[1px] bg-gradient-to-r from-[#2B1710] to-[#17100C] rounded-sm group">
                    <div className="bg-[#0a0504] border border-[#8B5E34]/20 p-6 rounded-sm relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 4px)' }} />
                      
                      <button onClick={() => setDeleteConfirm(q.id)} className="absolute top-4 right-4 text-[#741714] hover:text-[#E2C36A] px-2 transition-colors z-10 opacity-0 group-hover:opacity-100 flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest">
                        <span>Remove</span>
                        <Anchor className="w-4 h-4" />
                      </button>

                      <div className="flex gap-4 items-start mb-3 relative z-10 pr-20">
                        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-sm bg-[#17100C] border border-[#C7A04A]/30 text-[#C7A04A] font-bold font-pirate text-lg mt-0.5">
                          {idx+1}
                        </span>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-[#F4E7C7] font-bold text-lg leading-relaxed">{q.title || q.text}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-[#C7A04A]/20 border border-[#C7A04A]/40 text-[#C7A04A] uppercase">
                              {q.points || q.marks || 100} PTS
                            </span>
                          </div>
                          {q.description && (
                            <p className="text-[#E7D19A]/80 text-xs line-clamp-3 leading-relaxed mb-3">
                              {q.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {q.testCases && q.testCases.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12 relative z-10">
                          {q.testCases.map((tc: any, tIdx: number) => (
                            <div key={tc.id || tIdx} className="p-2.5 rounded-sm text-xs border border-[#8B5E34]/30 bg-[#17100C]/70 text-[#E7D19A]/90 font-mono">
                              <div className="flex justify-between items-center text-[10px] text-[#8B5E34] uppercase font-bold tracking-wider mb-1">
                                <span>Vector #{tIdx + 1}</span>
                                <span className={tc.isHidden ? "text-[#E2C36A]" : "text-[#10B981]"}>
                                  {tc.isHidden ? "Hidden Test" : "Public Test"}
                                </span>
                              </div>
                              <div className="truncate"><span className="text-[#C7A04A]">In:</span> {tc.input || "(empty)"}</div>
                              <div className="truncate"><span className="text-[#10B981]">Exp:</span> {tc.expected}</div>
                            </div>
                          ))}
                        </div>
                      ) : q.options && q.options.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12 relative z-10">
                          {q.options.map((opt: any) => (
                            <div key={opt.id} className={`p-3 rounded-sm text-sm border flex items-center justify-between ${opt.isCorrect ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981] font-semibold' : 'bg-[#17100C]/50 border-[#8B5E34]/20 text-[#E7D19A]/70'}`}>
                              <span>{opt.text}</span>
                              {opt.isCorrect && <span className="font-pirate text-lg leading-none">✓</span>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════════ RESULTS TAB ════════ */}
        {activeTab === 'results' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[#E7D19A] text-lg font-bold tracking-[0.15em] uppercase" style={{ fontFamily: '"Cinzel", serif' }}>
                Expedition Scoreboard
              </h3>
              <EchonaButton variant="secondary" onClick={exportResults}>
                EXPORT LOG
              </EchonaButton>
            </div>

            <div className="border border-[#8B5E34]/40 bg-[#080706] rounded-sm overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#17100C] border-b border-[#C7A04A]/30">
                    <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] w-16">Rank</th>
                    <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Crew Member</th>
                    <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em]">Institution</th>
                    <th className="p-4 text-[10px] font-bold text-[#C7A04A] uppercase tracking-[0.2em] text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12">
                        <EchonaEmptyState title="NO RECORDS FOUND" description="Crew members must complete the stage for records to appear." />
                      </td>
                    </tr>
                  ) : (
                    scoreboard.map((score, idx) => (
                      <tr key={score.id} className={`border-b border-[#8B5E34]/20 hover:bg-[#17100C]/50 transition-colors ${idx % 2 === 0 ? 'bg-[#0a0504]' : 'bg-[#080706]'}`}>
                        <td className="p-4">
                          <span className="text-[#8B5E34] font-pirate text-xl">#{idx + 1}</span>
                        </td>
                        <td className="p-4 flex items-center gap-3">
                          <CrewEmblem className="w-6 h-6 text-[#C7A04A]" />
                          <div>
                            <div className="text-sm font-bold text-[#F4E7C7] tracking-wider uppercase">{score.participant.name || '-'}</div>
                            <div className="text-[10px] text-[#8B5E34] font-bold tracking-[0.2em] uppercase">@{score.participant.username}</div>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-[#E7D19A] tracking-wider uppercase">{score.participant.college || '-'}</td>
                        <td className="p-4 text-right">
                          <span className="text-2xl font-pirate text-[#10B981]">{score.totalScore}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Dialog ── */}
      <EchonaConfirmDialog 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title="ERASE QUESTION?"
        message="This will permanently delete this question from the stage. This action cannot be undone."
        confirmText="ERASE QUESTION"
        cancelText="CANCEL"
        isDanger={true}
      />

      {/* ── Bulk Import Modal ── */}
      {importModalOpen && (
        <BulkImportModal
          importType="questions"
          targetId={String(roundId)}
          onClose={() => setImportModalOpen(false)}
          onImportComplete={() => {
            showToast('success', 'MANIFEST CHARTED', 'Questions imported successfully.');
            setImportModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
