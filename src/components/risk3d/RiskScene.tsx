'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type RootState, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, Html, Line } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CaseRecord } from '@/lib/types';
import { SEVERITY_META } from '@/lib/catalog';
import {
  LEVEL_META,
  geoKeyForConsoleDistrict,
  type DistrictRisk,
  type DistrictRiskMap,
} from '@/lib/districtRisk';
import { lngLatToShape, snapInside, type GeoDistrict, type RiskGeo } from '@/lib/atlas/riskGeo';
import { caseShot, districtShot, inspectShot, stateShot, type FrameContext } from '@/lib/atlas/riskCamera';
import { useRiskAtlas } from '@/store/useRiskAtlas';

/**
 * RiskScene
 * ---------
 * The WebGL half of the risk atlas.
 *
 *  - DistrictBlock  one extruded, risk-coloured block per district with a
 *                   white border line, a name label, hover lift, a rise-up
 *                   intro and a slow pulse on High-risk districts.
 *  - CasePins       "Inspect district": every case in the district stands
 *                   on the surface as a severity-coloured pin.
 *  - CameraDirector flies CameraControls between the state, a district, an
 *                   inspected district and a single case, framing each
 *                   shot around whatever panel is open.
 *
 * PERFORMANCE: geometry is extruded once at unit depth and the block's
 * height is animated with scale.z, so changing a filter (which changes
 * risk scores and therefore heights) never rebuilds a mesh. All per-frame
 * motion reads useRiskAtlas.getState() inside useFrame instead of
 * subscribing, so hovering does not re-render 34 components.
 */

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const damp = THREE.MathUtils.damp;

/** Block height in scene units: taller = higher score; flat when there is nothing to rate. */
export function blockHeight(risk: DistrictRisk): number {
  if (risk.level === 'NO_DATA' || risk.level === 'OUT_OF_SCOPE') return 3;
  return 4 + risk.score * 0.38;
}

/** Height a block settles at while another district is being inspected. */
const INSPECT_SELECTED_MUL = 0.32;
const INSPECT_OTHERS_MUL = 0.22;

export function inspectedTopY(risk: DistrictRisk): number {
  return blockHeight(risk) * INSPECT_SELECTED_MUL;
}

const WHITE = new THREE.Color('#ffffff');
const GREY = new THREE.Color('#e2e8f0');
const SAFFRON = new THREE.Color('#ff9933');
const NAVY = new THREE.Color('#0b1f3a');

/* ------------------------------------------------------------------ */
/* District label                                                      */
/* ------------------------------------------------------------------ */

function DistrictLabel({ district, risk }: { district: GeoDistrict; risk: DistrictRisk }) {
  const state = useRiskAtlas((s) => {
    if (!s.showLabels) return 'hidden';
    if (s.mode === 'inspect') return s.selectedKey === district.key ? 'selected' : 'hidden';
    if (s.selectedKey === district.key) return 'selected';
    if (s.selectedKey || (s.levelFilter && s.levelFilter !== risk.level)) return 'dim';
    return 'normal';
  });
  // Labels pushed out over the sea need dark text; the rest sit on coloured fills.
  const tone = risk.level === 'NO_DATA' || risk.level === 'OUT_OF_SCOPE' || district.labelOffset ? 'light' : 'dark';
  return (
    <Html center zIndexRange={[16, 0]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
      <div className="rk-label" data-state={state} data-tone={tone} data-small={district.labelRoom < 9 ? 'true' : 'false'}>
        {district.label}
      </div>
    </Html>
  );
}

/** Thin line from an offset name back to its (too small) district. Lives in the label's group so it rides at label height. */
function LeaderLine({ district }: { district: GeoDistrict }) {
  const showLabels = useRiskAtlas((s) => s.showLabels);
  const hidden = useRiskAtlas((s) => s.mode === 'inspect');
  const [dx, dy] = district.labelOffset ?? [0, 0];
  const pts = useMemo(
    () => [new THREE.Vector3(-dx * 0.62, 0, dy * 0.62), new THREE.Vector3(-dx, 0, dy)],
    [dx, dy],
  );
  if (!showLabels || hidden) return null;
  return <Line points={pts} color="#475569" lineWidth={1} raycast={() => null} />;
}

/* ------------------------------------------------------------------ */
/* District block                                                      */
/* ------------------------------------------------------------------ */

interface BlockProps {
  district: GeoDistrict;
  risk: DistrictRisk;
  delay: number;
}

const DistrictBlock = React.memo(function DistrictBlock({ district, risk, delay }: BlockProps) {
  const key = district.key;
  const gl = useThree((s) => s.gl);

  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const borderRef = useRef<THREE.Group>(null);
  const heightRef = useRef(0);

  // Unit-depth extrusion; vertex colours darken the side walls so the
  // block reads as solid without a second material.
  const geometry = useMemo(() => {
    const parts = district.shapes.map((shape) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      const normal = g.getAttribute('normal');
      const colors = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const shade = Math.abs(normal.getZ(i)) > 0.5 ? 1 : 0.7;
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    });
    return parts.length > 1 ? (mergeGeometries(parts, false) as THREE.BufferGeometry) : parts[0];
  }, [district]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.04,
        transparent: true,
        emissiveIntensity: 0,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const base = useMemo(() => new THREE.Color(LEVEL_META[risk.level].color), [risk.level]);
  const tint = useMemo(() => new THREE.Color(LEVEL_META[risk.level].tint), [risk.level]);
  const scratch = useMemo(() => new THREE.Color(), []);
  const pulsePhase = useMemo(() => (district.labelPoint[0] % 7) * 0.9, [district]);

  const borderPoints = useMemo(
    () =>
      district.polys.map((p) => [...p.outer, p.outer[0]].map(([x, y]) => new THREE.Vector3(x, y, 1.004))),
    [district],
  );

  useFrame((state, dt) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;

    const s = useRiskAtlas.getState();
    const t = state.clock.elapsedTime;
    const isSel = s.selectedKey === key;
    const isHover = s.hoveredKey === key && risk.level !== 'OUT_OF_SCOPE';
    const inspecting = s.mode === 'inspect';
    const filterMiss = s.levelFilter !== null && s.levelFilter !== risk.level;
    const dimmed = (s.selectedKey !== null && !isSel) || filterMiss;

    // Rise-up intro, staggered west to east.
    const p = clamp01((t - 0.2 - delay) / 0.95);
    const intro = 1 - Math.pow(1 - p, 3);

    // Selected district stays tall; its neighbours sink so they never wall it in.
    const mul = inspecting ? (isSel ? INSPECT_SELECTED_MUL : INSPECT_OTHERS_MUL) : s.selectedKey !== null && !isSel ? 0.55 : 1;
    heightRef.current = damp(heightRef.current, blockHeight(risk) * mul, 5, dt);
    const h = Math.max(0.05, heightRef.current * intro);
    body.scale.z = h;

    const lift = inspecting ? 0 : isSel ? 2 : isHover ? 3.5 : 0;
    group.position.y = damp(group.position.y, lift, 8, dt);

    if (labelRef.current) labelRef.current.position.y = h + 1.4;

    // Colour: inspected district turns pale so pins pop; dimmed ones wash out.
    if (inspecting && isSel) scratch.copy(tint);
    else if (dimmed) scratch.copy(base).lerp(GREY, 0.72);
    else if (isHover) scratch.copy(base).lerp(WHITE, 0.2);
    else scratch.copy(base);
    material.color.lerp(scratch, 1 - Math.exp(-dt * 9));

    const pulse = risk.level === 'HIGH' && !dimmed ? 0.09 + 0.08 * Math.sin(t * 2.1 + pulsePhase) : 0;
    material.emissive.copy(base);
    material.emissiveIntensity = damp(material.emissiveIntensity, isHover ? 0.16 : isSel && !inspecting ? 0.1 : pulse, 8, dt);

    const targetOpacity = inspecting && !isSel ? 0.16 : dimmed ? 0.5 : 1;
    material.opacity = damp(material.opacity, targetOpacity, 6, dt);

    // Border lines: white by default, saffron on hover, navy when selected.
    const borders = borderRef.current;
    if (borders) {
      const wantColor = isSel ? NAVY : isHover ? SAFFRON : WHITE;
      const wantWidth = isSel ? 3 : isHover ? 2.6 : 1.4;
      const wantOpacity = inspecting && !isSel ? 0.25 : dimmed ? 0.55 : 0.95;
      borders.children.forEach((child) => {
        const mat = (child as THREE.Mesh).material as THREE.ShaderMaterial & { linewidth: number; color: THREE.Color };
        mat.color.lerp(wantColor, 1 - Math.exp(-dt * 12));
        mat.linewidth = damp(mat.linewidth, wantWidth, 12, dt);
        mat.opacity = damp(mat.opacity, wantOpacity, 8, dt);
      });
    }
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    const s = useRiskAtlas.getState();
    if (s.mode === 'inspect') return; // blocks are inert while inspecting; pins take the pointer
    e.stopPropagation();
    s.setHovered(key);
    gl.domElement.style.cursor = risk.level === 'OUT_OF_SCOPE' ? 'not-allowed' : 'pointer';
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    const s = useRiskAtlas.getState();
    if (s.mode === 'inspect') return;
    e.stopPropagation();
    if (s.hoveredKey === key) s.setHovered(null);
    gl.domElement.style.cursor = 'auto';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const s = useRiskAtlas.getState();
    if (s.mode === 'inspect') return;
    e.stopPropagation();
    if (e.delta > 5) return; // that was a drag (orbit), not a click
    if (risk.level === 'OUT_OF_SCOPE') return;
    s.select(key);
  };

  return (
    <group ref={groupRef}>
      <group ref={bodyRef} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.05]}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
        <group ref={borderRef}>
          {borderPoints.map((pts, i) => (
            <Line key={i} points={pts} color="#ffffff" lineWidth={1.4} transparent opacity={0.95} raycast={() => null} />
          ))}
        </group>
      </group>
      <group
        ref={labelRef}
        position={[district.labelPoint[0] + (district.labelOffset?.[0] ?? 0), 2, -(district.labelPoint[1] + (district.labelOffset?.[1] ?? 0))]}
      >
        <DistrictLabel district={district} risk={risk} />
        {district.labelOffset && <LeaderLine district={district} />}
      </group>
    </group>
  );
});

/* ------------------------------------------------------------------ */
/* Case pins                                                           */
/* ------------------------------------------------------------------ */

const pinGeo = {
  stem: new THREE.CylinderGeometry(0.28, 0.28, 5, 8),
  head: new THREE.SphereGeometry(2.1, 20, 16),
  ring: new THREE.TorusGeometry(3.1, 0.34, 8, 28),
  pulse: new THREE.RingGeometry(2.4, 3.1, 32),
};

const pinMat = {
  HIGH: new THREE.MeshStandardMaterial({ color: SEVERITY_META.HIGH.color, emissive: SEVERITY_META.HIGH.color, emissiveIntensity: 0.35, roughness: 0.35 }),
  MEDIUM: new THREE.MeshStandardMaterial({ color: SEVERITY_META.MEDIUM.color, emissive: SEVERITY_META.MEDIUM.color, emissiveIntensity: 0.3, roughness: 0.35 }),
  LOW: new THREE.MeshStandardMaterial({ color: SEVERITY_META.LOW.color, emissive: SEVERITY_META.LOW.color, emissiveIntensity: 0.25, roughness: 0.35 }),
  DIM: new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.6 }),
  STEM: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6 }),
  AMBER: new THREE.MeshBasicMaterial({ color: '#f59e0b' }),
  FOCUS: new THREE.MeshBasicMaterial({ color: '#ff9933' }),
  PULSE: new THREE.MeshBasicMaterial({ color: SEVERITY_META.HIGH.color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
};

interface PinData {
  record: CaseRecord;
  x: number;
  z: number;
}

interface PinProps {
  pin: PinData;
  index: number;
  topY: number;
  size: number;
  dimmed: boolean;
  focused: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function CasePin({ pin, index, topY, size, dimmed, focused, hovered, onHover, onSelect }: PinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const bornRef = useRef<number | null>(null);
  const { record } = pin;
  const gl = useThree((s) => s.gl);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (bornRef.current === null) bornRef.current = state.clock.elapsedTime + 0.55 + index * 0.028;
    const p = clamp01((state.clock.elapsedTime - bornRef.current) / 0.5);
    // easeOutBack for a springy pop-in
    const c1 = 1.70158;
    const pop = p === 0 ? 0 : 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    const target = focused ? 1.55 : hovered ? 1.3 : dimmed ? 0.6 : 1;
    const cur = g.userData.k ?? target;
    g.userData.k = damp(cur, target, 10, dt);
    g.scale.setScalar(Math.max(0.001, pop * g.userData.k * size));

    if (pulseRef.current) {
      const t = (state.clock.elapsedTime * 0.7 + index * 0.13) % 1;
      pulseRef.current.scale.setScalar(0.6 + t * 1.9);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.38 * (1 - t);
    }
  });

  const mat = dimmed ? pinMat.DIM : pinMat[record.severity];

  return (
    <group
      ref={groupRef}
      position={[pin.x, topY, pin.z]}
      scale={0.001}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(record.id);
        gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        gl.domElement.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 5) return;
        onSelect(record.id);
      }}
    >
      <mesh geometry={pinGeo.stem} material={pinMat.STEM} position={[0, 2.5, 0]} castShadow />
      <mesh geometry={pinGeo.head} material={mat} position={[0, 6.6, 0]} castShadow />
      {record.status === 'PENDING_REVIEW' && (
        <mesh geometry={pinGeo.ring} material={pinMat.AMBER} position={[0, 6.6, 0]} rotation={[Math.PI / 2, 0, 0]} />
      )}
      {focused && <mesh geometry={pinGeo.ring} material={pinMat.FOCUS} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1.5} />}
      {record.severity === 'HIGH' && !dimmed && (
        <mesh ref={pulseRef} geometry={pinGeo.pulse} material={pinMat.PULSE} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      )}
      {(hovered || focused) && (
        <Html position={[0, 11.5, 0]} center zIndexRange={[30, 10]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
          <div className="rk-pin-tip">
            <span className="rk-pin-dot" style={{ background: SEVERITY_META[record.severity].color }} />
            <span>
              <strong>{record.diagnosis}</strong>
              <em>
                {record.subject} · {record.taluka}
              </em>
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

function CasePins({ geo, district, risk, cases }: { geo: RiskGeo; district: GeoDistrict; risk: DistrictRisk; cases: CaseRecord[] }) {
  const diagnosisFilter = useRiskAtlas((s) => s.diagnosisFilter);
  const focusedId = useRiskAtlas((s) => s.focusedCaseId);
  const focusCase = useRiskAtlas((s) => s.focusCase);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const span = Math.max(district.bounds.width, district.bounds.height);
  const size = THREE.MathUtils.clamp(span / 105, 0.55, 2.4);
  const topY = inspectedTopY(risk) + 0.25;

  const pins = useMemo<PinData[]>(() => {
    const pts = cases.map((record) => {
      const [x, y] = snapInside(lngLatToShape(geo.projection, record.lng, record.lat), district);
      return { record, x, y };
    });

    // Gentle relaxation so overlapping pins fan out instead of hiding each other.
    const minD = Math.max(3.2, 5.2 * size);
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[j].x - pts[i].x;
          const dy = pts[j].y - pts[i].y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d < minD) {
            const push = (minD - d) / 2;
            const ux = dx / d;
            const uy = dy / d;
            pts[i].x -= ux * push;
            pts[i].y -= uy * push;
            pts[j].x += ux * push;
            pts[j].y += uy * push;
          }
        }
      }
    }
    return pts.map((p) => {
      const [x, y] = snapInside([p.x, p.y], district);
      return { record: p.record, x, z: -y };
    });
  }, [cases, district, geo.projection, size]);

  return (
    <group>
      {pins.map((pin, i) => (
        <CasePin
          key={pin.record.id}
          pin={pin}
          index={i}
          topY={topY}
          size={size}
          dimmed={diagnosisFilter !== null && pin.record.diagnosis !== diagnosisFilter}
          focused={focusedId === pin.record.id}
          hovered={hoverId === pin.record.id}
          onHover={setHoverId}
          onSelect={focusCase}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export interface SceneHandle {
  zoom: (direction: 1 | -1) => void;
  refit: () => void;
}

interface DirectorProps {
  geo: RiskGeo;
  cases: CaseRecord[];
}

const CameraDirector = forwardRef<SceneHandle, DirectorProps>(function CameraDirector({ geo, cases }, ref) {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const casesRef = useRef(cases);
  casesRef.current = cases;

  const mode = useRiskAtlas((s) => s.mode);
  const selectedKey = useRiskAtlas((s) => s.selectedKey);
  const view = useRiskAtlas((s) => s.view);
  const layout = useRiskAtlas((s) => s.layout);
  const focusedCaseId = useRiskAtlas((s) => s.focusedCaseId);
  const [refitNonce, setRefitNonce] = useState(0);
  const introDone = useRef(false);

  const boundary = useMemo(() => {
    const o = geo.overall;
    const m = 140;
    return new THREE.Box3(new THREE.Vector3(o.minX - m, -20, -o.maxY - m), new THREE.Vector3(o.maxX + m, 60, -o.minY + m));
  }, [geo]);

  useImperativeHandle(
    ref,
    () => ({
      zoom: (dir) => {
        void controlsRef.current?.dolly(dir * 0.32 * Math.max(60, controlsRef.current.distance), true);
      },
      refit: () => setRefitNonce((n) => n + 1),
    }),
    [],
  );

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.setBoundary(boundary);
  }, [boundary]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { width, height } = sizeRef.current;
    const aspect = width / Math.max(1, height);
    const panelOpen = mode !== 'state';
    const panelPx = mode === 'inspect' ? 500 : 372;
    const ctx: FrameContext = {
      fovDeg: camera.fov,
      aspect,
      layout,
      panelFrac: !panelOpen ? 0 : layout === 'side' ? Math.min(0.56, panelPx / Math.max(1, width)) : mode === 'inspect' ? 0.58 : 0.46,
    };

    const district = selectedKey ? geo.byKey.get(selectedKey) : undefined;
    let shot = stateShot(geo.overall, view, ctx);
    if (district && mode === 'inspect') {
      shot = inspectShot(district, ctx);
      const focused = focusedCaseId ? casesRef.current.find((c) => c.id === focusedCaseId) : undefined;
      if (focused) {
        const [x, y] = snapInside(lngLatToShape(geo.projection, focused.lng, focused.lat), district);
        shot = caseShot([x, y], Math.max(district.bounds.width, district.bounds.height), ctx);
      }
    } else if (district && mode === 'district') {
      shot = districtShot(district, view, ctx);
    }

    if (!introDone.current) {
      introDone.current = true;
      // Open high and far, then descend into the establishing shot.
      const farEye: [number, number, number] = [
        shot.target[0] + (shot.eye[0] - shot.target[0]) * 1.7,
        shot.target[1] + (shot.eye[1] - shot.target[1]) * 2.2,
        shot.target[2] + (shot.eye[2] - shot.target[2]) * 1.7,
      ];
      void controls.setLookAt(...farEye, ...shot.target, false);
    }
    void controls.setLookAt(...shot.eye, ...shot.target, true);
    // `size` and `cases` are read through refs on purpose: a window resize or a
    // data refresh should not yank the camera back to the framing shot.
  }, [mode, selectedKey, view, layout, focusedCaseId, geo, camera, refitNonce]);

  return (
    <CameraControls
      ref={controlsRef}
      smoothTime={0.75}
      draggingSmoothTime={0.1}
      minDistance={14}
      maxDistance={2300}
      minPolarAngle={0.03}
      maxPolarAngle={Math.PI / 2 - 0.1}
      dollyToCursor
    />
  );
});

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function Lights({ cx, cz }: { cx: number; cz: number }) {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(cx, 0, cz);
    return o;
  }, [cx, cz]);

  return (
    <>
      <hemisphereLight args={['#ffffff', '#c7d2e0', 1.8]} />
      <primitive object={target} />
      <directionalLight
        position={[cx - 360, 640, cz + 470]}
        target={target}
        intensity={1.75}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={50}
        shadow-camera-far={1800}
        shadow-camera-left={-700}
        shadow-camera-right={700}
        shadow-camera-top={700}
        shadow-camera-bottom={-700}
        shadow-bias={-0.0006}
        shadow-normalBias={1.4}
      />
      <directionalLight position={[cx + 420, 320, cz - 320]} intensity={0.55} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.15, cz]} receiveShadow>
        <planeGeometry args={[3200, 3200]} />
        <shadowMaterial transparent opacity={0.17} />
      </mesh>
    </>
  );
}

export interface RiskSceneProps {
  geo: RiskGeo;
  risk: DistrictRiskMap;
  /** Cases in view; the selected district's are drawn as pins while inspecting. */
  cases: CaseRecord[];
  onCreated: (state: RootState) => void;
}

const RiskScene = forwardRef<SceneHandle, RiskSceneProps>(function RiskScene({ geo, risk, cases, onCreated }, ref) {
  const selectedKey = useRiskAtlas((s) => s.selectedKey);
  const mode = useRiskAtlas((s) => s.mode);
  const clear = useRiskAtlas((s) => s.clear);

  const cx = (geo.overall.minX + geo.overall.maxX) / 2;
  const cz = -(geo.overall.minY + geo.overall.maxY) / 2;

  const delays = useMemo(() => {
    const out = new Map<string, number>();
    for (const d of geo.districts) {
      out.set(d.key, ((d.labelPoint[0] - geo.overall.minX) / Math.max(1, geo.overall.width)) * 0.75);
    }
    return out;
  }, [geo]);

  const selected = selectedKey ? geo.byKey.get(selectedKey) : undefined;
  const selectedRisk = selectedKey ? risk[selectedKey] : undefined;
  const selectedCases = useMemo(
    () => (selectedKey ? cases.filter((c) => geoKeyForConsoleDistrict(c.district) === selectedKey) : []),
    [cases, selectedKey],
  );

  return (
    <Canvas
      shadows
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 5, far: 5200, position: [cx, 900, cz + 1300] }}
      onCreated={onCreated}
      onPointerMissed={() => {
        // Clicking empty space steps back out — but never mid-inspection.
        if (useRiskAtlas.getState().mode === 'district') clear();
      }}
    >
      <Lights cx={cx} cz={cz} />

      {geo.districts.map((d) => {
        const r = risk[d.key];
        if (!r) return null;
        return <DistrictBlock key={d.key} district={d} risk={r} delay={delays.get(d.key) ?? 0} />;
      })}

      {mode === 'inspect' && selected && selectedRisk && (
        <CasePins key={selected.key} geo={geo} district={selected} risk={selectedRisk} cases={selectedCases} />
      )}

      <CameraDirector ref={ref} geo={geo} cases={selectedCases} />
    </Canvas>
  );
});

export default RiskScene;
