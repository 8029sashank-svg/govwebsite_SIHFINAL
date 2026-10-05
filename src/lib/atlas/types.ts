import type * as THREE from 'three';
import type { XY, BoundsXY } from './geoUtils';
import type { DemoDistrictStats } from './districtStats';

/** One projected, extrude-ready district, plus its demo dashboard stats. */
export interface AtlasDistrict extends DemoDistrictStats {
  id: string;
  name: string;
  shapes: THREE.Shape[];
  center: XY;
  lngLat: XY;
  bounds: BoundsXY;
}

export interface AtlasOverallBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface AtlasGeoData {
  districts: AtlasDistrict[];
  overallBounds: AtlasOverallBounds;
  sceneWidth: number;
  sceneHeight: number;
}
