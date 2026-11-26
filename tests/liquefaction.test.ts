import { describe, it, expect } from 'vitest';
import { liquefaction, zoneOfZ, finesCorrection, crr75, rdAt, correctSpt, singlePile, effectiveStress } from '../src/engine';
import { boreholes } from '../src/examples/mandi';

const [bh1, , bh3] = boreholes;

describe('liquefaction — IS 1893 Annex F simplified procedure (hand calcs in tests/hand_calcs.md §L)', () => {
  it('fines correction and CRR (Youd et al. 2001)', () => {
    const f = finesCorrection(24);
    expect(f.alpha).toBeCloseTo(4.1793, 3);
    expect(f.beta).toBeCloseTo(1.10758, 4);
    expect(crr75(13.0748)).toBeCloseTo(0.14126, 4);
    expect(rdAt(1.5)).toBeCloseTo(0.988525, 6);
  });
  it('BH-3 loose SM at 1.5 m liquefies at 0.18 g: FS = 0.1413 / 0.1728 = 0.82', () => {
    const r = liquefaction(bh3, { amax: 0.18, Mw: 7.5 }).rows.find((x) => x.depth === 1.5)!;
    expect(r.svEffTest).toBeCloseTo(24.9, 2); // fill 0.9 × 16.0 + 0.6 × 17.5, above the October WT (1.9 m)
    expect(r.N160).toBeCloseTo(8.0325, 3); // 6 × 1.7 × 1.0 × 1.05 × 0.75
    expect(r.CSR).toBeCloseTo(0.17280, 4);
    expect(r.FS).toBeCloseTo(0.8175, 3);
    expect(r.status).toBe('liquefiable');
  });
  it('BH-3 SM and SP are liquefiable → piles ignore their shaft friction and carry it as downdrag', () => {
    const L = liquefaction(bh3, { amax: 0.18, Mw: 7.5 });
    expect(L.liquefiableTo).toBe(4.4);
    const p = singlePile(bh3, { D: 0.5, cutoff: 1.5, socket: 1.5, liquefiableTo: L.liquefiableTo });
    expect(p.Qneg).toBeGreaterThan(100);
  });
  it('BH-1 sands are safe at 0.18 g but liquefy at amax = Z = 0.36 g', () => {
    expect(liquefaction(bh1, { amax: 0.18, Mw: 7.5 }).liquefiableLayers).toEqual([]);
    expect(liquefaction(bh1, { amax: 0.36, Mw: 7.5 }).liquefiableLayers.map((l) => l.symbol)).toContain('SM');
  });
  it('clay (PI ≥ 12) is screened out', () => {
    expect(liquefaction(bh1, { amax: 0.36, Mw: 7.5 }).rows.find((x) => x.depth === 7.5)!.status).toBe('not-susceptible');
  });
});

describe('water table at test time (reviewer findings)', () => {
  it('IS 2131 at BH-1 1.5 m uses the October WT: σ′v 26.1 kPa, CN 1.451, N″ = 18.9 (no dilatancy above the WT)', () => {
    const r = correctSpt(bh1.spt, bh1.layers, bh1.measuredWT).find((x) => x.depth === 1.5)!;
    expect(r.sigmaVEff).toBeCloseTo(26.1, 2);
    expect(r.CN).toBeCloseTo(0.77 * Math.log10(2000 / 26.1), 4);
    expect(r.dilatancyApplied).toBe(false);
    expect(r.Ncorr).toBeCloseTo(18.86, 1);
  });
  it('σ′v0 at UDS-1 (7.225 m): 79.5 kPa with the August WT, 92.0 kPa with the October WT → OCR 1.44 vs 1.25', () => {
    const sAug = effectiveStress(bh1.layers, 7.225, bh1.designWT);
    const sOct = effectiveStress(bh1.layers, 7.225, bh1.measuredWT);
    expect(sAug).toBeCloseTo(79.5, 0);
    expect(sOct).toBeCloseTo(92.0, 1);
  });
});

describe('seismic zone is a user input (IS 1893 Table 3)', () => {
  it('zone ↔ Z lookup', () => {
    expect(zoneOfZ(0.36)).toBe('V');
    expect(zoneOfZ(0.10)).toBe('II');
    expect(zoneOfZ(0.2)).toBeNull(); // custom value
  });
  it('a lower zone changes the result: BH-3 SM at 1.5 m is safe in zone II (amax = 0.05 g)', () => {
    const r = liquefaction(bh3, { amax: 0.10 / 2, Mw: 7.5 }).rows.find((x) => x.depth === 1.5)!;
    expect(r.FS!).toBeCloseTo(0.8175 * (0.18 / 0.05), 2); // CSR ∝ amax
    expect(r.status).toBe('safe');
  });
});
