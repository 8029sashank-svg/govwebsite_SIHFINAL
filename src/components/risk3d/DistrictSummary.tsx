'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Bug, PawPrint, ScanSearch, X } from 'lucide-react';
import { LEVEL_META, explainRisk, type DistrictDetail } from '@/lib/districtRisk';
import { formatNumber } from '@/lib/format';
import { useRiskAtlas } from '@/store/useRiskAtlas';
import { Kpi, RiskBadge, SectionTitle } from './panelParts';
import { ScoreGauge, SeverityBar } from './charts';

/**
 * DistrictSummary
 * ---------------
 * The card that slides in when a district is clicked, while the camera
 * flies to it. It answers "what is happening here?" at a glance and offers
 * the one obvious next step: Inspect district.
 */
export default function DistrictSummary({ detail, periodLabel }: { detail: DistrictDetail; periodLabel: string }) {
  const { risk } = detail;
  const meta = LEVEL_META[risk.level];
  const inspect = useRiskAtlas((s) => s.inspect);
  const back = useRiskAtlas((s) => s.back);
  const top = detail.diagnoses.slice(0, 3);
  const topMax = Math.max(1, ...top.map((d) => d.total));

  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 border-b border-slate-200 px-5 pb-4 pt-5">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: meta.color }} />
        <button
          onClick={back}
          className="absolute right-3 top-3.5 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close district card"
        >
          <X size={16} />
        </button>
        <p className="truncate pr-8 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{risk.division} Division</p>
        <h2 className="mt-1 pr-8 text-2xl font-bold leading-tight tracking-tight text-navy-900">{risk.label}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RiskBadge risk={risk} />
          <span className="text-[11px] text-slate-500">{periodLabel}</span>
        </div>
        {risk.note && <p className="mt-2 text-[11px] text-slate-500">{risk.note}.</p>}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <ScoreGauge score={risk.score} level={risk.level} />
          <p className="mt-3 text-xs leading-relaxed text-slate-600">{explainRisk(risk)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Kpi label="Cases in view" value={formatNumber(risk.total)} sub={`${risk.active} still active`} />
          <Kpi label="High severity" value={formatNumber(risk.high)} tone={risk.high > 0 ? 'red' : 'slate'} sub="farmer-reported" />
          <Kpi label="Awaiting review" value={formatNumber(risk.pendingReview)} tone={risk.pendingReview > 0 ? 'amber' : 'slate'} sub="expert sign-off" />
          <Kpi label="High-loss diseases" value={formatNumber(detail.notifiableCases)} tone={detail.notifiableCases > 0 ? 'violet' : 'slate'} sub="damping-off, purple blotch, IYSV" />
        </div>

        <div>
          <SectionTitle>Severity mix</SectionTitle>
          <SeverityBar high={risk.high} medium={risk.medium} low={risk.low} />
        </div>

        <div>
          <SectionTitle aside={<span className="text-[10px] text-slate-400">{detail.diagnoses.length} in total</span>}>
            Top pests &amp; diseases
          </SectionTitle>
          {top.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
              No cases to summarise for the current filters.
            </p>
          ) : (
            <ul className="space-y-2">
              {top.map((d) => (
                <li key={d.diagnosis} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {d.domain === 'CROP' ? <Bug size={13} className="text-emerald-600" /> : <PawPrint size={13} className="text-violet-600" />}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-navy-900">{d.diagnosis}</span>
                    <span className="font-mono text-[11px] text-slate-600">{d.total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(d.total / topMax) * 100}%`, background: d.high > 0 ? LEVEL_META.HIGH.color : LEVEL_META.MODERATE.color }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {d.subjects.slice(0, 3).join(', ')} · {d.high} high severity
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50/80 p-4">
        <button
          onClick={() => inspect()}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-saffron-500 px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-saffron-600 hover:shadow-lg active:scale-[0.99]"
        >
          <ScanSearch size={17} />
          Inspect district
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-center text-[10px] text-slate-500">Zooms in, drops every case on the map and opens pests, diseases and case details.</p>
        <button
          onClick={back}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
        >
          <ArrowLeft size={13} /> Back to Maharashtra
        </button>
      </div>
    </div>
  );
}
