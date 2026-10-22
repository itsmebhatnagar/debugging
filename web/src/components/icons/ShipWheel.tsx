import React from 'react';

export const ShipWheel = ({ className = "w-6 h-6", color = "currentColor" }: any) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" stroke={color} strokeWidth="8" fill="transparent"/>
    <circle cx="50" cy="50" r="28" stroke={color} strokeWidth="2" fill="transparent" opacity="0.5"/>
    <circle cx="50" cy="50" r="10" stroke={color} strokeWidth="4" fill="#17100C"/>
    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
      <g key={angle} transform={`rotate(${angle} 50 50)`}>
        <path d="M50 15 L50 5" stroke={color} strokeWidth="6" strokeLinecap="round"/>
        <path d="M50 40 L50 15" stroke={color} strokeWidth="4"/>
      </g>
    ))}
    <circle cx="50" cy="50" r="4" fill={color}/>
  </svg>
);
