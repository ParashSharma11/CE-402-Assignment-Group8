/**
 * Bridge to the team's v1 calculation engines (platform-v1/js, unchanged):
 *   P1 profile validation  — Parash Sharma      (ModuleP1Logic)
 *   P2 SPT + direct shear  — Parash Sharma      (ModuleP2Logic)
 *   P3 IS 6403 bearing     — Gaurav Dtyal       (ModuleP3Logic)
 *   P4 stress increase     — Namit Mehta        (ModuleP4StressLogic)
 *   P5 settlement / U(Tv)  — Muvan              (ModuleP4Logic)
 * GeoFound v2 UI/UX, front-end, integration and deployment — Harshit Pandey.
 * GeoFound (v2) runs these on the same inputs as its own TypeScript engine and shows both,
 * so every number is cross-checked by two independent implementations.
 */
import './windowShim';
import '../../platform-v1/js/moduleP1_logic.js';
import '../../platform-v1/js/moduleP2_logic.js';
import '../../platform-v1/js/moduleP3_logic.js';
import '../../platform-v1/js/moduleP4_logic.js';
import '../../platform-v1/js/moduleP4_stress_logic.js';
import { effectiveStress, layerAt, type Borehole, type Footing, type Load } from '../engine';

/* eslint-disable @typescript-eslint/no-explicit-any */
const W = (globalThis as any).window ?? globalThis;
const P1 = () => W.ModuleP1Logic, P2 = () => W.ModuleP2Logic, P3 = () => W.ModuleP3Logic, P4 = () => W.ModuleP4Logic, P4S = () => W.ModuleP4StressLogic;

export const TEAM_CREDITS = {
  P1: 'Parash Sharma', P2: 'Parash Sharma', P3: 'Gaurav Dtyal', P4: 'Namit Mehta', P5: 'Muvan',
} as const;

/** m²/yr → mm²/s (v1 stores cv in mm²/s). */
const M2YR_TO_MM2S = 1e6 / 31_557_600;

const soilType = (sym: string, behaviour: string) =>
  behaviour === 'cohesive' ? 'Clay (CL/CH)' : /^G/i.test(sym) ? 'Gravel (GW/GP)' : /^M/i.test(sym) ? 'Silt (ML/MH)' : behaviour === 'rock' ? 'Rock / Bedrock' : 'Sand (SW/SP)';

/**
 * Converts a GeoFound borehole into v1 "processed layers". v1 requires all 14 numeric fields on every layer;
 * fields a soil type does not use get neutral placeholders (marked here) that the v1 engines ignore for that soil.
 */
export function toTeamLayers(bh: Borehole) {
  const raw = [...bh.layers].sort((a, b) => a.top - b.top).map((l) => {
    const mid = (l.top + l.bottom) / 2;
    const s0 = effectiveStress(bh.layers, mid, bh.designWT);
    return {
      soilType: soilType(l.symbol, l.behaviour),
      z_top: l.top, z_bot: l.bottom,
      gamma_moist: l.gammaMoist ?? l.gammaSat, gamma_sat: l.gammaSat,
      su: l.cu ?? 0, c_prime: l.c ?? 0, phi_prime: l.phi ?? 0,
      E_prime: l.E ?? 5000, // placeholder for clay (v1 settles clay by consolidation)
      nu_prime: 0.3,
      e0: l.e0 ?? 0.7, Cc: l.Cc ?? 0.01, Cr: l.Cr ?? 0.002, // placeholders for granular layers
      OCR: l.sigmaP && s0 > 0 ? Math.max(1, l.sigmaP / s0) : 1,
      cv: l.cv ? l.cv * M2YR_TO_MM2S : 1,
    };
  });
  const out = P1().validateAndProcessProfile(raw, 9.81);
  return { layers: out.processedLayers as any[], errors: out.errors as string[] };
}

export interface TeamBearing { qnu: number; qns: number; Nc: number; Nq: number; Ng: number; Wp: number; sc: number; sq: number; sg: number; dc: number; dq: number; errors: string[] }

/** Gaurav's IS 6403 engine on the same footing. Note: v1 averages c, φ, γ over the shear zone Df → Df + B′. */
export function teamBearing(footing: Footing, load: Load, bh: Borehole, FS = 3): TeamBearing | null {
  const { layers, errors } = toTeamLayers(bh);
  if (errors.length) return { qnu: NaN, qns: NaN, Nc: NaN, Nq: NaN, Ng: NaN, Wp: NaN, sc: NaN, sq: NaN, sg: NaN, dc: NaN, dq: NaN, errors };
  const base = layerAt(bh.layers, footing.Df + 1e-6);
  const shape = { strip: 'Strip', square: 'Square', rectangle: 'Rectangular', circle: 'Circular' }[footing.shape];
  const input = {
    shape, B_m: footing.B, L_m: footing.shape === 'rectangle' ? (footing.L ?? footing.B) : footing.B, Df_m: footing.Df,
    eB_m: load.P > 0 ? (load.MB ?? 0) / load.P : 0, eL_m: 0, alpha_deg: load.alpha ?? 0, FS,
    analysisType: base.behaviour === 'cohesive' ? 'Undrained' : 'Drained', shearMode: 'Auto (IS 6403)', waterTableMode: 'Design', useManualSoil: false,
  };
  const r = P3().computeBearingCapacity(input, layers, bh.measuredWT, bh.designWT, 9.81);
  if (!r.result) return { qnu: NaN, qns: NaN, Nc: NaN, Nq: NaN, Ng: NaN, Wp: NaN, sc: NaN, sq: NaN, sg: NaN, dc: NaN, dq: NaN, errors: r.errors };
  const f = r.result.factors, c = r.result.capacities;
  return { qnu: c.q_nu, qns: c.q_ns, Nc: f.Nc, Nq: f.Nq, Ng: f.Ngamma, Wp: f.W_prime, sc: f.sc, sq: f.sq, sg: f.sgamma, dc: f.dc, dq: f.dq, errors: [] };
}

/** Namit's Boussinesq / 2:1 module at one depth below the base. */
export function teamStress(q: number, B: number, L: number, Df: number, z: number) {
  const r = P4S().computeStressIncrease({ B_m: B, L_m: L, Df_m: Df, q0_kPa: q, maxDepthBelowBase_m: Math.max(2 * z, 1), queryDepthBelowBase_m: z });
  if (r.errors?.length) return null;
  return { centre: r.query.deltaSigma_centre as number, corner: r.query.deltaSigma_corner as number, twoToOne: r.query.deltaSigma_2to1 as number };
}

/** Parash's IS 2131 SPT corrections. */
export function teamSpt(bh: Borehole, zw: number) {
  const { layers, errors } = toTeamLayers(bh);
  if (errors.length) return [];
  const recs = bh.spt.filter((s) => !(s.refusal || s.N >= 100)).map((s) => {
    const l = layerAt(bh.layers, s.depth);
    const cat = l.behaviour === 'cohesive' ? 'Cohesive Soil (Clay)' : l.dilatancy ? 'Fine Sand / Silt (Dilatancy Applicable)' : 'Coarse Sand / Gravel (No Dilatancy)';
    return { depth_m: s.depth, N_measured: s.N, soilCategory: cat, sigma_v_override: null };
  });
  const r = P2().processSptRecords(recs, layers, zw, 9.81);
  return (r.sptProcessed as any[]).map((p) => ({ depth: p.depth_m as number, CN: p.CN as number, N1: p.N_prime as number, N2: p.N_double_prime as number }));
}

/** Parash's direct-shear OLS fit. */
export function teamShear(sigma: number[], tau: number[]) {
  const r = P2().fitDirectShear(sigma.map((s, i) => ({ sigma_n: s, tau_f: tau[i] })));
  return r.directShearFit ? { phi: r.directShearFit.phi_prime_raw as number, c: r.directShearFit.c_prime_raw as number, r2: r.directShearFit.R2 as number } : null;
}

/** Muvan's Terzaghi U(Tv). */
export const teamU = (Tv: number): number => P4().computeDegreeOfConsolidation(Tv);
