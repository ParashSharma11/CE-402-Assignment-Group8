/**
 * P2 — Laboratory test interpretation. Oedometer and UU: Harshit Pandey; direct shear cross-checked with Parash Sharma's v1 engine.
 */
import { kgcm2ToKPa } from './units';
import { rad2deg } from './units';
import { step, n, type Step } from './trace';

/* ---------------- Direct shear: least-squares Mohr–Coulomb fit ---------------- */

export interface ShearFit {
  c: number; // kPa
  phi: number; // degrees
  r2: number;
  steps: Step[];
}

/**
 * Fit τf = c′ + σn·tanφ′ by ordinary least squares on (σn, τf) pairs.
 * slope = Σ(σ−σ̄)(τ−τ̄) / Σ(σ−σ̄)², intercept = τ̄ − slope·σ̄.
 * SOURCE: Mohr–Coulomb criterion (Das 2014 Eq. 12.3); OLS normal equations (any statistics text).
 */
export function fitDirectShear(sigma: number[], tau: number[]): ShearFit {
  if (sigma.length !== tau.length || sigma.length < 2) throw new Error('Need at least two (σn, τf) pairs of equal length.');
  const k = sigma.length;
  const sx = sigma.reduce((a, b) => a + b, 0) / k;
  const sy = tau.reduce((a, b) => a + b, 0) / k;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < k; i++) { sxy += (sigma[i] - sx) * (tau[i] - sy); sxx += (sigma[i] - sx) ** 2; syy += (tau[i] - sy) ** 2; }
  if (sxx === 0) throw new Error('Normal stresses must differ.');
  const slope = sxy / sxx;
  const c = sy - slope * sx;
  const phi = rad2deg(Math.atan(slope));
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  const src = 'Mohr–Coulomb; least squares (OLS)';
  return {
    c, phi, r2,
    steps: [
      step({ title: 'Slope tanφ′', equation: 'tanφ′ = Σ(σ−σ̄)(τ−τ̄) / Σ(σ−σ̄)²', substituted: `tanφ′ = ${n(sxy, 2)} / ${n(sxx, 2)}`, value: slope, unit: '', source: src }),
      step({ title: 'Friction angle φ′', equation: 'φ′ = arctan(slope)', substituted: `φ′ = arctan(${n(slope, 4)})`, value: phi, unit: '°', source: src }),
      step({ title: 'Cohesion intercept c′', equation: 'c′ = τ̄ − tanφ′ · σ̄', substituted: `c′ = ${n(sy, 3)} − ${n(slope, 4)} × ${n(sx, 3)}`, value: c, unit: 'kPa', source: src }),
      step({ title: 'Goodness of fit R²', equation: 'R² = Sxy² / (Sxx·Syy)', substituted: '', value: r2, unit: '', source: src }),
    ],
  };
}

/* ---------------- UU triaxial: cu ---------------- */

/**
 * cu = (σ1 − σ3)f / 2, averaged over specimens (φu ≈ 0 for saturated clay in UU tests).
 * SOURCE: Das (2014) §12.10, Eq. 12.26.
 */
export function cuFromUU(deviatorAtFailure: number[]): { cu: number; each: number[]; steps: Step[] } {
  if (!deviatorAtFailure.length) throw new Error('No UU results.');
  const each = deviatorAtFailure.map((d) => d / 2);
  const cu = each.reduce((a, b) => a + b, 0) / each.length;
  return {
    cu, each,
    steps: [step({ title: 'Undrained strength cu', equation: 'cu = mean[(σ1 − σ3)f / 2]', substituted: `cu = mean(${deviatorAtFailure.map((d) => n(d, 1) + '/2').join(', ')})`, value: cu, unit: 'kPa', source: 'Das (2014) Eq. 12.26 (UU, φu = 0)' })],
  };
}

/* ---------------- Oedometer: Cc, Cr, σ′p ---------------- */

export interface OedometerPoint {
  /** Pressure as reported on the lab sheet. */
  p: number;
  e: number;
  stage: 'loading' | 'unloading';
}

export interface OedometerResult {
  /** Pressures converted to kPa. */
  points: { p: number; e: number; stage: 'loading' | 'unloading' }[];
  Cc: number;
  Cr: number;
  sigmaP: number; // kPa, Casagrande
  steps: Step[];
}

/** Least-squares slope of e vs log10(p). */
function slopeElogp(pts: { p: number; e: number }[]): number {
  const xs = pts.map((q) => Math.log10(q.p)), ys = pts.map((q) => q.e);
  const k = xs.length, mx = xs.reduce((a, b) => a + b, 0) / k, my = ys.reduce((a, b) => a + b, 0) / k;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < k; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxy / sxx;
}

/**
 * Interpret an oedometer test.
 * - Converts pressures from `unit` to kPa (kg/cm² × 98.0665).
 * - Cc = −Δe/Δlog10 σ′ over the last `virginPoints` loading points (virgin compression line).
 * - Cr = −Δe/Δlog10 σ′ over the unloading points.
 * - σ′p by Casagrande's construction on the e–log p loading curve (point of maximum curvature taken as the
 *   loading point with the largest change of slope; bisector of horizontal and tangent; intersection with VCL).
 * SOURCE: Casagrande (1936); Das (2014) §11.6 (Cc, Cs) and §11.5 (σ′c, Fig. 11.11).
 * NOTE: the Casagrande construction depends on plot scaling; the result is reported as an estimate the
 * engineer can override.
 */
export function interpretOedometer(raw: OedometerPoint[], unit: 'kPa' | 'kg/cm2' = 'kPa', virginPoints = 3): OedometerResult {
  const conv = unit === 'kg/cm2' ? kgcm2ToKPa : (x: number) => x;
  const points = raw.map((r) => ({ p: conv(r.p), e: r.e, stage: r.stage }));
  const load = points.filter((q) => q.stage === 'loading').sort((a, b) => a.p - b.p);
  const unload = points.filter((q) => q.stage === 'unloading');
  // include the last loading point as the start of the unloading branch
  const unloadBranch = unload.length ? [load[load.length - 1], ...unload] : [];
  if (load.length < 3) throw new Error('Need at least three loading points.');
  const vcl = load.slice(-Math.max(2, Math.min(virginPoints, load.length)));
  const Cc = -slopeElogp(vcl);
  const Cr = unloadBranch.length >= 2 ? -slopeElogp(unloadBranch) : NaN;

  // Casagrande
  const xs = load.map((q) => Math.log10(q.p)), es = load.map((q) => q.e);
  const seg = xs.slice(1).map((x, i) => (es[i + 1] - es[i]) / (x - xs[i])); // slopes (negative)
  let iMax = 1, dMax = -Infinity;
  for (let i = 1; i < load.length - 1; i++) {
    const d = seg[i - 1] - seg[i]; // increase in steepness
    if (d > dMax) { dMax = d; iMax = i; }
  }
  const x0 = xs[iMax], e0 = es[iMax];
  const tangent = (seg[iMax - 1] + seg[iMax]) / 2; // tangent slope at the max-curvature point
  const bis = Math.tan(Math.atan(tangent) / 2); // bisector between horizontal (0) and tangent
  // VCL through last point with slope −Cc
  const xL = xs[xs.length - 1], eL = es[es.length - 1];
  // e0 + bis(x − x0) = eL − Cc(x − xL)  →  x = (eL + Cc·xL − e0 + bis·x0) / (bis + Cc)
  const xp = (eL + Cc * xL - e0 + bis * x0) / (bis + Cc);
  const sigmaP = 10 ** xp;
  const src = 'Das (2014) §11.5–11.6; Casagrande (1936)';
  return {
    points, Cc, Cr, sigmaP,
    steps: [
      step({ title: 'Unit conversion', equation: 'p[kPa] = p[kg/cm²] × 98.0665', substituted: unit === 'kg/cm2' ? `e.g. ${raw[0].p} kg/cm² → ${n(points[0].p, 2)} kPa` : 'already kPa', value: unit === 'kg/cm2' ? 98.0665 : 1, unit: 'kPa per unit', source: 'definition of kgf' }),
      step({ title: 'Compression index Cc', equation: 'Cc = −Δe / Δlog10σ′ (virgin line)', substituted: `last ${vcl.length} loading points ${vcl.map((q) => n(q.p, 1)).join(', ')} kPa`, value: Cc, unit: '', source: src }),
      step({ title: 'Recompression index Cr', equation: 'Cr = −Δe / Δlog10σ′ (unloading)', substituted: `${unloadBranch.length} points`, value: Cr, unit: '', source: src }),
      step({ title: 'Preconsolidation σ′p (Casagrande)', equation: 'bisector ∩ virgin line', substituted: `max curvature at ${n(load[iMax].p, 1)} kPa`, value: sigmaP, unit: 'kPa', source: src, note: 'Graphical method; scale-dependent estimate — engineer may override.' }),
    ],
  };
}

/**
 * Cc from liquid limit when no oedometer test exists (e.g. BH-3): Cc = 0.009 (LL − 10).
 * SOURCE: Skempton (1944); Terzaghi & Peck (1967) — normally consolidated clays of low to medium sensitivity.
 */
export const ccFromLL = (LL: number): number => 0.009 * (LL - 10);

/** e0 from water content for a saturated soil: e0 = w·Gs. SOURCE: Das (2014) Eq. 3.21 (Se = wGs, S = 1). */
export const e0FromW = (w_percent: number, Gs: number): number => (w_percent / 100) * Gs;
