/**
 * types.ts
 * --------
 * The domain contract for the whole portal. Every mock generator, store
 * and component is typed against these shapes, so replacing the mock
 * layer with real API responses is a matter of making the API match
 * these interfaces — no component changes required.
 */

export type Role = 'STATE' | 'DIVISION' | 'DISTRICT' | 'TALUKA';

export interface Officer {
  id: string;
  name: string;
  designation: string;
  role: Role;
  /** Empty for STATE. Division name for DIVISION, district for DISTRICT/TALUKA. */
  division?: string;
  district?: string;
  taluka?: string;
  email: string;
  employeeCode: string;
  /** Mock IP recorded against every audited action. */
  ip: string;
  loginAt: string;
}

export interface Taluka {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
}

export interface District {
  id: string;
  name: string;
  division: string;
  lat: number;
  lng: number;
  talukas: Taluka[];
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export type Domain = 'CROP' | 'LIVESTOCK';

export type CaseStatus =
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'RESOLVED';

export interface CaseRecord {
  id: string;
  /** Human-facing reference, e.g. MH-PUN-2026-00412 */
  reference: string;
  domain: Domain;
  subject: string; // crop or animal
  diagnosis: string;
  pathogenType: string;
  severity: Severity;
  /** 0-100 model confidence. Below REVIEW_THRESHOLD it enters the review queue. */
  aiConfidence: number;
  status: CaseStatus;
  district: string;
  taluka: string;
  division: string;
  lat: number;
  lng: number;
  farmerName: string;
  farmerPhone: string;
  farmerId: string;
  /** Whether the farmer completed KYC sign-in with a verified photo. */
  farmerVerified: boolean;
  areaHa: number;
  reportedAt: string; // ISO
  channel: 'WhatsApp' | 'SMS' | 'Field App' | 'Helpline';
  imageSeed: string;
  /** Set once a human expert signs the case off. */
  reviewedBy?: string;
  reviewNote?: string;
  correctedDiagnosis?: string;
}

export interface Scout {
  id: string;
  name: string;
  institute: string;
  district: string;
  taluka: string;
  lat: number;
  lng: number;
  phone: string;
  available: boolean;
  /** Historic accuracy of this scout's ground verifications, 0-100. */
  accuracy: number;
  completedVisits: number;
  rating: number;
}

export type DispatchStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';

export interface Dispatch {
  id: string;
  caseId: string;
  caseReference: string;
  scoutId: string;
  scoutName: string;
  district: string;
  taluka: string;
  distanceKm: number;
  priority: 'ROUTINE' | 'URGENT' | 'IMMEDIATE';
  status: DispatchStatus;
  assignedAt: string;
  assignedBy: string;
  note?: string;
  outcome?: 'CONFIRMED' | 'DIFFERENT' | 'NOT_FOUND';
}

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  priority: 'EMERGENCY' | 'ADVISORY' | 'NOTICE';
  channels: Array<'SMS' | 'PUSH' | 'IVR' | 'WHATSAPP'>;
  languages: string[];
  targetType: 'DISTRICT' | 'TALUKA';
  targets: string[];
  audience: number;
  reach: number;
  sentAt: string;
  sentBy: string;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CASE_APPROVED'
  | 'CASE_MODIFIED'
  | 'CASE_REJECTED'
  | 'DISPATCH_ASSIGNED'
  | 'DISPATCH_UPDATED'
  | 'ALERT_BROADCAST'
  | 'REPORT_EXPORTED'
  | 'LAYER_TOGGLED'
  | 'MANUAL_OVERRIDE';

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  actorName: string;
  actorCode: string;
  actorRole: Role;
  ip: string;
  target: string;
  detail: string;
  severity: 'INFO' | 'NOTICE' | 'CRITICAL';
}

/** One cell of the nightly prediction engine's risk surface. */
export interface RiskCell {
  lat: number;
  lng: number;
  /** 0-1 normalised risk weight. */
  weight: number;
  district: string;
}

/**
 * Aggregated, district-level rollup of case data — the shape every
 * per-district summary (analytics tables, the impact page's "loss
 * prevented by district" chart, a future district drill-down) should
 * compute into and read from, rather than each screen building its own
 * ad-hoc Map/reduce over CaseRecord[]. See buildDistrictMetrics() in
 * lib/mockData.ts for the reference aggregation.
 */
export interface DistrictMetrics {
  district: string;
  division: string;
  totalCases: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  pendingReview: number;
  resolved: number;
  cropCases: number;
  livestockCases: number;
  /** Sum of CaseRecord.areaHa for this district (hectares for crop, head-count for livestock cases mixed in — see areaHa's own doc). */
  totalAreaHa: number;
  /** Mean of CaseRecord.aiConfidence across this district's cases, 0-100. Undefined when the district has zero cases (avoids a NaN from an empty-array average). */
  avgAiConfidence: number | undefined;
  estimatedLossPreventedInr: number;
}

export interface TrendPoint {
  label: string;
  /** ISO date of the bucket start. */
  date: string;
  cases: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  crop: number;
  livestock: number;
}

export interface Jurisdiction {
  districts: string[];
  label: string;
}
