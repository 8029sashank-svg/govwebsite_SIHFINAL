import type { CaseRecord, CaseStatus, Domain, Officer, Severity, TrendPoint } from './types';
import { DISTRICTS, divisionOf } from './geography';
import { DEMO_NOW, PATHOGENS, SEVERITY_META } from './catalog';
import { DISTRICT_RISK } from './mockData';
import { scopeFor } from './rbac';

/**
 * districtRisk.ts
 * ---------------
 * The district-level risk model that colours the Maharashtra choropleth
 * (both the 3D atlas and the 2D Leaflet layer) and feeds the district
 * inspector. It is deliberately framework-free (no React, no three.js, no
 * Leaflet) so every surface computes ratings through the same function
 * and a district can never be "High" on one screen and "Moderate" on
 * another for the same set of cases.
 *
 * TWO DISTRICT ROSTERS
 * The console models the 36 current districts (src/lib/geography.ts),
 * but the boundary polygons in public/maharashtra_districts.json are an
 * older 34-feature GADM set. GEO_TO_CONSOLE is the single place that
 * reconciles them: it says which console districts roll up into which
 * polygon (e.g. the Thane polygon still contains Palghar, and the
 * Greater Bombay polygon covers both Mumbai City and Mumbai Suburban).
 *
 * RATING
 *   caseLoad  = 1 - exp(-weightedCases / K)            (saturating, 0..1)
 *   score     = 100 * (0.6 * caseLoad + 0.4 * model)   (model = nightly
 *                                                       prediction, 0..1)
 * where weightedCases counts each case by severity (High 3 / Medium 1.6 /
 * Low 0.6) and by status (resolved cases count 35%, rejected ones not at
 * all), and K scales with the length of the reporting window so a 7-day
 * view and a 90-day view rate a district on the same footing.
 */

/* ------------------------------------------------------------------ */
/* Levels & palette                                                    */
/* ------------------------------------------------------------------ */

export type RiskLevel = 'HIGH' | 'MODERATE' | 'LOW';
export type MapLevel = RiskLevel | 'NO_DATA' | 'OUT_OF_SCOPE';

/** Score at or above which a district is rated High / Moderate. */
export const HIGH_THRESHOLD = 55;
export const MODERATE_THRESHOLD = 42;

/**
 * Colours reuse the console-wide severity ramp (SEVERITY_META) so a colour
 * means the same thing on the pins, the badges and the district fills.
 */
export const LEVEL_META: Record<
  MapLevel,
  { label: string; color: string; side: string; tint: string; chip: string; rank: number }
> = {
  HIGH: {
    label: 'High risk',
    color: SEVERITY_META.HIGH.color,
    side: '#991b1b',
    tint: '#fecaca',
    chip: 'bg-red-50 text-red-700 ring-red-200',
    rank: 3,
  },
  MODERATE: {
    label: 'Moderate risk',
    color: SEVERITY_META.MEDIUM.color,
    side: '#9a3412',
    tint: '#fed7aa',
    chip: 'bg-orange-50 text-orange-700 ring-orange-200',
    rank: 2,
  },
  LOW: {
    label: 'Low risk',
    color: SEVERITY_META.LOW.color,
    side: '#166534',
    tint: '#bbf7d0',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rank: 1,
  },
  NO_DATA: {
    label: 'No reports in view',
    color: '#94a3b8',
    side: '#64748b',
    tint: '#e2e8f0',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    rank: 0,
  },
  OUT_OF_SCOPE: {
    label: 'Outside your jurisdiction',
    color: '#cbd5e1',
    side: '#94a3b8',
    tint: '#f1f5f9',
    chip: 'bg-slate-100 text-slate-500 ring-slate-200',
    rank: -1,
  },
};

export function levelForScore(score: number): RiskLevel {
  if (score >= HIGH_THRESHOLD) return 'HIGH';
  if (score >= MODERATE_THRESHOLD) return 'MODERATE';
  return 'LOW';
}

/* ------------------------------------------------------------------ */
/* Polygon <-> console district reconciliation                         */
/* ------------------------------------------------------------------ */

interface GeoAlias {
  /** Console (current-name) districts that roll up into this polygon. */
  consoleDistricts: string[];
  /** Name shown on the map. */
  label: string;
  /** Extra note shown in the panel when the polygon covers more than its name says. */
  note?: string;
}

/** Keyed by the polygon's NAME_2 in public/maharashtra_districts.json. */
const GEO_ALIASES: Record<string, GeoAlias> = {
  Aurangabad: { consoleDistricts: ['Chhatrapati Sambhajinagar'], label: 'Chh. Sambhajinagar', note: 'Formerly Aurangabad' },
  Bid: { consoleDistricts: ['Beed'], label: 'Beed' },
  Buldana: { consoleDistricts: ['Buldhana'], label: 'Buldhana' },
  Garhchiroli: { consoleDistricts: ['Gadchiroli'], label: 'Gadchiroli' },
  Gondiya: { consoleDistricts: ['Gondia'], label: 'Gondia' },
  'Greater Bombay': {
    consoleDistricts: ['Mumbai City', 'Mumbai Suburban'],
    label: 'Mumbai',
    note: 'Covers Mumbai City and Mumbai Suburban',
  },
  Osmanabad: { consoleDistricts: ['Dharashiv'], label: 'Dharashiv', note: 'Formerly Osmanabad' },
  Raigarh: { consoleDistricts: ['Raigad'], label: 'Raigad' },
  Thane: {
    consoleDistricts: ['Thane', 'Palghar'],
    label: 'Thane',
    note: 'This boundary set still includes Palghar within Thane',
  },
};

const CONSOLE_NAMES = new Set(DISTRICTS.map((d) => d.name));

export function consoleDistrictsFor(geoKey: string): string[] {
  const alias = GEO_ALIASES[geoKey];
  if (alias) return alias.consoleDistricts.filter((n) => CONSOLE_NAMES.has(n));
  return CONSOLE_NAMES.has(geoKey) ? [geoKey] : [];
}

export function labelFor(geoKey: string): string {
  return GEO_ALIASES[geoKey]?.label ?? geoKey;
}

export function noteFor(geoKey: string): string | undefined {
  return GEO_ALIASES[geoKey]?.note;
}

const CONSOLE_TO_GEO: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [geoKey, alias] of Object.entries(GEO_ALIASES)) {
    for (const name of alias.consoleDistricts) map[name] = geoKey;
  }
  return map;
})();

/** Which boundary polygon a console district (as stored on a case) belongs to. */
export function geoKeyForConsoleDistrict(name: string): string {
  return CONSOLE_TO_GEO[name] ?? name;
}

/* ------------------------------------------------------------------ */
/* Risk scoring                                                        */
/* ------------------------------------------------------------------ */

const SEVERITY_POINTS: Record<Severity, number> = { HIGH: 3, MEDIUM: 1.6, LOW: 0.6 };
const STATUS_FACTOR: Record<CaseStatus, number> = {
  PENDING_REVIEW: 1,
  VERIFIED: 1,
  DISPATCHED: 1,
  IN_PROGRESS: 1,
  RESOLVED: 0.35,
  REJECTED: 0,
};

/** Reference load: ~10 weighted cases in 30 days puts caseLoad at ~63%. */
const LOAD_K_PER_30_DAYS = 10;

export function weightedLoad(cases: CaseRecord[]): number {
  return cases.reduce((sum, c) => sum + SEVERITY_POINTS[c.severity] * STATUS_FACTOR[c.status], 0);
}

export interface DistrictRisk {
  /** Polygon key (NAME_2 in the GeoJSON). */
  key: string;
  label: string;
  note?: string;
  consoleDistricts: string[];
  division: string;
  inScope: boolean;
  level: MapLevel;
  /** 0-100 composite. */
  score: number;
  /** Case-pressure component, 0-100. */
  loadScore: number;
  /** Nightly prediction model component, 0-100. */
  modelScore: number;
  total: number;
  high: number;
  medium: number;
  low: number;
  pendingReview: number;
  resolved: number;
  active: number;
  topDiagnosis?: string;
}

export type DistrictRiskMap = Record<string, DistrictRisk>;

export interface RiskInputs {
  /** Cases currently in view (already scoped/filtered by the caller). */
  cases: CaseRecord[];
  /** Polygon keys to rate. */
  geoKeys: string[];
  officer: Officer | null;
  /** Length of the reporting window the cases cover, in days. */
  windowDays?: number;
}

export function buildDistrictRisk({ cases, geoKeys, officer, windowDays = 30 }: RiskInputs): DistrictRiskMap {
  const scope = new Set(scopeFor(officer).districts);
  const byGeo = new Map<string, CaseRecord[]>();
  for (const c of cases) {
    const key = geoKeyForConsoleDistrict(c.district);
    const list = byGeo.get(key);
    if (list) list.push(c);
    else byGeo.set(key, [c]);
  }

  const K = LOAD_K_PER_30_DAYS * (Math.max(1, windowDays) / 30);
  const out: DistrictRiskMap = {};

  for (const key of geoKeys) {
    const members = consoleDistrictsFor(key);
    const inScope = members.some((m) => scope.has(m));
    const rows = byGeo.get(key) ?? [];

    const modelVals = members.map((m) => DISTRICT_RISK[m]).filter((v): v is number => typeof v === 'number');
    const modelScore = modelVals.length ? Math.round(modelVals.reduce((a, b) => a + b, 0) / modelVals.length) : 0;

    const points = weightedLoad(rows);
    const loadScore = Math.round((1 - Math.exp(-points / K)) * 100);
    const score = Math.round(0.6 * loadScore + 0.4 * modelScore);

    let level: MapLevel;
    if (!inScope) level = 'OUT_OF_SCOPE';
    else if (rows.length === 0) level = 'NO_DATA';
    else level = levelForScore(score);

    const diagCount = new Map<string, number>();
    for (const r of rows) diagCount.set(r.diagnosis, (diagCount.get(r.diagnosis) ?? 0) + 1);
    const topDiagnosis = [...diagCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    out[key] = {
      key,
      label: labelFor(key),
      note: noteFor(key),
      consoleDistricts: members,
      division: members[0] ? divisionOf(members[0]) : 'Unknown',
      inScope,
      level,
      score,
      loadScore,
      modelScore,
      total: rows.length,
      high: rows.filter((r) => r.severity === 'HIGH').length,
      medium: rows.filter((r) => r.severity === 'MEDIUM').length,
      low: rows.filter((r) => r.severity === 'LOW').length,
      pendingReview: rows.filter((r) => r.status === 'PENDING_REVIEW').length,
      resolved: rows.filter((r) => r.status === 'RESOLVED').length,
      active: rows.filter((r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED').length,
      topDiagnosis,
    };
  }
  return out;
}

export function levelCounts(risk: DistrictRiskMap): Record<MapLevel, number> {
  const counts: Record<MapLevel, number> = { HIGH: 0, MODERATE: 0, LOW: 0, NO_DATA: 0, OUT_OF_SCOPE: 0 };
  for (const r of Object.values(risk)) counts[r.level] += 1;
  return counts;
}

/* ------------------------------------------------------------------ */
/* Per-district detail (inspector)                                     */
/* ------------------------------------------------------------------ */

export interface DiagnosisRow {
  diagnosis: string;
  pathogenType: string;
  domain: Domain;
  notifiable: boolean;
  total: number;
  high: number;
  medium: number;
  low: number;
  pending: number;
  subjects: string[];
  talukas: string[];
  /** Hectares for crop cases, head for livestock cases. */
  extent: number;
  extentUnit: 'ha' | 'head';
  lastReportedAt: string;
}

export interface SubjectRow {
  subject: string;
  domain: Domain;
  total: number;
  high: number;
}

export interface TalukaRow {
  taluka: string;
  district: string;
  total: number;
  high: number;
}

export interface DistrictDetail {
  risk: DistrictRisk;
  cases: CaseRecord[];
  diagnoses: DiagnosisRow[];
  subjects: SubjectRow[];
  talukas: TalukaRow[];
  trend: TrendPoint[];
  status: Record<CaseStatus, number>;
  cropCases: number;
  livestockCases: number;
  cropAreaHa: number;
  livestockHead: number;
  avgAiConfidence: number | undefined;
  notifiableCases: number;
}

const NOTIFIABLE = new Set(PATHOGENS.filter((p) => p.notifiable).map((p) => p.name));

function weeklyTrend(cases: CaseRecord[], weeks: number): TrendPoint[] {
  return Array.from({ length: weeks }, (_, idx) => {
    const weeksAgo = weeks - 1 - idx;
    const end = DEMO_NOW - weeksAgo * 7 * 86400000;
    const start = end - 7 * 86400000;
    const bucket = cases.filter((c) => {
      const t = new Date(c.reportedAt).getTime();
      return t >= start && t < end;
    });
    return {
      label: new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: new Date(start).toISOString(),
      cases: bucket.length,
      high: bucket.filter((c) => c.severity === 'HIGH').length,
      medium: bucket.filter((c) => c.severity === 'MEDIUM').length,
      low: bucket.filter((c) => c.severity === 'LOW').length,
      resolved: bucket.filter((c) => c.status === 'RESOLVED').length,
      crop: bucket.filter((c) => c.domain === 'CROP').length,
      livestock: bucket.filter((c) => c.domain === 'LIVESTOCK').length,
    };
  });
}

export function buildDistrictDetail(
  risk: DistrictRisk,
  viewCases: CaseRecord[],
  historyCases: CaseRecord[],
  weeks = 12,
): DistrictDetail {
  const inDistrict = (c: CaseRecord) => geoKeyForConsoleDistrict(c.district) === risk.key;
  const cases = viewCases.filter(inDistrict).sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt));
  const history = historyCases.filter(inDistrict);

  const diag = new Map<string, DiagnosisRow>();
  const subj = new Map<string, SubjectRow>();
  const tal = new Map<string, TalukaRow>();
  const status: Record<CaseStatus, number> = {
    PENDING_REVIEW: 0,
    VERIFIED: 0,
    REJECTED: 0,
    DISPATCHED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
  };

  for (const c of cases) {
    status[c.status] += 1;

    let d = diag.get(c.diagnosis);
    if (!d) {
      d = {
        diagnosis: c.diagnosis,
        pathogenType: c.pathogenType,
        domain: c.domain,
        notifiable: NOTIFIABLE.has(c.diagnosis),
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        pending: 0,
        subjects: [],
        talukas: [],
        extent: 0,
        extentUnit: c.domain === 'CROP' ? 'ha' : 'head',
        lastReportedAt: c.reportedAt,
      };
      diag.set(c.diagnosis, d);
    }
    d.total += 1;
    if (c.severity === 'HIGH') d.high += 1;
    else if (c.severity === 'MEDIUM') d.medium += 1;
    else d.low += 1;
    if (c.status === 'PENDING_REVIEW') d.pending += 1;
    if (!d.subjects.includes(c.subject)) d.subjects.push(c.subject);
    if (!d.talukas.includes(c.taluka)) d.talukas.push(c.taluka);
    d.extent += c.areaHa;
    if (+new Date(c.reportedAt) > +new Date(d.lastReportedAt)) d.lastReportedAt = c.reportedAt;

    const sKey = `${c.domain}:${c.subject}`;
    const s = subj.get(sKey) ?? { subject: c.subject, domain: c.domain, total: 0, high: 0 };
    s.total += 1;
    if (c.severity === 'HIGH') s.high += 1;
    subj.set(sKey, s);

    const tKey = `${c.district}:${c.taluka}`;
    const t = tal.get(tKey) ?? { taluka: c.taluka, district: c.district, total: 0, high: 0 };
    t.total += 1;
    if (c.severity === 'HIGH') t.high += 1;
    tal.set(tKey, t);
  }

  const crop = cases.filter((c) => c.domain === 'CROP');
  const live = cases.filter((c) => c.domain === 'LIVESTOCK');

  return {
    risk,
    cases,
    diagnoses: [...diag.values()]
      .map((d) => ({ ...d, extent: Math.round(d.extent * 10) / 10 }))
      .sort((a, b) => b.high - a.high || b.total - a.total),
    subjects: [...subj.values()].sort((a, b) => b.total - a.total),
    talukas: [...tal.values()].sort((a, b) => b.total - a.total),
    trend: weeklyTrend(history, weeks),
    status,
    cropCases: crop.length,
    livestockCases: live.length,
    cropAreaHa: Math.round(crop.reduce((s, c) => s + c.areaHa, 0) * 10) / 10,
    livestockHead: live.reduce((s, c) => s + c.areaHa, 0),
    avgAiConfidence: cases.length ? Math.round(cases.reduce((s, c) => s + c.aiConfidence, 0) / cases.length) : undefined,
    notifiableCases: cases.filter((c) => NOTIFIABLE.has(c.diagnosis)).length,
  };
}

/** Plain-language reason a district earned its rating — shown in the panels. */
export function explainRisk(risk: DistrictRisk): string {
  if (!risk.inScope) return 'This district is outside your jurisdiction, so its data is not shown.';
  if (risk.level === 'NO_DATA') return 'No farmer-reported cases match the current filters for this district.';
  const parts: string[] = [];
  if (risk.high > 0) parts.push(`${risk.high} high-severity case${risk.high === 1 ? '' : 's'}`);
  parts.push(`${risk.active} active of ${risk.total} reported`);
  if (risk.pendingReview > 0) parts.push(`${risk.pendingReview} awaiting expert review`);
  const model =
    risk.modelScore >= 60 ? 'the overnight model forecasts elevated pressure' : risk.modelScore >= 40 ? 'the overnight model forecasts moderate pressure' : 'the overnight model forecasts low pressure';
  return `${parts.join(', ')}; ${model}.`;
}
