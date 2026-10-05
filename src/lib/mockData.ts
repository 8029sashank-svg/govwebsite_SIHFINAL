import type {
  AuditEntry,
  CaseRecord,
  CaseStatus,
  DistrictMetrics,
  Domain,
  RiskCell,
  Scout,
  Severity,
  TrendPoint,
} from './types';
import { ALL_TALUKAS, DISTRICTS, divisionOf } from './geography';
import { DEMO_NOW, PATHOGENS, REVIEW_THRESHOLD } from './catalog';
import { hash01, hashBool, hashFloat, hashInt, hashPick } from './rng';
import { DEFAULT_ASSUMPTIONS, estimateImpact, type ImpactAssumptions } from './format';

/**
 * mockData.ts
 * -----------
 * Generates the entire demo dataset deterministically at module scope, so
 * the server and the client always agree and the figures never shift
 * between reloads.
 *
 * REPLACING THIS LAYER: each exported constant corresponds to one API
 * resource — CASES → GET /api/cases, SCOUTS → GET /api/scouts,
 * RISK_SURFACE → GET /api/predictions/nightly, TRENDS → GET
 * /api/analytics/trends. Make those endpoints return the same shapes from
 * `types.ts` and nothing else in the application needs to change.
 */

const FARMER_NAMES = [
  'Ramesh Patil', 'Sunita Jadhav', 'Anil Deshmukh', 'Kavita More', 'Sachin Pawar',
  'Mangal Shinde', 'Vikas Bhosale', 'Rekha Kale', 'Dattatray Gaikwad', 'Nilima Chavan',
  'Prakash Sawant', 'Asha Thorat', 'Ganesh Jagtap', 'Shobha Nikam', 'Balu Kadam',
  'Sharad Ingle', 'Vaishali Mane', 'Popat Shelke', 'Anita Raut', 'Madhukar Waghmare',
];

const SCOUT_NAMES = [
  'Aditi Kulkarni', 'Rohan Shelke', 'Pooja Mane', 'Sameer Wagh', 'Nikhil Raut',
  'Snehal Bhoir', 'Omkar Dhumal', 'Tejas Kamble', 'Isha Salunkhe', 'Harshada Pandit',
  'Yash Sonawane', 'Ketaki Rane', 'Abhay Surve', 'Manasi Borse', 'Kunal Darekar',
  'Shruti Ingle', 'Pratik Ghule', 'Vaishnavi Lokhande', 'Amol Bhagat', 'Rutuja Khot',
  'Siddharth Nene', 'Payal Gade', 'Nachiket Joshi', 'Mrunal Tayde',
];

const INSTITUTES = [
  'MPKV, Rahuri',
  'Dr. PDKV, Akola',
  'VNMKV, Parbhani',
  'DBSKKV, Dapoli',
  'College of Agriculture, Pune',
  'MAFSU, Nagpur',
];

const CHANNELS = ['WhatsApp', 'SMS', 'Field App', 'Helpline'] as const;

const DISTRICT_ABBR = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

function severityFor(seed: string): Severity {
  const roll = hash01(seed);
  if (roll > 0.74) return 'HIGH';
  if (roll > 0.42) return 'MEDIUM';
  return 'LOW';
}

function statusFor(seed: string, confidence: number): CaseStatus {
  if (confidence < REVIEW_THRESHOLD) {
    // Low-confidence cases sit in the governance queue until signed off.
    return hashBool(`${seed}-held`, 0.82) ? 'PENDING_REVIEW' : 'REJECTED';
  }
  const roll = hash01(`${seed}-status`);
  if (roll > 0.82) return 'RESOLVED';
  if (roll > 0.68) return 'IN_PROGRESS';
  if (roll > 0.5) return 'DISPATCHED';
  return 'VERIFIED';
}

const CASE_COUNT = 150;

/** Surveillance focus of this build: Dindori taluka, Nashik district. */
const FOCUS_DISTRICT = 'Nashik';
const FOCUS_TALUKA = 'Dindori';
const DINDORI = ALL_TALUKAS.find((t) => t.district === FOCUS_DISTRICT && t.name === FOCUS_TALUKA)!;
const NASHIK_TALUKAS = ALL_TALUKAS.filter((t) => t.district === FOCUS_DISTRICT);

/** The full case book — every farmer-reported onion case, all in Dindori taluka. */
export const CASES: CaseRecord[] = Array.from({ length: CASE_COUNT }, (_, i) => {
  const seed = `case-${i}`;
  const taluka = DINDORI;
  // Onion-only build: every case is a crop case.
  const domain: Domain = 'CROP';

  const pool = PATHOGENS.filter((p) => p.domain === domain);
  const pathogen = hashPick(`${seed}-path`, pool);
  const subject = hashPick(`${seed}-subj`, pathogen.subjects);

  const severity = severityFor(`${seed}-sev`);
  const aiConfidence = hashInt(`${seed}-conf`, 38, 99);
  const status = statusFor(seed, aiConfidence);
  const daysAgo = hashFloat(`${seed}-age`, 0, 84, 3);

  return {
    id: seed,
    reference: `MH-${DISTRICT_ABBR(taluka.district)}-2026-${String(10000 + i).slice(1)}`,
    domain,
    subject,
    diagnosis: pathogen.name,
    pathogenType: pathogen.type,
    severity,
    aiConfidence,
    status,
    district: taluka.district,
    taluka: taluka.name,
    division: divisionOf(taluka.district),
    // Scatter the pin inside the taluka rather than on its exact centroid.
    lat: Number((taluka.lat + (hash01(`${seed}-plat`) - 0.5) * 0.26).toFixed(5)),
    lng: Number((taluka.lng + (hash01(`${seed}-plng`) - 0.5) * 0.26).toFixed(5)),
    farmerName: FARMER_NAMES[i % FARMER_NAMES.length],
    farmerPhone: `+91 9${hashInt(`${seed}-ph`, 100000000, 999999999)}`,
    farmerId: `MHFID${hashInt(`${seed}-fid`, 1000000, 9999999)}`,
    farmerVerified: hashBool(`${seed}-kyc`, 0.72),
    areaHa: domain === 'CROP' ? hashFloat(`${seed}-area`, 0.4, 18, 1) : hashInt(`${seed}-head`, 1, 60),
    reportedAt: new Date(DEMO_NOW - daysAgo * 86400000).toISOString(),
    channel: hashPick(`${seed}-chan`, CHANNELS),
    imageSeed: `${taluka.district}-${pathogen.id}-${i}`,
  };
});

/** Cases held for human expert sign-off, lowest confidence first. */
export const REVIEW_QUEUE: CaseRecord[] = CASES.filter((c) => c.status === 'PENDING_REVIEW').sort(
  (a, b) => a.aiConfidence - b.aiConfidence,
);

/** Field scouts (agriculture students) available for dispatch. */
export const SCOUTS: Scout[] = SCOUT_NAMES.flatMap((name, i) => {
  const seed = `scout-${i}`;
  // Two postings per name across different talukas widens coverage without
  // inventing more names than a real roster would hold.
  return [0, 1].map((k) => {
    const s = `${seed}-${k}`;
    // Scouts are posted in Nashik district, most of them in Dindori itself.
    const taluka = hashBool(`${s}-tal`, 0.65) ? DINDORI : NASHIK_TALUKAS[Math.floor(hash01(`${s}-tal2`) * NASHIK_TALUKAS.length)];
    return {
      id: `${s}`,
      name: k === 0 ? name : `${name.split(' ')[0]} ${name.split(' ')[1]}`,
      institute: INSTITUTES[(i + k) % INSTITUTES.length],
      district: taluka.district,
      taluka: taluka.name,
      lat: Number((taluka.lat + (hash01(`${s}-lat`) - 0.5) * 0.12).toFixed(5)),
      lng: Number((taluka.lng + (hash01(`${s}-lng`) - 0.5) * 0.12).toFixed(5)),
      phone: `+91 8${hashInt(`${s}-ph`, 100000000, 999999999)}`,
      available: hashBool(`${s}-av`, 0.68),
      accuracy: hashInt(`${s}-acc`, 71, 98),
      completedVisits: hashInt(`${s}-vis`, 3, 96),
      rating: hashFloat(`${s}-rat`, 3.3, 5, 1),
    } satisfies Scout;
  });
});

/**
 * Nightly Prediction Engine output.
 *
 * In production this is written by the overnight batch job that combines
 * IMD weather, soil moisture, satellite NDVI and the last 14 days of
 * confirmed cases into a risk surface. Here it is derived from case
 * density plus a deterministic environmental term, which produces a
 * realistic surface that still correlates with the visible pins.
 */
export const RISK_SURFACE: RiskCell[] = (() => {
  const cells: RiskCell[] = [];

  for (const district of DISTRICTS) {
    // Onion-only build: the prediction surface exists only where there is data (Dindori, Nashik).
    if (district.name !== FOCUS_DISTRICT) continue;
    const districtCases = CASES.filter((c) => c.district === district.name);
    const density = Math.min(1, districtCases.length / 60);
    const environmental = hash01(`risk-${district.name}`);

    // 6 cells per district, jittered around the centroid, so the rendered
    // gradient reads as a surface rather than a ring of dots.
    for (let i = 0; i < 6; i++) {
      const weight = Math.min(1, density * 0.65 + environmental * 0.35 + (hash01(`risk-${district.name}-${i}`) - 0.5) * 0.24);
      cells.push({
        lat: Number((DINDORI.lat + (hash01(`rc-${district.name}-${i}-lat`) - 0.5) * 0.3).toFixed(4)),
        lng: Number((DINDORI.lng + (hash01(`rc-${district.name}-${i}-lng`) - 0.5) * 0.3).toFixed(4)),
        weight: Number(Math.max(0.05, weight).toFixed(3)),
        district: district.name,
      });
    }
  }

  return cells;
})();

/** Per-district risk score (0-100) used by tables and the impact model. */
export const DISTRICT_RISK: Record<string, number> = Object.fromEntries(
  DISTRICTS.map((d) => {
    const cells = RISK_SURFACE.filter((c) => c.district === d.name);
    const avg = cells.reduce((s, c) => s + c.weight, 0) / (cells.length || 1);
    return [d.name, Math.round(avg * 100)];
  }),
);

/**
 * Aggregates the case book into weekly buckets for the trend charts.
 * Scoped to a district list so district/taluka officials see their own
 * history rather than the state's.
 */
export function buildTrends(districts: string[] | null, weeks = 12): TrendPoint[] {
  const scoped = districts ? CASES.filter((c) => districts.includes(c.district)) : CASES;

  return Array.from({ length: weeks }, (_, idx) => {
    const weeksAgo = weeks - 1 - idx;
    const end = DEMO_NOW - weeksAgo * 7 * 86400000;
    const start = end - 7 * 86400000;

    const bucket = scoped.filter((c) => {
      const t = new Date(c.reportedAt).getTime();
      return t >= start && t < end;
    });

    return {
      label: new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: new Date(start).toISOString(),
      cases: bucket.length,
      high: bucket.filter((c) => c.severity === 'HIGH').length,
      medium: bucket.filter((c) => c.severity === 'MEDIUM').length,
      low: bucket.filter((c) => c.severity === 'LOW').length,
      resolved: bucket.filter((c) => c.status === 'RESOLVED').length,
      crop: bucket.filter((c) => c.domain === 'CROP').length,
      livestock: bucket.filter((c) => c.domain === 'LIVESTOCK').length,
    } satisfies TrendPoint;
  });
}

/**
 * Rolls a case list up into one DistrictMetrics row per district present
 * in `districts` (or every district the case list touches, when
 * `districts` is null) — the reusable aggregation the analytics/impact
 * pages' ad-hoc `Map`-based per-district totals can be replaced with.
 * Reuses estimateImpact() for the ₹ figure rather than a second, separate
 * loss formula, so a DistrictMetrics row and the Impact Estimator page
 * agree on what "loss prevented" means for the same case set.
 */
export function buildDistrictMetrics(
  cases: CaseRecord[],
  districts: string[] | null,
  assumptions: ImpactAssumptions = DEFAULT_ASSUMPTIONS,
): DistrictMetrics[] {
  const targetDistricts = districts ?? [...new Set(cases.map((c) => c.district))];

  return targetDistricts.map((district) => {
    const rows = cases.filter((c) => c.district === district);
    const division = rows[0]?.division ?? divisionOf(district);
    const { prevented } = estimateImpact(rows, assumptions);

    return {
      district,
      division,
      totalCases: rows.length,
      highSeverity: rows.filter((c) => c.severity === 'HIGH').length,
      mediumSeverity: rows.filter((c) => c.severity === 'MEDIUM').length,
      lowSeverity: rows.filter((c) => c.severity === 'LOW').length,
      pendingReview: rows.filter((c) => c.status === 'PENDING_REVIEW').length,
      resolved: rows.filter((c) => c.status === 'RESOLVED').length,
      cropCases: rows.filter((c) => c.domain === 'CROP').length,
      livestockCases: rows.filter((c) => c.domain === 'LIVESTOCK').length,
      totalAreaHa: Math.round(rows.reduce((sum, c) => sum + c.areaHa, 0) * 10) / 10,
      avgAiConfidence:
        rows.length === 0 ? undefined : Math.round(rows.reduce((sum, c) => sum + c.aiConfidence, 0) / rows.length),
      estimatedLossPreventedInr: Math.round(prevented),
    } satisfies DistrictMetrics;
  });
}

/** Pre-existing audit history, so the log is not empty on first login. */
export const SEED_AUDIT: AuditEntry[] = Array.from({ length: 18 }, (_, i) => {
  const seed = `audit-${i}`;
  const actions = [
    'CASE_APPROVED', 'CASE_MODIFIED', 'DISPATCH_ASSIGNED', 'ALERT_BROADCAST',
    'REPORT_EXPORTED', 'LOGIN', 'MANUAL_OVERRIDE', 'CASE_REJECTED',
  ] as const;
  const action = hashPick(`${seed}-act`, actions);
  const district = 'Dindori, Nashik';
  const officers = [
    { name: 'S. R. Kulkarni', code: 'MH-AGRI-S001', role: 'STATE' as const },
    { name: 'A. D. Patil', code: 'MH-AGRI-DV002', role: 'DIVISION' as const },
    { name: 'V. K. Shinde', code: 'MH-AGRI-DT014', role: 'DISTRICT' as const },
    { name: 'P. M. Jadhav', code: 'MH-AGRI-TL087', role: 'TALUKA' as const },
  ];
  const officer = hashPick(`${seed}-off`, officers);

  const detail: Record<string, string> = {
    CASE_APPROVED: `Confirmed AI diagnosis and released advisory for ${district}.`,
    CASE_MODIFIED: `Overrode AI diagnosis after field photographs were re-examined.`,
    CASE_REJECTED: `Rejected submission — image unusable, farmer asked to resubmit.`,
    DISPATCH_ASSIGNED: `Assigned field verification visit in ${district}.`,
    ALERT_BROADCAST: `Issued advisory to registered farmers in ${district}.`,
    REPORT_EXPORTED: `Exported weekly outbreak report (CSV) for ${district}.`,
    LOGIN: `Authenticated via departmental SSO.`,
    MANUAL_OVERRIDE: `Manually escalated case severity above model recommendation.`,
  };

  return {
    id: seed,
    at: new Date(DEMO_NOW - hashFloat(`${seed}-age`, 0.2, 168, 3) * 3600000).toISOString(),
    action,
    actorName: officer.name,
    actorCode: officer.code,
    actorRole: officer.role,
    ip: `10.${hashInt(`${seed}-ip1`, 12, 240)}.${hashInt(`${seed}-ip2`, 0, 255)}.${hashInt(`${seed}-ip3`, 2, 254)}`,
    target: hashPick(`${seed}-tgt`, CASES).reference,
    detail: detail[action] ?? '—',
    severity: action === 'MANUAL_OVERRIDE' ? 'CRITICAL' : action === 'LOGIN' ? 'INFO' : 'NOTICE',
  } satisfies AuditEntry;
}).sort((a, b) => +new Date(b.at) - +new Date(a.at));

/** Registered-farmer base per district, used to size broadcast audiences. */
export const FARMER_BASE: Record<string, number> = Object.fromEntries(
  DISTRICTS.map((d) => [d.name, hashInt(`farmers-${d.name}`, 8400, 186000)]),
);
