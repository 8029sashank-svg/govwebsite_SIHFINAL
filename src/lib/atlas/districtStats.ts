import { hash01 } from './geoUtils';

/**
 * districtStats.ts
 * ----------------
 * Ported from the standalone Atlas prototype (src/data/districtStats.js).
 *
 * The Atlas's own source GeoJSON (GADM-derived, 34 features, pre-2014
 * boundaries) carries no population/development attributes, and — unlike
 * the rest of GeoFarm.gov, which models 36 current districts via
 * src/lib/geography.ts — it also predates the Palghar split and the
 * 2023 Aurangabad/Osmanabad/Bid/Buldana renames. Rather than quietly
 * reconciling two different district rosters (which would misattribute
 * demo numbers to boundaries that don't quite match), every numeric stat
 * here stays an explicitly-labelled DEMO index, deterministically derived
 * from each polygon's own name so it's stable across reloads.
 */

export const TOP_PLACES: Record<string, string[]> = {
  Ahmednagar: ['Shirdi', 'Ahmednagar Fort'],
  Akola: ['Akola city', 'Narnala Fort'],
  Amravati: ['Chikhaldara', 'Amravati city'],
  Aurangabad: ['Ajanta Caves', 'Ellora Caves'],
  Bhandara: ['Bhandara city', 'Nagzira Wildlife Sanctuary'],
  Bid: ['Bid city', 'Kaij'],
  Buldana: ['Lonar Crater Lake', 'Buldhana city'],
  Chandrapur: ['Tadoba Andhari Tiger Reserve', 'Chandrapur Fort'],
  Dhule: ['Dhule city', 'Laling Fort'],
  Garhchiroli: ['Markanda Temple Complex', 'Gadchiroli town'],
  Gondiya: ['Nagzira Wildlife Sanctuary', 'Gondia city'],
  'Greater Bombay': ['Gateway of India', 'Marine Drive'],
  Hingoli: ['Aundha Nagnath Temple', 'Hingoli town'],
  Jalgaon: ['Unapdev Hot Springs', 'Jalgaon city'],
  Jalna: ['Jalna city', 'Ambad'],
  Kolhapur: ['Mahalakshmi Temple', 'Panhala Fort'],
  Latur: ['Latur city', 'Ausa Fort'],
  Nagpur: ['Deekshabhoomi', 'Sitabuldi Fort'],
  Nanded: ['Hazur Sahib Gurudwara', 'Nanded city'],
  Nandurbar: ['Toranmal Hill Station', 'Nandurbar town'],
  Nashik: ['Trimbakeshwar Temple', 'Sula Vineyards'],
  Osmanabad: ['Tuljabhavani Temple', 'Osmanabad city'],
  Parbhani: ['Parbhani city', 'Jintur'],
  Pune: ['Shaniwar Wada', 'Sinhagad Fort'],
  Raigarh: ['Raigad Fort', 'Alibaug'],
  Ratnagiri: ['Ratnadurg Fort', 'Ganpatipule'],
  Sangli: ['Sangli city', 'Vasantgad Fort'],
  Satara: ['Kaas Plateau', 'Ajinkyatara Fort'],
  Sindhudurg: ['Sindhudurg Fort', 'Tarkarli Beach'],
  Solapur: ['Siddheshwar Temple', 'Solapur Fort'],
  Thane: ['Yeoor Hills', 'Tansa Wildlife Sanctuary'],
  Wardha: ['Sevagram Ashram', 'Paunar Ashram'],
  Washim: ['Washim city', 'Balaji Temple'],
  Yavatmal: ['Yavatmal city', 'Pusad'],
};

export const SIGNATURE: Record<string, string> = {
  Nashik: 'Wine capital of India — grapes & onion belt',
  Pune: 'IT & auto manufacturing hub',
  'Greater Bombay': 'Financial capital of India',
  Nagpur: 'Orange City — citrus & logistics hub',
  Kolhapur: 'Sugar belt & leather craft',
  Solapur: 'Textiles & handloom (Solapur chaddar)',
  Aurangabad: 'UNESCO heritage & auto components',
  Thane: 'Industrial belt, Mumbai Metropolitan Region',
  Amravati: 'Cotton trading hub, Vidarbha',
  Chandrapur: 'Coal & tiger-reserve forestry belt',
};

export interface DemoDistrictStats {
  devIndex: number;
  populationIndex: number;
  growthTrend: number;
  literacyDemo: number;
  topPlaces: string[];
  signature: string;
}

function seededRange(seed: string, min: number, max: number): number {
  return Math.round(min + hash01(seed) * (max - min));
}

export function buildDemoStats(districtName: string): DemoDistrictStats {
  const devIndex = seededRange(`${districtName}-dev`, 32, 96);
  const populationIndex = seededRange(`${districtName}-pop`, 18, 100);
  const growthTrend = seededRange(`${districtName}-growth`, -4, 12);
  const literacyDemo = seededRange(`${districtName}-lit`, 68, 94);
  return {
    devIndex,
    populationIndex,
    growthTrend,
    literacyDemo,
    topPlaces: TOP_PLACES[districtName] || [`${districtName} town center`],
    signature: SIGNATURE[districtName] || 'Agriculture & allied trade',
  };
}
