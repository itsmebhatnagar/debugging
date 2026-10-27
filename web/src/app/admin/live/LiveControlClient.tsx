"use client";
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BulkImportModal } from '@/components/admin/BulkImportModal';
import { ScoreboardModal } from '@/components/admin/ScoreboardModal';
import { 
  EchonaButton, EchonaConfirmDialog, EchonaStatus, EchonaLoader, 
  EchonaEmptyState, useEchonaToast, EchonaTabs 
} from '@/components/ui/EchonaUI';
import { ShipWheel } from '@/components/icons/ShipWheel';
import { CompassRose } from '@/components/icons/CompassRose';
import { Anchor } from '@/components/icons/Anchor';
import { CaptainFlag } from '@/components/icons/CaptainFlag';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { CrewEmblem } from '@/components/icons/CrewEmblem';
import { Rivet } from '@/components/icons/Rivet';
import { QuillMap } from '@/components/icons/QuillMap';

interface LiveControlClientProps {
  initialQuizzes: any[];
}

export function LiveControlClient({ initialQuizzes }: LiveControlClientProps) {
  const [quizzes, setQuizzes] = useState<any[]>(initialQuizzes || []);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveStats, setLiveStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [importModal, setImportModal] = useState<{ type: string; targetId: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>('DISCONNECTED');
  
  const [activeQuizId, setActiveQuizId] = useState<string | null>(() => {
    if (!initialQuizzes || initialQuizzes.length === 0) return null;
    const active = initialQuizzes.find((q: any) => 
      q.status === 'ACTIVE' || q.status === 'COUNTDOWN' || q.status === 'WAITING' || q.status === 'PAUSED'
    );
    return active ? active.id : initialQuizzes[0].id;
  });

  const [confirmAction, setConfirmAction] = useState<{ action: string; roundId: string; title: string; message: string; confirmText: string; isDanger?: boolean } | null>(null);
  const [scoreboardModal, setScoreboardModal] = useState<{ roundId: string; roundName: string } | null>(null);
  const [eventLog, setEventLog] = useState<{time: string, msg: string, type: 'info'|'success'|'warning'|'error'}[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const realtimeOutageLogged = useRef(false);

  const { showToast, ToastComponent } = useEchonaToast();

  const getCookie = (name: string) => {
    if (typeof window === 'undefined') return null;
    const local = localStorage.getItem(name);
    if (local) return local;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  const addLog = (msg: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    setEventLog(prev => [...prev, { time, msg, type }]);
  };

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  // Sync token from localStorage to cookie if not already set
  useEffect(() => {
    const token = getCookie('admin_token');
    if (token && typeof document !== 'undefined' && !document.cookie.includes('admin_token=')) {
      document.cookie = `admin_token=${token}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, []);

  // Sync state if initialQuizzes updates from server revalidation
  useEffect(() => {
    if (initialQuizzes && initialQuizzes.length > 0) {
      setQuizzes(initialQuizzes);
      setActiveQuizId(prev => {
        if (prev && initialQuizzes.some((q: any) => q.id === prev)) return prev;
        const active = initialQuizzes.find((q: any) => 
          q.status === 'ACTIVE' || q.status === 'COUNTDOWN' || q.status === 'WAITING' || q.status === 'PAUSED'
        );
        return active ? active.id : initialQuizzes[0].id;
      });
    }
  }, [initialQuizzes]);

  const fetchQuizzes = async () => {
    try {
      const token = getCookie('admin_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/quizzes', { credentials: 'include', headers });
      if (!res.ok) {
        console.warn(`Failed to fetch quizzes: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        setQuizzes(list);
        setActiveQuizId(prev => {
          if (prev && list.some((q: any) => q.id === prev)) {
            return prev;
          }
          const active = list.find((q: any) => q.status === 'ACTIVE' || q.status === 'COUNTDOWN' || q.status === 'WAITING' || q.status === 'PAUSED');
          return active ? active.id : list[0].id;
        });
      }
    } catch {
      showToast('error', 'SERVER OFFLINE', 'Could not establish contact with headquarters.');
    }
  };

  useEffect(() => {
    fetchQuizzes();

    const token = getCookie('admin_token');
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001';

    const newSocket = io(realtimeUrl, {
      auth: { token },
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
    });

    newSocket.on('connect', () => {
      setConnectionStatus('CONNECTED');
      newSocket.emit('join_admin');
      if (activeQuizId) {
        newSocket.emit('join_competition', activeQuizId);
      }
      if (realtimeOutageLogged.current) {
        addLog('Command link restored.', 'success');
        showToast('success', 'LINK RESTORED', 'Command deck reconnected to the real-time server.');
      } else {
        addLog('Command link established.', 'success');
        showToast('success', 'LINK ACTIVE', 'Command deck is now connected to the real-time server.');
      }
      realtimeOutageLogged.current = false;
    });
    
    newSocket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      setConnectionStatus('RECONNECTING');
      if (!realtimeOutageLogged.current) {
        addLog(`Command link lost (${reason}). Reconnecting...`, 'warning');
        realtimeOutageLogged.current = true;
      }
    });

    newSocket.on('connect_error', (err) => {
      setConnectionStatus('RECONNECTING');
      if (!realtimeOutageLogged.current) {
        console.error('Socket connection error:', err);
        addLog(`Realtime service unavailable at ${realtimeUrl} (${err.message}). Retrying...`, 'warning');
        realtimeOutageLogged.current = true;
      }
    });

    newSocket.io.on('reconnect_attempt', () => {
      setConnectionStatus('RECONNECTING');
    });

    newSocket.on('round_started', (data: any) => {
      addLog(`Voyage stage started: Round ${data.roundOrder} (${data.roundName})`, 'success');
      showToast('success', 'STAGE STARTED', `Round ${data.roundOrder} (${data.roundName}) is now live.`);
      fetchQuizzes();
      if (data?.roundId) requestStats(data.roundId);
    });

    newSocket.on('round_ended', (data: any) => {
      addLog(`Voyage stage concluded: ${data.roundName || 'Stage'}`, 'warning');
      showToast('warning', 'STAGE ENDED', `${data.roundName || 'Stage'} has concluded.`);
      fetchQuizzes();
      if (data?.roundId) requestStats(data.roundId);
    });

    newSocket.on('test_starting', (data: any) => {
      addLog(`Expedition countdown initiated: ${data.countdownSeconds || 60}s remaining`, 'info');
      showToast('info', 'COUNTDOWN INITIATED', `Battle begins in ${data.countdownSeconds || 60} seconds!`);
      fetchQuizzes();
    });

    newSocket.on('test_ended', (data: any) => {
      addLog(`Expedition closed: ${data.message || 'All tests submitted.'}`, 'warning');
      showToast('warning', 'EXPEDITION ENDED', 'All tests have been automatically submitted.');
      fetchQuizzes();
    });

    newSocket.on('submission_created', (data: any) => {
      addLog(`Submission received: Verdict ${data.verdict || data.status} (Points: ${data.pointsEarned ?? 0})`, 'info');
      quizzes.find(q => q.id === activeQuizId)?.rounds?.forEach((r: any) => requestStats(r.id));
    });

    newSocket.on('leaderboard_updated', () => {
      quizzes.find(q => q.id === activeQuizId)?.rounds?.forEach((r: any) => requestStats(r.id));
    });

    newSocket.on('participant_disqualified', (data: any) => {
      addLog(`⚠️ Disqualification: ${data.userName || data.userEmail || data.userId} (${data.reason || 'Rules violation'})`, 'error');
      showToast('error', 'DISQUALIFICATION', `${data.userName || 'Sailor'} disqualified: ${data.reason || 'Rules violation'}`);
      quizzes.find(q => q.id === activeQuizId)?.rounds?.forEach((r: any) => requestStats(r.id));
    });

    newSocket.on('competition_reset', () => {
      addLog('Expedition successfully reset.', 'info');
      fetchQuizzes();
    });

    newSocket.on('round_reset', (data: any) => {
      addLog(`Stage reset: ${data?.roundName || data?.roundId}`, 'info');
      fetchQuizzes();
    });

    newSocket.on('round:updated', (round) => {
      addLog(`Voyage stage updated: ${round.status}`, 'info');
      fetchQuizzes();
    });

    newSocket.on('round:stats', (stats) => {
      if (stats?.roundId) {
        setLiveStats(prev => ({ ...prev, [stats.roundId]: stats }));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && activeQuizId) {
      socket.emit('join_competition', activeQuizId);
      socket.emit('join_admin');
    }
  }, [socket, activeQuizId]);

  const handleAction = async () => {
    if (!confirmAction) return;
    
    const token = getCookie('admin_token');
    const authHeaders: Record<string, string> = {};
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const { action, roundId } = confirmAction;
    try {
      if (action === 'quiz:reset') {
        const res = await fetch(`/api/quizzes/${activeQuizId}/reset`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not reset expedition.');
        showToast('success', 'EXPEDITION RESET', 'All scores, timers, and stages have been restored.');
        addLog('Expedition successfully reset to waiting state.', 'success');
      } else if (action === 'quiz:restart') {
        const res = await fetch(`/api/quizzes/${activeQuizId}/restart`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not restart expedition.');
        showToast('success', 'EXPEDITION RESTARTED', 'Round 1 is now underway.');
        addLog('Expedition restarted from Round 1.', 'success');
      } else if (action === 'quiz:restore_seed') {
        const res = await fetch('/api/admin/restore-seed', { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not restore database.');
        showToast('success', 'DATABASE RESTORED', 'All rounds and questions restored.');
        addLog('Pirate championship database restored.', 'success');
        if (result.competitionId) {
          setActiveQuizId(result.competitionId);
        }
      } else if (action === 'round:start') {
        const res = await fetch(`/api/quizzes/rounds/${roundId}/start`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not start stage.');
        showToast('success', 'ROUND UNDERWAY', 'The stage has been initiated.');
        addLog(`Stage ${roundId} started.`, 'success');
      } else if (action === 'round:reset') {
        const res = await fetch(`/api/quizzes/rounds/${roundId}/reset`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not reset stage.');
        showToast('success', 'STAGE RESET', 'The stage has been reset to pending.');
        addLog(`Stage ${roundId} reset.`, 'success');
      } else if (action === 'round:restart') {
        const res = await fetch(`/api/quizzes/rounds/${roundId}/restart`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not restart stage.');
        showToast('success', 'STAGE RESTARTED', 'The stage has been restarted and is now live.');
        addLog(`Stage ${roundId} restarted.`, 'success');
      } else if (action === 'round:end') {
        const res = await fetch(`/api/quizzes/rounds/${roundId}/end`, { 
          method: 'POST', 
          credentials: 'include',
          headers: authHeaders
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not end stage.');
        showToast('success', 'STAGE ENDED', 'The active stage has been closed.');
        addLog(`Stage ${roundId} ended.`, 'success');
      } else {
        if (action === 'round:pause') showToast('warning', 'ROUND PAUSED', 'The expedition is currently halted.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error occurred';
      showToast('error', 'ACTION FAILED', message);
      addLog(`Failed to execute ${action}: ${message}`, 'error');
    }
    
    setConfirmAction(null);
    setTimeout(fetchQuizzes, 600);
  };

  const requestStats = async (roundId: string) => {
    if (!roundId) return;
    try {
      const token = getCookie('admin_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/quizzes/rounds/${roundId}/stats`, {
        credentials: 'include',
        headers
      });
      if (res.ok) {
        const stats = await res.json();
        if (stats && stats.roundId) {
          setLiveStats(prev => ({ ...prev, [roundId]: stats }));
          socket?.emit('round:stats', { roundId, stats });
        }
      }
    } catch {
      socket?.emit('round:stats', { roundId });
    }
  };

  // Auto-fetch stats periodically
  useEffect(() => {
    if (!socket || !activeQuizId || quizzes.length === 0) return;
    
    const activeQuiz = quizzes.find(q => q.id === activeQuizId) || quizzes[0];
    if (!activeQuiz || !activeQuiz.rounds) return;

    // Fetch immediately on load
    activeQuiz.rounds.forEach((r: any) => requestStats(r.id));

    // Poll every 3 seconds for active rounds
    const interval = setInterval(() => {
      activeQuiz.rounds.forEach((r: any) => {
        if (r.status === 'ACTIVE' || r.status === 'PENDING') {
          requestStats(r.id);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [socket, activeQuizId, quizzes]);

  if (loading) return <div className="p-10"><EchonaLoader text="ESTABLISHING LINK..." /></div>;

  const activeQuiz = quizzes.find(q => q.id === activeQuizId) || (quizzes.length > 0 ? quizzes[0] : null);

  return (
    <div className="p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto flex flex-col space-y-4">
      <ToastComponent />
      
      {/* ── Header ── */}
      <header className="mb-3 border-b border-[#8B5E34]/30 pb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative">
        <div className="flex items-center gap-4">
          <ShipWheel className="w-12 h-12 text-[#C7A04A]" />
          <div>
            <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
              Control the active expedition
            </p>
            <h2 className="text-3xl text-[#F4E7C7] font-bold tracking-wider uppercase" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
              Live Command Deck
            </h2>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {quizzes.length > 1 && (
              <select 
                value={activeQuizId || quizzes[0]?.id || ''} 
                onChange={(e) => setActiveQuizId(e.target.value)}
                className="bg-[#17100C] border border-[#8B5E34] text-[#E7D19A] text-xs font-bold tracking-widest px-4 py-2 outline-none uppercase"
              >
                {quizzes.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            )}
            
            <div className={`px-4 py-1.5 rounded-sm shadow-inner border flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase ${
              connectionStatus === 'CONNECTED' ? 'bg-[#17100C] border-[#10B981]/30 text-[#10B981]' : 
              connectionStatus === 'RECONNECTING' ? 'bg-[#5A3E12]/20 border-[#E2C36A]/30 text-[#E2C36A]' :
              'bg-[#5A1712]/20 border-[#741714]/30 text-[#741714]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'CONNECTED' ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 
                connectionStatus === 'RECONNECTING' ? 'bg-[#E2C36A] animate-pulse' :
                'bg-[#741714]'
              }`}></span>
              LINK {connectionStatus}
            </div>
          </div>

          {/* Quick Expedition Lifecycle Actions */}
          {activeQuiz && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction({
                  action: 'quiz:restore_seed',
                  roundId: '',
                  title: 'RESTORE DATABASE SEED?',
                  message: 'This will restore all 3 standard competition rounds and seeded questions into the database.',
                  confirmText: 'RESTORE SEED'
                })}
                className="px-3 py-1.5 rounded-sm border border-[#C7A04A]/40 bg-[#17100C] text-[#C7A04A] hover:text-[#F4E7C7] hover:border-[#C7A04A] text-[10px] font-bold tracking-wider uppercase transition-colors"
              >
                ⚓ RESTORE QUESTIONS
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({
                  action: 'quiz:reset',
                  roundId: '',
                  title: 'RESET ENTIRE EXPEDITION?',
                  message: 'All participant attempts, submissions, and scores will be wiped and restored to waiting status.',
                  confirmText: 'RESET EXPEDITION',
                  isDanger: true
                })}
                className="px-3 py-1.5 rounded-sm border border-[#8B5E34] bg-[#17100C] text-[#E7D19A] hover:text-white text-[10px] font-bold tracking-wider uppercase transition-colors"
              >
                ⟳ RESET EXPEDITION
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({
                  action: 'quiz:restart',
                  roundId: '',
                  title: 'RESTART ENTIRE EXPEDITION?',
                  message: 'All scores and answers will be cleared, and Round 1 will be activated immediately.',
                  confirmText: 'RESTART EXPEDITION'
                })}
                className="px-3 py-1.5 rounded-sm border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 text-[10px] font-bold tracking-wider uppercase transition-colors"
              >
                ▶ RESTART EXPEDITION
              </button>
            </div>
          )}
        </div>
      </header>

      {!activeQuiz ? (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <EchonaEmptyState 
            title="NO ACTIVE EXPEDITION" 
            description="Launch an expedition from Debugging Configuration to begin live control, or restore the default pirate championship."
          />
          <button
            type="button"
            onClick={() => setConfirmAction({
              action: 'quiz:restore_seed',
              roundId: '',
              title: 'RESTORE DATABASE SEED?',
              message: 'This will restore all 3 standard competition rounds and seeded questions into the database.',
              confirmText: 'RESTORE SEED'
            })}
            className="px-5 py-2.5 rounded-sm border border-[#C7A04A] bg-[#17100C] text-[#C7A04A] hover:text-[#F4E7C7] hover:bg-[#C7A04A]/20 text-xs font-bold tracking-widest uppercase transition-all shadow-lg"
          >
            ⚓ RESTORE DEFAULT EXPEDITION
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1">
          
          {/* ── Left / Main Content (3 cols) ── */}
          <div className="xl:col-span-3 space-y-6 flex flex-col">
            
            {/* Active Expedition Status Banner */}
            <div className="p-[1px] bg-gradient-to-r from-[#C7A04A] via-[#8B5E34] to-[#2B1710] rounded-sm">
              <div className="bg-[#17100C] p-4 px-6 flex justify-between items-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 4px)' }} />
                
                <div className="flex items-center gap-4 relative z-10">
                  <CaptainFlag className="w-8 h-8 text-[#C7A04A]" />
                  <div>
                    <h3 className="text-[#F4E7C7] font-bold tracking-widest uppercase text-lg">{activeQuiz.name}</h3>
                    <p className="text-[#8B5E34] text-[10px] tracking-[0.2em] uppercase font-bold">{activeQuiz.description}</p>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <EchonaStatus status={activeQuiz.status} />
                </div>
              </div>
            </div>

            {/* Rounds Layout */}
            {!activeQuiz.rounds || activeQuiz.rounds.length === 0 ? (
              <EchonaEmptyState title="NO VOYAGE STAGES CHARTED" description="This expedition has no rounds to control." />
            ) : (
              <div className="grid grid-cols-1 gap-6 flex-1">
                {activeQuiz.rounds.map((round: any, idx: number) => {
                  const stats = liveStats[round.id] || { totalParticipants: 0, active: 0, submitted: 0 };
                  const isRoundActive = round.status === 'ACTIVE';
                  
                  return (
                    <div key={round.id} className="relative group flex flex-col h-full">
                      {/* Depth Border */}
                      <div className={`absolute inset-0 translate-x-1 translate-y-1 rounded-sm border ${isRoundActive ? 'border-[#C7A04A]/30 bg-[#2B1710]/50' : 'border-[#8B5E34]/20 bg-[#17100C]'}`}></div>
                      
                      <div className={`relative flex flex-col flex-1 p-[1px] rounded-sm bg-gradient-to-b ${isRoundActive ? 'from-[#C7A04A] to-[#8B5E34]' : 'from-[#5A1712] to-[#2B1710]'}`}>
                        <div className={`flex flex-col flex-1 bg-[#080706] p-6 relative overflow-hidden ${isRoundActive ? 'shadow-[inset_0_0_50px_rgba(199,160,74,0.05)]' : ''}`}>
                          
                          {/* Compass BG for active round */}
                          {isRoundActive && (
                            <CompassRose className="absolute -right-10 -bottom-10 w-64 h-64 text-[#C7A04A] opacity-5 pointer-events-none animate-[spin_60s_linear_infinite]" />
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                            
                            {/* Current Stage Info */}
                            <div className="lg:col-span-1 border-r border-[#8B5E34]/20 pr-8">
                              <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Voyage Stage {idx + 1}</p>
                              <h4 className="text-[#F4E7C7] text-2xl font-bold tracking-widest uppercase mb-4" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                                {round.name}
                              </h4>
                              
                              <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-[#8B5E34]/20">
                                  <span className="text-[#E7D19A]/60 text-xs tracking-widest uppercase">Status</span>
                                  <EchonaStatus status={round.status} />
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-[#8B5E34]/20">
                                  <span className="text-[#E7D19A]/60 text-xs tracking-widest uppercase">Timer Mode</span>
                                  <span className="text-[#C7A04A] text-xs font-bold">
                                    {round.durationSeconds ? `${Math.round(round.durationSeconds / 60)}m Total` : (round.overallTimer ? `${Math.round(round.overallTimer / 60)}m Total` : 'Untimed')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[#E7D19A]/60 text-xs tracking-widest uppercase">Questions</span>
                                  <button 
                                    onClick={() => setImportModal({ type: 'questions', targetId: round.id })}
                                    className="text-[#8B5E34] hover:text-[#C7A04A] text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 transition-colors"
                                  >
                                    <QuillMap className="w-3 h-3" /> Import
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Crew Progress (Center) */}
                            <div className="lg:col-span-1">
                              <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-4 text-center">Crew Manifest Progress</p>
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="bg-[#17100C] border border-[#8B5E34]/30 p-3 rounded-sm shadow-inner">
                                  <p className="text-[#E7D19A]/60 text-[10px] tracking-widest uppercase mb-1">Aboard</p>
                                  <p className="text-[#C7A04A] text-3xl font-pirate">{stats.totalParticipants}</p>
                                </div>
                                <div className="bg-[#17100C] border border-[#8B5E34]/30 p-3 rounded-sm shadow-inner">
                                  <p className="text-[#E7D19A]/60 text-[10px] tracking-widest uppercase mb-1">Active Now</p>
                                  <p className="text-[#10B981] text-3xl font-pirate">{stats.active}</p>
                                </div>
                                <div className="col-span-2 bg-[#17100C] border border-[#8B5E34]/30 p-3 rounded-sm shadow-inner mt-2">
                                  <div className="flex justify-between text-[10px] tracking-widest uppercase mb-2">
                                    <span className="text-[#E7D19A]/60">Submissions</span>
                                    <span className="text-[#C7A04A]">{stats.submitted} / {stats.totalParticipants}</span>
                                  </div>
                                  <div className="h-2 w-full bg-[#080706] rounded-full overflow-hidden border border-[#8B5E34]/20">
                                    <div 
                                      className="h-full bg-gradient-to-r from-[#8B5E34] to-[#C7A04A]" 
                                      style={{ width: `${stats.totalParticipants > 0 ? (stats.submitted / stats.totalParticipants) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 text-center">
                                <button 
                                  onClick={() => requestStats(round.id)}
                                  className="text-[#8B5E34] hover:text-[#C7A04A] text-[10px] font-bold tracking-widest uppercase transition-colors"
                                >
                                  ↻ REFRESH SENSORS
                                </button>
                              </div>
                            </div>

                            {/* Chronometer & Controls (Right) */}
                            <div className="lg:col-span-1 border-l border-[#8B5E34]/20 pl-8 flex flex-col items-center justify-center">
                              {/* Nautical Chronometer */}
                              <div className="mb-6 w-32 h-32 rounded-full border-4 border-[#C7A04A] bg-[#17100C] shadow-[0_0_20px_rgba(199,160,74,0.1),inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative overflow-hidden">
                                <img src="/cursors/precision-256.png" alt="Reticle" className="absolute inset-0 w-full h-full object-contain opacity-20 pointer-events-none" />
                                <div className="absolute top-2 text-[#8B5E34] text-[8px] font-bold tracking-widest uppercase relative z-10">Chronometer</div>
                                <span className={`text-3xl font-pirate relative z-10 ${isRoundActive ? 'text-[#10B981]' : 'text-[#E7D19A]'}`}>
                                  {round.status === 'ACTIVE' ? 'LIVE' : (round.status === 'ENDED' || round.status === 'COMPLETED' ? 'ENDED' : 'READY')}
                                </span>
                                <div className="absolute bottom-2 relative z-10">
                                  <Anchor className="w-4 h-4 text-[#8B5E34]/50" />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 w-full">
                                {round.status === 'PENDING' || round.status === 'READY' || round.status === 'PAUSED' ? (
                                  <EchonaButton 
                                    className="col-span-2 w-full text-[10px] px-2 py-3" 
                                    onClick={() => setConfirmAction({
                                      action: 'round:start', roundId: round.id, 
                                      title: 'START VOYAGE STAGE?', 
                                      message: 'All connected crew members will immediately enter this stage and timers will begin.',
                                      confirmText: 'START STAGE'
                                    })}
                                    disabled={round.status === 'COMPLETED'}
                                  >
                                    <ShipWheel className="w-4 h-4" /> START
                                  </EchonaButton>
                                ) : round.status === 'ACTIVE' ? (
                                  <EchonaButton 
                                    variant="secondary"
                                    className="col-span-2 w-full text-[10px] px-2 py-3" 
                                    onClick={() => setConfirmAction({
                                      action: 'round:pause', roundId: round.id, 
                                      title: 'PAUSE VOYAGE STAGE?', 
                                      message: 'Crew members will be temporarily locked out and timers halted.',
                                      confirmText: 'PAUSE STAGE'
                                    })}
                                  >
                                    <Anchor className="w-4 h-4" /> PAUSE
                                  </EchonaButton>
                                ) : null}

                                {round.status !== 'COMPLETED' && round.status !== 'ENDED' ? (
                                  <EchonaButton 
                                    variant="danger" 
                                    className="col-span-2 w-full text-[10px] px-2 py-3"
                                    disabled={round.status === 'PENDING'}
                                    onClick={() => setConfirmAction({
                                      action: 'round:end', roundId: round.id, 
                                      title: 'END VOYAGE STAGE?', 
                                      message: 'This will end the stage immediately. Unsubmitted work will not be auto-submitted.',
                                      confirmText: 'END STAGE',
                                      isDanger: true
                                    })}
                                  >
                                    <TreasureMap className="w-4 h-4" /> END STAGE
                                  </EchonaButton>
                                ) : (
                                  <EchonaButton 
                                    variant="secondary"
                                    className="col-span-2 w-full text-[10px] px-2 py-3 mt-2 border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/10"
                                    onClick={() => setScoreboardModal({ roundId: round.id, roundName: round.name })}
                                  >
                                    <TreasureMap className="w-4 h-4" /> POST-VOYAGE ANALYSIS
                                  </EchonaButton>
                                )}

                                <div className="col-span-2 flex gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({
                                      action: 'round:reset',
                                      roundId: round.id,
                                      title: `RESET STAGE: ${round.name}?`,
                                      message: 'All submissions for this stage will be erased and the stage will return to pending.',
                                      confirmText: 'RESET STAGE',
                                      isDanger: true
                                    })}
                                    className="flex-1 py-1.5 px-2 rounded-sm border border-[#C7A04A]/30 bg-[#17100C] text-[#C7A04A] hover:text-[#F4E7C7] hover:border-[#C7A04A] text-[9px] font-bold tracking-wider uppercase transition-colors"
                                  >
                                    ⟳ RESET STAGE
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({
                                      action: 'round:restart',
                                      roundId: round.id,
                                      title: `RESTART STAGE: ${round.name}?`,
                                      message: 'All previous answers will be cleared and the stage will start immediately.',
                                      confirmText: 'RESTART STAGE'
                                    })}
                                    className="flex-1 py-1.5 px-2 rounded-sm border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 hover:text-emerald-200 text-[9px] font-bold tracking-wider uppercase transition-colors"
                                  >
                                    ▶ RESTART STAGE
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right / Sidebar (Event Log) ── */}
          <div className="xl:col-span-1 flex flex-col h-full">
            <div className="bg-[#080706] border border-[#8B5E34]/30 rounded-sm flex flex-col flex-1 h-[600px] xl:h-auto overflow-hidden">
              <div className="bg-[#17100C] border-b border-[#8B5E34]/30 p-4">
                <h4 className="text-[#C7A04A] font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                  <QuillMap className="w-4 h-4" />
                  Captain's Log
                </h4>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                {eventLog.length === 0 ? (
                  <p className="text-[#8B5E34] text-center italic mt-10">Awaiting events...</p>
                ) : (
                  eventLog.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-[#8B5E34] whitespace-nowrap">[{log.time}]</span>
                      <span className={`
                        ${log.type === 'success' ? 'text-[#10B981]' : ''}
                        ${log.type === 'error' ? 'text-[#741714]' : ''}
                        ${log.type === 'warning' ? 'text-[#E2C36A]' : ''}
                        ${log.type === 'info' ? 'text-[#E7D19A]' : ''}
                      `}>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
              
              {/* Import global participants */}
              <div className="bg-[#17100C] border-t border-[#8B5E34]/30 p-4">
                <EchonaButton 
                  variant="secondary" 
                  className="w-full text-[10px]"
                  onClick={() => setImportModal({ type: 'participants', targetId: activeQuiz.id })}
                >
                  <CrewEmblem className="w-4 h-4" /> IMPORT CREW MANIFEST
                </EchonaButton>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Confirmation Modal ── */}
      <EchonaConfirmDialog 
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        cancelText="CANCEL"
        isDanger={confirmAction?.isDanger}
      />

      {/* ── Scoreboard Modal ── */}
      {scoreboardModal && (
        <ScoreboardModal
          roundId={scoreboardModal.roundId}
          roundName={scoreboardModal.roundName}
          onClose={() => setScoreboardModal(null)}
        />
      )}

      {/* ── Bulk Import Modal ── */}
      {importModal && (
        <BulkImportModal
          importType={importModal.type as 'questions' | 'participants'}
          targetId={importModal.targetId}
          onClose={() => setImportModal(null)}
          onImportComplete={() => {
            showToast('success', 'MANIFEST CHARTED', 'Import completed successfully.');
            setImportModal(null);
            fetchQuizzes();
          }}
        />
      )}
    </div>
  );
}
