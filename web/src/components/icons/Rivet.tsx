import React from 'react';

export const Rivet = ({ className = "w-2 h-2" }: any) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" fill="#17100C" stroke="#C7A04A" strokeWidth="2"/>
    <circle cx="10" cy="10" r="4" fill="#C7A04A" opacity="0.5"/>
  </svg>
);
