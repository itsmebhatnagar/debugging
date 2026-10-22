import React from 'react';

export const QuillMap = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 30 Q 40 20 60 30 T 90 20 L 90 80 Q 70 90 50 80 T 20 90 Z" stroke={color} strokeWidth="3" fill="transparent"/>
    <path d="M30 80 C 10 70 5 40 40 20" stroke={color} strokeWidth="4" strokeLinecap="round"/>
    <path d="M35 35 L 45 45 M 25 45 L 35 55" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <circle cx="40" cy="20" r="3" fill={color}/>
  </svg>
);
