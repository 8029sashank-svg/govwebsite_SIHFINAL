'use client';

import { create } from 'zustand';
import type { CaseRecord, Domain, Severity } from '@/lib/types';
import { DEMO_NOW } from '@/lib/catalog';

/**
 * useFilters.ts
 * -------------
 * One filter state shared by the GIS map, the case tables and the
 * analytics charts, so narrowing the map to "Cotton, high severity, last
 * 14 days" narrows every other surface to the same slice. Jurisdiction
 * scoping is applied separately (in rbac.withinScope) and is not
 * user-clearable.
 */

export interface FilterState {
  domain: Domain | 'ALL';
  subject: string | 'ALL';
  severities: Severity[];
  /** Rolling window in days, measured back from DEMO_NOW. */
  days: number;
  minConfidence: number;
  search: string;
  districts: string[];

  showPins: boolean;
  showDistricts: boolean;
  showHeatmap: boolean;
  showScouts: boolean;
  clusterPins: boolean;

  set: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  toggleSeverity: (severity: Severity) => void;
  toggleDistrict: (district: string) => void;
  reset: () => void;
}

const DEFAULTS = {
  domain: 'ALL' as const,
  subject: 'ALL' as const,
  severities: ['HIGH', 'MEDIUM', 'LOW'] as Severity[],
  days: 30,
  minConfidence: 0,
  search: '',
  districts: [] as string[],
  showPins: true,
  showDistricts: true,
  showHeatmap: false,
  showScouts: false,
  clusterPins: false,
};

export const useFilters = create<FilterState>((set) => ({
  ...DEFAULTS,

  set: (key, value) => set({ [key]: value } as Pick<FilterState, typeof key>),

  toggleSeverity: (severity) =>
    set((state) => ({
      severities: state.severities.includes(severity)
        ? state.severities.filter((s) => s !== severity)
        : [...state.severities, severity],
    })),

  toggleDistrict: (district) =>
    set((state) => ({
      districts: state.districts.includes(district)
        ? state.districts.filter((d) => d !== district)
        : [...state.districts, district],
    })),

  reset: () => set({ ...DEFAULTS }),
}));

/** Pure predicate so the same rules apply on the map and in tables. */
export function applyFilters(cases: CaseRecord[], filters: FilterState, now: number = DEMO_NOW): CaseRecord[] {
  const cutoff = now - filters.days * 86400000;
  const term = filters.search.trim().toLowerCase();

  return cases.filter((record) => {
    if (filters.domain !== 'ALL' && record.domain !== filters.domain) return false;
    if (filters.subject !== 'ALL' && record.subject !== filters.subject) return false;
    if (!filters.severities.includes(record.severity)) return false;
    if (record.aiConfidence < filters.minConfidence) return false;
    if (new Date(record.reportedAt).getTime() < cutoff) return false;
    if (filters.districts.length > 0 && !filters.districts.includes(record.district)) return false;

    if (term) {
      const haystack = `${record.reference} ${record.farmerName} ${record.diagnosis} ${record.district} ${record.taluka} ${record.subject}`;
      if (!haystack.toLowerCase().includes(term)) return false;
    }

    return true;
  });
}
