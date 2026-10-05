'use client';

import React from 'react';
import { HIGH_THRESHOLD, LEVEL_META, MODERATE_THRESHOLD, type MapLevel } from '@/lib/districtRisk';
import { SEVERITY_META } from '@/lib/catalog';
import type { TrendPoint } from '@/lib/types';

/**
 * Tiny, dependency-free chart pieces for the atlas panels. They are plain
 * SVG/HTML so they render instantly inside a panel that is sliding in,
 * with none of the measure-then-draw flash a charting library adds.
 */

/** Stacked High / Medium / Low bar with counts underneath. */
export function SeverityBar({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low;
  const seg = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {total > 0 && (
          <>
            <div style={{ width: `${seg(high)}%`, background: SEVERITY_META.HIGH.color }} />
            <div style={{ width: `${seg(medium)}%`, background: SEVERITY_META.MEDIUM.color }} />
            <div style={{ width: `${seg(low)}%`, background: SEVERITY_META.LOW.color }} />
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
        {[
          ['High', high, SEVERITY_META.HIGH.color],
          ['Medium', medium, SEVERITY_META.MEDIUM.color],
          ['Low', low, SEVERITY_META.LOW.color],
        ].map(([label, n, color]) => (
          <span key={label as string} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: color as string }} />
            {label} <b className="font-mono text-slate-700">{n as number}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal rating scale with the Low / Moderate / High zones and a marker at the score. */
export function ScoreGauge({ score, level }: { score: number; level: MapLevel }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        <div className="absolute inset-y-0 left-0" style={{ width: `${MODERATE_THRESHOLD}%`, background: LEVEL_META.LOW.color, opacity: 0.85 }} />
        <div
          className="absolute inset-y-0"
          style={{ left: `${MODERATE_THRESHOLD}%`, width: `${HIGH_THRESHOLD - MODERATE_THRESHOLD}%`, background: LEVEL_META.MODERATE.color, opacity: 0.85 }}
        />
        <div className="absolute inset-y-0 right-0" style={{ width: `${100 - HIGH_THRESHOLD}%`, background: LEVEL_META.HIGH.color, opacity: 0.85 }} />
      </div>
      <div className="relative -mt-[13px] h-[14px]">
        <span
          className="absolute top-0 h-[14px] w-[3px] -translate-x-1/2 rounded-full bg-navy-900 shadow ring-2 ring-white"
          style={{ left: `${clamped}%` }}
          aria-label={`Score ${score} of 100`}
        />
      </div>
      <div className="relative mt-1 h-3 text-[9px] text-slate-500">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${MODERATE_THRESHOLD}%` }}>
          {MODERATE_THRESHOLD}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${HIGH_THRESHOLD}%` }}>
          {HIGH_THRESHOLD}
        </span>
        <span className="absolute right-0">100</span>
      </div>
      <span className="sr-only">{LEVEL_META[level].label}</span>
    </div>
  );
}

/** Weekly stacked bars (High / Medium / Low) for the last N weeks. */
export function TrendBars({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.cases));
  const W = 320;
  const H = 96;
  const pad = 4;
  const barW = (W - pad * 2) / points.length;
  const gap = Math.min(4, barW * 0.22);

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Weekly case counts by severity">
      {[0.5, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H - f * (H - 6)} y2={H - f * (H - 6)} stroke="#e2e8f0" strokeDasharray="2 3" />
      ))}
      {points.map((p, i) => {
        const x = pad + i * barW + gap / 2;
        const w = barW - gap;
        const scale = (H - 6) / max;
        const hHigh = p.high * scale;
        const hMed = p.medium * scale;
        const hLow = p.low * scale;
        return (
          <g key={p.date}>
            <title>{`Week of ${p.label}: ${p.cases} cases (${p.high} high, ${p.medium} medium, ${p.low} low)`}</title>
            <rect x={x} y={H - hLow} width={w} height={hLow} rx={1.5} fill={SEVERITY_META.LOW.color} />
            <rect x={x} y={H - hLow - hMed} width={w} height={hMed} fill={SEVERITY_META.MEDIUM.color} />
            <rect x={x} y={H - hLow - hMed - hHigh} width={w} height={hHigh} rx={1.5} fill={SEVERITY_META.HIGH.color} />
            {p.cases === 0 && <rect x={x} y={H - 1.5} width={w} height={1.5} fill="#e2e8f0" />}
            {(i % 3 === 0 || i === points.length - 1) && (
              <text x={x + w / 2} y={H + 12} textAnchor="middle" fontSize="8" fill="#64748b">
                {p.label.split(' ')[0]} {p.label.split(' ')[1]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
