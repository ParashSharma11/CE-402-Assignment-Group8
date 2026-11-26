/**
 * Shared by the browser (to show "what was sent") and the server function (to send it).
 * The AI only summarises RESULTS; it does no calculations.
 */
import type { ProjectResults } from './results';

export const SYSTEM_PROMPT = `You write the summary section of a geotechnical foundation-design report produced by GeoFound.
You receive one JSON object, RESULTS, from the calculation engine. It is the only source of truth.

Rules:
1. Use only facts that appear in RESULTS. Do not add soil properties, loads, methods, code clauses or recommendations that are not in it.
2. Do no calculations. Do not compute, round, convert units or derive any value. Quote every number exactly as written in RESULTS, followed by its unit exactly as written (e.g. "214.6 kPa"). If a value is not in RESULTS, leave it out.
3. Pass or fail comes only from each check's "status" field. Never judge it yourself.
4. Flag every check with status "fail": give its name, value, limit and clause, in the order they appear in RESULTS. If none failed, write "All checks passed." Also list every "warn".
5. Cite code clauses only by copying the "clause" strings in RESULTS exactly.
6. If RESULTS has an "alternative" foundation, describe it in at most two sentences using only its fields.
7. Do not state that the design is approved. The engineer of record must check this summary.

Format: plain Markdown, no tables, at most 220 words.
**Outcome**: one sentence.
**Failed checks**: bullets, or "All checks passed."
**Key results**: 3–6 bullets, each "name: value unit (clause)".
**Governing assumptions**: up to 3 bullets copied from RESULTS.assumptions.`;

export interface SummaryPayload {
  project: { name: string; location: string; group: number; loadFactor: number; foundingDepth_m: number; FS: number };
  checks: { name: string; value: number; unit: string; limit: string; clause: string; status: string }[];
  footings: { zone: string; columns: number; passing: number; B_min_m: number; B_max_m: number; s_max_mm: number }[];
  alternative: { needed: boolean; zones: string[]; proposal: string };
  assumptions: { item: string; value: string; source: string }[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function buildPayload(res: ProjectResults, p: { name: string; location: string; group: number; Df: number; FS: number }): SummaryPayload {
  const zones = [...new Set(res.colResults.map((c) => c.col.boreholeId))];
  return {
    project: { name: p.name, location: p.location, group: p.group, loadFactor: r2(res.lambda), foundingDepth_m: p.Df, FS: p.FS },
    checks: res.checks.map((c) => ({ ...c, value: c.unit === '' ? c.value : r1(c.value) })),
    footings: zones.map((z) => {
      const cs = res.colResults.filter((c) => c.col.boreholeId === z && c.check);
      const Bs = cs.map((c) => c.check!.footing.B);
      return { zone: z, columns: cs.length, passing: cs.filter((c) => c.found).length, B_min_m: Bs.length ? r2(Math.min(...Bs)) : 0, B_max_m: Bs.length ? r2(Math.max(...Bs)) : 0, s_max_mm: cs.length ? r1(Math.max(...cs.map((c) => c.check!.sTotal * 1000))) : 0 };
    }),
    alternative: res.alternative,
    assumptions: res.assumptions.slice(0, 8).map((a) => ({ item: a.item, value: a.value, source: a.source })),
  };
}

/** Deterministic, AI-free summary built from the same payload (used as fallback and before the engineer ticks the box). */
export function templateSummary(d: SummaryPayload): string {
  const fails = d.checks.filter((c) => c.status === 'fail');
  const warns = d.checks.filter((c) => c.status === 'warn');
  const line = (c: SummaryPayload['checks'][number]) => `- ${c.name}: ${c.value} ${c.unit} (limit ${c.limit}; ${c.clause})`;
  return [
    `**Outcome**: ${fails.length ? `${fails.length} of ${d.checks.length} checks fail for ${d.project.name}.` : `All ${d.checks.length} checks pass for ${d.project.name}.`}`,
    '',
    '**Failed checks**:',
    ...(fails.length ? fails.map(line) : ['All checks passed.']),
    ...(warns.length ? ['', '**Warnings**:', ...warns.map(line)] : []),
    '',
    '**Key results**:',
    ...d.footings.map((f) => `- ${f.zone}: ${f.passing} of ${f.columns} footings pass, B ${f.B_min_m}–${f.B_max_m} m, max settlement ${f.s_max_mm} mm`),
    ...(d.alternative.needed ? ['', `**Alternative**: ${d.alternative.proposal}`] : []),
    '',
    '**Governing assumptions**:',
    ...d.assumptions.slice(0, 3).map((a) => `- ${a.item}: ${a.value} (${a.source})`),
  ].join('\n');
}

/** Numbers in `text` that do not appear anywhere in the payload (flagged "unverified"). */
export function unverifiedNumbers(text: string, d: SummaryPayload): Set<string> {
  const known = new Set((JSON.stringify(d).match(/-?\d+(?:\.\d+)?/g) ?? []).map((x) => String(Number(x))));
  const out = new Set<string>();
  for (const m of text.match(/-?\d+(?:\.\d+)?/g) ?? []) if (!known.has(String(Number(m)))) out.add(m);
  return out;
}
