'use client';

import React from 'react';
import { ScrollText, ShieldAlert, Download, Filter, Fingerprint, Clock, Lock } from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard } from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { can, ROLE_LABEL, scopeFor } from '@/lib/rbac';
import { formatDateTime, titleCase } from '@/lib/format';
import { downloadCsv, type Row } from '@/lib/exporters';
import { DEMO_NOW } from '@/lib/catalog';
import type { AuditEntry } from '@/lib/types';

/**
 * Security & Audit Log Viewer.
 *
 * Read-only by construction: there is no edit or delete path to the
 * audit array anywhere in the application. Officers with VIEW_AUDIT_ALL
 * see every actor; officers with VIEW_AUDIT_OWN see only their own
 * entries, which is the usual departmental arrangement — you can audit
 * yourself and be audited from above, but not audit your peers.
 *
 * In production this table is a read replica of an append-only store
 * (WORM bucket or hash-chained table); the UI should never be the
 * system of record for an audit trail.
 */

const ACTION_TONE: Record<string, 'red' | 'amber' | 'sky' | 'emerald' | 'violet' | 'slate'> = {
  MANUAL_OVERRIDE: 'red',
  CASE_MODIFIED: 'violet',
  CASE_REJECTED: 'amber',
  CASE_APPROVED: 'emerald',
  ALERT_BROADCAST: 'red',
  DISPATCH_ASSIGNED: 'sky',
  DISPATCH_UPDATED: 'sky',
  REPORT_EXPORTED: 'slate',
  LAYER_TOGGLED: 'slate',
  LOGIN: 'slate',
  LOGOUT: 'slate',
};

export default function AuditPage() {
  const officer = useSession((s) => s.officer);
  const audit = useOps((s) => s.audit);
  const log = useOps((s) => s.log);

  const [actionFilter, setActionFilter] = React.useState('ALL');
  const [severityFilter, setSeverityFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  const scope = scopeFor(officer);
  const seeAll = officer ? can(officer.role, 'VIEW_AUDIT_ALL') : false;

  const visible = React.useMemo(() => {
    let rows = audit;
    if (!seeAll && officer) rows = rows.filter((entry) => entry.actorCode === officer.employeeCode);
    if (actionFilter !== 'ALL') rows = rows.filter((entry) => entry.action === actionFilter);
    if (severityFilter !== 'ALL') rows = rows.filter((entry) => entry.severity === severityFilter);

    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((entry) =>
        `${entry.actorName} ${entry.actorCode} ${entry.target} ${entry.detail} ${entry.ip}`
          .toLowerCase()
          .includes(term),
      );
    }
    return rows;
  }, [audit, seeAll, officer, actionFilter, severityFilter, search]);

  const criticalCount = visible.filter((entry) => entry.severity === 'CRITICAL').length;
  const last24h = visible.filter((entry) => +new Date(entry.at) > DEMO_NOW - 86400000).length;
  const distinctActors = new Set(visible.map((entry) => entry.actorCode)).size;

  const actions = React.useMemo(() => [...new Set(audit.map((entry) => entry.action))].sort(), [audit]);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      render: (entry) => (
        <div>
          <p className="font-mono text-[11px] text-slate-700">{formatDateTime(entry.at)}</p>
          <p className="text-[9px] text-slate-500">IST (UTC+05:30)</p>
        </div>
      ),
      sortValue: (entry) => +new Date(entry.at),
    },
    {
      key: 'action',
      header: 'Action',
      render: (entry) => <Badge tone={ACTION_TONE[entry.action] ?? 'slate'}>{titleCase(entry.action)}</Badge>,
      sortValue: (entry) => entry.action,
    },
    {
      key: 'actor',
      header: 'Officer',
      render: (entry) => (
        <div>
          <p className="font-medium text-navy-900">{entry.actorName}</p>
          <p className="font-mono text-[10px] text-slate-500">
            {entry.actorCode} · {ROLE_LABEL[entry.actorRole]}
          </p>
        </div>
      ),
      sortValue: (entry) => entry.actorName,
    },
    {
      key: 'target',
      header: 'Target',
      render: (entry) => <span className="font-mono text-[11px] text-slate-500">{entry.target}</span>,
      sortValue: (entry) => entry.target,
      hideOnMobile: true,
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (entry) => (
        <span className="block max-w-md whitespace-normal text-[11px] leading-snug text-slate-500">
          {entry.detail}
        </span>
      ),
      className: 'whitespace-normal',
      hideOnMobile: true,
    },
    {
      key: 'ip',
      header: 'Source IP',
      render: (entry) => <span className="font-mono text-[11px] text-slate-500">{entry.ip}</span>,
      sortValue: (entry) => entry.ip,
      hideOnMobile: true,
    },
    {
      key: 'severity',
      header: 'Class',
      render: (entry) => (
        <Badge tone={entry.severity === 'CRITICAL' ? 'red' : entry.severity === 'NOTICE' ? 'amber' : 'slate'}>
          {entry.severity}
        </Badge>
      ),
      sortValue: (entry) => ({ CRITICAL: 3, NOTICE: 2, INFO: 1 })[entry.severity],
    },
  ];

  const exportLog = () => {
    const cols = ['Timestamp (IST)', 'Action', 'Officer', 'Employee code', 'Role', 'Target', 'Detail', 'Source IP', 'Class'];
    const rows: Row[] = visible.map((entry) => [
      formatDateTime(entry.at),
      entry.action,
      entry.actorName,
      entry.actorCode,
      entry.actorRole,
      entry.target,
      entry.detail,
      entry.ip,
      entry.severity,
    ]);
    downloadCsv('audit-log', cols, rows, {
      title: 'Security Audit Log',
      scope: seeAll ? scope.label : `Own actions only (${officer?.employeeCode})`,
      period: 'All retained entries',
      generatedBy: officer ? `${officer.name} (${officer.employeeCode})` : 'Unknown',
      generatedAt: formatDateTime(new Date(DEMO_NOW).toISOString()),
      summary: `${rows.length} entries exported; ${criticalCount} classified critical.`,
    });
    if (officer) log(officer, 'REPORT_EXPORTED', 'Security Audit Log', `Audit log exported (${rows.length} entries).`);
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Security &amp; Audit Log"
        subtitle="Every manual override, case sign-off, dispatch assignment, advisory broadcast and export — with officer identity, timestamp and source IP."
        action={
          <div className="flex items-center gap-2">
            <Badge tone={seeAll ? 'sky' : 'slate'}>
              <Lock size={10} /> {seeAll ? 'Full visibility' : 'Own actions only'}
            </Badge>
            <Button size="sm" variant="ghost" icon={Download} onClick={exportLog}>
              Export
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ScrollText} label="Entries visible" value={visible.length} sub={seeAll ? 'All officers in scope' : 'Filtered to your employee code'} tone="sky" />
        <StatCard icon={ShieldAlert} label="Critical actions" value={criticalCount} sub="Manual overrides and emergency broadcasts" tone="red" />
        <StatCard icon={Clock} label="Last 24 hours" value={last24h} sub="Activity in the current operational day" tone="amber" />
        <StatCard icon={Fingerprint} label="Distinct officers" value={distinctActors} sub="Acting in the visible window" tone="violet" />
      </div>

      <Panel>
        <PanelHeader icon={Filter} title="Filter the trail" subtitle="Narrow by action type, classification or free text" accent="sky" />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Action type</span>
            <select className="input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="ALL">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {titleCase(action)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Classification</span>
            <select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="ALL">All classifications</option>
              <option value="CRITICAL">Critical</option>
              <option value="NOTICE">Notice</option>
              <option value="INFO">Info</option>
            </select>
          </label>

          <label className="block">
            <span className="label">Search</span>
            <input
              className="input"
              placeholder="Officer, case reference, IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={ScrollText}
          title="Audit trail"
          subtitle="Append-only · sorted newest first · retained for seven years per departmental policy"
          action={<Badge tone="slate">{visible.length} entries</Badge>}
        />
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(entry) => entry.id}
          pageSize={12}
          initialSort={{ key: 'at', direction: 'desc' }}
          emptyTitle="No audit entries match these filters"
          emptyMessage="Clear the filters, or perform an action elsewhere in the console to generate an entry."
        />
      </Panel>

      <Panel>
        <div className="flex items-start gap-2.5 p-4">
          <Lock size={15} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            <strong className="text-slate-500">Integrity note.</strong> In this prototype the trail lives in
            browser memory and is seeded with representative history. A production deployment must write each
            entry to an append-only store — a WORM object bucket or a hash-chained table where every row carries
            the digest of its predecessor — so that tampering is detectable. The console must hold read-only
            credentials against that store; no application path may update or delete an entry.
          </p>
        </div>
      </Panel>
    </div>
  );
}
