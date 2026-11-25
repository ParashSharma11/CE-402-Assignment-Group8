/**
 * Runs the engine over the whole project state and returns everything the screens need.
 * Pure function of the inputs — the UI calls it through a debounced hook.
 */
import {
  loadFactor, sizeFooting, buildingChecks, raftCheck, correctSpt, stressProfile, validateLayers, fitDirectShear,
  cuFromUU, interpretOedometer, type Borehole, type ColumnInput, type FootingCheck, type SptCorrected,
  type StressPoint, type ShearFit, type OedometerResult,
} from '../engine';
import { rowLabel, type ProjectState } from '../store/project';

export type Status = 'pass' | 'fail' | 'warn';
export interface CheckRow { name: string; value: number; unit: string; limit: string; clause: string; status: Status }
export interface Assumption { item: string; value: string; reason: string; source: string }

export interface ColumnResult { col: ColumnInput; found: boolean; check: FootingCheck | null; type: 'corner' | 'edge' | 'interior' | 'special' }

export interface ProjectResults {
  lambda: number;
  columns: ColumnInput[];
  colResults: ColumnResult[];
  perBH: Record<string, { errors: string[]; spt: SptCorrected[]; stressDesign: StressPoint[]; stressMeasured: StressPoint[] }>;
  lab: { shear: (ShearFit & { name: string })[]; uu: { name: string; cu: number }[]; oed: OedometerResult | null; labErrors: string[] };
  building: ReturnType<typeof buildingChecks> | null;
  raft: { bh: string; qn: number; qns: number; sCentre: number; sCorner: number } | null;
  checks: CheckRow[];
  assumptions: Assumption[];
  alternative: { needed: boolean; zones: string[]; proposal: string } ;
  errors: string[];
}

export function buildColumns(s: Pick<ProjectState, 'building' | 'project'>): { columns: ColumnInput[]; types: Record<string, ColumnResult['type']> } {
  const { building: b, project } = s;
  const lam = loadFactor(project.group);
  const columns: ColumnInput[] = [];
  const types: Record<string, ColumnResult['type']> = {};
  for (let r = 0; r < b.nRows; r++) {
    for (let l = 1; l <= b.nLines; l++) {
      const id = `${rowLabel(r)}${l}`;
      const edgeR = r === 0 || r === b.nRows - 1, edgeL = l === 1 || l === b.nLines;
      const type: ColumnResult['type'] = edgeR && edgeL ? 'corner' : edgeR || edgeL ? 'edge' : 'interior';
      const ov = b.overrides[id];
      const P = (ov?.P ?? b.loads[type]) * lam;
      const MB = (ov?.MB ?? 0) * lam;
      const zone = b.zoning.find((z) => l >= z.from && l <= z.to);
      types[id] = ov ? 'special' : type;
      columns.push({ id, x: (l - 1) * b.sx, y: r * b.sy, load: { P, MB }, boreholeId: zone?.bh ?? '', shape: ov?.shape ?? 'square' });
    }
  }
  return { columns, types };
}

export function computeResults(s: ProjectState): ProjectResults {
  const errors: string[] = [];
  const lambda = loadFactor(s.project.group);
  const bhById = new Map<string, Borehole>(s.boreholes.map((b) => [b.id, b]));

  /* Per borehole: validation, SPT, stress profiles */
  const perBH: ProjectResults['perBH'] = {};
  for (const bh of s.boreholes) {
    const errs = validateLayers(bh.layers);
    let spt: SptCorrected[] = [], sd: StressPoint[] = [], sm: StressPoint[] = [];
    if (!errs.length) {
      try {
        spt = correctSpt(bh.spt, bh.layers, bh.designWT);
        sd = stressProfile(bh.layers, bh.designWT);
        sm = stressProfile(bh.layers, bh.measuredWT);
      } catch (e) { errs.push(String((e as Error).message)); }
    }
    perBH[bh.id] = { errors: errs, spt, stressDesign: sd, stressMeasured: sm };
    errs.forEach((e) => errors.push(`${bh.id}: ${e}`));
  }

  /* Lab */
  const labErrors: string[] = [];
  const shear = s.lab.directShear.flatMap((d) => { try { return [{ name: d.name, ...fitDirectShear(d.sigma, d.tau) }]; } catch (e) { labErrors.push(`${d.name}: ${(e as Error).message}`); return []; } });
  const uu = s.lab.uu.flatMap((u) => { try { return [{ name: u.name, cu: cuFromUU(u.dev).cu }]; } catch (e) { labErrors.push(`${u.name}: ${(e as Error).message}`); return []; } });
  let oed: OedometerResult | null = null;
  if (s.lab.oed.points.length >= 3) { try { oed = interpretOedometer(s.lab.oed.points, s.lab.oed.unit); } catch (e) { labErrors.push(`Oedometer: ${(e as Error).message}`); } }

  /* Columns → footings */
  const { columns, types } = buildColumns(s);
  const p = s.project;
  const opt = { sAllow: p.limits.maxTotal, FS: p.FS, mode: p.mode, useDepthFactors: p.useDepthFactors, includeSelfWeight: p.includeSelfWeight, gammaFootingBackfill: p.gammaFB, tYears: p.tYears, Bmax: 6, LoverB: 1.5 };
  const memo = new Map<string, { found: boolean; check: FootingCheck | null }>();
  const colResults: ColumnResult[] = columns.map((c) => {
    const bh = bhById.get(c.boreholeId);
    if (!bh || perBH[bh.id]?.errors.length) return { col: c, found: false, check: null, type: types[c.id] };
    const key = `${bh.id}|${c.load.P.toFixed(3)}|${(c.load.MB ?? 0).toFixed(3)}|${c.shape}|${JSON.stringify(opt)}`;
    let r = memo.get(key);
    if (!r) {
      try { const z = sizeFooting(c.shape ?? 'square', p.Df, c.load, bh, opt); r = { found: z.found, check: z.check }; }
      catch (e) { errors.push(`${c.id}: ${(e as Error).message}`); r = { found: false, check: null }; }
      memo.set(key, r);
    }
    return { col: c, ...r, type: types[c.id] };
  });

  /* Building checks */
  const sMm: Record<string, number> = {};
  colResults.forEach((r) => { if (r.check) sMm[r.col.id] = r.check.sTotal * 1000; });
  const building = Object.keys(sMm).length >= 2 ? buildingChecks(sMm, columns.filter((c) => sMm[c.id] !== undefined), p.limits) : null;

  /* Alternative: raft on the weakest zone */
  const failing = colResults.filter((r) => !r.found);
  const failZones = [...new Set(failing.map((r) => r.col.boreholeId))];
  let raft: ProjectResults['raft'] = null;
  if (failZones.length && bhById.get(failZones[0])) {
    try {
      const b = s.building;
      const W = (b.nLines - 1) * b.sx, Bw = (b.nRows - 1) * b.sy;
      const total = columns.reduce((a, c) => a + c.load.P, 0);
      const rc = raftCheck(Math.min(W, Bw) || 1, Math.max(W, Bw) || 1, p.Df, total, bhById.get(failZones[0])!, { ...opt, sAllow: p.limits.maxTotal * 1.5 });
      raft = { bh: failZones[0], qn: rc.centre.qApplied, qns: rc.centre.bearing.qns, sCentre: rc.centre.sTotal * 1000, sCorner: rc.sCornerConsolidation * 1000 };
    } catch (e) { errors.push(`Raft: ${(e as Error).message}`); }
  }

  /* Check table */
  const checks: CheckRow[] = [];
  const fmt = (x: number, d = 1) => +x.toFixed(d);
  const lim = p.limits;
  const bearingWorst = colResults.filter((r) => r.check).reduce<ColumnResult | null>((m, r) => (!m || r.check!.qApplied / r.check!.bearing.qns > m.check!.qApplied / m.check!.bearing.qns ? r : m), null);
  if (bearingWorst?.check) {
    const u = bearingWorst.check.qApplied / bearingWorst.check.bearing.qns;
    checks.push({ name: `Bearing, governing column ${bearingWorst.col.id}`, value: fmt(bearingWorst.check.qApplied), unit: 'kPa', limit: `≤ qns = ${fmt(bearingWorst.check.bearing.qns)} kPa (FS ${p.FS})`, clause: 'IS 6403:1981', status: u <= 1 ? 'pass' : 'fail' });
  }
  if (building) {
    checks.push({ name: 'Maximum total settlement', value: fmt(building.maxTotal), unit: 'mm', limit: `≤ ${lim.maxTotal} mm`, clause: lim.source, status: building.passTotal ? 'pass' : 'fail' });
    if (building.worstDiff) {
      const dl = lim.maxDifferential ?? (lim.maxDiffRatio ?? 0) * building.worstDiff.span * 1000;
      checks.push({ name: `Differential settlement ${building.worstDiff.a}–${building.worstDiff.b}`, value: fmt(building.worstDiff.delta), unit: 'mm', limit: `≤ ${fmt(dl)} mm`, clause: lim.source, status: building.passDiff ? 'pass' : 'fail' });
    }
    if (building.worstAng) {
      checks.push({ name: `Angular distortion ${building.worstAng.a}–${building.worstAng.b}`, value: fmt(building.worstAng.angular, 5), unit: '', limit: `≤ 1/${Math.round(1 / lim.maxAngular)} = ${fmt(lim.maxAngular, 5)}`, clause: lim.source, status: building.passAngular ? 'pass' : 'fail' });
    }
  }
  const nFail = failing.length;
  checks.push({ name: 'Columns with a valid isolated footing', value: columns.length - nFail, unit: `of ${columns.length}`, limit: `all ${columns.length}`, clause: 'IS 6403 + IS 1904', status: nFail ? 'fail' : 'pass' });

  /* Assumptions */
  const assumptions: Assumption[] = [
    { item: 'Load factor λ', value: `${lambda.toFixed(2)} (g = ${p.group})`, reason: 'Assignment brief: λ = 1 + g/100 on all service loads', source: 'CE 402 brief' },
    { item: 'Design water table', value: 'seasonal highest (August) per borehole', reason: 'Gives the lowest effective stress → conservative q, W′ and σ′v0', source: 'IS 6403:1981 (water-table effect) — TO VERIFY clause' },
    { item: 'Factor of safety', value: `${p.FS} on net ultimate`, reason: 'Assignment design criterion', source: 'IS 6403:1981' },
    { item: 'Shear failure mode', value: p.mode === 'auto' ? 'auto: local ≤ 29°, general ≥ 36°, interpolated' : p.mode, reason: 'Relative density of the founding sand', source: 'IS 6403:1981 cl. 5.1.2 — TO VERIFY' },
    { item: 'Depth factors', value: p.useDepthFactors ? 'used' : 'not used', reason: p.useDepthFactors ? 'Backfill to be compacted in layers' : 'Backfill compaction not assured', source: 'IS 6403:1981 — TO VERIFY clause' },
    { item: 'Footing + backfill weight', value: p.includeSelfWeight ? `γ = ${p.gammaFB} kN/m³ over Df` : 'ignored', reason: 'Net pressure = gross − overburden removed', source: 'IS 6403 definitions' },
    { item: 'Settlement limits', value: `${lim.maxTotal} mm; δ ≤ ${lim.maxDiffRatio ?? '–'}·L; β ≤ 1/${Math.round(1 / lim.maxAngular)}`, reason: 'RC framed building on isolated footings', source: lim.source },
    { item: 'Clay sublayers', value: '≤ 0.5 m, Δσ under footing centre (Boussinesq)', reason: 'Assignment P5', source: 'Das (2014) Ch. 11' },
    { item: 'Schmertmann time', value: `${p.tYears} yr (C2)`, reason: 'End of construction', source: 'Schmertmann et al. (1978)' },
  ];
  if (oed) assumptions.push({ item: 'Oedometer interpretation', value: `Cc ${oed.Cc.toFixed(3)}, Cr ${oed.Cr.toFixed(3)}, σ′p ${oed.sigmaP.toFixed(0)} kPa`, reason: 'Lab pressures converted from kg/cm² (×98.0665); σ′p by Casagrande (scale-dependent)', source: 'Das (2014) §11.5–11.6' });

  const proposal = nFail
    ? raft && raft.sCentre > lim.maxTotal
      ? `Isolated footings fail in ${failZones.join(', ')}; a raft there settles ≈ ${raft.sCentre.toFixed(0)} mm, also above ${lim.maxTotal} mm. Propose bored piles socketed into the very dense gravel stratum below the clay for those grid lines, with the remaining lines on isolated footings (check differential movement at the interface).`
      : `Isolated footings fail in ${failZones.join(', ')}; a raft over the footprint (net ${raft?.qn.toFixed(0)} kPa) is the first alternative to check.`
    : 'Isolated footings satisfy bearing and settlement everywhere.';

  return {
    lambda, columns, colResults, perBH, lab: { shear, uu, oed, labErrors }, building, raft, checks, assumptions,
    alternative: { needed: nFail > 0, zones: failZones, proposal }, errors: [...errors, ...labErrors],
  };
}
