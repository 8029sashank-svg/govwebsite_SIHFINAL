'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { LEVEL_META, type DistrictRisk } from '@/lib/districtRisk';
import { useRiskAtlas } from '@/store/useRiskAtlas';

/**
 * Keeps rendering the last non-null value for `delayMs` after it becomes
 * null, so a panel's content does not vanish before its slide-out
 * transition finishes.
 */
export function useRetained<T>(value: T | null, delayMs = 450): T | null {
  const [held, setHeld] = useState<T | null>(value);
  useEffect(() => {
    if (value !== null) {
      setHeld(value);
      return undefined;
    }
    const id = setTimeout(() => setHeld(null), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return value ?? held;
}

/** The sliding container: a right-hand panel on wide layouts, a bottom sheet on narrow ones. */
export function PanelShell({
  open,
  wide,
  children,
  label,
}: {
  open: boolean;
  wide?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  const layout = useRiskAtlas((s) => s.layout);
  return (
    <aside
      aria-label={label}
      aria-hidden={!open}
      className={clsx(
        'absolute z-30 flex flex-col overflow-hidden border border-slate-200 bg-white/[0.97] shadow-2xl backdrop-blur-md',
        'transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
        layout === 'side'
          ? clsx(
              'bottom-3 right-3 top-3 max-w-[94%] rounded-2xl',
              wide ? 'w-[30rem]' : 'w-[22.5rem]',
              open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[108%] opacity-0',
            )
          : clsx(
              'inset-x-0 bottom-0 rounded-t-2xl',
              wide ? 'h-[58%]' : 'h-[46%]',
              open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
            ),
      )}
    >
      {children}
    </aside>
  );
}

export function RiskBadge({ risk, size = 'md' }: { risk: DistrictRisk; size?: 'sm' | 'md' }) {
  const meta = LEVEL_META[risk.level];
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1',
        meta.chip,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
      {risk.level !== 'NO_DATA' && risk.level !== 'OUT_OF_SCOPE' && (
        <span className="font-mono opacity-80">· {risk.score}</span>
      )}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'slate' | 'red' | 'amber' | 'emerald' | 'sky' | 'violet';
}) {
  const tones = {
    slate: 'text-navy-900',
    red: 'text-red-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    sky: 'text-sky-700',
    violet: 'text-violet-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={clsx('mt-1 text-xl font-semibold leading-none', tones[tone])}>{value}</p>
      {sub && <p className="mt-1 text-[10px] leading-tight text-slate-500">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, children, aside }: { icon?: React.ElementType; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {Icon && <Icon size={12} />}
        {children}
      </p>
      {aside}
    </div>
  );
}
