"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { CompassRose } from '@/components/icons/CompassRose';
import { Rivet } from '@/components/icons/Rivet';
import { CrewEmblem } from '@/components/icons/CrewEmblem';
import {
  EchonaButton,
  EchonaInput,
  EchonaModal,
  EchonaConfirmDialog,
  EchonaStatus,
  EchonaLoader,
  EchonaEmptyState,
  useEchonaToast
} from '@/components/ui/EchonaUI';

interface QuizListClientProps {
  initialQuizzes: any[];
}

export function QuizListClient({ initialQuizzes }: QuizListClientProps) {
  const [quizzes, setQuizzes] = useState<any[]>(initialQuizzes || []);
  const [loading, setLoading] = useState(false);

  // Form state for new quiz
  const [showNewForm, setShowNewForm] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ name: '', description: '', maxParticipants: '' });
  
  // Delete confirm state
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

  const { showToast, ToastComponent } = useEchonaToast();

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quizzes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newQuiz.name,
          description: newQuiz.description,
          maxParticipants: newQuiz.maxParticipants ? parseInt(newQuiz.maxParticipants) : null
        })
      });
      if (res.ok) {
        setShowNewForm(false);
        setNewQuiz({ name: '', description: '', maxParticipants: '' });
        showToast('success', 'EXPEDITION CHARTED', 'The new debugging challenge has been added to the captain\'s log.');
        fetchQuizzes();
      } else {
        showToast('error', 'NAVIGATION ERROR', 'Failed to chart expedition.');
      }
    } catch (err) {
      showToast('error', 'NAVIGATION ERROR', 'Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!quizToDelete) return;
    try {
      await fetch(`/api/quizzes/${quizToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      showToast('success', 'EXPEDITION ABANDONED', 'The debugging challenge has been successfully deleted.');
      fetchQuizzes();
    } catch (e) {
      showToast('error', 'ERROR', 'Could not delete expedition.');
    } finally {
      setQuizToDelete(null);
    }
  };

  if (loading) return <div className="p-10"><EchonaLoader /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-7 max-w-[1500px] w-full mx-auto space-y-4">
      <ToastComponent />
      
      {/* ── Main Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-transparent pb-3 relative">
        <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C7A04A]/50 to-transparent" />
        <div className="absolute bottom-[-9px] left-1/2 -translate-x-1/2 flex items-center justify-center opacity-80">
           <CompassRose className="w-4 h-4 text-[#C7A04A]" />
        </div>
        
        <div className="flex items-center gap-3">
          <TreasureMap className="w-8 h-8 text-[#C7A04A] hidden sm:block opacity-80" />
          <div>
            <h2 className="text-2xl sm:text-3xl text-[#F4E7C7] tracking-wider uppercase font-bold" style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              Captain's Log
            </h2>
            <p className="text-[#E7D19A]/80 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold">
              Manage your ECHONA expeditions and their crews.
            </p>
          </div>
        </div>
        
        <div>
          <EchonaButton onClick={() => setShowNewForm(true)} className="text-[10px] sm:text-xs px-3 py-1.5">
            + New Expedition
          </EchonaButton>
        </div>
      </header>

      {/* ── Expedition Grid ── */}
      <div className="space-y-4">
        {quizzes.length === 0 ? (
          <EchonaEmptyState 
            title="NO EXPEDITIONS IN THE LOG" 
            description="Chart your first expedition to begin the voyage."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="group relative p-[1px] rounded-sm transition-all hover:-translate-y-1" style={{ background: 'linear-gradient(to bottom, #8B5E34, #2B1710)', boxShadow: '0 8px 16px rgba(0,0,0,0.6)' }}>
                <div className="h-full bg-[#17100C] relative overflow-hidden flex flex-col justify-between">
                  {/* Textures */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 2px)' }} />
                  
                  {/* Rivets */}
                  <Rivet className="absolute top-2 left-2 w-2 h-2 opacity-80" />
                  <Rivet className="absolute top-2 right-2 w-2 h-2 opacity-80" />
                  <Rivet className="absolute bottom-2 left-2 w-2 h-2 opacity-80" />
                  <Rivet className="absolute bottom-2 right-2 w-2 h-2 opacity-80" />

                  <div className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4 border-b border-[#8B5E34]/30 pb-4">
                      <div className="flex items-center gap-3">
                        <TreasureMap className="w-5 h-5 text-[#C7A04A]" />
                        <h3 className="text-[#F4E7C7] text-lg font-bold tracking-widest uppercase" style={{ fontFamily: '"Cinzel Decorative", serif' }}>{quiz.name}</h3>
                      </div>
                      <EchonaStatus status={quiz.status} />
                    </div>
                    
                    <p className="text-[#E7D19A]/70 text-sm mb-6 line-clamp-2 leading-relaxed">
                      {quiz.description || 'No charting details recorded for this voyage.'}
                    </p>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
                      <div className="flex items-center gap-2 text-[#C7A04A] text-xs font-bold tracking-widest">
                        <CompassRose className="w-4 h-4" />
                        <span>{quiz._count?.rounds || 0} STAGES</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#C7A04A] text-xs font-bold tracking-widest">
                        <CrewEmblem className="w-4 h-4" />
                        <span>{quiz.maxParticipants ? `MAX ${quiz.maxParticipants} CREW` : 'OPEN CREW'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#C7A04A] text-xs font-bold tracking-widest">
                        <span className="opacity-60 font-sans tracking-normal">◷ {new Date(quiz.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Actions */}
                  <div className="bg-[#0a0504]/50 border-t border-[#C7A04A]/20 p-4 flex gap-4 justify-end relative z-10">
                    <Link href={`/admin/quizzes/${quiz.id}`} className="group/btn relative inline-flex items-center justify-center gap-2 px-6 py-2 rounded-sm uppercase tracking-widest text-xs font-bold transition-all text-[#E7D19A]" style={{ background: 'linear-gradient(to bottom, #2B1710, #17100C)', border: '1px solid rgba(199, 160, 74, 0.4)' }}>
                      <div className="absolute inset-0 bg-[#C7A04A]/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      <span className="relative z-10 group-hover/btn:text-[#F4E7C7]">Open Log</span>
                    </Link>
                    <EchonaButton variant="danger" onClick={() => setQuizToDelete(quiz.id)}>
                      Abandon
                    </EchonaButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      <EchonaModal isOpen={showNewForm} onClose={() => setShowNewForm(false)} title="CREATE NEW EXPEDITION">
        <form onSubmit={handleCreate} className="space-y-6">
          <EchonaInput 
            label="EXPEDITION NAME" 
            required 
            value={newQuiz.name} 
            onChange={(e: any) => setNewQuiz({ ...newQuiz, name: e.target.value })} 
            placeholder="e.g. The Caribbean Run"
          />
          
          <div className="flex flex-col">
            <label className="text-[#8B5E34] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 pl-1">DESCRIPTION</label>
            <div className="relative">
              <Rivet className="absolute top-1 left-1 w-1.5 h-1.5 opacity-60 z-10" />
              <Rivet className="absolute top-1 right-1 w-1.5 h-1.5 opacity-60 z-10" />
              <Rivet className="absolute bottom-1 left-1 w-1.5 h-1.5 opacity-60 z-10" />
              <Rivet className="absolute bottom-1 right-1 w-1.5 h-1.5 opacity-60 z-10" />
              <textarea
                value={newQuiz.description}
                onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                rows={3}
                placeholder="Log notes about this uncharted voyage..."
                className="w-full bg-[#17100C] border border-[#8B5E34]/50 rounded-sm p-4 text-[#F4E7C7] text-sm focus:outline-none focus:border-[#C7A04A] transition-colors placeholder:text-[#E7D19A]/30 resize-none"
              />
            </div>
          </div>

          <EchonaInput 
            label="MAX CREW CAPACITY (OPTIONAL)" 
            type="number"
            value={newQuiz.maxParticipants} 
            onChange={(e: any) => setNewQuiz({ ...newQuiz, maxParticipants: e.target.value })} 
            placeholder="Unlimited if left empty"
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-[#8B5E34]/20">
            <EchonaButton variant="secondary" onClick={() => setShowNewForm(false)}>
              Cancel
            </EchonaButton>
            <EchonaButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Charting...' : 'Chart Expedition'}
            </EchonaButton>
          </div>
        </form>
      </EchonaModal>

      {/* ── Delete Confirmation ── */}
      <EchonaConfirmDialog
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleDelete}
        title="ABANDON EXPEDITION?"
        message="Are you certain you wish to strike this expedition from the records? All associated log stages and crew manifests will be permanently lost to Davy Jones' Locker."
        confirmText="Abandon Ship"
        isDanger={true}
      />
    </div>
  );
}
