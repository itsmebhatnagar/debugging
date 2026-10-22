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

export default function LiveControlPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveStats, setLiveStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [importModal, setImportModal] = useState<{ type: string; targetId: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>('DISCONNECTED');
  
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; roundId: string; title: string; message: string; confirmText: string; isDanger?: boolean } | null>(null);
  const [scoreboardModal, setScoreboardModal] = useState<{ roundId: string; roundName: string } | null>(null);
  const [eventLog, setEventLog] = useState<{time: string, msg: string, type: 'info'|'success'|'warning'|'error'}[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { showToast, ToastComponent } = useEchonaToast();

  const getCookie = (name: string) => {
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

  const fetchQuizzes = () => {
    fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/quizzes`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setQuizzes(data);
        if (data.length > 0 && !activeQuizId) {
          // Select the most active quiz, or the first one
          const active = data.find((q: any) => q.status === 'ACTIVE' || q.status === 'PAUSED');
          setActiveQuizId(active ? active.id : data[0].id);
        }
        setLoading(false);
      })
      .catch(() => {
        showToast('error', 'SERVER OFFLINE', 'Could not establish contact with headquarters.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchQuizzes();

    const token = getCookie('admin_token');
    const newSocket = io(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/admin`, {
      auth: { token },
      withCredentials: true,
      reconnectionAttempts: 10
    });

    newSocket.on('connect', () => {
      setConnectionStatus('CONNECTED');
      addLog('Command link established.', 'success');
      showToast('success', 'LINK ACTIVE', 'Command deck is now connected to the real-time server.');
    });
    
    newSocket.on('disconnect', (reason) => {
      setConnectionStatus('DISCONNECTED');
      addLog(`Command link lost (${reason}). Attempting reconnection...`, 'error');
      showToast('error', 'LINK LOST', `Real-time connection severed: ${reason}`);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      addLog(`Connection error: ${err.message}`, 'error');
      if (err.message === 'Invalid token' || err.message === 'No token') {
        // Token is invalid, clear it
        localStorage.removeItem('admin_token');
      }
    });

    newSocket.on('reconnecting', () => {
      setConnectionStatus('RECONNECTING');
    });

    newSocket.on('round:updated', (round) => {
      addLog(`Voyage stage updated: ${round.status}`, 'info');
      fetchQuizzes(); // Refresh to get latest round statuses
    });

    newSocket.on('round:stats', (stats) => {
      setLiveStats(prev => ({ ...prev, [stats.roundId]: stats }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleAction = () => {
    if (!confirmAction) return;
    
    const { action, roundId } = confirmAction;
    socket?.emit(action, { roundId });
    addLog(`Command issued: ${action}`, 'warning');
    
    // Optimistic UI updates
    if (action === 'round:start') showToast('success', 'ROUND UNDERWAY', 'The stage has been initiated.');
    if (action === 'round:pause') showToast('warning', 'ROUND PAUSED', 'The expedition is currently halted.');
    if (action === 'round:end') showToast('success', 'ROUND COMPLETED', 'All responses have been recorded.');
    
    setConfirmAction(null);
    setTimeout(fetchQuizzes, 500);
  };

  const requestStats = (roundId: string) => {
    socket?.emit('round:stats', { roundId });
  };

  // Auto-fetch stats periodically
  useEffect(() => {
    if (!socket || !activeQuizId || quizzes.length === 0) return;
    
    const activeQuiz = quizzes.find(q => q.id === activeQuizId);
    if (!activeQuiz) return;

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

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
      <ToastComponent />
      
      {/* â”€â”€ Header â”€â”€ */}
      <header className="mb-8 border-b border-[#8B5E34]/30 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
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
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-4">
            {quizzes.length > 1 && (
              <select 
                value={activeQuizId || ''} 
                onChange={(e) => setActiveQuizId(e.target.value)}
                className="bg-[#17100C] border border-[#8B5E34] text-[#E7D19A] text-xs font-bold tracking-widest px-4 py-2 outline-none uppercase"
              >
                {quizzes.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            )}
          </div>
          
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
      </header>

      {!activeQuiz ? (
        <EchonaEmptyState 
          title="NO ACTIVE EXPEDITION" 
          description="Launch an expedition from Quiz Configuration to begin live control."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1">
          
          {/* â”€â”€ Left / Main Content (3 cols) â”€â”€ */}
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
            {activeQuiz.rounds?.length === 0 ? (
              <EchonaEmptyState title="NO VOYAGE STAGES CHARTED" description="This expedition has no rounds to control." />
            ) : (
              <div className="grid grid-cols-1 gap-6 flex-1">
                {activeQuiz.rounds?.map((round: any, idx: number) => {
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
                                  <span className="text-[#C7A04A] text-xs font-bold">{round.overallTimer ? `${Math.round(round.overallTimer / 60)}m Total` : 'Untimed'}</span>
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
                                  â†» REFRESH SENSORS
                                </button>
                              </div>
                            </div>

                            {/* Chronometer & Controls (Right) */}
                            <div className="lg:col-span-1 border-l border-[#8B5E34]/20 pl-8 flex flex-col items-center justify-center">
                              {/* Nautical Chronometer (Placeholder for actual live timer if we had one) */}
                              <div className="mb-6 w-32 h-32 rounded-full border-4 border-[#C7A04A] bg-[#17100C] shadow-[0_0_20px_rgba(199,160,74,0.1),inset_0_0_20px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative">
                                <div className="absolute top-2 text-[#8B5E34] text-[8px] font-bold tracking-widest uppercase">Chronometer</div>
                                <span className={`text-3xl font-pirate ${isRoundActive ? 'text-[#10B981]' : 'text-[#E7D19A]'}`}>
                                  {round.overallTimer ? 'LIVE' : 'READY'}
                                </span>
                                <div className="absolute bottom-2">
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

                                {round.status !== 'COMPLETED' ? (
                                  <EchonaButton 
                                    variant="danger" 
                                    className="col-span-2 w-full text-[10px] px-2 py-3"
                                    disabled={round.status === 'PENDING'}
                                    onClick={() => setConfirmAction({
                                      action: 'round:end', roundId: round.id, 
                                      title: 'END VOYAGE STAGE?', 
                                      message: 'Force ending this stage will auto-submit all unsubmitted crew answers immediately.',
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

          {/* â”€â”€ Right / Sidebar (Event Log) â”€â”€ */}
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

      {/* â”€â”€ Confirmation Modal â”€â”€ */}
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

      {/* â”€â”€ Scoreboard Modal â”€â”€ */}
      {scoreboardModal && (
        <ScoreboardModal
          roundId={scoreboardModal.roundId}
          roundName={scoreboardModal.roundName}
          onClose={() => setScoreboardModal(null)}
        />
      )}

      {/* â”€â”€ Bulk Import Modal â”€â”€ */}
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
};
