'use client';

import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, LayersControl, CircleMarker } from 'react-leaflet';
import type { CaseRecord, Officer, Scout } from '@/lib/types';
import { RISK_SURFACE } from '@/lib/mockData';
import { SEVERITY_META, STATUS_META } from '@/lib/catalog';
import { viewportFor } from '@/lib/rbac';
import { formatNumber, timeAgo } from '@/lib/format';
import HeatmapLayer from './HeatmapLayer';
import DistrictRiskLayer from './DistrictRiskLayer';

/**
 * MapCanvas
 * ---------
 * The GIS surface. Loaded only on the client (see GisMap.tsx) because
 * Leaflet reaches for `window` at import time and would crash a server
 * render.
 *
 * BASEMAP: CARTO Positron (light) raster tiles. CARTO now requires a free
 * API key on basemaps.cartocdn.com (https://carto.com/basemaps/apikey).
 * Put it in .env.local as NEXT_PUBLIC_CARTO_KEY and restart the dev
 * server. Without a key the map still loads but shows an "API KEY
 * REQUIRED" watermark. To move to Mapbox GL vector tiles, swap the
 * <TileLayer> for a mapbox-gl instance; the pin, heatmap and filter
 * logic are deliberately kept independent of the renderer.
 */

// Free key from https://carto.com/basemaps/apikey  ->  .env.local
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;

/** Maharashtra's extent (south-west, north-east corners). */
const STATE_BOUNDS: L.LatLngBoundsLiteral = [
  [15.6, 72.6],
  [22.1, 80.9],
];

const BASEMAPS = {
  light: {
    url:
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' +
      (CARTO_KEY ? `?key=${CARTO_KEY}` : ''),
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap (CC-BY-SA)',
  },
};

/** Builds the coloured pin. divIcons keep 400+ markers cheap — no image requests. */
function casePinIcon(record: CaseRecord): L.DivIcon {
  const color = SEVERITY_META[record.severity].color;
  const pulse =
    record.severity === 'HIGH'
      ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.55;animation:ping2 1.9s ease-out infinite"></span>`
      : '';
  const ring = record.status === 'PENDING_REVIEW' ? '#f59e0b' : 'rgba(15,23,42,.55)';

  return L.divIcon({
    className: 'case-pin',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<span style="position:relative;display:block;width:16px;height:16px">
      ${pulse}
      <span style="position:absolute;inset:3px;border-radius:9999px;background:${color};
        box-shadow:0 0 0 1.5px ${ring},0 0 10px ${color}aa"></span>
    </span>`,
  });
}

function scoutPinIcon(scout: Scout): L.DivIcon {
  const color = scout.available ? '#38bdf8' : '#64748b';
  return L.divIcon({
    className: 'scout-pin',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<span style="display:block;width:14px;height:14px;border-radius:3px;transform:rotate(45deg);
      background:${color};box-shadow:0 0 0 1.5px rgba(15,23,42,.55)"></span>`,
  });
}

/** Keeps the viewport inside the signed-in officer's jurisdiction. */
function ViewportController({ officer, focus }: { officer: Officer | null; focus?: [number, number] | null }) {
  const map = useMap();
  const appliedRef = React.useRef<string>('');

  React.useEffect(() => {
    const key = `${officer?.employeeCode}-${officer?.district}-${officer?.taluka}`;
    if (appliedRef.current === key) return;
    appliedRef.current = key;

    if (!officer || officer.role === 'STATE') {
      // Fit the whole state to the panel instead of a fixed zoom, so Maharashtra
      // fills the map whether it sits in a narrow column or a full-width panel.
      map.fitBounds(STATE_BOUNDS, { padding: [14, 14], animate: true });
      return;
    }
    const { center, zoom } = viewportFor(officer);
    map.setView(center, zoom, { animate: true });
  }, [map, officer]);

  React.useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [map, focus]);

  // Leaflet mis-measures its container when it mounts inside a panel that
  // is still animating; a deferred invalidateSize fixes the grey gutters.
  React.useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 240);
    return () => clearTimeout(id);
  }, [map]);

  return null;
}

export interface MapCanvasProps {
  cases: CaseRecord[];
  scouts: Scout[];
  officer: Officer | null;
  showPins: boolean;
  showHeatmap: boolean;
  showScouts: boolean;
  /** District risk fills + names (Low / Moderate / High). */
  showDistricts?: boolean;
  /** Reporting window the cases cover, used to scale the district rating. */
  windowDays?: number;
  focus?: [number, number] | null;
  onSelectCase?: (record: CaseRecord) => void;
  /** Called with a district key when the user picks "Open in 3D atlas" in a district popup. */
  onInspectDistrict?: (district: string) => void;
  className?: string;
}

export default function MapCanvas({
  cases,
  scouts,
  officer,
  showPins,
  showHeatmap,
  showScouts,
  showDistricts = true,
  windowDays = 30,
  focus,
  onSelectCase,
  onInspectDistrict,
  className,
}: MapCanvasProps) {
  const { center, zoom } = viewportFor(officer);

  // The prediction surface is clipped to jurisdiction so a taluka officer
  // is not shown risk cells they have no authority over.
  const scopedRisk = React.useMemo(() => {
    if (!officer || officer.role === 'STATE') return RISK_SURFACE;
    const districts = new Set(cases.map((c) => c.district));
    return RISK_SURFACE.filter((cell) => districts.has(cell.district));
  }, [officer, cases]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomSnap={0.25}
      minZoom={5}
      maxZoom={14}
      scrollWheelZoom
      preferCanvas
      className={className ?? 'h-full w-full'}
      // The state plus a generous margin; stops operators panning to Peru.
      maxBounds={[
        [13.5, 69.5],
        [24.5, 83.5],
      ]}
      maxBoundsViscosity={0.7}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Administrative (light)">
          <TileLayer url={BASEMAPS.light.url} attribution={BASEMAPS.light.attribution} subdomains="abcd" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer url={BASEMAPS.terrain.url} attribution={BASEMAPS.terrain.attribution} />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ViewportController officer={officer} focus={focus} />

      {showDistricts && (
        <DistrictRiskLayer cases={cases} officer={officer} windowDays={windowDays} onInspect={onInspectDistrict} />
      )}

      <HeatmapLayer cells={scopedRisk} visible={showHeatmap} />

      {showScouts &&
        scouts.map((scout) => (
          <Marker key={scout.id} position={[scout.lat, scout.lng]} icon={scoutPinIcon(scout)}>
            <Popup>
              <p className="text-[13px] font-semibold text-navy-900">{scout.name}</p>
              <p className="text-[11px] text-slate-500">{scout.institute}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {scout.taluka}, {scout.district}
              </p>
              <p className="mt-1 text-[11px]">
                <span className={scout.available ? 'text-emerald-700' : 'text-slate-500'}>
                  {scout.available ? 'Available now' : 'Unavailable'}
                </span>
                {' · '}
                {scout.accuracy}% accuracy · {scout.completedVisits} visits
              </p>
            </Popup>
          </Marker>
        ))}

      {showPins &&
        cases.map((record) => (
          <Marker
            key={record.id}
            position={[record.lat, record.lng]}
            icon={casePinIcon(record)}
            eventHandlers={onSelectCase ? { click: () => onSelectCase(record) } : undefined}
          >
            <Popup>
              <div className="min-w-[13rem]">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{record.reference}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-navy-900">{record.diagnosis}</p>
                <p className="text-[11px] text-slate-500">
                  {record.subject} · {record.pathogenType}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className={`chip ${SEVERITY_META[record.severity].chip}`}>
                    {SEVERITY_META[record.severity].label}
                  </span>
                  <span className={`chip ${STATUS_META[record.status].chip}`}>{STATUS_META[record.status].label}</span>
                </div>

                <dl className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">AI confidence</dt>
                    <dd className="font-mono">{record.aiConfidence}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Location</dt>
                    <dd>
                      {record.taluka}, {record.district}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Extent</dt>
                    <dd>
                      {formatNumber(record.areaHa)} {record.domain === 'CROP' ? 'ha' : 'head'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Reported</dt>
                    <dd>{timeAgo(record.reportedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Farmer</dt>
                    <dd>
                      {record.farmerName}
                      {record.farmerVerified ? ' ✓' : ''}
                    </dd>
                  </div>
                </dl>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* A faint ring marks the centre of the officer's jurisdiction. */}
      <CircleMarker
        center={center}
        radius={4}
        pathOptions={{ color: '#ff9933', weight: 1.5, fillOpacity: 0.25 }}
        interactive={false}
      />
    </MapContainer>
  );
}
