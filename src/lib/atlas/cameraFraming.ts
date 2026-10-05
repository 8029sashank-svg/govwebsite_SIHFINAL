import { shapeToWorld } from './geoUtils';
import type { AtlasDistrict, AtlasOverallBounds } from './types';

/**
 * cameraFraming.ts
 * ----------------
 * Ported from the standalone Atlas prototype (src/three/cameraFraming.js).
 * Pure functions that turn geo bounds into a CameraControls.setLookAt(...)
 * call's worth of numbers: eye position + look-at target.
 */

export interface CameraShot {
  eye: [number, number, number];
  target: [number, number, number];
}

/** Wide establishing shot framing the whole state. */
export function overviewShot(overallBounds: AtlasOverallBounds): CameraShot {
  const cx = (overallBounds.minX + overallBounds.maxX) / 2;
  const cy = (overallBounds.minY + overallBounds.maxY) / 2;
  const width = overallBounds.maxX - overallBounds.minX;
  const height = overallBounds.maxY - overallBounds.minY;
  const span = Math.max(width, height);

  const [tx, ty, tz] = shapeToWorld([cx, cy], 8);
  const distance = span * 0.95;

  return {
    eye: [tx - distance * 0.15, distance * 0.78, tz + distance * 0.9],
    target: [tx, ty, tz],
  };
}

/** Close, "diving in" shot for a single selected district. */
export function districtShot(district: AtlasDistrict): CameraShot {
  const { bounds, center } = district;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const span = Math.max(width, height, 18);

  const [tx, ty, tz] = shapeToWorld(center, 6);
  const distance = span * 1.15;

  return {
    eye: [tx + distance * 0.32, distance * 0.42, tz + distance * 0.85],
    target: [tx, ty, tz],
  };
}
