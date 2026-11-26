/**
 * P2 — SPT corrections to IS 2131:1981.
 * Order (IS 2131): first the overburden correction, then — for very fine or silty sand below the
 * water table — the dilatancy correction applied to the overburden-corrected value.
 */
import { effectiveStress, layerAt } from './stress';
import { step, n, type Step } from './trace';
import type { SoilLayer, SptRecord } from './types';

export interface SptCorrected {
  depth: number;
  N: number;
  sigmaVEff: number;
  CN: number;
  /** Overburden-corrected N′ = CN·N. */
  N1: number;
  dilatancyApplied: boolean;
  /** Final corrected value after dilatancy (equal to N1 when dilatancy does not apply). */
  Ncorr: number;
  refusal: boolean;
  steps: Step[];
}

/**
 * Lower limit of σ′v used in the CN expression, kPa. The Peck, Hanson & Thornburn (1974) relation is only valid for
 * σ′v ≥ 0.25 t/ft² ≈ 24 kPa, so shallower tests use 25 kPa (CN ≤ 1.465).
 * Adopted from the team's v1 engine (platform-v1/js/moduleP2_logic.js, Parash Sharma) after the cross-check.
 * SOURCE: Peck, Hanson & Thornburn (1974) chart range; IS 2131:1981 Fig. 1 — TO VERIFY.
 */
export const SIGMA_MIN = 25;

/** Upper bound on CN. SOURCE: TO VERIFY — common practice caps CN at 2.0 at shallow depth (Peck et al. 1974 chart range). */
export const CN_MAX = 2.0;

/**
 * Overburden correction factor.
 * CN = 0.77 · log10(2000 / σ′v), σ′v in kPa (kN/m²).
 * SOURCE: IS 2131:1981 Fig. 1 (overburden correction chart, after Peck, Hanson & Thornburn 1974) — clause/figure number TO VERIFY.
 */
export function overburdenFactor(sigmaVEff: number, minSigma = SIGMA_MIN): number {
  const s = Math.max(sigmaVEff, minSigma);
  if (s <= 0) return CN_MAX;
  return Math.min(CN_MAX, 0.77 * Math.log10(2000 / s));
}

/**
 * Dilatancy correction for very fine or silty sand below the WT, when N′ > 15:
 * N″ = 15 + ½ (N′ − 15).
 * SOURCE: IS 2131:1981 (dilatancy correction, after Terzaghi & Peck 1948) — clause number TO VERIFY.
 */
export const dilatancyCorrection = (N1: number): number => (N1 > 15 ? 15 + 0.5 * (N1 - 15) : N1);

export function correctSpt(
  records: SptRecord[],
  layers: SoilLayer[],
  zw: number,
): SptCorrected[] {
  return records.map((r) => {
    const layer = layerAt(layers, r.depth);
    const sv = effectiveStress(layers, r.depth, zw);
    const refusal = !!r.refusal || r.N >= 100;
    // IS 2131 corrections apply to cohesionless soils only; clay N values are left as measured (CN = 1).
    // Error found by cross-checking against the team's v1 engine (Parash Sharma) — see docs/AI_AUDIT.md.
    const cohesionless = layer.behaviour === 'granular' || layer.behaviour === 'fill';
    const CN = cohesionless ? overburdenFactor(sv) : 1;
    const N1 = CN * r.N;
    const dil = !refusal && cohesionless && !!layer.dilatancy && r.depth > zw && N1 > 15;
    const Ncorr = dil ? dilatancyCorrection(N1) : N1;
    const src = 'IS 2131:1981 (overburden correction chart) — TO VERIFY fig. no.';
    const steps = [
      step({ title: `σ′v at ${n(r.depth, 2)} m`, equation: 'σ′v = σv − u', substituted: `WT at ${n(zw, 2)} m`, value: sv, unit: 'kPa', source: 'Terzaghi effective stress' }),
      cohesionless ? null : step({ title: 'No overburden correction (cohesive soil)', equation: 'CN = 1', substituted: `${layer.symbol} is cohesive`, value: 1, unit: '', source: 'IS 2131:1981 — corrections apply to cohesionless soils' }),
      step({ title: 'Overburden factor CN', equation: 'CN = 0.77 · log10(2000 / max(σ′v, 25 kPa)) ≤ 2.0', substituted: `CN = 0.77 · log10(2000 / ${n(Math.max(sv, SIGMA_MIN), 2)})${sv < SIGMA_MIN ? ' (σ′v < 25 kPa → 25 kPa)' : ''}`, value: CN, unit: '', source: src }),
      step({ title: 'Overburden-corrected N′', equation: "N′ = CN · N", substituted: `N′ = ${n(CN)} × ${r.N}`, value: N1, unit: 'blows/300 mm', source: src }),
    ];
    const stepsClean: Step[] = steps.filter((x): x is Step => x !== null);
    if (!cohesionless) stepsClean.splice(stepsClean.findIndex((x) => x.title === 'Overburden factor CN'), 1);
    if (dil) stepsClean.push(step({ title: 'Dilatancy correction N″', equation: "N″ = 15 + ½(N′ − 15)", substituted: `N″ = 15 + 0.5 × (${n(N1, 2)} − 15)`, value: Ncorr, unit: 'blows/300 mm', source: 'IS 2131:1981 dilatancy correction — TO VERIFY clause' }));
    if (refusal) stepsClean.push(step({ title: 'Refusal', equation: 'N ≥ 100 (50 blows before 300 mm)', substituted: 'not corrected', value: r.N, unit: 'blows', source: 'IS 2131:1981', note: 'Refusal — reported as >100, not used in correlations.' }));
    return { depth: r.depth, N: r.N, sigmaVEff: sv, CN, N1, dilatancyApplied: dil, Ncorr, refusal, steps: stepsClean };
  });
}
