'use client';

import { useMemo } from 'react';
import { useSession } from './useSession';
import { useOps } from './useOps';
import { applyFilters, useFilters } from './useFilters';
import { withinScope } from '@/lib/rbac';
import { SCOUTS } from '@/lib/mockData';
import type { CaseRecord, Scout } from '@/lib/types';

/**
 * hooks.ts
 * --------
 * The two selectors nearly every screen needs.
 *
 * Note the dependency on `overrides` rather than on the `cases()`
 * function: zustand keeps action identities stable, so subscribing to
 * the function alone would never re-run the memo after a review decision.
 * Subscribing to the overrides map is what makes a sign-off propagate to
 * the map, the tables and the KPIs in the same tick.
 */

/** Every case inside the signed-in officer's jurisdiction. */
export function useScopedCases(): CaseRecord[] {
  const officer = useSession((s) => s.officer);
  const overrides = useOps((s) => s.overrides);
  const casesFn = useOps((s) => s.cases);

  return useMemo(() => withinScope(casesFn(), officer), [officer, overrides, casesFn]);
}

/** Jurisdiction-scoped cases with the user's map/table filters applied. */
export function useFilteredCases(): CaseRecord[] {
  const scoped = useScopedCases();
  const filters = useFilters();

  return useMemo(() => applyFilters(scoped, filters), [scoped, filters]);
}

/** Field scouts inside the officer's jurisdiction. */
export function useScopedScouts(): Scout[] {
  const officer = useSession((s) => s.officer);
  return useMemo(() => withinScope(SCOUTS, officer), [officer]);
}
