import React from 'react';

export const CrewEmblem = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="4" strokeDasharray="10 4" fill="transparent"/>
    {/* Captain */}
    <path d="M50 35 C 58 35 60 25 60 25 C 60 25 50 20 50 20 C 50 20 40 25 40 25 C 40 25 42 35 50 35 Z" fill={color}/>
    <circle cx="50" cy="42" r="6" fill={color}/>
    <path d="M38 65 C 38 52 62 52 62 65 L 65 75 L 35 75 Z" fill={color}/>
    {/* Crew Left */}
    <path d="M30 45 C 36 45 38 38 38 38 C 38 38 30 34 30 34 C 30 34 22 38 22 38 C 22 38 24 45 30 45 Z" fill={color} opacity="0.8"/>
    <circle cx="30" cy="50" r="5" fill={color} opacity="0.8"/>
    <path d="M20 70 C 20 60 40 60 40 70 L 42 75 L 18 75 Z" fill={color} opacity="0.8"/>
    {/* Crew Right */}
    <path d="M70 45 C 76 45 78 38 78 38 C 78 38 70 34 70 34 C 70 34 62 38 62 38 C 62 38 64 45 70 45 Z" fill={color} opacity="0.8"/>
    <circle cx="70" cy="50" r="5" fill={color} opacity="0.8"/>
    <path d="M60 70 C 60 60 80 60 80 70 L 82 75 L 58 75 Z" fill={color} opacity="0.8"/>
  </svg>
);
