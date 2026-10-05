'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ShieldQuestion, IndianRupee, Map as MapIcon, ArrowRight,
  Send, Radio, TrendingUp, Layers,
} from 'lucide-react';
import { Panel, PanelHeader, StatCard, PageHeading, Badge, MetaChip, Meter } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { GisMap, LayerToggles, MapLegend, MapStats } from '@/components/map/GisMap';
import { RiskAtlas } from '@/components/risk3d';
import MapModeSwitch, { type MapMode } from '@/components/risk3d/ModeSwitch';
import { useRiskAtlas } from '@/store/useRiskAtlas';
import { geoKeyForConsoleDistrict } from '@/lib/districtRisk';
import { useScopedCases, useScopedScouts } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { scopeFor } from '@/lib/rbac';
import { REVIEW_THRESHOLD, SEVERITY_META, STATUS_META, DEMO_NOW } from '@/lib/catalog';
import { buildTrends, DISTRICT_RISK } from '@/lib/mockData';
import { estimateImpact, formatINR, formatNumber, timeAgo } from '@/lib/format';
import { useFilters } from '@/store/useFilters';
import type { CaseRecord } from '@/lib/types';

export default function DashboardPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const scouts = useScopedScouts();
  const dispatches = useOps((s) => s.dispatches);
  const showHeatmap = useFilters((s) => s.showHeatmap);

  const [mapMode, setMapMode] = React.useState<MapMode>('3d');
  const [pendingDistrict, setPendingDistrict] = React.useState<string | null>(null);
  const mapPanelRef = React.useRef<HTMLDivElement>(null);

  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    // Brief skeleton pass so the console does not flash fully-formed data
    // before the map chunk lands — matches the loading behaviour the rest
    // of the screens get for free from Suspense.
    const id = setTimeout(() => setReady(true), 260);
    return () => clearTimeout(id);
  }, []);

  const scope = scopeFor(officer);

  // Hotspot rows and the 2D map hand a district to the 3D atlas.
  const openDistrict = React.useCallback(
    (consoleDistrict: string) => {
      const key = geoKeyForConsoleDistrict(consoleDistrict);
      if (mapMode === '3d') useRiskAtlas.getState().select(key);
      else {
        setPendingDistrict(key);
        setMapMode('3d');
      }
      mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [mapMode],
  );

  const recent = React.useMemo(
    () => [...cases].sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt)).slice(0, 40),
    [cases],
  );

  const stats = React.useMemo(() => {
    const active = cases.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status));
    const high = cases.filter((c) => c.severity === 'HIGH').length;
    const pending = cases.filter((c) => c.status === 'PENDING_REVIEW').length;
    const lastWeek = cases.filter((c) => +new Date(c.reportedAt) > DEMO_NOW - 7 * 86400000).length;
    const priorWeek = cases.filter((c) => {
      const t = +new Date(c.reportedAt);
      return t > DEMO_NOW - 14 * 86400000 && t <= DEMO_NOW - 7 * 86400000;
    }).length;
    const delta = priorWeek ? Math.round(((lastWeek - priorWeek) / priorWeek) * 100) : 0;
    return { active: active.length, high, pending, lastWeek, delta };
  }, [cases]);

  const impact = React.useMemo(() => estimateImpact(cases), [cases]);

  const hotspots = React.useMemo(() => {
    const byDistrict = new Map<string, { district: string; total: number; high: number; risk: number }>();
    for (const record of cases) {
      const row = byDistrict.get(record.district) ?? {
        district: record.district,
        total: 0,
        high: 0,
        risk: DISTRICT_RISK[record.district] ?? 0,
      };
      row.total += 1;
      if (record.severity === 'HIGH') row.high += 1;
      byDistrict.set(record.district, row);
    }
    return [...byDistrict.values()].sort((a, b) => b.high - a.high || b.total - a.total).slice(0, 6);
  }, [cases]);

  const trend = React.useMemo(() => buildTrends(scope.districts, 8), [scope.districts]);

  const columns: Column<CaseRecord>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => <span className="font-mono text-[11px] text-slate-700">{r.reference}</span>,
      sortValue: (r) => r.reference,
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (r) => (
        <div>
          <p className="font-medium text-navy-900">{r.diagnosis}</p>
          <p className="text-[10px] text-slate-500">
            {r.subject} · {r.pathogenType}
          </p>
        </div>
      ),
      sortValue: (r) => r.diagnosis,
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => (
        <div>
          <p>{r.taluka}</p>
          <p className="text-[10px] text-slate-500">{r.district}</p>
        </div>
      ),
      sortValue: (r) => r.district,
      hideOnMobile: true,
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (r) => <MetaChip label={SEVERITY_META[r.severity].label} chip={SEVERITY_META[r.severity].chip} />,
      sortValue: (r) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 })[r.severity],
    },
    {
      key: 'confidence',
      header: 'AI',
      render: (r) => (
        <span className={r.aiConfidence < REVIEW_THRESHOLD ? 'font-mono text-amber-700' : 'font-mono text-slate-500'}>
          {r.aiConfidence}%
        </span>
      ),
      sortValue: (r) => r.aiConfidence,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <MetaChip label={STATUS_META[r.status].label} chip={STATUS_META[r.status].chip} />,
      sortValue: (r) => r.status,
      hideOnMobile: true,
    },
    {
      key: 'reported',
      header: 'Reported',
      render: (r) => <span className="text-[11px] text-slate-500">{timeAgo(r.reportedAt)}</span>,
      sortValue: (r) => +new Date(r.reportedAt),
    },
  ];

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Situation Overview"
        subtitle={`${scope.label} · live onion disease surveillance picture.`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone="emerald">
              <Activity size={10} /> Surveillance live
            </Badge>
            <Badge tone="sky">{scouts.length} scouts on roster</Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={!ready}
          icon={AlertTriangle}
          label="Active cases"
          value={formatNumber(stats.active)}
          sub={`${stats.high} classified high risk`}
          tone="red"
          trend={stats.delta}
        />
        <StatCard
          loading={!ready}
          icon={ShieldQuestion}
          label="Awaiting expert sign-off"
          value={formatNumber(stats.pending)}
          sub={`AI confidence below ${REVIEW_THRESHOLD}%`}
          tone="amber"
        />
        <StatCard
          loading={!ready}
          icon={Send}
          label="Field dispatches"
          value={formatNumber(dispatches.length)}
          sub={`${dispatches.filter((d) => d.status === 'RESOLVED').length} resolved this session`}
          tone="sky"
        />
        <StatCard
          loading={!ready}
          icon={IndianRupee}
          label="Loss prevented (est.)"
          value={formatINR(impact.prevented)}
          sub={`Across ${formatNumber(impact.caseCount)} actioned cases`}
          tone="emerald"
        />
      </div>

      <div ref={mapPanelRef} className="scroll-mt-4">
        <Panel className="overflow-hidden">
          <PanelHeader
            icon={MapIcon}
            title={mapMode === '3d' ? 'District risk atlas' : 'Regional case map'}
            subtitle={
              mapMode === '3d'
                ? 'Every Maharashtra district rated Low, Moderate or High — click one to fly in, then Inspect for its cases, pests and diseases'
                : 'Severity-coded farmer reports over the nightly prediction risk surface'
            }
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MapModeSwitch value={mapMode} onChange={(m) => { setPendingDistrict(null); setMapMode(m); }} />
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  Open GIS <ArrowRight size={13} />
                </Link>
              </div>
            }
          />
          {mapMode === '2d' && (
            <div className="border-b border-slate-200 px-4 py-2.5">
              <LayerToggles />
            </div>
          )}
          <div className="relative h-[34rem] lg:h-[42rem]">
            {mapMode === '3d' ? (
              <RiskAtlas
                cases={cases}
                officer={officer}
                periodControl
                initialDistrictKey={pendingDistrict}
                onUnsupported={() => setMapMode('2d')}
              />
            ) : (
              <>
                <GisMap cases={cases} scouts={scouts} officer={officer} windowDays={30} onInspectDistrict={openDistrict} />
                <MapStats total={cases.length} high={stats.high} pending={stats.pending} />
                <MapLegend heatmapOn={showHeatmap} />
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader
            icon={Layers}
            title="District hotspots"
            subtitle="Ranked by high-severity case load — click to open in the 3D atlas"
            accent="red"
          />
          <ul className="divide-y divide-slate-100">
            {hotspots.map((row, index) => (
              <li key={row.district}>
                <button
                  onClick={() => openDistrict(row.district)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="w-4 font-mono text-[11px] text-slate-500">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-navy-900">{row.district}</p>
                    <p className="text-[10px] text-slate-500">
                      {row.total} cases · {row.high} high severity
                    </p>
                    <div className="mt-1">
                      <Meter
                        value={row.risk}
                        color={row.risk >= 70 ? '#ef4444' : row.risk >= 45 ? '#f97316' : '#22c55e'}
                        showValue={false}
                        height="h-1"
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-xs font-bold text-slate-700">{row.risk}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-500">risk</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader icon={TrendingUp} title="8-week case trend" subtitle="Total reports per week" accent="violet" />
          <div className="flex items-end gap-1 px-4 py-4" style={{ height: 150 }}>
            {trend.map((point) => {
              const max = Math.max(...trend.map((t) => t.cases), 1);
              return (
                <div key={point.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-saffron-600/40 to-saffron-400 transition-all"
                    style={{ height: `${(point.cases / max) * 96}px` }}
                    title={`${point.label}: ${point.cases} cases`}
                  />
                  <span className="text-[8px] text-slate-500">{point.label.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-200 px-4 py-2">
            <Link href="/analytics" className="text-[11px] text-saffron-700 hover:underline">
              Full trend analytics →
            </Link>
          </div>
        </Panel>

        <Panel className="lg:col-span-2 xl:col-span-1">
          <PanelHeader icon={Radio} title="Quick actions" subtitle="Jump straight into an operation" accent="saffron" />
          <div className="grid gap-2 p-4">
            <Link href="/review" className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100">
              <span className="text-xs font-medium text-slate-700">Clear the review queue</span>
              <Badge tone="amber">{stats.pending}</Badge>
            </Link>
            <Link href="/dispatch" className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100">
              <span className="text-xs font-medium text-slate-700">Assign a field scout</span>
              <ArrowRight size={14} className="text-slate-500" />
            </Link>
            <Link href="/broadcast" className="flex items-center justify-between rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 transition-colors hover:bg-red-500/15">
              <span className="text-xs font-medium text-red-800">Compose emergency advisory</span>
              <Radio size={14} className="text-red-700" />
            </Link>
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={Activity}
          title="Recent case intake"
          subtitle="Newest farmer submissions in your jurisdiction — click a column header to sort"
          action={<Badge tone="slate">{cases.length} total in scope</Badge>}
        />
        <DataTable
          columns={columns}
          rows={recent}
          rowKey={(r) => r.id}
          pageSize={8}
          loading={!ready}
          initialSort={{ key: 'reported', direction: 'desc' }}
          emptyTitle="No cases in your jurisdiction"
        />
      </Panel>
    </div>
  );
}
