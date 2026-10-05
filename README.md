# GeoFarm.gov — Agricultural Surveillance & Health Management System

A state-level GIS surveillance console for crop **and** animal health, built for the
Department of Agriculture & Animal Husbandry, Government of Maharashtra.

Farmer-reported cases are triaged by an AI model, low-confidence diagnoses are held for
human expert sign-off, field scouts are dispatched to verify on the ground, advisories are
broadcast to registered farmers, and every consequential action is written to an audit
trail carrying the officer's identity, timestamp and source IP.

---

## 1. Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start    # production build
npm run typecheck             # strict TypeScript, no emit
```

Node 18.17+ required. No API keys, no environment variables, no backend — the prototype is
entirely self-contained.

### Demo accounts

Sign-in is on the landing page; click any account to fill the form.

| Level | Email | Employee code | Posting | Sees |
|---|---|---|---|---|
| State | `commissioner.agri@gov.in` | `MH-AGRI-S001` | — | All 36 districts |
| Division | `jd.nashik@gov.in` | `MH-AGRI-DV002` | Nashik | 5 districts of Nashik Division |
| District | `sao.nashik@gov.in` | `MH-AGRI-DT014` | Nashik | Nashik only |
| Taluka | `tao.dindori@nic.in` | `MH-AGRI-TL087` | Nashik / Dindori | Dindori taluka only |

The **employee code prefix selects the role**: `S` state, `DV` division, `DT` district,
`TL` taluka. Only `@gov.in` and `@nic.in` addresses are accepted. Sign in as the state
commissioner and then as the taluka officer to see the map, the case tables, the KPIs, the
broadcast targets and the audit visibility all narrow automatically.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict | Route-group layouts keep the shell mounted across screens |
| Styling | Tailwind CSS 3.4 + design tokens | Severity colours defined once, used by map, charts, badges and tables |
| Icons | lucide-react | |
| GIS | Leaflet 1.9 + react-leaflet 4 | No access token, so nothing to leak; works air-gapped once tiles are mirrored |
| Heatmap | Custom `L.Layer` canvas (`HeatmapLayer.tsx`) | `leaflet.heat` is unmaintained and untyped |
| Charts | Recharts 2.12 | |
| State | Zustand 4.5 | Three small stores, no provider tree |

**Why Leaflet rather than Mapbox GL.** The brief allows either. Leaflet needs no Mapbox token.
Basemap tiles come from CARTO's raster service, which now needs a free key
(`NEXT_PUBLIC_CARTO_KEY` in `.env.local`, see "Basemap API key" below), and can be swapped for a departmental or MRSAC tile server
by changing one URL. See §7 for the Mapbox migration path — the pin, filter and heatmap
logic are deliberately renderer-independent.

---

## 3. Project structure

```
src/
├─ app/
│  ├─ layout.tsx                 Root shell, metadata
│  ├─ globals.css                Tokens, Leaflet dark theme, print rules
│  ├─ page.tsx                   RBAC sign-in gateway
│  └─ (console)/                 Authenticated route group
│     ├─ layout.tsx              Mounts ConsoleShell (sidebar + topbar + auth guard)
│     ├─ dashboard/page.tsx      ① Situation overview: KPIs, embedded map, intake table
│     ├─ map/page.tsx            ① GIS map, filters, heatmap toggle, case inspector
│     ├─ review/page.tsx         ② AI governance queue: approve / modify / reject
│     ├─ dispatch/page.tsx       ③ Scout assignment + status tracker
│     ├─ analytics/page.tsx      ⑤ Trend charts + CSV/PDF export
│     ├─ broadcast/page.tsx      ⑥ Emergency advisory composer
│     ├─ impact/page.tsx         ⑦ ₹ Loss Prevented estimator
│     └─ audit/page.tsx          ⑧ Security audit log viewer
│
├─ components/
│  ├─ ui.tsx                     Panel, Button, Badge, StatCard, Meter, Modal, Skeletons
│  ├─ DataTable.tsx              Generic sortable + paginated responsive table
│  ├─ ConsoleShell.tsx           Sidebar, top bar, hierarchy indicator, auth guard
│  └─ map/
│     ├─ GisMap.tsx              SSR-safe wrapper, LayerToggles, MapFilters, MapLegend
│     ├─ MapCanvas.tsx           Leaflet map, case pins, scout pins, viewport control
│     └─ HeatmapLayer.tsx        Custom canvas risk-surface layer
│
├─ lib/
│  ├─ types.ts                   Domain contract — the API must match these shapes
│  ├─ geography.ts               6 divisions, 36 districts, talukas, haversine
│  ├─ catalog.ts                 Crops, livestock, pathogens, prices, thresholds
│  ├─ mockData.ts                Deterministic demo dataset (420 cases, 48 scouts…)
│  ├─ rng.ts                     Seeded hash PRNG
│  ├─ rbac.ts                    Roles, capability matrix, jurisdiction scoping
│  ├─ format.ts                  INR/date formatting + the economic impact model
│  └─ exporters.ts               CSV download + letterheaded print-to-PDF
│
└─ store/
   ├─ useSession.ts              Signed-in officer, localStorage hydration
   ├─ useOps.ts                  Case decisions, dispatches, broadcasts, audit
   ├─ useFilters.ts              Shared map/table filters + pure `applyFilters`
   └─ hooks.ts                   useScopedCases / useFilteredCases / useScopedScouts
```

### Two design decisions worth knowing before you edit anything

**Everything random is seeded.** `lib/rng.ts` hashes a string to a number; the entire mock
dataset is a pure function of those seeds, generated once at module scope. `Math.random()`
would produce different values on the server and the client and trigger hydration
mismatches; it would also make every reload show different numbers, which makes demos and
screenshots impossible to reproduce. For the same reason, relative timestamps are measured
against `DEMO_NOW` in `lib/catalog.ts` rather than `Date.now()`. **When you wire real data,
point `DEMO_NOW` at `Date.now()`.**

**Case decisions are a sparse overlay.** `useOps` does not copy 420 case records into the
store. It keeps a `Record<caseId, CaseOverride>` and merges on read. Updates stay O(1), the
set of human-modified cases is trivially inspectable, and it mirrors how a backend would
store a decision table alongside source records. The consequence for component code: **memos
must depend on `overrides`, not on the `cases()` function** — zustand keeps action
identities stable, so depending on the function alone means a sign-off never propagates.
`store/hooks.ts` gets this right; copy its pattern.

---

## 4. The eight modules

**① GIS map & heatmap** — `map/page.tsx`, `components/map/*`.
Case pins are `L.divIcon`s (no image requests, so 400+ markers stay cheap), filled by
severity, ringed amber when awaiting review, pulsing when high-severity. The Nightly
Prediction Engine layer is a two-pass canvas heatmap: radial alpha gradients accumulate into
a buffer, then the accumulated alpha is mapped through a colour ramp, so overlapping risk
cells reinforce rather than overpaint. Radius scales with zoom, so a cell keeps a constant
ground footprint. Filters (domain, crop/species, date window, severity, free text) live in
`useFilters` and drive the map, the side list and the tables from one source.

**② Case review queue** — `review/page.tsx`.
The governance rule: a diagnosis below `REVIEW_THRESHOLD` (75%) cannot drive an advisory, a
dispatch or a compensation claim until a named officer signs it off. The dossier shows the
submission image, farmer identity and KYC status, the model's confidence against the
threshold, and the channel it arrived on. Three exits — approve, sign off as corrected,
reject — each writing an audit entry. A severity override is logged *separately* as a
critical action, because overriding the model's severity is a different act from confirming
its diagnosis.

Thumbnails are generated SVG, seeded from the case. The prototype ships no photographs of
real farms, animals or people.

**③ Field dispatch** — `dispatch/page.tsx`.
Selecting a case ranks scouts by availability → great-circle distance (haversine, in
`geography.ts`) → historic verification accuracy, and shows all three so an officer who
overrides the ranking can see what they are overriding. Assignment moves the case to
`DISPATCHED` and opens a four-stage tracker: Pending → Assigned → In Progress → Resolved,
with a confirmed / not-found outcome on close.

**④ RBAC & jurisdiction scoping** — `lib/rbac.ts`, `store/hooks.ts`.
`scopeFor(officer)` resolves an officer to a district list; `withinScope()` filters any
record carrying `district`/`taluka`; `viewportFor()` sets the initial map centre and zoom.
Navigation items declare the capability they need, so a taluka officer never sees the
broadcast console rather than seeing it and being refused. The audit log additionally splits
on `VIEW_AUDIT_ALL` vs `VIEW_AUDIT_OWN` — you can audit yourself and be audited from above,
but not audit your peers.

**⑤ Trend analytics & export** — `analytics/page.tsx`.
Weekly buckets from `buildTrends(districts, weeks)`, scoped to jurisdiction: stacked severity
area, reported-vs-resolved lines, severity donut, top pathogens, crop-vs-livestock by
district. CSV downloads immediately. "PDF" opens a letterheaded print view with a tricolour
rule, scope/period/officer metadata and a signature block, then calls `window.print()` — the
operator chooses *Save as PDF*. That is how most departmental portals produce PDFs without a
server-side renderer; §7 covers the real thing.

**⑥ Emergency broadcast** — `broadcast/page.tsx`.
Templates with `{pathogen}` / `{subject}` / `{zone}` substitution, district or taluka
targeting restricted to the officer's jurisdiction, four channels, three languages, a
handset preview, and a confirmation modal that names the officer and IP the action will be
recorded against. Reach is the **union** of channel penetrations, not their sum: selecting
every channel cannot exceed 100%, because a farmer registered on both SMS and WhatsApp is
one person.

**⑦ Economic impact estimator** — `impact/page.tsx`, `estimateImpact()` in `lib/format.ts`.

```
base       = extent × unitYield × unitPrice
exposure   = base × lossRate(severity) × spreadFactor      HIGH .62 / MED .34 / LOW .12
speedBonus = max(0.55, 1 − lagDays × 0.064)                full credit same-day
prevented  = exposure × reach% × efficacy% × speedBonus
```

Only cases that were actually actioned (verified, dispatched, in progress, resolved) count.
Every coefficient is a slider, the formula is printed under the sliders, and a sortable
table shows each case's contribution — so the ₹ figure that ends up in a cabinet note can be
reconstructed line by line, and marginal questions ("what is one day of lag worth?") are
answered on screen.

**⑧ Audit log** — `audit/page.tsx`.
Read-only by construction: no edit or delete path to the audit array exists anywhere in the
application. Filter by action, classification or free text; export to CSV. Exporting is
itself audited.

---

## 5. Where the mock data is, and what to replace it with

| Constant / function (`src/lib/mockData.ts`) | Becomes |
|---|---|
| `CASES` (420 records) | `GET /api/cases?scope=…` |
| `REVIEW_QUEUE` | `GET /api/cases?status=PENDING_REVIEW` |
| `SCOUTS` (48) | `GET /api/scouts?district=…` |
| `RISK_SURFACE`, `DISTRICT_RISK` | `GET /api/predictions/nightly` |
| `buildTrends()` | `GET /api/analytics/trends?weeks=…` |
| `SEED_AUDIT` | `GET /api/audit` (read replica, append-only store) |
| `FARMER_BASE` | `GET /api/farmers/registered-counts` |

| Elsewhere | Replace with |
|---|---|
| `lib/geography.ts` | Official LGD codes + MRSAC boundary shapefiles (the 36 centroids are approximate and the taluka list is representative, not all 358) |
| `ECONOMICS` in `lib/catalog.ts` | AGMARKNET mandi price feed |
| `DEMO_NOW` in `lib/catalog.ts` | `Date.now()` |
| `useOps` mutations | `POST /api/cases/:id/decision`, `/dispatches`, `/broadcasts` |

Keep the shapes in `lib/types.ts` and no component needs to change. The store actions are
the only place that mutates, so making them `async` and awaiting a POST is a contained edit.

---

## 6. Before this goes near production

The prototype is deliberately honest about what it is. Five things must change:

1. **RBAC is presentation-tier only.** `scopeFor()` decides what the UI renders; it is not
   an authorisation control. Re-derive the same scope server-side from a signed session and
   filter at the query layer, or a modified client can request out-of-jurisdiction records
   directly from the API.
2. **The session lives in `localStorage`.** Replace with an httpOnly, `Secure`, `SameSite`
   session cookie issued after authenticating against the NIC directory (SSO/LDAP), with a
   short TTL and server-side revocation.
3. **The audit trail lives in memory.** Write each entry to an append-only store — a WORM
   object bucket, or a hash-chained table where every row carries the digest of its
   predecessor — so tampering is detectable. The console holds read-only credentials against
   it.
4. **PDF export is the browser's print dialog.** For a signed, archival document, POST the
   same rows to a Puppeteer or WeasyPrint service and return a digitally signed PDF.
5. **The IP addresses are mocked.** Capture the client IP server-side from the request;
   never trust a value supplied by the browser.

Also worth doing: rate-limit the broadcast endpoint (an emergency advisory to 180,000
farmers is expensive and irreversible), add a second-officer countersign for
`EMERGENCY`-priority broadcasts, and mirror tiles locally so the map works when the
department's outbound internet does not.

---

## 7. Migrating the map to Mapbox GL JS

The renderer is isolated in `components/map/`. The filter state, the pin colour rules, the
risk surface and the jurisdiction viewport are all plain data.

1. `npm i mapbox-gl`, set `NEXT_PUBLIC_MAPBOX_TOKEN`.
2. Replace `MapCanvas.tsx`'s `<MapContainer>`/`<TileLayer>` with a `mapbox-gl` instance —
   keep the same props interface (`cases`, `scouts`, `officer`, `showPins`, `showHeatmap`,
   `showScouts`, `focus`, `onSelectCase`).
3. Pins become a GeoJSON source with a `circle` layer; drive `circle-color` from a
   `match` expression on `severity` using the same hex values in `SEVERITY_META`.
4. The custom canvas heatmap is replaced by Mapbox's native `heatmap` layer with
   `heatmap-weight` bound to the `weight` property of `RISK_SURFACE`; `HeatmapLayer.tsx` can
   then be deleted.
5. `viewportFor()` already returns `{ center: [lat, lng], zoom }` — note Mapbox takes
   `[lng, lat]`, so reverse the pair.

`GisMap.tsx` already loads the canvas with `ssr: false`; keep that, because mapbox-gl also
touches `window` at import time.

---

## 8. Accessibility & responsiveness

Skip link to main content; `aria-sort` on sortable headers, `aria-pressed` on toggles,
`aria-current` on the active nav item; visible saffron focus rings on every interactive
element; Escape closes modals; `prefers-reduced-motion` disables animation. Tables scroll
horizontally and drop low-priority columns below `md`; the sidebar collapses to icons on
desktop and to a drawer on mobile; charts sit in fixed-height boxes so `ResponsiveContainer`
has something to measure.

---

## 9. Known limitations

- Basemap tiles are fetched from CARTO's CDN, so the map is blank on an offline machine.
  Mirror the tiles or point `BASEMAPS.light.url` at a departmental tile server.
- District centroids are approximate and there are no polygon boundaries — pins and the
  heatmap are positioned correctly at state zoom, but there is no district fill layer.
- 3 talukas per district, not all 358.
- The app has been type-checked and production-built, but has not been exercised in a
  browser in this environment. Tile loading and the custom canvas heatmap are the two areas
  most worth clicking through first.

---

Prototype build. All figures are demonstration data and are not audited departmental
statistics.

## 3D State Atlas (`/atlas`)

A cinematic 3D Maharashtra district visualization has been integrated as a new console page, ported from a
standalone React Three Fiber prototype:

- **Code**: `src/components/atlas/` (scene, meshes, UI chrome), `src/lib/atlas/` (projection/geometry/camera
  helpers), `src/hooks/` (`useMaharashtraGeo`, `useWeather`, `useWebglGuard`), `src/store/useAtlasStore.ts`.
- **Data**: `public/maharashtra_districts.json` — a 34-district GADM boundary set (pre-2014, so it predates the
  Palghar split and the 2023 Aurangabad/Osmanabad/Bid/Buldana renames). This is a separate geometry source from
  `src/lib/geography.ts`'s 36-district roster used by the rest of the console; the Atlas is a visual reference
  layer, not a source of case data, and the in-page note explains this to the operator.
- **No API keys required** — the 3D scene is self-rendered (no Mapbox/basemap dependency), and live weather comes
  from Open-Meteo, which needs no signup.
- **Styling** lives in `src/components/atlas/atlas.css`, scoped under `.atlas-root`/`atlas-*` classes and
  `isolation: isolate`, so it can't collide with the console's own navy/saffron design tokens or z-index layers
  (the modal at `z-[80]`, the mobile nav at `z-[70]`, etc.).
- **SSR**: loaded via `next/dynamic(..., { ssr: false })` from `src/app/(console)/atlas/page.tsx`, the same
  pattern already used for the Leaflet-based GIS map, since WebGL has no server-side render path.


---

## Basemap API key (CARTO)

CARTO now requires a free API key on its basemap tiles. Without one the map shows an
"API KEY REQUIRED" watermark.

1. Request a key (free, emailed instantly, no account): https://carto.com/basemaps/apikey
2. Open `.env.local` in the project root (next to `package.json`) and set:
   `NEXT_PUBLIC_CARTO_KEY=your_key`
3. Restart `npm run dev` and hard refresh the browser (Ctrl+Shift+R).

On a host (Vercel, Netlify, etc.) add the same variable in the dashboard and redeploy,
since `NEXT_PUBLIC_` values are inlined at build time. Do not commit `.env.local`.


---

## 3D district risk atlas (Overview + GIS Map)

Maharashtra's districts are drawn as a 3D, animated choropleth coloured **Low / Moderate / High**,
with white border lines and the district name on each one.

- **Where:** the Overview page (full-width hero) and the GIS Map page (toggle *3D risk atlas / 2D case map*).
  The 2D Leaflet map has the same colours as a *District risk zones* layer (Layers toggle).
- **Click a district:** the camera flies to it and a summary card opens.
- **Inspect district:** dives closer, drops every case as a pin and opens three tabs -
  *Overview* (rating, KPIs, 12-week trend, talukas, live weather, field response, CSV export),
  *Pests & diseases* (every diagnosis with severity, extent, notifiable flag, crops/animals),
  *Cases* (searchable list tied to the pins). Esc steps back one level.
- **Rating:** `src/lib/districtRisk.ts` - 60% case pressure (severity- and status-weighted, scaled to the
  reporting window) + 40% nightly prediction model. Thresholds `HIGH_THRESHOLD` / `MODERATE_THRESHOLD`.
  The 3D atlas and the 2D layer call the same function, so they always agree.
- **Boundary set:** still the 34-polygon GADM file. `GEO_ALIASES` in `districtRisk.ts` maps it onto the
  console's 36 districts (Thane polygon includes Palghar; Mumbai polygon covers Mumbai City + Suburban).
- **Jurisdiction:** districts outside an officer's scope are drawn grey and cannot be opened.

Code: `src/components/risk3d/*` (scene, panels), `src/store/useRiskAtlas.ts` (view state),
`src/lib/atlas/riskGeo.ts` + `riskCamera.ts` (geometry, camera), `src/components/map/DistrictRiskLayer.tsx` (2D).
