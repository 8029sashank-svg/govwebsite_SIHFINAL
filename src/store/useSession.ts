'use client';

import { create } from 'zustand';
import type { Officer } from '@/lib/types';
import { buildOfficer, scopeFor, type CredentialInput } from '@/lib/rbac';
import type { Role } from '@/lib/types';

const KEY = 'geofarm-gov.session.v1';

interface SessionState {
  officer: Officer | null;
  /**
   * False until the persisted session has been read from localStorage.
   * Components must wait for this before deciding to redirect, otherwise
   * the server-rendered markup (always signed-out) and the first client
   * render disagree and React reports a hydration mismatch.
   */
  hydrated: boolean;
  hydrate: () => void;
  signIn: (input: CredentialInput, role: Role) => Officer;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  officer: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(KEY);
      set({ officer: raw ? (JSON.parse(raw) as Officer) : null, hydrated: true });
    } catch {
      set({ officer: null, hydrated: true });
    }
  },

  signIn: (input, role) => {
    const officer = buildOfficer(input, role);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(officer));
    } catch {
      // Private browsing — the session simply won't survive a reload.
    }
    set({ officer, hydrated: true });
    return officer;
  },

  signOut: () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* non-fatal */
    }
    set({ officer: null });
  },
}));

/** Convenience hook: the signed-in officer's jurisdiction. */
export function useScope() {
  const officer = useSession((s) => s.officer);
  return scopeFor(officer);
}
