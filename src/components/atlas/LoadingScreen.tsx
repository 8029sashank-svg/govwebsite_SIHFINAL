'use client';

import React from 'react';

export default function LoadingScreen({ label = 'Loading Maharashtra…' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05070a]">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-saffron-400/20" />
        <div className="atlas-spin absolute inset-0 rounded-full border-2 border-transparent border-t-saffron-400 atlas-shadow-glow" />
        <div className="atlas-spin-slow absolute inset-2 rounded-full border-2 border-transparent border-b-violet-400" />
      </div>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-saffron-300/80">{label}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
        Projecting districts &middot; Building extrusions
      </p>
    </div>
  );
}
