/**
 * P3 — Net ultimate and net safe bearing capacity to IS 6403:1981.
 *
 * Drained (c–φ) general shear:
 *   qnu = c·Nc·sc·dc·ic + q·(Nq − 1)·sq·dq·iq + ½·B′·γ·Nγ·sγ·dγ·iγ·W′
 * Undrained (φu = 0):
 *   qnu = cu·Nc·sc·dc·ic,  Nc = 5.14
 * Net safe bearing capacity qns = qnu / FS.
 *
 * Clause numbers below are given as best known and marked TO VERIFY where not checked against the code text.
 */
import { deg2rad, rad2deg } from './units';
import { effectiveStress, layerAt } from './stress';
import { step, n, type Step } from './trace';
import type { Footing, Load, SoilLayer } from './types';

const SRC = 'IS 6403:1981';

export interface BearingFactors { Nc: number; Nq: number; Ng: number }

/**
 * Bearing capacity factors.
 * Nq = e^(π tanφ) tan²(45° + φ/2); Nc = (Nq − 1) cotφ (Nc = 5.14 at φ = 0); Nγ = 2 (Nq + 1) tanφ.
 * SOURCE: IS 6403:1981 Table 1 (Nq, Nc after Prandtl–Reissner; Nγ after Vesic 1973).
 */
export function bearingFactors(phiDeg: number): BearingFactors {
  const p = deg2rad(phiDeg);
  if (phiDeg <= 1e-9) return { Nc: 5.14, Nq: 1, Ng: 0 };
  const Nq = Math.exp(Math.PI * Math.tan(p)) * Math.tan(Math.PI / 4 + p / 2) ** 2;
  const Nc = (Nq - 1) / Math.tan(p);
  const Ng = 2 * (Nq + 1) * Math.tan(p);
  return { Nc, Nq, Ng };
}

/**
 * Local-shear reduced strength: c_m = ⅔ c, φ_m = arctan(⅔ tanφ).
 * SOURCE: IS 6403:1981 cl. 5.1.2 (local shear failure, after Terzaghi 1943) — clause number TO VERIFY.
 */
export const localShear = (c: number, phiDeg: number) => ({ c: (2 / 3) * c, phi: rad2deg(Math.atan((2 / 3) * Math.tan(deg2rad(phiDeg)))) });

export interface ShapeFactors { sc: number; sq: number; sg: number }

/**
 * Shape factors. SOURCE: IS 6403:1981 Table 2 — strip 1, 1, 1; square 1.3, 1.2, 0.8; circle 1.3, 1.2, 0.6;
 * rectangle 1 + 0.2 B/L, 1 + 0.2 B/L, 1 − 0.4 B/L.
 */
export function shapeFactors(shape: Footing['shape'], B: number, L: number): ShapeFactors {
  switch (shape) {
    case 'strip': return { sc: 1, sq: 1, sg: 1 };
    case 'square': return { sc: 1.3, sq: 1.2, sg: 0.8 };
    case 'circle': return { sc: 1.3, sq: 1.2, sg: 0.6 };
    case 'rectangle': return { sc: 1 + 0.2 * (B / L), sq: 1 + 0.2 * (B / L), sg: 1 - 0.4 * (B / L) };
  }
}

/**
 * Depth factors. dc = 1 + 0.2 (Df/B) √Nφ; dq = dγ = 1 for φ < 10°, = 1 + 0.1 (Df/B) √Nφ for φ ≥ 10°;
 * Nφ = tan²(45° + φ/2).
 * SOURCE: IS 6403:1981 cl. 5.1.2.2 (depth factors; to be used only where backfill is properly compacted) — clause number TO VERIFY.
 */
export function depthFactors(phiDeg: number, Df: number, B: number) {
  const Nphi = Math.tan(Math.PI / 4 + deg2rad(phiDeg) / 2) ** 2;
  const r = Df / B;
  const dc = 1 + 0.2 * r * Math.sqrt(Nphi);
  const dq = phiDeg < 10 ? 1 : 1 + 0.1 * r * Math.sqrt(Nphi);
  return { dc, dq, dg: dq, Nphi };
}

/**
 * Inclination factors. ic = iq = (1 − α/90)²; iγ = (1 − α/φ)² (0 if α ≥ φ), α in degrees.
 * SOURCE: IS 6403:1981 cl. 5.1.2.3 (after Meyerhof 1963) — clause number TO VERIFY.
 */
export function inclinationFactors(alphaDeg: number, phiDeg: number) {
  const ic = (1 - alphaDeg / 90) ** 2;
  const ig = phiDeg > 0 ? (alphaDeg >= phiDeg ? 0 : (1 - alphaDeg / phiDeg) ** 2) : (alphaDeg > 0 ? 0 : 1);
  return { ic, iq: ic, ig };
}

/**
 * Water-table factor W′ (applied to the γ term): W′ = 1 if the WT is at or below Df + B,
 * 0.5 if at or above the founding level, linear in between.
 * SOURCE: IS 6403:1981 cl. 5.1.2.4 (effect of water table) — clause number TO VERIFY.
 */
export function waterTableFactor(zw: number, Df: number, B: number): number {
  if (zw >= Df + B) return 1;
  if (zw <= Df) return 0.5;
  return 0.5 + 0.5 * ((zw - Df) / B);
}

export type ShearMode = 'general' | 'local' | 'auto';
export type Analysis = 'drained' | 'undrained';

export interface BearingInput {
  footing: Footing;
  load?: Load;
  layers: SoilLayer[];
  /** Design water table, m bgl. */
  zw: number;
  FS?: number;
  mode?: ShearMode;
  analysis?: Analysis;
  useDepthFactors?: boolean;
  /**
   * Which strength to use: 'base-layer' = layer at founding level (default);
   * 'zone-average' = thickness-weighted c, φ, γ over the shear zone Df → Df + B (as the team's v1 engine does).
   */
  strength?: 'base-layer' | 'zone-average';
  /**
   * For 29° < φ < 36° in auto mode: 'capacity' = interpolate qnu between local and general results (default);
   * 'factors' = interpolate Nc, Nq, Nγ linearly between their local (φ_local) and general (φ) values, with c and φ
   *   (for the depth factors) interpolated the same way — the method of the team's v1 engine (Gaurav Dtyal).
   */
  transition?: 'capacity' | 'factors';
  /** Override soil parameters at founding level (else taken from the layer at Df). */
  c?: number; phi?: number; cu?: number; gamma?: number;
}

export interface BearingResult {
  analysis: Analysis;
  modeUsed: 'general' | 'local' | 'interpolated';
  B: number; L: number; Beff: number; Leff: number; eB: number; eL: number; areaEff: number;
  c: number; phi: number; q: number; gamma: number; Wp: number;
  factors: BearingFactors; shape: ShapeFactors;
  depth: { dc: number; dq: number; dg: number };
  incl: { ic: number; iq: number; ig: number };
  terms: { cohesion: number; surcharge: number; selfWeight: number };
  qnu: number; // kPa
  FS: number;
  qns: number; // kPa net safe
  qsGross: number; // kPa gross safe = qns + q
  steps: Step[];
  notes: string[];
}

function single(input: BearingInput, phi: number, c: number, label: 'general' | 'local', factorsOverride?: BearingFactors): Omit<BearingResult, 'modeUsed' | 'FS' | 'qns' | 'qsGross'> {
  const { footing, load = { P: 0 }, layers, zw, useDepthFactors = true } = input;
  const notes: string[] = [];
  const base = layerAt(layers, footing.Df + 1e-6);
  const analysis: Analysis = input.analysis ?? (base.behaviour === 'cohesive' ? 'undrained' : 'drained');
  const B = footing.B;
  const L = footing.shape === 'strip' ? Infinity : footing.shape === 'rectangle' ? (footing.L ?? footing.B) : footing.B;
  // eccentricity → effective dimensions. SOURCE: IS 6403:1981 cl. 5.1.3 (B′ = B − 2eB, L′ = L − 2eL) — clause number TO VERIFY.
  const P = load.P || 0;
  const eB = P > 0 ? (load.MB ?? 0) / P : 0;
  const eL = P > 0 && Number.isFinite(L) ? (load.ML ?? 0) / P : 0;
  if (footing.shape === 'circle' && (eB || eL)) notes.push('Eccentricity ignored for a circular footing (no IS 6403 effective-area rule).');
  let Beff = footing.shape === 'circle' ? B : B - 2 * Math.abs(eB);
  let Leff = Number.isFinite(L) ? (footing.shape === 'circle' ? B : L - 2 * Math.abs(eL)) : Infinity;
  if (Beff <= 0 || Leff <= 0) throw new Error('Eccentricity too large: effective width ≤ 0.');
  if (Leff < Beff) [Beff, Leff] = [Leff, Beff];
  const areaEff = footing.shape === 'circle' ? (Math.PI * B * B) / 4 : footing.shape === 'strip' ? Beff : Beff * Leff;

  const q = effectiveStress(layers, footing.Df, zw); // effective overburden at founding level
  const gamma = input.gamma ?? (base.gammaMoist ?? base.gammaSat);
  const Wp = waterTableFactor(zw, footing.Df, B);
  // A square made rectangular by eccentricity uses the rectangle expressions with B′/L′; a rectangle with B = L uses the square row.
  const shapeKind: Footing['shape'] = footing.shape === 'square' || footing.shape === 'rectangle'
    ? (Math.abs(Beff - Leff) < 1e-9 ? 'square' : 'rectangle')
    : footing.shape;
  const sh = shapeFactors(shapeKind, Beff, Leff);
  const alpha = load.alpha ?? 0;
  const steps: Step[] = [];

  if (analysis === 'undrained') {
    const cu = input.cu ?? base.cu;
    if (cu === undefined) throw new Error(`No cu for layer ${base.symbol} at founding level.`);
    const f = bearingFactors(0);
    const d = useDepthFactors ? depthFactors(0, footing.Df, B) : { dc: 1, dq: 1, dg: 1, Nphi: 1 };
    const inc = inclinationFactors(alpha, 0);
    const cohesion = cu * f.Nc * sh.sc * d.dc * inc.ic;
    steps.push(
      step({ title: 'Undrained analysis (φu = 0)', equation: 'Nc = 5.14, Nq = 1, Nγ = 0', substituted: `cu = ${n(cu, 2)} kPa`, value: f.Nc, unit: '', source: `${SRC} cl. 5.2 (cohesive soils) — TO VERIFY` }),
      step({ title: 'Net ultimate qnu', equation: 'qnu = cu·Nc·sc·dc·ic', substituted: `qnu = ${n(cu, 2)} × 5.14 × ${n(sh.sc)} × ${n(d.dc)} × ${n(inc.ic)}`, value: cohesion, unit: 'kPa', source: `${SRC} cl. 5.2 — TO VERIFY` }),
    );
    return { analysis, B, L, Beff, Leff, eB, eL, areaEff, c: cu, phi: 0, q, gamma, Wp, factors: f, shape: sh, depth: { dc: d.dc, dq: d.dq, dg: d.dg }, incl: inc, terms: { cohesion, surcharge: 0, selfWeight: 0 }, qnu: cohesion, steps, notes };
  }

  const f = factorsOverride ?? bearingFactors(phi);
  const d = useDepthFactors ? depthFactors(phi, footing.Df, B) : { dc: 1, dq: 1, dg: 1, Nphi: 1 };
  if (!useDepthFactors) notes.push('Depth factors set to 1 (backfill not assumed properly compacted).');
  const inc = inclinationFactors(alpha, phi);
  const Bterm = Number.isFinite(Beff) ? Beff : B;
  const cohesion = c * f.Nc * sh.sc * d.dc * inc.ic;
  const surcharge = q * (f.Nq - 1) * sh.sq * d.dq * inc.iq;
  const selfWeight = 0.5 * Bterm * gamma * f.Ng * sh.sg * d.dg * inc.ig * Wp;
  const qnu = cohesion + surcharge + selfWeight;
  const tag = label === 'local' ? ' (local shear, reduced c, φ)' : '';
  steps.push(
    step({ title: `Strength used${tag}`, equation: label === 'local' ? "c_m = ⅔c, φ_m = arctan(⅔ tanφ)" : 'c′, φ′ of founding layer', substituted: `c = ${n(c, 2)} kPa, φ = ${n(phi, 2)}°`, value: phi, unit: '°', source: `${SRC} cl. 5.1.2 — TO VERIFY` }),
    step({ title: 'Nq', equation: 'Nq = e^(π tanφ) · tan²(45° + φ/2)', substituted: `Nq = e^(π·tan ${n(phi, 2)}°) · tan²(${n(45 + phi / 2, 2)}°)`, value: f.Nq, unit: '', source: `${SRC} Table 1` }),
    step({ title: 'Nc', equation: 'Nc = (Nq − 1) cotφ', substituted: `Nc = (${n(f.Nq)} − 1) / tan ${n(phi, 2)}°`, value: f.Nc, unit: '', source: `${SRC} Table 1` }),
    step({ title: 'Nγ', equation: 'Nγ = 2 (Nq + 1) tanφ', substituted: `Nγ = 2 × (${n(f.Nq)} + 1) × tan ${n(phi, 2)}°`, value: f.Ng, unit: '', source: `${SRC} Table 1 (Vesic)` }),
    step({ title: 'Shape factors', equation: shapeKind === 'rectangle' ? 'sc = sq = 1 + 0.2B/L, sγ = 1 − 0.4B/L' : `${shapeKind}: table values`, substituted: `sc = ${n(sh.sc)}, sq = ${n(sh.sq)}, sγ = ${n(sh.sg)}`, value: sh.sc, unit: '', source: `${SRC} Table 2` }),
    step({ title: 'Depth factors', equation: 'dc = 1 + 0.2(Df/B)√Nφ; dq = dγ = 1 + 0.1(Df/B)√Nφ (φ ≥ 10°)', substituted: `Df/B = ${n(footing.Df / B)}; dc = ${n(d.dc)}, dq = dγ = ${n(d.dq)}`, value: d.dc, unit: '', source: `${SRC} cl. 5.1.2.2 — TO VERIFY` }),
    step({ title: 'Inclination factors', equation: 'ic = iq = (1 − α/90)², iγ = (1 − α/φ)²', substituted: `α = ${n(alpha, 1)}°`, value: inc.ic, unit: '', source: `${SRC} cl. 5.1.2.3 — TO VERIFY` }),
    step({ title: "Effective overburden q at Df", equation: "q = σ′v(Df)", substituted: `Df = ${n(footing.Df, 2)} m, WT at ${n(zw, 2)} m`, value: q, unit: 'kPa', source: 'effective stress' }),
    step({ title: "Water-table factor W′", equation: "W′ = 0.5 + 0.5 (zw − Df)/B, 0.5 ≤ W′ ≤ 1", substituted: `zw = ${n(zw, 2)}, Df = ${n(footing.Df, 2)}, B = ${n(B, 2)}`, value: Wp, unit: '', source: `${SRC} cl. 5.1.2.4 — TO VERIFY` }),
    step({ title: 'Cohesion term', equation: 'c·Nc·sc·dc·ic', substituted: `${n(c, 2)} × ${n(f.Nc)} × ${n(sh.sc)} × ${n(d.dc)} × ${n(inc.ic)}`, value: cohesion, unit: 'kPa', source: `${SRC} cl. 5.1.2` }),
    step({ title: 'Surcharge term', equation: 'q·(Nq − 1)·sq·dq·iq', substituted: `${n(q, 2)} × (${n(f.Nq)} − 1) × ${n(sh.sq)} × ${n(d.dq)} × ${n(inc.iq)}`, value: surcharge, unit: 'kPa', source: `${SRC} cl. 5.1.2` }),
    step({ title: 'Self-weight term', equation: "½·B′·γ·Nγ·sγ·dγ·iγ·W′", substituted: `0.5 × ${n(Bterm, 3)} × ${n(gamma, 2)} × ${n(f.Ng)} × ${n(sh.sg)} × ${n(d.dg)} × ${n(inc.ig)} × ${n(Wp)}`, value: selfWeight, unit: 'kPa', source: `${SRC} cl. 5.1.2` }),
    step({ title: `Net ultimate qnu${tag}`, equation: 'qnu = sum of three terms', substituted: `${n(cohesion, 2)} + ${n(surcharge, 2)} + ${n(selfWeight, 2)}`, value: qnu, unit: 'kPa', source: `${SRC} cl. 5.1.2` }),
  );
  return { analysis, B, L, Beff, Leff, eB, eL, areaEff, c, phi, q, gamma, Wp, factors: f, shape: sh, depth: { dc: d.dc, dq: d.dq, dg: d.dg }, incl: inc, terms: { cohesion, surcharge, selfWeight }, qnu, steps, notes };
}

/**
 * Full IS 6403 bearing capacity with general / local / auto shear mode.
 * Auto: general shear for φ ≥ 36°, local for φ ≤ 29°, linear interpolation of qnu between.
 * SOURCE: IS 6403:1981 cl. 5.1.2 (mode of failure) — interpolation band TO VERIFY.
 */
export function bearingCapacity(inputArg: BearingInput): BearingResult {
  let input = inputArg;
  const FS = input.FS ?? 3;
  const base = layerAt(input.layers, input.footing.Df + 1e-6);
  let c = input.c ?? base.c ?? 0;
  let phi = input.phi ?? base.phi ?? 0;
  const zoneSteps: Step[] = [];
  if (input.strength === 'zone-average' && input.c === undefined && input.phi === undefined) {
    // Thickness-weighted average over Df → Df + B. SOURCE: common practice (influence depth ≈ B below base); team v1 engine — TO VERIFY.
    const z0 = input.footing.Df, z1 = input.footing.Df + input.footing.B;
    let H = 0, sc = 0, sp = 0, sg = 0;
    for (const l of input.layers) {
      const t = Math.min(l.bottom, z1) - Math.max(l.top, z0);
      if (t <= 0) continue;
      H += t; sc += t * (l.c ?? 0); sp += t * (l.phi ?? 0); sg += t * (l.gammaMoist ?? l.gammaSat);
    }
    if (H > 0) {
      c = sc / H; phi = sp / H;
      input = { ...input, gamma: input.gamma ?? sg / H };
      zoneSteps.push(step({ title: 'Shear-zone average strength', equation: 'x̄ = Σ xi·ti / Σ ti over Df → Df + B', substituted: `zone ${n(z0, 2)}–${n(z1, 2)} m: c = ${n(c, 3)} kPa, φ = ${n(phi, 3)}°, γ = ${n(sg / H, 3)} kN/m³`, value: phi, unit: '°', source: 'influence depth ≈ B; team v1 engine — TO VERIFY' }));
    }
  }
  const mode = input.mode ?? 'auto';
  const isUndrained = (input.analysis ?? (base.behaviour === 'cohesive' ? 'undrained' : 'drained')) === 'undrained';
  let r: ReturnType<typeof single>;
  let modeUsed: BearingResult['modeUsed'];
  if (isUndrained || mode === 'general' || (mode === 'auto' && phi >= 36)) { r = single(input, phi, c, 'general'); modeUsed = 'general'; }
  else if (mode === 'local' || (mode === 'auto' && phi <= 29)) { const m = localShear(c, phi); r = single(input, m.phi, m.c, 'local'); modeUsed = 'local'; }
  else if (input.transition === 'factors') {
    // t = (φ − 29)/(36 − 29); N = N_local + t(N_general − N_local); φ_m, c_m interpolated likewise (φ_m used for Nφ in depth factors).
    // SOURCE: IS 6403:1981 cl. 5.1.2 transition — TO VERIFY; method of the team's v1 engine (Gaurav Dtyal).
    const t = (phi - 29) / (36 - 29);
    const loc = localShear(c, phi);
    const fl = bearingFactors(loc.phi), fg = bearingFactors(phi);
    const fi: BearingFactors = { Nc: fl.Nc + t * (fg.Nc - fl.Nc), Nq: fl.Nq + t * (fg.Nq - fl.Nq), Ng: fl.Ng + t * (fg.Ng - fl.Ng) };
    const phiM = loc.phi + t * (phi - loc.phi), cM = loc.c + t * (c - loc.c);
    r = single(input, phiM, cM, 'general', fi);
    r = { ...r, steps: [step({ title: 'Transition: interpolated factors (29° < φ < 36°)', equation: 'N = N_local + t(N_general − N_local), t = (φ − 29)/7; c_m, φ_m likewise', substituted: `t = ${n(t, 4)}: Nc ${n(fl.Nc, 2)}→${n(fi.Nc, 2)}, Nq ${n(fl.Nq, 2)}→${n(fi.Nq, 2)}, Nγ ${n(fl.Ng, 2)}→${n(fi.Ng, 2)}; φ_m = ${n(phiM, 3)}°`, value: fi.Nq, unit: '', source: `${SRC} cl. 5.1.2 — interpolation TO VERIFY` }), ...r.steps] };
    modeUsed = 'interpolated';
  }
  else {
    const g = single(input, phi, c, 'general');
    const m = localShear(c, phi);
    const l = single(input, m.phi, m.c, 'local');
    const t = (phi - 29) / (36 - 29);
    const qnu = l.qnu + t * (g.qnu - l.qnu);
    r = { ...g, qnu, steps: [...l.steps, ...g.steps, step({ title: 'Interpolated qnu (29° < φ < 36°)', equation: 'qnu = qnu,local + (φ − 29)/(36 − 29)·(qnu,general − qnu,local)', substituted: `${n(l.qnu, 2)} + ${n(t)} × (${n(g.qnu, 2)} − ${n(l.qnu, 2)})`, value: qnu, unit: 'kPa', source: `${SRC} cl. 5.1.2 — interpolation TO VERIFY` })] };
    modeUsed = 'interpolated';
  }
  const qns = r.qnu / FS;
  const steps = [...r.steps,
    step({ title: 'Net safe bearing capacity', equation: 'qns = qnu / FS', substituted: `qns = ${n(r.qnu, 2)} / ${n(FS, 2)}`, value: qns, unit: 'kPa', source: `${SRC} (FS = 3.0 per assignment)` }),
    step({ title: 'Gross safe bearing capacity', equation: 'qs = qns + q', substituted: `qs = ${n(qns, 2)} + ${n(r.q, 2)}`, value: qns + r.q, unit: 'kPa', source: 'net vs gross: q = effective overburden at Df' }),
  ];
  return { ...r, modeUsed, FS, qns, qsGross: qns + r.q, steps: [...zoneSteps, ...steps] };
}
