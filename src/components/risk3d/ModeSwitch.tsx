'use client';

import React from 'react';
import clsx from 'clsx';
import { Box, Map as MapIcon } from 'lucide-react';

export type MapMode = '3d' | '2d';

/** Segmented control that flips a page's map panel between the 3D atlas and the 2D case map. */
export default function MapModeSwitch({ value, onChange }: { value: MapMode; onChange: (mode: MapMode) => void }) {
  const items: Array<{ id: MapMode; label: string; icon: typeof Box }> = [
    { id: '3d', label: '3D risk atlas', icon: Box },
    { id: '2d', label: '2D case map', icon: MapIcon },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Map style">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            value === id ? 'bg-white text-navy-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{id === '3d' ? '3D' : '2D'}</span>
        </button>
      ))}
    </div>
  );
}
