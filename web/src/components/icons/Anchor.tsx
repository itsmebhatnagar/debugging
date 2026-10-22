import React from 'react';

export const Anchor = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="20" r="8" stroke={color} strokeWidth="4" fill="transparent"/>
    <path d="M50 28 L50 85" stroke={color} strokeWidth="6" strokeLinecap="round"/>
    <path d="M30 40 L70 40" stroke={color} strokeWidth="5" strokeLinecap="round"/>
    <path d="M20 65 Q 20 85 50 85 Q 80 85 80 65" stroke={color} strokeWidth="6" strokeLinecap="round" fill="transparent"/>
    <path d="M15 60 L25 60 L20 70 Z" fill={color}/>
    <path d="M75 60 L85 60 L80 70 Z" fill={color}/>
  </svg>
);
