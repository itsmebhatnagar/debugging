import React from 'react';

export const TreasureMap = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 20 Q 30 10 50 20 T 85 15 L 85 80 Q 70 90 50 80 T 15 85 Z" stroke={color} strokeWidth="4" fill="rgba(216,185,130,0.1)"/>
    <path d="M50 20 L 50 80" stroke={color} strokeWidth="2" strokeDasharray="4 4" opacity="0.5"/>
    <path d="M30 40 L 40 45 L 35 55 L 60 70" stroke={color} strokeWidth="2" strokeDasharray="4 4"/>
    <path d="M55 65 L 65 75 M 65 65 L 55 75" stroke={color} strokeWidth="4" strokeLinecap="round"/>
    <path d="M8 25 Q 12 25 15 20 M 8 80 Q 12 85 15 85 M 92 10 Q 88 15 85 15 M 92 75 Q 88 75 85 80" stroke={color} strokeWidth="3"/>
  </svg>
);
