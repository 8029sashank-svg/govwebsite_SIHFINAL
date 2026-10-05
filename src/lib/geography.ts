import type { District, Taluka } from './types';
import { hash01 } from './rng';

/**
 * geography.ts
 * ------------
 * Administrative geography of Maharashtra: 6 revenue divisions, 36
 * districts with approximate centroids (WGS84), and a representative set
 * of talukas per district.
 *
 * ACCURACY NOTE: district centroids are approximate (good to a few km —
 * ample for pin placement at state zoom) and the taluka list is
 * representative rather than exhaustive; Maharashtra has 358 talukas in
 * total. Taluka coordinates are deterministically offset from their
 * district centroid. For production, replace this file with the official
 * LGD (Local Government Directory) codes and the state GIS boundary
 * shapefiles published by MRSAC.
 */

interface RawDistrict {
  name: string;
  division: string;
  lat: number;
  lng: number;
  talukas: string[];
}

const RAW: RawDistrict[] = [
  // ---------------------------------------------------------------- Konkan
  { name: 'Mumbai City', division: 'Konkan', lat: 18.94, lng: 72.83, talukas: ['Colaba', 'Byculla', 'Dadar'] },
  { name: 'Mumbai Suburban', division: 'Konkan', lat: 19.12, lng: 72.85, talukas: ['Andheri', 'Borivali', 'Kurla'] },
  { name: 'Thane', division: 'Konkan', lat: 19.22, lng: 72.98, talukas: ['Bhiwandi', 'Kalyan', 'Murbad'] },
  { name: 'Palghar', division: 'Konkan', lat: 19.7, lng: 72.77, talukas: ['Dahanu', 'Vasai', 'Jawhar'] },
  { name: 'Raigad', division: 'Konkan', lat: 18.23, lng: 73.15, talukas: ['Alibag', 'Pen', 'Mahad'] },
  { name: 'Ratnagiri', division: 'Konkan', lat: 16.99, lng: 73.31, talukas: ['Chiplun', 'Dapoli', 'Rajapur'] },
  { name: 'Sindhudurg', division: 'Konkan', lat: 16.05, lng: 73.65, talukas: ['Kudal', 'Malvan', 'Sawantwadi'] },

  // ------------------------------------------------------------------ Pune
  { name: 'Pune', division: 'Pune', lat: 18.52, lng: 73.86, talukas: ['Baramati', 'Junnar', 'Haveli'] },
  { name: 'Satara', division: 'Pune', lat: 17.69, lng: 74.0, talukas: ['Karad', 'Wai', 'Phaltan'] },
  { name: 'Sangli', division: 'Pune', lat: 16.85, lng: 74.58, talukas: ['Miraj', 'Tasgaon', 'Walwa'] },
  { name: 'Solapur', division: 'Pune', lat: 17.66, lng: 75.91, talukas: ['Pandharpur', 'Barshi', 'Akkalkot'] },
  { name: 'Kolhapur', division: 'Pune', lat: 16.7, lng: 74.24, talukas: ['Karvir', 'Hatkanangle', 'Shirol'] },

  // ---------------------------------------------------------------- Nashik
  { name: 'Nashik', division: 'Nashik', lat: 20.0, lng: 73.79, talukas: ['Niphad', 'Dindori', 'Sinnar'] },
  { name: 'Dhule', division: 'Nashik', lat: 20.9, lng: 74.77, talukas: ['Sakri', 'Shirpur', 'Sindkheda'] },
  { name: 'Nandurbar', division: 'Nashik', lat: 21.37, lng: 74.24, talukas: ['Shahada', 'Taloda', 'Navapur'] },
  { name: 'Jalgaon', division: 'Nashik', lat: 21.01, lng: 75.56, talukas: ['Bhusawal', 'Chalisgaon', 'Raver'] },
  { name: 'Ahmednagar', division: 'Nashik', lat: 19.09, lng: 74.74, talukas: ['Rahuri', 'Shrirampur', 'Sangamner'] },

  // ------------------------------------------- Chhatrapati Sambhajinagar
  {
    name: 'Chhatrapati Sambhajinagar',
    division: 'Chhatrapati Sambhajinagar',
    lat: 19.88,
    lng: 75.34,
    talukas: ['Paithan', 'Vaijapur', 'Sillod'],
  },
  { name: 'Jalna', division: 'Chhatrapati Sambhajinagar', lat: 19.84, lng: 75.89, talukas: ['Ambad', 'Bhokardan', 'Partur'] },
  { name: 'Parbhani', division: 'Chhatrapati Sambhajinagar', lat: 19.27, lng: 76.77, talukas: ['Gangakhed', 'Jintur', 'Selu'] },
  { name: 'Hingoli', division: 'Chhatrapati Sambhajinagar', lat: 19.72, lng: 77.15, talukas: ['Basmath', 'Kalamnuri', 'Sengaon'] },
  { name: 'Beed', division: 'Chhatrapati Sambhajinagar', lat: 18.99, lng: 75.76, talukas: ['Ambajogai', 'Georai', 'Parli'] },
  { name: 'Nanded', division: 'Chhatrapati Sambhajinagar', lat: 19.16, lng: 77.32, talukas: ['Kinwat', 'Degloor', 'Mukhed'] },
  { name: 'Dharashiv', division: 'Chhatrapati Sambhajinagar', lat: 18.19, lng: 76.04, talukas: ['Tuljapur', 'Bhoom', 'Paranda'] },
  { name: 'Latur', division: 'Chhatrapati Sambhajinagar', lat: 18.4, lng: 76.58, talukas: ['Ausa', 'Nilanga', 'Udgir'] },

  // -------------------------------------------------------------- Amravati
  { name: 'Amravati', division: 'Amravati', lat: 20.93, lng: 77.75, talukas: ['Achalpur', 'Daryapur', 'Chandur Railway'] },
  { name: 'Akola', division: 'Amravati', lat: 20.71, lng: 77.0, talukas: ['Akot', 'Balapur', 'Murtizapur'] },
  { name: 'Washim', division: 'Amravati', lat: 20.11, lng: 77.13, talukas: ['Risod', 'Malegaon', 'Mangrulpir'] },
  { name: 'Buldhana', division: 'Amravati', lat: 20.53, lng: 76.18, talukas: ['Khamgaon', 'Malkapur', 'Mehkar'] },
  { name: 'Yavatmal', division: 'Amravati', lat: 20.39, lng: 78.13, talukas: ['Pusad', 'Wani', 'Darwha'] },

  // ---------------------------------------------------------------- Nagpur
  { name: 'Nagpur', division: 'Nagpur', lat: 21.15, lng: 79.09, talukas: ['Katol', 'Ramtek', 'Umred'] },
  { name: 'Wardha', division: 'Nagpur', lat: 20.75, lng: 78.6, talukas: ['Hinganghat', 'Arvi', 'Deoli'] },
  { name: 'Bhandara', division: 'Nagpur', lat: 21.17, lng: 79.65, talukas: ['Tumsar', 'Pauni', 'Sakoli'] },
  { name: 'Gondia', division: 'Nagpur', lat: 21.46, lng: 80.2, talukas: ['Tirora', 'Goregaon', 'Deori'] },
  { name: 'Chandrapur', division: 'Nagpur', lat: 19.95, lng: 79.3, talukas: ['Ballarpur', 'Warora', 'Rajura'] },
  { name: 'Gadchiroli', division: 'Nagpur', lat: 20.18, lng: 80.0, talukas: ['Aheri', 'Chamorshi', 'Armori'] },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Surveyed taluka centres, overriding the deterministic offset below.
 * Dindori (Nashik district) is the surveillance focus of this build.
 */
const TALUKA_COORDS: Record<string, [number, number]> = {
  'Nashik:Dindori': [20.2033, 73.835],
  'Nashik:Niphad': [20.0833, 74.1167],
  'Nashik:Sinnar': [19.8453, 74.0014],
};

export const DISTRICTS: District[] = RAW.map((d) => {
  const talukas: Taluka[] = d.talukas.map((t, i) => ({
    id: `${slug(d.name)}-${slug(t)}`,
    name: t,
    district: d.name,
    // Deterministic offset of roughly +/- 0.28 degrees so talukas spread
    // realistically inside the district rather than stacking on the centroid.
    lat: TALUKA_COORDS[`${d.name}:${t}`]?.[0] ?? Number((d.lat + (hash01(`${d.name}-${t}-lat`) - 0.5) * 0.56).toFixed(4)),
    lng: TALUKA_COORDS[`${d.name}:${t}`]?.[1] ?? Number((d.lng + (hash01(`${d.name}-${t}-lng`) - 0.5) * 0.56).toFixed(4)),
  }));

  return { id: slug(d.name), name: d.name, division: d.division, lat: d.lat, lng: d.lng, talukas };
});

export const DIVISIONS: string[] = Array.from(new Set(RAW.map((d) => d.division)));

export const DISTRICT_NAMES: string[] = DISTRICTS.map((d) => d.name);

export const ALL_TALUKAS: Taluka[] = DISTRICTS.flatMap((d) => d.talukas);

const BY_NAME = new Map(DISTRICTS.map((d) => [d.name, d]));

export function getDistrict(name: string): District | undefined {
  return BY_NAME.get(name);
}

export function districtsInDivision(division: string): string[] {
  return DISTRICTS.filter((d) => d.division === division).map((d) => d.name);
}

export function divisionOf(districtName: string): string {
  return BY_NAME.get(districtName)?.division ?? 'Unknown';
}

/** Approximate geographic centre of the state, used as the default map view. */
export const STATE_CENTER: [number, number] = [19.45, 76.4];
export const STATE_ZOOM = 6.4;

/** Haversine distance in kilometres — used to rank scouts by proximity. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
