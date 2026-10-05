import * as THREE from 'three';
import type { GeoBox, GeoDistrict } from './riskGeo';
import type { XY } from './geoUtils';

/**
 * riskCamera.ts
 * -------------
 * Pure camera framing for the risk atlas. Given what should be in shot
 * (the state, a district, a single case) and how much of the viewport a
 * side panel or bottom sheet is about to cover, it returns the eye and
 * look-at target for CameraControls.setLookAt().
 *
 * PANEL-AWARE FRAMING: when a panel opens on the right (or a sheet from
 * below) the subject is fitted into the *remaining* viewport and the
 * camera is slid sideways so the subject sits in the visible area rather
 * than behind the panel.
 *
 * World space: x east, y up, z south (shape-space y is negated), so
 * "north" is -z and an azimuth of 0 puts the camera south of the subject
 * looking north.
 */

export interface Shot {
  eye: [number, number, number];
  target: [number, number, number];
}

export interface FrameContext {
  fovDeg: number;
  aspect: number;
  layout: 'side' | 'sheet';
  /** Fraction (0-1) of the viewport width (side) or height (sheet) a panel covers. */
  panelFrac: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

interface FrameSpec {
  box: GeoBox;
  /** Height of the subject above the ground, used to keep tall blocks in frame. */
  topY: number;
  elevationDeg: number;
  azimuthDeg: number;
  /** >1 leaves breathing room around the subject. */
  margin: number;
}

const _cam = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();

/** Projects the subject's bounding corners through a real camera and returns their NDC extents. */
function ndcBox(eye: THREE.Vector3, target: THREE.Vector3, corners: THREE.Vector3[], fovDeg: number, aspect: number) {
  _cam.fov = fovDeg;
  _cam.aspect = aspect;
  _cam.near = 1;
  _cam.far = 100000;
  _cam.position.copy(eye);
  _cam.up.set(0, 1, 0);
  _cam.lookAt(target);
  _cam.updateProjectionMatrix();
  _cam.updateMatrixWorld(true);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    _v.copy(c).project(_cam);
    if (_v.x < minX) minX = _v.x;
    if (_v.x > maxX) maxX = _v.x;
    if (_v.y < minY) minY = _v.y;
    if (_v.y > maxY) maxY = _v.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Finds the closest camera that fits the subject inside the *uncovered*
 * part of the viewport, then slides it so the subject is centred there.
 * Doing this with real perspective projection (rather than a flat
 * estimate) matters: on a tilted camera the near edge of a large map is
 * much bigger on screen than the far edge and would otherwise be cropped.
 */
function frame(spec: FrameSpec, ctx: FrameContext): Shot {
  const { box, topY, elevationDeg, azimuthDeg, margin } = spec;
  const e = rad(elevationDeg);
  const a = rad(azimuthDeg);

  const cx = (box.minX + box.maxX) / 2;
  const cz = -(box.minY + box.maxY) / 2;
  const target = new THREE.Vector3(cx, topY * 0.4, cz);
  const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));

  const corners: THREE.Vector3[] = [];
  for (const x of [box.minX, box.maxX]) {
    for (const z of [-box.maxY, -box.minY]) {
      for (const y of [0, topY]) corners.push(new THREE.Vector3(x, y, z));
    }
  }

  const f = Math.min(0.6, Math.max(0, ctx.panelFrac));
  const usableW = ctx.layout === 'side' ? 2 * (1 - f) : 2;
  const usableH = ctx.layout === 'sheet' ? 2 * (1 - f) : 2;
  const centerX = ctx.layout === 'side' ? -f : 0;
  const centerY = ctx.layout === 'sheet' ? f : 0;

  const eyeAt = (dist: number) => target.clone().addScaledVector(dir, dist);

  let lo = 4;
  let hi = 9000;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const b = ndcBox(eyeAt(mid), target, corners, ctx.fovDeg, ctx.aspect);
    if ((b.maxX - b.minX) * margin <= usableW && (b.maxY - b.minY) * margin <= usableH) hi = mid;
    else lo = mid;
  }
  const dist = hi;

  // Centre the subject in the uncovered area (a few passes: perspective makes this non-linear).
  const eye = eyeAt(dist);
  const tgt = target.clone();
  const tanHalf = Math.tan(rad(ctx.fovDeg) / 2);
  for (let i = 0; i < 4; i++) {
    const b = ndcBox(eye, tgt, corners, ctx.fovDeg, ctx.aspect);
    const dx = (b.minX + b.maxX) / 2 - centerX;
    const dy = (b.minY + b.maxY) / 2 - centerY;
    const d = eye.distanceTo(tgt);
    const visW = 2 * d * tanHalf * ctx.aspect;
    const visH = 2 * d * tanHalf;
    // Camera basis after ndcBox's lookAt.
    const right = new THREE.Vector3().setFromMatrixColumn(_cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(_cam.matrixWorld, 1);
    const shift = right.multiplyScalar((dx * visW) / 2).add(up.multiplyScalar((dy * visH) / 2));
    eye.add(shift);
    tgt.add(shift);
  }

  return { eye: [eye.x, eye.y, eye.z], target: [tgt.x, tgt.y, tgt.z] };
}

/** The whole state. `view` chooses a cinematic tilt or a flat, map-like top-down. */
export function stateShot(overall: GeoBox, view: '3d' | 'top', ctx: FrameContext): Shot {
  return frame(
    {
      box: overall,
      topY: 26,
      elevationDeg: view === 'top' ? 87 : 50,
      azimuthDeg: view === 'top' ? 0 : -4,
      margin: view === 'top' ? 1.13 : 1.06,
    },
    ctx,
  );
}

/** A selected district: the "fly in" shot. */
export function districtShot(d: GeoDistrict, view: '3d' | 'top', ctx: FrameContext): Shot {
  const pad = Math.max(d.bounds.width, d.bounds.height, 46);
  const box: GeoBox = {
    ...d.bounds,
    // Never frame tighter than a small district can bear.
    minX: d.bounds.minX - Math.max(0, (pad - d.bounds.width) / 2),
    maxX: d.bounds.maxX + Math.max(0, (pad - d.bounds.width) / 2),
    minY: d.bounds.minY - Math.max(0, (pad - d.bounds.height) / 2),
    maxY: d.bounds.maxY + Math.max(0, (pad - d.bounds.height) / 2),
    width: Math.max(d.bounds.width, pad),
    height: Math.max(d.bounds.height, pad),
  };
  return frame({ box, topY: 22, elevationDeg: view === 'top' ? 84 : 46, azimuthDeg: view === 'top' ? 0 : -10, margin: 1.35 }, ctx);
}

/** "Inspect district": closer and steeper so case pins read clearly. */
export function inspectShot(d: GeoDistrict, ctx: FrameContext): Shot {
  const pad = Math.max(d.bounds.width, d.bounds.height, 36);
  const box: GeoBox = {
    ...d.bounds,
    minX: d.bounds.minX - Math.max(0, (pad - d.bounds.width) / 2),
    maxX: d.bounds.maxX + Math.max(0, (pad - d.bounds.width) / 2),
    minY: d.bounds.minY - Math.max(0, (pad - d.bounds.height) / 2),
    maxY: d.bounds.maxY + Math.max(0, (pad - d.bounds.height) / 2),
    width: Math.max(d.bounds.width, pad),
    height: Math.max(d.bounds.height, pad),
  };
  return frame({ box, topY: 10, elevationDeg: 64, azimuthDeg: -6, margin: 1.14 }, ctx);
}

/** Zooming to a single case pin inside an inspected district. */
export function caseShot(p: XY, span: number, ctx: FrameContext): Shot {
  const half = Math.max(22, span * 0.22);
  const box: GeoBox = {
    minX: p[0] - half,
    maxX: p[0] + half,
    minY: p[1] - half,
    maxY: p[1] + half,
    width: half * 2,
    height: half * 2,
  };
  return frame({ box, topY: 8, elevationDeg: 58, azimuthDeg: -6, margin: 1.1 }, ctx);
}
