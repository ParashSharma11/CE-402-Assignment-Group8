import { describe, it, expect } from 'vitest';
import {
  KG_PER_CM2_TO_KPA, cm2sToM2yr, totalStress, effectiveStress, correctSpt, fitDirectShear, cuFromUU, interpretOedometer,
  bearingFactors, localShear, waterTableFactor, bearingCapacity, cornerInfluence, deltaSigmaCentre, deltaSigma21,
  sublayerSettlement, timeFactor, degreeOfConsolidation, schmertmann, adjacentPairs, loadFactor, validateLayers,
  type SoilLayer,
} from '../src/engine';
import { boreholes, lab } from '../src/examples/mandi';

const bh1 = boreholes.find((b) => b.id === 'BH-1')!;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('§1 unit conversions', () => {
  it('kg/cm² → kPa', () => expect(KG_PER_CM2_TO_KPA).toBeCloseTo(98.0665, 4));
  it('cm²/s → m²/yr', () => expect(cm2sToM2yr(6.3e-4)).toBeCloseTo(1.9881, 3));
  it('λ for group 8', () => expect(loadFactor(8)).toBeCloseTo(1.08, 10));
});

describe('§2 effective stress (P1)', () => {
  it('BH-1 σv and σ′v at 7.225 m, WT 2.6 m', () => {
    expect(totalStress(bh1.layers, 7.225, 2.6)).toBeCloseTo(137.365, 2);
    expect(effectiveStress(bh1.layers, 7.225, 2.6)).toBeCloseTo(91.994, 2);
  });
  it('profile validation catches a gap', () => {
    const bad: SoilLayer[] = [{ top: 0, bottom: 1, symbol: 'A', behaviour: 'granular', gammaSat: 20 }, { top: 1.2, bottom: 3, symbol: 'B', behaviour: 'granular', gammaSat: 20 }];
    expect(validateLayers(bad).length).toBeGreaterThan(0);
    expect(validateLayers(bh1.layers)).toEqual([]);
  });
});

describe('§3 SPT corrections IS 2131 (P2)', () => {
  const [r] = correctSpt([{ depth: 1.5, N: 13 }], bh1.layers, 1.0);
  it('σ′v at 1.5 m', () => expect(r.sigmaVEff).toBeCloseTo(22.195, 2));
  it('CN uses the 25 kPa floor (σ′v = 22.2 < 25)', () => expect(r.CN).toBeCloseTo(1.46538, 4));
  it('N′ overburden', () => expect(r.N1).toBeCloseTo(19.050, 2));
  it('N″ dilatancy applied (SM below WT)', () => { expect(r.dilatancyApplied).toBe(true); expect(r.Ncorr).toBeCloseTo(17.025, 2); });
  it('refusal is not corrected', () => expect(correctSpt([{ depth: 12, N: 100, refusal: true }], bh1.layers, 1.0)[0].refusal).toBe(true));
});

describe('§4–6 lab tests (P2)', () => {
  it('direct shear least squares — SM soaked', () => {
    const f = fitDirectShear(lab.directShear.SM_soaked.sigma, lab.directShear.SM_soaked.tau);
    expect(f.phi).toBeCloseTo(29.987, 2);
    expect(f.c).toBeCloseTo(1.033, 2);
  });
  it('UU cu', () => {
    expect(cuFromUU(lab.uu.UDS1).cu).toBeCloseTo(28.517, 2);
    expect(cuFromUU(lab.uu.UDS2).cu).toBeCloseTo(36.1, 2);
  });
  it('oedometer Cc, Cr, σ′p (kg/cm² converted)', () => {
    const o = interpretOedometer(lab.oedometerUDS1.points, 'kg/cm2');
    expect(o.points[0].p).toBeCloseTo(9.80665, 4);
    expect(o.Cc).toBeCloseTo(0.2923, 3);
    expect(o.Cr).toBeCloseTo(0.0382, 3);
    expect(o.sigmaP).toBeGreaterThan(110);
    expect(o.sigmaP).toBeLessThan(119);
  });
});

describe('§7 bearing capacity IS 6403 (P3)', () => {
  it('factors at φ = 30°', () => {
    const f = bearingFactors(30);
    expect(f.Nq).toBeCloseTo(18.401, 2);
    expect(f.Nc).toBeCloseTo(30.14, 2);
    expect(f.Ng).toBeCloseTo(22.402, 2);
  });
  it('Nc = 5.14 at φ = 0', () => expect(bearingFactors(0).Nc).toBe(5.14));
  it('local shear φm', () => expect(localShear(0, 30).phi).toBeCloseTo(21.05, 2));
  it('W′ interpolation', () => {
    expect(waterTableFactor(1, 1, 2)).toBe(0.5);
    expect(waterTableFactor(3, 1, 2)).toBe(1);
    expect(waterTableFactor(2, 1, 2)).toBeCloseTo(0.75, 10);
  });
  it('full example: square 2 m, Df 1 m, φ 30°, γ 18, WT deep', () => {
    const layers: SoilLayer[] = [{ top: 0, bottom: 20, symbol: 'SP', behaviour: 'granular', gammaMoist: 18, gammaSat: 20, c: 0, phi: 30 }];
    const r = bearingCapacity({ footing: { shape: 'square', B: 2, Df: 1 }, layers, zw: 50, mode: 'general' });
    expect(r.q).toBeCloseTo(18, 6);
    expect(r.terms.surcharge).toBeCloseTo(408.42, 0);
    expect(r.terms.selfWeight).toBeCloseTo(350.53, 0);
    expect(rel(r.qnu, 758.95)).toBeLessThan(0.001);
    expect(rel(r.qns, 252.98)).toBeLessThan(0.001);
  });
  it('eccentric load reduces the effective width (B′ = B − 2e)', () => {
    const layers: SoilLayer[] = [{ top: 0, bottom: 20, symbol: 'SP', behaviour: 'granular', gammaMoist: 18, gammaSat: 20, c: 0, phi: 30 }];
    const r = bearingCapacity({ footing: { shape: 'square', B: 2, Df: 1 }, load: { P: 1000, MB: 200 }, layers, zw: 50, mode: 'general' });
    expect(r.Beff).toBeCloseTo(1.6, 10);
    expect(r.Leff).toBeCloseTo(2.0, 10);
  });
});

describe('§8 stress increase (P4) and settlement (P5)', () => {
  it('corner influence m = n = 1', () => expect(cornerInfluence(1, 1, 1)).toBeCloseTo(0.17522, 4));
  it('centre of 2 × 2 at z = 1', () => expect(deltaSigmaCentre(1, 2, 2, 1)).toBeCloseTo(0.70088, 4));
  it('2:1 at z = B', () => expect(deltaSigma21(1, 2, 2, 2)).toBeCloseTo(0.25, 10));
  it('consolidation NC', () => expect(sublayerSettlement(0.3, 0.05, 0.9, 1, 100, 100, 100).s * 1000).toBeCloseTo(47.53, 1));
  it('consolidation OC crossing σ′p', () => {
    const r = sublayerSettlement(0.3, 0.05, 0.9, 1, 100, 100, 150);
    expect(r.state).toBe('OC-crossing');
    expect(r.s * 1000).toBeCloseTo(24.36, 1);
  });
  it('Terzaghi Tv(50 %) and Tv(90 %)', () => {
    expect(timeFactor(0.5)).toBeCloseTo(0.197, 2);
    expect(timeFactor(0.9)).toBeCloseTo(0.848, 2);
    expect(degreeOfConsolidation(0.197)).toBeCloseTo(0.5, 2);
  });
  it('Schmertmann 1978 worked example', () => {
    const layers: SoilLayer[] = [{ top: 0, bottom: 20, symbol: 'SP', behaviour: 'granular', gammaMoist: 12.5, gammaSat: 12.5, E: 10000, c: 0, phi: 32 }];
    const r = schmertmann({ footing: { shape: 'square', B: 2, Df: 1 }, layers, zw: 50, netPressure: 100, tYears: 0.1 });
    expect(r.C1).toBeCloseTo(0.9375, 6);
    expect(r.Izp).toBeCloseTo(0.7, 6);
    expect(r.settlement * 1000).toBeCloseTo(13.59, 1);
  });
  it('7 × 4 grid has 45 adjacent pairs', () => {
    const cols = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) cols.push({ id: `${i}${j}`, x: i * 5, y: j * 5, load: { P: 1 }, boreholeId: 'x' });
    expect(adjacentPairs(cols).length).toBe(45);
  });
});
