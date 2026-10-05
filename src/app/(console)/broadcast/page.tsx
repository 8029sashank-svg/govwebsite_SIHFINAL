'use client';

import React from 'react';
import {
  Radio, MessageSquare, Smartphone, PhoneCall, Send, AlertTriangle, Users,
  Languages, History, CheckCircle2, ShieldAlert,
} from 'lucide-react';
import { Panel, PanelHeader, PageHeading, Badge, Button, StatCard, Modal, EmptyState, Meter } from '@/components/ui';
import { useScopedCases } from '@/store/hooks';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { can, scopeFor } from '@/lib/rbac';
import { getDistrict } from '@/lib/geography';
import { FARMER_BASE } from '@/lib/mockData';
import { PATHOGENS } from '@/lib/catalog';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { Broadcast } from '@/lib/types';

/**
 * Emergency Alert Broadcast Composer.
 *
 * Reach is modelled as the *union* of the selected channels, not their
 * sum: a farmer registered for both SMS and WhatsApp is one person. We
 * therefore multiply the complements and subtract from one — otherwise
 * selecting every channel would report an impossible 185% reach, which
 * is exactly the kind of number that erodes trust in a dashboard.
 */

const CHANNELS = [
  { id: 'SMS' as const, label: 'SMS', icon: Smartphone, penetration: 0.94, note: 'Feature phones and low-network areas' },
  { id: 'WHATSAPP' as const, label: 'WhatsApp', icon: MessageSquare, penetration: 0.62, note: 'Rich media with reference imagery' },
  { id: 'PUSH' as const, label: 'App push', icon: Radio, penetration: 0.28, note: 'Registered users of the farmer app' },
  { id: 'IVR' as const, label: 'Helpline IVR', icon: PhoneCall, penetration: 0.18, note: 'Outbound voice call in local language' },
];

const TEMPLATES = [
  {
    id: 'outbreak',
    name: 'Outbreak advisory',
    priority: 'EMERGENCY' as const,
    body: 'URGENT: {pathogen} confirmed in {zone}. Inspect your {subject} today. Apply the recommended control measure within 48 hours. Free guidance: Kisan Helpline 1800-180-1551.',
  },
  {
    id: 'preventive',
    name: 'Preventive window',
    priority: 'ADVISORY' as const,
    body: 'ADVISORY: Conditions in {zone} favour {pathogen} over the next 7 days. Complete preventive measures on your {subject} before the next rainfall. Contact your Krishi Sahayak for dosage.',
  },
  {
    id: 'postharvest',
    name: 'Post-harvest handling',
    priority: 'NOTICE' as const,
    body: 'NOTICE: To limit {pathogen} in stored {subject} in {zone}: dry bulbs in the field for two days, then in shade for 10-15 days before storage, and avoid injury during handling.',
  },
];

export default function BroadcastPage() {
  const officer = useSession((s) => s.officer);
  const cases = useScopedCases();
  const { broadcasts, sendBroadcast } = useOps();

  const scope = scopeFor(officer);
  const allowed = officer ? can(officer.role, 'BROADCAST_DISTRICT') : false;

  const [targetType, setTargetType] = React.useState<'DISTRICT' | 'TALUKA'>('DISTRICT');
  const [targets, setTargets] = React.useState<string[]>([]);
  const [priority, setPriority] = React.useState<Broadcast['priority']>('EMERGENCY');
  const [channels, setChannels] = React.useState<Broadcast['channels']>(['SMS', 'WHATSAPP']);
  const [languages, setLanguages] = React.useState<string[]>(['Marathi', 'Hindi']);
  const [pathogen, setPathogen] = React.useState(PATHOGENS[0].name);
  const [subject, setSubject] = React.useState(PATHOGENS[0].subjects[0]);
  const [message, setMessage] = React.useState(TEMPLATES[0].body);
  const [confirming, setConfirming] = React.useState(false);

  const talukaOptions = React.useMemo(
    () => scope.districts.flatMap((district) => getDistrict(district)?.talukas ?? []),
    [scope.districts],
  );

  // Audience: registered farmers in the targeted zones. Taluka audiences
  // are apportioned from the district base by the number of talukas.
  const audience = React.useMemo(() => {
    if (targetType === 'DISTRICT') {
      return targets.reduce((sum, name) => sum + (FARMER_BASE[name] ?? 0), 0);
    }
    return targets.reduce((sum, talukaName) => {
      const taluka = talukaOptions.find((t) => t.name === talukaName);
      if (!taluka) return sum;
      const district = getDistrict(taluka.district);
      const base = FARMER_BASE[taluka.district] ?? 0;
      return sum + Math.round(base / Math.max(1, district?.talukas.length ?? 1));
    }, 0);
  }, [targetType, targets, talukaOptions]);

  const reachPct = React.useMemo(() => {
    const missed = channels.reduce(
      (acc, id) => acc * (1 - (CHANNELS.find((c) => c.id === id)?.penetration ?? 0)),
      1,
    );
    return Math.round((1 - missed) * 100);
  }, [channels]);

  const reach = Math.round((audience * reachPct) / 100);

  const rendered = message
    .replaceAll('{pathogen}', pathogen)
    .replaceAll('{subject}', subject)
    .replaceAll('{zone}', targets.join(', ') || 'your area');

  const activeCases = cases.filter((c) => c.diagnosis === pathogen).length;

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) =>
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const send = () => {
    if (!officer) return;
    sendBroadcast(
      {
        title: `${pathogen} — ${subject}`,
        message: rendered,
        priority,
        channels,
        languages,
        targetType,
        targets,
        audience,
        reach,
      },
      officer,
    );
    setConfirming(false);
  };

  const canSend = targets.length > 0 && channels.length > 0 && rendered.trim().length > 15;

  if (!allowed) {
    return (
      <div className="p-4 lg:p-6">
        <PageHeading title="Alert Broadcast" subtitle="Manual override advisory composer." />
        <Panel className="mt-5">
          <EmptyState
            icon={ShieldAlert}
            title="Broadcast authority not held at your level"
            message="Outbound advisories are issued at district level and above. Raise the request with your District Superintending Agriculture Officer."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Emergency Alert Broadcast"
        subtitle="Manual override composer — draft an advisory, select the target zones and issue it to registered farmers across every channel they use."
        action={
          <Badge tone={priority === 'EMERGENCY' ? 'red' : 'saffron'}>
            <AlertTriangle size={10} /> {scope.label}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Audience selected" value={formatNumber(audience)} sub={`${targets.length} ${targetType.toLowerCase()}(s) targeted`} tone="sky" />
        <StatCard icon={Radio} label="Estimated reach" value={`${reachPct}%`} sub={`${formatNumber(reach)} farmers across ${channels.length} channel(s)`} tone="saffron" />
        <StatCard icon={AlertTriangle} label="Active cases of this pathogen" value={activeCases} sub={`${pathogen} in your jurisdiction`} tone="red" />
        <StatCard icon={History} label="Advisories issued" value={broadcasts.length} sub="This session — all logged to audit" tone="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHeader
            icon={Radio}
            title="Compose advisory"
            subtitle="Placeholders {pathogen}, {subject} and {zone} are substituted automatically"
            accent="red"
          />
          <div className="space-y-4 p-4">
            <div>
              <span className="label">Priority</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['EMERGENCY', 'ADVISORY', 'NOTICE'] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setPriority(value)}
                    className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                      priority === value
                        ? value === 'EMERGENCY'
                          ? 'bg-red-600 text-white'
                          : 'bg-saffron-500 text-navy-950'
                        : 'border border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Pathogen</span>
                <select
                  className="input"
                  value={pathogen}
                  onChange={(e) => {
                    setPathogen(e.target.value);
                    const match = PATHOGENS.find((p) => p.name === e.target.value);
                    if (match) setSubject(match.subjects[0]);
                  }}
                >
                  {PATHOGENS.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.type.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">Crop / species</span>
                <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {(PATHOGENS.find((p) => p.name === pathogen)?.subjects ?? []).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">Target zones</span>
                <div className="flex gap-1">
                  {(['DISTRICT', 'TALUKA'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setTargetType(value);
                        setTargets([]);
                      }}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                        targetType === value ? 'bg-saffron-500 text-navy-950' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {value === 'DISTRICT' ? 'By district' : 'By taluka'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {(targetType === 'DISTRICT' ? scope.districts : talukaOptions.map((t) => t.name)).map((name) => {
                  const on = targets.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggle(targets, name, setTargets)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        on ? 'bg-saffron-500 text-navy-950' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {scope.districts.length > 1 && targetType === 'DISTRICT' && (
                <button
                  onClick={() => setTargets(targets.length === scope.districts.length ? [] : [...scope.districts])}
                  className="mt-1.5 text-[10px] text-saffron-700 hover:underline"
                >
                  {targets.length === scope.districts.length ? 'Clear all' : 'Select every district in my jurisdiction'}
                </button>
              )}
            </div>

            <div>
              <span className="label">Channels</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const on = channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      onClick={() => toggle(channels, channel.id, (next) => setChannels(next))}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        on ? 'border-saffron-500/40 bg-saffron-500/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <channel.icon size={15} className={`mt-0.5 shrink-0 ${on ? 'text-saffron-700' : 'text-slate-500'}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                          {channel.label}
                          {on && <CheckCircle2 size={11} className="text-saffron-700" />}
                        </span>
                        <span className="block text-[10px] leading-snug text-slate-500">{channel.note}</span>
                        <span className="block text-[10px] text-slate-500">
                          {Math.round(channel.penetration * 100)}% of registered farmers
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="label">
                <Languages size={11} className="mr-1 inline" />
                Languages
              </span>
              <div className="flex gap-1.5">
                {['Marathi', 'Hindi', 'English'].map((language) => (
                  <button
                    key={language}
                    onClick={() => toggle(languages, language, setLanguages)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      languages.includes(language)
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="label mb-0 mr-auto">Message</span>
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setMessage(template.body);
                      setPriority(template.priority);
                    }}
                    className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
              <textarea className="input resize-none" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="mt-1 text-[10px] text-slate-500">
                {rendered.length} characters · {Math.ceil(rendered.length / 160)} SMS segment(s) per recipient ·{' '}
                {languages.length} language(s)
              </p>
            </div>

            <Button
              variant={priority === 'EMERGENCY' ? 'danger' : 'primary'}
              className="w-full"
              icon={Send}
              disabled={!canSend}
              onClick={() => setConfirming(true)}
            >
              {priority === 'EMERGENCY' ? 'Trigger emergency broadcast' : 'Issue advisory'}
            </Button>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader icon={Smartphone} title="Recipient preview" subtitle="As it will arrive on a handset" accent="emerald" />
            <div className="p-4">
              <div className="rounded-2xl rounded-tl-sm bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                  <MessageSquare size={11} /> GEOFARM.GOV · Dept. of Agriculture
                </p>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-navy-900">{rendered}</p>
                <p className="mt-2 text-right text-[9px] text-slate-500">now</p>
              </div>

              <div className="mt-4 space-y-2.5">
                <Meter value={reachPct} color="#ff9933" label="Estimated reach (union across channels)" />
                <p className="text-[10px] leading-relaxed text-slate-500">
                  Reach is the union of channel penetrations, not their sum — recipients registered on two
                  channels are counted once.
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader icon={History} title="Broadcast history" subtitle="Session log — mirrored to the audit trail" />
            {broadcasts.length === 0 ? (
              <EmptyState icon={Radio} title="Nothing broadcast yet" message="Issued advisories are logged here with their channel mix and reach." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {broadcasts.map((broadcast) => (
                  <li key={broadcast.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-navy-900">{broadcast.title}</p>
                      <Badge tone={broadcast.priority === 'EMERGENCY' ? 'red' : 'saffron'}>{broadcast.priority}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">
                      {broadcast.targets.length} {broadcast.targetType.toLowerCase()}(s) ·{' '}
                      {formatNumber(broadcast.reach)} reached · {broadcast.channels.join(', ')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {formatDateTime(broadcast.sentAt)} · {broadcast.sentBy}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Confirm ${priority.toLowerCase()} broadcast`}
        subtitle="Outbound messages cannot be recalled once queued with the gateway"
        width="max-w-md"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant={priority === 'EMERGENCY' ? 'danger' : 'primary'} className="flex-1" icon={Send} onClick={send}>
              Confirm &amp; send
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <AlertTriangle size={18} />
          </span>
          <div className="space-y-2 text-xs leading-relaxed text-slate-500">
            <p>
              This will dispatch to approximately{' '}
              <strong className="text-navy-900">{formatNumber(reach)} farmers</strong> across{' '}
              {targets.length} {targetType.toLowerCase()}(s) over {channels.join(', ')}.
            </p>
            <p className="text-slate-500">
              The action is recorded against <strong className="text-slate-700">{officer?.employeeCode}</strong> and
              IP {officer?.ip} in the audit log, and is visible to your reporting officer.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
