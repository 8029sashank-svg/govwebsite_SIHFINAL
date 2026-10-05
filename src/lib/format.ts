import type { CaseRecord } from './types';
import { DEMO_NOW, ECONOMICS } from './catalog';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const INR = new Intl.NumberFormat('en-IN');

export function formatNumber(value: number): string {
  return INR.format(Math.round(value));
}

/** Indian-convention currency abbreviation: thousands, lakh, crore. */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)} K`;
  return `₹${Math.round(value)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Relative time measured against DEMO_NOW rather than the wall clock, so
 * server and client renders agree (no hydration mismatch).
 */
export function timeAgo(iso: string, now: number = DEMO_NOW): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/* ------------------------------------------------------------------ */
/* Economic impact model                                               */
/* ------------------------------------------------------------------ */

export interface ImpactAssumptions {
  /** Share of affected farmers the advisory actually reaches, 0-100. */
  reachPct: number;
  /** Share of loss avoided when a farmer acts in time, 0-100. */
  efficacyPct: number;
  /** Mean days between symptom onset and the case being actioned. */
  detectionLagDays: number;
  /** Multiplier on affected area for untreated spread over 30 days. */
  spreadFactor: number;
}

export const DEFAULT_ASSUMPTIONS: ImpactAssumptions = {
  reachPct: 68,
  efficacyPct: 55,
  detectionLagDays: 2.4,
  spreadFactor: 2.8,
};

export interface ImpactResult {
  exposure: number;
  prevented: number;
  residual: number;
  avertedUnits: number;
  speedBonus: number;
  caseCount: number;
}

/**
 * Estimates the value of loss prevented by early detection.
 *
 *   baseValue     = units × unitYield × unitPrice
 *   exposure      = baseValue × lossRate(severity) × spreadFactor
 *   speedBonus    = 1 when actioned same-day, decaying to 0.55 at 7 days
 *   prevented     = exposure × reach × efficacy × speedBonus
 *
 * Every term is an explicit input so the rupee figure can be defended in
 * a departmental review instead of being taken on faith. Only cases that
 * were actually acted upon (verified, dispatched, in progress, resolved)
 * count toward prevented loss — pending and rejected cases do not.
 */
export function estimateImpact(cases: CaseRecord[], assumptions: ImpactAssumptions = DEFAULT_ASSUMPTIONS): ImpactResult {
  const actioned = cases.filter((c) =>
    ['VERIFIED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED'].includes(c.status),
  );

  let exposure = 0;
  let prevented = 0;
  let avertedUnits = 0;

  const lossRate = { HIGH: 0.62, MEDIUM: 0.34, LOW: 0.12 } as const;

  // Acting fast is worth more: full credit same-day, decaying to 55% by day 7.
  const speedBonus = Math.max(0.55, 1 - assumptions.detectionLagDays * 0.064);

  for (const record of actioned) {
    const econ = ECONOMICS[record.subject];
    if (!econ) continue;

    const baseValue = record.areaHa * econ.unitYield * econ.unitPrice;
    const caseExposure = baseValue * lossRate[record.severity] * assumptions.spreadFactor;
    const casePrevented =
      caseExposure * (assumptions.reachPct / 100) * (assumptions.efficacyPct / 100) * speedBonus;

    exposure += caseExposure;
    prevented += casePrevented;
    avertedUnits += (casePrevented / econ.unitPrice) * (econ.unit === 'head' ? 1 : 1);
  }

  return {
    exposure,
    prevented,
    residual: exposure - prevented,
    avertedUnits,
    speedBonus,
    caseCount: actioned.length,
  };
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
