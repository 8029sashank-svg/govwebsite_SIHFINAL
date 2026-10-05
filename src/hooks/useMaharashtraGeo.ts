'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { makeProjection, geometryToShapes, centroidXY, centroidLngLat, boundsXY } from '@/lib/atlas/geoUtils';
import { buildDemoStats } from '@/lib/atlas/districtStats';
import type { AtlasDistrict, AtlasGeoData } from '@/lib/atlas/types';

const GEOJSON_URL = '/maharashtra_districts.json';
const SCENE_WIDTH = 1000;
const SCENE_HEIGHT = 1000;

type LoadState =
  | { status: 'loading'; error: null; data: null }
  | { status: 'error'; error: string; data: null }
  | { status: 'ready'; error: null; data: AtlasGeoData };

/**
 * useMaharashtraGeo
 * ------------------
 * Ported from the standalone Atlas prototype
 * (src/hooks/useMaharashtraGeo.js). Fetches the district GeoJSON from
 * `public/`, guards against network/parsing failures, fits a single
 * Mercator projection across the whole state, and derives per-district
 * extrude-ready shapes, centroids, bounds and demo stats — once, outside
 * the render loop.
 */
export function useMaharashtraGeo() {
  const [state, setState] = useState<LoadState>({ status: 'loading', error: null, data: null });

  const load = useCallback(() => {
    setState({ status: 'loading', error: null, data: null });

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(GEOJSON_URL);
        if (!res.ok) throw new Error(`GeoJSON request failed (HTTP ${res.status})`);
        const geojson = (await res.json()) as FeatureCollection;
        if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
          throw new Error('Unexpected GeoJSON shape — expected a FeatureCollection.');
        }

        const projection = makeProjection(geojson, SCENE_WIDTH, SCENE_HEIGHT);

        const districts: AtlasDistrict[] = geojson.features.map((feature, i) => {
          const name = (feature.properties?.NAME_2 as string) || `District ${i + 1}`;
          const id = (feature.properties?.ID_2 as string | number | undefined) ?? name;
          const shapes = geometryToShapes(feature.geometry, projection, 0.9);
          const [cx, cy] = centroidXY(feature, projection);
          const [lng, lat] = centroidLngLat(feature);
          const bounds = boundsXY(feature, projection);
          const stats = buildDemoStats(name);

          return {
            id: String(id),
            name,
            shapes,
            center: [cx, cy],
            lngLat: [lng, lat],
            bounds,
            ...stats,
          };
        });

        const overallBounds = districts.reduce(
          (acc, d) => ({
            minX: Math.min(acc.minX, d.bounds.minX),
            maxX: Math.max(acc.maxX, d.bounds.maxX),
            minY: Math.min(acc.minY, d.bounds.minY),
            maxY: Math.max(acc.maxY, d.bounds.maxY),
          }),
          { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
        );

        if (!cancelled) {
          setState({
            status: 'ready',
            error: null,
            data: { districts, overallBounds, sceneWidth: SCENE_WIDTH, sceneHeight: SCENE_HEIGHT },
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load map data.', data: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, retry: load };
}
