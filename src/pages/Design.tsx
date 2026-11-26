import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, Chip, SectionHead, StepCard, Tabs, TabPanel, Toggle } from '../components/ui';
import { CountUp } from '../components/motion';
import { FinalPlan, FootingSection, PlanView } from '../components/viz';
import { useProject } from '../store/project';
import { useResults } from '../hooks/useResults';

const Frame3D = lazy(() => import('../components/Frame3D'));

export default function Design() {
  const res = useResults();
  const b = useProject((s) => s.building);
  const p = useProject((s) => s.project);
  const bhs = useProject((s) => s.boreholes);
  const fd = res.final;
  const [sel, setSel] = useState<string>();
  const [tab, setTab] = useState('final');
  const [soil, setSoil] = useState(true);
  const [bySet, setBySet] = useState(true);
  const [show3d, setShow3d] = useState(false);
  if (!fd) return <Page><Shell><SectionHead k="05 · foundation design" title="Design could not be completed." sub={res.errors[0] ?? 'Check the inputs on the Data page.'} right={<Button to="/data" label="Enter data" />} /></Shell></Page>;

  const cur = fd.columns.find((c) => c.col.id === sel) ?? fd.columns.find((c) => c.type === 'piles') ?? fd.columns[0];
  const bh = bhs.find((x) => x.id === cur?.col.boreholeId);
  const checked = fd.pairs.filter((q) => !q.separated);
  const wd = checked.reduce((m, q) => (q.delta > m.delta ? q : m), checked[0] ?? { delta: 0, a: '', b: '', angular: 0, span: 1, separated: false, passDiff: true, passAngular: true });
  const wa = checked.reduce((m, q) => (q.angular > m.angular ? q : m), wd);
  const nPass = res.checks.filter((c) => c.status !== 'fail').length;
  const allOk = res.checks.every((c) => c.status !== 'fail');
  const pileCol = fd.columns.find((c) => c.type === 'piles' && c.col.id === cur?.col.id) ?? fd.columns.find((c) => c.type === 'piles');

  return (
    <Page>
      <Shell>
        <SectionHead k="05 · foundation design" title={allOk ? 'A foundation that works.' : 'Footings, sized and checked.'}
          sub={`Isolated footings are proportioned for equal settlement wherever they can work; where they cannot (bearing or ${p.limits.maxTotal} mm settlement within the grid), the zone gets bored piles to the bearing stratum. Every check below is on this final design.`}
          right={<Button to="/summary" label="Summary" icon={<Arrow />} />} />

        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Checks passing', nPass, `of ${res.checks.length}`, allOk ? 'pass' : 'fail', 0],
            ['Max settlement', fd.maxTotal, `mm · limit ${p.limits.maxTotal}`, fd.passTotal ? 'pass' : 'fail', 1],
            ['Worst differential', wd.delta, `mm · ${wd.a}–${wd.b}`, fd.passDiff ? 'pass' : 'fail', 2],
            ['Worst angular distortion', wa.angular > 0 ? 1 / wa.angular : 0, `1 / x · limit 1/${Math.round(1 / p.limits.maxAngular)}`, fd.passAngular ? 'pass' : 'fail', 0]].map(([l, v, u, st, dp]) => (
            <Card key={String(l)} className="p-5">
              <div className="mb-3 flex items-center justify-between"><span className="hud">{l}</span><Badge status={st as 'pass' | 'fail'} /></div>
              <CountUp value={v as number} dp={dp as number} className="font-giant text-[52px] leading-none" suffix={<span className="ml-2 font-mono text-[11px] text-muted">{u}</span>} />
            </Card>
          ))}
        </div>

        <Card interactive={false} className="mb-6 p-6">
          <div className="hud mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" />design decision</div>
          <p className="max-w-4xl text-[16px] leading-relaxed text-ink">{res.alternative.proposal}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {fd.zones.map((z) => <Chip key={z.bh} tone={z.type === 'piles' ? 'verify' : 'default'}>{z.bh}: {z.type === 'piles' ? 'bored piles' : 'isolated footings'} — {z.reason}</Chip>)}
          </div>
          {fd.notes.map((n) => <p key={n} className="mt-3 text-[13px] text-warm">{n}</p>)}
        </Card>

        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'final', label: 'Final design' }, { value: 'piles', label: 'Pile design' }, { value: 'trial', label: 'Isolated trial' }, { value: 'raft', label: 'Raft check' }]}>
          <TabPanel value="final" className="mt-6">
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <Card interactive={false} className="p-4 sm:p-6">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="hud">plan to scale · colour = settlement vs limit · circles = piles</span><Chip>λ = {res.lambda.toFixed(2)}</Chip></div>
                <FinalPlan final={fd} nLines={b.nLines} nRows={b.nRows} sx={b.sx} sy={b.sy} sLimit={p.limits.maxTotal} pileD={p.pileD ?? 0.5} selected={cur?.col.id} onSelect={setSel} />
              </Card>
              {cur && (
                <motion.div key={cur.col.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                  <Card className="h-full p-6">
                    <div className="mb-4 flex items-center justify-between"><span className="font-giant text-[48px] leading-none">{cur.col.id}</span><Badge status="pass">{cur.type === 'piles' ? 'piles' : 'isolated'}</Badge></div>
                    {cur.type === 'isolated' && cur.check ? (<>
                      <FootingSection B={cur.footprint.B} Df={cur.check.footing.Df} zw={bh?.designWT ?? 99} label={cur.col.id} />
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                        {[['Borehole', cur.col.boreholeId], ['Load P (×λ)', `${cur.col.load.P.toFixed(0)} kN`], ['Size', `${cur.footprint.B.toFixed(2)} × ${cur.footprint.L.toFixed(2)} m`],
                          ['qn applied', `${cur.check.qApplied.toFixed(1)} kPa`], ['qns', `${cur.check.bearing.qns.toFixed(1)} kPa`], ['Immediate si', `${(cur.check.sImmediate * 1000).toFixed(1)} mm`], ['Consolidation sc', `${(cur.check.sConsolidation * 1000).toFixed(1)} mm`], ['Total s', `${(cur.s * 1000).toFixed(1)} mm`]].map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-line-soft px-3 py-2"><dt className="hud">{k}</dt><dd className="num mt-0.5 text-ink">{v}</dd></div>))}
                      </dl>
                    </>) : cur.pile ? (
                      <dl className="grid grid-cols-2 gap-3 text-[13px]">
                        {[['Borehole', cur.col.boreholeId], ['Load P (×λ)', `${cur.col.load.P.toFixed(0)} kN`], ['Piles', `${cur.pile.nPiles} × Ø${(p.pileD ?? 0.5).toFixed(2)} m`], ['Length', `${cur.pile.length.toFixed(2)} m (toe ${cur.pile.toe.toFixed(2)} m)`],
                          ['Bearing stratum', cur.pile.bearingLayer], ['Q_safe per pile', `${cur.pile.Qsafe.toFixed(0)} kN`], ['Group capacity', `${(cur.pile.nPiles * cur.pile.Qsafe).toFixed(0)} kN`], ['Cap', `${cur.pile.capB.toFixed(2)} × ${cur.pile.capB.toFixed(2)} m`], ['Settlement', `${(cur.s * 1000).toFixed(1)} mm`]].map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-line-soft px-3 py-2"><dt className="hud">{k}</dt><dd className="num mt-0.5 text-ink">{v}</dd></div>))}
                      </dl>
                    ) : null}
                  </Card>
                </motion.div>
              )}
            </div>
            <Card interactive={false} className="mt-4 p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <span className="hud">3D frame · drag to orbit · click a footing</span>
                <div className="flex flex-wrap gap-5"><Toggle label="Show soil layers" checked={soil} onChange={setSoil} /><Toggle label="Colour by settlement" checked={bySet} onChange={setBySet} /></div>
              </div>
              {show3d ? (
                <Suspense fallback={<div className="hud grid h-[520px] place-items-center">loading 3D…</div>}>
                  <Frame3D results={fd.columns} boreholes={bhs} nLines={b.nLines} nRows={b.nRows} sx={b.sx} sy={b.sy} sLimit={p.limits.maxTotal} Df={p.Df} pileD={p.pileD ?? 0.5} selected={cur?.col.id} onSelect={setSel} showSoil={soil} bySettlement={bySet} />
                </Suspense>
              ) : (
                <button onClick={() => setShow3d(true)} className="stripes grid h-[320px] w-full place-items-center rounded-[20px] border border-dashed border-line text-warm transition-colors hover:border-accent hover:text-ink">
                  <span className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.14em]">Load the 3D view <Arrow /></span>
                </button>
              )}
            </Card>
            <Card interactive={false} className="mt-4 overflow-x-auto p-6">
              <div className="hud mb-4">adjacent columns · differential settlement and angular distortion (final design)</div>
              <table className="w-full min-w-[620px] text-left text-[13px]">
                <thead><tr className="border-b border-line-soft">{['Pair', 'Span m', 'δ mm', 'β = δ/L', 'Differential', 'Angular'].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
                <tbody>{fd.pairs.slice().sort((x, y) => Number(x.separated) - Number(y.separated) || y.angular - x.angular).slice(0, 14).map((q) => (
                  <tr key={q.a + q.b} className="border-b border-line-soft/40"><td className="num py-1.5">{q.a}–{q.b}</td><td className="num">{q.span.toFixed(1)}</td><td className="num">{q.delta.toFixed(2)}</td><td className="num">1/{q.angular > 0 ? Math.round(1 / q.angular) : '∞'}</td>
                    {q.separated ? <td colSpan={2}><Badge status="info">across movement joint</Badge></td> : (<><td><Badge status={q.passDiff ? 'pass' : 'fail'} /></td><td><Badge status={q.passAngular ? 'pass' : 'fail'} /></td></>)}</tr>
                ))}</tbody>
              </table>
              <p className="mt-3 text-[12px] text-muted">The 14 most critical of {fd.pairs.length} pairs. Limits: {p.limits.source}.</p>
            </Card>
          </TabPanel>

          <TabPanel value="piles" className="mt-6">
            {pileCol?.pile ? (<>
              <p className="mb-4 max-w-3xl text-[15px] text-warm">Bored cast-in-situ piles for {pileCol.col.id} ({pileCol.col.boreholeId}): end bearing in the {pileCol.pile.bearingLayer} stratum plus shaft friction, FS 2.5, at least two piles per column.</p>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{pileCol.pile.steps.map((st, i) => <StepCard key={st.title + i} step={st} index={i} />)}</div>
            </>) : <Card className="p-6"><p className="text-warm">No piles are needed — isolated footings work everywhere.</p></Card>}
          </TabPanel>

          <TabPanel value="trial" className="mt-6">
            <Card interactive={false} className="p-4 sm:p-6">
              <p className="mb-4 max-w-3xl text-[14px] text-warm">The first trial: every column on the <b className="text-ink">smallest</b> isolated footing that passes bearing and total settlement (up to 6 m). Red = no isolated footing works — that is why those zones are piled in the final design.</p>
              <PlanView results={res.colResults} nLines={b.nLines} nRows={b.nRows} sx={b.sx} sy={b.sy} selected={cur?.col.id} onSelect={setSel} />
            </Card>
          </TabPanel>

          <TabPanel value="raft" className="mt-6">
            <Card className="p-6">
              {res.raft ? (<div className="grid gap-4 sm:grid-cols-4">
                {[['On ground of', res.raft.bh, ''], ['Net pressure', res.raft.qn.toFixed(1), 'kPa'], ['qns (raft)', res.raft.qns.toFixed(1), 'kPa'], ['Settlement (centre)', res.raft.sCentre.toFixed(0), 'mm']].map(([k, v, u]) => <div key={k} className="rounded-2xl border border-line-soft bg-sunken/50 p-4"><div className="hud">{k}</div><div className="num mt-1 text-[24px]">{v} <span className="text-[12px] text-muted">{u}</span></div></div>)}
                <p className="text-warm sm:col-span-4">A raft over the whole footprint on the weakest ground, checked with the same IS 6403 and settlement routines — rejected when it settles more than the limit. Corner consolidation ≈ {res.raft.sCorner.toFixed(0)} mm.</p>
              </div>) : <p className="text-warm">All isolated footings pass in the first trial — no raft check needed.</p>}
            </Card>
          </TabPanel>
        </Tabs>
      </Shell>
    </Page>
  );
}
