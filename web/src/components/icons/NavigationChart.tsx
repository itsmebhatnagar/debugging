import React from 'react';

export const NavigationChart = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="15" width="80" height="70" stroke={color} strokeWidth="4" fill="transparent" rx="4"/>
    <circle cx="30" cy="35" r="15" stroke={color} strokeWidth="2" strokeDasharray="4 2" fill="transparent"/>
    <circle cx="30" cy="35" r="4" fill={color}/>
    <path d="M30 35 L 70 65" stroke={color} strokeWidth="3" strokeDasharray="6 4"/>
    <path d="M65 60 L 75 70 M 75 60 L 65 70" stroke={color} strokeWidth="4" strokeLinecap="round"/>
    <path d="M10 60 Q 30 50 50 70 T 90 50" stroke={color} strokeWidth="2" opacity="0.6"/>
  </svg>
);
