import * as THREE from 'three';
import { geoMercator, geoCentroid, geoBounds, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

/**
 * geoUtils.ts
 * -----------
 * Ported from the standalone Maharashtra 3D Atlas prototype
 * (src/data/geoUtils.js) with types added — the projection/simplification
 * logic is unchanged.
 *
 * COORDINATE PROJECTION FIX
 * The source file is plain lng/lat (EPSG:4326). Feeding lng/lat straight
 * into a 3D scene distorts Maharashtra badly, because degrees of longitude
 * shrink as latitude increases while three.js units are isotropic. We fix
 * this the same way Mapbox/Leaflet do under the hood: project every
 * coordinate through a Web-Mercator projection (`d3.geoMercator`) fitted
 * to the feature collection's bounding box, THEN build geometry from the
 * projected x/y.
 */

export type XY = [number, number];

export function makeProjection(featureCollection: FeatureCollection, width = 1000, height = 1000): GeoProjection {
  return geoMercator().fitSize([width, height], featureCollection);
}

export function project(projection: GeoProjection, lngLat: Position): XY {
  const p = projection([lngLat[0], lngLat[1]] as [number, number]);
  if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return [0, 0];
  return p as XY;
}

/**
 * Ramer–Douglas–Peucker polyline simplification. The raw Maharashtra
 * GeoJSON carries ~61,000 vertices across 34 districts; simplifying every
 * ring on load keeps 34 simultaneously-interactive extruded meshes at 60
 * FPS without a perceptible loss of shape fidelity at map scale.
 */
export function simplifyRing(points: XY[], tolerance = 0.9, maxPoints = 400): XY[] {
  if (points.length <= 4) return points;

  const sqTolerance = tolerance * tolerance;

  function getSqDist(p: XY, a: XY, b: XY): number {
    let x = a[0];
    let y = a[1];
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  function simplifyDPStep(pts: XY[], first: number, last: number, sqTol: number, out: XY[]) {
    let maxSqDist = sqTol;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
    if (index > -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, sqTol, out);
      out.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, sqTol, out);
    }
  }

  const last = points.length - 1;
  const result: XY[] = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, result);
  result.push(points[last]);

  if (result.length > maxPoints) {
    const stride = Math.ceil(result.length / maxPoints);
    return result.filter((_, i) => i % stride === 0 || i === result.length - 1);
  }
  return result;
}

function ringToXY(ring: Position[], projection: GeoProjection, tolerance: number): XY[] {
  const projected = ring.map((lngLat) => project(projection, lngLat));
  return simplifyRing(projected, tolerance);
}

/** Build one or more THREE.Shape objects (outer ring + holes) for a Polygon/MultiPolygon. */
export function geometryToShapes(geometry: Geometry, projection: GeoProjection, tolerance = 0.9): THREE.Shape[] {
  const polygons: Position[][][] =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];

  return polygons.map((rings) => {
    const [outer, ...holes] = rings;
    const outerXY = ringToXY(outer, projection, tolerance);
    const shape = new THREE.Shape(outerXY.map(([x, y]) => new THREE.Vector2(x, -y)));
    holes.forEach((hole) => {
      const holeXY = ringToXY(hole, projection, tolerance);
      shape.holes.push(new THREE.Path(holeXY.map(([x, y]) => new THREE.Vector2(x, -y))));
    });
    return shape;
  });
}

export function centroidLngLat(feature: Feature): XY {
  return geoCentroid(feature) as XY;
}

export function centroidXY(feature: Feature, projection: GeoProjection): XY {
  const [lng, lat] = centroidLngLat(feature);
  const [x, y] = project(projection, [lng, lat]);
  return [x, -y];
}

export interface BoundsXY {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function boundsXY(feature: Feature, projection: GeoProjection): BoundsXY {
  const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature);
  const corners = [
    project(projection, [minLng, minLat]),
    project(projection, [maxLng, minLat]),
    project(projection, [minLng, maxLat]),
    project(projection, [maxLng, maxLat]),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => -c[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * Converts shape-space [x, y] into world-space [x, y, z], matching the
 * `rotation={[-Math.PI / 2, 0, 0]}` applied to every district group so
 * extruded height reads as "up" on screen.
 */
export function shapeToWorld([x, y]: XY, height = 0): [number, number, number] {
  return [x, height, -y];
}

/** Deterministic 0..1 hash from a string — used to derive stable demo stats. */
export function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
