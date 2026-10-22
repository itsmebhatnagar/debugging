"use client";

import React, { useState, useEffect } from 'react';
import { CompassRose } from '../icons/CompassRose';
import { TreasureMap } from '../icons/TreasureMap';
import { Rivet } from '../icons/Rivet';

// --- BUTTONS ---
export const EchonaButton = ({ children, variant = 'primary', className = '', ...props }: any) => {
  let baseStyle = "group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-sm uppercase tracking-widest text-xs font-bold transition-all hover:-translate-y-[1px]";
  let colorStyle = "";

  if (variant === 'primary') {
    colorStyle = "text-[#F4E7C7]";
    return (
      <button className={`${baseStyle} ${colorStyle} ${className}`} style={{ background: 'linear-gradient(to bottom, #741714, #2B1710)', border: '1px solid rgba(199, 160, 74, 0.4)', boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }} {...props}>
        <div className="absolute inset-0 bg-[#C7A04A]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10">{children}</span>
      </button>
    );
  } else if (variant === 'secondary') {
    colorStyle = "text-[#E7D19A]";
    return (
      <button className={`${baseStyle} ${colorStyle} ${className}`} style={{ background: 'linear-gradient(to bottom, #2B1710, #17100C)', border: '1px solid rgba(199, 160, 74, 0.3)', boxShadow: '0 4px 8px rgba(0,0,0,0.5)' }} {...props}>
        <div className="absolute inset-0 bg-[#C7A04A]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10">{children}</span>
      </button>
    );
  } else if (variant === 'danger') {
    colorStyle = "text-[#F4E7C7]";
    return (
      <button className={`${baseStyle} ${colorStyle} ${className}`} style={{ background: 'linear-gradient(to bottom, #5A1712, #2B0A08)', border: '1px solid rgba(116, 23, 20, 0.5)', boxShadow: '0 4px 8px rgba(0,0,0,0.5)' }} {...props}>
        <div className="absolute inset-0 bg-[#741714]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10">{children}</span>
      </button>
    );
  } else if (variant === 'ghost') {
    colorStyle = "text-[#C7A04A] hover:text-[#F4E7C7]";
    return (
      <button className={`${baseStyle} ${colorStyle} ${className} bg-transparent border border-transparent hover:border-[#C7A04A]/20`} {...props}>
        {children}
      </button>
    );
  }
  return null;
};

// --- INPUTS ---
export const EchonaInput = ({ label, error, className = '', ...props }: any) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <label className="text-[#C7A04A] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 pl-1">{label}</label>}
      <div className="relative">
        <input 
          className="w-full bg-[#17100C] border border-[#8B5E34] rounded-sm px-4 py-2.5 text-[#F4E7C7] text-sm focus:outline-none focus:border-[#C7A04A] focus:shadow-[0_0_10px_rgba(199,160,74,0.2)] transition-all placeholder:text-[#E7D19A]/30 shadow-inner"
          {...props}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none rounded-sm" />
      </div>
      {error && (
        <div className="flex items-center gap-1 mt-2 text-[#741714] text-xs font-bold tracking-wider">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}
    </div>
  );
};

// --- MODAL ---
export const EchonaModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#E7D19A] rounded-sm p-1 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(to bottom, #2B1710, #17100C)', border: '1px solid #C7A04A' }}>
        <Rivet className="absolute top-1 left-1 w-2 h-2" />
        <Rivet className="absolute top-1 right-1 w-2 h-2" />
        <Rivet className="absolute bottom-1 left-1 w-2 h-2" />
        <Rivet className="absolute bottom-1 right-1 w-2 h-2" />
        
        <div className="bg-[#E7D19A] p-6 relative overflow-hidden" style={{ minHeight: '200px' }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/login-bg.png")', backgroundSize: 'cover', mixBlendMode: 'multiply' }} />
          <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-3 mb-6 border-b border-[#8B5E34]/30 pb-4">
            <CompassRose className="w-6 h-6 text-[#8B5E34]" />
            <div>
              <p className="text-[#8B5E34] text-[10px] uppercase tracking-[0.2em] font-bold">Captain's Log</p>
              <h2 className="text-2xl text-[#2B1710]" style={{ fontFamily: '"Cinzel Decorative", serif' }}>{title}</h2>
            </div>
          </div>
          
          <div className="relative z-10 text-[#2B1710]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CONFIRM DIALOG ---
export const EchonaConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }: any) => {
  return (
    <EchonaModal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-[#2B1710] font-semibold text-sm tracking-wide mb-8">{message}</p>
      <div className="flex justify-end gap-4 mt-6">
        <EchonaButton variant="ghost" onClick={onClose} className="!text-[#8B5E34] hover:!text-[#2B1710]">{cancelText}</EchonaButton>
        <EchonaButton variant={isDanger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</EchonaButton>
      </div>
    </EchonaModal>
  );
};

// --- STATUS ---
export const EchonaStatus = ({ status }: { status: string }) => {
  let color = "#C7A04A"; // Draft
  let text = "DRAFT";
  let icon = "◉";

  if (status === 'ACTIVE' || status === 'LIVE') {
    color = "#10B981"; // Live
    text = "LIVE";
  } else if (status === 'READY') {
    color = "#F4E7C7";
    text = "READY";
    icon = "⚓";
  } else if (status === 'COMPLETED') {
    color = "#8B5E34";
    text = "COMPLETED";
    icon = "✓";
  } else if (status === 'ELIMINATED') {
    color = "#741714";
    text = "ELIMINATED";
    icon = "✕";
  }

  return (
    <div className="flex items-center gap-1.5 font-bold tracking-[0.2em] text-[10px]" style={{ color }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

// --- LOADER ---
export const EchonaLoader = ({ text = "CHARTING..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <CompassRose className="w-10 h-10 text-[#C7A04A] animate-[spin_3s_linear_infinite]" />
    <p className="text-[#C7A04A] text-xs font-bold tracking-[0.3em] uppercase mt-4 animate-pulse">{text}</p>
  </div>
);

// --- EMPTY STATE ---
export const EchonaEmptyState = ({ title, description }: any) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border border-[#8B5E34]/20 rounded-sm bg-[#17100C]/50 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#2B1710]/20 to-transparent pointer-events-none" />
    <TreasureMap className="w-16 h-16 text-[#8B5E34] mb-4 opacity-50 relative z-10" />
    <h3 className="text-[#C7A04A] text-lg font-bold tracking-[0.15em] mb-2 uppercase relative z-10">{title}</h3>
    <p className="text-[#E7D19A]/60 text-sm tracking-wider max-w-md relative z-10">{description}</p>
  </div>
);

// --- TOAST SYSTEM ---
export const EchonaToast = ({ type, title, message, onClose }: any) => {
  let colors = {
    bg: 'from-[#2B1710] to-[#17100C]',
    border: 'border-[#C7A04A]/50',
    icon: 'text-[#C7A04A]'
  };
  let icon = <CompassRose className="w-6 h-6" />;
  
  if (type === 'success') {
    colors = { bg: 'from-[#172B10] to-[#0A170C]', border: 'border-[#10B981]/50', icon: 'text-[#10B981]' };
  } else if (type === 'error') {
    colors = { bg: 'from-[#5A1712] to-[#2B0A08]', border: 'border-[#741714]/50', icon: 'text-[#C7A04A]' };
  } else if (type === 'warning') {
    colors = { bg: 'from-[#5A3E12] to-[#2B1D08]', border: 'border-[#E2C36A]/50', icon: 'text-[#E2C36A]' };
  }
  
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-8 duration-300">
      <div className={`p-[1px] rounded-sm bg-gradient-to-b ${colors.bg} shadow-2xl`}>
        <div className={`bg-[#080706] p-4 pr-12 rounded-sm border ${colors.border} relative flex gap-4 items-start min-w-[300px]`}>
          <div className={`mt-1 ${colors.icon}`}>{icon}</div>
          <div>
            <h4 className={`text-xs font-bold tracking-[0.2em] uppercase mb-1 ${colors.icon}`}>{title}</h4>
            <p className="text-[#E7D19A]/80 text-sm">{message}</p>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-[#C7A04A]/50 hover:text-[#C7A04A]">✕</button>
        </div>
      </div>
    </div>
  );
};

// Toast Manager (Simple implementation for direct use)
export const useEchonaToast = () => {
  const [toast, setToast] = useState<any>(null);
  
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 5000);
  };
  
  const ToastComponent = () => toast ? <EchonaToast {...toast} onClose={() => setToast(null)} /> : null;
  
  return { showToast, ToastComponent };
};

// --- TABS ---
export const EchonaTabs = ({ tabs, activeTab, onTabChange }: any) => (
  <div className="flex border-b border-[#8B5E34]/30">
    {tabs.map((tab: any) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-8 py-3 uppercase tracking-[0.2em] text-xs font-bold transition-all relative ${
            isActive ? 'text-[#F4E7C7]' : 'text-[#E7D19A]/50 hover:text-[#E7D19A]'
          }`}
          style={{
            background: isActive ? 'linear-gradient(to bottom, transparent, rgba(116, 23, 20, 0.4))' : 'transparent',
          }}
        >
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C7A04A] to-transparent shadow-[0_0_8px_#C7A04A]" />
          )}
          <span className="flex items-center gap-2">
            {tab.icon && <span className={isActive ? 'text-[#C7A04A]' : 'opacity-50'}>{tab.icon}</span>}
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);
