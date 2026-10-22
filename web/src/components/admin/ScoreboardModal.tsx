"use client";

import React, { useState, useEffect } from 'react';
import { EchonaButton, EchonaLoader, useEchonaToast } from '../ui/EchonaUI';
import { TreasureMap } from '../icons/TreasureMap';
import { Rivet } from '../icons/Rivet';

interface ScoreboardModalProps {
  roundId: string;
  roundName: string;
  onClose: () => void;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({ roundId, roundName, onClose }) => {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topN, setTopN] = useState<string>('');
  const [evaluating, setEvaluating] = useState(false);
  const { showToast, ToastComponent } = useEchonaToast();

  const getCookie = (name: string) => {
    const local = localStorage.getItem(name);
    if (local) return local;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  const fetchScores = () => {
    const token = getCookie('admin_token') || '';
    fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/quizzes/rounds/${roundId}/scoreboard`, {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch scores');
        return res.json();
      })
      .then(data => {
        setScores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setScores([]);
        setLoading(false);
        showToast('error', 'DATA LINK FAILED', 'Could not retrieve scoreboard data.');
      });
  };

  useEffect(() => {
    fetchScores();
  }, [roundId]);

  const handleEvaluate = async () => {
    if (!topN || isNaN(Number(topN))) {
      showToast('error', 'INVALID INPUT', 'Please enter a valid number of crew to qualify.');
      return;
    }

    if (!confirm(`Are you sure you want to qualify the top ${topN} crew members and eliminate the rest?`)) return;

    setEvaluating(true);
    const token = getCookie('admin_token') || '';
    try {
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/quizzes/rounds/${roundId}/evaluate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ topN: Number(topN) })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'EVALUATION COMPLETE', `Qualified: ${data.qualified}, Eliminated: ${data.eliminated}`);
        fetchScores();
      } else {
        showToast('error', 'EVALUATION FAILED', data.error || 'Failed to evaluate crew.');
      }
    } catch (err) {
      showToast('error', 'SERVER ERROR', 'Failed to contact headquarters.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
      <ToastComponent />
      <div 
        className="w-full max-w-4xl max-h-[90vh] flex flex-col relative rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        style={{
          background: 'linear-gradient(to bottom, #2B1710, #17100C)',
          border: '1px solid #C7A04A'
        }}
      >
        <Rivet className="absolute top-2 left-2 w-2 h-2" />
        <Rivet className="absolute top-2 right-2 w-2 h-2" />
        <Rivet className="absolute bottom-2 left-2 w-2 h-2" />
        <Rivet className="absolute bottom-2 right-2 w-2 h-2" />

        <div className="p-6 border-b border-[#C7A04A]/30 flex justify-between items-center bg-[#080706]">
          <div className="flex items-center gap-3">
            <TreasureMap className="w-8 h-8 text-[#C7A04A]" />
            <div>
              <p className="text-[#C7A04A] text-[10px] font-bold tracking-[0.2em] uppercase">Post-Voyage Analysis</p>
              <h2 className="text-[#F4E7C7] text-xl font-bold tracking-widest uppercase" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                {roundName} - Scoreboard
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-[#C7A04A] hover:text-[#F4E7C7] text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-6 relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/login-bg.png")', backgroundSize: 'cover' }} />
          
          {loading ? (
            <EchonaLoader text="GATHERING LOGS..." />
          ) : scores.length === 0 ? (
            <div className="text-center text-[#E7D19A]/60 py-10 tracking-widest uppercase text-sm font-bold">
              No submissions found for this stage.
            </div>
          ) : (
            <table className="w-full text-left relative z-10 border-collapse">
              <thead>
                <tr className="border-b-2 border-[#C7A04A]/30">
                  <th className="py-3 text-[#C7A04A] text-xs font-bold tracking-[0.2em] uppercase">Rank</th>
                  <th className="py-3 text-[#C7A04A] text-xs font-bold tracking-[0.2em] uppercase">Crew Name</th>
                  <th className="py-3 text-[#C7A04A] text-xs font-bold tracking-[0.2em] uppercase">College</th>
                  <th className="py-3 text-[#C7A04A] text-xs font-bold tracking-[0.2em] uppercase">Score</th>
                  <th className="py-3 text-[#C7A04A] text-xs font-bold tracking-[0.2em] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => (
                  <tr key={score.id} className="border-b border-[#C7A04A]/10 hover:bg-[#5A1712]/10 transition-colors">
                    <td className="py-3 text-[#E7D19A] text-lg font-pirate">#{index + 1}</td>
                    <td className="py-3 text-[#F4E7C7] font-bold tracking-wider">{score.participant?.name || score.participant?.username}</td>
                    <td className="py-3 text-[#E7D19A]/60 text-xs uppercase tracking-wider">{score.participant?.college || 'Unknown'}</td>
                    <td className="py-3 text-[#C7A04A] text-lg font-pirate">{score.totalScore}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-widest border rounded-sm ${
                        score.qualificationStatus === 'QUALIFIED' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' :
                        score.qualificationStatus === 'ELIMINATED' ? 'bg-[#741714]/20 text-[#EF4444] border-[#EF4444]/30' :
                        'bg-[#8B5E34]/20 text-[#E7D19A] border-[#8B5E34]/30'
                      }`}>
                        {score.qualificationStatus || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-6 border-t border-[#C7A04A]/30 bg-[#080706] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1">
            <label className="text-[#C7A04A] text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">
              Qualify Top N Crew:
            </label>
            <input 
              type="number" 
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              placeholder="e.g. 10"
              className="bg-[#17100C] border border-[#8B5E34] text-[#F4E7C7] px-3 py-2 w-24 outline-none focus:border-[#C7A04A] font-bold"
            />
            <p className="text-[#E7D19A]/60 text-[10px] tracking-wider hidden md:block">
              All other crew members will be eliminated.
            </p>
          </div>
          <EchonaButton 
            onClick={handleEvaluate} 
            disabled={evaluating || scores.length === 0}
            className="text-xs px-6 py-3"
          >
            {evaluating ? 'Evaluating...' : 'EVALUATE & QUALIFY'}
          </EchonaButton>
        </div>
      </div>
    </div>
  );
};
