import { describe, it, expect } from 'vitest';
import { sizeFooting, buildingChecks, raftCheck, correctSpt } from '../src/engine';
import { boreholes, columns, DF, limitsCandidate, derived, lambda } from '../src/examples/mandi';

const bh = (id: string) => boreholes.find((b) => b.id === id)!;
const limits = limitsCandidate.sand; // candidate only — team to confirm against IS 1904:1986

describe('Mandi hostel — end-to-end design run (example data)', () => {
  const results = columns.map((c) => {
    const r = sizeFooting(c.shape ?? 'square', DF, c.load, bh(c.boreholeId), { sAllow: limits.maxTotal, FS: 3, Bmax: 6, LoverB: 1.5 });
    return { col: c, ...r };
  });

  it('derived lab parameters are sensible', () => {
    expect(derived.smSoaked.phi).toBeGreaterThan(29);
    expect(derived.oed.Cc).toBeGreaterThan(0.25);
    expect(lambda).toBeCloseTo(1.08, 10);
  });

  it('every column gets a check (sized or flagged)', () => {
    expect(results.length).toBe(28);
    results.forEach((r) => expect(r.check).not.toBeNull());
  });

  it('prints the design table', () => {
    const rows = results.map((r) => ({
      col: r.col.id, BH: r.col.boreholeId, 'P kN': +r.col.load.P.toFixed(0),
      'B m': r.check!.footing.B, 'L m': r.check!.footing.L ?? r.check!.footing.B,
      'qn kPa': +r.check!.qApplied.toFixed(1), 'qns kPa': +r.check!.bearing.qns.toFixed(1),
      'si mm': +(r.check!.sImmediate * 1000).toFixed(1), 'sc mm': +(r.check!.sConsolidation * 1000).toFixed(1),
      's mm': +(r.check!.sTotal * 1000).toFixed(1), OK: r.found ? 'yes' : 'NO',
    }));
    console.table(rows);
    const sMm = Object.fromEntries(results.map((r) => [r.col.id, r.check!.sTotal * 1000]));
    const b = buildingChecks(sMm, columns, limits);
    console.log(`max s = ${b.maxTotal.toFixed(1)} mm (limit ${limits.maxTotal}) → ${b.passTotal ? 'PASS' : 'FAIL'}`);
    console.log(`worst δ = ${b.worstDiff.delta.toFixed(1)} mm ${b.worstDiff.a}–${b.worstDiff.b} → ${b.passDiff ? 'PASS' : 'FAIL'}`);
    console.log(`worst β = 1/${(1 / b.worstAng.angular).toFixed(0)} ${b.worstAng.a}–${b.worstAng.b} (limit 1/${(1 / limits.maxAngular).toFixed(0)}) → ${b.passAngular ? 'PASS' : 'FAIL'}`);
    const total = columns.reduce((a, c) => a + c.load.P, 0);
    const raft = raftCheck(15, 30, DF, total, bh('BH-3'), { sAllow: 100, FS: 3 });
    console.log(`raft (BH-3 ground): qn = ${raft.centre.qApplied.toFixed(1)} kPa, qns = ${raft.centre.bearing.qns.toFixed(1)} kPa, s_centre = ${(raft.centre.sTotal * 1000).toFixed(1)} mm, s_corner(cons) = ${(raft.sCornerConsolidation * 1000).toFixed(1)} mm`);
    const spt = correctSpt(bh('BH-1').spt, bh('BH-1').layers, bh('BH-1').designWT);
    console.table(spt.map((s) => ({ z: s.depth, N: s.N, 'σ′v': +s.sigmaVEff.toFixed(1), CN: +s.CN.toFixed(3), "N′": +s.N1.toFixed(1), "N″": +s.Ncorr.toFixed(1), dil: s.dilatancyApplied })));
    expect(rows.length).toBe(28);
  });
});
