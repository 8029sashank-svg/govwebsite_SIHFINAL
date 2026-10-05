'use client';

import React from 'react';

export default function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-30">
      <div className="atlas-glass pointer-events-auto rounded-2xl px-4 py-3 atlas-shadow-panel">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">Block height</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-sky-700 via-cyan-400 to-violet-400" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-300">
          <span>Low index</span>
          <span>High index</span>
        </div>
        <p className="mt-2 max-w-[15rem] text-[10px] leading-relaxed text-slate-300">
          Height &amp; color encode a demo development index. Hover a district, click to dive in.
        </p>
      </div>
    </div>
  );
}
