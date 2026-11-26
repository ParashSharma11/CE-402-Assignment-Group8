import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Borehole, SoilLayer, ShearMode, SettlementLimits, OedometerPoint, Footing } from '../engine';

export interface ProjectInfo {
  name: string;
  location: string;
  group: number;
  FS: number;
  Df: number;
  mode: ShearMode;
  useDepthFactors: boolean;
  includeSelfWeight: boolean;
  gammaFB: number;
  tYears: number;
  /** Strength for IS 6403: team v1 method = shear-zone average (default) or founding layer. */
  strength?: 'zone-average' | 'base-layer';
  /** 29°–36° transition: team v1 method = interpolate factors (default) or interpolate capacity. */
  transition?: 'factors' | 'capacity';
  limits: SettlementLimits;
}

export interface Zone { from: number; to: number; bh: string }
export interface ColumnOverride { P?: number; MB?: number; shape?: Footing['shape'] }

export interface Building {
  nLines: number; // grid lines along length (1..n), west → east
  nRows: number; // rows across width (A..), south → north
  sx: number; sy: number; // spacing, m
  loads: { corner: number; edge: number; interior: number }; // unfactored, kN
  overrides: Record<string, ColumnOverride>;
  zoning: Zone[];
}

export interface LabData {
  directShear: { name: string; sigma: number[]; tau: number[] }[];
  uu: { name: string; dev: number[] }[];
  oed: { unit: 'kPa' | 'kg/cm2'; e0: number; points: OedometerPoint[] };
}

export interface QuickCalc { bh: string; shape: Footing['shape']; B: number; L: number; Df: number; P: number; MB: number }

export interface ProjectState {
  project: ProjectInfo;
  building: Building;
  boreholes: Borehole[];
  lab: LabData;
  quick: QuickCalc;
  exampleLoaded: boolean;
  setProject: (p: Partial<ProjectInfo>) => void;
  setBuilding: (b: Partial<Building>) => void;
  setOverride: (id: string, o: ColumnOverride | null) => void;
  updateBorehole: (id: string, patch: Partial<Borehole>) => void;
  addBorehole: () => void;
  removeBorehole: (id: string) => void;
  replaceBoreholes: (bhs: Borehole[]) => void;
  importProject: (data: Partial<Pick<ProjectState, 'project' | 'building' | 'boreholes' | 'lab'>>) => void;
  updateLayer: (bhId: string, i: number, patch: Partial<SoilLayer>) => void;
  addLayer: (bhId: string) => void;
  removeLayer: (bhId: string, i: number) => void;
  setLab: (l: Partial<LabData>) => void;
  setQuick: (q: Partial<QuickCalc>) => void;
  loadExample: () => Promise<void>;
  resetBlank: () => void;
}

const blankBorehole = (id: string): Borehole => ({
  id, groundRL: 100, measuredWT: 3, designWT: 2, x: 0, y: 0, spt: [],
  layers: [
    { top: 0, bottom: 3, symbol: 'SM', behaviour: 'granular', gammaMoist: 18, gammaSat: 20, c: 0, phi: 30, E: 15000 },
    { top: 3, bottom: 10, symbol: 'CI', behaviour: 'cohesive', gammaSat: 18.5, cu: 30, Cc: 0.3, Cr: 0.04, e0: 0.9, cv: 2 },
  ],
});

const blankState = () => ({
  project: {
    name: 'New site', location: '', group: 0, FS: 3, Df: 1.5, mode: 'auto' as ShearMode, useDepthFactors: true,
    includeSelfWeight: true, gammaFB: 20, tYears: 0.1, strength: 'zone-average' as const, transition: 'factors' as const,
    limits: { maxTotal: 50, maxDiffRatio: 0.0015, maxAngular: 1 / 666, source: 'IS 1904:1986 Table 1 — cite the row you adopt' },
  },
  building: { nLines: 4, nRows: 3, sx: 5, sy: 5, loads: { corner: 500, edge: 800, interior: 1200 }, overrides: {}, zoning: [{ from: 1, to: 4, bh: 'BH-1' }] },
  boreholes: [blankBorehole('BH-1')],
  lab: { directShear: [], uu: [], oed: { unit: 'kPa' as const, e0: 0.9, points: [] } },
  quick: { bh: 'BH-1', shape: 'square' as Footing['shape'], B: 2, L: 3, Df: 1.5, P: 1000, MB: 0 },
  exampleLoaded: false,
});

const sortLayers = (ls: SoilLayer[]) => [...ls].sort((a, b) => a.top - b.top);

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...blankState(),
      setProject: (p) => set((s) => ({ project: { ...s.project, ...p } })),
      setBuilding: (b) => set((s) => ({ building: { ...s.building, ...b } })),
      setOverride: (id, o) => set((s) => {
        const ov = { ...s.building.overrides };
        if (o) ov[id] = { ...ov[id], ...o }; else delete ov[id];
        return { building: { ...s.building, overrides: ov } };
      }),
      updateBorehole: (id, patch) => set((s) => ({ boreholes: s.boreholes.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      addBorehole: () => set((s) => {
        let k = s.boreholes.length + 1;
        while (s.boreholes.some((b) => b.id === `BH-${k}`)) k++;
        return { boreholes: [...s.boreholes, blankBorehole(`BH-${k}`)] };
      }),
      removeBorehole: (id) => set((s) => ({ boreholes: s.boreholes.filter((b) => b.id !== id) })),
      replaceBoreholes: (bhs) => set((s) => {
        // keep zoning valid: zones pointing to a borehole that no longer exists move to the first imported one
        const ids = new Set(bhs.map((b) => b.id));
        const zoning = s.building.zoning.map((z) => (ids.has(z.bh) ? z : { ...z, bh: bhs[0]?.id ?? z.bh }));
        return { boreholes: bhs, building: { ...s.building, zoning }, quick: { ...s.quick, bh: ids.has(s.quick.bh) ? s.quick.bh : bhs[0]?.id ?? s.quick.bh } };
      }),
      importProject: (d) => set((s) => ({ project: { ...s.project, ...d.project }, building: { ...s.building, ...d.building }, boreholes: d.boreholes ?? s.boreholes, lab: { ...s.lab, ...d.lab } })),
      updateLayer: (bhId, i, patch) => set((s) => ({
        boreholes: s.boreholes.map((b) => {
          if (b.id !== bhId) return b;
          const layers = b.layers.map((l, j) => (j === i ? { ...l, ...patch } : l));
          // keep contiguity: when a bottom changes, the next layer's top follows
          if (patch.bottom !== undefined && layers[i + 1]) layers[i + 1] = { ...layers[i + 1], top: patch.bottom };
          if (patch.top !== undefined && i > 0) layers[i - 1] = { ...layers[i - 1], bottom: patch.top };
          return { ...b, layers };
        }),
      })),
      addLayer: (bhId) => set((s) => ({
        boreholes: s.boreholes.map((b) => {
          if (b.id !== bhId) return b;
          const ls = sortLayers(b.layers);
          const top = ls.length ? ls[ls.length - 1].bottom : 0;
          return { ...b, layers: [...ls, { top, bottom: top + 2, symbol: 'SP', behaviour: 'granular', gammaMoist: 18.5, gammaSat: 20, c: 0, phi: 32, E: 20000 }] };
        }),
      })),
      removeLayer: (bhId, i) => set((s) => ({
        boreholes: s.boreholes.map((b) => {
          if (b.id !== bhId || b.layers.length <= 1) return b;
          const ls = b.layers.filter((_, j) => j !== i);
          // close the gap
          for (let j = 1; j < ls.length; j++) ls[j] = { ...ls[j], top: ls[j - 1].bottom };
          if (ls[0]) ls[0] = { ...ls[0], top: 0 };
          return { ...b, layers: ls };
        }),
      })),
      setLab: (l) => set((s) => ({ lab: { ...s.lab, ...l } })),
      setQuick: (q) => set((s) => ({ quick: { ...s.quick, ...q } })),
      loadExample: async () => {
        const m = await import('../examples/mandi');
        set({
          project: {
            ...get().project, name: 'Students’ hostel, G+3 RC frame', location: 'Mandi, Himachal Pradesh · seismic zone V',
            group: m.GROUP_NUMBER, Df: m.DF, limits: m.limitsCandidate.sand,
          },
          building: {
            nLines: 7, nRows: 4, sx: 5, sy: 5, loads: { corner: 650, edge: 1000, interior: 1450 },
            overrides: { C4: { P: 1450, MB: 362.5, shape: 'rectangle' } },
            zoning: [{ from: 1, to: 2, bh: 'BH-2' }, { from: 3, to: 5, bh: 'BH-1' }, { from: 6, to: 7, bh: 'BH-3' }],
          },
          boreholes: structuredClone(m.boreholes),
          lab: {
            directShear: [
              { name: 'SM unsoaked', ...m.lab.directShear.SM_unsoaked },
              { name: 'SM soaked 24 h', ...m.lab.directShear.SM_soaked },
              { name: 'SP soaked 24 h', ...m.lab.directShear.SP_soaked },
            ],
            uu: [{ name: 'UDS-1 7.00–7.45 m', dev: m.lab.uu.UDS1 }, { name: 'UDS-2 9.50–9.95 m', dev: m.lab.uu.UDS2 }],
            oed: { unit: 'kg/cm2', e0: m.lab.oedometerUDS1.e0, points: m.lab.oedometerUDS1.points },
          },
          quick: { bh: 'BH-1', shape: 'square', B: 3.2, L: 4.8, Df: 1.5, P: 1450 * m.lambda, MB: 0 },
          exampleLoaded: true,
        });
      },
      resetBlank: () => set(blankState()),
    }),
    {
      name: 'geofound-project-v1',
      storage: createJSONStorage(() => {
        try { localStorage.setItem('__gf', '1'); localStorage.removeItem('__gf'); return localStorage; }
        catch { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; }
      }),
      partialize: (s) => ({ project: s.project, building: s.building, boreholes: s.boreholes, lab: s.lab, quick: s.quick, exampleLoaded: s.exampleLoaded }),
    },
  ),
);

export const rowLabel = (i: number) => String.fromCharCode(65 + i);
