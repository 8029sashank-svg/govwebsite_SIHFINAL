'use client';

import React from 'react';
import {
  ShieldQuestion, CheckCircle2, XCircle, PencilLine, UserCheck, UserX, MapPin,
  Calendar, Smartphone, AlertTriangle, ImageIcon, Gauge, Send,
} from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard, MetaChip, EmptyState, Meter } from '@/components/ui';
import { useScopedCases } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { PATHOGENS, REVIEW_THRESHOLD, SEVERITY_META, STATUS_META } from '@/lib/catalog';
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format';
import { can } from '@/lib/rbac';
import type { CaseRecord, Severity } from '@/lib/types';

/**
 * Case Review Queue — the AI governance surface.
 *
 * The rule this screen enforces: a diagnosis the model is not confident
 * about (below REVIEW_THRESHOLD) cannot drive an advisory, a dispatch or
 * a compensation claim until a named officer has signed it off. Approve,
 * modify and reject are the only three exits, and each one writes an
 * audit entry carrying the officer's employee code and IP.
 */
export default function ReviewPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const decideCase = useOps((s) => s.decideCase);

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const queue = React.useMemo(
    () => cases.filter((c) => c.status === 'PENDING_REVIEW').sort((a, b) => a.aiConfidence - b.aiConfidence),
    [cases],
  );

  const reviewedToday = React.useMemo(
    () => cases.filter((c) => c.reviewedBy && ['VERIFIED', 'REJECTED'].includes(c.status)),
    [cases],
  );

  const active = React.useMemo(
    () => queue.find((c) => c.id === activeId) ?? queue[0] ?? null,
    [queue, activeId],
  );

  const unverifiedSenders = queue.filter((c) => !c.farmerVerified).length;
  const allowed = officer ? can(officer.role, 'REVIEW_CASES') : false;

  if (!allowed) {
    return (
      <div className="p-4 lg:p-6">
        <PageHeading title="Case Review Queue" subtitle="AI diagnoses held for expert sign-off." />
        <Panel className="mt-5">
          <EmptyState
            icon={ShieldQuestion}
            title="Not available at your access level"
            message="Case sign-off is exercised at district level and above. Escalate to your District Superintending Agriculture Officer."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Case Review Queue"
        subtitle={`Diagnoses below ${REVIEW_THRESHOLD}% model confidence, held for human expert sign-off before they can influence any downstream action.`}
        action={
          <Badge tone="amber">
            <AlertTriangle size={10} /> {queue.length} awaiting decision
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={ShieldQuestion} label="In queue" value={queue.length} sub={`Confidence below ${REVIEW_THRESHOLD}%`} tone="amber" />
        <StatCard icon={CheckCircle2} label="Signed off" value={reviewedToday.length} sub="Decisions recorded in this session" tone="emerald" />
        <StatCard icon={UserX} label="Unverified senders" value={unverifiedSenders} sub="No KYC photo on record — verify identity first" tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.45fr]">
        <Panel className="overflow-hidden">
          <PanelHeader icon={ShieldQuestion} title="Queue" subtitle="Lowest confidence first" />
          {queue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Queue is clear"
              message="Every inbound diagnosis in your jurisdiction cleared the confidence threshold or has been signed off."
            />
          ) : (
            <ul className="max-h-[38rem] divide-y divide-slate-100 overflow-y-auto">
              {queue.map((record) => (
                <li key={record.id}>
                  <button
                    onClick={() => setActiveId(record.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active?.id === record.id ? 'bg-saffron-500/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <CaseThumb record={record} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-navy-900">{record.diagnosis}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {record.farmerName} · {record.taluka}, {record.district}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-slate-500">{record.reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-sm font-bold text-amber-700">{record.aiConfidence}%</span>
                      <p className="text-[9px] text-slate-500">{timeAgo(record.reportedAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {active ? (
          <ReviewDetail
            key={active.id}
            record={active}
            onDecide={(decision, payload) => {
              if (!officer) return;
              decideCase(active, decision, officer, payload);
              setActiveId(null);
            }}
          />
        ) : (
          <Panel>
            <EmptyState icon={CheckCircle2} title="Nothing to review" message="Select a case from the queue to inspect the submission." />
          </Panel>
        )}
      </div>

      {reviewedToday.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHeader icon={CheckCircle2} title="Recently signed off" subtitle="Decisions recorded in this session" accent="emerald" />
          <ul className="divide-y divide-slate-100">
            {reviewedToday.slice(0, 8).map((record) => (
              <li key={record.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="font-mono text-[10px] text-slate-500">{record.reference}</span>
                <span className="text-xs font-medium text-slate-700">{record.diagnosis}</span>
                <MetaChip label={STATUS_META[record.status].label} chip={STATUS_META[record.status].chip} />
                {record.correctedDiagnosis && <Badge tone="violet">Overridden</Badge>}
                <span className="ml-auto text-[10px] text-slate-500">{record.reviewedBy}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReviewDetail({
  record,
  onDecide,
}: {
  record: CaseRecord;
  onDecide: (
    decision: 'APPROVE' | 'MODIFY' | 'REJECT',
    payload: { note?: string; correctedDiagnosis?: string; severity?: Severity },
  ) => void;
}) {
  const [correction, setCorrection] = React.useState('');
  const [severity, setSeverity] = React.useState<Severity>(record.severity);
  const [note, setNote] = React.useState('');

  const alternatives = PATHOGENS.filter((p) => p.domain === record.domain && p.name !== record.diagnosis);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={ImageIcon}
        title="Submission dossier"
        subtitle="Full provenance — verify before signing off"
        accent="red"
        action={<span className="font-mono text-[10px] text-slate-500">{record.reference}</span>}
      />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-4">
          <CaseThumb record={record} size={150} className="ring-2 ring-slate-200" />

          <div className="min-w-[14rem] flex-1 space-y-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Model diagnosis</p>
              <p className="text-lg font-semibold text-navy-900">{record.diagnosis}</p>
              <p className="text-[11px] text-slate-500">
                {record.pathogenType} affecting {record.subject}
              </p>
            </div>

            <div>
              <Meter
                value={record.aiConfidence}
                color={record.aiConfidence >= REVIEW_THRESHOLD ? '#22c55e' : record.aiConfidence >= 55 ? '#eab308' : '#ef4444'}
                label={`AI confidence · auto-clear threshold ${REVIEW_THRESHOLD}%`}
              />
            </div>

            <dl className="grid grid-cols-2 gap-2 text-[11px]">
              <Meta icon={UserCheck} label="Farmer" value={record.farmerName} />
              <Meta icon={Smartphone} label="Contact" value={record.farmerPhone} />
              <Meta icon={MapPin} label="Location" value={`${record.taluka}, ${record.district}`} />
              <Meta icon={Calendar} label="Received" value={formatDateTime(record.reportedAt)} />
              <Meta
                icon={record.farmerVerified ? UserCheck : UserX}
                label="KYC sign-in photo"
                value={record.farmerVerified ? 'Verified on record' : 'Not verified'}
                tone={record.farmerVerified ? 'text-emerald-700' : 'text-red-700'}
              />
              <Meta
                icon={Gauge}
                label="Extent"
                value={`${formatNumber(record.areaHa)} ${record.domain === 'CROP' ? 'ha' : 'head'}`}
              />
            </dl>
          </div>
        </div>

        {!record.farmerVerified && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            This sender has no verified KYC photograph on file. Confirm identity through the Kisan helpline or a
            field visit before approving — an approved case can trigger compensation workflows.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Corrected diagnosis</span>
            <select className="input" value={correction} onChange={(e) => setCorrection(e.target.value)}>
              <option value="">Model diagnosis is correct</option>
              {alternatives.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="No pathogen present">No pathogen present — healthy</option>
            </select>
          </label>

          <div>
            <span className="label">Severity classification</span>
            <div className="flex gap-1.5">
              {(['HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setSeverity(value)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                    severity === value ? 'text-navy-950' : 'border border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                  style={severity === value ? { backgroundColor: SEVERITY_META[value].color } : undefined}
                >
                  {SEVERITY_META[value].label}
                </button>
              ))}
            </div>
            {severity !== record.severity && (
              <p className="mt-1 text-[10px] text-amber-700">
                Manual severity override — logged separately as a critical action.
              </p>
            )}
          </div>
        </div>

        <label className="block">
          <span className="label">Reviewer note</span>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Lesion pattern consistent with…, cross-checked against the taluka's last three confirmations…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="emerald"
            icon={CheckCircle2}
            onClick={() => onDecide('APPROVE', { note, severity })}
            disabled={Boolean(correction)}
          >
            Approve diagnosis
          </Button>
          <Button
            variant="primary"
            icon={PencilLine}
            disabled={!correction}
            onClick={() => onDecide('MODIFY', { note, correctedDiagnosis: correction, severity })}
          >
            Sign off as corrected
          </Button>
          <Button variant="ghost" icon={XCircle} onClick={() => onDecide('REJECT', { note })}>
            Reject submission
          </Button>
        </div>

        <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
          <Send size={11} className="mt-0.5 shrink-0" />
          Approving releases this case for dispatch and advisory workflows and records your employee code, IP
          address and timestamp in the audit log. Corrections are additionally queued as labelled training data
          for the next model revision.
        </p>
      </div>
    </Panel>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  tone = 'text-slate-700',
}: {
  icon: typeof UserCheck;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <dt className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
        <Icon size={10} /> {label}
      </dt>
      <dd className={`mt-0.5 truncate font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

/**
 * Deterministic synthetic sample image.
 *
 * The prototype ships no photographs of real farms or animals: the
 * thumbnail is generated from the case's seed so the UI can be evaluated
 * without using anybody's data. Swap for the signed S3/MinIO URL of the
 * farmer's upload in production.
 */
function CaseThumb({ record, size = 48, className = '' }: { record: CaseRecord; size?: number; className?: string }) {
  let h = 0;
  for (let i = 0; i < record.imageSeed.length; i++) h = (h * 31 + record.imageSeed.charCodeAt(i)) >>> 0;

  const crop = record.domain === 'CROP';
  const hue = crop ? 95 + (h % 40) : 22 + (h % 18);
  const spots = 3 + (h % 5);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, hsl(${hue} 42% 26%), hsl(${hue - 18} 50% 13%))`,
      }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {crop ? (
          <>
            <path d="M50 8 C78 24 88 58 50 94 C12 58 22 24 50 8 Z" fill={`hsl(${hue} 40% 33%)`} />
            <path d="M50 12 L50 90" stroke={`hsl(${hue} 28% 20%)`} strokeWidth="2" />
          </>
        ) : (
          <>
            <ellipse cx="50" cy="58" rx="30" ry="24" fill={`hsl(${hue} 30% 34%)`} />
            <circle cx="50" cy="32" r="16" fill={`hsl(${hue} 32% 38%)`} />
          </>
        )}
        {Array.from({ length: spots }).map((_, i) => {
          const s = (h >> (i * 3)) % 100;
          return (
            <circle
              key={i}
              cx={26 + (s % 48)}
              cy={24 + ((s * 7) % 56)}
              r={2 + (s % 5) * ((100 - record.aiConfidence) / 100)}
              fill={record.severity === 'HIGH' ? '#8a3a1e' : record.severity === 'MEDIUM' ? '#b9822c' : '#5f8f3a'}
              opacity="0.85"
            />
          );
        })}
      </svg>
      <span className="absolute bottom-0 right-0 bg-slate-900/70 px-1 font-mono text-[8px] text-white">
        {record.channel}
      </span>
    </div>
  );
}
