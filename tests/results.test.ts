import { describe, it, expect } from 'vitest';
import { computeResults } from '../src/lib/results';
import type { ProjectState } from '../src/store/project';
import { boreholes, DF, limitsCandidate, GROUP_NUMBER } from '../src/examples/mandi';

// Minimal project state equivalent to "Open Mandi example" (no UI store needed).
const state = {
  project: { name: 'Mandi', location: '', group: GROUP_NUMBER, FS: 3, Df: DF, mode: 'auto', useDepthFactors: true, includeSelfWeight: true, gammaFB: 20, tYears: 0.1, limits: limitsCandidate.sand },
  building: { nLines: 7, nRows: 4, sx: 5, sy: 5, loads: { corner: 650, edge: 1000, interior: 1450 }, overrides: { C4: { P: 1450, MB: 362.5, shape: 'rectangle' } }, zoning: [{ from: 1, to: 2, bh: 'BH-2' }, { from: 3, to: 5, bh: 'BH-1' }, { from: 6, to: 7, bh: 'BH-3' }] },
  boreholes, lab: { directShear: [], uu: [], oed: { unit: 'kPa', e0: 0.9, points: [] } },
} as unknown as ProjectState;

describe('project results (Mandi example)', () => {
  const r = computeResults(state);
  it('designs all 28 columns', () => expect(r.colResults.length).toBe(28));
  it('final design keeps every footing inside the grid (AI audit item 1: overlap was not checked)', () => {
    const geo = r.checks.find((c) => c.name.startsWith('Footings fit the column grid'));
    expect(geo?.status).toBe('pass');
  });
  it('no check fails on the final design', () => {
    expect(r.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });
  it('proposes an alternative for the failing zone', () => {
    expect(r.alternative.needed).toBe(true);
    expect(r.alternative.zones).toContain('BH-3');
  });
});
