'use client';

import React from 'react';
import { ArrowLeft, Compass, Radar } from 'lucide-react';
import { useAtlasStore } from '@/store/useAtlasStore';

export default function TopBar({ districtCount }: { districtCount: number }) {
  const view = useAtlasStore((s) => s.view);
  const isTransitioning = useAtlasStore((s) => s.isTransitioning);
  const clearSelection = useAtlasStore((s) => s.clearSelection);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-5">
      <div className="atlas-glass pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 atlas-shadow-panel">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-saffron-400/15">
          <Compass className="text-saffron-300" size={18} />
        </div>
        <div>
          <p className="atlas-text-glow text-sm font-semibold leading-tight text-white">Maharashtra 3D Atlas</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
            {districtCount} districts &middot; live interactive
          </p>
        </div>
        {isTransitioning && (
          <span className="ml-2 flex items-center gap-1.5 rounded-full border border-saffron-400/30 bg-saffron-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-saffron-200">
            <Radar size={11} className="atlas-spin-radar" /> Flying
          </span>
        )}
      </div>

      {view === 'district' && (
        <button
          onClick={clearSelection}
          className="atlas-glass atlas-ease-cinematic pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white atlas-shadow-panel transition-all duration-300 hover:border-saffron-400/40 hover:bg-saffron-400/10"
        >
          <ArrowLeft size={16} /> Back to Maharashtra
        </button>
      )}
    </div>
  );
}
