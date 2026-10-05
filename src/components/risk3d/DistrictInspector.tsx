'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  ArrowLeft, Bug, ClipboardList, CloudSun, Download, Loader2, PawPrint, Radio, Search, Send,
  ShieldAlert, ShieldQuestion, Sprout, Users, X, Crosshair, History,
} from 'lucide-react';
import type { CaseRecord, Officer, Severity } from '@/lib/types';
import {
  LEVEL_META,
  explainRisk,
  type DistrictDetail,
  type DiagnosisRow,
  type MapLevel,
} from '@/lib/districtRisk';
import { REVIEW_THRESHOLD, SEVERITY_META, STATUS_META } from '@/lib/catalog';
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format';
import { can, scopeFor } from '@/lib/rbac';
import { downloadCsv } from '@/lib/exporters';
import { useRiskAtlas, type InspectorTab } from '@/store/useRiskAtlas';
import { useOps } from '@/store/useOps';
import { useScopedScouts } from '@/store/hooks';
import { useWeather } from '@/hooks/useWeather';
import { MetaChip } from '@/components/ui';
import { Kpi, RiskBadge, SectionTitle } from './panelParts';
import { ScoreGauge, SeverityBar, TrendBars } from './charts';

/**
 * DistrictInspector
 * -----------------
 * "Inspect district": everything the state knows about one district in
 * three tabs —
 *   Overview          rating, KPIs, trend, talukas, weather, response
 *   Pests & diseases  every diagnosis with severity, extent and reach
 *   Cases             every case, searchable, tied to the 3D pins
 *
 * The tabs and the 3D scene share state through useRiskAtlas: picking a
 * pest or disease dims every other pin on the map, and picking a case
 * (here or by clicking its pin) flies the camera to it.
 */

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pests', label: 'Pests & diseases' },
  { id: 'cases', label: 'Cases' },
];

export interface DistrictOption {
  key: string;
  label: string;
  level: MapLevel;
}

/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */

function WeatherCard({ lngLat }: { lngLat: [number, number] }) {
  const weather = useWeather(lngLat);
  if (weather.status === 'idle' || weather.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 size={13} className="animate-spin" /> Fetching live conditions…
      </div>
    );
  }
  if (weather.status === 'error') {
    return <p className="text-xs text-slate-500">Live weather unavailable right now ({weather.error}).</p>;
  }
  const { data } = weather;
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-2xl font-semibold leading-none text-navy-900">{Math.round(data.tempC)}°C</p>
        <p className="mt-1 text-[11px] text-slate-500">{data.label}</p>
      </div>
      <div className="text-right text-[11px] text-slate-500">
        <p>
          Humidity <b className="font-mono text-slate-700">{data.humidity}%</b>
        </p>
        <p>
          Wind <b className="font-mono text-slate-700">{Math.round(data.windKph)} km/h</b>
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">High humidity favours fungal outbreaks</p>
      </div>
    </div>
  );
}

function OverviewTab({
  detail,
  lngLat,
  officer,
  periodLabel,
  scopeLabel,
}: {
  detail: DistrictDetail;
  lngLat: [number, number];
  officer: Officer | null;
  periodLabel: string;
  scopeLabel: string;
}) {
  const { risk } = detail;
  const scouts = useScopedScouts();
  const dispatches = useOps((s) => s.dispatches);
  const log = useOps((s) => s.log);
  const setTab = useRiskAtlas((s) => s.setTab);

  const districtScouts = useMemo(() => scouts.filter((s) => risk.consoleDistricts.includes(s.district)), [scouts, risk.consoleDistricts]);
  const districtDispatches = useMemo(() => dispatches.filter((d) => risk.consoleDistricts.includes(d.district)), [dispatches, risk.consoleDistricts]);
  const activeDispatches = districtDispatches.filter((d) => d.status !== 'RESOLVED').length;
  const talMax = Math.max(1, ...detail.talukas.map((t) => t.total));

  const exportCsv = () => {
    if (!officer) return;
    const columns = [
      'Reference', 'Diagnosis', 'Pathogen type', 'Domain', 'Crop', 'Severity', 'Status',
      'AI confidence %', 'District', 'Taluka', 'Extent', 'Unit', 'Farmer ID', 'Channel', 'Reported',
    ];
    const rows = detail.cases.map((c) => [
      c.reference, c.diagnosis, c.pathogenType, 'Crop', c.subject,
      SEVERITY_META[c.severity].label, STATUS_META[c.status].label, c.aiConfidence, c.district, c.taluka,
      c.areaHa, c.domain === 'CROP' ? 'ha' : 'head', c.farmerId, c.channel, c.reportedAt,
    ]);
    downloadCsv(`district-${risk.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cases`, columns, rows, {
      title: `${risk.label} — district case report`,
      scope: scopeLabel,
      period: periodLabel,
      generatedBy: `${officer.name} (${officer.employeeCode})`,
      generatedAt: new Date().toLocaleString('en-IN'),
      summary: `${risk.label}: ${LEVEL_META[risk.level].label} (score ${risk.score}); ${risk.total} cases, ${risk.high} high severity.`,
    });
    log(officer, 'REPORT_EXPORTED', `${risk.label} district case report`, `CSV export of ${rows.length} cases (${periodLabel}) from the 3D atlas.`);
  };

  return (
    <div className="space-y-5">
      {/* Rating */}
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Risk score</p>
            <p className="mt-1 flex items-baseline gap-1 leading-none">
              <span className="text-4xl font-bold text-navy-900">{risk.score}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </p>
          </div>
          <RiskBadge risk={risk} />
        </div>
        <div className="mt-3">
          <ScoreGauge score={risk.score} level={risk.level} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{explainRisk(risk)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-slate-500">Case pressure</dt>
            <dd className="font-mono font-semibold text-slate-700">{risk.loadScore} / 100</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-slate-500">Nightly model</dt>
            <dd className="font-mono font-semibold text-slate-700">{risk.modelScore} / 100</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          Score = 60% case pressure (severity- and status-weighted reports, {periodLabel.toLowerCase()}) + 40% overnight prediction model.
        </p>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Cases" value={formatNumber(risk.total)} />
        <Kpi label="High" value={formatNumber(risk.high)} tone={risk.high ? 'red' : 'slate'} />
        <Kpi label="Active" value={formatNumber(risk.active)} tone="sky" />
        <Kpi label="In review" value={formatNumber(risk.pendingReview)} tone={risk.pendingReview ? 'amber' : 'slate'} />
        <Kpi label="Resolved" value={formatNumber(risk.resolved)} tone="emerald" />
        <Kpi label="Avg AI conf." value={detail.avgAiConfidence === undefined ? '—' : `${detail.avgAiConfidence}%`} />
      </div>

      <div>
        <SectionTitle>Severity mix</SectionTitle>
        <SeverityBar high={risk.high} medium={risk.medium} low={risk.low} />
      </div>

      {/* Crop vs livestock */}
      <div className="grid grid-cols-1 gap-2.5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
            <Sprout size={13} /> Onion crop health
          </p>
          <p className="mt-1.5 text-xl font-semibold text-emerald-900">{detail.cropCases}</p>
          <p className="text-[10px] text-emerald-700">cases · {formatNumber(detail.cropAreaHa)} ha affected</p>
        </div>
      </div>

      {/* Trend */}
      <section>
        <SectionTitle icon={History} aside={<span className="text-[10px] text-slate-400">last 12 weeks</span>}>
          Weekly cases
        </SectionTitle>
        <div className="rounded-xl border border-slate-200 p-3">
          <TrendBars points={detail.trend} />
        </div>
      </section>

      {/* Talukas */}
      <section>
        <SectionTitle aside={<span className="text-[10px] text-slate-400">{detail.talukas.length} talukas reporting</span>}>
          Talukas
        </SectionTitle>
        {detail.talukas.length === 0 ? (
          <p className="text-xs text-slate-500">No taluka-level reports in this view.</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.talukas.slice(0, 8).map((t) => (
              <li key={`${t.district}-${t.taluka}`} className="flex items-center gap-2.5 text-xs">
                <span className="w-28 shrink-0 truncate text-slate-700">{t.taluka}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(t.total / talMax) * 100}%`, background: t.high > 0 ? LEVEL_META.HIGH.color : LEVEL_META.MODERATE.color }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] text-slate-600">
                  {t.total}
                  {t.high > 0 && <span className="text-red-600"> ·{t.high}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* What's affected */}
      {detail.subjects.length > 0 && (
        <section>
          <SectionTitle>Crop affected</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {detail.subjects.map((s) => (
              <span
                key={`${s.domain}-${s.subject}`}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1',
                  s.domain === 'CROP' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-violet-50 text-violet-800 ring-violet-200',
                )}
              >
                {s.subject}
                <b className="font-mono">{s.total}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Weather */}
      <section>
        <SectionTitle icon={CloudSun}>Live conditions</SectionTitle>
        <div className="rounded-xl border border-slate-200 p-3.5">
          <WeatherCard lngLat={lngLat} />
        </div>
      </section>

      {/* Response */}
      <section>
        <SectionTitle icon={Users}>Field response</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Kpi label="Scouts on roster" value={districtScouts.length} sub={`${districtScouts.filter((s) => s.available).length} available now`} tone="sky" />
          <Kpi label="Dispatches" value={districtDispatches.length} sub={`${activeDispatches} still open`} tone={activeDispatches ? 'amber' : 'slate'} />
        </div>
      </section>

      {/* Actions */}
      <section>
        <SectionTitle>Actions</SectionTitle>
        <div className="grid gap-2">
          {officer && can(officer.role, 'REVIEW_CASES') && (
            <Link
              href="/review"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                <ShieldQuestion size={14} className="text-amber-600" /> Open review queue
              </span>
              {risk.pendingReview > 0 && <span className="chip bg-amber-50 text-amber-700 ring-amber-200">{risk.pendingReview}</span>}
            </Link>
          )}
          {officer && can(officer.role, 'DISPATCH') && (
            <Link href="/dispatch" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100">
              <Send size={14} className="text-sky-600" /> Assign a field scout
            </Link>
          )}
          {officer && can(officer.role, 'BROADCAST_DISTRICT') && (
            <Link href="/broadcast" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100">
              <Radio size={14} /> Compose advisory for {risk.label}
            </Link>
          )}
          <button
            onClick={exportCsv}
            disabled={detail.cases.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" /> Export {detail.cases.length} cases (CSV)
          </button>
        </div>
      </section>

      <button onClick={() => setTab('cases')} className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-saffron-500 hover:text-saffron-700">
        Browse all {risk.total} cases →
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pests & diseases tab                                                */
/* ------------------------------------------------------------------ */

function DiagnosisCard({ row, active, onToggle, onViewCases }: { row: DiagnosisRow; active: boolean; onToggle: () => void; onViewCases: () => void }) {
  const total = Math.max(1, row.total);
  return (
    <li
      className={clsx(
        'rounded-xl border p-3 transition-colors',
        active ? 'border-saffron-500 bg-saffron-500/5 ring-1 ring-saffron-500/30' : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <button onClick={onToggle} className="block w-full text-left" aria-pressed={active}>
        <div className="flex items-start gap-2.5">
          <span
            className={clsx(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              row.domain === 'CROP' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700',
            )}
          >
            {row.domain === 'CROP' ? <Bug size={14} /> : <PawPrint size={14} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-navy-900">{row.diagnosis}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{row.pathogenType}</span>
              {row.notifiable && (
                <span className="chip bg-red-50 text-red-700 ring-red-200">
                  <ShieldAlert size={10} /> Notifiable
                </span>
              )}
              {row.pending > 0 && <span className="chip bg-amber-50 text-amber-700 ring-amber-200">{row.pending} in review</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold leading-none text-navy-900">{row.total}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">cases</p>
          </div>
        </div>

        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
          <div style={{ width: `${(row.high / total) * 100}%`, background: SEVERITY_META.HIGH.color }} />
          <div style={{ width: `${(row.medium / total) * 100}%`, background: SEVERITY_META.MEDIUM.color }} />
          <div style={{ width: `${(row.low / total) * 100}%`, background: SEVERITY_META.LOW.color }} />
        </div>

        <dl className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
          <div>
            <dt>Severity</dt>
            <dd className="font-mono text-slate-700">
              {row.high}H · {row.medium}M · {row.low}L
            </dd>
          </div>
          <div>
            <dt>Extent</dt>
            <dd className="font-mono text-slate-700">
              {formatNumber(row.extent)} {row.extentUnit}
            </dd>
          </div>
          <div>
            <dt>Last reported</dt>
            <dd className="text-slate-700">{timeAgo(row.lastReportedAt)}</dd>
          </div>
        </dl>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">Crop:</span> {row.subjects.join(', ')} ·{' '}
          <span className="font-medium text-slate-600">Talukas:</span> {row.talukas.slice(0, 4).join(', ')}
          {row.talukas.length > 4 ? ` +${row.talukas.length - 4}` : ''}
        </p>
      </button>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className={clsx('inline-flex items-center gap-1 text-[10px] font-medium', active ? 'text-saffron-700' : 'text-slate-400')}>
          <Crosshair size={11} /> {active ? 'Highlighted on the 3D map' : 'Tap to highlight on the 3D map'}
        </span>
        <button onClick={onViewCases} className="text-[11px] font-semibold text-saffron-700 hover:underline">
          View cases →
        </button>
      </div>
    </li>
  );
}

function PestsTab({ detail }: { detail: DistrictDetail }) {
  const filter = useRiskAtlas((s) => s.diagnosisFilter);
  const setFilter = useRiskAtlas((s) => s.setDiagnosisFilter);
  const setTab = useRiskAtlas((s) => s.setTab);
  const [domain, setDomain] = useState<'ALL' | 'CROP'>('ALL');

  const crop = detail.diagnoses.filter((d) => d.domain === 'CROP');
  const rows = domain === 'ALL' ? detail.diagnoses : crop;

  if (detail.diagnoses.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <Bug size={26} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-700">No pests or diseases reported</p>
        <p className="mt-1 text-xs text-slate-500">Nothing matches the current filters for this district.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(
          [
            ['ALL', `All (${detail.diagnoses.length})`],
            ['CROP', `Crop (${crop.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setDomain(id)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              domain === id ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Ranked by high-severity load. Select one to dim every other pin on the 3D map.
      </p>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <DiagnosisCard
            key={row.diagnosis}
            row={row}
            active={filter === row.diagnosis}
            onToggle={() => setFilter(row.diagnosis)}
            onViewCases={() => {
              if (filter !== row.diagnosis) setFilter(row.diagnosis);
              setTab('cases');
            }}
          />
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cases tab                                                           */
/* ------------------------------------------------------------------ */

function CaseDetail({ record, onClose }: { record: CaseRecord; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-saffron-500/40 bg-saffron-500/5 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{record.reference}</p>
          <p className="mt-0.5 text-sm font-semibold text-navy-900">{record.diagnosis}</p>
          <p className="text-[11px] text-slate-500">
            {record.subject} · {record.pathogenType}
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Close case details">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <MetaChip label={SEVERITY_META[record.severity].label} chip={SEVERITY_META[record.severity].chip} />
        <MetaChip label={STATUS_META[record.status].label} chip={STATUS_META[record.status].chip} />
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
        {[
          ['AI confidence', `${record.aiConfidence}%`],
          ['Location', `${record.taluka}, ${record.district}`],
          ['Extent', `${formatNumber(record.areaHa)} ${record.domain === 'CROP' ? 'ha' : 'head'}`],
          ['Channel', record.channel],
          ['Farmer', `${record.farmerName}${record.farmerVerified ? ' ✓' : ''}`],
          ['Contact', record.farmerPhone],
          ['Reported', formatDateTime(record.reportedAt)],
          ['Coordinates', `${record.lat.toFixed(4)}, ${record.lng.toFixed(4)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white/80 px-2.5 py-1.5">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-0.5 truncate font-medium text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
      {record.reviewNote && <p className="mt-2 text-[11px] italic text-slate-600">“{record.reviewNote}” — {record.reviewedBy}</p>}
    </div>
  );
}

function CasesTab({ detail }: { detail: DistrictDetail }) {
  const focusedId = useRiskAtlas((s) => s.focusedCaseId);
  const focusCase = useRiskAtlas((s) => s.focusCase);
  const diagnosisFilter = useRiskAtlas((s) => s.diagnosisFilter);
  const setDiagnosisFilter = useRiskAtlas((s) => s.setDiagnosisFilter);
  const [q, setQ] = useState('');
  const [sev, setSev] = useState<Severity | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return detail.cases.filter((c) => {
      if (diagnosisFilter && c.diagnosis !== diagnosisFilter) return false;
      if (sev !== 'ALL' && c.severity !== sev) return false;
      if (term && !`${c.reference} ${c.diagnosis} ${c.subject} ${c.taluka} ${c.farmerName}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [detail.cases, diagnosisFilter, sev, q]);

  const focused = focusedId ? detail.cases.find((c) => c.id === focusedId) : undefined;

  // A pin click on the 3D map should bring that case's detail card into view.
  useEffect(() => {
    if (!focusedId) return;
    document.getElementById('rk-case-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedId]);

  return (
    <div className="space-y-3">
      {focused && (
        <div id="rk-case-detail" className="scroll-mt-2">
          <CaseDetail record={focused} onClose={() => focusCase(null)} />
        </div>
      )}

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input py-1.5 pl-8 text-xs" placeholder="Reference, crop, taluka, farmer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              sev === s ? (s === 'ALL' ? 'bg-navy-800 text-white' : 'text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            style={sev === s && s !== 'ALL' ? { background: SEVERITY_META[s].color } : undefined}
          >
            {s === 'ALL' ? 'All' : s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
        {diagnosisFilter && (
          <button
            onClick={() => setDiagnosisFilter(diagnosisFilter)}
            className="inline-flex items-center gap-1 rounded-full bg-saffron-500/10 px-2.5 py-1 text-[11px] font-semibold text-saffron-800 ring-1 ring-saffron-500/40"
          >
            {diagnosisFilter} <X size={11} />
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-500">
        Showing {rows.length} of {detail.cases.length} cases · select one to fly to it on the map
      </p>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <ClipboardList size={24} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No cases match</p>
          <p className="mt-1 text-xs text-slate-500">Clear the search or the pest / disease filter.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {rows.map((c) => (
            <li key={c.id} id={`rk-case-${c.id}`}>
              <button
                onClick={() => focusCase(focusedId === c.id ? null : c.id)}
                className={clsx('flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors', focusedId === c.id ? 'bg-saffron-500/10' : 'hover:bg-slate-50')}
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_META[c.severity].color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-navy-900">{c.diagnosis}</span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {c.subject} · {c.taluka} · <span className="font-mono">{c.reference}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <MetaChip label={STATUS_META[c.status].label} chip={STATUS_META[c.status].chip} />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={clsx('block font-mono text-[11px]', c.aiConfidence < REVIEW_THRESHOLD ? 'text-amber-700' : 'text-slate-500')}>{c.aiConfidence}%</span>
                  <span className="block text-[9px] text-slate-500">{timeAgo(c.reportedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector                                                           */
/* ------------------------------------------------------------------ */

export default function DistrictInspector({
  detail,
  lngLat,
  options,
  officer,
  periodLabel,
}: {
  detail: DistrictDetail;
  lngLat: [number, number];
  options: DistrictOption[];
  officer: Officer | null;
  periodLabel: string;
}) {
  const { risk } = detail;
  const meta = LEVEL_META[risk.level];
  const tab = useRiskAtlas((s) => s.tab);
  const setTab = useRiskAtlas((s) => s.setTab);
  const back = useRiskAtlas((s) => s.back);
  const clear = useRiskAtlas((s) => s.clear);
  const select = useRiskAtlas((s) => s.select);
  const scopeLabel = scopeFor(officer).label;
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Start each tab at the top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab, risk.key]);

  const counts: Record<InspectorTab, number | null> = { overview: null, pests: detail.diagnoses.length, cases: detail.cases.length };

  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: meta.color }} />
        <div className="flex items-center justify-between">
          <button onClick={back} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100">
            <ArrowLeft size={14} /> District summary
          </button>
          <button onClick={clear} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Leave district and return to the state view">
            <X size={16} />
          </button>
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-saffron-700">Inspecting district</p>
            <h2 className="truncate text-xl font-bold leading-tight tracking-tight text-navy-900">{risk.label}</h2>
            <p className="text-[11px] text-slate-500">
              {risk.division} Division · {risk.total} cases · {periodLabel.toLowerCase()}
            </p>
          </div>
          <RiskBadge risk={risk} size="sm" />
        </div>

        <label className="mt-2.5 block">
          <span className="sr-only">Jump to another district</span>
          <select
            className="input py-1.5 text-xs"
            value={risk.key}
            onChange={(e) => select(e.target.value)}
            aria-label="Jump to another district"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} — {LEVEL_META[o.level].label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors',
                tab === t.id ? 'bg-navy-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {t.label}
              {counts[t.id] !== null && <span className={clsx('ml-1 font-mono', tab === t.id ? 'text-white/70' : 'text-slate-400')}>{counts[t.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === 'overview' && <OverviewTab detail={detail} lngLat={lngLat} officer={officer} periodLabel={periodLabel} scopeLabel={scopeLabel} />}
        {tab === 'pests' && <PestsTab detail={detail} />}
        {tab === 'cases' && <CasesTab detail={detail} />}
      </div>
    </div>
  );
}
