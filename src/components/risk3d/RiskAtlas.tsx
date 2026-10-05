'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Box, RotateCcw } from 'lucide-react';
import type { RootState } from '@react-three/fiber';
import type { CaseRecord, Officer } from '@/lib/types';
import { DEMO_NOW } from '@/lib/catalog';
import { buildDistrictDetail, buildDistrictRisk, type MapLevel } from '@/lib/districtRisk';
import { useRiskGeo } from '@/hooks/useRiskGeo';
import { useWebglGuard } from '@/hooks/useWebglGuard';
import { useRiskAtlas } from '@/store/useRiskAtlas';
import RiskScene, { type SceneHandle } from './RiskScene';
import { AtlasHint, AtlasLegend, AtlasTopBar, HoverCard } from './AtlasChrome';
import DistrictSummary from './DistrictSummary';
import DistrictInspector, { type DistrictOption } from './DistrictInspector';
import { PanelShell, useRetained } from './panelParts';
import './risk3d.css';

/**
 * RiskAtlas
 * ---------
 * The Maharashtra risk atlas: a 3D, animated choropleth of the districts
 * coloured Low / Moderate / High, with drill-down —
 *
 *   click a district  -> the camera flies in, a summary card slides open
 *   "Inspect district" -> it dives closer, every case drops in as a pin and
 *                         the pests / diseases / cases panel opens
 *
 * It is a client-only island (WebGL). Pages load it with
 * next/dynamic(..., { ssr: false }) via ./index.
 */

export interface RiskAtlasProps {
  /** Cases in view, already scoped to the officer (and filtered, if the page has filters). */
  cases: CaseRecord[];
  /** Longer history used only for the 12-week trend chart. Defaults to `cases`. */
  historyCases?: CaseRecord[];
  officer: Officer | null;
  /** Length of the window `cases` covers, in days (ignored when periodControl is on). */
  windowDays?: number;
  /** Show the 7d / 30d / 90d selector and window `cases` internally. */
  periodControl?: boolean;
  initialDistrictKey?: string | null;
  initialInspect?: boolean;
  /** Called when this browser cannot run WebGL, so the page can offer the 2D map. */
  onUnsupported?: () => void;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 p-6 text-center backdrop-blur-sm">{children}</div>;
}

export default function RiskAtlas({
  cases,
  historyCases,
  officer,
  windowDays = 30,
  periodControl = false,
  initialDistrictKey = null,
  initialInspect = false,
  onUnsupported,
}: RiskAtlasProps) {
  const geoState = useRiskGeo();
  const geo = geoState.data;
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle>(null);
  const { lost, bindCanvas, cleanup } = useWebglGuard();
  const [supported] = useState(webglAvailable);
  const [days, setDays] = useState(30);
  const [fullscreen, setFullscreen] = useState(false);

  const mode = useRiskAtlas((s) => s.mode);
  const selectedKey = useRiskAtlas((s) => s.selectedKey);

  // Fresh view state on every mount, and none left behind on unmount.
  useEffect(() => {
    useRiskAtlas.getState().reset();
    return () => useRiskAtlas.getState().reset();
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);
  useEffect(() => {
    if (!supported) onUnsupported?.();
  }, [supported, onUnsupported]);

  // Bottom sheet instead of a side panel when the atlas is narrow.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const apply = () => useRiskAtlas.getState().setLayout(el.clientWidth < 780 ? 'sheet' : 'side');
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Escape steps back one level: inspect -> district -> state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      const s = useRiskAtlas.getState();
      if (s.mode !== 'state') s.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ----------------------------- data ----------------------------- */

  const activeDays = periodControl ? days : windowDays;
  const periodLabel = `Last ${activeDays} days`;

  const viewCases = useMemo(
    () => (periodControl ? cases.filter((c) => +new Date(c.reportedAt) >= DEMO_NOW - days * 86400000) : cases),
    [cases, periodControl, days],
  );

  const risk = useMemo(
    () => (geo ? buildDistrictRisk({ cases: viewCases, geoKeys: geo.districts.map((d) => d.key), officer, windowDays: activeDays }) : {}),
    [geo, viewCases, officer, activeDays],
  );

  const detail = useMemo(() => {
    if (!selectedKey || !risk[selectedKey]) return null;
    return buildDistrictDetail(risk[selectedKey], viewCases, historyCases ?? cases);
  }, [selectedKey, risk, viewCases, historyCases, cases]);
  const shownDetail = useRetained(detail);
  const shownGeoDistrict = shownDetail && geo ? geo.byKey.get(shownDetail.risk.key) : undefined;

  const options = useMemo<DistrictOption[]>(
    () =>
      geo
        ? geo.districts
            .filter((d) => risk[d.key] && risk[d.key].level !== 'OUT_OF_SCOPE')
            .map((d) => ({ key: d.key, label: risk[d.key].label, level: risk[d.key].level as MapLevel }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : [],
    [geo, risk],
  );

  // Deep-link: open straight onto a district (e.g. from the 2D map's popup).
  const appliedInitial = useRef(false);
  useEffect(() => {
    if (appliedInitial.current || !geo || !initialDistrictKey || !geo.byKey.has(initialDistrictKey)) return;
    appliedInitial.current = true;
    const s = useRiskAtlas.getState();
    if (initialInspect) s.inspect(initialDistrictKey);
    else s.select(initialDistrictKey);
  }, [geo, initialDistrictKey, initialInspect]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const handleCreated = useCallback((state: RootState) => bindCanvas(state), [bindCanvas]);

  /* ----------------------------- render ---------------------------- */

  return (
    <div ref={rootRef} className="risk3d-root relative h-full w-full select-none overflow-hidden">
      {!supported && (
        <Overlay>
          <div className="max-w-sm">
            <Box size={28} className="mx-auto text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">3D view isn&rsquo;t available in this browser</p>
            <p className="mt-1 text-xs text-slate-500">WebGL is turned off or unsupported here. Switch to the 2D case map instead — it shows the same district risk colours.</p>
          </div>
        </Overlay>
      )}

      {supported && geoState.status === 'loading' && (
        <Overlay>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Loader2 size={15} className="animate-spin" /> Building the Maharashtra atlas…
          </div>
        </Overlay>
      )}

      {supported && geoState.status === 'error' && (
        <Overlay>
          <div className="max-w-sm">
            <AlertTriangle size={26} className="mx-auto text-amber-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Couldn&rsquo;t load the district map</p>
            <p className="mt-1 text-xs text-slate-500">{geoState.error}</p>
            <button onClick={() => geoState.retry()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700">
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        </Overlay>
      )}

      {supported && geo && (
        <>
          <div className="absolute inset-0">
            <RiskScene ref={sceneRef} geo={geo} risk={risk} cases={viewCases} onCreated={handleCreated} />
          </div>

          <AtlasTopBar
            districtCount={geo.districts.length}
            caseCount={viewCases.length}
            periodLabel={periodLabel}
            periodControl={periodControl}
            days={days}
            onDays={setDays}
            onZoom={(dir) => sceneRef.current?.zoom(dir)}
            onRefit={() => sceneRef.current?.refit()}
            fullscreen={fullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
          <AtlasLegend risk={risk} />
          <AtlasHint />
          <HoverCard risk={risk} containerRef={rootRef} />

          <PanelShell open={mode === 'district'} label="District summary">
            {shownDetail && <DistrictSummary detail={shownDetail} periodLabel={periodLabel} />}
          </PanelShell>

          <PanelShell open={mode === 'inspect'} wide label="District inspector">
            {shownDetail && shownGeoDistrict && (
              <DistrictInspector detail={shownDetail} lngLat={shownGeoDistrict.lngLat} options={options} officer={officer} periodLabel={periodLabel} />
            )}
          </PanelShell>
        </>
      )}

      {lost && (
        <Overlay>
          <div className="max-w-sm">
            <AlertTriangle size={26} className="mx-auto text-amber-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Graphics context lost</p>
            <p className="mt-1 text-xs text-slate-500">The GPU reset or the tab was backgrounded on a low-power device. Reload to restore the 3D view.</p>
            <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700">
              Reload page
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
