'use client';

import React from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { LineChart as LineIcon, Download, Printer, FileBarChart2, PieChart as PieIcon, Layers } from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard, Skeleton } from '@/components/ui';
import { useScopedCases } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { scopeFor } from '@/lib/rbac';
import { buildTrends } from '@/lib/mockData';
import { SEVERITY_META, DEMO_NOW } from '@/lib/catalog';
import { downloadCsv, printReport, type ReportMeta, type Row } from '@/lib/exporters';
import { formatDateTime, formatNumber } from '@/lib/format';

/**
 * Historical trend analytics.
 *
 * Charts are rendered with Recharts inside ResponsiveContainer, which
 * measures its parent — so every chart sits in a fixed-height box.
 * Without that the container measures zero on first paint and the chart
 * silently renders nothing, which is the single most common Recharts
 * integration bug.
 */

const CHART_AXIS = { stroke: '#94a3b8', fontSize: 10 };
const GRID = 'rgba(15,23,42,0.08)';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 12px 32px -12px rgba(15,23,42,0.25)',
};

export default function AnalyticsPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const log = useOps((s) => s.log);

  const [weeks, setWeeks] = React.useState(12);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setReady(true), 280);
    return () => clearTimeout(id);
  }, []);

  const scope = scopeFor(officer);
  const trends = React.useMemo(() => buildTrends(scope.districts, weeks), [scope.districts, weeks]);

  const severitySplit = React.useMemo(
    () =>
      (['HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => ({
        name: SEVERITY_META[severity].label,
        value: cases.filter((c) => c.severity === severity).length,
        color: SEVERITY_META[severity].color,
      })),
    [cases],
  );

  const byPathogen = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const record of cases) map.set(record.diagnosis, (map.get(record.diagnosis) ?? 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [cases]);

  const byDistrict = React.useMemo(() => {
    const map = new Map<string, { district: string; crop: number; livestock: number }>();
    for (const record of cases) {
      const row = map.get(record.district) ?? { district: record.district, crop: 0, livestock: 0 };
      if (record.domain === 'CROP') row.crop += 1;
      else row.livestock += 1;
      map.set(record.district, row);
    }
    return [...map.values()].sort((a, b) => b.crop + b.livestock - (a.crop + a.livestock)).slice(0, 10);
  }, [cases]);

  const totals = React.useMemo(() => {
    const window = trends.reduce((sum, point) => sum + point.cases, 0);
    const resolved = trends.reduce((sum, point) => sum + point.resolved, 0);
    const recent = trends.slice(-4).reduce((s, p) => s + p.cases, 0);
    const prior = trends.slice(-8, -4).reduce((s, p) => s + p.cases, 0);
    const delta = prior ? Math.round(((recent - prior) / prior) * 100) : 0;
    return { window, resolved, delta, resolutionRate: window ? Math.round((resolved / window) * 100) : 0 };
  }, [trends]);

  const reportMeta = (title: string): ReportMeta => ({
    title,
    scope: scope.label,
    period: `Last ${weeks} weeks`,
    generatedBy: officer ? `${officer.name} (${officer.employeeCode})` : 'Unknown',
    generatedAt: formatDateTime(new Date(DEMO_NOW).toISOString()),
    summary: `${formatNumber(totals.window)} cases reported in the window; ${totals.resolutionRate}% resolved.`,
  });

  const trendColumns = ['Week starting', 'Total cases', 'High', 'Medium', 'Low', 'Resolved', 'Onion'];
  const trendRows: Row[] = trends.map((point) => [
    point.label,
    point.cases,
    point.high,
    point.medium,
    point.low,
    point.resolved,
    point.crop,
  ]);

  const exportCsv = () => {
    downloadCsv(`outbreak-trends-${weeks}w`, trendColumns, trendRows, reportMeta('Historical Outbreak Trends'));
    if (officer) log(officer, 'REPORT_EXPORTED', 'Historical Outbreak Trends', `CSV export, ${weeks}-week window, ${scope.label}.`);
  };

  const exportPdf = () => {
    try {
      printReport(trendColumns, trendRows, reportMeta('Historical Outbreak Trends'));
      if (officer) log(officer, 'REPORT_EXPORTED', 'Historical Outbreak Trends', `PDF (print) export, ${weeks}-week window.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open the print view.');
    }
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Historical Trend Analytics"
        subtitle={`${scope.label} · weekly outbreak history, severity mix and pathogen distribution.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto py-1.5 text-xs"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              aria-label="Analysis window"
            >
              <option value={8}>8 weeks</option>
              <option value={12}>12 weeks</option>
              <option value={24}>24 weeks</option>
            </select>
            <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv}>
              CSV
            </Button>
            <Button size="sm" variant="ghost" icon={Printer} onClick={exportPdf}>
              PDF
            </Button>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={!ready} icon={FileBarChart2} label="Cases in window" value={formatNumber(totals.window)} sub={`Across ${weeks} weeks`} tone="sky" />
        <StatCard loading={!ready} icon={LineIcon} label="4-week change" value={`${totals.delta > 0 ? '+' : ''}${totals.delta}%`} sub="Versus the preceding four weeks" tone={totals.delta > 0 ? 'red' : 'emerald'} />
        <StatCard loading={!ready} icon={Layers} label="Resolution rate" value={`${totals.resolutionRate}%`} sub={`${formatNumber(totals.resolved)} cases closed`} tone="emerald" />
        <StatCard loading={!ready} icon={PieIcon} label="High severity share" value={`${cases.length ? Math.round((severitySplit[0].value / cases.length) * 100) : 0}%`} sub={`${severitySplit[0].value} high-risk cases in scope`} tone="red" />
      </div>

      <Panel>
        <PanelHeader
          icon={LineIcon}
          title="Weekly case volume by severity"
          subtitle="Stacked area — the shape of an outbreak, not just its size"
          accent="violet"
        />
        <div className="h-72 p-4">
          {!ready ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  {(['high', 'medium', 'low'] as const).map((key, index) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={[SEVERITY_META.HIGH, SEVERITY_META.MEDIUM, SEVERITY_META.LOW][index].color} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={[SEVERITY_META.HIGH, SEVERITY_META.MEDIUM, SEVERITY_META.LOW][index].color} stopOpacity={0.04} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(15,23,42,0.15)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="high" name="High" stackId="1" stroke={SEVERITY_META.HIGH.color} fill="url(#grad-high)" />
                <Area type="monotone" dataKey="medium" name="Medium" stackId="1" stroke={SEVERITY_META.MEDIUM.color} fill="url(#grad-medium)" />
                <Area type="monotone" dataKey="low" name="Low" stackId="1" stroke={SEVERITY_META.LOW.color} fill="url(#grad-low)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader icon={LineIcon} title="Reported vs resolved" subtitle="Closing the loop on field verification" accent="emerald" />
          <div className="h-64 p-4">
            {!ready ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={CHART_AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="cases" name="Reported" stroke="#ff9933" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={PieIcon} title="Severity distribution" subtitle="Share of all cases in scope" accent="red" />
          <div className="h-64 p-4">
            {!ready ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severitySplit} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                    {severitySplit.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="rgba(0,0,0,0.25)" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader icon={Layers} title="Top pathogens" subtitle="Most frequently diagnosed in scope" accent="saffron" />
          <div className="h-72 p-4">
            {!ready ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPathogen} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 40 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ ...CHART_AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                  <Bar dataKey="count" name="Cases" fill="#ff9933" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={Layers} title="Onion cases by district" subtitle="Case load for the districts with most reports" accent="sky" />
          <div className="h-72 p-4">
            {!ready ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDistrict} margin={{ top: 4, right: 8, bottom: 30, left: -18 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="district" tick={{ ...CHART_AXIS, fontSize: 9 }} tickLine={false} axisLine={false} angle={-32} textAnchor="end" height={54} interval={0} />
                  <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="crop" name="Onion cases" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          icon={Download}
          title="Exportable reports"
          subtitle="CSV downloads immediately; PDF opens a letterheaded print view with a signature block"
          action={<Badge tone="slate">{trendRows.length} rows</Badge>}
        />
        <div className="flex flex-wrap gap-2 p-4">
          <Button variant="ghost" icon={Download} onClick={exportCsv}>
            Weekly trend (CSV)
          </Button>
          <Button variant="ghost" icon={Printer} onClick={exportPdf}>
            Weekly trend (PDF)
          </Button>
          <Button
            variant="ghost"
            icon={Download}
            onClick={() => {
              const columns = ['Reference', 'Diagnosis', 'Subject', 'Severity', 'AI %', 'Status', 'District', 'Taluka', 'Reported'];
              const rows: Row[] = cases.map((c) => [
                c.reference, c.diagnosis, c.subject, c.severity, c.aiConfidence, c.status, c.district, c.taluka,
                formatDateTime(c.reportedAt),
              ]);
              downloadCsv('case-register', columns, rows, reportMeta('Full Case Register'));
              if (officer) log(officer, 'REPORT_EXPORTED', 'Full Case Register', `CSV export of ${rows.length} case records.`);
            }}
          >
            Full case register (CSV)
          </Button>
        </div>
      </Panel>
    </div>
  );
}
