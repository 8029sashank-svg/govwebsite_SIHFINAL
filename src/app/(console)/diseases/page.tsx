'use client';

import React from 'react';
import clsx from 'clsx';
import { BookOpen, Search, FlaskConical, CloudSun, Bug, ShieldCheck, Thermometer, Sprout, FileText } from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Panel, PanelHeader, PageHeading, Badge } from '@/components/ui';
import { useScopedCases } from '@/store/hooks';
import { PATHOGENS, type Pathogen } from '@/lib/catalog';
import {
  DISEASE_SCALE, PDI_FORMULA, STUDY_CITATION, STUDY_CORRELATIONS, STUDY_FINDINGS, STUDY_SITE, STUDY_WEEKS,
} from '@/lib/purpleBlotchStudy';

/**
 * Onion Disease Library.
 *
 * Reference content transcribed from the supplied PDFs (Vikaspedia / NIPHM,
 * "Onion Diseases" oni002, the Bayer Onion Disease Field Guide, and Mandal
 * et al. 2022). Nothing on this page is generated.
 */

const CHART_AXIS = { stroke: '#94a3b8', fontSize: 10 };
const GRID = 'rgba(15,23,42,0.08)';
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 };

const TYPE_TONE: Record<string, 'emerald' | 'sky' | 'violet' | 'amber'> = {
  Fungal: 'emerald', Bacterial: 'amber', Viral: 'violet', Oomycete: 'sky',
};

type Tab = 'library' | 'study';

export default function DiseasesPage() {
  const cases = useScopedCases();
  const [tab, setTab] = React.useState<Tab>('library');
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState('ALL');
  const [stage, setStage] = React.useState('ALL');
  const [selectedId, setSelectedId] = React.useState(PATHOGENS.find((p) => p.id === 'purple-blotch')?.id ?? PATHOGENS[0].id);

  const caseCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) m.set(c.diagnosis, (m.get(c.diagnosis) ?? 0) + 1);
    return m;
  }, [cases]);

  const types = React.useMemo(() => ['ALL', ...new Set(PATHOGENS.map((p) => p.type))], []);
  const stages = React.useMemo(() => ['ALL', ...new Set(PATHOGENS.map((p) => p.affects).filter(Boolean) as string[])], []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return PATHOGENS.filter((p) => {
      if (type !== 'ALL' && p.type !== type) return false;
      if (stage !== 'ALL' && p.affects !== stage) return false;
      if (!q) return true;
      return [p.name, p.causalAgent, ...(p.symptoms ?? [])].join(' ').toLowerCase().includes(q);
    });
  }, [query, type, stage]);

  const selected = PATHOGENS.find((p) => p.id === selectedId) ?? filtered[0];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Onion Disease Library"
        subtitle={`${PATHOGENS.length} onion diseases with causal agent, symptoms, survival, favourable conditions and control - transcribed from the supplied reference PDFs.`}
      />

      <div className="flex gap-1.5">
        {([
          ['library', 'Disease library', BookOpen],
          ['study', 'Purple blotch weather study', CloudSun],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              tab === id ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'library' ? (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Panel className="self-start">
            <PanelHeader icon={Bug} title="Diseases" subtitle={`${filtered.length} of ${PATHOGENS.length} shown`} accent="emerald" />
            <div className="space-y-2.5 p-3">
              <label className="relative block">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input className="input pl-8" placeholder="Search disease, pathogen, symptom" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  {types.map((t) => <option key={t} value={t}>{t === 'ALL' ? 'All types' : t}</option>)}
                </select>
                <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                  {stages.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All stages' : s}</option>)}
                </select>
              </div>
            </div>
            <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={clsx('flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs hover:bg-slate-50', selected?.id === p.id && 'bg-saffron-500/10')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-navy-900">{p.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">{p.affects}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={TYPE_TONE[p.type] ?? 'slate'}>{p.type}</Badge>
                      <span className="w-6 text-right font-mono text-[10px] text-slate-500" title="Cases in your jurisdiction">{caseCounts.get(p.name) ?? 0}</span>
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-4 py-8 text-center text-xs text-slate-500">No disease matches these filters.</li>}
            </ul>
            <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">Right-hand number = reported cases in your jurisdiction.</p>
          </Panel>

          {selected && <DiseaseDetail p={selected} cases={caseCounts.get(selected.name) ?? 0} />}
        </div>
      ) : (
        <StudyView />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, items, tone }: { title: string; icon: typeof Sprout; items?: string[]; tone: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className={clsx('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider', tone)}>
        <Icon size={13} /> {title}
      </h3>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{t}</li>
        ))}
      </ul>
    </div>
  );
}

function DiseaseDetail({ p, cases }: { p: Pathogen; cases: number }) {
  return (
    <Panel>
      <PanelHeader
        icon={Bug}
        title={p.name}
        subtitle={p.causalAgent ? <em>{p.causalAgent}</em> : 'Causal agent not named in the supplied PDFs'}
        accent="emerald"
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge tone={TYPE_TONE[p.type] ?? 'slate'}>{p.type}</Badge>
            {p.affects && <Badge tone="slate">{p.affects}</Badge>}
            {p.notifiable && <Badge tone="red">High-loss disease</Badge>}
            <Badge tone="saffron">{cases} cases</Badge>
          </div>
        }
      />
      <div className="space-y-5 p-5">
        <Section title="Symptoms" icon={Sprout} items={p.symptoms} tone="text-emerald-700" />
        <Section title="Survival & spread" icon={FlaskConical} items={p.survival} tone="text-sky-700" />
        <Section title="Favourable conditions" icon={Thermometer} items={p.favourable} tone="text-orange-700" />
        <Section title="Control" icon={ShieldCheck} items={p.control} tone="text-violet-700" />
        {p.sources && (
          <p className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            <FileText size={11} /> Source: {p.sources.join(' · ')}
          </p>
        )}
        <p className="text-[10px] leading-relaxed text-slate-400">
          Always read and follow label directions for any fungicide, insecticide or other chemical. Field diagnosis alone is not a substitute for a plant pathologist (Bayer guide).
        </p>
      </div>
    </Panel>
  );
}

function StudyView() {
  const data = STUDY_WEEKS.map((w) => ({ ...w, week: `SMW ${w.smw}` }));
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader icon={CloudSun} title="Purple blotch progress vs weather" subtitle={STUDY_SITE} accent="sky" />
        <div className="grid gap-5 p-4 lg:grid-cols-2">
          <div className="h-72">
            <p className="mb-1 text-[11px] font-semibold text-slate-600">Disease index (%)</p>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 18, left: -14 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="week" tick={{ ...CHART_AXIS, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pipdi" name="Periodical increment (PIPDI)" fill="#fdba74" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="cipdi" name="Cumulative (CIPDI)" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <p className="mb-1 text-[11px] font-semibold text-slate-600">Temperature (°C) and relative humidity (%)</p>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 18, left: -14 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="week" tick={{ ...CHART_AXIS, fontSize: 9 }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={CHART_AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="tMax" name="Max temp" stroke="#ea580c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tMin" name="Min temp" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rhMorning" name="Morning RH" stroke="#16a34a" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="rhEvening" name="Evening RH" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={FileText} title="Table 2 - Disease development in relation to weather" subtitle="Pooled 2017-18 and 2018-19, by standard meteorological week (SMW)" accent="saffron" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                {['SMW', 'Cumulative increase (%)', 'Periodical increment (%)', 'Max °C', 'Min °C', 'Morning RH %', 'Evening RH %', 'Rainfall (mm)'].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {STUDY_WEEKS.map((w) => (
                <tr key={w.smw} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-semibold">{w.smw}</td>
                  <td className="px-3 py-1.5">{w.cipdi}</td>
                  <td className="px-3 py-1.5">{w.pipdi}</td>
                  <td className="px-3 py-1.5">{w.tMax}</td>
                  <td className="px-3 py-1.5">{w.tMin}</td>
                  <td className="px-3 py-1.5">{w.rhMorning}</td>
                  <td className="px-3 py-1.5">{w.rhEvening}</td>
                  <td className="px-3 py-1.5">{w.rainfallMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader icon={FlaskConical} title="Table 3 - Correlation with disease increment" subtitle="** significant correlation" accent="violet" />
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Weather parameter</th><th className="px-3 py-2">CIPDI</th><th className="px-3 py-2">PIPDI</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {STUDY_CORRELATIONS.map((c) => (
                <tr key={c.parameter}>
                  <td className="px-3 py-2 font-sans">{c.parameter}</td>
                  <td className={clsx('px-3 py-2', c.cipdiSignificant && 'font-semibold text-red-700')}>{c.cipdi}{c.cipdiSignificant ? '**' : ''}</td>
                  <td className={clsx('px-3 py-2', c.pipdiSignificant && 'font-semibold text-red-700')}>{c.pipdi}{c.pipdiSignificant ? '**' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader icon={Bug} title="Table 1 - Disease rating scale" subtitle="0-5 point scale (Mayee & Datar, 1986)" accent="emerald" />
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Score</th><th className="px-3 py-2">Grade</th><th className="px-3 py-2">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {DISEASE_SCALE.map((r) => (
                <tr key={r.score}><td className="px-3 py-2 font-mono">{r.score}</td><td className="px-3 py-2 font-semibold">{r.grade}</td><td className="px-3 py-2">{r.description}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-2 font-mono text-[10px] text-slate-500">{PDI_FORMULA}</p>
        </Panel>
      </div>

      <Panel>
        <PanelHeader icon={ShieldCheck} title="Key findings" accent="emerald" />
        <ul className="space-y-2 p-5 text-xs leading-relaxed text-slate-700">
          {STUDY_FINDINGS.map((f, i) => (
            <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />{f}</li>
          ))}
        </ul>
        <p className="border-t border-slate-100 px-5 py-2.5 text-[10px] text-slate-500">Source: {STUDY_CITATION}</p>
      </Panel>
    </div>
  );
}
