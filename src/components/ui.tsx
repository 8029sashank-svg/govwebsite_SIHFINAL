'use client';

import React from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={clsx('panel', className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  accent = 'saffron',
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  accent?: 'saffron' | 'sky' | 'emerald' | 'red' | 'violet';
}) {
  const accents = {
    saffron: 'bg-saffron-500/10 text-saffron-600',
    sky: 'bg-sky-500/10 text-sky-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    red: 'bg-red-500/10 text-red-600',
    violet: 'bg-violet-500/10 text-violet-600',
  };

  return (
    <header className="panel-header">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accents[accent])}>
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-navy-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'navy' | 'danger' | 'emerald' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
};

export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-saffron-500 text-white hover:bg-saffron-600 shadow-sm',
    navy: 'bg-navy-800 text-white hover:bg-navy-700 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
    subtle: 'text-slate-600 hover:bg-slate-100',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & meters                                                     */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'red' | 'orange' | 'amber' | 'emerald' | 'sky' | 'violet' | 'saffron';
  className?: string;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    saffron: 'bg-saffron-500/10 text-saffron-700 ring-saffron-500/30',
  };
  return <span className={clsx('chip', tones[tone], className)}>{children}</span>;
}

/** Badge driven by a raw class string (used for severity/status metadata). */
export function MetaChip({ label, chip }: { label: string; chip: string }) {
  return <span className={clsx('chip', chip)}>{label}</span>;
}

export function Meter({
  value,
  max = 100,
  color = '#e07b12',
  label,
  showValue = true,
  height = 'h-1.5',
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
  showValue?: boolean;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-[11px]">
          {label && <span className="text-slate-500">{label}</span>}
          {showValue && <span className="font-mono font-semibold text-slate-700">{Math.round(value)}</span>}
        </div>
      )}
      <div className={clsx('w-full overflow-hidden rounded-full bg-slate-100', height)}>
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'sky',
  trend,
  loading,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'sky' | 'saffron' | 'red' | 'emerald' | 'violet' | 'amber';
  trend?: number;
  loading?: boolean;
}) {
  const tones = {
    sky: 'text-sky-700 bg-sky-50 border-sky-200',
    saffron: 'text-saffron-700 bg-saffron-500/10 border-saffron-500/25',
    red: 'text-red-700 bg-red-50 border-red-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    violet: 'text-violet-700 bg-violet-50 border-violet-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  };

  if (loading) return <SkeletonCard />;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg border', tones[tone])}>
          {Icon && <Icon size={16} />}
        </span>
        {typeof trend === 'number' && (
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              trend >= 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none text-navy-900">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeletons                                                   */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden rounded bg-slate-100', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="panel p-4">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="mt-3 h-2.5 w-24" />
      <Skeleton className="mt-2 h-6 w-20" />
      <Skeleton className="mt-2 h-2.5 w-32" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={clsx('h-4', c === 0 ? 'w-40' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('panel relative z-10 w-full animate-fadeUp overflow-hidden', width)}>
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-navy-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900">
            ✕
          </button>
        </div>
        <div className="max-h-[64vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon size={22} />
        </span>
      )}
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page heading                                                        */
/* ------------------------------------------------------------------ */

export function PageHeading({
  eyebrow = 'Department of Agriculture',
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-saffron-700">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
