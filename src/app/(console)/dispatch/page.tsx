'use client';

import React from 'react';
import {
  Send, Navigation, Star, Phone, GraduationCap, CheckCircle2, Clock, MapPin,
  CircleSlash, ListChecks, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard, MetaChip, EmptyState, Meter } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { useScopedCases, useScopedScouts } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { distanceKm } from '@/lib/geography';
import { SEVERITY_META, STATUS_META } from '@/lib/catalog';
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format';
import type { CaseRecord, Dispatch, DispatchStatus, Scout } from '@/lib/types';

/**
 * Field Dispatch Operations.
 *
 * Ranking is explicit and shown to the operator: availability first,
 * then great-circle distance, then historic verification accuracy. An
 * officer who wants to override the ranking can — but they can see what
 * they are overriding, which is the point.
 */

const STATUS_FLOW: DispatchStatus[] = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export default function DispatchPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const scouts = useScopedScouts();
  const { dispatches, assignDispatch, updateDispatchStatus } = useOps();

  const [selectedCase, setSelectedCase] = React.useState<CaseRecord | null>(null);
  const [selectedScout, setSelectedScout] = React.useState<Scout | null>(null);
  const [priority, setPriority] = React.useState<Dispatch['priority']>('URGENT');
  const [note, setNote] = React.useState('');

  // Dispatchable = verified or awaiting verification, not already closed.
  const dispatchable = React.useMemo(
    () =>
      cases
        .filter((c) => ['VERIFIED', 'PENDING_REVIEW', 'DISPATCHED'].includes(c.status))
        .sort((a, b) => {
          const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
          return rank[b.severity] - rank[a.severity] || +new Date(b.reportedAt) - +new Date(a.reportedAt);
        }),
    [cases],
  );

  const ranked = React.useMemo(() => {
    if (!selectedCase) {
      return [...scouts].sort((a, b) => Number(b.available) - Number(a.available) || b.accuracy - a.accuracy).slice(0, 10);
    }
    return [...scouts]
      .map((scout) => ({
        ...scout,
        distance: distanceKm(selectedCase.lat, selectedCase.lng, scout.lat, scout.lng),
      }))
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) || a.distance - b.distance || b.accuracy - a.accuracy,
      )
      .slice(0, 10);
  }, [scouts, selectedCase]);

  const assign = () => {
    if (!officer || !selectedCase || !selectedScout) return;
    const distance = distanceKm(selectedCase.lat, selectedCase.lng, selectedScout.lat, selectedScout.lng);

    assignDispatch(
      {
        caseId: selectedCase.id,
        caseReference: selectedCase.reference,
        scoutId: selectedScout.id,
        scoutName: selectedScout.name,
        district: selectedCase.district,
        taluka: selectedCase.taluka,
        distanceKm: distance,
        priority,
        assignedBy: `${officer.name} (${officer.employeeCode})`,
        note:
          note ||
          `Verify suspected ${selectedCase.diagnosis} on ${selectedCase.subject} reported by ${selectedCase.farmerName} (${selectedCase.farmerPhone}). Model confidence ${selectedCase.aiConfidence}%.`,
      },
      officer,
    );

    setSelectedCase(null);
    setSelectedScout(null);
    setNote('');
  };

  const caseColumns: Column<CaseRecord>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => <span className="font-mono text-[11px]">{r.reference}</span>,
      sortValue: (r) => r.reference,
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (r) => (
        <div>
          <p className="font-medium text-navy-900">{r.diagnosis}</p>
          <p className="text-[10px] text-slate-500">{r.subject}</p>
        </div>
      ),
      sortValue: (r) => r.diagnosis,
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => `${r.taluka}, ${r.district}`,
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
      key: 'status',
      header: 'Status',
      render: (r) => <MetaChip label={STATUS_META[r.status].label} chip={STATUS_META[r.status].chip} />,
      sortValue: (r) => r.status,
      hideOnMobile: true,
    },
    {
      key: 'age',
      header: 'Reported',
      render: (r) => <span className="text-[11px] text-slate-500">{timeAgo(r.reportedAt)}</span>,
      sortValue: (r) => +new Date(r.reportedAt),
    },
  ];

  const counts = STATUS_FLOW.reduce<Record<string, number>>((acc, status) => {
    acc[status] = dispatches.filter((d) => d.status === status).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Field Dispatch Operations"
        subtitle="Assign a verified or pending case to the nearest available field scout and track it through to resolution."
        action={<Badge tone="sky">{scouts.filter((s) => s.available).length} scouts available now</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_FLOW.map((status, index) => (
          <StatCard
            key={status}
            icon={[AlertTriangle, Send, Navigation, CheckCircle2][index]}
            label={status.replace('_', ' ').toLowerCase()}
            value={counts[status] ?? 0}
            sub={
              ['Cases raised but not yet assigned', 'Scout notified, travel pending', 'Scout on site', 'Ground truth filed'][
                index
              ]
            }
            tone={(['amber', 'sky', 'violet', 'emerald'] as const)[index]}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            icon={ListChecks}
            title="Dispatchable cases"
            subtitle="Select a case to rank scouts by proximity to its coordinates"
            action={<Badge tone="slate">{dispatchable.length}</Badge>}
          />
          <DataTable
            columns={caseColumns}
            rows={dispatchable}
            rowKey={(r) => r.id}
            pageSize={7}
            onRowClick={(r) => {
              setSelectedCase(r);
              setSelectedScout(null);
            }}
            activeKey={selectedCase?.id}
            initialSort={{ key: 'severity', direction: 'desc' }}
            emptyTitle="No dispatchable cases"
            emptyMessage="Cases become dispatchable once they are verified or are awaiting ground confirmation."
          />
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader
              icon={Navigation}
              title="Nearest available scouts"
              subtitle={
                selectedCase
                  ? `Ranked against ${selectedCase.taluka}, ${selectedCase.district}`
                  : 'Select a case to rank by distance'
              }
              accent="sky"
            />
            <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              {ranked.map((scout) => {
                const distance = 'distance' in scout ? (scout as Scout & { distance: number }).distance : null;
                return (
                  <li key={scout.id}>
                    <button
                      onClick={() => scout.available && setSelectedScout(scout)}
                      disabled={!scout.available}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedScout?.id === scout.id
                          ? 'bg-sky-500/10'
                          : scout.available
                            ? 'hover:bg-slate-50'
                            : 'opacity-45'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[10px] font-bold text-sky-700">
                        {scout.name.split(' ').map((p) => p[0]).join('')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-navy-900">
                          {scout.name}
                          {!scout.available && (
                            <Badge tone="slate">
                              <CircleSlash size={8} /> busy
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          <GraduationCap size={9} className="mr-0.5 inline" />
                          {scout.institute}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={9} /> {scout.taluka}
                          </span>
                          {distance !== null && (
                            <span className="flex items-center gap-0.5 text-sky-700">
                              <Navigation size={9} /> {distance} km
                            </span>
                          )}
                          <span className="flex items-center gap-0.5 text-amber-700">
                            <Star size={9} /> {scout.rating}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-bold text-emerald-700">{scout.accuracy}%</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">accuracy</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader icon={Send} title="Dispatch approval" subtitle="Confirm the assignment" accent="saffron" />
            <div className="space-y-3 p-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Case</p>
                {selectedCase ? (
                  <>
                    <p className="mt-0.5 text-xs font-semibold text-navy-900">{selectedCase.diagnosis}</p>
                    <p className="text-[10px] text-slate-500">
                      {selectedCase.reference} · {selectedCase.taluka}, {selectedCase.district}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">Select a case from the table</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Scout</p>
                {selectedScout ? (
                  <>
                    <p className="mt-0.5 text-xs font-semibold text-navy-900">{selectedScout.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {selectedScout.institute} · {selectedScout.phone}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">Select an available scout</p>
                )}
              </div>

              <div>
                <span className="label">Priority</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ROUTINE', 'URGENT', 'IMMEDIATE'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setPriority(value)}
                      className={`rounded-lg px-2 py-2 text-[10px] font-semibold uppercase transition-colors ${
                        priority === value
                          ? value === 'IMMEDIATE'
                            ? 'bg-red-600 text-white'
                            : 'bg-saffron-500 text-navy-950'
                          : 'border border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="label">Instructions to scout</span>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Auto-generated from the case if left blank…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>

              <Button className="w-full" icon={Send} disabled={!selectedCase || !selectedScout} onClick={assign}>
                Approve &amp; dispatch
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={Clock}
          title="Dispatch status tracker"
          subtitle="Pending → Assigned → In Progress → Resolved"
          accent="violet"
        />
        {dispatches.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No dispatches raised yet"
            message="Assignments you approve appear here and on the scout's mobile app in real time."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {dispatches.map((dispatch) => (
              <li key={dispatch.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500">{dispatch.caseReference}</span>
                      <p className="text-xs font-semibold text-navy-900">{dispatch.scoutName}</p>
                      <Badge tone={dispatch.priority === 'IMMEDIATE' ? 'red' : dispatch.priority === 'URGENT' ? 'orange' : 'slate'}>
                        {dispatch.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{dispatch.note}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={9} /> {dispatch.taluka}, {dispatch.district}
                      </span>
                      <span className="flex items-center gap-1">
                        <Navigation size={9} /> {dispatch.distanceKm} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={9} /> {formatDateTime(dispatch.assignedAt)}
                      </span>
                      <span>by {dispatch.assignedBy}</span>
                    </p>
                  </div>

                  <StatusStepper
                    dispatch={dispatch}
                    onAdvance={(status, outcome) => officer && updateDispatchStatus(dispatch.id, status, officer, outcome)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function StatusStepper({
  dispatch,
  onAdvance,
}: {
  dispatch: Dispatch;
  onAdvance: (status: DispatchStatus, outcome?: Dispatch['outcome']) => void;
}) {
  const currentIndex = STATUS_FLOW.indexOf(dispatch.status);

  return (
    <div className="w-full max-w-xs shrink-0">
      <div className="flex items-center gap-1">
        {STATUS_FLOW.map((status, index) => (
          <React.Fragment key={status}>
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= currentIndex ? 'bg-emerald-500' : 'bg-slate-100'
              }`}
              title={status}
            />
          </React.Fragment>
        ))}
      </div>
      <p className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-emerald-700">{dispatch.status.replace('_', ' ')}</span>
        {dispatch.outcome && <Badge tone={dispatch.outcome === 'CONFIRMED' ? 'emerald' : 'amber'}>{dispatch.outcome}</Badge>}
      </p>

      {dispatch.status !== 'RESOLVED' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dispatch.status === 'ASSIGNED' && (
            <Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => onAdvance('IN_PROGRESS')}>
              Mark on site
            </Button>
          )}
          {dispatch.status === 'IN_PROGRESS' && (
            <>
              <Button size="sm" variant="emerald" onClick={() => onAdvance('RESOLVED', 'CONFIRMED')}>
                Confirmed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onAdvance('RESOLVED', 'NOT_FOUND')}>
                Not found
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
