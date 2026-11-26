/**
 * Module owner: Harshit Pandey.
 * Liquefaction potential from SPT — simplified procedure (Seed & Idriss 1971; Youd et al. 2001), as adopted in
 * IS 1893 (Part 1):2016 Annex F. SOURCE for every equation below: Youd et al. (2001) J. Geotech. Geoenviron. Eng.
 * 127(10) "NCEER/NSF workshop" (Eq. numbers in comments); IS 1893 (Part 1):2016 Annex F — TO VERIFY clause wording.
 *
 *   CSR   = 0.65 · (amax/g) · (σv/σ′v) · rd                         cyclic stress ratio (design WT = seasonal high)
 *   rd    = 1 − 0.00765 z            (z ≤ 9.15 m)
 *         = 1.174 − 0.0267 z         (9.15 < z ≤ 23 m)
 *   (N1)60 = N · CN · CE · CB · CR · CS, CN = (Pa/σ′v)^0.5 ≤ 1.7       σ′v at the time of the test (measured WT)
 *   (N1)60cs = α + β (N1)60, fines correction with FC in %
 *   CRR7.5 = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200, N = (N1)60cs < 30 (≥ 30: too dense to liquefy)
 *   MSF   = 10^2.24 / Mw^2.56;  FS = CRR7.5 · MSF / CSR   (Kσ = 1 for σ′v ≤ 100 kPa)
 *
 * Screening: soil above the design WT is not saturated → not liquefiable. Clays with PI ≥ 12 are not susceptible
 * (Bray & Sancio 2006). Refusal (N > 100) and gravel with cobbles are not liquefiable.
 */
import { effectiveStress, totalStress, layerAt } from './stress';
import { step, n, type Step } from './trace';
import type { Borehole } from './types';

export interface LiquefactionOptions {
  /** Peak horizontal ground acceleration as a fraction of g. Default Z/2 (design basis earthquake) — TO VERIFY. */
  amax: number;
  /** Design earthquake magnitude Mw. Default 7.5 (MSF = 1) — TO VERIFY. */
  Mw: number;
  /** Hammer energy correction CE = ER/60. Default 1.0 (ASSUMED 60 % energy ratio). */
  CE?: number;
  /** Borehole diameter correction CB (150 mm borehole → 1.05). */
  CB?: number;
}

export type LiqStatus = 'liquefiable' | 'marginal' | 'safe' | 'not-saturated' | 'not-susceptible' | 'too-dense';

export interface LiqRow {
  depth: number; symbol: string; N: number; status: LiqStatus; reason: string;
  sv?: number; svEff?: number; svEffTest?: number; CN?: number; CR?: number; N160?: number; FC?: number;
  N160cs?: number; rd?: number; CSR?: number; CRR?: number; MSF?: number; FS?: number;
  steps: Step[];
}

export interface LiqResult {
  rows: LiqRow[];
  minFS: number | null;
  /** Deepest bottom (m bgl) of a layer that contains a liquefiable reading, or 0. */
  liquefiableTo: number;
  liquefiableLayers: { symbol: string; top: number; bottom: number }[];
}

const SRC = 'Youd et al. (2001); IS 1893 (Part 1):2016 Annex F — TO VERIFY';

/** Seismic zones and zone factors Z. SOURCE: IS 1893 (Part 1):2016 Table 3. */
export const SEISMIC_ZONES = [
  { zone: 'II', Z: 0.10 },
  { zone: 'III', Z: 0.16 },
  { zone: 'IV', Z: 0.24 },
  { zone: 'V', Z: 0.36 },
] as const;

/** Zone name for a zone factor, or null if Z is not one of the Table 3 values (custom input). */
export const zoneOfZ = (Z: number): string | null => SEISMIC_ZONES.find((z) => Math.abs(z.Z - Z) < 1e-9)?.zone ?? null;
export const zoneLabel = (Z: number): string => { const z = zoneOf(Z); return z ? `seismic zone ${z}` : `Z = ${Z}`; };
const zoneOf = zoneOfZ;

/** Stress reduction coefficient rd. SOURCE: Youd et al. (2001) Eq. 2a, 2b (Liao & Whitman 1986). */
export const rdAt = (z: number): number => (z <= 9.15 ? 1 - 0.00765 * z : 1.174 - 0.0267 * z);

/** Rod-length correction CR. SOURCE: Youd et al. (2001) Table 2 (rod length taken = test depth, ASSUMED — conservative). */
export const rodCorrection = (rodLength: number): number =>
  rodLength < 3 ? 0.75 : rodLength < 4 ? 0.8 : rodLength < 6 ? 0.85 : rodLength < 10 ? 0.95 : 1.0;

/** Fines correction α, β. SOURCE: Youd et al. (2001) Eq. 6a–7c. */
export function finesCorrection(FC: number): { alpha: number; beta: number } {
  if (FC <= 5) return { alpha: 0, beta: 1 };
  if (FC >= 35) return { alpha: 5, beta: 1.2 };
  return { alpha: Math.exp(1.76 - 190 / (FC * FC)), beta: 0.99 + FC ** 1.5 / 1000 };
}

/** CRR for Mw 7.5. SOURCE: Youd et al. (2001) Eq. 4 (Rauch 1998). Returns Infinity for (N1)60cs ≥ 30. */
export const crr75 = (N: number): number => (N >= 30 ? Infinity : 1 / (34 - N) + N / 135 + 50 / (10 * N + 45) ** 2 - 1 / 200);

/** Magnitude scaling factor. SOURCE: Youd et al. (2001) Eq. 24 (Idriss). */
export const msf = (Mw: number): number => 10 ** 2.24 / Mw ** 2.56;

export function liquefaction(bh: Borehole, o: LiquefactionOptions): LiqResult {
  const CE = o.CE ?? 1.0, CB = o.CB ?? 1.05, CS = 1.0;
  const rows: LiqRow[] = bh.spt.map((r): LiqRow => {
    const layer = layerAt(bh.layers, r.depth);
    const base = { depth: r.depth, symbol: layer.symbol, N: r.N, steps: [] as Step[] };
    if (layer.behaviour === 'cohesive') {
      const ok = layer.PI !== undefined && layer.PI >= 12;
      return { ...base, status: 'not-susceptible', reason: ok ? `clay, PI = ${layer.PI} % ≥ 12 (Bray & Sancio 2006)` : 'clay — PI not given; screen with Bray & Sancio (2006)' };
    }
    if (r.depth <= bh.designWT) return { ...base, status: 'not-saturated', reason: `above the design WT (${bh.designWT} m)` };
    if (r.refusal || r.N >= 100 || layer.behaviour === 'rock') return { ...base, status: 'too-dense', reason: 'refusal / very dense gravel' };

    // Resistance side — stresses at the time of the test (measured WT).
    const svEffTest = effectiveStress(bh.layers, r.depth, bh.measuredWT);
    const CN = Math.min(1.7, Math.sqrt(100 / Math.max(svEffTest, 1))); // Pa = 100 kPa. SOURCE: Youd et al. (2001) Eq. 9
    const CR = rodCorrection(r.depth);
    const N160 = r.N * CN * CE * CB * CR * CS; // SOURCE: Youd et al. (2001) Eq. 8
    const FC = layer.fines ?? 5;
    const { alpha, beta } = finesCorrection(FC);
    const N160cs = alpha + beta * N160;
    const CRR = crr75(N160cs);
    // Demand side — design WT (seasonal high) at the time of the earthquake.
    const sv = totalStress(bh.layers, r.depth, bh.designWT);
    const svEff = effectiveStress(bh.layers, r.depth, bh.designWT);
    const rd = rdAt(r.depth);
    const CSR = 0.65 * o.amax * (sv / svEff) * rd; // SOURCE: Youd et al. (2001) Eq. 1 (Seed & Idriss 1971)
    const MSF = msf(o.Mw);
    const FS = (CRR * MSF) / CSR;
    const status: LiqStatus = !Number.isFinite(CRR) ? 'too-dense' : FS < 1 ? 'liquefiable' : FS < 1.2 ? 'marginal' : 'safe';
    const steps: Step[] = [
      step({ title: `σ′v at test time (WT ${n(bh.measuredWT, 2)} m)`, equation: 'σ′v = σv − u', substituted: `z = ${n(r.depth, 2)} m`, value: svEffTest, unit: 'kPa', source: 'Terzaghi effective stress' }),
      step({ title: '(N1)60', equation: '(N1)60 = N·CN·CE·CB·CR·CS, CN = (100/σ′v)^0.5 ≤ 1.7', substituted: `${r.N} × ${n(CN, 3)} × ${n(CE, 2)} × ${n(CB, 2)} × ${n(CR, 2)} × 1`, value: N160, unit: 'blows', source: SRC }),
      step({ title: `Fines correction (FC = ${FC} %)`, equation: '(N1)60cs = α + β·(N1)60', substituted: `${n(alpha, 3)} + ${n(beta, 3)} × ${n(N160, 2)}`, value: N160cs, unit: 'blows', source: SRC }),
      step({ title: 'CRR (Mw 7.5)', equation: 'CRR = 1/(34−N) + N/135 + 50/(10N+45)² − 1/200', substituted: `N = ${n(N160cs, 2)}`, value: Number.isFinite(CRR) ? CRR : 99, unit: '', source: SRC }),
      step({ title: `CSR (design WT ${n(bh.designWT, 2)} m)`, equation: 'CSR = 0.65·(amax/g)·(σv/σ′v)·rd', substituted: `0.65 × ${n(o.amax, 3)} × (${n(sv, 2)} / ${n(svEff, 2)}) × ${n(rd, 4)}`, value: CSR, unit: '', source: SRC }),
      step({ title: 'Factor of safety', equation: 'FS = CRR·MSF / CSR', substituted: `${n(CRR, 4)} × ${n(MSF, 3)} / ${n(CSR, 4)}`, value: FS, unit: '', source: SRC }),
    ];
    return { ...base, status, reason: status === 'liquefiable' ? 'FS < 1.0' : status === 'marginal' ? '1.0 ≤ FS < 1.2' : 'FS ≥ 1.2', sv, svEff, svEffTest, CN, CR, N160, FC, N160cs, rd, CSR, CRR, MSF, FS, steps };
  });
  const fs = rows.filter((r) => r.FS !== undefined && Number.isFinite(r.FS)).map((r) => r.FS!);
  const liqLayers = new Map<string, { symbol: string; top: number; bottom: number }>();
  for (const r of rows) if (r.status === 'liquefiable') { const l = layerAt(bh.layers, r.depth); liqLayers.set(`${l.top}`, { symbol: l.symbol, top: l.top, bottom: l.bottom }); }
  const list = [...liqLayers.values()].sort((a, b) => a.top - b.top);
  return { rows, minFS: fs.length ? Math.min(...fs) : null, liquefiableTo: list.length ? Math.max(...list.map((l) => l.bottom)) : 0, liquefiableLayers: list };
}
