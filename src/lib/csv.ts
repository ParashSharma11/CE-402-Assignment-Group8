/**
 * Borehole data as one CSV file (opens in Excel / Google Sheets).
 * One row per record; the `record` column says what the row is:
 *   borehole — id, ground level and water tables (one row per borehole)
 *   layer    — one soil layer of that borehole (top/bottom depths and parameters)
 *   spt      — one SPT reading (depth, N; N ≥ 100 = refusal)
 * Units are in the column names. Empty cells = not given.
 */
import type { Borehole, SoilBehaviour, SoilLayer } from '../engine';

export const CSV_COLUMNS = [
  'record', 'borehole', 'ground_RL_m', 'measured_WT_m_bgl', 'design_WT_m_bgl', 'x_m', 'y_m',
  'top_m', 'bottom_m', 'symbol', 'behaviour', 'gamma_moist_kN_m3', 'gamma_sat_kN_m3', 'c_kPa', 'phi_deg', 'cu_kPa',
  'E_kPa', 'Cc', 'Cr', 'e0', 'sigma_p_kPa', 'cv_m2_per_yr', 'dilatancy', 'depth_m', 'N',
] as const;
type Col = (typeof CSV_COLUMNS)[number];

/** RFC 4180-style parser: quotes, escaped quotes, CRLF, BOM; auto-detects ',' or ';' (Excel in some locales). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const esc = (v: unknown) => { const s = v === undefined || v === null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Export boreholes to CSV (also used as the downloadable template). */
export function boreholesToCsv(bhs: Borehole[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  const row = (o: Partial<Record<Col, unknown>>) => CSV_COLUMNS.map((c) => esc(o[c])).join(',');
  for (const b of bhs) {
    lines.push(row({ record: 'borehole', borehole: b.id, ground_RL_m: b.groundRL, measured_WT_m_bgl: b.measuredWT, design_WT_m_bgl: b.designWT, x_m: b.x, y_m: b.y }));
    for (const l of [...b.layers].sort((a, c) => a.top - c.top)) {
      lines.push(row({ record: 'layer', borehole: b.id, top_m: l.top, bottom_m: l.bottom, symbol: l.symbol, behaviour: l.behaviour, gamma_moist_kN_m3: l.gammaMoist, gamma_sat_kN_m3: l.gammaSat, c_kPa: l.c, phi_deg: l.phi, cu_kPa: l.cu, E_kPa: l.E, Cc: l.Cc, Cr: l.Cr, e0: l.e0, sigma_p_kPa: l.sigmaP, cv_m2_per_yr: l.cv, dilatancy: l.dilatancy ? 'yes' : '' }));
    }
    for (const s of b.spt) lines.push(row({ record: 'spt', borehole: b.id, depth_m: s.depth, N: s.N }));
  }
  return lines.join('\r\n') + '\r\n';
}

const BEHAVIOURS: SoilBehaviour[] = ['granular', 'cohesive', 'fill', 'rock'];

/** Parse CSV text into boreholes. Returns row-numbered errors instead of throwing. */
export function csvToBoreholes(text: string): { boreholes: Borehole[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (!rows.length) return { boreholes: [], errors: ['The file is empty.'] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (c: Col) => header.indexOf(c.toLowerCase());
  for (const need of ['record', 'borehole'] as Col[]) if (idx(need) < 0) errors.push(`Missing column "${need}". Download the template to see the expected columns.`);
  if (errors.length) return { boreholes: [], errors };
  const map = new Map<string, Borehole>();
  const get = (id: string) => { let b = map.get(id); if (!b) { b = { id, groundRL: 100, measuredWT: 99, designWT: 99, layers: [], spt: [] }; map.set(id, b); } return b; };
  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    const cell = (c: Col) => { const i = idx(c); return i >= 0 ? (r[i] ?? '').trim() : ''; };
    const num = (c: Col, required = false): number | undefined => {
      const v = cell(c).replace(',', '.');
      if (v === '') { if (required) errors.push(`Row ${line}: "${c}" is required.`); return undefined; }
      const x = Number(v);
      if (!Number.isFinite(x)) { errors.push(`Row ${line}: "${c}" = "${cell(c)}" is not a number.`); return undefined; }
      return x;
    };
    const rec = cell('record').toLowerCase(), id = cell('borehole');
    if (!id) { errors.push(`Row ${line}: "borehole" is empty.`); return; }
    const b = get(id);
    if (rec === 'borehole') {
      b.groundRL = num('ground_RL_m') ?? b.groundRL;
      b.measuredWT = num('measured_WT_m_bgl', true) ?? b.measuredWT;
      b.designWT = num('design_WT_m_bgl', true) ?? b.designWT;
      b.x = num('x_m'); b.y = num('y_m');
    } else if (rec === 'layer') {
      const beh = (cell('behaviour').toLowerCase() || 'granular') as SoilBehaviour;
      if (!BEHAVIOURS.includes(beh)) errors.push(`Row ${line}: behaviour "${cell('behaviour')}" must be one of ${BEHAVIOURS.join(', ')}.`);
      const top = num('top_m', true), bottom = num('bottom_m', true), gs = num('gamma_sat_kN_m3', true);
      if (top === undefined || bottom === undefined || gs === undefined) return;
      const layer: SoilLayer = {
        top, bottom, symbol: (cell('symbol') || 'SOIL').toUpperCase(), behaviour: BEHAVIOURS.includes(beh) ? beh : 'granular',
        gammaMoist: num('gamma_moist_kN_m3'), gammaSat: gs, c: num('c_kPa'), phi: num('phi_deg'), cu: num('cu_kPa'), E: num('E_kPa'),
        Cc: num('Cc'), Cr: num('Cr'), e0: num('e0'), sigmaP: num('sigma_p_kPa'), cv: num('cv_m2_per_yr'),
        dilatancy: /^(y|yes|true|1)$/i.test(cell('dilatancy')),
      };
      b.layers.push(layer);
    } else if (rec === 'spt') {
      const d = num('depth_m', true), N = num('N', true);
      if (d !== undefined && N !== undefined) b.spt.push({ depth: d, N, refusal: N >= 100 });
    } else errors.push(`Row ${line}: record "${cell('record')}" must be borehole, layer or spt.`);
  });
  const boreholes = [...map.values()];
  for (const b of boreholes) {
    if (!b.layers.length) errors.push(`Borehole ${b.id}: no layer rows.`);
    if (b.designWT === 99) errors.push(`Borehole ${b.id}: no "borehole" row with the water tables.`);
    b.layers.sort((a, c) => a.top - c.top);
    b.spt.sort((a, c) => a.depth - c.depth);
  }
  return { boreholes, errors };
}
