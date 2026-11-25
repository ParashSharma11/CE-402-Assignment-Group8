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

/** Upper bound on CN. SOURCE: TO VERIFY — common practice caps CN at 2.0 at shallow depth (Peck et al. 1974 chart range). */
export const CN_MAX = 2.0;

/**
 * Overburden correction factor.
 * CN = 0.77 · log10(2000 / σ′v), σ′v in kPa (kN/m²).
 * SOURCE: IS 2131:1981 Fig. 1 (overburden correction chart, after Peck, Hanson & Thornburn 1974) — clause/figure number TO VERIFY.
 */
export function overburdenFactor(sigmaVEff: number): number {
  if (sigmaVEff <= 0) return CN_MAX;
  return Math.min(CN_MAX, 0.77 * Math.log10(2000 / sigmaVEff));
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
    const CN = overburdenFactor(sv);
    const N1 = CN * r.N;
    const dil = !refusal && !!layer.dilatancy && r.depth > zw && N1 > 15;
    const Ncorr = dil ? dilatancyCorrection(N1) : N1;
    const src = 'IS 2131:1981 (overburden correction chart) — TO VERIFY fig. no.';
    const steps: Step[] = [
      step({ title: `σ′v at ${n(r.depth, 2)} m`, equation: 'σ′v = σv − u', substituted: `WT at ${n(zw, 2)} m`, value: sv, unit: 'kPa', source: 'Terzaghi effective stress' }),
      step({ title: 'Overburden factor CN', equation: 'CN = 0.77 · log10(2000 / σ′v) ≤ 2.0', substituted: `CN = 0.77 · log10(2000 / ${n(sv, 2)})`, value: CN, unit: '', source: src }),
      step({ title: 'Overburden-corrected N′', equation: "N′ = CN · N", substituted: `N′ = ${n(CN)} × ${r.N}`, value: N1, unit: 'blows/300 mm', source: src }),
    ];
    if (dil) steps.push(step({ title: 'Dilatancy correction N″', equation: "N″ = 15 + ½(N′ − 15)", substituted: `N″ = 15 + 0.5 × (${n(N1, 2)} − 15)`, value: Ncorr, unit: 'blows/300 mm', source: 'IS 2131:1981 dilatancy correction — TO VERIFY clause' }));
    if (refusal) steps.push(step({ title: 'Refusal', equation: 'N ≥ 100 (50 blows before 300 mm)', substituted: 'not corrected', value: r.N, unit: 'blows', source: 'IS 2131:1981', note: 'Refusal — reported as >100, not used in correlations.' }));
    return { depth: r.depth, N: r.N, sigmaVEff: sv, CN, N1, dilatancyApplied: dil, Ncorr, refusal, steps };
  });
}
