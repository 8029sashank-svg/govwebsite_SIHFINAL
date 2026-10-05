'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Skeleton } from '@/components/ui';

/**
 * SSR-safe entry point: three.js / WebGL only exist in the browser, so the
 * atlas chunk is loaded with `ssr: false` (same pattern GisMap uses for
 * Leaflet). Import { RiskAtlas } from '@/components/risk3d' in pages.
 */
export const RiskAtlas = dynamic(() => import('./RiskAtlas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-3 p-6">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
        <p className="pt-1 text-center text-[11px] text-slate-500">Loading 3D risk atlas…</p>
      </div>
    </div>
  ),
});

export type { RiskAtlasProps } from './RiskAtlas';
