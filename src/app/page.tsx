'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Mail, IdCard, MapPin, Loader2, ArrowRight, Landmark, Lock,
  Layers, Activity, Radio, FileBarChart2, Facebook, Twitter, Instagram,
  Youtube, Linkedin, Phone, ChevronLeft, ChevronRight, Play, Pause, Globe2,
  Menu, X,
} from 'lucide-react';
import { useSession } from '@/store/useSession';
import { validateCredentials, DESIGNATIONS, scopeFor, buildOfficer } from '@/lib/rbac';
import { DISTRICT_NAMES, getDistrict } from '@/lib/geography';
import { Button } from '@/components/ui';
import type { Role } from '@/lib/types';

/**
 * Public home page + officer sign-in gateway.
 *
 * Visually this now follows the conventions of a real Indian government
 * department site (utility bar, ministry header, an animated photo
 * carousel, quick-link nav) instead of a generic dark admin theme — but
 * it is intentionally scoped to this one file. The authenticated console
 * (dashboard, map, review queue, …) keeps its own dark "command console"
 * design system, defined globally in globals.css / tailwind.config.ts,
 * so none of that is touched here. Every photograph is a real,
 * freely-licensed (Pexels "Free to use") photo of Indian agriculture —
 * no stock illustrations, no renders of real people in official capacity.
 *
 * The employee code drives everything: its prefix selects the role, and
 * the role decides which extra fields are required (district for
 * division/district officers, district + taluka for taluka officers).
 */

const HERO_SLIDES: Array<{ image: string; eyebrow: string; headline: string; body: string }> = [
  {
    image: 'https://images.pexels.com/photos/7385132/pexels-photo-7385132.jpeg?auto=compress&cs=tinysrgb&w=1920',
    eyebrow: 'Surveillance across 36 districts',
    headline: "Protecting Every Farmer's Harvest",
    body: 'GeoFarm.gov gives officers a live, verified picture of onion disease - purple blotch, damping-off, basal rot and more - across Maharashtra.',
  },
  {
    image: 'https://images.pexels.com/photos/9268302/pexels-photo-9268302.jpeg?auto=compress&cs=tinysrgb&w=1920',
    eyebrow: 'Ground truth, verified',
    headline: 'Field Scouts. Real Evidence.',
    body: "Every AI-flagged case is checked against photographs, GPS and an officer's sign-off before it drives an advisory or a dispatch.",
  },
  {
    image: 'https://images.pexels.com/photos/3840335/pexels-photo-3840335.jpeg?auto=compress&cs=tinysrgb&w=1920',
    eyebrow: 'Nashik to Vidarbha',
    headline: 'From Seedbed to Storage',
    body: 'Disease and weather references cover onion from damping-off in the nursery to black mould and neck rot in storage.',
  },
  {
    image: 'https://images.pexels.com/photos/247597/pexels-photo-247597.jpeg?auto=compress&cs=tinysrgb&w=1920',
    eyebrow: 'Early warning',
    headline: 'Detect Outbreaks Before They Spread',
    body: 'Satellite trends, trap data and farmer reports are triaged by AI and escalated the moment a pattern looks serious.',
  },
  {
    image: 'https://images.pexels.com/photos/32397063/pexels-photo-32397063/free-photo-of-smiling-female-farmer-harvesting-sugarcane-in-bangladesh.jpeg?auto=compress&cs=tinysrgb&w=1920',
    eyebrow: 'Last-mile reach',
    headline: 'Advisories That Reach the Farm Gate',
    body: "SMS, IVR and WhatsApp broadcast verified guidance in the farmer's own language, in minutes — not days.",
  },
];

const DEMO_ACCOUNTS: Array<{ label: string; email: string; code: string; district?: string; taluka?: string; role: Role }> = [
  { label: 'State Commissioner — all 36 districts', email: 'commissioner.agri@gov.in', code: 'MH-AGRI-S001', role: 'STATE' },
  { label: 'Divisional JD — Nashik Division', email: 'jd.nashik@gov.in', code: 'MH-AGRI-DV002', district: 'Nashik', role: 'DIVISION' },
  { label: 'District SAO — Nashik', email: 'sao.nashik@gov.in', code: 'MH-AGRI-DT014', district: 'Nashik', role: 'DISTRICT' },
  { label: 'Taluka AO — Dindori, Nashik', email: 'tao.dindori@nic.in', code: 'MH-AGRI-TL087', district: 'Nashik', taluka: 'Dindori', role: 'TALUKA' },
];

const NAV_LINKS = ['Home', 'About', 'Modules', 'Helpline', 'Sign in'];

const FEATURES: Array<[typeof Layers, string, string]> = [
  [Layers, 'GIS case map + risk heatmap', 'Severity-coded pins over the nightly prediction surface'],
  [ShieldCheck, 'AI governance queue', 'No low-confidence diagnosis acts without a human signature'],
  [Activity, 'Field dispatch operations', 'Nearest available scout, tracked to resolution'],
  [Radio, 'Emergency broadcast', 'SMS, push, IVR and WhatsApp to targeted zones'],
  [FileBarChart2, 'Trend analytics & exports', 'Weekly outbreak history, CSV and print-ready PDF'],
  [Lock, 'Immutable audit log', 'Every override, sign-off and broadcast, with officer ID and IP'],
];

export default function SignInPage() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const officer = useSession((s) => s.officer);
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);

  const [form, setForm] = React.useState({ email: '', employeeCode: '', district: '', taluka: '' });
  const [errors, setErrors] = React.useState<ReturnType<typeof validateCredentials>['errors']>({});
  const [busy, setBusy] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // --- Hero carousel --------------------------------------------------
  const [slide, setSlide] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const slideCount = HERO_SLIDES.length;

  React.useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % slideCount);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [playing, slideCount]);

  const goTo = (index: number) => setSlide(((index % slideCount) + slideCount) % slideCount);
  const next = () => goTo(slide + 1);
  const prev = () => goTo(slide - 1);

  React.useEffect(() => hydrate(), [hydrate]);

  // Already signed in (returning from a refresh) — go straight through.
  React.useEffect(() => {
    if (hydrated && officer) router.replace('/dashboard');
  }, [hydrated, officer, router]);

  const preview = React.useMemo(() => validateCredentials(form), [form]);
  const role = preview.role;
  const codeValid = /^MH-AGRI-(S|DV|DT|TL)\d{3}$/i.test(form.employeeCode.trim());

  const talukas = React.useMemo(() => getDistrict(form.district)?.talukas ?? [], [form.district]);

  const scopePreview = React.useMemo(() => {
    if (!codeValid) return null;
    if (role !== 'STATE' && !form.district) return null;
    return scopeFor(buildOfficer(form, role));
  }, [codeValid, role, form]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateCredentials(form);
    setErrors(result.errors);
    if (!result.ok) return;

    setBusy(true);
    // Stands in for the departmental SSO round-trip.
    window.setTimeout(() => {
      signIn(form, result.role);
      router.push('/dashboard');
    }, 850);
  };

  const fill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setForm({
      email: account.email,
      employeeCode: account.code,
      district: account.district ?? '',
      taluka: account.taluka ?? '',
    });
    setErrors({});
    document.getElementById('sign-in')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 antialiased">
      {/* ---------------------------------------------------------------- */}
      {/* Utility bar                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-[#0b3d24] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-[11px]">
          <div className="flex items-center gap-2.5">
            {[Facebook, Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social link"
                className="flex h-5 w-5 items-center justify-center rounded-full text-emerald-200/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Icon size={11} />
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <span className="flex items-center gap-1.5 text-emerald-100/90">
              <Phone size={11} /> Kisan Call Centre 1800-180-1551
            </span>
            <span className="flex items-center gap-1 text-emerald-100/90">
              <Globe2 size={11} /> English
            </span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Ministry header                                                  */}
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#0b3d24]/15 bg-gradient-to-b from-emerald-50 to-white">
              <Landmark size={22} className="text-[#0b3d24]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-[#0b3d24] sm:text-base">
                कृषि विभाग · Department of Agriculture
              </p>
              <p className="truncate text-[11px] leading-tight text-slate-500 sm:text-xs">
                Government of Maharashtra · Commissionerate, Pune
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="mr-2 rounded-md bg-[#0b3d24] px-3 py-1.5 text-sm font-bold tracking-tight text-white">
              GeoFarm.gov
            </span>
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link}
                  href={link === 'Sign in' ? '#sign-in' : link === 'Home' ? '#top' : `#${link.toLowerCase()}`}
                  className={
                    link === 'Sign in'
                      ? 'ml-1 rounded-md bg-saffron-500 px-3.5 py-1.5 text-xs font-bold text-[#0b3d24] transition-colors hover:bg-saffron-400'
                      : 'rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-[#0b3d24]'
                  }
                >
                  {link}
                </a>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="rounded-md border border-slate-200 p-2 text-slate-600 lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="animate-fadeUp border-t border-slate-100 bg-white px-4 py-2 lg:hidden">
            <div className="flex flex-wrap gap-1.5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link}
                  href={link === 'Sign in' ? '#sign-in' : '#top'}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="tricolour h-1 w-full" />
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero carousel                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="top" className="relative h-[420px] overflow-hidden bg-[#0b3d24] sm:h-[480px] lg:h-[560px]" aria-roledescription="carousel">
        {HERO_SLIDES.map((s, i) => (
          <div
            key={s.image}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0, pointerEvents: i === slide ? 'auto' : 'none' }}
            aria-hidden={i !== slide}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.image}
              alt=""
              className={i === slide ? 'h-full w-full origin-center object-cover animate-kenburns' : 'h-full w-full object-cover'}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />
          </div>
        ))}

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-16 sm:pb-20">
          <div key={slide} className="max-w-xl animate-heroFadeIn">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-500/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0b3d24]">
              <Lock size={10} /> {HERO_SLIDES[slide].eyebrow}
            </span>
            <h1 className="mt-3 text-3xl font-bold leading-[1.1] text-white sm:text-4xl lg:text-5xl">
              {HERO_SLIDES[slide].headline}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-200 sm:text-base">
              {HERO_SLIDES[slide].body}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#sign-in"
                className="inline-flex items-center gap-2 rounded-lg bg-saffron-500 px-4 py-2.5 text-sm font-bold text-[#0b3d24] transition-colors hover:bg-saffron-400"
              >
                Officer sign-in <ArrowRight size={15} />
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                What is GeoFarm.gov?
              </a>
            </div>
          </div>
        </div>

        {/* Controls */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition-colors hover:bg-black/50 sm:left-4"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition-colors hover:bg-black/50 sm:right-4"
        >
          <ChevronRight size={18} />
        </button>

        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause carousel' : 'Play carousel'}
            className="flex h-5 w-5 items-center justify-center text-white/90 hover:text-white"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <div className="flex items-center gap-1.5">
            {HERO_SLIDES.map((s, i) => (
              <button
                key={s.image}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={
                  i === slide
                    ? 'h-1.5 w-5 rounded-full bg-saffron-400 transition-all'
                    : 'h-1.5 w-1.5 rounded-full bg-white/50 transition-all hover:bg-white/80'
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Stat / highlight strip                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-slate-200 bg-[#f7f9f5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden rounded-none bg-slate-200 sm:grid-cols-4">
          {[
            ['36', 'Districts covered'],
            ['420+', 'Active cases tracked'],
            ['75%', 'AI confidence threshold'],
            ['48', 'Field scouts on roster'],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#f7f9f5] px-4 py-5 text-center">
              <p className="text-2xl font-bold text-[#0b3d24] sm:text-3xl">{value}</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* About + Sign-in                                                  */}
      {/* ---------------------------------------------------------------- */}
      <main className="mx-auto max-w-7xl px-4 py-12 lg:py-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
          {/* About */}
          <section id="about" className="flex-1 scroll-mt-24">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0b3d24]">
              <ShieldCheck size={11} /> Restricted · Authorised officials only
            </span>

            <h2 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl">
              GeoFarm.gov
              <span className="mt-2 block text-lg font-medium text-saffron-600 sm:text-xl">
                Agricultural Surveillance &amp; Health Management System
              </span>
            </h2>

            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-600">
              A single operational picture of onion disease across all 36 districts: farmer-reported
              cases triaged by AI, low-confidence diagnoses held for expert sign-off, field scouts dispatched to
              verify, and advisories broadcast to registered farmers — every action written to an immutable audit
              trail.
            </p>

            <ul id="modules" className="mt-8 grid scroll-mt-24 gap-3 sm:grid-cols-2">
              {FEATURES.map(([Icon, title, body]) => (
                <li key={title} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                    <Icon size={13} className="text-[#0b3d24]" />
                    {title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{body}</p>
                </li>
              ))}
            </ul>

            {/* Photo strip */}
            <div className="mt-8 grid grid-cols-3 gap-2.5">
              {[
                'https://images.pexels.com/photos/60021/grapes-wine-fruit-vines-60021.jpeg?auto=compress&cs=tinysrgb&w=600',
                'https://images.pexels.com/photos/4770610/pexels-photo-4770610.jpeg?auto=compress&cs=tinysrgb&w=600',
                'https://images.pexels.com/photos/34204275/pexels-photo-34204275/free-photo-of-farmers-harvesting-rice-in-lush-green-field.jpeg?auto=compress&cs=tinysrgb&w=600',
              ].map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-24 w-full rounded-lg object-cover sm:h-28" loading="lazy" />
              ))}
            </div>
          </section>

          {/* Sign-in card */}
          <section id="sign-in" className="w-full scroll-mt-24 lg:w-[27rem]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
              <div className="tricolour h-1.5" />
              <div className="border-b border-slate-100 bg-[#f7f9f5] px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Lock size={14} className="text-[#0b3d24]" /> Officer sign-in
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Departmental SSO · @gov.in and @nic.in addresses only</p>
              </div>

              <form onSubmit={submit} className="space-y-4 px-5 py-5" noValidate>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="email">
                    Official email <span className="text-saffron-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="username"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#0b3d24] focus:outline-none focus:ring-1 focus:ring-[#0b3d24]/30"
                      placeholder="designation.district@gov.in"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="code">
                    Employee code <span className="text-saffron-600">*</span>
                  </label>
                  <div className="relative">
                    <IdCard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="code"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 font-mono text-sm uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal transition-colors focus:border-[#0b3d24] focus:outline-none focus:ring-1 focus:ring-[#0b3d24]/30"
                      placeholder="MH-AGRI-DT014"
                      value={form.employeeCode}
                      onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                    />
                  </div>
                  {errors.employeeCode ? (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{errors.employeeCode}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">S = State · DV = Division · DT = District · TL = Taluka</p>
                  )}
                </div>

                {codeValid && role !== 'STATE' && (
                  <div className="animate-fadeUp">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="district">
                      {role === 'DIVISION' ? 'District in your division' : 'District'}{' '}
                      <span className="text-saffron-600">*</span>
                    </label>
                    <div className="relative">
                      <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        id="district"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 transition-colors focus:border-[#0b3d24] focus:outline-none focus:ring-1 focus:ring-[#0b3d24]/30"
                        value={form.district}
                        onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, taluka: '' }))}
                      >
                        <option value="">Select…</option>
                        {DISTRICT_NAMES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.district && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.district}</p>}
                  </div>
                )}

                {codeValid && role === 'TALUKA' && form.district && (
                  <div className="animate-fadeUp">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="taluka">
                      Taluka <span className="text-saffron-600">*</span>
                    </label>
                    <select
                      id="taluka"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[#0b3d24] focus:outline-none focus:ring-1 focus:ring-[#0b3d24]/30"
                      value={form.taluka}
                      onChange={(e) => setForm((f) => ({ ...f, taluka: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {talukas.map((taluka) => (
                        <option key={taluka.id} value={taluka.name}>
                          {taluka.name}
                        </option>
                      ))}
                    </select>
                    {errors.taluka && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.taluka}</p>}
                  </div>
                )}

                {scopePreview && (
                  <div className="animate-fadeUp rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0b3d24]">
                      <ShieldCheck size={12} /> {DESIGNATIONS[role]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">Data scope: {scopePreview.label}</p>
                  </div>
                )}

                <Button type="submit" className="w-full justify-center" disabled={busy} icon={busy ? undefined : ArrowRight}>
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Verifying credentials…
                    </>
                  ) : (
                    'Verify & sign in'
                  )}
                </Button>
              </form>

              <div className="border-t border-slate-100 bg-[#f7f9f5] px-5 py-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Demo accounts — click to fill
                </p>
                <ul className="space-y-1">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.code}>
                      <button
                        type="button"
                        onClick={() => fill(account)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-medium text-slate-700">{account.label}</span>
                          <span className="block truncate font-mono text-[10px] text-slate-500">{account.email}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-saffron-600">{account.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 px-5 py-3">
                <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
                  <Lock size={11} className="mt-0.5 shrink-0" />
                  Prototype build: credentials are validated in the browser and the session is held in
                  localStorage. Production deployment authenticates against the NIC directory and issues a signed,
                  httpOnly session cookie with server-side jurisdiction enforcement.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer id="helpline" className="scroll-mt-24 border-t border-slate-200 bg-[#0b3d24] py-8 text-emerald-100">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-white">GeoFarm.gov</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-emerald-100/80">
                Department of Agriculture, Government of Maharashtra — agricultural
                surveillance prototype.
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                {[Facebook, Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    aria-label="Social link"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-emerald-100 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <Icon size={13} />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-xs sm:flex sm:gap-10">
              <div>
                <p className="mb-1.5 font-semibold text-white">Helplines</p>
                <p className="text-emerald-100/80">Kisan Call Centre · 1800-180-1551</p>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-white">Quick links</p>
                <a href="#about" className="block text-emerald-100/80 hover:text-white">About</a>
                <a href="#modules" className="block text-emerald-100/80 hover:text-white">Modules</a>
                <a href="#sign-in" className="block text-emerald-100/80 hover:text-white">Officer sign-in</a>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4 text-[11px] text-emerald-100/70 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Department of Agriculture, Government of Maharashtra — prototype.</p>
            <p>Photography: Pexels contributors, used under the Pexels licence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
