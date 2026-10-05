'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { IndianRupee, Calculator, TrendingDown, ShieldCheck, Timer, Layers, Info, Download } from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard, Meter } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { useScopedCases } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { scopeFor } from '@/lib/rbac';
import { DEFAULT_ASSUMPTIONS, estimateImpact, formatINR, formatNumber, formatDateTime, type ImpactAssumptions } from '@/lib/format';
import { ECONOMICS, DEMO_NOW } from '@/lib/catalog';
import { downloadCsv, type Row } from '@/lib/exporters';
import type { CaseRecord } from '@/lib/types';

/**
 * Economic Impact Estimator.
 *
 * Deliberately not a black box. Every coefficient is a slider, the
 * formula is printed under the sliders, and the per-case contribution is
 * listed in a sortable table — so the ₹ figure that ends up in a
 * cabinet note can be reconstructed line by line.
 */
export default function ImpactPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const log = useOps((s) => s.log);

  const [assumptions, setAssumptions] = React.useState<ImpactAssumptions>(DEFAULT_ASSUMPTIONS);
  const scope = scopeFor(officer);

  const result = React.useMemo(() => estimateImpact(cases, assumptions), [cases, assumptions]);

  const perCase = React.useMemo(() => {
    const actioned = cases.filter((c) => ['VERIFIED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED'].includes(c.status));
    return actioned
      .map((record) => {
        const single = estimateImpact([record], assumptions);
        return { record, prevented: single.prevented, exposure: single.exposure };
      })
      .sort((a, b) => b.prevented - a.prevented);
  }, [cases, assumptions]);

  const byDistrict = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of perCase) {
      map.set(row.record.district, (map.get(row.record.district) ?? 0) + row.prevented);
    }
    return [...map.entries()]
      .map(([district, prevented]) => ({ district, prevented: Math.round(prevented) }))
      .sort((a, b) => b.prevented - a.prevented)
      .slice(0, 10);
  }, [perCase]);

  const set = <K extends keyof ImpactAssumptions>(key: K, value: ImpactAssumptions[K]) =>
    setAssumptions((prev) => ({ ...prev, [key]: value }));

  const columns: Column<(typeof perCase)[number]>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => <span className="font-mono text-[11px]">{r.record.reference}</span>,
      sortValue: (r) => r.record.reference,
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (r) => (
        <div>
          <p className="font-medium text-navy-900">{r.record.diagnosis}</p>
          <p className="text-[10px] text-slate-500">
            {r.record.subject} · {r.record.district}
          </p>
        </div>
      ),
      sortValue: (r) => r.record.diagnosis,
    },
    {
      key: 'extent',
      header: 'Extent',
      render: (r) =>
        `${formatNumber(r.record.areaHa)} ${r.record.domain === 'CROP' ? 'ha' : 'head'}`,
      sortValue: (r) => r.record.areaHa,
      hideOnMobile: true,
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (r) => r.record.severity,
      sortValue: (r) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 })[r.record.severity],
      hideOnMobile: true,
    },
    {
      key: 'exposure',
      header: 'Exposure',
      render: (r) => <span className="font-mono text-red-700">{formatINR(r.exposure)}</span>,
      sortValue: (r) => r.exposure,
    },
    {
      key: 'prevented',
      header: 'Loss prevented',
      render: (r) => <span className="font-mono font-semibold text-emerald-700">{formatINR(r.prevented)}</span>,
      sortValue: (r) => r.prevented,
    },
  ];

  const exportCsv = () => {
    const cols = ['Reference', 'Diagnosis', 'Subject', 'District', 'Extent', 'Severity', 'Exposure (INR)', 'Prevented (INR)'];
    const rows: Row[] = perCase.map((r) => [
      r.record.reference,
      r.record.diagnosis,
      r.record.subject,
      r.record.district,
      r.record.areaHa,
      r.record.severity,
      Math.round(r.exposure),
      Math.round(r.prevented),
    ]);
    downloadCsv('economic-impact', cols, rows, {
      title: 'Economic Impact Statement',
      scope: scope.label,
      period: 'All actioned cases in scope',
      generatedBy: officer ? `${officer.name} (${officer.employeeCode})` : 'Unknown',
      generatedAt: formatDateTime(new Date(DEMO_NOW).toISOString()),
      summary: `Estimated ${formatINR(result.prevented)} of loss prevented at ${assumptions.reachPct}% reach and ${assumptions.efficacyPct}% intervention efficacy.`,
    });
    if (officer) log(officer, 'REPORT_EXPORTED', 'Economic Impact Statement', `CSV export covering ${rows.length} actioned cases.`);
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Economic Impact Estimator"
        subtitle={`${scope.label} · the rupee value of onion loss avoided by early detection and intervention.`}
        action={
          <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv}>
            Export statement
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingDown}
          label="Exposure without action"
          value={formatINR(result.exposure)}
          sub={`Across ${formatNumber(result.caseCount)} actioned cases, incl. ${assumptions.spreadFactor}× untreated spread`}
          tone="red"
        />
        <StatCard
          icon={ShieldCheck}
          label="₹ Loss prevented"
          value={formatINR(result.prevented)}
          sub={`At ${assumptions.reachPct}% reach × ${assumptions.efficacyPct}% efficacy`}
          tone="emerald"
        />
        <StatCard
          icon={Timer}
          label="Early-detection multiplier"
          value={`${result.speedBonus.toFixed(2)}×`}
          sub={`Mean action lag ${assumptions.detectionLagDays.toFixed(1)} days from report`}
          tone="saffron"
        />
        <StatCard
          icon={Layers}
          label="Residual loss"
          value={formatINR(result.residual)}
          sub="Farmers not reached, or unable to act in time"
          tone="amber"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Panel>
          <PanelHeader icon={Calculator} title="Model assumptions" subtitle="Adjust to match the intervention being assessed" />
          <div className="space-y-4 p-4">
            <Slider
              label="Advisory reach"
              value={assumptions.reachPct}
              onChange={(v) => set('reachPct', v)}
              suffix="%"
              hint="Share of affected farmers who receive and read the advisory"
            />
            <Slider
              label="Intervention efficacy"
              value={assumptions.efficacyPct}
              onChange={(v) => set('efficacyPct', v)}
              suffix="%"
              hint="Share of loss avoided when a farmer acts on the advice in time"
            />
            <Slider
              label="Detection-to-action lag"
              value={assumptions.detectionLagDays}
              onChange={(v) => set('detectionLagDays', v)}
              min={0}
              max={7}
              step={0.1}
              suffix=" days"
              hint="Acting on day zero earns full credit; credit decays to 0.55× at seven days"
            />
            <Slider
              label="Untreated spread factor"
              value={assumptions.spreadFactor}
              onChange={(v) => set('spreadFactor', v)}
              min={1}
              max={6}
              step={0.1}
              suffix="×"
              hint="How far an untreated outbreak spreads over 30 days, as a multiple of the reported extent"
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-500">
              <p className="mb-1.5 flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Info size={11} /> The arithmetic, per case
              </p>
              base = extent × yield × price
              <br />
              exposure = base × lossRate(severity) × {assumptions.spreadFactor}
              <br />
              prevented = exposure × {assumptions.reachPct}% × {assumptions.efficacyPct}% ×{' '}
              {result.speedBonus.toFixed(2)}
              <br />
              <span className="text-slate-500">lossRate: HIGH 0.62 · MEDIUM 0.34 · LOW 0.12</span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                Price assumptions in force
              </p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                {Object.entries(ECONOMICS)
                  .slice(0, 10)
                  .map(([name, econ]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span className="truncate">{name}</span>
                      <span className="font-mono text-slate-500">₹{formatNumber(econ.unitPrice)}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-1.5 text-[9px] text-slate-500">
                Yield: 11.33 MT/ha (Odisha 2017-18, Anonymous 2018, per Mandal et al. 2022). Price is an editable assumption - not in the source PDFs.
              </p>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader icon={IndianRupee} title="Outcome" subtitle="Prevented versus residual loss" accent="emerald" />
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">₹ Loss prevented</p>
              <p className="text-4xl font-bold text-emerald-700">{formatINR(result.prevented)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Against {formatINR(result.exposure)} of modelled exposure across {formatNumber(result.caseCount)}{' '}
                actioned cases in {scope.label}.
              </p>

              <div className="mt-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="transition-[width] duration-700"
                    style={{
                      width: `${(result.prevented / (result.exposure || 1)) * 100}%`,
                      backgroundColor: '#22c55e',
                    }}
                  />
                  <div className="flex-1 bg-red-500" />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Prevented · {formatINR(result.prevented)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-red-500" /> Residual · {formatINR(result.residual)}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <Meter
                  value={(result.prevented / (result.exposure || 1)) * 100}
                  color="#22c55e"
                  label="Share of exposure averted"
                />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Raising reach by ten points would protect a further{' '}
                <strong className="text-emerald-700">
                  {formatINR(
                    estimateImpact(cases, { ...assumptions, reachPct: Math.min(100, assumptions.reachPct + 10) })
                      .prevented - result.prevented,
                  )}
                </strong>
                . Cutting the action lag by one day is worth{' '}
                <strong className="text-emerald-700">
                  {formatINR(
                    estimateImpact(cases, {
                      ...assumptions,
                      detectionLagDays: Math.max(0, assumptions.detectionLagDays - 1),
                    }).prevented - result.prevented,
                  )}
                </strong>
                .
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader icon={Layers} title="Loss prevented by district" subtitle="Top districts in scope" accent="sky" />
            <div className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDistrict} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 44 }}>
                  <CartesianGrid stroke="rgba(15,23,42,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ stroke: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatINR(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="district"
                    tick={{ stroke: '#64748b', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 11,
                      color: '#0f172a',
                      boxShadow: '0 12px 32px -12px rgba(15,23,42,0.25)',
                    }}
                    formatter={(value: number) => [formatINR(value), 'Loss prevented']}
                    cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  />
                  <Bar dataKey="prevented" radius={[0, 4, 4, 0]}>
                    {byDistrict.map((entry, index) => (
                      <Cell key={entry.district} fill={index === 0 ? '#22c55e' : '#38bdf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={IndianRupee}
          title="Per-case contribution"
          subtitle="Every actioned case and what it contributes to the headline figure"
          action={<Badge tone="slate">{perCase.length} cases</Badge>}
        />
        <DataTable
          columns={columns}
          rows={perCase}
          rowKey={(r) => r.record.id}
          pageSize={10}
          initialSort={{ key: 'prevented', direction: 'desc' }}
          emptyTitle="No actioned cases yet"
          emptyMessage="Loss is only counted as prevented once a case has been verified, dispatched or resolved."
        />
      </Panel>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
        {label}
        <span className="font-mono text-saffron-700">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-saffron-500"
      />
      {hint && <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}
