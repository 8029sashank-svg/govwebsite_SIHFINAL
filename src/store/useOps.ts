'use client';

import { create } from 'zustand';
import type {
  AuditAction,
  AuditEntry,
  Broadcast,
  CaseRecord,
  CaseStatus,
  Dispatch,
  DispatchStatus,
  Officer,
} from '@/lib/types';
import { CASES, SEED_AUDIT } from '@/lib/mockData';

/**
 * useOps.ts
 * ---------
 * Mutable operational state layered over the immutable mock case book.
 *
 * Rather than copying 420 case records into the store, decisions are held
 * as a sparse overlay keyed by case id and merged on read. That keeps
 * updates O(1), makes the "what did a human change?" set trivially
 * inspectable, and mirrors how a real backend would store a decision
 * table alongside the source records.
 *
 * Every mutating action writes an audit entry. That is deliberate: the
 * audit trail is not an afterthought bolted onto the UI, it is the only
 * way these actions are allowed to happen.
 */

export interface CaseOverride {
  status?: CaseStatus;
  reviewedBy?: string;
  reviewNote?: string;
  correctedDiagnosis?: string;
  severityOverride?: CaseRecord['severity'];
}

interface OpsState {
  overrides: Record<string, CaseOverride>;
  dispatches: Dispatch[];
  broadcasts: Broadcast[];
  audit: AuditEntry[];

  /** Merges overrides onto the base case book. */
  cases: () => CaseRecord[];
  getCase: (id: string) => CaseRecord | undefined;

  decideCase: (
    record: CaseRecord,
    decision: 'APPROVE' | 'MODIFY' | 'REJECT',
    officer: Officer,
    payload?: { note?: string; correctedDiagnosis?: string; severity?: CaseRecord['severity'] },
  ) => void;

  assignDispatch: (dispatch: Omit<Dispatch, 'id' | 'assignedAt' | 'status'>, officer: Officer) => void;
  updateDispatchStatus: (id: string, status: DispatchStatus, officer: Officer, outcome?: Dispatch['outcome']) => void;

  sendBroadcast: (broadcast: Omit<Broadcast, 'id' | 'sentAt' | 'sentBy'>, officer: Officer) => void;

  log: (
    officer: Officer,
    action: AuditAction,
    target: string,
    detail: string,
    severity?: AuditEntry['severity'],
  ) => void;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useOps = create<OpsState>((set, get) => ({
  overrides: {},
  dispatches: [],
  broadcasts: [],
  audit: SEED_AUDIT,

  cases: () => {
    const { overrides } = get();
    if (Object.keys(overrides).length === 0) return CASES;
    return CASES.map((record) => {
      const patch = overrides[record.id];
      if (!patch) return record;
      return {
        ...record,
        ...patch,
        severity: patch.severityOverride ?? record.severity,
        diagnosis: patch.correctedDiagnosis ?? record.diagnosis,
      };
    });
  },

  getCase: (id) => get().cases().find((c) => c.id === id),

  log: (officer, action, target, detail, severity = 'NOTICE') =>
    set((state) => ({
      audit: [
        {
          id: nextId('audit'),
          at: new Date().toISOString(),
          action,
          actorName: officer.name,
          actorCode: officer.employeeCode,
          actorRole: officer.role,
          ip: officer.ip,
          target,
          detail,
          severity,
        },
        ...state.audit,
      ],
    })),

  decideCase: (record, decision, officer, payload = {}) => {
    const status: CaseStatus =
      decision === 'APPROVE' ? 'VERIFIED' : decision === 'MODIFY' ? 'VERIFIED' : 'REJECTED';

    set((state) => ({
      overrides: {
        ...state.overrides,
        [record.id]: {
          status,
          reviewedBy: `${officer.name} (${officer.employeeCode})`,
          reviewNote: payload.note,
          correctedDiagnosis: decision === 'MODIFY' ? payload.correctedDiagnosis : undefined,
          severityOverride: payload.severity,
        },
      },
    }));

    const action: AuditAction =
      decision === 'APPROVE' ? 'CASE_APPROVED' : decision === 'MODIFY' ? 'CASE_MODIFIED' : 'CASE_REJECTED';

    const detail =
      decision === 'MODIFY'
        ? `AI diagnosis "${record.diagnosis}" (confidence ${record.aiConfidence}%) overridden to "${payload.correctedDiagnosis}".`
        : decision === 'APPROVE'
          ? `AI diagnosis "${record.diagnosis}" confirmed at ${record.aiConfidence}% confidence.`
          : `Submission rejected. ${payload.note || 'No reason recorded.'}`;

    get().log(officer, action, record.reference, detail, decision === 'MODIFY' ? 'CRITICAL' : 'NOTICE');

    // A severity override is a separate, individually auditable act.
    if (payload.severity && payload.severity !== record.severity) {
      get().log(
        officer,
        'MANUAL_OVERRIDE',
        record.reference,
        `Severity manually changed from ${record.severity} to ${payload.severity}.`,
        'CRITICAL',
      );
    }
  },

  assignDispatch: (dispatch, officer) => {
    const record: Dispatch = { ...dispatch, id: nextId('dsp'), assignedAt: new Date().toISOString(), status: 'ASSIGNED' };
    set((state) => ({ dispatches: [record, ...state.dispatches] }));

    // Assigning a scout moves the underlying case into the dispatched state.
    set((state) => ({
      overrides: {
        ...state.overrides,
        [dispatch.caseId]: { ...state.overrides[dispatch.caseId], status: 'DISPATCHED' },
      },
    }));

    get().log(
      officer,
      'DISPATCH_ASSIGNED',
      dispatch.caseReference,
      `${dispatch.scoutName} assigned to ${dispatch.taluka}, ${dispatch.district} (${dispatch.distanceKm} km, ${dispatch.priority}).`,
    );
  },

  updateDispatchStatus: (id, status, officer, outcome) => {
    const target = get().dispatches.find((d) => d.id === id);
    set((state) => ({
      dispatches: state.dispatches.map((d) => (d.id === id ? { ...d, status, outcome: outcome ?? d.outcome } : d)),
    }));

    if (target) {
      const caseStatus: CaseStatus =
        status === 'RESOLVED' ? 'RESOLVED' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'DISPATCHED';
      set((state) => ({
        overrides: {
          ...state.overrides,
          [target.caseId]: { ...state.overrides[target.caseId], status: caseStatus },
        },
      }));

      get().log(
        officer,
        'DISPATCH_UPDATED',
        target.caseReference,
        `Dispatch moved to ${status}${outcome ? ` with outcome ${outcome}` : ''}.`,
      );
    }
  },

  sendBroadcast: (broadcast, officer) => {
    const record: Broadcast = {
      ...broadcast,
      id: nextId('bc'),
      sentAt: new Date().toISOString(),
      sentBy: `${officer.name} (${officer.employeeCode})`,
    };
    set((state) => ({ broadcasts: [record, ...state.broadcasts] }));

    get().log(
      officer,
      'ALERT_BROADCAST',
      broadcast.targets.join(', '),
      `${broadcast.priority} advisory "${broadcast.title}" sent to ~${broadcast.reach.toLocaleString('en-IN')} recipients via ${broadcast.channels.join('/')}.`,
      broadcast.priority === 'EMERGENCY' ? 'CRITICAL' : 'NOTICE',
    );
  },
}));
