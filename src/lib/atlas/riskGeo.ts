import * as THREE from 'three';
import type { GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { makeProjection, project, simplifyRing, type XY } from './geoUtils';
import { labelFor } from '../districtRisk';

/**
 * riskGeo.ts
 * ----------
 * Turns the district GeoJSON into everything the risk atlas needs, once:
 *
 *  - extrude-ready THREE.Shapes (one per polygon part),
 *  - the same rings as plain arrays (for border lines and hit-testing),
 *  - an interior LABEL POINT per district. The geometric centroid is a
 *    poor place for a name on concave districts (Ahmednagar, Thane and
 *    Raigad all have centroids near or outside their edge), so the label
 *    goes at the spot furthest from any boundary instead.
 *  - the shared projection, so case pins (lat/lng) land in the same
 *    coordinate space as the polygons.
 *
 * COORDINATE CONVENTION: "shape space" is [x, -projectedY]. It matches
 * what THREE.Shape expects and what geoUtils.shapeToWorld() converts to
 * world space (world = [x, height, -shapeY]).
 */

export interface Poly {
  outer: XY[];
  holes: XY[][];
}

export interface GeoBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface GeoDistrict {
  /** NAME_2 from the GeoJSON — also the key used by the risk model. */
  key: string;
  label: string;
  shapes: THREE.Shape[];
  polys: Poly[];
  /** Interior point (shape space) where the name is drawn. */
  labelPoint: XY;
  /** Distance from the label point to the nearest edge — how much room the label has. */
  labelRoom: number;
  /**
   * For districts too small to hold their own name (Mumbai), the name is drawn
   * this far away in shape space, joined to the district by a leader line.
   */
  labelOffset: XY | null;
  bounds: GeoBox;
  /** Polygon area in scene units squared. */
  area: number;
  /** [lng, lat] of the label point, used for weather lookups. */
  lngLat: [number, number];
}

export interface RiskGeo {
  districts: GeoDistrict[];
  byKey: Map<string, GeoDistrict>;
  projection: GeoProjection;
  overall: GeoBox;
}

/** Districts whose name would not fit inside them: [dx, dy] in scene units (shape space, +y is north). */
const LABEL_OFFSETS: Record<string, XY> = {
  'Greater Bombay': [-46, -6],
};

const SCENE_SIZE = 1000;
const TOLERANCE = 0.32;
const MAX_RING_POINTS = 900;

/* ------------------------------------------------------------------ */
/* Small geometry helpers (shape space)                                */
/* ------------------------------------------------------------------ */

function ringArea(ring: XY[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

function pointInRing(x: number, y: number, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRingSq(x: number, y: number, ring: XY[]): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < best) best = d;
  }
  return best;
}

export function pointInPoly(x: number, y: number, poly: Poly): boolean {
  if (!pointInRing(x, y, poly.outer)) return false;
  return !poly.holes.some((h) => pointInRing(x, y, h));
}

export function pointInPolys(x: number, y: number, polys: Poly[]): boolean {
  return polys.some((p) => pointInPoly(x, y, p));
}

function polyDistanceSq(x: number, y: number, poly: Poly): number {
  let d = distToRingSq(x, y, poly.outer);
  for (const h of poly.holes) d = Math.min(d, distToRingSq(x, y, h));
  return d;
}

/**
 * Approximate pole of inaccessibility: the interior point furthest from
 * every edge. A coarse grid pass followed by three refinement passes is
 * plenty for placing a text label.
 */
function labelPointFor(poly: Poly): { point: XY; room: number } {
  const xs = poly.outer.map((p) => p[0]);
  const ys = poly.outer.map((p) => p[1]);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  let best: XY = [(minX + maxX) / 2, (minY + maxY) / 2];
  let bestD = -1;

  const N = 26;
  for (let pass = 0; pass < 4; pass++) {
    const stepX = (maxX - minX) / N;
    const stepY = (maxY - minY) / N;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = minX + i * stepX;
        const y = minY + j * stepY;
        if (!pointInPoly(x, y, poly)) continue;
        const d = polyDistanceSq(x, y, poly);
        if (d > bestD) {
          bestD = d;
          best = [x, y];
        }
      }
    }
    // Zoom in around the best cell for the next pass.
    minX = best[0] - stepX * 1.5;
    maxX = best[0] + stepX * 1.5;
    minY = best[1] - stepY * 1.5;
    maxY = best[1] + stepY * 1.5;
  }
  return { point: best, room: Math.sqrt(Math.max(bestD, 0)) };
}

/**
 * Returns `p` if it lies inside the district, otherwise the nearest point
 * on the segment from `p` towards the district's label point that does.
 * Demo case coordinates are approximate (they are scattered around taluka
 * centres), so a few fall a hair outside their polygon; this keeps every
 * pin visibly standing on the district it belongs to.
 */
export function snapInside(p: XY, district: GeoDistrict): XY {
  if (pointInPolys(p[0], p[1], district.polys)) return p;
  const [ax, ay] = district.labelPoint;
  let lo = 0; // at p (outside)
  let hi = 1; // at label point (inside)
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const x = p[0] + (ax - p[0]) * mid;
    const y = p[1] + (ay - p[1]) * mid;
    if (pointInPolys(x, y, district.polys)) hi = mid;
    else lo = mid;
  }
  return [p[0] + (ax - p[0]) * hi, p[1] + (ay - p[1]) * hi];
}

/* ------------------------------------------------------------------ */
/* Building                                                            */
/* ------------------------------------------------------------------ */

function toShapeSpace(projection: GeoProjection, ring: Position[]): XY[] {
  const pts = ring.map((lngLat) => {
    const [x, y] = project(projection, lngLat);
    return [x, -y] as XY;
  });
  // Simplify in shape space; the y flip does not affect distances.
  return simplifyRing(pts, TOLERANCE, MAX_RING_POINTS);
}

function geometryToPolys(geometry: Geometry, projection: GeoProjection): Poly[] {
  const polygons: Position[][][] =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons
    .map((rings) => {
      const [outer, ...holes] = rings;
      return {
        outer: toShapeSpace(projection, outer),
        holes: holes.map((h) => toShapeSpace(projection, h)).filter((h) => h.length >= 3),
      };
    })
    .filter((p) => p.outer.length >= 3);
}

function polyToShape(poly: Poly): THREE.Shape {
  const shape = new THREE.Shape(poly.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of poly.holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  return shape;
}

function boxOf(rings: XY[][]): GeoBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export function buildRiskGeo(fc: FeatureCollection): RiskGeo {
  const projection = makeProjection(fc, SCENE_SIZE, SCENE_SIZE);

  const districts: GeoDistrict[] = fc.features.map((feature: Feature, i) => {
    const key = (feature.properties?.NAME_2 as string) || `District ${i + 1}`;
    const polys = geometryToPolys(feature.geometry, projection);
    const shapes = polys.map(polyToShape);

    // Label the largest part (matters for districts with offshore islands).
    const main = polys.reduce((a, b) => (ringArea(b.outer) > ringArea(a.outer) ? b : a), polys[0]);
    const { point, room } = labelPointFor(main);

    const invert = projection.invert;
    const ll = invert ? (invert([point[0], -point[1]]) as [number, number] | null) : null;

    return {
      key,
      label: labelFor(key),
      shapes,
      polys,
      labelPoint: point,
      labelRoom: room,
      labelOffset: LABEL_OFFSETS[key] ?? null,
      bounds: boxOf(polys.map((p) => p.outer)),
      area: polys.reduce((s, p) => s + ringArea(p.outer), 0),
      lngLat: ll ?? [76.4, 19.45],
    };
  });

  const overall = boxOf(districts.flatMap((d) => d.polys.map((p) => p.outer)));

  return { districts, byKey: new Map(districts.map((d) => [d.key, d])), projection, overall };
}

/** [lng, lat] -> shape space, using the atlas's shared projection. */
export function lngLatToShape(projection: GeoProjection, lng: number, lat: number): XY {
  const [x, y] = project(projection, [lng, lat]);
  return [x, -y];
}

/* ------------------------------------------------------------------ */
/* Loading (cached — Overview and GIS pages share one parse)           */
/* ------------------------------------------------------------------ */

const GEOJSON_URL = '/maharashtra_districts.json';
let cache: Promise<RiskGeo> | null = null;

export function loadRiskGeo(): Promise<RiskGeo> {
  if (!cache) {
    cache = fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Map data request failed (HTTP ${res.status})`);
        return res.json() as Promise<FeatureCollection>;
      })
      .then((fc) => {
        if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
          throw new Error('Unexpected map data shape — expected a GeoJSON FeatureCollection.');
        }
        return buildRiskGeo(fc);
      })
      .catch((err) => {
        cache = null; // allow Retry to actually retry
        throw err;
      });
  }
  return cache;
}

/** Raw GeoJSON for the 2D Leaflet layer (same file, same cache-once idea). */
let rawCache: Promise<FeatureCollection> | null = null;
export function loadRawGeoJson(): Promise<FeatureCollection> {
  if (!rawCache) {
    rawCache = fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Map data request failed (HTTP ${res.status})`);
        return res.json() as Promise<FeatureCollection>;
      })
      .catch((err) => {
        rawCache = null;
        throw err;
      });
  }
  return rawCache;
}
