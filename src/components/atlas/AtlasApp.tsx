'use client';

import React, { useEffect, useMemo } from 'react';
import type { RootState } from '@react-three/fiber';
import Scene from './Scene';
import LoadingScreen from './LoadingScreen';
import ErrorScreen from './ErrorScreen';
import TopBar from './TopBar';
import Legend from './Legend';
import DistrictPanel from './DistrictPanel';
import { useMaharashtraGeo } from '@/hooks/useMaharashtraGeo';
import { useWebglGuard } from '@/hooks/useWebglGuard';
import { useAtlasStore } from '@/store/useAtlasStore';
import './atlas.css';

/**
 * AtlasApp
 * --------
 * Ported from the standalone Maharashtra 3D Atlas prototype (src/App.jsx).
 * This is the exact same cinematic 3D district experience — projection,
 * simplification, extrusion, hover/select/camera-flyTo, live weather,
 * WebGL-loss recovery — mounted here as a client-only island inside the
 * GeoFarm.gov console (see src/app/(console)/atlas/page.tsx, which
 * loads this with `next/dynamic(..., { ssr: false })` since WebGL has no
 * server-side equivalent to render).
 */
export default function AtlasApp() {
  const { status, error, data, retry } = useMaharashtraGeo();
  const { lost, bindCanvas, cleanup } = useWebglGuard();
  const selectedId = useAtlasStore((s) => s.selectedId);

  // EVENT LEAKAGE PROTECTION: react-three-fiber tears down every mesh's
  // pointer listeners on unmount; the one manual listener pair this app
  // adds (WebGL context lost/restored) is explicitly cleaned up here.
  useEffect(() => () => cleanup(), [cleanup]);

  const selectedDistrict = useMemo(
    () => (data ? data.districts.find((d) => d.id === selectedId) || null : null),
    [data, selectedId],
  );

  const handleCanvasCreated = (state: RootState) => bindCanvas(state);

  return (
    <div className="atlas-root atlas-vignette relative h-full w-full overflow-hidden">
      {status === 'loading' && <LoadingScreen />}

      {status === 'error' && (
        <ErrorScreen title="Couldn't load Maharashtra map data" message={error} actionLabel="Retry" onAction={retry} />
      )}

      {status === 'ready' && data && (
        <>
          <Scene geo={data} onCanvasCreated={handleCanvasCreated} />
          <TopBar districtCount={data.districts.length} />
          <Legend />
          <DistrictPanel district={selectedDistrict} />
        </>
      )}

      {lost && (
        <ErrorScreen
          title="Graphics context lost"
          message="The WebGL context was lost (this can happen after a GPU driver reset or the tab being backgrounded on a low-power device). Reload to restore the 3D view."
          actionLabel="Reload page"
          onAction={() => window.location.reload()}
        />
      )}
    </div>
  );
}
