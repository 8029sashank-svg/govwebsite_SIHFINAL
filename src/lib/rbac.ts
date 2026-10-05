import type { CaseRecord, Jurisdiction, Officer, Role } from './types';
import { DISTRICT_NAMES, districtsInDivision, divisionOf, getDistrict } from './geography';

/**
 * rbac.ts
 * -------
 * Role-based access control.
 *
 * The employee code carries the role: the prefix after MH-AGRI- selects
 * STATE (S), DIVISION (DV), DISTRICT (DT) or TALUKA (TL). `scopeFor()`
 * turns an officer into the concrete list of districts they may see, and
 * every data-reading surface in the application filters through it.
 *
 * SECURITY BOUNDARY: this is presentation-tier scoping only. It decides
 * what the UI renders; it is NOT an authorisation control. A production
 * deployment must re-derive the same scope server-side from a signed
 * session and filter at the query layer, otherwise a modified client can
 * request out-of-jurisdiction records directly from the API.
 */

const CODE_RE = /^MH-AGRI-(S|DV|DT|TL)\d{3}$/i;

const ROLE_BY_PREFIX: Record<string, Role> = {
  S: 'STATE',
  DV: 'DIVISION',
  DT: 'DISTRICT',
  TL: 'TALUKA',
};

export const DESIGNATIONS: Record<Role, string> = {
  STATE: 'Commissioner of Agriculture (State)',
  DIVISION: 'Divisional Joint Director of Agriculture',
  DISTRICT: 'District Superintending Agriculture Officer',
  TALUKA: 'Taluka Agriculture Officer',
};

export const ROLE_LABEL: Record<Role, string> = {
  STATE: 'State',
  DIVISION: 'Division',
  DISTRICT: 'District',
  TALUKA: 'Taluka',
};

/** Capability matrix — what each level is permitted to do. */
export const CAPABILITIES = {
  STATE: ['VIEW_ALL', 'REVIEW_CASES', 'DISPATCH', 'BROADCAST_STATE', 'BROADCAST_DISTRICT', 'EXPORT', 'VIEW_AUDIT_ALL'],
  DIVISION: ['VIEW_DIVISION', 'REVIEW_CASES', 'DISPATCH', 'BROADCAST_DISTRICT', 'EXPORT', 'VIEW_AUDIT_ALL'],
  DISTRICT: ['VIEW_DISTRICT', 'REVIEW_CASES', 'DISPATCH', 'BROADCAST_DISTRICT', 'EXPORT', 'VIEW_AUDIT_OWN'],
  TALUKA: ['VIEW_TALUKA', 'DISPATCH', 'EXPORT', 'VIEW_AUDIT_OWN'],
} as const satisfies Record<Role, readonly string[]>;

export type Capability = (typeof CAPABILITIES)[Role][number];

export function can(role: Role, capability: string): boolean {
  return (CAPABILITIES[role] as readonly string[]).includes(capability);
}

export interface CredentialInput {
  email: string;
  employeeCode: string;
  district?: string;
  taluka?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<'email' | 'employeeCode' | 'district' | 'taluka', string>>;
  role: Role;
}

export function validateCredentials(input: CredentialInput): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const email = input.email.trim().toLowerCase();
  const code = input.employeeCode.trim().toUpperCase();

  if (!email) errors.email = 'Official email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  else if (!/@(.+\.)?(gov\.in|nic\.in)$/.test(email))
    errors.email = 'Only @gov.in and @nic.in addresses may access this portal.';

  if (!code) errors.employeeCode = 'Employee code is required.';
  else if (!CODE_RE.test(code)) errors.employeeCode = 'Format: MH-AGRI-S001 / -DV001 / -DT001 / -TL001.';

  const prefix = code.match(CODE_RE)?.[1]?.toUpperCase();
  const role: Role = (prefix && ROLE_BY_PREFIX[prefix]) || 'DISTRICT';

  if (role !== 'STATE' && !input.district) errors.district = 'Select your posting.';
  if (role === 'TALUKA' && !input.taluka) errors.taluka = 'Select your taluka.';

  return { ok: Object.keys(errors).length === 0, errors, role };
}

/** Builds the officer record a successful sign-in produces. */
export function buildOfficer(input: CredentialInput, role: Role): Officer {
  const email = input.email.trim().toLowerCase();
  const name = email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: `officer-${input.employeeCode.toUpperCase()}`,
    name,
    designation: DESIGNATIONS[role],
    role,
    division: role === 'STATE' ? undefined : divisionOf(input.district ?? ''),
    district: role === 'STATE' ? undefined : input.district,
    taluka: role === 'TALUKA' ? input.taluka : undefined,
    email,
    employeeCode: input.employeeCode.trim().toUpperCase(),
    // Mock client IP for the audit trail. In production this is captured
    // server-side from the request, never trusted from the browser.
    ip: `10.${42}.${(input.employeeCode.length * 7) % 255}.${(email.length * 13) % 254}`,
    loginAt: new Date().toISOString(),
  };
}

/** The districts an officer is entitled to see, plus a display label. */
export function scopeFor(officer: Officer | null): Jurisdiction {
  if (!officer) return { districts: [], label: 'No access' };

  switch (officer.role) {
    case 'STATE':
      return { districts: DISTRICT_NAMES, label: 'All Maharashtra · 36 districts' };
    case 'DIVISION': {
      const districts = districtsInDivision(officer.division ?? '');
      return { districts, label: `${officer.division} Division · ${districts.length} districts` };
    }
    case 'DISTRICT':
      return { districts: officer.district ? [officer.district] : [], label: `${officer.district} District` };
    case 'TALUKA':
      return {
        districts: officer.district ? [officer.district] : [],
        label: `${officer.taluka} Taluka, ${officer.district}`,
      };
    default:
      return { districts: [], label: 'No access' };
  }
}

/** Applies the jurisdiction filter to any record carrying district/taluka. */
export function withinScope<T extends { district: string; taluka?: string }>(
  rows: T[],
  officer: Officer | null,
): T[] {
  if (!officer) return [];
  const scope = scopeFor(officer);
  return rows.filter((row) => {
    if (!scope.districts.includes(row.district)) return false;
    if (officer.role === 'TALUKA' && officer.taluka && row.taluka !== officer.taluka) return false;
    return true;
  });
}

/** Map viewport for an officer's jurisdiction: [lat, lng, zoom]. */
export function viewportFor(officer: Officer | null): { center: [number, number]; zoom: number } {
  if (!officer || officer.role === 'STATE') return { center: [19.45, 76.4], zoom: 6.4 };

  if (officer.role === 'DIVISION') {
    const districts = districtsInDivision(officer.division ?? '').map(getDistrict);
    const valid = districts.filter(Boolean) as NonNullable<ReturnType<typeof getDistrict>>[];
    if (valid.length) {
      const lat = valid.reduce((s, d) => s + d.lat, 0) / valid.length;
      const lng = valid.reduce((s, d) => s + d.lng, 0) / valid.length;
      return { center: [lat, lng], zoom: 7.6 };
    }
  }

  const district = getDistrict(officer.district ?? '');
  if (!district) return { center: [19.45, 76.4], zoom: 6.4 };

  if (officer.role === 'TALUKA') {
    const taluka = district.talukas.find((t) => t.name === officer.taluka);
    if (taluka) return { center: [taluka.lat, taluka.lng], zoom: 10.5 };
  }

  return { center: [district.lat, district.lng], zoom: 8.8 };
}

/** Convenience predicate used when assigning dispatches. */
export function canReview(officer: Officer | null): boolean {
  return !!officer && can(officer.role, 'REVIEW_CASES');
}

export function caseInScope(record: CaseRecord, officer: Officer | null): boolean {
  return withinScope([record], officer).length === 1;
}
