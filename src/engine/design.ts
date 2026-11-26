/**
 * Module owner: Harshit Pandey.
 * Footing design: applied net pressure, sizing against bearing (FS) and settlement, and the
 * building-level checks of total settlement, differential settlement and angular distortion.
 * No site values live here — limits, loads, grid and boreholes are all inputs.
 */
import { bearingCapacity, type BearingInput, type BearingResult } from './bearing';
import { totalStress } from './stress';
import { schmertmann, consolidationSettlement } from './settlement';
import { step, n, type Step } from './trace';
import type { Borehole, Footing, Load } from './types';

export interface PressureOptions {
  /** Include the weight of footing + backfill above the base (average unit weight γfb over Df). */
  includeSelfWeight?: boolean;
  /** Average unit weight of concrete footing + backfill, kN/m³ (assumption, typically ~20). */
  gammaFootingBackfill?: number;
}

/**
 * Net pressure applied at founding level.
 * Gross: qg = (P + γfb·A·Df)/A′ (self-weight optional); net: qn = qg − σv0(Df), σv0 = total overburden removed.
 * SOURCE: IS 6403:1981 definitions of gross and net pressure intensity — clause TO VERIFY; Das (2016) §3.9.
 */
export function appliedPressure(footing: Footing, load: Load, borehole: Borehole, areaEff: number, opt: PressureOptions = {}) {
  const A = footing.shape === 'circle' ? (Math.PI * footing.B ** 2) / 4 : footing.shape === 'strip' ? footing.B : footing.B * (footing.L ?? footing.B);
  const gfb = opt.gammaFootingBackfill ?? 20;
  const W = opt.includeSelfWeight === false ? 0 : gfb * A * footing.Df;
  const qg = (load.P + W) / areaEff;
  const sv = totalStress(borehole.layers, footing.Df, borehole.designWT);
  const qn = qg - sv;
  const steps: Step[] = [
    step({ title: 'Footing + backfill weight', equation: 'W = γfb · A · Df', substituted: opt.includeSelfWeight === false ? 'ignored' : `${n(gfb, 1)} × ${n(A, 3)} × ${n(footing.Df, 2)}`, value: W, unit: 'kN', source: 'assumption (stated)' }),
    step({ title: 'Gross pressure qg', equation: 'qg = (P + W) / A′', substituted: `(${n(load.P, 1)} + ${n(W, 1)}) / ${n(areaEff, 3)}`, value: qg, unit: 'kPa', source: 'IS 6403:1981 definitions — TO VERIFY' }),
    step({ title: 'Net pressure qn', equation: 'qn = qg − σv0(Df)', substituted: `${n(qg, 2)} − ${n(sv, 2)}`, value: qn, unit: 'kPa', source: 'net = gross − overburden removed' }),
  ];
  return { A, W, qg, qn, sigmaV0: sv, steps };
}

export interface FootingCheck {
  footing: Footing;
  bearing: BearingResult;
  qApplied: number; // net, kPa
  sImmediate: number; // m
  sConsolidation: number; // m
  sTotal: number; // m
  passBearing: boolean;
  passSettlement: boolean;
  steps: Step[];
  notes: string[];
}

export interface DesignOptions extends PressureOptions {
  FS?: number;
  mode?: BearingInput['mode'];
  useDepthFactors?: boolean;
  strength?: BearingInput['strength'];
  transition?: BearingInput['transition'];
  /** Allowable total settlement for sizing, mm. */
  sAllow: number;
  /** Schmertmann time, years. */
  tYears?: number;
  /** Sizing range and step, m. */
  Bmin?: number; Bmax?: number; Bstep?: number;
  /** Fixed L/B for rectangular footings (e.g. eccentric column). */
  LoverB?: number;
}

/**
 * Water table for σ′v0 (and hence OCR = σ′p/σ′v0) in the consolidation analysis: the WT measured when the samples were
 * taken (October), consistent with σ′p from those samples. The August-high WT would lower σ′v0, inflate OCR and push
 * more of Δσ onto the flat recompression branch — unconservative. Bearing and Schmertmann keep the design (August) WT,
 * which is the conservative case for them. SOURCE: effective-stress principle; docs/AI_AUDIT.md item B10.
 */
export const clayWT = (bh: Borehole): number => bh.measuredWT ?? bh.designWT;

export function checkFooting(footing: Footing, load: Load, bh: Borehole, opt: DesignOptions): FootingCheck {
  const bearing = bearingCapacity({ footing, load, layers: bh.layers, zw: bh.designWT, FS: opt.FS ?? 3, mode: opt.mode, useDepthFactors: opt.useDepthFactors, strength: opt.strength, transition: opt.transition });
  const pr = appliedPressure(footing, load, bh, bearing.areaEff, opt);
  const sch = schmertmann({ footing, layers: bh.layers, zw: bh.designWT, netPressure: pr.qn, tYears: opt.tYears });
  const con = consolidationSettlement({ footing, layers: bh.layers, zw: clayWT(bh), netPressure: pr.qn });
  const sTotal = sch.settlement + con.settlement;
  const passBearing = pr.qn <= bearing.qns + 1e-9;
  const passSettlement = sTotal * 1000 <= opt.sAllow + 1e-9;
  return {
    footing, bearing, qApplied: pr.qn, sImmediate: sch.settlement, sConsolidation: con.settlement, sTotal, passBearing, passSettlement,
    steps: [...pr.steps,
      step({ title: 'Bearing check', equation: 'qn ≤ qns', substituted: `${n(pr.qn, 2)} ≤ ${n(bearing.qns, 2)}`, value: pr.qn / bearing.qns, unit: 'utilisation', source: 'IS 6403:1981, FS = 3' }),
      step({ title: 'Total settlement', equation: 's = si (Schmertmann) + sc (consolidation)', substituted: `${n(sch.settlement * 1000, 2)} + ${n(con.settlement * 1000, 2)}`, value: sTotal * 1000, unit: 'mm', source: 'Schmertmann (1978); Das (2014) Ch. 11' }),
    ],
    notes: [...bearing.notes, ...sch.notes, ...con.notes],
  };
}

/**
 * Smallest footing (step Bstep) that satisfies both bearing (qn ≤ qns) and settlement (s ≤ sAllow).
 * Returns the governing check and whether a size was found within [Bmin, Bmax].
 */
export function sizeFooting(shape: Footing['shape'], Df: number, load: Load, bh: Borehole, opt: DesignOptions) {
  const Bmin = opt.Bmin ?? 0.6, Bmax = opt.Bmax ?? 6, dB = opt.Bstep ?? 0.05;
  let last: FootingCheck | null = null;
  for (let B = Bmin; B <= Bmax + 1e-9; B = +(B + dB).toFixed(4)) {
    const footing: Footing = { shape, B, Df, L: shape === 'rectangle' ? Math.round(B * (opt.LoverB ?? 1.5) * 100) / 100 : undefined };
    try {
      const c = checkFooting(footing, load, bh, opt);
      last = c;
      if (c.passBearing && c.passSettlement) return { found: true as const, check: c };
    } catch { /* e.g. eccentricity too large for this B — try a larger footing */ }
  }
  return { found: false as const, check: last };
}

/* ---------------- Building-level checks ---------------- */

export interface ColumnInput {
  id: string; // e.g. 'C4'
  x: number; y: number; // plan position, m
  load: Load;
  boreholeId: string;
  shape?: Footing['shape'];
}

export interface SettlementLimits {
  /** Max total settlement, mm. */
  maxTotal: number;
  /** Max differential settlement between adjacent columns, mm (absolute), or use maxDiffRatio. */
  maxDifferential?: number;
  /** Max differential as a fraction of span L (e.g. 0.0015 means 0.0015·L). */
  maxDiffRatio?: number;
  /** Max angular distortion δ/L (e.g. 1/500 = 0.002). */
  maxAngular: number;
  /** Text of the clause the team adopted, shown on checks. */
  source: string;
}

export interface PairCheck { a: string; b: string; span: number; delta: number; angular: number; passDiff: boolean; passAngular: boolean }

/** Adjacent pairs on a rectangular grid: columns whose centres are one grid spacing apart (same row or column). */
export function adjacentPairs(cols: ColumnInput[], tol = 1e-6): [ColumnInput, ColumnInput, number][] {
  const out: [ColumnInput, ColumnInput, number][] = [];
  const xs = [...new Set(cols.map((c) => +c.x.toFixed(6)))].sort((a, b) => a - b);
  const ys = [...new Set(cols.map((c) => +c.y.toFixed(6)))].sort((a, b) => a - b);
  const next = (arr: number[], v: number) => arr.find((u) => u > v + tol);
  for (const a of cols) {
    const nx = next(xs, a.x), ny = next(ys, a.y);
    for (const b of cols) {
      if (nx !== undefined && Math.abs(b.x - nx) < tol && Math.abs(b.y - a.y) < tol) out.push([a, b, nx - a.x]);
      if (ny !== undefined && Math.abs(b.y - ny) < tol && Math.abs(b.x - a.x) < tol) out.push([a, b, ny - a.y]);
    }
  }
  return out;
}

/**
 * Differential settlement δ = |si − sj| and angular distortion β = δ / l for adjacent columns.
 * SOURCE: IS 1904:1986 (definitions of differential settlement and angular distortion; limits in its table
 * for RC framed buildings) — limits are INPUTS chosen and cited by the team.
 */
export function buildingChecks(settlementsMm: Record<string, number>, cols: ColumnInput[], limits: SettlementLimits) {
  const pairs: PairCheck[] = adjacentPairs(cols).map(([a, b, span]) => {
    const delta = Math.abs((settlementsMm[a.id] ?? 0) - (settlementsMm[b.id] ?? 0));
    const angular = delta / 1000 / span;
    const diffLimit = limits.maxDifferential ?? (limits.maxDiffRatio !== undefined ? limits.maxDiffRatio * span * 1000 : Infinity);
    return { a: a.id, b: b.id, span, delta, angular, passDiff: delta <= diffLimit + 1e-9, passAngular: angular <= limits.maxAngular + 1e-12 };
  });
  const maxTotal = Math.max(...Object.values(settlementsMm));
  const worstDiff = pairs.reduce((m, p) => (p.delta > m.delta ? p : m), pairs[0]);
  const worstAng = pairs.reduce((m, p) => (p.angular > m.angular ? p : m), pairs[0]);
  return {
    pairs, maxTotal, worstDiff, worstAng,
    passTotal: maxTotal <= limits.maxTotal + 1e-9,
    passDiff: pairs.every((p) => p.passDiff),
    passAngular: pairs.every((p) => p.passAngular),
  };
}

/**
 * Raft check over the whole footprint (alternative foundation): uniform net pressure and
 * settlement under the centre and a corner using the same P3/P5 routines.
 */
export function raftCheck(B: number, L: number, Df: number, totalLoad: number, bh: Borehole, opt: Omit<DesignOptions, 'sAllow'> & { sAllow: number }) {
  const footing: Footing = { shape: 'rectangle', B, L, Df };
  const centre = checkFooting(footing, { P: totalLoad }, bh, opt);
  const conCorner = consolidationSettlement({ footing, layers: bh.layers, zw: clayWT(bh), netPressure: centre.qApplied, at: 'corner' });
  return { centre, sCornerConsolidation: conCorner.settlement };
}
