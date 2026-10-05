'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Boxes, Info } from 'lucide-react';
import { PageHeading, Panel, PanelHeader, Badge } from '@/components/ui';

/**
 * 3D State Atlas
 * --------------
 * SSR-safe entry point for the Atlas. Three.js/WebGL only exist in the
 * browser, so the whole scene is loaded with `ssr: false` (same pattern
 * `src/components/map/GisMap.tsx` uses for Leaflet) and a skeleton stands
 * in until the chunk arrives.
 *
 * This is a supplementary, state-wide visual reference layer — a direct
 * port of the standalone Maharashtra 3D Atlas prototype — and is
 * intentionally independent from the case/officer data model the rest of
 * the console uses (see the in-page note below for why).
 */
const AtlasApp = dynamic(() => import('@/components/atlas/AtlasApp'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#05070a]">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-saffron-300/80">Loading 3D Atlas…</p>
    </div>
  ),
});

export default function AtlasPage() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeading
        title="3D State Atlas"
        subtitle="Cinematic, district-by-district 3D view of Maharashtra — hover to preview, click to fly in."
        action={<Badge tone="slate">34 GADM districts</Badge>}
      />

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={Boxes}
          title="Maharashtra — interactive 3D relief"
          subtitle="Block height & colour encode a demo development index; live weather comes from Open-Meteo per district."
          accent="violet"
        />
        <div className="relative h-[36rem] lg:h-[44rem]">
          <AtlasApp />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-start gap-2.5 p-4">
          <Info size={15} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            This atlas uses a separate, older district-boundary dataset (34 GADM polygons, pre-2014) purely for its
            3D geometry, so district names/counts here won&rsquo;t exactly match the 36-district roster used
            elsewhere in the console (e.g. Palghar was still part of Thane, and Aurangabad / Osmanabad / Bid /
            Buldana haven&rsquo;t been renamed). Development, population and literacy figures shown per district are
            illustrative demo indices, not official statistics — this page is a visual reference layer, not a
            source of case data.
          </p>
        </div>
      </Panel>
    </div>
  );
}
