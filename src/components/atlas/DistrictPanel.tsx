'use client';

import React, { useEffect, useState } from 'react';
import { X, MapPin, Users, TrendingUp, TrendingDown, GraduationCap, CloudSun, Landmark, Loader2 } from 'lucide-react';
import { useAtlasStore } from '@/store/useAtlasStore';
import { useWeather } from '@/hooks/useWeather';
import type { AtlasDistrict } from '@/lib/atlas/types';
import type { LucideIcon } from 'lucide-react';

function StatTile({
  icon: Icon,
  label,
  value,
  accent = 'cyan',
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  accent?: 'cyan' | 'violet' | 'amber' | 'green';
}) {
  const accentClass = {
    cyan: 'text-saffron-300 bg-saffron-400/10',
    violet: 'text-violet-300 bg-violet-400/10',
    amber: 'text-amber-300 bg-amber-400/10',
    green: 'text-emerald-300 bg-emerald-400/10',
  }[accent];

  return (
    <div className="atlas-glass rounded-xl p-3">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
        <Icon size={15} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function WeatherRow({ lngLat }: { lngLat: [number, number] }) {
  const weather = useWeather(lngLat);

  if (weather.status === 'loading' || weather.status === 'idle') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="atlas-spin" /> Fetching live conditions…
      </div>
    );
  }
  if (weather.status === 'error') {
    return <p className="text-sm text-slate-400">Weather unavailable ({weather.error || 'network issue'}).</p>;
  }
  const { data } = weather;
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-2xl font-semibold text-white">{Math.round(data.tempC)}&deg;C</p>
        <p className="text-xs text-slate-400">{data.label}</p>
      </div>
      <div className="text-right text-xs text-slate-400">
        <p>Humidity {data.humidity}%</p>
        <p>Wind {Math.round(data.windKph)} km/h</p>
      </div>
    </div>
  );
}

export default function DistrictPanel({ district }: { district: AtlasDistrict | null }) {
  const clearSelection = useAtlasStore((s) => s.clearSelection);
  const open = Boolean(district);

  // Keep rendering the last district's content while the panel slides
  // closed, so the content doesn't pop away before the transform
  // transition finishes.
  const [displayDistrict, setDisplayDistrict] = useState<AtlasDistrict | null>(district);
  useEffect(() => {
    if (district) setDisplayDistrict(district);
    else {
      const t = setTimeout(() => setDisplayDistrict(null), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [district]);

  return (
    <aside
      className={`absolute right-0 top-0 z-40 h-full w-full max-w-sm transform p-4 atlas-ease-cinematic transition-transform duration-500 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
    >
      <div className="atlas-glass flex h-full flex-col overflow-hidden rounded-2xl atlas-shadow-panel">
        {displayDistrict && (
          <>
            <div className="relative border-b border-white/10 p-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-saffron-400 via-violet-400 to-transparent" />
              <button
                onClick={clearSelection}
                className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-saffron-300/90">
                <MapPin size={11} /> Maharashtra &middot; District Profile
              </p>
              <h2 className="atlas-text-glow mt-1 text-2xl font-semibold text-white">{displayDistrict.name}</h2>
              <p className="mt-1.5 text-sm text-slate-400">{displayDistrict.signature}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={TrendingUp} label="Dev. Index (demo)" value={displayDistrict.devIndex} accent="cyan" />
                <StatTile
                  icon={Users}
                  label="Population Index (demo)"
                  value={displayDistrict.populationIndex}
                  accent="violet"
                />
                <StatTile
                  icon={displayDistrict.growthTrend >= 0 ? TrendingUp : TrendingDown}
                  label="Growth Trend (demo)"
                  value={`${displayDistrict.growthTrend > 0 ? '+' : ''}${displayDistrict.growthTrend}%`}
                  accent={displayDistrict.growthTrend >= 0 ? 'green' : 'amber'}
                />
                <StatTile icon={GraduationCap} label="Literacy (demo)" value={`${displayDistrict.literacyDemo}%`} accent="amber" />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  <CloudSun size={12} /> Live weather
                </p>
                <div className="atlas-glass rounded-xl p-4">
                  <WeatherRow lngLat={displayDistrict.lngLat} />
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  <Landmark size={12} /> Notable places
                </p>
                <ul className="space-y-1.5">
                  {displayDistrict.topPlaces.map((place) => (
                    <li key={place} className="atlas-glass flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200">
                      <span className="atlas-shadow-glow h-1.5 w-1.5 rounded-full bg-saffron-400" />
                      {place}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
                Development, population and literacy figures are illustrative demo indices derived from the
                district name for visualization purposes — not official statistics. Weather is live. This
                boundary set predates a few current district names/splits (see the Atlas page note above).
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
