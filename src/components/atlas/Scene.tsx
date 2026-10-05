'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { CameraControls, Html } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import DistrictMesh from './DistrictMesh';
import GroundGrid from './GroundGrid';
import { overviewShot, districtShot } from '@/lib/atlas/cameraFraming';
import { shapeToWorld } from '@/lib/atlas/geoUtils';
import { useAtlasStore } from '@/store/useAtlasStore';
import type { AtlasGeoData } from '@/lib/atlas/types';

/**
 * CameraDirector
 * --------------
 * Ported from the standalone Atlas prototype (src/three/Scene.jsx).
 * Owns the CameraControls instance and reacts to selection changes by
 * flying the camera. `camera-controls` (via drei's <CameraControls>)
 * gives eased/"spring-like" transitions for free.
 *
 * CAMERA CLIPPING PREVENTION: minPolarAngle/maxPolarAngle stop the user
 * rotating below the ground plane or into the extruded blocks;
 * minDistance/maxDistance stop the near/far planes from clipping through
 * geometry during zoom.
 */
function CameraDirector({ controlsRef, geo }: { controlsRef: React.RefObject<CameraControlsImpl>; geo: AtlasGeoData }) {
  const selectedId = useAtlasStore((s) => s.selectedId);
  const setTransitioning = useAtlasStore((s) => s.setTransitioning);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;

    let cancelled = false;

    const district = selectedId ? geo.districts.find((d) => d.id === selectedId) : null;
    const shot = district ? districtShot(district) : overviewShot(geo.overallBounds);

    setTransitioning(true);
    controls
      .setLookAt(...shot.eye, ...shot.target, true)
      .then(() => {
        if (!cancelled) setTransitioning(false);
      })
      .catch(() => {
        if (!cancelled) setTransitioning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, geo, controlsRef, setTransitioning]);

  return (
    <CameraControls
      ref={controlsRef}
      smoothTime={0.9}
      draggingSmoothTime={0.12}
      minDistance={12}
      maxDistance={1400}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      dollyToCursor
    />
  );
}

function HoverTooltip({ geo }: { geo: AtlasGeoData }) {
  const hoveredId = useAtlasStore((s) => s.hoveredId);
  const selectedId = useAtlasStore((s) => s.selectedId);
  if (!hoveredId || hoveredId === selectedId) return null;
  const district = geo.districts.find((d) => d.id === hoveredId);
  if (!district) return null;

  const extra = (district.devIndex / 100) * 34 + 2;
  const pos = shapeToWorld(district.center, extra + 6);

  return (
    <Html position={pos} center distanceFactor={220} zIndexRange={[10, 0]}>
      <div className="atlas-glass pointer-events-none select-none whitespace-nowrap rounded-lg border border-cyan-400/30 bg-[#05070a]/90 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur">
        {district.name}
        <span className="ml-2 text-cyan-400/70">Dev Index {district.devIndex}</span>
      </div>
    </Html>
  );
}

export default function Scene({ geo, onCanvasCreated }: { geo: AtlasGeoData; onCanvasCreated: (state: RootState) => void }) {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const setHovered = useAtlasStore((s) => s.setHovered);
  const selectDistrict = useAtlasStore((s) => s.selectDistrict);
  const selectedId = useAtlasStore((s) => s.selectedId);
  const hoveredId = useAtlasStore((s) => s.hoveredId);

  const groundCenter = useMemo((): [number, number, number] => {
    const b = geo.overallBounds;
    const [x, , z] = shapeToWorld([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]);
    return [x, 0, z];
  }, [geo]);

  const handleHover = useCallback((id: string) => setHovered(id), [setHovered]);
  const handleUnhover = useCallback(
    (id: string) => {
      setHovered((current) => (current === id ? null : current));
    },
    [setHovered],
  );
  const handleSelect = useCallback((id: string) => selectDistrict(id), [selectDistrict]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 1, far: 6000, position: [0, 400, 500] }}
      onCreated={onCanvasCreated}
    >
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 400, 1900]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[300, 500, 200]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={2000}
        shadow-camera-left={-800}
        shadow-camera-right={800}
        shadow-camera-top={800}
        shadow-camera-bottom={-800}
      />
      <pointLight position={[groundCenter[0], 200, groundCenter[2]]} intensity={0.4} color="#4df3ff" />

      <GroundGrid center={groundCenter} />

      <group>
        {geo.districts.map((district) => (
          <DistrictMesh
            key={district.id}
            district={district}
            isHovered={hoveredId === district.id}
            isSelected={selectedId === district.id}
            dimmed={selectedId != null && selectedId !== district.id}
            onHover={handleHover}
            onUnhover={handleUnhover}
            onSelect={handleSelect}
          />
        ))}
      </group>

      <Suspense fallback={null}>
        <HoverTooltip geo={geo} />
      </Suspense>

      <CameraDirector controlsRef={controlsRef} geo={geo} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.55} luminanceThreshold={0.35} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
