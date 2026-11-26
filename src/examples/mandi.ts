/**
 * Mandi hostel example — the ONLY place site-specific values live.
 * Source of measured data: CE 402 assignment brief (05 Nov 2026), borehole logs BH-1/2/3 and BH-1 lab sheets.
 * Every value not in the brief is marked ASSUMED with the reason; the team must review these.
 */
import { interpretOedometer, fitDirectShear, cuFromUU, ccFromLL, e0FromW, cm2sToM2yr, loadFactor } from '../engine';
import type { Borehole, ColumnInput, SettlementLimits } from '../engine';

/* ---------- Laboratory results (BH-1), exactly as on the lab sheets ---------- */
export const lab = {
  directShear: {
    SM_unsoaked: { sigma: [50, 100, 150], tau: [37.0, 67.0, 97.2] },
    SM_soaked: { sigma: [50, 100, 150], tau: [29.8, 58.9, 87.5] },
    SP_soaked: { sigma: [50, 100, 150], tau: [34.9, 68.3, 103.4] },
  },
  uu: { UDS1: [57.2, 55.8, 58.1], UDS2: [71.0, 73.4, 72.2] }, // deviator stress at failure, kPa
  oedometerUDS1: {
    unit: 'kg/cm2' as const, // ← lab sheet unit (trap)
    e0: 0.918,
    points: [
      { p: 0.10, e: 0.914, stage: 'loading' as const },
      { p: 0.25, e: 0.897, stage: 'loading' as const },
      { p: 0.50, e: 0.882, stage: 'loading' as const },
      { p: 1.00, e: 0.853, stage: 'loading' as const },
      { p: 2.00, e: 0.779, stage: 'loading' as const },
      { p: 4.00, e: 0.692, stage: 'loading' as const },
      { p: 8.00, e: 0.603, stage: 'loading' as const },
      { p: 2.00, e: 0.626, stage: 'unloading' as const },
      { p: 0.50, e: 0.649, stage: 'unloading' as const },
    ],
    /** cv for the increment ending at each pressure, cm²/s (trap: unit) */
    cv_cm2s: { 0.25: 1.2e-3, 0.5: 1.1e-3, 1: 8.9e-4, 2: 6.3e-4, 4: 5.0e-4, 8: 4.4e-4 } as Record<number, number>,
  },
  index: { UDS1: { w: 34, LL: 44, PL: 23, Gs: 2.70 }, UDS2: { w: 31, LL: 41, PL: 22, Gs: 2.70 } },
};

/* ---------- Derived parameters (computed by the engine, so they stay traceable) ---------- */
const smSoaked = fitDirectShear(lab.directShear.SM_soaked.sigma, lab.directShear.SM_soaked.tau);
const spSoaked = fitDirectShear(lab.directShear.SP_soaked.sigma, lab.directShear.SP_soaked.tau);
const cu1 = cuFromUU(lab.uu.UDS1).cu;
const cu2 = cuFromUU(lab.uu.UDS2).cu;
const oed = interpretOedometer(lab.oedometerUDS1.points, lab.oedometerUDS1.unit);
/** cv over the 1–2 kg/cm² increment (bracketing σ′v0 → σ′v0 + Δσ in the clay), converted to m²/yr. */
const cvClay = cm2sToM2yr(lab.oedometerUDS1.cv_cm2s[2]);

/**
 * Design c′ for the non-plastic sands = 0. The least-squares intercepts (SM 1.03 kPa, SP 0.37 kPa) are reported in the
 * parameter module but are fitting artefacts / apparent cohesion of a non-plastic sand, so they are NOT used in IS 6403.
 * SOURCE: standard practice for cohesionless soil (Das 2016 §2.? ; Bowles 1996 §2.11) — TO VERIFY section numbers.
 */
const C_SAND = 0;

/** E from SPT N for sand: E = 500 (N + 15) kPa. SOURCE: Bowles (1996) Table 5-6 — ASSUMED correlation, TO VERIFY. */
const E_from_N = (N: number) => 500 * (N + 15);

export const derived = { smSoaked, spSoaked, cu1, cu2, oed, cvClay };

/* ---------- Boreholes ---------- */
export const boreholes: Borehole[] = [
  {
    id: 'BH-1', groundRL: 100.0, measuredWT: 2.6, designWT: 1.0, lowestWT: 3.6, x: 15, y: 10,
    spt: [
      { depth: 1.5, N: 13 }, { depth: 3.0, N: 16 }, { depth: 4.5, N: 24 },
      { depth: 6.0, N: 6 }, { depth: 7.5, N: 5 },
      { depth: 9.0, N: 22, note: 'Sampler struck a cobble; gravel only — not representative of the clay.' },
      { depth: 10.5, N: 8 }, { depth: 12.0, N: 100, refusal: true }, { depth: 13.5, N: 100, refusal: true },
    ],
    layers: [
      // ASSUMED: fill γsat 18.5 (not given), φ 28°, E 8 MPa — fill is excavated within Df = 1.5 m anyway.
      { top: 0, bottom: 0.6, symbol: 'FILL', description: 'Fill: brown silty sand, gravel, brick bats, roots', behaviour: 'fill', gammaMoist: 16.5, gammaSat: 18.5, c: 0, phi: 28, E: 8000 },
      { top: 0.6, bottom: 3.4, symbol: 'SM', description: 'Medium dense brown silty fine–medium SAND', behaviour: 'granular', gammaMoist: 18.0, gammaSat: 20.0, c: C_SAND, phi: smSoaked.phi, E: E_from_N(14.5), dilatancy: true, fines: 20 },
      { top: 3.4, bottom: 5.8, symbol: 'SP', description: 'Medium dense–dense grey SAND with gravel', behaviour: 'granular', gammaMoist: 19.0, gammaSat: 20.4, c: C_SAND, phi: spSoaked.phi, E: E_from_N(24), fines: 4 },
      { top: 5.8, bottom: 10.6, symbol: 'CI', description: 'Soft to firm grey silty CLAY (CI)', behaviour: 'cohesive', gammaSat: 18.6, cu: cu1, Cc: oed.Cc, Cr: oed.Cr, e0: lab.oedometerUDS1.e0, sigmaP: oed.sigmaP, cv: cvClay, PI: 21 },
      // ASSUMED: φ 40°, E 60 MPa for very dense gravel (N > 100).
      { top: 10.6, bottom: 15.0, symbol: 'GW', description: 'Very dense sandy GRAVEL, cobbles, boulders', behaviour: 'granular', gammaSat: 21.5, c: 0, phi: 40, E: 60000 },
    ],
  },
  {
    id: 'BH-2', groundRL: 100.2, measuredWT: 3.2, designWT: 1.7, lowestWT: 4.2, x: 0, y: 0,
    spt: [
      { depth: 1.5, N: 14 }, { depth: 3.0, N: 17 }, { depth: 4.5, N: 26 }, { depth: 6.0, N: 31 },
      { depth: 7.5, N: 34 }, { depth: 9.0, N: 9 }, { depth: 10.5, N: 100, refusal: true }, { depth: 12.0, N: 100, refusal: true },
    ],
    layers: [
      { top: 0, bottom: 0.5, symbol: 'FILL', behaviour: 'fill', gammaMoist: 16.5, gammaSat: 18.5, c: 0, phi: 28, E: 8000 },
      { top: 0.5, bottom: 3.8, symbol: 'SM', behaviour: 'granular', gammaMoist: 18.2, gammaSat: 20.0, c: C_SAND, phi: smSoaked.phi, E: E_from_N(15.5), dilatancy: true, fines: 16 },
      // ASSUMED: SP strength from BH-1 SPT-3 shear test (same description).
      { top: 3.8, bottom: 7.6, symbol: 'SP', behaviour: 'granular', gammaMoist: 19.3, gammaSat: 20.6, c: C_SAND, phi: spSoaked.phi, E: E_from_N(30), fines: 3 },
      // Cc from LL (no oedometer on BH-2 clay); cu ASSUMED = BH-1 UDS-2 (firm clay at similar depth); NC (σ′p not measured).
      { top: 7.6, bottom: 9.6, symbol: 'CI', behaviour: 'cohesive', gammaSat: 18.7, cu: cu2, Cc: ccFromLL(42), Cr: oed.Cr, e0: e0FromW(33, 2.70), cv: cvClay, PI: 20 },
      { top: 9.6, bottom: 15.0, symbol: 'GW', behaviour: 'granular', gammaSat: 21.5, c: 0, phi: 40, E: 60000 },
    ],
  },
  {
    id: 'BH-3', groundRL: 99.7, measuredWT: 1.9, designWT: 0.6, lowestWT: 3.0, x: 30, y: 15,
    spt: [
      { depth: 1.5, N: 6 }, { depth: 3.0, N: 14 }, { depth: 4.5, N: 4 }, { depth: 6.0, N: 4 }, { depth: 7.5, N: 5 },
      { depth: 9.0, N: 6 }, { depth: 10.5, N: 8 }, { depth: 12.0, N: 100, refusal: true }, { depth: 13.5, N: 100, refusal: true },
    ],
    layers: [
      // ASSUMED: γsat 18.0 for fill with organic matter.
      { top: 0, bottom: 0.9, symbol: 'FILL', behaviour: 'fill', gammaMoist: 16.0, gammaSat: 18.0, c: 0, phi: 26, E: 6000 },
      // ASSUMED: loose SM, φ 28° (lab φ′ 30° is on remoulded medium-dense SM; N = 6 is loose).
      { top: 0.9, bottom: 2.6, symbol: 'SM', behaviour: 'granular', gammaMoist: 17.5, gammaSat: 19.5, c: 0, phi: 28, E: E_from_N(6), dilatancy: true, fines: 24 },
      { top: 2.6, bottom: 4.4, symbol: 'SP', behaviour: 'granular', gammaMoist: 18.6, gammaSat: 20.0, c: 0, phi: 32, E: E_from_N(14), fines: 6 },
      // No consolidation test (UDS disturbed): Cc from LL (Skempton), e0 = wGs, cu ASSUMED = BH-1 UDS-1, NC.
      { top: 4.4, bottom: 11.2, symbol: 'CI', behaviour: 'cohesive', gammaSat: 18.5, cu: cu1, Cc: ccFromLL(45), Cr: oed.Cr, e0: e0FromW(35, 2.70), cv: cvClay, PI: 22 },
      { top: 11.2, bottom: 15.0, symbol: 'GW', behaviour: 'granular', gammaSat: 21.5, c: 0, phi: 40, E: 60000 },
    ],
  },
];

/* ---------- Building: 30 m × 15 m, 5 m grid, lines 1–7 (x, west→east) and A–D (y) ---------- */
export const GROUP_NUMBER = 8;
export const lambda = loadFactor(GROUP_NUMBER);
const base = { corner: 650, edge: 1000, interior: 1450 }; // kN, unfactored service loads (brief)
const corners = ['A1', 'A7', 'D1', 'D7'];
const edges = ['A2', 'A3', 'A4', 'A5', 'A6', 'D2', 'D3', 'D4', 'D5', 'D6', 'B1', 'C1', 'B7', 'C7'];
const interiors = ['B2', 'B3', 'B4', 'B5', 'B6', 'C2', 'C3', 'C5', 'C6'];
const zone = (line: number) => (line <= 2 ? 'BH-2' : line <= 5 ? 'BH-1' : 'BH-3'); // brief's zoning

export const columns: ColumnInput[] = [];
for (const row of ['A', 'B', 'C', 'D']) {
  for (let line = 1; line <= 7; line++) {
    const id = `${row}${line}`;
    const x = (line - 1) * 5, y = 'ABCD'.indexOf(row) * 5;
    let P: number;
    let ML = 0;
    if (corners.includes(id)) P = base.corner;
    else if (edges.includes(id)) P = base.edge;
    else if (interiors.includes(id)) P = base.interior;
    else {
      // C4 — eccentric column, load not given in the brief.
      // ASSUMED: interior load 1450 kN with eccentricity 0.25 m (M = 362.5 kN·m); rectangular footing allowed.
      // The long side L is oriented parallel to the eccentricity (moment causes e along L), which loses less area
      // (2e·B instead of 2e·L). Replace P and M with the values assigned to the group.
      P = base.interior; ML = base.interior * 0.25;
    }
    columns.push({ id, x, y, load: { P: P * lambda, ML: ML * lambda }, boreholeId: zone(line), shape: id === 'C4' ? 'rectangle' : 'square' });
  }
}

/**
 * Settlement limits — CANDIDATE values for an RC framed building on isolated footings.
 * SOURCE: IS 1904:1986 Table 1 — values TO VERIFY against the code text; the team must cite the
 * clause and justify sand vs plastic-clay row. Not used anywhere unless passed in explicitly.
 */
export const limitsCandidate: Record<'sand' | 'clay', SettlementLimits> = {
  sand: { maxTotal: 50, maxDiffRatio: 0.0015, maxAngular: 1 / 666, source: 'IS 1904:1986 Table 1, isolated foundations, RC frame, sand/hard clay — TO VERIFY' },
  clay: { maxTotal: 75, maxDiffRatio: 0.0015, maxAngular: 1 / 666, source: 'IS 1904:1986 Table 1, isolated foundations, RC frame, plastic clay — TO VERIFY' },
};

export const DF = 1.5; // m, minimum founding depth (brief)

/**
 * Seismic input for the liquefaction check (IS 1893 (Part 1):2016). Zone V → Z = 0.36.
 * amax = Z/2 = 0.18 g (design basis earthquake) — ASSUMED, TO VERIFY against Annex F; the app also reports Z = 0.36 g.
 * Mw = 7.5 (MSF = 1) — ASSUMED for the Himalayan source; TO VERIFY.
 */
export const SEISMIC = { Z: 0.36, amax: 0.18, Mw: 7.5 };
