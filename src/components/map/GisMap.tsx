'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { Layers, MapPin, Flame, Users, RotateCcw, Search, Map as MapIcon } from 'lucide-react';
import type { CaseRecord, Officer, Scout, Severity } from '@/lib/types';
import { CROPS, SEVERITY_META } from '@/lib/catalog';
import { LEVEL_META } from '@/lib/districtRisk';
import { useFilters } from '@/store/useFilters';
import { Skeleton, Button } from '@/components/ui';

/**
 * GisMap
 * ------
 * SSR-safe entry point for the map. Leaflet touches `window` on import,
 * so the canvas is loaded with `ssr: false` and a skeleton stands in
 * until the chunk arrives. Everything that does not need Leaflet (the
 * filter bar, the legend) stays in the server-friendly bundle.
 */

const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="w-full max-w-sm space-y-3 p-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <p className="pt-1 text-center text-[11px] text-slate-500">Loading GIS surface…</p>
      </div>
    </div>
  ),
});

export function GisMap(props: {
  cases: CaseRecord[];
  scouts: Scout[];
  officer: Officer | null;
  focus?: [number, number] | null;
  onSelectCase?: (record: CaseRecord) => void;
  /** Reporting window in days (defaults to the shared date filter). */
  windowDays?: number;
  /** Fired when a district popup's "Open in 3D atlas" button is used. */
  onInspectDistrict?: (district: string) => void;
  className?: string;
}) {
  const { showPins, showHeatmap, showScouts, showDistricts, days } = useFilters();
  return (
    <MapCanvas
      {...props}
      windowDays={props.windowDays ?? days}
      showPins={showPins}
      showHeatmap={showHeatmap}
      showScouts={showScouts}
      showDistricts={showDistricts}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Layer toggles                                                       */
/* ------------------------------------------------------------------ */

export function LayerToggles({ onToggleHeatmap }: { onToggleHeatmap?: (next: boolean) => void }) {
  const { showPins, showHeatmap, showScouts, showDistricts, set } = useFilters();

  const toggles = [
    { key: 'showDistricts' as const, label: 'District risk zones', icon: MapIcon, value: showDistricts },
    { key: 'showPins' as const, label: 'Case pins', icon: MapPin, value: showPins },
    { key: 'showHeatmap' as const, label: 'Risk heatmap', icon: Flame, value: showHeatmap },
    { key: 'showScouts' as const, label: 'Field scouts', icon: Users, value: showScouts },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 pr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Layers size={12} /> Layers
      </span>
      {toggles.map((toggle) => (
        <button
          key={toggle.key}
          onClick={() => {
            const next = !toggle.value;
            set(toggle.key, next);
            if (toggle.key === 'showHeatmap') onToggleHeatmap?.(next);
          }}
          aria-pressed={toggle.value}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            toggle.value
              ? 'bg-saffron-500 text-navy-950'
              : 'border border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100',
          )}
        >
          <toggle.icon size={12} />
          {toggle.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter bar                                                          */
/* ------------------------------------------------------------------ */

export function MapFilters({ compact = false }: { compact?: boolean }) {
  const filters = useFilters();
  const subjects = CROPS;

  return (
    <div className={clsx('grid gap-3', compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5')}>
      <label className="block">
        <span className="label">Crop</span>
        <select className="input" value={filters.subject} onChange={(e) => filters.set('subject', e.target.value)}>
          <option value="ALL">All</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">Date range</span>
        <select className="input" value={filters.days} onChange={(e) => filters.set('days', Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </label>

      <div>
        <span className="label">Severity</span>
        <div className="flex gap-1.5">
          {(['HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((severity) => {
            const active = filters.severities.includes(severity);
            return (
              <button
                key={severity}
                onClick={() => filters.toggleSeverity(severity)}
                aria-pressed={active}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all',
                  active ? 'text-navy-950' : 'border border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100',
                )}
                style={active ? { backgroundColor: SEVERITY_META[severity].color } : undefined}
              >
                {severity[0] + severity.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div className={compact ? 'sm:col-span-2 xl:col-span-1' : ''}>
        <span className="label">Search</span>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8"
              placeholder="Reference, farmer, disease…"
              value={filters.search}
              onChange={(e) => filters.set('search', e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={filters.reset} title="Reset all filters">
            <span className="sr-only">Reset filters</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */

export function MapLegend({ heatmapOn }: { heatmapOn: boolean }) {
  const showDistricts = useFilters((s) => s.showDistricts);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[15rem] rounded-xl border border-slate-200 bg-white/90 p-3 shadow-md backdrop-blur">
      {showDistricts && (
        <>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">District risk rating</p>
          <ul className="mb-3 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {(['HIGH', 'MODERATE', 'LOW'] as const).map((level) => (
              <li key={level} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-2.5 w-3.5 rounded-[3px]" style={{ backgroundColor: LEVEL_META[level].color, opacity: 0.75 }} />
                {LEVEL_META[level].label.replace(' risk', '')}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Case severity</p>
      <ul className="mt-1.5 space-y-1">
        {(['HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((severity) => (
          <li key={severity} className="flex items-center gap-2 text-[11px] text-slate-500">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_META[severity].color, boxShadow: `0 0 8px ${SEVERITY_META[severity].color}99` }}
            />
            {SEVERITY_META[severity].label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600 ring-2 ring-amber-400" />
          Awaiting expert review
        </li>
      </ul>

      {heatmapOn && (
        <>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
            Nightly prediction risk
          </p>
          <div
            className="mt-1.5 h-2 w-full rounded-full"
            style={{ background: 'linear-gradient(90deg,#22c55e,#eab308,#f97316,#ef4444,#be123c)' }}
          />
          <div className="mt-1 flex justify-between text-[9px] text-slate-500">
            <span>Low</span>
            <span>Extreme</span>
          </div>
        </>
      )}

      <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
        Pins show farmer-reported cases. The heatmap is the overnight model&apos;s 7-day risk surface.
      </p>
    </div>
  );
}

/** Compact counter shown over the map. */
export function MapStats({ total, high, pending }: { total: number; high: number; pending: number }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[500] flex gap-1.5">
      {[
        { label: 'cases', value: total, tone: 'text-slate-700' },
        { label: 'high risk', value: high, tone: 'text-red-700' },
        { label: 'in review', value: pending, tone: 'text-amber-700' },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 shadow-md backdrop-blur">
          <p className={clsx('font-mono text-sm font-bold leading-none', stat.tone)}>{stat.value}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
