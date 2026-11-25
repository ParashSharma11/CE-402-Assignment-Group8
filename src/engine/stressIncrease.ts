/**
 * P4 — Vertical stress increase below a uniformly loaded rectangle.
 */
import { step, n, type Step } from './trace';

/**
 * Influence factor under the CORNER of a uniformly loaded rectangle B × L at depth z (Boussinesq, integrated by Newmark).
 * m = B/z, n = L/z,
 * I = 1/(4π) · [ 2mn√(m²+n²+1)/(m²+n²+m²n²+1) · (m²+n²+2)/(m²+n²+1) + atan( 2mn√(m²+n²+1) / (m²+n²+1−m²n²) ) ]
 * with π added to the atan term when its denominator is negative.
 * SOURCE: Newmark (1935); Das, Principles of Foundation Engineering (2016) Eq. 5.20–5.21.
 */
export function cornerInfluence(B: number, L: number, z: number): number {
  if (z <= 0) return 0.25; // at the surface under a corner, Δσ = q/4
  const m = B / z, k = L / z;
  const m2 = m * m, k2 = k * k, s = Math.sqrt(m2 + k2 + 1);
  const t1 = ((2 * m * k * s) / (m2 + k2 + m2 * k2 + 1)) * ((m2 + k2 + 2) / (m2 + k2 + 1));
  const den = m2 + k2 + 1 - m2 * k2;
  let t2 = Math.atan((2 * m * k * s) / den);
  if (den < 0) t2 += Math.PI;
  return (t1 + t2) / (4 * Math.PI);
}

/** Δσz under the corner, kPa. */
export const deltaSigmaCorner = (q: number, B: number, L: number, z: number): number => q * cornerInfluence(B, L, z);

/**
 * Δσz under the CENTRE by superposition of four rectangles (B/2 × L/2) sharing the centre as a corner.
 * SOURCE: principle of superposition; Das (2016) §5.6.
 */
export const deltaSigmaCentre = (q: number, B: number, L: number, z: number): number =>
  z <= 0 ? q : 4 * q * cornerInfluence(B / 2, L / 2, z);

/**
 * Δσz under any point (x, y) measured from the rectangle's corner, by superposition of four signed rectangles.
 * Works for points inside or outside the loaded area. SOURCE: Das (2016) §5.6, superposition.
 */
export function deltaSigmaAt(q: number, B: number, L: number, x: number, y: number, z: number): number {
  const f = (a: number, b: number) => Math.sign(a) * Math.sign(b) * cornerInfluence(Math.abs(a), Math.abs(b), z);
  // rectangle spans x ∈ [0, B], y ∈ [0, L]; point (x, y)
  const I = f(B - x, L - y) + f(x, L - y) + f(B - x, y) + f(x, y);
  return q * I;
}

/**
 * 2:1 (approximate) method: Δσz = q·B·L / ((B + z)(L + z)); strip: q·B/(B + z).
 * SOURCE: Das (2016) Eq. 5.36; IS 8009 (Part 1):1976 approximate load spread — TO VERIFY clause.
 */
export const deltaSigma21 = (q: number, B: number, L: number, z: number): number =>
  Number.isFinite(L) ? (q * B * L) / ((B + z) * (L + z)) : (q * B) / (B + z);

export interface DeltaSigmaPoint { z: number; centre: number; corner: number; twoToOne: number }

/** Δσz vs depth below the founding level for plotting (z measured from the footing base). */
export function deltaSigmaProfile(q: number, B: number, L: number, zMax: number, dz = 0.25): DeltaSigmaPoint[] {
  const out: DeltaSigmaPoint[] = [];
  for (let z = 0; z <= zMax + 1e-9; z += dz) {
    out.push({ z: +z.toFixed(6), centre: deltaSigmaCentre(q, B, L, z), corner: deltaSigmaCorner(q, B, L, z), twoToOne: deltaSigma21(q, B, L, z) });
  }
  return out;
}

/** Step trace for a single depth (used by the Calculations screen). */
export function deltaSigmaSteps(q: number, B: number, L: number, z: number): Step[] {
  const Ic = cornerInfluence(B / 2, L / 2, z);
  const Ik = cornerInfluence(B, L, z);
  return [
    step({ title: 'Corner influence factor (B/2 × L/2)', equation: 'I = f(m, n), m = (B/2)/z, n = (L/2)/z', substituted: `m = ${n(B / 2 / z)}, n = ${n(L / 2 / z)}`, value: Ic, unit: '', source: 'Newmark (1935); Das (2016) Eq. 5.20' }),
    step({ title: 'Δσz under centre', equation: 'Δσz = 4·q·I', substituted: `4 × ${n(q, 2)} × ${n(Ic, 4)}`, value: 4 * q * Ic, unit: 'kPa', source: 'superposition; Das (2016) §5.6' }),
    step({ title: 'Δσz under corner', equation: 'Δσz = q·I(B, L, z)', substituted: `${n(q, 2)} × ${n(Ik, 4)}`, value: q * Ik, unit: 'kPa', source: 'Newmark (1935)' }),
    step({ title: 'Δσz by 2:1 method', equation: 'Δσz = qBL / ((B+z)(L+z))', substituted: `${n(q, 2)} × ${n(B, 2)} × ${n(L, 2)} / ((${n(B, 2)} + ${n(z, 2)})(${n(L, 2)} + ${n(z, 2)}))`, value: deltaSigma21(q, B, L, z), unit: 'kPa', source: 'Das (2016) Eq. 5.36' }),
  ];
}
