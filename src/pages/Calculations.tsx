import { useMemo, useState } from 'react';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, Chip, Field, SectionHead, Select, SliderField, StepCard, Tabs, TabPanel } from '../components/ui';
import { CountUp } from '../components/motion';
import { PressureBulb, TimeChart } from '../components/viz';
import { useProject } from '../store/project';
import { useResults } from '../hooks/useResults';
import { checkFooting, consolidationSettlement, schmertmann, timeSettlement, type Drainage, type Footing, type Step } from '../engine';

function StepGrid({ steps }: { steps: Step[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{steps.map((s, i) => <StepCard key={s.title + i} step={s} index={i} />)}</div>;
}

function QuickCalc() {
  const q = useProject((s) => s.quick), set = useProject((s) => s.setQuick);
  const p = useProject((s) => s.project);
  const bhs = useProject((s) => s.boreholes);
  const bh = bhs.find((b) => b.id === q.bh) ?? bhs[0];
  const r = useMemo(() => {
    if (!bh) return null;
    const footing: Footing = { shape: q.shape, B: q.B, L: q.shape === 'rectangle' ? Math.max(q.L, q.B) : undefined, Df: q.Df };
    try { return checkFooting(footing, { P: q.P, MB: q.MB }, bh, { sAllow: p.limits.maxTotal, FS: p.FS, mode: p.mode, useDepthFactors: p.useDepthFactors, includeSelfWeight: p.includeSelfWeight, gammaFootingBackfill: p.gammaFB, tYears: p.tYears }); }
    catch (e) { return { error: (e as Error).message }; }
  }, [q, bh, p]);
  if (!bh) return null;
  const ok = r && !('error' in r);
  return (
    <Card interactive={false} className="overflow-hidden">
      <div className="grid lg:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-5 border-b border-line-soft p-6 lg:border-b-0 lg:border-r">
          <div className="hud flex items-center gap-2 text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />quick calculator · instant</div>
          <Tabs value={q.shape} onChange={(v) => set({ shape: v as Footing['shape'] })} tabs={[{ value: 'square', label: 'Square' }, { value: 'rectangle', label: 'Rect.' }, { value: 'circle', label: 'Circle' }, { value: 'strip', label: 'Strip' }]}><span /></Tabs>
          <Select label="Borehole" value={bh.id} onChange={(v) => set({ bh: v })} options={bhs.map((b) => ({ value: b.id, label: b.id }))} />
          <SliderField label="Width B" unit="m" value={q.B} min={0.6} max={6} step={0.05} onChange={(v) => set({ B: v })} />
          {q.shape === 'rectangle' && <SliderField label="Length L" unit="m" value={Math.max(q.L, q.B)} min={q.B} max={12} step={0.05} onChange={(v) => set({ L: v })} />}
          <SliderField label="Founding depth Df" unit="m" value={q.Df} min={0.5} max={4} step={0.05} onChange={(v) => set({ Df: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={q.shape === 'strip' ? 'Load P' : 'Load P'} unit={q.shape === 'strip' ? 'kN/m' : 'kN'} value={q.P} onChange={(v) => set({ P: v ?? 0 })} />
            <Field label="Moment M" unit="kN·m" value={q.MB} onChange={(v) => set({ MB: v ?? 0 })} />
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {ok ? (<>
            <div className="grid gap-3 sm:grid-cols-4">
              {[['qnu net ultimate', r.bearing.qnu, 'kPa'], ['qns net safe', r.bearing.qns, 'kPa'], ['qn applied (net)', r.qApplied, 'kPa'], ['total settlement', r.sTotal * 1000, 'mm']].map(([l, v, u]) => (
                <div key={String(l)} className="rounded-2xl border border-line-soft bg-sunken/60 p-4">
                  <div className="hud mb-2">{l}</div>
                  <CountUp value={v as number} dp={1} className="text-[30px] font-semibold" suffix={<span className="ml-1 font-mono text-[12px] text-muted">{u}</span>} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge status={r.passBearing ? 'pass' : 'fail'}>bearing {r.passBearing ? 'ok' : 'fails'} · {(r.qApplied / r.bearing.qns * 100).toFixed(0)} %</Badge>
              <Badge status={r.passSettlement ? 'pass' : 'fail'}>settlement {r.passSettlement ? 'ok' : 'fails'} vs {p.limits.maxTotal} mm</Badge>
              <Chip>{r.bearing.analysis} · {r.bearing.modeUsed}</Chip>
              {r.bearing.eB > 0 && <Chip>B′ = {r.bearing.Beff.toFixed(2)} m (e = {r.bearing.eB.toFixed(3)} m)</Chip>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[['Nc', r.bearing.factors.Nc], ['Nq', r.bearing.factors.Nq], ['Nγ', r.bearing.factors.Ng], ['sc · sq · sγ', `${r.bearing.shape.sc.toFixed(2)} · ${r.bearing.shape.sq.toFixed(2)} · ${r.bearing.shape.sg.toFixed(2)}`], ['dc · dq', `${r.bearing.depth.dc.toFixed(3)} · ${r.bearing.depth.dq.toFixed(3)}`], ["W′", r.bearing.Wp]].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-line-soft px-3 py-2"><div className="hud">{k}</div><div className="num text-[15px]">{typeof v === 'number' ? v.toFixed(3) : v}</div></div>
              ))}
            </div>
            <div className="max-w-[460px]"><PressureBulb B={q.B} L={q.shape === 'rectangle' ? Math.max(q.L, q.B) : q.shape === 'strip' ? 100 : q.B} q={r.qApplied} /></div>
          </>) : <p className="text-fail">{r && 'error' in r ? r.error : '—'}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function Calculations() {
  const res = useResults();
  const bhs = useProject((s) => s.boreholes);
  const project = useProject((s) => s.project);
  const withCheck = res.colResults.filter((c) => c.check);
  const governing = withCheck.reduce<(typeof withCheck)[number] | undefined>((m, c) => (!m || c.check!.sTotal > m.check!.sTotal ? c : m), undefined);
  const [colId, setColId] = useState<string>();
  const col = withCheck.find((c) => c.col.id === colId) ?? governing;
  const [tab, setTab] = useState('p3');
  const [drain, setDrain] = useState<Drainage>('double');
  const bh = bhs.find((b) => b.id === col?.col.boreholeId);

  const detail = useMemo(() => {
    if (!col?.check || !bh) return null;
    const f = col.check.footing;
    const sch = schmertmann({ footing: f, layers: bh.layers, zw: bh.designWT, netPressure: col.check.qApplied, tYears: project.tYears });
    const con = consolidationSettlement({ footing: f, layers: bh.layers, zw: bh.designWT, netPressure: col.check.qApplied });
    const clay = bh.layers.find((l) => l.behaviour === 'cohesive' && l.cv);
    const H = clay ? clay.bottom - Math.max(clay.top, f.Df) : 0;
    const ts = clay && H > 0 && con.settlement > 0 ? timeSettlement(con.settlement * 1000, clay.cv!, H, drain, 30) : null;
    return { sch, con, ts, clay };
  }, [col, bh, project.tYears, drain]);

  return (
    <Page>
      <Shell>
        <SectionHead k="04 · calculations" title="Every step, every number, every clause." sub="Pick a column; each card shows the equation, the numbers substituted, the result with its unit and its source. Amber chips are clauses still to verify against the code text."
          right={<Button to="/design" label="Foundation design" icon={<Arrow />} />} />
        <div className="mb-10"><QuickCalc /></div>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-end gap-4">
              <Select label="Column" value={col?.col.id ?? ''} onChange={setColId} options={withCheck.map((c) => ({ value: c.col.id, label: `${c.col.id} · ${c.col.boreholeId} · ${c.col.load.P.toFixed(0)} kN${c === governing ? ' (governing s)' : ''}` }))} className="w-80" />
              {col?.check && <Badge status={col.found ? 'pass' : 'fail'}>{col.found ? `B = ${col.check.footing.B.toFixed(2)} m works` : 'no isolated footing ≤ 6 m'}</Badge>}
            </div>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'p2', label: 'P2 Lab' }, { value: 'p3', label: 'P3 Bearing' }, { value: 'p5', label: 'P5 Settlement' }]}>
              <TabPanel value="p2" className="mt-6 grid gap-8">
                {res.lab.shear.map((s) => <div key={s.name}><h3 className="mb-3 font-display text-[20px] font-bold">Direct shear · {s.name}</h3><StepGrid steps={s.steps} /></div>)}
                {res.lab.oed && <div><h3 className="mb-3 font-display text-[20px] font-bold">Oedometer</h3><StepGrid steps={res.lab.oed.steps} /></div>}
                {!res.lab.shear.length && !res.lab.oed && <p className="text-warm">No lab data entered.</p>}
              </TabPanel>
              <TabPanel value="p3" className="mt-6">{col?.check && <StepGrid steps={[...col.check.bearing.steps, ...col.check.steps]} />}</TabPanel>
              <TabPanel value="p5" className="mt-6 grid gap-8">
                {detail && (<>
                  <div><h3 className="mb-3 font-display text-[20px] font-bold">Granular layers · Schmertmann (1978)</h3><StepGrid steps={detail.sch.steps} /></div>
                  <div><h3 className="mb-3 font-display text-[20px] font-bold">Clay · 1-D consolidation, sublayers ≤ 0.5 m</h3><StepGrid steps={detail.con.steps} />
                    {detail.con.rows.length > 0 && (
                      <Card interactive={false} className="mt-4 overflow-x-auto p-4">
                        <table className="w-full min-w-[720px] text-left text-[13px]">
                          <thead><tr className="border-b border-line-soft">{['z m', 'H m', "σ′0 kPa", 'Δσ kPa', "σ′p kPa", 'state', 's mm'].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
                          <tbody>{detail.con.rows.map((r) => <tr key={r.zMid} className="border-b border-line-soft/40"><td className="num py-1.5">{r.zTop.toFixed(2)}–{r.zBot.toFixed(2)}</td><td className="num">{r.H.toFixed(3)}</td><td className="num">{r.s0.toFixed(1)}</td><td className="num">{r.dsig.toFixed(1)}</td><td className="num">{r.sp.toFixed(1)}</td><td className="font-mono text-[11px] text-warm">{r.state}</td><td className="num">{(r.settlement * 1000).toFixed(2)}</td></tr>)}</tbody>
                        </table>
                      </Card>)}
                  </div>
                  {detail.ts && (
                    <Card className="p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="hud">time–settlement · {detail.clay?.symbol} · cv {detail.clay?.cv?.toFixed(2)} m²/yr</span>
                        <Tabs value={drain} onChange={(v) => setDrain(v as Drainage)} tabs={[{ value: 'double', label: 'Double drainage' }, { value: 'single', label: 'Single drainage' }]}><span /></Tabs></div>
                      <TimeChart pts={detail.ts.pts} final={detail.con.settlement * 1000} t90={detail.ts.t90} />
                      <div className="mt-4"><StepGrid steps={detail.ts.steps} /></div>
                    </Card>)}
                </>)}
              </TabPanel>
            </Tabs>
          </div>
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <Card interactive={false} className="p-5">
              <div className="hud mb-4">assumptions</div>
              <ul className="grid gap-4">
                {res.assumptions.map((a) => (
                  <li key={a.item} className="border-b border-line-soft pb-3 last:border-0">
                    <div className="text-[13px] font-semibold text-ink">{a.item}</div>
                    <div className="num mt-0.5 text-[12px] text-accent">{a.value}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-warm">{a.reason}</div>
                    <div className="mt-1.5"><Chip tone={/TO VERIFY/.test(a.source) ? 'verify' : 'default'}>{a.source}</Chip></div>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </Shell>
    </Page>
  );
}
