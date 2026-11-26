import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as RCheckbox from '@radix-ui/react-checkbox';
import { Page, Shell } from '../components/layout';
import { Badge, Button, Card, Chip, SectionHead } from '../components/ui';
import { useProject } from '../store/project';
import { useResults } from '../hooks/useResults';
import { SYSTEM_PROMPT, buildPayload, templateSummary, unverifiedNumbers, type SummaryPayload } from '../lib/summaryPrompt';

/** Minimal Markdown (bold + bullets) with unverified numbers highlighted. */
function Md({ text, flag }: { text: string; flag: Set<string> }) {
  const inline = (s: string, k: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).flatMap((part, i) => {
    const bold = /^\*\*.*\*\*$/.test(part);
    const body = bold ? part.slice(2, -2) : part;
    const bits = body.split(/(-?\d+(?:\.\d+)?)/g).map((b, j) => (flag.has(b) ? <mark key={`${k}${i}${j}`} title="Not found in the results JSON" className="rounded bg-warn/20 px-0.5 text-warn">⚠ {b}</mark> : b));
    return bold ? [<strong key={k + i} className="text-ink">{bits}</strong>] : bits;
  });
  const lines = text.split('\n');
  return (
    <div className="grid gap-1.5 text-[15px] leading-relaxed text-warm">
      {lines.map((l, i) => l.startsWith('- ') ? <div key={i} className="flex gap-2 pl-1"><span className="text-accent">•</span><span>{inline(l.slice(2), 'l' + i)}</span></div> : l.trim() === '' ? <div key={i} className="h-2" /> : <p key={i}>{inline(l, 'p' + i)}</p>)}
    </div>
  );
}

export default function Summary() {
  const res = useResults();
  const project = useProject((s) => s.project);
  const payload: SummaryPayload = useMemo(() => buildPayload(res, project), [res, project]);
  const template = useMemo(() => templateSummary(payload), [payload]);
  const [text, setText] = useState('');
  const [model, setModel] = useState<string>('');
  const [state, setState] = useState<'idle' | 'streaming' | 'done' | 'fallback'>('idle');
  const [why, setWhy] = useState('');
  const [showSent, setShowSent] = useState(false);
  const [checked, setChecked] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setText(''); setChecked(false); setState('streaming'); setWhy('');
    try {
      const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal });
      if (!r.ok || !r.body || !(r.headers.get('content-type') ?? '').startsWith('text/plain')) {
        let msg = `HTTP ${r.status}`; try { msg = (await r.json()).error ?? msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      setModel(r.headers.get('X-Model') ?? 'gemini');
      const reader = r.body.getReader(); const dec = new TextDecoder(); let acc = '';
      for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); setText(acc); }
      if (!acc.trim()) throw new Error('Empty response');
      setState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setWhy((e as Error).message); setModel('template'); setState('fallback');
      // stream the template so the page behaves the same way
      let i = 0; const t = template;
      const tick = () => { i = Math.min(t.length, i + 6); setText(t.slice(0, i)); if (i < t.length && !ac.signal.aborted) requestAnimationFrame(tick); };
      tick();
    }
  }, [payload, template]);

  useEffect(() => { generate(); return () => abort.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flag = useMemo(() => (state === 'done' ? unverifiedNumbers(text, payload) : new Set<string>()), [text, payload, state]);
  const reportSummary = checked && state === 'done' ? text : template;

  const download = (name: string, data: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const csv = () => ['column,borehole,P_kN,foundation,B_m,L_m,piles,pile_length_m,qn_kPa,qns_kPa,s_mm', ...(res.final?.columns ?? []).map((c) => [c.col.id, c.col.boreholeId, c.col.load.P.toFixed(1), c.type, c.footprint.B.toFixed(2), c.footprint.L.toFixed(2), c.pile?.nPiles ?? '', c.pile ? c.pile.length.toFixed(2) : '', c.check ? c.check.qApplied.toFixed(1) : '', c.check ? c.check.bearing.qns.toFixed(1) : '', (c.s * 1000).toFixed(1)].join(','))].join('\n');

  return (
    <Page>
      <Shell>
        <SectionHead k="06 · summary" title="What the numbers say." sub="The AI only rewrites the computed results — it does no calculations. Numbers it quotes that are not in the results are flagged ⚠." />
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card interactive={false} className="no-print p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="hud">AI summary</span>
                <Chip tone={model === 'template' ? 'verify' : 'default'}>{state === 'streaming' && !model ? 'connecting…' : model || '—'}</Chip>
                {state === 'streaming' && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" label={showSent ? 'Hide what was sent' : 'Show what was sent to the AI'} onClick={() => setShowSent((v) => !v)} />
                <Button size="sm" label="Regenerate" onClick={generate} />
              </div>
            </div>
            {state === 'fallback' && <p className="mb-4 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-[13px] text-warn">AI unavailable ({why}). Showing the deterministic template summary built from the same results.</p>}
            <div className="min-h-[220px]"><Md text={text} flag={flag} />{state === 'streaming' && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-accent align-middle" />}</div>
            {flag.size > 0 && <p className="mt-4 text-[12px] text-warn">⚠ {flag.size} number(s) were not found in the results JSON — check before use (record in the AI audit).</p>}
            <AnimatePresence>
              {showSent && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-6 grid gap-3">
                    <div className="hud">system prompt</div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line-soft bg-sunken p-4 font-mono text-[11px] text-warm">{SYSTEM_PROMPT}</pre>
                    <div className="hud">RESULTS JSON</div>
                    <pre className="max-h-80 overflow-auto rounded-xl border border-line-soft bg-sunken p-4 font-mono text-[11px] text-warm">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-line-soft bg-sunken/60 p-4">
              <RCheckbox.Root checked={checked} disabled={state !== 'done'} onCheckedChange={(v) => setChecked(v === true)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-ground transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-40">
                <RCheckbox.Indicator className="text-ground">✓</RCheckbox.Indicator>
              </RCheckbox.Root>
              <span className="text-[14px] text-ink">Engineer checked this <span className="text-warm">— required before the AI text goes into the PDF. Until then the PDF uses the template summary.</span></span>
            </label>
          </Card>

          <div className="no-print grid content-start gap-4">
            <Card className="p-6">
              <div className="hud mb-4">checks against code limits</div>
              <ul className="grid gap-3">
                {res.checks.map((c) => (
                  <li key={c.name} className="flex items-start justify-between gap-3 border-b border-line-soft pb-3 last:border-0">
                    <div><div className="text-[14px] text-ink">{c.name}</div><div className="num text-[12px] text-muted">{c.value} {c.unit} · {c.limit}</div><div className="mt-1"><Chip tone={/TO VERIFY/.test(c.clause) ? 'verify' : 'default'}>{c.clause}</Chip></div></div>
                    <Badge status={c.status} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="no-print p-6">
              <div className="hud mb-4">downloads</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" label="Print / save PDF" onClick={() => window.print()} />
                <Button size="sm" variant="secondary" label="Results JSON" onClick={() => download('geofound-results.json', JSON.stringify(payload, null, 2), 'application/json')} />
                <Button size="sm" variant="secondary" label="Footings CSV" onClick={() => download('geofound-footings.csv', csv(), 'text/csv')} />
              </div>
              <p className="mt-3 text-[12px] text-muted">PDF summary source: {checked && state === 'done' ? 'AI text (engineer-checked)' : 'template (AI text not yet checked)'}.</p>
            </Card>
          </div>
        </div>

        <Card interactive={false} className="no-print mt-4 overflow-x-auto p-6">
          <div className="hud mb-4">assumptions · reason · source</div>
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead><tr className="border-b border-line-soft">{['Item', 'Value', 'Reason', 'Source / clause'].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
            <tbody>{res.assumptions.map((a) => <tr key={a.item} className="border-b border-line-soft/40 align-top"><td className="py-2 pr-4 text-ink">{a.item}</td><td className="num pr-4 text-accent">{a.value}</td><td className="pr-4 text-warm">{a.reason}</td><td><Chip tone={/TO VERIFY/.test(a.source) ? 'verify' : 'default'}>{a.source}</Chip></td></tr>)}</tbody>
          </table>
        </Card>

        {/* Print-only report */}
        <section className="print-only" style={{ fontFamily: 'Satoshi, sans-serif', color: '#111' }}>
          <h1 style={{ fontSize: 22 }}>GeoFound — foundation design summary</h1>
          <p>{project.name} · {project.location} · group {project.group} (λ = {res.lambda.toFixed(2)})</p>
          <h2>Summary {checked && state === 'done' ? `(AI: ${model}, engineer-checked)` : '(template)'}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{reportSummary}</pre>
          <h2>Checks</h2>
          <ul>{res.checks.map((c) => <li key={c.name}>{c.name}: {c.value} {c.unit} — {c.limit} — {c.clause} — {c.status.toUpperCase()}</li>)}</ul>
          <h2>Assumptions</h2>
          <ul>{res.assumptions.map((a) => <li key={a.item}>{a.item}: {a.value} — {a.reason} ({a.source})</li>)}</ul>
        </section>
      </Shell>
    </Page>
  );
}
