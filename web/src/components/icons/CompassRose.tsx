import React from 'react';

export const CompassRose = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="4" fill="transparent"/>
    <circle cx="50" cy="50" r="35" stroke={color} strokeWidth="1" strokeDasharray="4 4" fill="transparent"/>
    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill={color} opacity="0.8"/>
    <path d="M50 5 L50 95" stroke="#17100C" strokeWidth="2"/>
    <path d="M5 50 L95 50" stroke="#17100C" strokeWidth="2"/>
    <circle cx="50" cy="50" r="8" fill="#17100C" stroke={color} strokeWidth="2"/>
  </svg>
);
