/**
 * Two independent implementations must agree: GeoFound v2 (TypeScript, src/engine) vs the team's v1 engines
 * (platform-v1/js — Parash, Gaurav, Muvan, Namit). Where the methods are the same, results must match closely;
 * where v1 deliberately differs (v1 averages soil parameters over the shear zone), the difference is reported.
 */
import { describe, it, expect } from 'vitest';
import { bearingFactors, deltaSigmaCentre, deltaSigmaCorner, deltaSigma21, correctSpt, fitDirectShear, degreeOfConsolidation, bearingCapacity } from '../src/engine';
import { teamBearing, teamStress, teamSpt, teamShear, teamU, toTeamLayers } from '../src/team/bridge';
import { boreholes, lab } from '../src/examples/mandi';

const bh1 = boreholes.find((b) => b.id === 'BH-1')!;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));

describe('cross-check: GeoFound v2 vs team v1 engines', () => {
  it('P1 (Parash): v1 accepts every Mandi borehole profile', () => {
    for (const b of boreholes) expect(toTeamLayers(b).errors).toEqual([]);
  });
  it('P2 (Parash): direct-shear OLS identical', () => {
    const v1 = teamShear(lab.directShear.SM_soaked.sigma, lab.directShear.SM_soaked.tau)!;
    const v2 = fitDirectShear(lab.directShear.SM_soaked.sigma, lab.directShear.SM_soaked.tau);
    expect(v1.phi).toBeCloseTo(v2.phi, 6);
    expect(v1.c).toBeCloseTo(v2.c, 6);
  });
  it('P2 (Parash): SPT CN, N′, N″ identical for BH-1 (design WT)', () => {
    const v1 = teamSpt(bh1, bh1.designWT);
    const v2 = correctSpt(bh1.spt, bh1.layers, bh1.designWT).filter((r) => !r.refusal);
    expect(v1.length).toBe(v2.length);
    v1.forEach((r, i) => { expect(r.CN).toBeCloseTo(v2[i].CN, 4); expect(r.N1).toBeCloseTo(v2[i].N1, 3); expect(r.N2).toBeCloseTo(v2[i].Ncorr, 3); });
  });
  it('P4 (Namit): Boussinesq centre/corner and 2:1 identical', () => {
    for (const z of [0.5, 1, 2, 4, 8]) {
      const v1 = teamStress(100, 2.5, 3.5, 1.5, z)!;
      expect(v1.centre).toBeCloseTo(deltaSigmaCentre(100, 2.5, 3.5, z), 6);
      expect(v1.corner).toBeCloseTo(deltaSigmaCorner(100, 2.5, 3.5, z), 6);
      expect(v1.twoToOne).toBeCloseTo(deltaSigma21(100, 2.5, 3.5, z), 6);
    }
  });
  it('P5 (Muvan): Terzaghi U(Tv) identical', () => {
    for (const Tv of [0.05, 0.197, 0.5, 0.848, 1.5]) expect(teamU(Tv)).toBeCloseTo(degreeOfConsolidation(Tv), 4);
  });
  it('P3 (Gaurav): with the same method choices, qnu agrees; with GeoFound defaults the gap is reported', () => {
    const footing = { shape: 'square' as const, B: 3.2, Df: 1.5 };
    const v1 = teamBearing(footing, { P: 1566 }, bh1)!;
    expect(v1.errors).toEqual([]);
    const same = bearingCapacity({ footing, layers: bh1.layers, zw: bh1.designWT, strength: 'zone-average', transition: 'factors' });
    expect(rel(same.qnu, v1.qnu)).toBeLessThan(0.005);
    expect(same.factors.Nq).toBeCloseTo(v1.Nq, 3);
    expect(same.Wp).toBeCloseTo(v1.Wp, 6);
    const def = bearingCapacity({ footing, layers: bh1.layers, zw: bh1.designWT });
    console.log(`P3 BH-1, B = 3.2 m: v1 (Gaurav) qnu = ${v1.qnu.toFixed(1)} kPa | v2 same choices = ${same.qnu.toFixed(1)} | v2 defaults (base layer, capacity interpolation) = ${def.qnu.toFixed(1)} kPa`);
    expect(bearingFactors(30).Nq).toBeCloseTo(18.401, 2);
  });
});
