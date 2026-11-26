/**
 * Module owner: Harshit Pandey.
 * Alternative foundation — bored cast-in-situ piles (end bearing in a dense granular stratum + shaft friction).
 * Used where isolated footings cannot meet the bearing / settlement criteria (assignment design criterion 3).
 *
 * Single-pile ultimate capacity (IS 2911 Part 1/Sec 2, Annex B — static formula, TO VERIFY clause numbers):
 *   Qu = Qb + Qs
 *   Qb = Ap · (½·D·γ′·Nγ + P_D·Nq)                    base in granular soil
 *   Qs = Σ K·P_Di·tanδ·Asi (granular)  +  Σ α·cu·Asi (cohesive)
 *   P_D, P_Di = effective overburden at the toe / mid-layer, limited to the value at 20·D (critical depth)
 *   Q_safe = Qu / FS, FS = 2.5
 * Group: n = max(2, ⌈P / Q_safe⌉) piles at 3·D centres under a rigid cap with tie beams (efficiency 1 for end-bearing
 * piles in dense soil; minimum two piles per column is common practice — ASSUMED).
 * Settlement: single pile s1 = D/100 (base, at working load with FS ≥ 2.5) + P_pile·L/(Ap·Ec) (elastic shortening);
 * group s_g = s1·√(Bg/D) (Vesic 1969 group factor), Bg = group width.
 * SOURCE: Tomlinson & Woodward, Pile Design and Construction Practice (D/100 rule); Vesic (1969); Das (2016) §11 — TO VERIFY.
 */
import { effectiveStress } from './stress';
import { bearingFactors } from './bearing';
import { step, n, type Step } from './trace';
import { deg2rad } from './units';
import type { Borehole } from './types';

export interface PileOptions {
  /** Pile diameter, m. */
  D: number;
  /** Cut-off level (underside of pile cap), m bgl. */
  cutoff: number;
  /** Embedment into the bearing stratum, m (socket). */
  socket: number;
  /** Earth-pressure coefficient for shaft friction in granular soil (bored piles 1.0–2.0). ASSUMED. */
  K?: number;
  /** Adhesion factor for clay. ASSUMED. */
  alpha?: number;
  FS?: number;
  /** Characteristic concrete strength fck, MPa (default 30 = M30). Ec = 5000√fck MPa. */
  fck?: number;
  /** Concrete modulus, kPa — overrides fck if given. */
  Ec?: number;
}

export interface PileDesign {
  toe: number; length: number; bearingLayer: string;
  Qb: number; Qs: number; Qu: number; Qsafe: number; // kN
  nPiles: number; capB: number; // m (square cap side)
  sElastic: number; sRaft: number; sTotal: number; // m
  steps: Step[];
  ok: boolean;
}

const SRC = 'IS 2911 (Part 1/Sec 2):2010 Annex B — TO VERIFY';

/** Top of the first granular/rock layer below the deepest cohesive layer — the end-bearing stratum. */
export function bearingStratum(bh: Borehole) {
  const ls = [...bh.layers].sort((a, b) => a.top - b.top);
  let lastClay = -1;
  ls.forEach((l, i) => { if (l.behaviour === 'cohesive') lastClay = i; });
  return ls.slice(lastClay + 1).find((l) => l.behaviour === 'granular' || l.behaviour === 'rock') ?? ls[ls.length - 1];
}

export function singlePile(bh: Borehole, o: PileOptions) {
  const K = o.K ?? 1.5, alpha = o.alpha ?? 1.0, FS = o.FS ?? 2.5, D = o.D;
  const Ap = (Math.PI * D * D) / 4, per = Math.PI * D;
  const bs = bearingStratum(bh);
  const toe = bs.top + o.socket;
  const zw = bh.designWT;
  const zCrit = o.cutoff + 20 * D; // P_D limited at 20 D below cut-off
  const PD = (z: number) => effectiveStress(bh.layers, Math.min(z, zCrit), zw);
  const steps: Step[] = [];
  // shaft
  let Qs = 0;
  for (const l of [...bh.layers].sort((a, b) => a.top - b.top)) {
    const t = Math.max(l.top, o.cutoff), b = Math.min(l.bottom, toe);
    if (b <= t) continue;
    const As = per * (b - t);
    let q: number;
    if (l.behaviour === 'cohesive') q = alpha * (l.cu ?? 0) * As;
    else { const delta = deg2rad(l.phi ?? 30); q = K * PD((t + b) / 2) * Math.tan(delta) * As; }
    Qs += q;
    steps.push(step({ title: `Shaft friction ${l.symbol} ${n(t, 2)}–${n(b, 2)} m`, equation: l.behaviour === 'cohesive' ? 'Qs = α·cu·As' : 'Qs = K·P_D·tanδ·As (δ = φ)', substituted: l.behaviour === 'cohesive' ? `${n(alpha)} × ${n(l.cu ?? 0, 2)} × ${n(As, 3)}` : `${n(K)} × ${n(PD((t + b) / 2), 2)} × tan ${n(l.phi ?? 30, 1)}° × ${n(As, 3)}`, value: q, unit: 'kN', source: SRC }));
  }
  // base
  const f = bearingFactors(bs.phi ?? 36);
  const gEff = bs.gammaSat - 9.81;
  const Qb = Ap * (0.5 * D * gEff * f.Ng + PD(toe) * f.Nq);
  const Qu = Qb + Qs, Qsafe = Qu / FS;
  steps.unshift(
    step({ title: 'Bearing stratum and toe', equation: 'toe = top of bearing stratum + socket', substituted: `${bs.symbol} from ${n(bs.top, 2)} m + ${n(o.socket, 2)} m`, value: toe, unit: 'm', source: 'design choice' }),
    step({ title: 'Base resistance Qb', equation: 'Qb = Ap·(½·D·γ′·Nγ + P_D·Nq), P_D ≤ σ′v(20D)', substituted: `${n(Ap, 4)} × (0.5 × ${n(D, 2)} × ${n(gEff, 2)} × ${n(f.Ng, 2)} + ${n(PD(toe), 2)} × ${n(f.Nq, 2)})`, value: Qb, unit: 'kN', source: `${SRC}; Nq, Nγ per IS 6403 Table 1 (conservative vs Berezantsev chart)` }),
  );
  steps.push(
    step({ title: 'Ultimate capacity Qu', equation: 'Qu = Qb + ΣQs', substituted: `${n(Qb, 1)} + ${n(Qs, 1)}`, value: Qu, unit: 'kN', source: SRC }),
    step({ title: 'Safe capacity per pile', equation: 'Q_safe = Qu / 2.5', substituted: `${n(Qu, 1)} / ${n(FS, 2)}`, value: Qsafe, unit: 'kN', source: SRC }),
  );
  return { toe, length: toe - o.cutoff, bearingLayer: bs.symbol, Qb, Qs, Qu, Qsafe, steps };
}

/** Pile group under one column: number of piles, cap size and settlement. */
export function designPileGroup(P: number, bh: Borehole, o: PileOptions): PileDesign {
  const s1 = singlePile(bh, o);
  const nPiles = Math.max(2, Math.ceil(P / s1.Qsafe));
  const nSide = Math.ceil(Math.sqrt(nPiles));
  const spacing = 3 * o.D; // IS 2911: minimum 2.5–3 D — TO VERIFY
  const groupB = (nSide - 1) * spacing + o.D;
  const capB = groupB + 2 * 0.15; // 150 mm edge cover beyond piles
  const fck = o.fck ?? 30;
  // SOURCE: IS 456:2000 cl. 6.2.3.1 — short-term static modulus Ec = 5000√fck (MPa); × 1000 → kPa
  const Ec = o.Ec ?? 5000 * Math.sqrt(fck) * 1000;
  const Ap = (Math.PI * o.D * o.D) / 4;
  const Ppile = P / nPiles;
  const sElastic = (Ppile * s1.length) / (Ap * Ec);
  const sSingle = o.D / 100 + sElastic;
  const groupFactor = Math.sqrt(groupB / o.D);
  const sRaft = sSingle * groupFactor - sElastic; // base/group part, reported separately
  const sTotal = sElastic + sRaft;
  const steps = [...s1.steps,
    step({ title: 'Number of piles', equation: 'n = max(2, ⌈P / Q_safe⌉)', substituted: `max(2, ⌈${n(P, 1)} / ${n(s1.Qsafe, 1)}⌉)`, value: nPiles, unit: 'piles', source: `${SRC}; minimum 2 per column ASSUMED` }),
    step({ title: 'Pile cap (square)', equation: 'cap = (√n − 1)·3D + D + 2 × 0.15', substituted: `${nSide} × ${nSide} grid at ${n(spacing, 2)} m`, value: capB, unit: 'm', source: 'IS 2911 spacing ≥ 3D — TO VERIFY' }),
    step({ title: 'Single-pile settlement', equation: 's1 = D/100 + P_pile·L/(Ap·Ec)', substituted: `${n(o.D, 2)}/100 + ${n(Ppile, 1)} × ${n(s1.length, 2)} / (${n(Ap, 4)} × ${n(Ec, 0)})`, value: sSingle * 1000, unit: 'mm', source: `Tomlinson D/100 rule; Ec = 5000√fck (IS 456:2000 cl. 6.2.3.1), M${fck}` }),
    step({ title: 'Group settlement', equation: 's_g = s1·√(Bg / D)', substituted: `${n(sSingle * 1000, 2)} × √(${n(groupB, 2)} / ${n(o.D, 2)})`, value: (sSingle * groupFactor) * 1000, unit: 'mm', source: 'Vesic (1969) group factor — TO VERIFY' }),
  ];
  return { ...s1, nPiles, capB, sElastic, sRaft, sTotal, steps, ok: true };
}
