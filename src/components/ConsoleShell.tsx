'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard, Map as MapIcon, ShieldQuestion, Send, LineChart, Radio,
  IndianRupee, ScrollText, Landmark, LogOut, Menu, X, ChevronDown, Bell,
  ChevronsLeft, ChevronsRight, Loader2, AlertTriangle, Boxes, BookOpen } from 'lucide-react';
import { useSession } from '@/store/useSession';
import { useOps } from '@/store/useOps';
import { can, ROLE_LABEL, scopeFor } from '@/lib/rbac';
import { withinScope } from '@/lib/rbac';
import { initials } from '@/lib/format';
import { REVIEW_THRESHOLD } from '@/lib/catalog';

/**
 * ConsoleShell
 * ------------
 * Sidebar + topbar chrome, plus the client-side auth guard.
 *
 * The guard waits for `hydrated` before deciding anything: the server
 * render is always signed-out, so redirecting before localStorage has
 * been read would bounce a legitimately signed-in officer back to the
 * login screen on every refresh.
 *
 * Navigation items declare the capability they need, so a taluka officer
 * simply never sees the broadcast console rather than seeing it and
 * being refused.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
  capability?: string;
  badge?: 'review';
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Situation' },
  { href: '/map', label: 'GIS Map', icon: MapIcon, group: 'Situation' },
  { href: '/diseases', label: 'Onion Disease Library', icon: BookOpen, group: 'Situation' },
  { href: '/atlas', label: '3D State Atlas', icon: Boxes, group: 'Situation' },
  { href: '/review', label: 'Case Review Queue', icon: ShieldQuestion, group: 'Governance', capability: 'REVIEW_CASES', badge: 'review' },
  { href: '/dispatch', label: 'Field Dispatch', icon: Send, group: 'Operations', capability: 'DISPATCH' },
  { href: '/broadcast', label: 'Alert Broadcast', icon: Radio, group: 'Operations', capability: 'BROADCAST_DISTRICT' },
  { href: '/analytics', label: 'Trend Analytics', icon: LineChart, group: 'Analysis' },
  { href: '/impact', label: 'Economic Impact', icon: IndianRupee, group: 'Analysis' },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, group: 'Compliance' },
];

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { officer, hydrated, hydrate, signOut } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => hydrate(), [hydrate]);

  React.useEffect(() => {
    if (hydrated && !officer) router.replace('/');
  }, [hydrated, officer, router]);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const casesFn = useOps((s) => s.cases);
  const overrides = useOps((s) => s.overrides);
  const pendingCount = React.useMemo(() => {
    if (!officer) return 0;
    return withinScope(casesFn(), officer).filter(
      (c) => c.status === 'PENDING_REVIEW' && c.aiConfidence < REVIEW_THRESHOLD,
    ).length;
    // `overrides` is the real dependency — see store/hooks.ts.
  }, [casesFn, overrides, officer]);

  if (!hydrated || !officer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin text-saffron-600" />
          {hydrated ? 'Redirecting to sign-in…' : 'Restoring session…'}
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter((item) => !item.capability || can(officer.role, item.capability));
  const groups = visibleNav.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  const scope = scopeFor(officer);

  const sidebar = (
    <nav
      className={clsx(
        'flex h-full flex-col gap-5 overflow-y-auto px-2.5 py-4 transition-[width] duration-200',
        collapsed ? 'w-[4.25rem]' : 'w-56',
      )}
      aria-label="Console navigation"
    >
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
    {!collapsed && (
            <p className="mb-1.5 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">{group}</p>
          )}
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-saffron-500/10 text-saffron-700 ring-1 ring-saffron-500/25'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-navy-900',
                    )}
                  >
                    <item.icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.badge === 'review' && pendingCount > 0 && (
                      <span
                        className={clsx(
                          'ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700',
                          collapsed && 'absolute',
                        )}
                      >
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto space-y-2">
        {!collapsed && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Jurisdiction</p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-navy-900">{scope.label}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{ROLE_LABEL[officer.role]} level access</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:flex"
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-800">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <div className="tricolour h-1 w-full shrink-0 no-print" />

      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 shadow-sm no-print">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-saffron-500/40 bg-gradient-to-b from-saffron-500/10 to-emerald-600/10">
          <Landmark size={17} className="text-saffron-600" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-navy-900">
            GeoFarm.gov
            <span className="ml-2 hidden font-normal text-slate-500 md:inline">
              Agricultural Surveillance &amp; Health Management
            </span>
          </p>
          <p className="truncate text-[10px] leading-tight text-slate-500">
            Government of Maharashtra · Department of Agriculture
          </p>
        </div>

        <HierarchyIndicator officer={officer} scopeLabel={scope.label} />

        <Link
          href="/review"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label={`${pendingCount} cases awaiting review`}
        >
          <Bell size={17} />
          {pendingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </Link>

        <UserMenu officer={officer} onSignOut={() => { signOut(); router.replace('/'); }} />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden shrink-0 border-r border-slate-200 bg-white lg:block no-print">{sidebar}</aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-60 animate-fadeUp border-r border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span className="text-sm font-semibold text-navy-900">Navigation</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded p-1 text-slate-500 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main id="main" className="grid-bg min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HierarchyIndicator({ officer, scopeLabel }: { officer: NonNullable<ReturnType<typeof useSession.getState>['officer']>; scopeLabel: string }) {
  const chain = ['State', officer.division, officer.district, officer.taluka].filter(Boolean) as string[];

  return (
    <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 md:flex" title={scopeLabel}>
      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Scope</span>
      <span className="flex items-center gap-1 text-[11px] text-slate-600">
        {chain.map((node, index) => (
          <React.Fragment key={node}>
            {index > 0 && <span className="text-slate-300">›</span>}
            <span className={index === chain.length - 1 ? 'font-semibold text-saffron-700' : ''}>{node}</span>
          </React.Fragment>
        ))}
      </span>
    </div>
  );
}

function UserMenu({
  officer,
  onSignOut,
}: {
  officer: NonNullable<ReturnType<typeof useSession.getState>['officer']>;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-500/15 text-xs font-bold text-saffron-700">
          {initials(officer.name)}
        </span>
        <ChevronDown size={12} className="hidden text-slate-400 md:block" />
      </button>

      {open && (
        <div className="panel absolute right-0 top-full z-50 mt-2 w-72 animate-fadeUp overflow-hidden p-2" role="menu">
          <div className="border-b border-slate-200 px-2.5 pb-3 pt-2">
            <p className="text-sm font-semibold text-navy-900">{officer.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{officer.email}</p>
            <p className="mt-1.5 text-[11px] text-slate-600">{officer.designation}</p>
            <dl className="mt-2 space-y-0.5 font-mono text-[10px] text-slate-500">
              <div className="flex justify-between">
                <dt>Employee code</dt>
                <dd className="text-slate-600">{officer.employeeCode}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Session IP</dt>
                <dd className="text-slate-600">{officer.ip}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Access level</dt>
                <dd className="text-saffron-700">{ROLE_LABEL[officer.role]}</dd>
              </div>
            </dl>
          </div>

          <p className="flex items-start gap-1.5 px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            All actions in this console are recorded against your employee code in the audit log.
          </p>

          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
            role="menuitem"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
