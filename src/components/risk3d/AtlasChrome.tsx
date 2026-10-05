'use client';

import React, { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import {
  Box, Eye, EyeOff, Layers, Map as MapIcon, Maximize2, Minimize2, MousePointerClick, RotateCcw, ZoomIn, ZoomOut,
} from 'lucide-react';
import { LEVEL_META, type DistrictRiskMap, type MapLevel } from '@/lib/districtRisk';
import { HIGH_THRESHOLD, MODERATE_THRESHOLD, levelCounts } from '@/lib/districtRisk';
import { SEVERITY_META } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';
import { useRiskAtlas } from '@/store/useRiskAtlas';
import { RiskBadge } from './panelParts';

/* ------------------------------------------------------------------ */
/* Title + toolbar                                                     */
/* ------------------------------------------------------------------ */

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600 transition-colors',
        active ? 'border-saffron-500 bg-saffron-500/10 text-saffron-700' : 'border-slate-200 bg-white hover:bg-slate-50 hover:text-navy-900',
      )}
    >
      {children}
    </button>
  );
}

export function AtlasTopBar({
  districtCount,
  caseCount,
  periodLabel,
  periodControl,
  days,
  onDays,
  onZoom,
  onRefit,
  fullscreen,
  onToggleFullscreen,
}: {
  districtCount: number;
  caseCount: number;
  periodLabel: string;
  periodControl: boolean;
  days: number;
  onDays: (d: number) => void;
  onZoom: (dir: 1 | -1) => void;
  onRefit: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const view = useRiskAtlas((s) => s.view);
  const setView = useRiskAtlas((s) => s.setView);
  const showLabels = useRiskAtlas((s) => s.showLabels);
  const toggleLabels = useRiskAtlas((s) => s.toggleLabels);
  const mode = useRiskAtlas((s) => s.mode);
  const layout = useRiskAtlas((s) => s.layout);

  // On narrow screens the bottom sheet takes over; the panel has its own back / close buttons.
  if (layout === 'sheet' && mode !== 'state') return null;

  // Keep the controls clear of the panel that slides in on the right.
  const reserve = layout === 'side' && mode !== 'state' ? (mode === 'inspect' ? '31.5rem' : '24rem') : '1.5rem';

  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-start gap-2 transition-[max-width] duration-500"
      style={{ maxWidth: `calc(100% - ${reserve})` }}
    >
      <div className="rk-glass pointer-events-auto flex items-center gap-2.5 rounded-xl px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-500/10 text-saffron-600">
          <Layers size={16} />
        </span>
        <div>
          <p className="text-xs font-bold leading-tight text-navy-900">Maharashtra district risk atlas</p>
          <p className="text-[10px] leading-tight text-slate-500">
            {districtCount} districts · {formatNumber(caseCount)} cases · {periodLabel.toLowerCase()}
          </p>
        </div>
      </div>

      {periodControl && (
        <div className="rk-glass pointer-events-auto flex items-center gap-0.5 rounded-xl p-1" role="group" aria-label="Reporting period">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDays(d)}
              aria-pressed={days === d}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                days === d ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      )}

      <div className="rk-glass pointer-events-auto flex items-center gap-1 rounded-xl p-1">
        <IconButton label="Tilted 3D view" onClick={() => setView('3d')} active={view === '3d'}>
          <Box size={15} />
        </IconButton>
        <IconButton label="Top-down map view" onClick={() => setView('top')} active={view === 'top'}>
          <MapIcon size={15} />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-slate-200" />
        <IconButton label={showLabels ? 'Hide district names' : 'Show district names'} onClick={toggleLabels} active={showLabels}>
          {showLabels ? <Eye size={15} /> : <EyeOff size={15} />}
        </IconButton>
        <IconButton label="Zoom in" onClick={() => onZoom(1)}>
          <ZoomIn size={15} />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => onZoom(-1)}>
          <ZoomOut size={15} />
        </IconButton>
        <IconButton label="Reset view" onClick={onRefit}>
          <RotateCcw size={15} />
        </IconButton>
        <IconButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </IconButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */

export function AtlasLegend({ risk }: { risk: DistrictRiskMap }) {
  const mode = useRiskAtlas((s) => s.mode);
  const layout = useRiskAtlas((s) => s.layout);
  const levelFilter = useRiskAtlas((s) => s.levelFilter);
  const setLevelFilter = useRiskAtlas((s) => s.setLevelFilter);
  const counts = levelCounts(risk);

  // On narrow screens the bottom sheet owns the lower half of the canvas.
  if (layout === 'sheet' && mode !== 'state') return null;

  if (mode === 'inspect') {
    return (
      <div className="rk-glass pointer-events-none absolute bottom-3 left-3 z-20 max-w-[15rem] rounded-xl p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Case pins</p>
        <ul className="mt-1.5 space-y-1">
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
            <li key={s} className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_META[s].color }} />
              {SEVERITY_META[s].label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500 ring-2 ring-amber-400" />
            Awaiting expert review
          </li>
        </ul>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Click a pin to open the case. Drag to rotate, scroll to zoom.</p>
      </div>
    );
  }

  const rows: Array<{ level: MapLevel; range: string }> = [
    { level: 'HIGH', range: `score ≥ ${HIGH_THRESHOLD}` },
    { level: 'MODERATE', range: `${MODERATE_THRESHOLD}–${HIGH_THRESHOLD - 1}` },
    { level: 'LOW', range: `< ${MODERATE_THRESHOLD}` },
  ];
  const extras: MapLevel[] = (['NO_DATA', 'OUT_OF_SCOPE'] as MapLevel[]).filter((l) => counts[l] > 0);

  return (
    <div
      className={clsx(
        'rk-glass pointer-events-auto absolute bottom-3 z-20 w-[14.5rem] max-w-[calc(100%-1.5rem)] rounded-xl p-3',
        // The state's south-east corner is empty sea/Telangana, so the legend sits there
        // in the overview and steps aside to the left once a panel opens on the right.
        mode === 'state' ? 'right-3' : 'left-3',
      )}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">District risk rating</p>
      <ul className="mt-1.5 space-y-0.5">
        {[...rows.map((r) => r), ...extras.map((l) => ({ level: l, range: '' }))].map(({ level, range }) => {
          const meta = LEVEL_META[level];
          const active = levelFilter === level;
          const filterable = level !== 'OUT_OF_SCOPE';
          return (
            <li key={level}>
              <button
                disabled={!filterable}
                onClick={() => setLevelFilter(level)}
                aria-pressed={active}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors',
                  active ? 'bg-slate-100 font-semibold text-navy-900' : 'text-slate-600 hover:bg-slate-50',
                  !filterable && 'cursor-default hover:bg-transparent',
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: meta.color }} />
                <span className="flex-1 truncate">
                  {meta.label}
                  {range && <span className="ml-1 text-[9px] text-slate-400">{range}</span>}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{counts[level]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
        Colour = rating, height = risk score. {levelFilter ? 'Click the row again to clear.' : 'Click a row to isolate it.'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hover card                                                          */
/* ------------------------------------------------------------------ */

export function HoverCard({ risk, containerRef }: { risk: DistrictRiskMap; containerRef: React.RefObject<HTMLDivElement> }) {
  const hoveredKey = useRiskAtlas((s) => s.hoveredKey);
  const mode = useRiskAtlas((s) => s.mode);
  const cardRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });

  const place = React.useCallback(() => {
    const el = cardRef.current;
    const host = containerRef.current;
    if (!el || !host) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxX = host.clientWidth;
    const maxY = host.clientHeight;
    const x = pos.current.x + 18 + w > maxX ? pos.current.x - w - 14 : pos.current.x + 18;
    const y = Math.min(Math.max(8, pos.current.y + 14), maxY - h - 8);
    el.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
  }, [containerRef]);

  useLayoutEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pos.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      place();
    };
    host.addEventListener('pointermove', onMove);
    return () => host.removeEventListener('pointermove', onMove);
  }, [containerRef, place]);

  useLayoutEffect(() => {
    place();
  }, [hoveredKey, place]);

  const r = hoveredKey ? risk[hoveredKey] : undefined;
  if (!r || mode === 'inspect') return null;
  const meta = LEVEL_META[r.level];

  return (
    <div ref={cardRef} className="pointer-events-none absolute left-0 top-0 z-40 w-56 will-change-transform">
      <div className="rk-glass overflow-hidden rounded-xl shadow-xl">
        <div className="h-1" style={{ background: meta.color }} />
        <div className="p-3">
          <p className="text-sm font-bold leading-tight text-navy-900">{r.label}</p>
          <p className="text-[10px] text-slate-500">{r.division} Division</p>
          <div className="mt-2">
            <RiskBadge risk={r} size="sm" />
          </div>
          {r.inScope && r.level !== 'NO_DATA' && (
            <p className="mt-2 text-[11px] text-slate-600">
              <b className="font-mono">{r.total}</b> cases · <b className="font-mono text-red-700">{r.high}</b> high severity
              {r.topDiagnosis && (
                <>
                  <br />
                  <span className="text-slate-500">Most reported:</span> {r.topDiagnosis}
                </>
              )}
            </p>
          )}
          {r.level === 'NO_DATA' && <p className="mt-2 text-[11px] text-slate-500">No cases match the current filters.</p>}
          {r.level === 'OUT_OF_SCOPE' && <p className="mt-2 text-[11px] text-slate-500">Data for this district is outside your jurisdiction.</p>}
          {r.level !== 'OUT_OF_SCOPE' && (
            <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-saffron-700">
              <MousePointerClick size={11} /> Click to fly in
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hint                                                                */
/* ------------------------------------------------------------------ */

export function AtlasHint() {
  const mode = useRiskAtlas((s) => s.mode);
  const layout = useRiskAtlas((s) => s.layout);
  if (mode !== 'state' || layout === 'sheet') return null;
  return (
    <div className="rk-glass pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[10px] font-medium text-slate-600 md:block">
      Drag to rotate · scroll to zoom · click a district to fly in
    </div>
  );
}
