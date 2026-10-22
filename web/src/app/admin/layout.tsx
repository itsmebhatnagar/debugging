"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CompassRose } from '@/components/icons/CompassRose';
import { TreasureMap } from '@/components/icons/TreasureMap';
import { ShipWheel } from '@/components/icons/ShipWheel';
import { Rivet } from '@/components/icons/Rivet';
import { CrewEmblem } from '@/components/icons/CrewEmblem';
import { Anchor } from '@/components/icons/Anchor';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // If on admin login page, don't show the admin shell layout
  if (pathname === '/admin/login' || pathname === '/admin/auth') {
    return <>{children}</>;
  }

  const handleDisembark = () => {
    router.push('/admin/dashboard');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: <CompassRose className="w-5 h-5 shrink-0" /> },
    { path: '/admin/participants', label: 'Participants', icon: <CrewEmblem className="w-5 h-5 shrink-0" /> },
    { path: '/admin/competitions', label: 'Competitions', icon: <TreasureMap className="w-5 h-5 shrink-0" /> },
    { path: '/admin/quizzes', label: 'Debugging Config', icon: <TreasureMap className="w-5 h-5 shrink-0" /> },
    { path: '/admin/live', label: 'Live Control', icon: <ShipWheel className="w-5 h-5 shrink-0" /> },
  ];

  return (
    <div className="min-h-screen flex font-sans" style={{ backgroundColor: '#080706' }}>
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 z-40 flex items-center justify-between px-4 border-b border-[#C7A04A]/30" style={{ background: '#17100C' }}>
        <h1 className="text-xl font-bold" style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#E2C36A' }}>ECHONA</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[#E7D19A] p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar - Captain's Navigation Panel */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen w-72 z-50 flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(to bottom, #1E0B09, #0D0504), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
          borderRight: '2px solid #C7A04A',
          boxShadow: 'inset -4px 0 15px rgba(0,0,0,0.9), 4px 0 20px rgba(0,0,0,0.8)'
        }}
      >
        <div className="p-8 pb-6 border-b border-[#C7A04A]/20 flex flex-col items-center relative">
          <Rivet className="absolute bottom-[-4px] left-[-4px] w-2 h-2 opacity-80" />
          <Rivet className="absolute bottom-[-4px] right-[-4px] w-2 h-2 opacity-80" />
          
          <h1 className="text-4xl text-center font-black tracking-widest mb-1" style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#F4E7C7', textShadow: '0 4px 6px rgba(0,0,0,0.9)' }}>
            ECHONA
          </h1>
          <div className="flex items-center w-full justify-center gap-2 mb-2 opacity-70">
            <span className="w-8 h-[1px] bg-[#C7A04A]"></span>
            <CompassRose className="w-3 h-3 text-[#C7A04A]" />
            <span className="w-8 h-[1px] bg-[#C7A04A]"></span>
          </div>
          <h2 className="text-xs tracking-[0.25em] font-bold text-center" style={{ color: '#E7D19A' }}>
            COMMAND CENTER
          </h2>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-4 relative">
          {/* Subtle rope divider */}
          <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-[#C7A04A]/10 border-l border-black/50" />

          {navItems.map((item) => {
            const isActive = pathname === item.path || (pathname?.startsWith(item.path) && item.path !== '/admin/dashboard');
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative flex items-center px-4 py-3.5 rounded-sm uppercase tracking-widest text-xs font-bold transition-all duration-300 group overflow-hidden ${
                  isActive ? 'text-[#F4E7C7] translate-x-2' : 'text-[#E7D19A]/60 hover:text-[#E2C36A] hover:translate-x-1'
                }`}
                style={{
                  background: isActive ? 'linear-gradient(90deg, #741714, #2B1710)' : 'transparent',
                  boxShadow: isActive ? 'inset 2px 2px 8px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)' : 'none',
                  border: isActive ? '1px solid rgba(199, 160, 74, 0.2)' : '1px solid transparent',
                  borderLeft: isActive ? 'none' : '1px solid transparent'
                }}
              >
                {/* Active left brass edge */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: 'linear-gradient(to bottom, #E2C36A, #C7A04A)', boxShadow: '1px 0 5px rgba(226, 195, 106, 0.5)' }} />
                )}
                {isActive && <Rivet className="absolute top-1 right-1 w-1.5 h-1.5 opacity-60" />}
                {isActive && <Rivet className="absolute bottom-1 right-1 w-1.5 h-1.5 opacity-60" />}
                
                {/* Hover bg */}
                {!isActive && (
                  <div className="absolute inset-0 bg-[#5A1712]/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
                )}

                <div className="flex items-center gap-4 relative z-10 w-full">
                  <span className={`${isActive ? 'text-[#E2C36A]' : ''} transition-colors group-hover:text-[#E2C36A]`}>
                    {item.icon}
                  </span>
                  <span style={{ paddingTop: '2px', letterSpacing: '0.15em' }}>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        
        {/* Captain Profile Area */}
        <div className="p-4 border-t border-[#C7A04A]/20 bg-[#0a0403]/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full border border-[#C7A04A]/50 bg-[#17100C] flex items-center justify-center shadow-inner">
              <CrewEmblem className="w-6 h-6 text-[#E2C36A]" />
            </div>
            <div>
              <p className="text-[#C7A04A] text-[10px] font-bold tracking-[0.2em] uppercase">Captain</p>
              <p className="text-[#F4E7C7] text-sm font-semibold tracking-wider">Admin</p>
            </div>
          </div>

          <button
            onClick={handleDisembark}
            className="w-full group relative flex items-center justify-center gap-3 px-4 py-3 rounded-sm uppercase tracking-widest text-xs font-bold transition-all hover:-translate-y-[1px]"
            style={{
              background: 'linear-gradient(to bottom, #2B1710, #17100C)',
              border: '1px solid rgba(199, 160, 74, 0.3)',
              color: '#E7D19A',
              boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}
          >
            <div className="absolute inset-0 bg-[#741714]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Anchor className="w-4 h-4 text-[#C7A04A] group-hover:text-[#F4E7C7] transition-colors relative z-10" />
            <span className="relative z-10 group-hover:text-[#F4E7C7] transition-colors">Disembark</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto md:pt-0 pt-16 relative bg-[#080706]">
        {/* Subtle radial parchment/map texture overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'url("/login-bg.png")', backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'overlay' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% -20%, rgba(43, 23, 16, 0.6) 0%, rgba(8, 7, 6, 1) 80%)' }} />
        
        <div className="relative z-10 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
