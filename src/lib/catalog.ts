/**
 * catalog.ts
 * ----------
 * Reference tables the surveillance domain depends on: what is grown and
 * reared, what attacks it, and what a hectare of it is worth.
 */

export const CROPS = ['Onion'] as const;

/** Livestock is out of scope for the onion build; kept empty so shared filters still compile. */
export const LIVESTOCK: readonly string[] = [];

export interface Pathogen {
  id: string;
  name: string;
  type: string;
  domain: 'CROP' | 'LIVESTOCK';
  subjects: string[];
  /** Flags diseases the source documents describe as causing heavy yield loss. */
  notifiable?: boolean;
  /* ---- Reference data transcribed from the supplied onion PDFs ---- */
  causalAgent?: string;
  /** Crop stage / plant part affected. */
  affects?: 'Seedling' | 'Foliage' | 'Root & bulb' | 'Stored bulb' | 'Whole plant';
  symptoms?: string[];
  survival?: string[];
  favourable?: string[];
  control?: string[];
  /** Short source tags, e.g. "Vikaspedia", "NHRDF/oni002", "Mandal et al. 2022". */
  sources?: string[];
}

const VIK = 'Vikaspedia (NIPHM / DPPQS)';
const ONI = 'Onion Diseases (oni002)';
const MND = 'Mandal et al., J. Agrometeorol. 24(3), 2022';
const BAY = 'Bayer Onion Disease Field Guide';

/**
 * Onion diseases. Every entry below is taken from the supplied PDFs; where
 * two documents give different figures for the same disease (e.g. purple
 * blotch temperature range) both are kept and tagged in `favourable`.
 */
export const PATHOGENS: Pathogen[] = [
  {
    id: 'damping-off',
    name: 'Damping-off',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    notifiable: true,
    causalAgent: 'Fusarium oxysporum f.sp. cepae; Pythium sp.; Sclerotium rolfsii and S. cepivorum; Colletotrichum sp.',
    affects: 'Seedling',
    symptoms: [
      'Pre-emergence damping-off: results in seed and seedling rot before they emerge out of the soil.',
      'Post-emergence damping-off: the pathogen attacks the collar region of seedlings on the surface of soil. The collar portion rots and ultimately the seedlings collapse and die.',
    ],
    survival: ['Pathogen(s) survives on infected crop debris and soil which are source of primary inoculum.'],
    favourable: [
      'More prevalent during Kharif / rainy season and causes about 60-75% damage.',
      'High soil moisture and moderate temperature along with high humidity lead to development of the disease.',
    ],
    control: [
      'Healthy seed should be selected for sowing.',
      'Treat seed with Thiram @ 2 g/kg of seed before sowing.',
      'Avoid continuous raising of nursery in the same plot.',
      'Treat topsoil of nursery with Thiram @ 5 g/m² and drench the nursery with the same chemical @ 2 g/litre of water at fortnightly interval.',
      'Soil solarization by spreading 250 gauge polythene sheet over the bed for 30 days before sowing.',
      'Application of bio-control agent Trichoderma viride in soil @ 1.2 kg/ha is also found effective.',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'purple-blotch',
    name: 'Purple Blotch',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    notifiable: true,
    causalAgent: 'Alternaria porri',
    affects: 'Foliage',
    symptoms: [
      'Symptoms occur on leaves and flower stalks as small, sunken, whitish flecks with purple coloured centres.',
      'Lesions may girdle leaves/stalk and cause their drooping. Infected plants fail to develop bulbs.',
      'Small white sunken spots enlarge, become zonate and, under moist conditions, turn purple; also prominent on the inflorescence and stalks (Mandal et al., 2022).',
      'In moist weather the surface of the spot is covered with brown or almost black sporulation of the fungus; at harvest or later the bulbs of affected plants may show decay (Mandal et al., 2022).',
      'Bayer guide: symptoms begin as water-soaked lesions with a white centre; edges turn brown to purple and dark brown-to-black concentric rings (sporulation) form. Bulb infection is through the neck - bright yellow, semi-watery rot that turns a characteristic red wine colour.',
    ],
    survival: [
      'Soil borne; the fungus survives in soil, infected bulbs and may persist in plant debris or on roots of weeds.',
      'Bayer guide: over-winters as mycelium in leaf debris and cull piles.',
    ],
    favourable: [
      'Hot and humid climate with temperature 21-30°C and relative humidity 80-90% (Vikaspedia / oni002).',
      'Field study, Chiplima (Odisha): max temperature 29-40°C, min temperature 13-24°C and morning relative humidity 60-81% favoured disease development; first symptom in 5th SMW, peak (53.33% CIPDI) in 16th SMW (Mandal et al., 2022).',
      'Bayer guide: spores form on humid nights with leaf wetness greater than 12 hours; 1-4 days needed for symptoms after infection.',
      'More common in Kharif season; intensity varies from season to season.',
    ],
    control: [
      'Use healthy seeds for planting; crop rotation of 2-3 years with non-related crops checks the disease.',
      'Spray Mancozeb (0.25%) or Chlorothalonil (0.2%) or Iprodione (0.25%) one month after transplanting, at fortnightly interval.',
      'Mix sticker Triton / Sandovit in the spray solution.',
      'Bayer guide: use surface rather than sprinkler irrigation, good field drainage and correct plant spacing to minimise leaf wetness.',
    ],
    sources: [VIK, ONI, MND, BAY],
  },
  {
    id: 'stemphylium-blight',
    name: 'Stemphylium Blight',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Stemphylium vesicarium',
    affects: 'Foliage',
    symptoms: [
      'Infection occurs on radial leaves of transplanted seedlings at 3-4 leaf stage during late March and early April.',
      'Small yellowish to orange flecks or streaks in the middle of the leaves, which soon develop into elongated spindle-shaped spots surrounded by pinkish margin.',
      'Disease on the inflorescence stalk causes severe damage to the seed crop.',
      'A serious problem in northern parts of the country, especially in the seed crop; very common on onion leaves and flower stalks.',
    ],
    survival: ['The fungus survives in plant debris or soil.'],
    favourable: ['Warm (18-25°C) humid conditions and long periods of leaf wetness (16 hours or more).'],
    control: [
      'Field sanitation; collect and burn crop residues to minimise spread of infection.',
      'Spray Mancozeb (0.25%) along with Monocrotophos (0.05%) with sticker Triton on appearance of disease, at fortnightly interval.',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'anthracnose',
    name: 'Anthracnose (Twister disease)',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Colletotrichum gloeosporioides or Colletotrichum circinans',
    affects: 'Foliage',
    symptoms: [
      'Symptoms appear initially on the leaves as water-soaked pale yellow spots, which spread lengthwise covering the entire leaf blade.',
      'Affected leaves shrivel and droop down; curling and abnormal elongation of leaves (twister).',
    ],
    survival: ['The fungus can survive for many years as sclerotia in the soil or for shorter periods in infected plant debris.'],
    favourable: [
      'Most severe in warm (25-30°C), moist soils that are high in organic matter.',
      'Fungal growth rapidly decreases below 15°C, resulting in little disease development.',
    ],
    control: [
      'Sanitation and destruction of infected crop debris, since the pathogen survives on crop debris.',
      'Foliar spray of Mancozeb (0.25%), Carbendazim (0.1%) or Thiophanate Methyl (0.1%).',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'basal-rot',
    name: 'Fusarium Basal Rot',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Fusarium oxysporum f.sp. cepae',
    affects: 'Root & bulb',
    symptoms: [
      'Initially yellowing of leaves and stunted growth of plant; later the leaves dry from tip downwards.',
      'In early stage of infection the roots become pink in colour and rotting takes place later.',
      'In advanced stage the bulb starts decaying from lower ends and ultimately the whole plant dies.',
    ],
    survival: ['Pathogen survives in soil and onion bulb as primary source of inoculum in the form of chlamydospores (resting spores) for many years.'],
    favourable: [
      'Incidence is higher where onion is grown continuously.',
      'Moderate temperature of 22-28°C (oni002) / moist soil and 27°C (Vikaspedia) favours development.',
    ],
    control: [
      'Pathogen is soil borne, so it is difficult to control. Mixed cropping and crop rotation reduce incidence.',
      'Soil solarization with 250 gauge polythene sheet in summer for 30 days.',
      'Seed treatment with Thiram (2 g/kg of seed); soil application of Carbendazim, Thiophanate Methyl (Topsin-M) or Benomyl @ 0.1%.',
      'Seedling dip in Carbendazim (0.1%) or with antagonists Pseudomonas cepacia and Trichoderma viride.',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'white-rot',
    name: 'White Rot (Sclerotial rot)',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Sclerotium rolfsii (oni002); Sclerotium cepivorum (damping-off agent list)',
    affects: 'Root & bulb',
    symptoms: [
      'Initial symptoms are yellowing and dieback of leaf tips; later scales, stem plate and roots get destroyed.',
      'Bulbs become soft and water soaked.',
      'White fluffy or cottony mycelium with abundant black sclerotia resembling mustard grain develops on infected bulbs.',
    ],
    survival: ['Fungus survives in soil as sclerotia for many years and can over-winter in infected onion debris and in diseased onion sets.'],
    favourable: ['Most severe in cool and dry soils.'],
    control: [
      'Avoid repeated cultivation of onions on the same piece of land; crop rotation with cereal crops is recommended.',
      'Seed treatment with Thiram (4 g/kg of seed) and drenching of soil with Mancozeb (0.25%).',
      'Application of bio-control agents like Trichoderma viride to the soil reduces disease inoculum.',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'pink-root',
    name: 'Pink Root Rot',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Phoma terrestris (Pyrenochaeta terrestris / Setophoma terrestris - Bayer guide)',
    affects: 'Root & bulb',
    symptoms: [
      'Reduced bulb size; roots turn pink or maroon when infected.',
      'In severe cases roots may die and plants become weakened or stunted, especially in drier areas of the field.',
      'Crop suffering from heat or drought stress due to poor soil is more prone to yield losses.',
    ],
    survival: [
      'Fungus can survive in the soil, in diseased roots and the debris of susceptible crops for several years.',
      'Spread through soil movement and in irrigation water.',
    ],
    favourable: [
      'Can develop at all soil moisture levels that allow onion growth.',
      'Optimum temperatures for pathogen growth and disease development are 24-28°C (little disease below 16°C - Bayer guide).',
    ],
    control: [
      'Bayer guide: plant resistant cultivars where possible; long-term rotation (4-6 years) with non-host crops such as cereals; soil solarisation or fumigation.',
    ],
    sources: [VIK, BAY],
  },
  {
    id: 'downy-mildew',
    name: 'Downy Mildew',
    type: 'Oomycete',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Peronospora destructor',
    affects: 'Foliage',
    symptoms: [
      'Leaves turn pale green; cottony white mycelial growth develops on leaves.',
      'Violet growth of fungus on the surface of leaves or flower stalk, which later becomes pale greenish yellow, then pale yellow to dark brown and dries up; finally leaves or seed stalks collapse.',
    ],
    survival: ['Fungus survives in soil and infected plant debris.'],
    favourable: [
      'Warm and humid climate favours development.',
      'Worst in damp conditions and late planting; higher doses of fertilizers and numerous irrigations increase severity. Reported from northern hilly tracts and plains, particularly high-humidity locations.',
    ],
    control: [
      'Onion bulbs meant for seed crop should be exposed to sun for 12 days to destroy the fungus.',
      'Spray Zineb (0.2%), Karathane (0.1%) or Tridemorph (0.1%).',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'onion-smut',
    name: 'Onion Smut',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Urocystis cepulae',
    affects: 'Seedling',
    symptoms: [
      'Appears on the cotyledon of the young plant soon after it emerges, as elongated dark, slightly thickened areas near the base of seedlings.',
      'Black lesions appear near the base of the scales on planting; affected leaves bend downwards abnormally.',
      'On older plants numerous raised blisters occur near the base of the leaves; lesions at all stages often expose a black powdery mass of spores.',
    ],
    survival: ['The fungus remains in soil.'],
    favourable: ['Occurs in areas where temperature remains below 30°C.'],
    control: [
      'Treat seeds with Captan or Thiram (2.5 g/kg of seed) before sowing.',
      'Seed bed treatment with Methyl Bromide (1 kg/25 m²).',
    ],
    sources: [ONI],
  },
  {
    id: 'smudge',
    name: 'Onion Smudge',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Colletotrichum circinans',
    affects: 'Stored bulb',
    symptoms: [
      'Occurs on white onion varieties and reduces market value of the bulbs.',
      'Small dark green to black spots appear on the outer scales.',
    ],
    survival: ['Bayer guide: over-winters in soil and can be introduced on infected bulbs.'],
    favourable: ['Bayer guide: warm moist conditions; infection at 20-26°C with free moisture.'],
    control: [
      'Thorough curing of the bulb after harvesting and storing the bulbs in well-ventilated rooms.',
      'Bayer guide: yellow and red skinned varieties can be used where pressure is high.',
    ],
    sources: [ONI, BAY],
  },
  {
    id: 'black-mould',
    name: 'Black Mould',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Aspergillus niger',
    affects: 'Stored bulb',
    symptoms: [
      'Infection usually through neck tissues as foliage dies down at maturity.',
      'Infected bulbs are discoloured black around the neck and affected scales shrivel.',
      'Masses of powdery black spores develop as streaks along veins on and between outer dry scales; may advance from the neck into the central fleshy scales. Reduces market value.',
    ],
    survival: [
      'Fungus survives in air, soil and infected plant debris.',
      'Spores are very common in the air and soil and are the source of infection.',
    ],
    favourable: [
      'Common in onions stored in hot climates, 30-45°C (oni002); most common above 30°C in the field or 24°C in storage (Vikaspedia).',
      'Free moisture for six hours or longer on the onion surface is necessary for infection.',
    ],
    control: [
      'Leave bulbs drying in the field for two days, then dry further in shade for 10-15 days before storage.',
      'Avoid injury to bulbs during post-harvest handling.',
      'Spray the crop with Carbendazim (0.2%) 10-15 days before harvesting.',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'green-mould',
    name: 'Green Mould',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    affects: 'Stored bulb',
    symptoms: [
      'Infection usually through neck tissues as foliage dies down at maturity.',
      'Infected bulbs are discoloured green around the neck and affected scales shrivel.',
      'Masses of powdery green spores arranged as streaks along veins on and between outer dry scales; infection may advance from the neck into the central fleshy scales.',
    ],
    survival: ['Spores are very common in the air and soil and act as the source of infection.'],
    favourable: [
      'Most common when temperatures are higher than 30°C in the field or 24°C in storage.',
      'Free moisture for six hours or longer on the onion surface is conducive to infection.',
    ],
    control: ['Not listed separately in the supplied PDFs; see Black Mould post-harvest drying and handling practices.'],
    sources: [VIK],
  },
  {
    id: 'neck-rot',
    name: 'Neck Rot',
    type: 'Fungal',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Botrytis allii',
    affects: 'Stored bulb',
    symptoms: [
      'Infection usually takes place in the field and symptoms become evident in storage.',
      'The fungus causes softening of the scales which appear water soaked; under moist conditions a greyish fungal mat develops on the surface of the scales.',
    ],
    survival: ['Bayer guide: sporulates on dead and decaying tissue and from sclerotia; conidia are wind-disseminated.'],
    favourable: [
      'More severe when moist conditions prevail just before and during harvest and while onions are cured in the field.',
      'Excessive nitrogen and untimely irrigation increase incidence; more severe in mild than in pungent onions.',
    ],
    control: [
      'Leave bulbs for drying in the field for two days; dry further in shade for 10-15 days before storage.',
      'Avoid injury to the bulbs during post-harvest handling.',
      'Spray the crop with Carbendazim (0.2%) 10-15 days before harvesting.',
    ],
    sources: [ONI, BAY],
  },
  {
    id: 'bacterial-soft-rot',
    name: 'Bacterial Soft Rot',
    type: 'Bacterial',
    domain: 'CROP',
    subjects: ['Onion'],
    affects: 'Stored bulb',
    symptoms: [
      'Mainly a problem on mature bulbs. Affected scales first appear water-soaked and pale yellow to light brown.',
      'As the rot progresses, invaded fleshy scales become soft and sticky with the interior of the bulb breaking down.',
      'A watery, foul-smelling thick liquid can be squeezed from the neck of diseased bulbs.',
    ],
    survival: [
      'Soil borne; after heavy rains and when leaves are drying, the main sources of inoculum are contaminated soil and crop residues.',
      'Also spread by splashing rain, irrigation water and insects.',
    ],
    favourable: [
      'Warm, humid conditions with an optimum temperature range of 20-30°C.',
      'During storage or transit soft rot can develop when temperatures are above 3°C.',
    ],
    control: ['Not listed in the supplied control notes; see Bacterial Brown Rot for curing and drying practice.'],
    sources: [VIK],
  },
  {
    id: 'bacterial-brown-rot',
    name: 'Bacterial Brown Rot',
    type: 'Bacterial',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Pseudomonas aeruginosa',
    affects: 'Stored bulb',
    symptoms: [
      'Field symptoms: one or two wilted leaves in the center of the leaf cluster, which turn pale yellow and die back from the tip.',
      'Early stage: bulbs may appear healthy except for softening of the neck tissue; in longitudinal section one or more inner scales become watery or cooked. Rot progresses from top of the scale to the base; eventually internal scales dry and the bulb shrivels.',
      'Squeezing the base causes the rotted inner portion to slide out through the neck ("slippery skin"); foul smell through the neck.',
    ],
    survival: ['Soil-borne; readily water-splashed to foliage and necks where it enters through wounds.'],
    favourable: [
      'Requires moisture for infection; grows in the temperature range of 5-41°C.',
      'Heavy irrigation and persistent dews are also conducive.',
    ],
    control: [
      'Proper curing and rapid drying of bulbs after harvesting is essential; discard affected bulbs before storage.',
      'If rains occur during maturity, spray Streptocycline (0.02%).',
    ],
    sources: [VIK, ONI],
  },
  {
    id: 'iris-yellow-spot',
    name: 'Iris Yellow Spot Virus',
    type: 'Viral',
    domain: 'CROP',
    subjects: ['Onion'],
    notifiable: true,
    causalAgent: 'Iris yellow spot virus (IYSV), transmitted by onion thrips (Thrips tabaci)',
    affects: 'Foliage',
    symptoms: [
      'Cream, elliptical (diamond-shaped) spots on leaves, onion scapes or flower stalks.',
      'As infected leaves and scapes age they can collapse at the site of the spots; spots may be clear or less obvious.',
      'Although the spots may at first be insignificant, the disease has the potential of devastating the whole crop.',
    ],
    survival: ['Not seed transmitted. Over-wintering onions, volunteers from prior productions, infected transplants and alternate hosts can all serve as sources of both vector and virus.'],
    favourable: ['Onion thrips transmit IYSV in a persistent manner; disease severity is positively correlated with thrips populations in the field.'],
    control: ['Not listed in the supplied control notes; the PDFs identify thrips population as the driver.'],
    sources: [VIK],
  },
  {
    id: 'yellow-dwarf',
    name: 'Onion Yellow Dwarf',
    type: 'Viral',
    domain: 'CROP',
    subjects: ['Onion'],
    causalAgent: 'Onion yellow dwarf virus',
    affects: 'Whole plant',
    symptoms: [
      'First symptoms in young onions are yellow streaks at the bases of the first true leaves; later leaves show yellow streaks to complete yellowing.',
      'Severe stunting, dwarfing and twisting of the flower stalk; leaves flatten, crinkle and bend over. Bulbs are undersized.',
    ],
    survival: ['Carried by infected seed bulbs, onion sets and volunteer onions; transmitted mechanically and by many aphid species.'],
    favourable: ['Spread by insect vectors (aphids) from infected to healthy plants.'],
    control: [
      'Removal and destruction of diseased plants; use healthy bulbs for seed production.',
      'Spray Malathion (0.1%) or Metasystox (0.1%) to control the vectors.',
    ],
    sources: [VIK, ONI],
  },
];

/** Indicative yield and mandi price assumptions per hectare. */
export const ECONOMICS: Record<string, { unitYield: number; unitPrice: number; unit: string }> = {
  // 11.33 MT/ha = 113.3 qtl/ha (Odisha 2017-18, Anonymous 2018, cited in Mandal et al. 2022).
  // Price is NOT in the supplied PDFs - it is an editable assumption.
  Onion: { unitYield: 113.3, unitPrice: 1500, unit: 'qtl/ha' },
};

/**
 * Model confidence below which a diagnosis MUST be signed off by a human
 * expert before it can influence advisories or dispatch. This single
 * constant is the AI-governance threshold for the whole platform.
 */
export const REVIEW_THRESHOLD = 75;

export const SEVERITY_META = {
  HIGH: { label: 'High risk', color: '#dc2626', chip: 'bg-red-50 text-red-700 ring-red-200' },
  MEDIUM: { label: 'Medium risk', color: '#ea580c', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  LOW: { label: 'Low risk', color: '#16a34a', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
} as const;

export const STATUS_META = {
  PENDING_REVIEW: { label: 'Pending review', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  VERIFIED: { label: 'Verified', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Rejected', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  DISPATCHED: { label: 'Dispatched', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
  IN_PROGRESS: { label: 'In progress', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  RESOLVED: { label: 'Resolved', chip: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
} as const;

/**
 * Fixed "current time" for the demo dataset.
 *
 * Every relative timestamp in the UI is computed against this constant
 * rather than Date.now(), which keeps server-rendered and client-rendered
 * markup identical (no hydration mismatch) and keeps the dataset stable.
 * Point this at Date.now() when real data arrives.
 */
export const DEMO_NOW = new Date('2026-09-19T09:30:00+05:30').getTime();
