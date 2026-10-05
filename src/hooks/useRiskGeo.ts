'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadRiskGeo, type RiskGeo } from '@/lib/atlas/riskGeo';

type State =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: RiskGeo; error: null };

/**
 * useRiskGeo
 * ----------
 * Loads (and caches at module level) the projected Maharashtra district
 * geometry. The Overview and the GIS page both mount an atlas, and
 * navigating between them should not re-download or re-simplify 60k
 * vertices, so the parsed result is shared.
 */
export function useRiskGeo() {
  const [state, setState] = useState<State>({ status: 'loading', data: null, error: null });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    loadRiskGeo()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Failed to load map data.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, retry: load };
}
