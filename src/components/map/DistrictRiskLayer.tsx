'use client';

import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { GeoJSON, Marker, Pane, useMapEvents } from 'react-leaflet';
import type { CaseRecord, Officer } from '@/lib/types';
import { LEVEL_META, buildDistrictRisk, labelFor, type DistrictRiskMap } from '@/lib/districtRisk';
import { DEMO_NOW } from '@/lib/catalog';
import { loadRawGeoJson, loadRiskGeo, type RiskGeo } from '@/lib/atlas/riskGeo';

/**
 * DistrictRiskLayer
 * -----------------
 * The 2D counterpart of the 3D atlas: Maharashtra's districts filled by
 * risk rating (Low / Moderate / High), separated by white border lines and
 * labelled with their names. It sits *under* the case pins and the
 * heatmap (custom panes), and it rates districts with exactly the same
 * buildDistrictRisk() the 3D atlas uses, so the two views always agree.
 */

const esc = (v: string | number) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function popupFor(key: string, risk: DistrictRiskMap, onInspect?: (key: string) => void): HTMLElement {
  const r = risk[key];
  const meta = LEVEL_META[r.level];
  const el = document.createElement('div');
  el.style.minWidth = '13.5rem';
  const stats =
    r.level === 'OUT_OF_SCOPE'
      ? '<p style="margin:6px 0 0;font-size:11px;color:#64748b">Data for this district is outside your jurisdiction.</p>'
      : r.level === 'NO_DATA'
        ? '<p style="margin:6px 0 0;font-size:11px;color:#64748b">No cases match the current filters.</p>'
        : `<p style="margin:6px 0 0;font-size:11px;color:#475569"><b>${r.total}</b> cases · <b style="color:#b91c1c">${r.high}</b> high severity · <b>${r.pendingReview}</b> in review${
            r.topDiagnosis ? `<br/><span style="color:#64748b">Most reported:</span> ${esc(r.topDiagnosis)}` : ''
          }</p>`;
  el.innerHTML = `
    <p style="margin:0;font:600 10px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#64748b">${esc(r.division)} Division</p>
    <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:#0a1c38">${esc(r.label)}</p>
    <p style="margin:6px 0 0"><span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:${meta.color}">
      <span style="width:9px;height:9px;border-radius:9999px;background:${meta.color}"></span>${esc(meta.label)}${
        r.level === 'HIGH' || r.level === 'MODERATE' || r.level === 'LOW' ? ` · ${r.score}/100` : ''
      }</span></p>
    ${stats}`;
  if (onInspect && r.inScope) {
    const btn = document.createElement('button');
    btn.textContent = 'Open in 3D atlas →';
    btn.style.cssText =
      'margin-top:10px;width:100%;border:0;border-radius:8px;background:#ff9933;color:#fff;font-weight:700;font-size:12px;padding:8px 10px;cursor:pointer';
    btn.addEventListener('click', () => onInspect(key));
    el.appendChild(btn);
  }
  return el;
}

function fontFor(zoom: number): number {
  if (zoom < 6.5) return 9;
  if (zoom < 8) return 10.5;
  if (zoom < 10) return 12.5;
  return 14;
}

function Labels({ geo, risk }: { geo: RiskGeo; risk: DistrictRiskMap }) {
  const [zoom, setZoom] = useState(6.4);
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => setZoom(map.getZoom()), [map]);

  const size = fontFor(zoom);
  return (
    <Pane name="districtLabels" style={{ zIndex: 420, pointerEvents: 'none' }}>
      {geo.districts.map((d) => {
        const r = risk[d.key];
        if (!r) return null;
        const tone = r.level === 'OUT_OF_SCOPE' || r.level === 'NO_DATA' ? 'muted' : 'strong';
        const icon = L.divIcon({
          className: 'district-label',
          html: `<span data-tone="${tone}" style="font-size:${size}px">${esc(labelFor(d.key))}</span>`,
          iconSize: [0, 0],
        });
        return <Marker key={d.key} position={[d.lngLat[1], d.lngLat[0]]} icon={icon} interactive={false} keyboard={false} pane="districtLabels" />;
      })}
    </Pane>
  );
}

export default function DistrictRiskLayer({
  cases,
  officer,
  windowDays,
  onInspect,
}: {
  cases: CaseRecord[];
  officer: Officer | null;
  windowDays: number;
  onInspect?: (geoKey: string) => void;
}) {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [geo, setGeo] = useState<RiskGeo | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRawGeoJson(), loadRiskGeo()])
      .then(([raw, g]) => {
        if (!cancelled) {
          setFc(raw);
          setGeo(g);
        }
      })
      .catch(() => {
        /* The pins still work without district fills; fail quietly. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rate on the same reporting window the 3D atlas uses. Where the page has already
  // filtered by date (the GIS page) this is a no-op; on the Overview, whose pins cover
  // every case, it keeps the zones comparable with the atlas's default 30 days.
  const windowCases = useMemo(
    () => cases.filter((c) => +new Date(c.reportedAt) >= DEMO_NOW - windowDays * 86400000),
    [cases, windowDays],
  );

  const risk = useMemo<DistrictRiskMap>(
    () =>
      fc
        ? buildDistrictRisk({ cases: windowCases, geoKeys: fc.features.map((f) => f.properties?.NAME_2 as string), officer, windowDays })
        : {},
    [fc, windowCases, officer, windowDays],
  );

  // Leaflet's GeoJSON layer does not restyle on prop change; remount when ratings change.
  const signature = useMemo(() => Object.values(risk).map((r) => `${r.key}:${r.level}:${r.score}`).join('|'), [risk]);

  // SVG (not the map's shared canvas): stacked canvas renderers only deliver mouse events
  // to the top-most canvas, which would leave the district polygons un-clickable.
  const svgRenderer = useMemo(() => L.svg({ pane: 'districts' }), []);

  if (!fc || !geo || Object.keys(risk).length === 0) return null;

  const styleFor = (feature?: Feature) => {
    const key = feature?.properties?.NAME_2 as string;
    const r = risk[key];
    const meta = LEVEL_META[r?.level ?? 'NO_DATA'];
    return {
      fillColor: meta.color,
      fillOpacity: r?.level === 'OUT_OF_SCOPE' ? 0.22 : r?.level === 'NO_DATA' ? 0.3 : 0.46,
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.95,
    } as L.PathOptions;
  };

  return (
    <>
      <Pane name="districts" style={{ zIndex: 260 }}>
        <GeoJSON
          key={signature}
          data={fc}
          pane="districts"
          {...({ renderer: svgRenderer } as object)}
          style={styleFor}
          onEachFeature={(feature, layer) => {
            const key = feature.properties?.NAME_2 as string;
            const path = layer as L.Path;
            path.on({
              mouseover: () => {
                path.setStyle({ weight: 3, color: '#0b1f3a', fillOpacity: 0.62 });
                path.bringToFront();
              },
              mouseout: () => path.setStyle(styleFor(feature)),
            });
            path.bindPopup(() => popupFor(key, risk, onInspect), { closeButton: true, minWidth: 220 });
          }}
        />
      </Pane>
      <Labels geo={geo} risk={risk} />
    </>
  );
}
