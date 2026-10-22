"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { CrewEmblem } from '@/components/icons/CrewEmblem';
import { CompassRose } from '@/components/icons/CompassRose';
import { ShipWheel } from '@/components/icons/ShipWheel';
import { CaptainFlag } from '@/components/icons/CaptainFlag';
import { QuillMap } from '@/components/icons/QuillMap';
import { NavigationChart } from '@/components/icons/NavigationChart';
import { Rivet } from '@/components/icons/Rivet';
import { Anchor } from '@/components/icons/Anchor';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const navigate = (path: string) => router.push(path);

  useEffect(() => {
    fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || 'http://localhost:3001'}/api/admin/dashboard`, {
      credentials: 'include' // Ensure cookies are sent
    })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(data => {
      setData(data);
      setLoading(false);
    })
    .catch(() => navigate('/admin'));
  }, [navigate]);

  if (loading || !data) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <CompassRose className="w-12 h-12 text-[#C7A04A] animate-[spin_3s_linear_infinite]" />
          <p className="text-[#C7A04A] font-pirate tracking-[0.2em] animate-pulse">Navigating...</p>
        </div>
      </div>
    );
  }

  // Use available stats or fallback to "—"
  const stats = [
    { label: 'TOTAL QUIZZES', value: data.stats?.totalQuizzes ?? '—', icon: <TreasureMap className="w-10 h-10 text-[#C7A04A]" /> },
    { label: 'TOTAL CREW', value: data.stats?.totalParticipants ?? '—', icon: <CrewEmblem className="w-10 h-10 text-[#C7A04A]" /> },
    { label: 'TOTAL ROUNDS', value: data.stats?.totalRounds ?? '—', icon: <CompassRose className="w-10 h-10 text-[#C7A04A]" /> },
    { label: 'ACTIVE QUIZ', value: data.stats?.activeQuiz ? '1' : '—', icon: <ShipWheel className="w-10 h-10 text-[#C7A04A]" /> }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      
      {/* ── Main Header ── */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-transparent pb-6 relative">
        {/* Decorative Divider */}
        <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C7A04A]/50 to-transparent" />
        <div className="absolute bottom-[-9px] left-1/2 -translate-x-1/2 flex items-center justify-center opacity-80">
           <CompassRose className="w-4 h-4 text-[#C7A04A]" />
        </div>
        
        <div className="flex items-center gap-4">
          <ShipWheel className="w-10 h-10 text-[#C7A04A] hidden md:block opacity-80" />
          <div>
            <h2 className="text-3xl md:text-4xl text-[#F4E7C7] mb-1 tracking-wider" style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              COMMAND CENTER
            </h2>
            <p className="text-[#E7D19A]/80 text-xs tracking-[0.2em] uppercase font-bold">
              Manage your ECHONA expedition
            </p>
          </div>
        </div>
        
      </header>

      {/* ── Welcome Section ── */}
      <div className="mb-10 flex items-start gap-4">
        <CaptainFlag className="w-10 h-10 mt-1 drop-shadow-lg" />
        <div>
          <h3 className="text-[#E2C36A] text-lg font-bold tracking-[0.15em] mb-2 uppercase" style={{ fontFamily: '"Cinzel", serif' }}>
            Welcome Back, Captain
          </h3>
          <p className="text-[#E7D19A]/90 text-sm font-light tracking-wide max-w-2xl leading-relaxed">
            Your expedition is ready. Here's the current state of ECHONA 2026.
          </p>
        </div>
      </div>

      {/* ── Statistics Grid (Captain's Ledger Plaques) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="group p-1 relative transition-all duration-300 hover:-translate-y-1 rounded-sm"
            style={{
              background: 'linear-gradient(to bottom, #C7A04A, #8B5E34)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.6)'
            }}
          >
            <div className="h-full bg-[#17100C] relative overflow-hidden p-6 flex flex-col items-center text-center">
              {/* Wood texture */}
              <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 2px)' }} />
              <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.8) 100%)' }} />
              
              {/* Corner Rivets */}
              <Rivet className="absolute top-2 left-2 w-2 h-2" />
              <Rivet className="absolute top-2 right-2 w-2 h-2" />
              <Rivet className="absolute bottom-2 left-2 w-2 h-2" />
              <Rivet className="absolute bottom-2 right-2 w-2 h-2" />

              <div className="relative z-10 mb-4 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {stat.icon}
              </div>
              <h3 className="relative z-10 text-[#C7A04A] text-[10px] font-black uppercase tracking-[0.25em] mb-3 border-b border-[#C7A04A]/30 pb-2 w-full">
                {stat.label}
              </h3>
              <p className="relative z-10 text-4xl text-[#F4E7C7]" style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', textShadow: '0 4px 8px rgba(0,0,0,1)' }}>
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Current Expedition Chart ── */}
        <div className="lg:col-span-2">
          <div className="relative p-1 rounded-sm" style={{ background: 'linear-gradient(to bottom, #C7A04A, #5A1712)', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}>
            <div className="h-full bg-[#E7D19A] relative overflow-hidden flex flex-col min-h-[300px]">
              
              {/* Map Textures */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/login-bg.png")', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'sepia(1) saturate(2)' }} />
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />
              
              {/* Faint Compass Rose on Map */}
              <CompassRose className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-[#8B5E34] opacity-10 pointer-events-none" />

              <div className="bg-[#17100C]/90 px-6 py-4 border-b border-[#C7A04A] flex justify-between items-center relative z-10">
                <h3 className="text-[#C7A04A] text-xs font-bold uppercase tracking-[0.25em] flex items-center gap-2">
                  <NavigationChart className="w-4 h-4" /> Current Expedition
                </h3>
                {data.stats?.activeQuiz ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-black" />
                    <span className="text-emerald-500 text-[10px] uppercase tracking-widest font-black">Live</span>
                  </div>
                ) : null}
              </div>
              
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center relative z-10">
                {data.stats?.activeQuiz ? (
                  <div className="w-full max-w-lg bg-[#080706]/80 p-8 border border-[#8B5E34]/50 rounded-sm backdrop-blur-sm shadow-xl">
                    <h4 className="text-3xl text-[#F4E7C7] mb-2" style={{ fontFamily: '"Cinzel Decorative", serif', textShadow: '0 2px 4px rgba(0,0,0,1)' }}>
                      {data.stats.activeQuiz.name || 'General Knowledge'}
                    </h4>
                    <p className="text-[#C7A04A] text-sm font-bold tracking-[0.25em] uppercase mb-8 border-b border-[#C7A04A]/20 pb-4 inline-block">
                      Round 2 / 3
                    </p>
                    
                    {/* Treasure Route Progress */}
                    <div className="relative w-full max-w-md mx-auto mb-6">
                      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#8B5E34]/30 -translate-y-1/2 border-t border-dashed border-[#8B5E34]" />
                      <div className="absolute top-1/2 left-0 h-[2px] bg-[#C7A04A] -translate-y-1/2 w-[60%] shadow-[0_0_8px_#C7A04A]" />
                      <div className="flex justify-between relative z-10">
                        <div className="w-4 h-4 rounded-full bg-[#C7A04A] border-2 border-[#17100C]" />
                        <div className="w-4 h-4 bg-[#C7A04A] border-2 border-[#17100C] transform rotate-45 absolute left-[60%] -translate-x-1/2" />
                        <div className="text-xl font-pirate text-[#8B5E34] absolute right-0 -top-3">X</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-[#E7D19A] text-xs font-bold tracking-widest uppercase">
                      <CrewEmblem className="w-4 h-4 text-[#C7A04A]" />
                      84 Crew Active
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#080706]/80 p-8 border border-[#8B5E34]/50 rounded-sm backdrop-blur-sm shadow-xl max-w-sm">
                    <Anchor className="w-12 h-12 text-[#741714] mx-auto mb-4 opacity-80" />
                    <p className="text-[#C7A04A] text-sm font-black tracking-[0.2em] mb-2">NO ACTIVE EXPEDITION</p>
                    <p className="text-[#E7D19A]/80 text-xs font-bold tracking-wider">Unfurl a new map to begin your next voyage.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h3 className="text-[#C7A04A] text-xs font-black uppercase tracking-[0.25em] mb-4 pl-2 border-l-2 border-[#741714]">
            Command Controls
          </h3>
          <div className="flex flex-col gap-4">
            {/* Create Quiz Control */}
            <Link 
              href="/admin/quizzes"
              className="group relative block p-[1px] rounded-sm transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(to bottom, #C7A04A, #741714)', boxShadow: '0 6px 12px rgba(0,0,0,0.5)' }}
            >
              <div className="relative overflow-hidden bg-[#17100C] p-5 flex items-center justify-between">
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.6) 2px, rgba(0,0,0,0.6) 4px)' }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#5A1712]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5" />

                <span className="text-[#F4E7C7] text-sm font-bold tracking-[0.2em] uppercase relative z-10 drop-shadow-md">Create Quiz</span>
                <QuillMap className="w-8 h-8 text-[#C7A04A] group-hover:text-[#F4E7C7] transition-colors relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]" />
              </div>
            </Link>

            {/* Live Control Control */}
            <Link 
              href="/admin/live"
              className="group relative block p-[1px] rounded-sm transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(to bottom, #8B5E34, #2B1710)', boxShadow: '0 6px 12px rgba(0,0,0,0.5)' }}
            >
              <div className="relative overflow-hidden bg-[#0a0504] p-5 flex items-center justify-between">
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.6) 2px, rgba(0,0,0,0.6) 4px)' }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#2B1710]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <Rivet className="absolute top-1.5 left-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute top-1.5 right-1.5 w-1.5 h-1.5" />
                <Rivet className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5" />

                <span className="text-[#E7D19A] text-sm font-bold tracking-[0.2em] uppercase relative z-10 group-hover:text-[#F4E7C7] drop-shadow-md">Live Control</span>
                <ShipWheel className="w-8 h-8 text-[#8B5E34] group-hover:text-[#C7A04A] transition-colors relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]" />
              </div>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
