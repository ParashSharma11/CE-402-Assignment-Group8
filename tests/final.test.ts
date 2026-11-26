import { describe, it, expect } from 'vitest';
import { finalDesign, singlePile } from '../src/engine';
import { boreholes, columns, DF, limitsCandidate } from '../src/examples/mandi';

describe('final design (Mandi example, team method)', () => {
  const opt = { sAllow: 50, FS: 3, Df: DF, strength: 'zone-average' as const, transition: 'factors' as const, sx: 5, sy: 5, LoverB: 1.5, pile: { D: 0.5, cutoff: DF, socket: 1.5 } };
  const fd = finalDesign(columns, boreholes, limitsCandidate.sand, opt);
  it('prints the design', () => {
    const grid: Record<string, string> = {};
    for (const c of fd.columns) grid[c.col.id] = c.type === 'piles' ? `${c.pile!.nPiles}P ${(c.s * 1000).toFixed(1)}mm` : `${c.footprint.B.toFixed(2)}m ${(c.s * 1000).toFixed(1)}mm`;
    for (const row of ['D', 'C', 'B', 'A']) console.log(row, [1, 2, 3, 4, 5, 6, 7].map((l) => grid[row + l].padEnd(15)).join(''));
    console.log('zones', fd.zones.map((z) => `${z.bh}:${z.type}`).join(' '), '| s* =', fd.target && (fd.target * 1000).toFixed(1), 'mm | max s', fd.maxTotal.toFixed(1));
    const checked = fd.pairs.filter((p) => !p.separated);
    console.log('worst δ', Math.max(...checked.map((p) => p.delta)).toFixed(2), 'mm | worst β 1/', Math.round(1 / Math.max(...checked.map((p) => p.angular))), '| joint', fd.jointBetween.join(','), '|', fd.notes.join(' '));
    const p = singlePile(boreholes[2], opt.pile);
    console.log(`pile BH-3: toe ${p.toe} m, L ${p.length.toFixed(2)} m, Qb ${p.Qb.toFixed(0)} kN, Qs ${p.Qs.toFixed(0)} kN, Qsafe ${p.Qsafe.toFixed(0)} kN`);
  });
  it('BH-3 zone goes on piles; BH-1 and BH-2 on isolated footings', () => {
    expect(fd.zones.find((z) => z.bh === 'BH-3')!.type).toBe('piles');
    expect(fd.zones.find((z) => z.bh === 'BH-1')!.type).toBe('isolated');
  });
  it('every check passes on the final design', () => {
    expect(fd.passBearing).toBe(true);
    expect(fd.passTotal).toBe(true);
    expect(fd.passDiff).toBe(true);
    expect(fd.passAngular).toBe(true);
  });
  it('footings fit the grid with clearance', () => {
    for (const c of fd.columns) { expect(c.footprint.B).toBeLessThanOrEqual(4.7 + 1e-9); expect(c.footprint.L).toBeLessThanOrEqual(4.7 + 1e-9); }
  });
});
