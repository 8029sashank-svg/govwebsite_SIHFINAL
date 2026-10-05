'use client';

import { create } from 'zustand';
import type { MapLevel } from '@/lib/districtRisk';

/**
 * useRiskAtlas.ts
 * ---------------
 * View state for the 3D risk atlas: what is hovered / selected, how deep
 * the user has drilled, and which camera preset they asked for. It holds
 * no case data — that comes from the console stores — so it cannot leak
 * into the rest of the app.
 *
 * DRILL-DOWN MODEL
 *   state    -> the whole of Maharashtra
 *   district -> one district selected (camera flies to it, summary card)
 *   inspect  -> "Inspect district": camera dives in, case pins appear and
 *               the full pest / disease / case panel opens
 *
 * The scene reads this store inside useFrame via getState() so hover and
 * selection never re-render 34 meshes; React components subscribe with
 * narrow selectors instead.
 */

export type AtlasMode = 'state' | 'district' | 'inspect';
export type AtlasView = '3d' | 'top';
export type AtlasLayout = 'side' | 'sheet';
export type InspectorTab = 'overview' | 'pests' | 'cases';

interface RiskAtlasState {
  hoveredKey: string | null;
  selectedKey: string | null;
  mode: AtlasMode;
  view: AtlasView;
  layout: AtlasLayout;
  showLabels: boolean;
  levelFilter: MapLevel | null;
  focusedCaseId: string | null;
  diagnosisFilter: string | null;
  tab: InspectorTab;
  introPlayed: boolean;

  setHovered: (key: string | null) => void;
  select: (key: string) => void;
  inspect: (key?: string) => void;
  back: () => void;
  clear: () => void;
  setView: (view: AtlasView) => void;
  setLayout: (layout: AtlasLayout) => void;
  toggleLabels: () => void;
  setLevelFilter: (level: MapLevel | null) => void;
  focusCase: (id: string | null) => void;
  setDiagnosisFilter: (name: string | null) => void;
  setTab: (tab: InspectorTab) => void;
  reset: () => void;
}

const INITIAL = {
  hoveredKey: null,
  selectedKey: null,
  mode: 'state' as AtlasMode,
  view: '3d' as AtlasView,
  layout: 'side' as AtlasLayout,
  showLabels: true,
  levelFilter: null,
  focusedCaseId: null,
  diagnosisFilter: null,
  tab: 'overview' as InspectorTab,
  introPlayed: false,
};

export const useRiskAtlas = create<RiskAtlasState>((set) => ({
  ...INITIAL,

  setHovered: (key) => set({ hoveredKey: key }),

  select: (key) =>
    set((s) => ({
      selectedKey: key,
      // Switching district while inspecting keeps you inspecting.
      mode: s.mode === 'inspect' ? 'inspect' : 'district',
      focusedCaseId: null,
      diagnosisFilter: null,
      tab: s.mode === 'inspect' ? s.tab : 'overview',
      hoveredKey: null,
    })),

  inspect: (key) =>
    set((s) => {
      const target = key ?? s.selectedKey;
      if (!target) return {};
      return {
        selectedKey: target,
        mode: 'inspect',
        focusedCaseId: null,
        diagnosisFilter: null,
        tab: 'overview',
        hoveredKey: null,
      };
    }),

  back: () =>
    set((s) => {
      if (s.mode === 'inspect') return { mode: 'district', focusedCaseId: null, diagnosisFilter: null };
      return { mode: 'state', selectedKey: null, focusedCaseId: null, diagnosisFilter: null, hoveredKey: null };
    }),

  clear: () =>
    set({ mode: 'state', selectedKey: null, focusedCaseId: null, diagnosisFilter: null, hoveredKey: null }),

  setView: (view) => set({ view }),
  setLayout: (layout) => set({ layout }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  setLevelFilter: (level) => set((s) => ({ levelFilter: s.levelFilter === level ? null : level })),
  focusCase: (id) => set((s) => ({ focusedCaseId: id, tab: id ? 'cases' : s.tab })),
  setDiagnosisFilter: (name) => set((s) => ({ diagnosisFilter: s.diagnosisFilter === name ? null : name, focusedCaseId: null })),
  setTab: (tab) => set({ tab }),
  reset: () => set({ ...INITIAL }),
}));
