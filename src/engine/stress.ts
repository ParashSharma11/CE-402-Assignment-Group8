/**
 * P1 — In-situ vertical stresses for a layered profile.
 * Total stress σv = Σ γi·hi (moist γ above the WT, saturated γ below);
 * pore pressure u = γw·(z − zw) below the WT (hydrostatic); effective stress σ′v = σv − u.
 * SOURCE: Terzaghi's effective-stress principle; Das, Principles of Geotechnical Engineering (2014) §9.2–9.3.
 */
import { GAMMA_W } from './units';
import type { SoilLayer } from './types';

export interface StressPoint {
  z: number;
  sigmaV: number;
  u: number;
  sigmaVEff: number;
}

/** Validate that layers are contiguous, start at 0 and are sorted. Returns a list of problems (empty = OK). */
export function validateLayers(layers: SoilLayer[]): string[] {
  const errs: string[] = [];
  if (layers.length === 0) return ['Profile has no layers.'];
  const sorted = [...layers].sort((a, b) => a.top - b.top);
  if (Math.abs(sorted[0].top) > 1e-9) errs.push('First layer must start at 0 m.');
  sorted.forEach((l, i) => {
    if (!(l.bottom > l.top)) errs.push(`Layer ${l.symbol} (${l.top}–${l.bottom} m): bottom must be below top.`);
    if (!(l.gammaSat > 0)) errs.push(`Layer ${l.symbol}: saturated unit weight must be > 0 kN/m³.`);
    if (i > 0 && Math.abs(sorted[i - 1].bottom - l.top) > 1e-6)
      errs.push(`Gap or overlap between ${sorted[i - 1].symbol} and ${l.symbol} at ${l.top} m.`);
  });
  return errs;
}

/** The layer containing depth z (the deeper layer at a boundary; the last layer below the profile). */
export function layerAt(layers: SoilLayer[], z: number): SoilLayer {
  const sorted = [...layers].sort((a, b) => a.top - b.top);
  for (const l of sorted) if (z >= l.top && z < l.bottom) return l;
  return z < 0 ? sorted[0] : sorted[sorted.length - 1];
}

/** Unit weight used for a slice of soil that lies above (moist) or below (saturated) the WT. */
const gammaFor = (l: SoilLayer, belowWT: boolean): number =>
  belowWT ? l.gammaSat : (l.gammaMoist ?? l.gammaSat);

/**
 * Total vertical stress at depth z (kPa). Integrates layer by layer, splitting a layer at the WT.
 * SOURCE: Das (2014) Eq. 9.3 — σ = Σ γi Hi.
 */
export function totalStress(layers: SoilLayer[], z: number, zw: number): number {
  const sorted = [...layers].sort((a, b) => a.top - b.top);
  let s = 0;
  for (const l of sorted) {
    if (l.top >= z) break;
    const bot = Math.min(l.bottom, z);
    // part above the WT
    const aTop = l.top, aBot = Math.min(bot, zw);
    if (aBot > aTop) s += gammaFor(l, false) * (aBot - aTop);
    // part below the WT
    const bTop = Math.max(l.top, zw), bBot = bot;
    if (bBot > bTop) s += gammaFor(l, true) * (bBot - bTop);
  }
  // extrapolate below the last layer with its own unit weight
  const last = sorted[sorted.length - 1];
  if (z > last.bottom) {
    const top = last.bottom;
    const aBot = Math.min(z, Math.max(zw, top));
    if (aBot > top) s += gammaFor(last, false) * (aBot - top);
    const bTop = Math.max(top, zw);
    if (z > bTop) s += gammaFor(last, true) * (z - bTop);
  }
  return s;
}

/** Hydrostatic pore pressure (kPa). SOURCE: Das (2014) Eq. 9.4 — u = γw·hw. */
export const porePressure = (z: number, zw: number): number => (z > zw ? GAMMA_W * (z - zw) : 0);

/** Effective vertical stress (kPa). SOURCE: Terzaghi (1925); Das (2014) Eq. 9.5 — σ′ = σ − u. */
export const effectiveStress = (layers: SoilLayer[], z: number, zw: number): number =>
  totalStress(layers, z, zw) - porePressure(z, zw);

/** σv, u, σ′v at every layer boundary, at the WT and at a regular spacing — for plotting. */
export function stressProfile(layers: SoilLayer[], zw: number, zMax?: number, dz = 0.25): StressPoint[] {
  const sorted = [...layers].sort((a, b) => a.top - b.top);
  const bottom = zMax ?? sorted[sorted.length - 1].bottom;
  const zs = new Set<number>([0, bottom]);
  for (let z = 0; z <= bottom + 1e-9; z += dz) zs.add(+z.toFixed(6));
  sorted.forEach((l) => { if (l.bottom <= bottom) zs.add(l.bottom); });
  if (zw > 0 && zw < bottom) zs.add(zw);
  return [...zs].sort((a, b) => a - b).map((z) => {
    const sigmaV = totalStress(layers, z, zw);
    const u = porePressure(z, zw);
    return { z, sigmaV, u, sigmaVEff: sigmaV - u };
  });
}
