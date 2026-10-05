'use client';

import { create } from 'zustand';

/**
 * useAtlasStore.ts
 * ----------------
 * Ported from the standalone Atlas prototype (src/store/useMapStore.js).
 * Separate from the console's own `useSession` / `useOps` / `useFilters`
 * stores — this one only ever holds Atlas view state (hovered/selected
 * district, camera transition flag) and nothing from the case/officer
 * domain, so it can't leak into or be confused with the rest of the app's
 * state.
 */
interface AtlasState {
  hoveredId: string | null;
  selectedId: string | null;
  view: 'overview' | 'district';
  isTransitioning: boolean;
  setHovered: (idOrUpdater: string | null | ((current: string | null) => string | null)) => void;
  selectDistrict: (id: string) => void;
  clearSelection: () => void;
  setTransitioning: (val: boolean) => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  hoveredId: null,
  selectedId: null,
  view: 'overview',
  isTransitioning: false,

  setHovered: (idOrUpdater) =>
    set((state) => ({
      hoveredId: typeof idOrUpdater === 'function' ? idOrUpdater(state.hoveredId) : idOrUpdater,
    })),

  selectDistrict: (id) =>
    set({
      selectedId: id,
      view: 'district',
      isTransitioning: true,
    }),

  clearSelection: () =>
    set({
      selectedId: null,
      view: 'overview',
      isTransitioning: true,
    }),

  setTransitioning: (val) => set({ isTransitioning: val }),
}));
