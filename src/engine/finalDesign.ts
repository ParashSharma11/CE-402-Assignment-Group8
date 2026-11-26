/**
 * Final foundation design for the whole building. Module owner: Harshit Pandey.
 *  1. Isolated footings are tried in every borehole zone. A zone is feasible only if every column in it can be given a
 *     footing that (a) passes IS 6403 bearing with the required FS, (b) settles ≤ the IS 1904 total limit, and
 *     (c) fits the grid (B, L ≤ spacing − clearance, so neighbouring footings do not touch).
 *  2. Zones that are not feasible get bored piles to the end-bearing stratum (design criterion 3 of the brief).
 *  3. Isolated footings are then PROPORTIONED FOR EQUAL SETTLEMENT: one target settlement s* is chosen, each footing is
 *     the smallest size that settles ≤ s*, and s* is the largest value for which every adjacent pair meets the IS 1904
 *     differential-settlement and angular-distortion limits. (Sizing every footing to its minimum makes heavily and
 *     lightly loaded neighbours settle differently.) SOURCE: proportioning for uniform settlement — Terzaghi & Peck
 *     (1967) / Tomlinson, Foundation Design and Construction — TO VERIFY edition and section.
 *  4. Where piled and footing zones meet, a movement (separation) joint is provided, so pairs across it are not
 *     checked for differential settlement — or piles are used under the whole building if chosen.
 */
import { checkFooting, adjacentPairs, type ColumnInput, type DesignOptions, type FootingCheck, type SettlementLimits } from './design';
import { designPileGroup, type PileDesign, type PileOptions } from './piles';
import type { Borehole, Footing } from './types';

export interface FinalOptions extends DesignOptions {
  /** Founding depth of the footings, m. */
  Df: number;
  sx: number; sy: number;
  /** Minimum clear gap between neighbouring footings, m. ASSUMED 0.3 m. */
  clearance?: number;
  pile: PileOptions;
  /** Where isolated footings fail: piles in that zone with a movement joint, or piles under the whole building. */
  alternative?: 'piles-zone' | 'piles-all';
}

export interface FinalColumn {
  col: ColumnInput;
  type: 'isolated' | 'piles';
  check: FootingCheck | null; // isolated
  pile: PileDesign | null; // piles
  s: number; // settlement, m
  footprint: { B: number; L: number }; // plan size of footing or pile cap, m
}

export interface FinalPair { a: string; b: string; span: number; delta: number; angular: number; separated: boolean; passDiff: boolean; passAngular: boolean }

export interface FinalDesign {
  columns: FinalColumn[];
  zones: { bh: string; type: 'isolated' | 'piles'; reason: string }[];
  target: number | null; // s*, m
  pairs: FinalPair[];
  maxTotal: number; // mm
  passTotal: boolean; passDiff: boolean; passAngular: boolean; passBearing: boolean;
  jointBetween: string[]; // e.g. ["5–6"]
  notes: string[];
}

interface Trial { B: number; L: number; ok: boolean; s: number; check: FootingCheck }

export function finalDesign(cols: ColumnInput[], bhs: Borehole[], limits: SettlementLimits, o: FinalOptions): FinalDesign {
  const clear = o.clearance ?? 0.3;
  const capX = o.sx - clear, capY = o.sy - clear;
  const LoB = o.LoverB ?? 1.5;
  const bh = new Map(bhs.map((b) => [b.id, b]));
  const notes: string[] = [];
  const Bmin = o.Bmin ?? 0.6, dB = o.Bstep ?? 0.05;

  // 1. trial curves (memoised per borehole / load / shape)
  const memo = new Map<string, Trial[]>();
  const curve = (c: ColumnInput): Trial[] => {
    const b = bh.get(c.boreholeId); if (!b) return [];
    const shape = c.shape ?? 'square';
    const key = `${b.id}|${c.load.P}|${c.load.MB ?? 0}|${shape}`;
    const hit = memo.get(key); if (hit) return hit;
    const out: Trial[] = [];
    for (let B = Bmin; B <= Math.min(capX, shape === 'rectangle' ? capY / LoB : capY) + 1e-9; B = +(B + dB).toFixed(4)) {
      const footing: Footing = { shape, B, Df: o.Df, L: shape === 'rectangle' ? Math.round(B * LoB * 100) / 100 : undefined };
      try {
        const ch = checkFooting(footing, c.load, b, o);
        out.push({ B, L: footing.L ?? B, ok: ch.passBearing, s: ch.sTotal, check: ch });
      } catch { /* e.g. eccentricity too large for small B */ }
    }
    memo.set(key, out);
    return out;
  };
  const sMax = limits.maxTotal / 1000;
  const feasible = (c: ColumnInput) => curve(c).some((t) => t.ok && t.s <= sMax + 1e-12);

  // 2. zone decision
  const zoneIds = [...new Set(cols.map((c) => c.boreholeId))];
  const zoneOk = new Map(zoneIds.map((z) => [z, cols.filter((c) => c.boreholeId === z).every(feasible)]));
  const anyFail = [...zoneOk.values()].some((v) => !v);
  const pileZone = (z: string) => (o.alternative === 'piles-all' && anyFail) || !zoneOk.get(z);
  const zones = zoneIds.map((z) => ({
    bh: z, type: (pileZone(z) ? 'piles' : 'isolated') as 'isolated' | 'piles',
    reason: !zoneOk.get(z) ? `isolated footings cannot meet bearing + ${limits.maxTotal} mm settlement within the ${o.sx} m grid` : pileZone(z) ? 'piles under the whole building (chosen)' : `isolated footings feasible`,
  }));

  // 3. piles
  const piles = new Map<string, PileDesign>();
  for (const c of cols) if (pileZone(c.boreholeId) && bh.get(c.boreholeId)) piles.set(c.id, designPileGroup(c.load.P, bh.get(c.boreholeId)!, o.pile));

  // adjacency and joints
  const adj = adjacentPairs(cols);
  const typeOf = (c: ColumnInput) => (pileZone(c.boreholeId) ? 'piles' : 'isolated');
  const jointOn = o.alternative !== 'piles-all';
  const separated = (a: ColumnInput, b: ColumnInput) => jointOn && typeOf(a) !== typeOf(b);

  // 4. equal-settlement proportioning of the isolated footings
  const iso = cols.filter((c) => typeOf(c) === 'isolated');
  const pick = (c: ColumnInput, T: number) => curve(c).find((t) => t.ok && t.s <= T + 1e-12) ?? null;
  const sOf = (id: string, chosen: Map<string, Trial>) => (chosen.get(id)?.s ?? piles.get(id)?.sTotal ?? 0);
  const evaluate = (chosen: Map<string, Trial>) => adj.map(([a, b, span]) => {
    const delta = Math.abs(sOf(a.id, chosen) - sOf(b.id, chosen)) * 1000;
    const angular = delta / 1000 / span;
    const dl = limits.maxDifferential ?? (limits.maxDiffRatio !== undefined ? limits.maxDiffRatio * span * 1000 : Infinity);
    const sep = separated(a, b);
    return { a: a.id, b: b.id, span, delta, angular, separated: sep, passDiff: sep || delta <= dl + 1e-9, passAngular: sep || angular <= limits.maxAngular + 1e-12 };
  });
  type Sol = { T: number; chosen: Map<string, Trial>; pairs: FinalPair[] };
  let best: Sol | null = null;
  let fallback: Sol | null = null; let fallbackWorst = Infinity;
  for (let T = sMax; T >= 0.002; T -= 0.0005) {
    const chosen = new Map<string, Trial>(); let ok = true;
    for (const c of iso) { const t = pick(c, T); if (!t) { ok = false; break; } chosen.set(c.id, t); }
    if (!ok) break; // smaller targets are impossible too
    const pairs = evaluate(chosen);
    if (pairs.every((p) => p.passDiff && p.passAngular)) { best = { T, chosen, pairs }; break; }
    const worst = Math.max(0, ...pairs.filter((p) => !p.separated).map((p) => p.delta));
    if (worst < fallbackWorst) { fallbackWorst = worst; fallback = { T, chosen, pairs }; }
  }
  const sol = best ?? fallback ?? { T: sMax, chosen: new Map(iso.map((c) => [c.id, pick(c, sMax)!]).filter(([, t]) => t) as [string, Trial][]), pairs: [] as FinalPair[] };
  if (!best && iso.length) notes.push('No single target settlement satisfies every differential limit with isolated footings; the closest design is shown — consider combined footings, a raft, or piles for more lines.');
  const pairs = sol.pairs.length ? sol.pairs : evaluate(sol.chosen);

  const columns: FinalColumn[] = cols.map((c) => {
    if (piles.has(c.id)) { const p = piles.get(c.id)!; return { col: c, type: 'piles', check: null, pile: p, s: p.sTotal, footprint: { B: p.capB, L: p.capB } }; }
    const t = sol.chosen.get(c.id) ?? null;
    return { col: c, type: 'isolated', check: t?.check ?? null, pile: null, s: t?.s ?? 0, footprint: { B: t?.B ?? 0, L: t?.L ?? 0 } };
  });
  const maxTotal = Math.max(0, ...columns.map((c) => c.s * 1000));
  const lines = new Set<string>();
  for (const [a, b] of adj) if (separated(a, b) && a.y === b.y) lines.add(`${a.id.slice(1)}–${b.id.slice(1)}`);
  if (lines.size) notes.push(`Movement (separation) joint between grid lines ${[...lines].join(', ')}: piled and footing blocks settle independently. In seismic zone V the joint gap must also satisfy IS 1893 — TO VERIFY.`);
  return {
    columns, zones, target: best ? sol.T : null, pairs, maxTotal,
    passTotal: maxTotal <= limits.maxTotal + 1e-9,
    passDiff: pairs.every((p) => p.passDiff), passAngular: pairs.every((p) => p.passAngular),
    passBearing: columns.every((c) => (c.type === 'piles' ? c.pile!.Qsafe * c.pile!.nPiles >= c.col.load.P - 1e-9 : !!c.check?.passBearing)),
    jointBetween: [...lines], notes,
  };
}
