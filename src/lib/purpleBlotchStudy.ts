/**
 * purpleBlotchStudy.ts
 * --------------------
 * Verbatim tables from: Mandal, D., Pal, R. and Kar, I. (2022). "Effect of
 * weather parameters on the progression and development of purple blotch of
 * onion." Journal of Agrometeorology 24(3): 325-327.
 * DOI 10.54386/jam.v24i3.1676
 *
 * Site: RRTTS, Chiplima, Sambalpur, Odisha (20°21'N, 80°55'E, 178.8 m MSL).
 * Variety Nasik Red, rabi 2017-18 and 2018-19 (pooled), natural infection.
 */

export const STUDY_CITATION =
  'Mandal, Pal & Kar (2022), Journal of Agrometeorology 24(3): 325-327 - doi:10.54386/jam.v24i3.1676';

export const STUDY_SITE =
  'RRTTS, Chiplima, Sambalpur, Odisha · variety Nasik Red · rabi 2017-18 & 2018-19 (pooled)';

/** Table 1 - 0-5 point disease rating scale (Mayee & Datar, 1986). */
export const DISEASE_SCALE = [
  { score: 0, grade: 'Healthy', description: 'No disease' },
  { score: 1, grade: 'Traces', description: '<5% leaf area affected' },
  { score: 2, grade: 'Light', description: '6-10% leaf area affected' },
  { score: 3, grade: 'Moderate', description: '11-25% leaf area affected' },
  { score: 4, grade: 'High', description: '26-50% leaf area affected' },
  { score: 5, grade: 'Very high', description: '>50% leaf area affected' },
] as const;

export const PDI_FORMULA = 'PDI = (Sum of all numerical ratings ÷ (No. of observations × Maximum rating)) × 100';

export interface StudyWeek {
  smw: number;
  /** Cumulative increase in disease (CIPDI), % */
  cipdi: number;
  /** Periodical increment in disease (PIPDI), % */
  pipdi: number;
  tMax: number;
  tMin: number;
  rhMorning: number;
  rhEvening: number;
  rainfallMm: number;
}

/** Table 2 - disease progress vs weather, pooled 2017-18 and 2018-19. */
export const STUDY_WEEKS: StudyWeek[] = [
  { smw: 4, cipdi: 0.0, pipdi: 0.0, tMax: 28.6, tMin: 12.1, rhMorning: 78.6, rhEvening: 36.1, rainfallMm: 0.0 },
  { smw: 5, cipdi: 7.67, pipdi: 7.67, tMax: 29.4, tMin: 13.2, rhMorning: 75.8, rhEvening: 32.4, rainfallMm: 0.0 },
  { smw: 6, cipdi: 12.0, pipdi: 4.33, tMax: 30.4, tMin: 13.7, rhMorning: 72.8, rhEvening: 31.4, rainfallMm: 0.0 },
  { smw: 7, cipdi: 14.33, pipdi: 2.33, tMax: 31.0, tMin: 14.2, rhMorning: 74.6, rhEvening: 33.9, rainfallMm: 2.6 },
  { smw: 8, cipdi: 17.67, pipdi: 3.34, tMax: 32.4, tMin: 14.9, rhMorning: 73.3, rhEvening: 29.6, rainfallMm: 0.0 },
  { smw: 9, cipdi: 19.33, pipdi: 1.66, tMax: 33.9, tMin: 15.3, rhMorning: 69.9, rhEvening: 31.3, rainfallMm: 0.0 },
  { smw: 10, cipdi: 20.33, pipdi: 1.0, tMax: 34.6, tMin: 16.8, rhMorning: 67.3, rhEvening: 32.9, rainfallMm: 2.0 },
  { smw: 11, cipdi: 24.0, pipdi: 3.67, tMax: 33.6, tMin: 16.2, rhMorning: 70.7, rhEvening: 31.7, rainfallMm: 0.9 },
  { smw: 12, cipdi: 32.0, pipdi: 8.0, tMax: 34.6, tMin: 17.6, rhMorning: 75.1, rhEvening: 30.1, rainfallMm: 0.5 },
  { smw: 13, cipdi: 44.0, pipdi: 12.0, tMax: 35.6, tMin: 18.9, rhMorning: 80.4, rhEvening: 32.9, rainfallMm: 0.0 },
  { smw: 14, cipdi: 51.67, pipdi: 7.67, tMax: 36.8, tMin: 20.9, rhMorning: 81.0, rhEvening: 37.7, rainfallMm: 0.0 },
  { smw: 15, cipdi: 52.0, pipdi: 0.33, tMax: 38.7, tMin: 21.9, rhMorning: 59.6, rhEvening: 23.0, rainfallMm: 0.0 },
  { smw: 16, cipdi: 53.33, pipdi: 1.33, tMax: 40.1, tMin: 24.0, rhMorning: 72.4, rhEvening: 29.8, rainfallMm: 0.0 },
];

export interface StudyCorrelation {
  parameter: string;
  cipdi: number;
  pipdi: number;
  cipdiSignificant: boolean;
  pipdiSignificant: boolean;
}

/** Table 3 - correlation of weather parameters with CIPDI / PIPDI (** = significant). */
export const STUDY_CORRELATIONS: StudyCorrelation[] = [
  { parameter: 'Maximum temperature', cipdi: 0.875, pipdi: 0.183, cipdiSignificant: true, pipdiSignificant: false },
  { parameter: 'Minimum temperature', cipdi: 0.967, pipdi: 0.235, cipdiSignificant: true, pipdiSignificant: false },
  { parameter: 'Rainfall', cipdi: -0.044, pipdi: -0.185, cipdiSignificant: false, pipdiSignificant: false },
  { parameter: 'Maximum (morning) relative humidity', cipdi: 0.428, pipdi: 0.059, cipdiSignificant: false, pipdiSignificant: false },
  { parameter: 'Minimum (evening) relative humidity', cipdi: 0.766, pipdi: -0.296, cipdiSignificant: true, pipdiSignificant: false },
];

/** Headline findings stated in the paper. */
export const STUDY_FINDINGS = [
  'Disease development and spread was observed from the 5th to the 16th standard meteorological week (SMW); first symptom in 5th SMW.',
  'Peak disease: 53.33% CIPDI at the 16th SMW, with a maximum temperature of 40°C.',
  'Maximum temperature 29-40°C and minimum temperature 13-24°C prevailed during disease development and spread.',
  'Morning relative humidity of 60-81% was suitable for disease development; the paper also reports 60-81% evening RH as favourable.',
  'Highest periodical increment (12.0% PIPDI) was in the 13th SMW (average minimum temperature 19.0°C, evening RH 33%).',
  'Rainfall showed a non-significant negative correlation with both CIPDI (r = -0.044) and PIPDI (r = -0.185).',
  'Onion in Odisha, 2017-18: area 33.47 thousand ha, production 379.34 thousand MT, productivity 11.33 MT/ha. Purple blotch causes 30-100% yield loss in seed and bulb crop.',
] as const;
