import React from 'react';

export const CaptainFlag = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 10 L20 90" stroke="#C7A04A" strokeWidth="4" strokeLinecap="round"/>
    <path d="M22 15 L80 35 L22 55" fill="#741714" stroke="#5A1712" strokeWidth="2"/>
    <circle cx="20" cy="10" r="4" fill="#C7A04A"/>
  </svg>
);
