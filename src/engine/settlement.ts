/**
 * P5 — Settlement.
 *  (a) Granular layers: strain influence factor method, Schmertmann, Hartman & Brown (1978).
 *  (b) Clay layers: 1-D consolidation (NC and OC), sublayers ≤ 0.5 m, Δσ from Boussinesq (centre).
 *  (c) Time–settlement: Terzaghi 1-D consolidation, exact series U(Tv), single or double drainage.
 */
import { effectiveStress, layerAt } from './stress';
import { deltaSigmaCentre, deltaSigmaAt } from './stressIncrease';
import { step, n, type Step } from './trace';
import type { Footing, SoilLayer } from './types';

/* ===================== (a) Schmertmann 1978 ===================== */

/**
 * Strain influence factor Iz at depth z below the footing base.
 * Axisymmetric (L/B = 1): Iz = 0.1 at z = 0 → Izp at z = B/2 → 0 at z = 2B.
 * Plane strain (L/B ≥ 10): Iz = 0.2 at z = 0 → Izp at z = B → 0 at z = 4B.
 * 1 < L/B < 10: anchor values interpolated linearly with weight (L/B − 1)/9, as the 1978 paper suggests.
 * Izp = 0.5 + 0.1 √(Δp / σ′vp), σ′vp = effective stress at the depth of Izp.
 * SOURCE: Schmertmann, Hartman & Brown (1978) J. Geotech. Eng. Div. ASCE 104(GT8); Das (2016) Eq. 5.86–5.88.
 */
export function izDiagram(B: number, LoverB: number, Izp: number) {
  const w = Math.min(1, Math.max(0, (Math.min(LoverB, 10) - 1) / 9));
  return {
    Iz0: 0.1 + 0.1 * w,
    zPeak: B * (0.5 + 0.5 * w),
    zEnd: B * (2 + 2 * w),
    Izp,
  };
}

export function izAt(z: number, d: ReturnType<typeof izDiagram>): number {
  if (z <= 0) return d.Iz0;
  if (z <= d.zPeak) return d.Iz0 + (d.Izp - d.Iz0) * (z / d.zPeak);
  if (z <= d.zEnd) return d.Izp * (1 - (z - d.zPeak) / (d.zEnd - d.zPeak));
  return 0;
}

export interface SchmertmannInput {
  footing: Footing;
  layers: SoilLayer[];
  zw: number;
  /** Net foundation pressure Δp = q_applied − σ′v0(Df), kPa. */
  netPressure: number;
  /** Time after construction, years (C2). Default 0.1 yr → C2 = 1. */
  tYears?: number;
  /** Sublayer thickness for integration, m. */
  dz?: number;
}

export interface SchmertmannResult {
  C1: number; C2: number; Izp: number; zPeak: number; zEnd: number;
  rows: { zTop: number; zBot: number; zMid: number; Iz: number; E: number; symbol: string; contribution: number }[];
  settlement: number; // m
  steps: Step[];
  notes: string[];
}

/**
 * s = C1·C2·Δp·Σ (Iz/Es)·Δz over granular sublayers inside the influence zone.
 * C1 = 1 − 0.5 (σ′v0/Δp) ≥ 0.5; C2 = 1 + 0.2 log10(t / 0.1 yr).
 * SOURCE: Schmertmann et al. (1978); Das (2016) Eq. 5.85, 5.89, 5.90.
 */
export function schmertmann(inp: SchmertmannInput): SchmertmannResult {
  const { footing, layers, zw, netPressure: dp } = inp;
  const t = inp.tYears ?? 0.1;
  const dz = inp.dz ?? 0.1;
  const B = footing.B;
  const L = footing.shape === 'strip' ? Infinity : footing.shape === 'rectangle' ? (footing.L ?? B) : B;
  const LoverB = Number.isFinite(L) ? L / B : 10;
  const notes: string[] = [];
  const s0 = effectiveStress(layers, footing.Df, zw);
  if (!(dp > 0)) {
    return { C1: 1, C2: 1, Izp: 0, zPeak: 0, zEnd: 0, rows: [], settlement: 0, notes: ['Net pressure ≤ 0 kPa — no settlement computed.'], steps: [] };
  }
  const C1 = Math.max(0.5, 1 - 0.5 * (s0 / dp));
  const C2 = 1 + 0.2 * Math.log10(t / 0.1);
  const d0 = izDiagram(B, LoverB, 0.5);
  const svp = effectiveStress(layers, footing.Df + d0.zPeak, zw);
  const Izp = 0.5 + 0.1 * Math.sqrt(dp / svp);
  const d = izDiagram(B, LoverB, Izp);
  const rows: SchmertmannResult['rows'] = [];
  let sum = 0;
  for (let z = 0; z < d.zEnd - 1e-9; z += dz) {
    const zb = Math.min(z + dz, d.zEnd), zm = (z + zb) / 2;
    const lay = layerAt(layers, footing.Df + zm);
    if (lay.behaviour !== 'granular' && lay.behaviour !== 'fill') continue; // clay handled by consolidation
    if (!lay.E) { notes.push(`No E for ${lay.symbol} at ${n(footing.Df + zm, 2)} m — sublayer skipped.`); continue; }
    const Iz = izAt(zm, d);
    const c = (Iz / lay.E) * (zb - z);
    sum += c;
    rows.push({ zTop: z, zBot: zb, zMid: zm, Iz, E: lay.E, symbol: lay.symbol, contribution: C1 * C2 * dp * c });
  }
  const s = C1 * C2 * dp * sum;
  const src = 'Schmertmann, Hartman & Brown (1978); Das (2016) §5.14';
  return {
    C1, C2, Izp, zPeak: d.zPeak, zEnd: d.zEnd, rows, settlement: s, notes: [...new Set(notes)],
    steps: [
      step({ title: 'Net pressure Δp', equation: 'Δp = q − σ′v0(Df)', substituted: `given`, value: dp, unit: 'kPa', source: src }),
      step({ title: 'Embedment correction C1', equation: 'C1 = 1 − 0.5(σ′v0/Δp) ≥ 0.5', substituted: `C1 = 1 − 0.5 × (${n(s0, 2)} / ${n(dp, 2)})`, value: C1, unit: '', source: src }),
      step({ title: 'Creep correction C2', equation: 'C2 = 1 + 0.2 log10(t / 0.1)', substituted: `t = ${n(t, 2)} yr`, value: C2, unit: '', source: src }),
      step({ title: 'Peak influence Izp', equation: 'Izp = 0.5 + 0.1 √(Δp / σ′vp)', substituted: `Izp = 0.5 + 0.1 √(${n(dp, 2)} / ${n(svp, 2)})`, value: Izp, unit: '', source: src }),
      step({ title: 'Σ (Iz/E)·Δz', equation: 'over granular sublayers to z = ' + n(d.zEnd, 2) + ' m', substituted: `${rows.length} sublayers of ${n(dz, 2)} m`, value: sum, unit: 'm/kPa', source: src }),
      step({ title: 'Immediate settlement (granular)', equation: 's = C1·C2·Δp·Σ(Iz/E)Δz', substituted: `${n(C1)} × ${n(C2)} × ${n(dp, 2)} × ${n(sum, 7)}`, value: s * 1000, unit: 'mm', source: src }),
    ],
  };
}

/* ===================== (b) 1-D consolidation ===================== */

export interface ConsolidationInput {
  footing: Footing;
  layers: SoilLayer[];
  zw: number;
  netPressure: number; // kPa
  /** Where Δσ is evaluated: footing centre (default) or corner. */
  at?: 'centre' | 'corner';
  /** Max sublayer thickness, m (assignment: ≤ 0.5 m). */
  maxSub?: number;
  /** Only consider clay down to this depth below ground, m (default: bottom of profile). */
  zMax?: number;
  /** Extra Δσ from neighbouring footings at depth zb below this footing's base, kPa (superposition). */
  extra?: (zb: number) => number;
}

export interface ConsolidationRow {
  symbol: string; zTop: number; zBot: number; zMid: number; H: number;
  s0: number; dsig: number; sp: number; Cc: number; Cr: number; e0: number; state: 'NC' | 'OC-recompression' | 'OC-crossing';
  settlement: number; // m
}

export interface ConsolidationResult { rows: ConsolidationRow[]; settlement: number; steps: Step[]; notes: string[] }

/**
 * Settlement of one clay sublayer (m). See the three cases in the block comment below.
 * SOURCE: Das (2014) Eq. 11.29 (NC), 11.31 (OC, σ′0+Δσ ≤ σ′p), 11.32 (OC, σ′0+Δσ > σ′p).
 */
export function sublayerSettlement(Cc: number, Cr: number, e0: number, H: number, s0: number, dsig: number, sp: number): { s: number; state: ConsolidationRow['state'] } {
  const k = H / (1 + e0);
  const s1 = s0 + dsig;
  if (sp <= s0 + 1e-9) return { s: Cc * k * Math.log10(s1 / s0), state: 'NC' };
  if (s1 <= sp) return { s: Cr * k * Math.log10(s1 / s0), state: 'OC-recompression' };
  return { s: Cr * k * Math.log10(sp / s0) + Cc * k * Math.log10(s1 / sp), state: 'OC-crossing' };
}

/**
 * Primary consolidation settlement of each sublayer:
 * NC  (σ′p ≤ σ′0):            s = Cc·H/(1+e0) · log10((σ′0+Δσ)/σ′0)
 * OC, σ′0+Δσ ≤ σ′p:            s = Cr·H/(1+e0) · log10((σ′0+Δσ)/σ′0)
 * OC, σ′0 < σ′p < σ′0+Δσ:      s = Cr·H/(1+e0) · log10(σ′p/σ′0) + Cc·H/(1+e0) · log10((σ′0+Δσ)/σ′p)
 * SOURCE: Das (2014) Eq. 11.29, 11.31, 11.32; IS 8009 (Part 1):1976 — TO VERIFY clause.
 */
export function consolidationSettlement(inp: ConsolidationInput): ConsolidationResult {
  const { footing, layers, zw, netPressure: q } = inp;
  const maxSub = Math.min(inp.maxSub ?? 0.5, 0.5);
  const B = footing.B;
  const L = footing.shape === 'strip' ? 1e4 : footing.shape === 'rectangle' ? (footing.L ?? B) : B;
  const notes: string[] = [];
  const rows: ConsolidationRow[] = [];
  const zMax = inp.zMax ?? Math.max(...layers.map((l) => l.bottom));
  for (const l of [...layers].sort((a, b) => a.top - b.top)) {
    if (l.behaviour !== 'cohesive') continue;
    const top = Math.max(l.top, footing.Df), bot = Math.min(l.bottom, zMax);
    if (bot <= top) continue;
    if (l.Cc === undefined || l.e0 === undefined) { notes.push(`Layer ${l.symbol} ${l.top}–${l.bottom} m has no Cc/e0 — skipped.`); continue; }
    const nSub = Math.ceil((bot - top) / maxSub - 1e-9);
    const H = (bot - top) / nSub;
    for (let i = 0; i < nSub; i++) {
      const zTop = top + i * H, zBot = zTop + H, zMid = (zTop + zBot) / 2;
      const s0 = effectiveStress(layers, zMid, zw);
      const zb = zMid - footing.Df;
      const dsig = (inp.at === 'corner' ? deltaSigmaAt(q, B, L, 0, 0, zb) : deltaSigmaCentre(q, B, L, zb)) + (inp.extra?.(zb) ?? 0);
      const sp = Math.max(l.sigmaP ?? s0, s0);
      const Cr = l.Cr ?? l.Cc / 5;
      if (l.Cr === undefined) notes.push(`Layer ${l.symbol}: Cr not given — assumed Cc/5 (TO VERIFY; typical range Cc/5–Cc/10, Das 2014 §11.6).`);
      const { s, state } = sublayerSettlement(l.Cc, Cr, l.e0, H, s0, dsig, sp);
      rows.push({ symbol: l.symbol, zTop, zBot, zMid, H, s0, dsig, sp, Cc: l.Cc, Cr, e0: l.e0, state, settlement: s });
    }
  }
  const total = rows.reduce((a, r) => a + r.settlement, 0);
  const src = 'Das (2014) Eq. 11.29–11.32';
  const steps: Step[] = rows.slice(0, 1).map((r) => step({
    title: `Example sublayer ${n(r.zTop, 2)}–${n(r.zBot, 2)} m (${r.state})`,
    equation: r.state === 'NC' ? 's = Cc·H/(1+e0)·log10((σ′0+Δσ)/σ′0)' : r.state === 'OC-recompression' ? 's = Cr·H/(1+e0)·log10((σ′0+Δσ)/σ′0)' : 's = H/(1+e0)·[Cr log10(σ′p/σ′0) + Cc log10((σ′0+Δσ)/σ′p)]',
    substituted: `H = ${n(r.H, 3)} m, e0 = ${n(r.e0, 3)}, σ′0 = ${n(r.s0, 2)} kPa, Δσ = ${n(r.dsig, 2)} kPa, σ′p = ${n(r.sp, 2)} kPa`,
    value: r.settlement * 1000, unit: 'mm', source: src,
  }));
  steps.push(step({ title: 'Consolidation settlement (sum of sublayers ≤ 0.5 m)', equation: 'sc = Σ si', substituted: `${rows.length} sublayers`, value: total * 1000, unit: 'mm', source: src }));
  return { rows, settlement: total, steps, notes: [...new Set(notes)] };
}

/* ===================== (c) Time–settlement ===================== */

/**
 * Average degree of consolidation U(Tv) — Terzaghi's exact series:
 * U = 1 − Σ (2/M²) e^(−M² Tv),  M = π(2m + 1)/2.
 * SOURCE: Terzaghi (1925); Das (2014) Eq. 11.47–11.49.
 */
export function degreeOfConsolidation(Tv: number): number {
  if (Tv <= 0) return 0;
  let sum = 0;
  for (let m = 0; m < 200; m++) {
    const M = (Math.PI * (2 * m + 1)) / 2;
    const term = (2 / (M * M)) * Math.exp(-M * M * Tv);
    sum += term;
    if (term < 1e-12) break;
  }
  return Math.max(0, Math.min(1, 1 - sum));
}

/** Tv for a given U, by bisection on the exact series. */
export function timeFactor(U: number): number {
  let lo = 0, hi = 10;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (degreeOfConsolidation(mid) < U) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

export type Drainage = 'single' | 'double';

/**
 * Settlement–time curve. Tv = cv·t / Hdr², Hdr = H (single drainage) or H/2 (double drainage).
 * SOURCE: Das (2014) Eq. 11.46.
 */
export function timeSettlement(finalSettlement: number, cv: number, H: number, drainage: Drainage, tMaxYears = 20, nPts = 60) {
  const Hdr = drainage === 'double' ? H / 2 : H;
  const pts: { t: number; Tv: number; U: number; s: number }[] = [];
  for (let i = 0; i <= nPts; i++) {
    // log-spaced from 0.01 yr to tMax, plus t = 0
    const t = i === 0 ? 0 : 0.01 * Math.pow(tMaxYears / 0.01, (i - 1) / (nPts - 1));
    const Tv = (cv * t) / (Hdr * Hdr);
    const U = degreeOfConsolidation(Tv);
    pts.push({ t, Tv, U, s: U * finalSettlement });
  }
  const t50 = (timeFactor(0.5) * Hdr * Hdr) / cv;
  const t90 = (timeFactor(0.9) * Hdr * Hdr) / cv;
  return {
    Hdr, pts, t50, t90,
    steps: [
      step({ title: 'Drainage path Hdr', equation: drainage === 'double' ? 'Hdr = H/2' : 'Hdr = H', substituted: `H = ${n(H, 2)} m`, value: Hdr, unit: 'm', source: 'Das (2014) §11.11' }),
      step({ title: 'Time for 90 % consolidation', equation: 't90 = Tv(90%)·Hdr² / cv', substituted: `${n(timeFactor(0.9), 3)} × ${n(Hdr, 2)}² / ${n(cv, 3)}`, value: t90, unit: 'yr', source: 'Das (2014) Eq. 11.46' }),
    ],
  };
}
