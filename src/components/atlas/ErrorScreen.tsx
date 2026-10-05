'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorScreen({
  title = 'Something went wrong',
  message,
  actionLabel = 'Retry',
  onAction,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05070a] px-6 text-center">
      <div className="atlas-glass flex h-16 w-16 items-center justify-center rounded-2xl border-red-400/30 atlas-shadow-panel">
        <AlertTriangle className="text-red-400" size={28} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400">{message}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="mt-6 flex items-center gap-2 rounded-full border border-saffron-400/30 bg-saffron-400/10 px-5 py-2.5 text-sm font-semibold text-saffron-200 transition-colors hover:bg-saffron-400/20"
        >
          <RotateCcw size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
