'use client';

import React from 'react';
import { Map as MapIcon, Filter, Flame, ListFilter, Crosshair, Info } from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, MetaChip, Button, EmptyState } from '@/components/ui';
import { GisMap, LayerToggles, MapFilters, MapLegend, MapStats } from '@/components/map/GisMap';
import { useFilteredCases, useScopedCases, useScopedScouts } from '@/store/hooks';
import { RiskAtlas } from '@/components/risk3d';
import MapModeSwitch, { type MapMode } from '@/components/risk3d/ModeSwitch';
import { useRiskAtlas } from '@/store/useRiskAtlas';
import { geoKeyForConsoleDistrict } from '@/lib/districtRisk';
import { useSession } from '@/store/useSession';
import { useFilters } from '@/store/useFilters';
import { useOps } from '@/store/useOps';
import { scopeFor } from '@/lib/rbac';
import { SEVERITY_META, STATUS_META } from '@/lib/catalog';
import { formatNumber, timeAgo } from '@/lib/format';
import type { CaseRecord } from '@/lib/types';

/**
 * GIS Map screen.
 *
 * The map, the filter bar and the case list are three views of one
 * filtered set — changing a filter moves all three together, which is
 * what makes "show me high-severity cotton cases in the last 14 days"
 * a single action rather than three.
 */
export default function MapPage() {
  const officer = useSession((s) => s.officer);
  const allScoped = useScopedCases();
  const cases = useFilteredCases();
  const scouts = useScopedScouts();
  const showHeatmap = useFilters((s) => s.showHeatmap);
  const days = useFilters((s) => s.days);
  const log = useOps((s) => s.log);

  const [mapMode, setMapMode] = React.useState<MapMode>('3d');
  const [pendingDistrict, setPendingDistrict] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<CaseRecord | null>(null);
  const [focus, setFocus] = React.useState<[number, number] | null>(null);

  const scope = scopeFor(officer);

  const highCount = cases.filter((c) => c.severity === 'HIGH').length;
  const pendingCount = cases.filter((c) => c.status === 'PENDING_REVIEW').length;

  const select = (record: CaseRecord) => {
    setSelected(record);
    setFocus([record.lat, record.lng]);
    if (mapMode === '3d') {
      // In the 3D atlas, picking a case dives into its district and flies to its pin.
      const atlas = useRiskAtlas.getState();
      atlas.inspect(geoKeyForConsoleDistrict(record.district));
      atlas.focusCase(record.id);
    }
  };

  // A district popup on the 2D map hands the district over to the 3D atlas.
  const openIn3D = (district: string) => {
    setPendingDistrict(geoKeyForConsoleDistrict(district));
    setMapMode('3d');
  };

  // Toggling the prediction layer is an auditable act: it is the layer
  // officers use to justify pre-emptive advisories.
  const onToggleHeatmap = (next: boolean) => {
    if (officer) {
      log(
        officer,
        'LAYER_TOGGLED',
        'Nightly Prediction Engine',
        `Risk heatmap layer turned ${next ? 'on' : 'off'} for ${scope.label}.`,
        'INFO',
      );
    }
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeading
        title="GIS Surveillance Map"
        subtitle={`${scope.label} · farmer-reported cases, field scout positions and the overnight risk surface.`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone="slate">{formatNumber(cases.length)} of {formatNumber(allScoped.length)} shown</Badge>
            {mapMode === '2d' && showHeatmap && (
              <Badge tone="orange">
                <Flame size={10} /> Prediction layer on
              </Badge>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader
          icon={Filter}
          title="Map filters"
          subtitle="Crop / species, date range, severity and free-text search — applied to the map and the list together"
          accent="sky"
          action={mapMode === '2d' ? <LayerToggles onToggleHeatmap={onToggleHeatmap} /> : undefined}
        />
        <div className="p-4">
          <MapFilters />
        </div>
      </Panel>

      <div className={mapMode === '2d' ? 'grid gap-4 xl:grid-cols-[2fr_1fr]' : 'space-y-4'}>
        <Panel className="overflow-hidden">
          <PanelHeader
            icon={MapIcon}
            title={mapMode === '3d' ? 'District risk atlas' : 'Case map'}
            subtitle={
              mapMode === '3d'
                ? 'Districts rated Low / Moderate / High from the cases in view — click one to fly in, then Inspect district'
                : 'Pins, prediction heatmap and district risk zones'
            }
            action={<MapModeSwitch value={mapMode} onChange={(m) => { setPendingDistrict(null); setMapMode(m); }} />}
          />
          <div className={mapMode === '3d' ? 'relative h-[34rem] lg:h-[44rem]' : 'relative h-[30rem] lg:h-[40rem]'}>
            {mapMode === '3d' ? (
              <RiskAtlas
                cases={cases}
                historyCases={allScoped}
                officer={officer}
                windowDays={days}
                initialDistrictKey={pendingDistrict}
                onUnsupported={() => setMapMode('2d')}
              />
            ) : (
              <>
                <GisMap cases={cases} scouts={scouts} officer={officer} focus={focus} onSelectCase={select} onInspectDistrict={openIn3D} />
                <MapStats total={cases.length} high={highCount} pending={pendingCount} />
                <MapLegend heatmapOn={showHeatmap} />
              </>
            )}
          </div>
        </Panel>

        <div className={mapMode === '3d' ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
          <Panel className="overflow-hidden">
            <PanelHeader
              icon={ListFilter}
              title="Cases in view"
              subtitle="Click to fly the map to that case"
              action={<Badge tone="slate">{cases.length}</Badge>}
            />
            {cases.length === 0 ? (
              <EmptyState
                icon={MapIcon}
                title="No cases match these filters"
                message="Widen the date range or re-enable a severity band."
              />
            ) : (
              <ul className="max-h-[24rem] divide-y divide-slate-100 overflow-y-auto">
                {cases.slice(0, 60).map((record) => (
                  <li key={record.id}>
                    <button
                      onClick={() => select(record)}
                      className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
                        selected?.id === record.id ? 'bg-saffron-500/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_META[record.severity].color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-navy-900">
                          {record.diagnosis}
                        </span>
                        <span className="block truncate text-[10px] text-slate-500">
                          {record.taluka}, {record.district} · {record.subject}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-[11px] text-slate-500">{record.aiConfidence}%</span>
                        <span className="block text-[9px] text-slate-500">{timeAgo(record.reportedAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {selected ? (
            <Panel>
              <PanelHeader
                icon={Crosshair}
                title={selected.reference}
                subtitle={`${selected.diagnosis} · ${selected.subject}`}
                accent="violet"
                action={
                  <Button size="sm" variant="subtle" onClick={() => { setSelected(null); setFocus(null); }}>
                    Clear
                  </Button>
                }
              />
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-1.5">
                  <MetaChip label={SEVERITY_META[selected.severity].label} chip={SEVERITY_META[selected.severity].chip} />
                  <MetaChip label={STATUS_META[selected.status].label} chip={STATUS_META[selected.status].chip} />
                  <Badge tone="slate">Onion crop health</Badge>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    ['AI confidence', `${selected.aiConfidence}%`],
                    ['Pathogen type', selected.pathogenType],
                    ['Location', `${selected.taluka}, ${selected.district}`],
                    ['Division', selected.division],
                    ['Extent', `${formatNumber(selected.areaHa)} ${selected.domain === 'CROP' ? 'ha' : 'head'}`],
                    ['Channel', selected.channel],
                    ['Farmer', selected.farmerName],
                    ['KYC verified', selected.farmerVerified ? 'Yes' : 'No'],
                    ['Contact', selected.farmerPhone],
                    ['Reported', timeAgo(selected.reportedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
                      <dd className="mt-0.5 truncate font-medium text-slate-700">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="font-mono text-[10px] text-slate-500">
                  {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · EPSG:4326
                </p>
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="flex items-start gap-2.5 p-4">
                <Info size={15} className="mt-0.5 shrink-0 text-slate-500" />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Select a case from the list or click a pin to inspect it. Pins with an amber ring are awaiting
                  expert sign-off and cannot drive an advisory until reviewed. The heatmap layer is produced by
                  the overnight prediction batch and refreshes at 02:00 IST.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
