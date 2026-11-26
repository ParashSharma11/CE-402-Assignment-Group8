import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, Chip, SectionHead, Tabs, TabPanel, Toggle } from '../components/ui';
import { CountUp } from '../components/motion';
import { FootingSection, PlanView } from '../components/viz';
import { useProject } from '../store/project';
import { useResults } from '../hooks/useResults';

const Frame3D = lazy(() => import('../components/Frame3D'));

export default function Design() {
  const res = useResults();
  const b = useProject((s) => s.building);
  const p = useProject((s) => s.project);
  const bhs = useProject((s) => s.boreholes);
  const [sel, setSel] = useState<string>();
  const [tab, setTab] = useState('isolated');
  const [soil, setSoil] = useState(true);
  const [bySet, setBySet] = useState(true);
  const [show3d, setShow3d] = useState(false);
  const cur = res.colResults.find((r) => r.col.id === sel) ?? res.colResults.find((r) => !r.found) ?? res.colResults[0];
  const bh = bhs.find((x) => x.id === cur?.col.boreholeId);
  const nOk = res.colResults.filter((r) => r.found).length;
  return (
    <Page>
      <Shell>
        <SectionHead k="05 · foundation design" title="Footings, sized and checked." sub={`Each footing is the smallest size (0.05 m steps) that passes bearing with FS ${p.FS} and total settlement ≤ ${p.limits.maxTotal} mm. Click a footing on the plan or in 3D.`}
          right={<Button to="/summary" label="Summary" icon={<Arrow />} />} />

        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Footings that pass', nOk, `of ${res.colResults.length}`, nOk === res.colResults.length ? 'pass' : 'fail'],
            ['Max settlement', res.building?.maxTotal ?? 0, 'mm', res.building?.passTotal ? 'pass' : 'fail'],
            ['Worst differential', res.building?.worstDiff?.delta ?? 0, 'mm', res.building?.passDiff ? 'pass' : 'fail'],
            ['Worst angular distortion', res.building?.worstAng ? 1 / Math.max(res.building.worstAng.angular, 1e-9) : 0, '1 / x', res.building?.passAngular ? 'pass' : 'fail']].map(([l, v, u, st]) => (
            <Card key={String(l)} className="p-5">
              <div className="mb-3 flex items-center justify-between"><span className="hud">{l}</span><Badge status={st as 'pass' | 'fail'} /></div>
              <CountUp value={v as number} dp={l === 'Footings that pass' || u === '1 / x' ? 0 : 1} className="font-giant text-[52px] leading-none" suffix={<span className="ml-2 font-mono text-[12px] text-muted">{u}</span>} />
            </Card>
          ))}
        </div>

        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'isolated', label: 'Isolated' }, { value: 'raft', label: 'Raft' }, { value: 'piles', label: 'Piles' }]}>
          <TabPanel value="isolated" className="mt-6">
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <Card interactive={false} className="p-4 sm:p-6">
                <div className="mb-2 flex items-center justify-between"><span className="hud">plan to scale · green = passes · red = fails</span><Chip>λ = {res.lambda.toFixed(2)}</Chip></div>
                <PlanView results={res.colResults} nLines={b.nLines} nRows={b.nRows} sx={b.sx} sy={b.sy} selected={cur?.col.id} onSelect={setSel} />
              </Card>
              {cur?.check && (
                <motion.div key={cur.col.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                  <Card className="h-full p-6">
                    <div className="mb-4 flex items-center justify-between"><span className="font-giant text-[48px] leading-none">{cur.col.id}</span><Badge status={cur.found ? 'pass' : 'fail'}>{cur.found ? 'passes' : 'fails'}</Badge></div>
                    <FootingSection B={cur.check.footing.B} Df={cur.check.footing.Df} zw={bh?.designWT ?? 99} label={cur.col.id} />
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                      {[['Borehole', cur.col.boreholeId], ['Load P (×λ)', `${cur.col.load.P.toFixed(0)} kN`], ['Size', `${cur.check.footing.B.toFixed(2)}${cur.check.footing.L ? ' × ' + cur.check.footing.L.toFixed(2) : ' × ' + cur.check.footing.B.toFixed(2)} m`],
                        ['qn applied', `${cur.check.qApplied.toFixed(1)} kPa`], ['qns', `${cur.check.bearing.qns.toFixed(1)} kPa`], ['Immediate si', `${(cur.check.sImmediate * 1000).toFixed(1)} mm`], ['Consolidation sc', `${(cur.check.sConsolidation * 1000).toFixed(1)} mm`], ['Total s', `${(cur.check.sTotal * 1000).toFixed(1)} mm`]].map(([k, v]) => (
                        <div key={k} className="rounded-xl border border-line-soft px-3 py-2"><dt className="hud">{k}</dt><dd className="num mt-0.5 text-ink">{v}</dd></div>
                      ))}
                    </dl>
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
                  <Frame3D results={res.colResults} boreholes={bhs} nLines={b.nLines} nRows={b.nRows} sx={b.sx} sy={b.sy} sLimit={p.limits.maxTotal} selected={cur?.col.id} onSelect={setSel} showSoil={soil} bySettlement={bySet} />
                </Suspense>
              ) : (
                <button onClick={() => setShow3d(true)} className="stripes grid h-[320px] w-full place-items-center rounded-[20px] border border-dashed border-line text-warm transition-colors hover:border-accent hover:text-ink">
                  <span className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.14em]">Load the 3D view <Arrow /></span>
                </button>
              )}
            </Card>
            <Card interactive={false} className="mt-4 overflow-x-auto p-6">
              <div className="hud mb-4">adjacent columns · differential settlement and angular distortion</div>
              <table className="w-full min-w-[620px] text-left text-[13px]">
                <thead><tr className="border-b border-line-soft">{['Pair', 'Span m', 'δ mm', 'β = δ/L', 'Differential', 'Angular'].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
                <tbody>{(res.building?.pairs ?? []).slice().sort((a, c) => c.angular - a.angular).slice(0, 12).map((q) => (
                  <tr key={q.a + q.b} className="border-b border-line-soft/40"><td className="num py-1.5">{q.a}–{q.b}</td><td className="num">{q.span.toFixed(1)}</td><td className="num">{q.delta.toFixed(1)}</td><td className="num">1/{q.angular > 0 ? Math.round(1 / q.angular) : '∞'}</td><td><Badge status={q.passDiff ? 'pass' : 'fail'} /></td><td><Badge status={q.passAngular ? 'pass' : 'fail'} /></td></tr>
                ))}</tbody>
              </table>
              <p className="mt-3 text-[12px] text-muted">Showing the 12 worst of {res.building?.pairs.length ?? 0} pairs. Limits: {p.limits.source}.</p>
            </Card>
          </TabPanel>
          <TabPanel value="raft" className="mt-6">
            <Card className="p-6">
              {res.raft ? (<div className="grid gap-4 sm:grid-cols-4">
                {[['On ground of', res.raft.bh, ''], ['Net pressure', res.raft.qn.toFixed(1), 'kPa'], ['qns (raft)', res.raft.qns.toFixed(1), 'kPa'], ['Settlement (centre)', res.raft.sCentre.toFixed(0), 'mm']].map(([k, v, u]) => <div key={k} className="rounded-2xl border border-line-soft bg-sunken/50 p-4"><div className="hud">{k}</div><div className="num mt-1 text-[24px]">{v} <span className="text-[12px] text-muted">{u}</span></div></div>)}
                <p className="text-warm sm:col-span-4">A raft over the full footprint on the weakest zone, checked with the same IS 6403 and settlement routines. Corner consolidation ≈ {res.raft.sCorner.toFixed(0)} mm.</p>
              </div>) : <p className="text-warm">All isolated footings pass — no raft check needed.</p>}
            </Card>
          </TabPanel>
          <TabPanel value="piles" className="mt-6">
            <Card className="p-6">
              <p className="max-w-3xl text-[17px] leading-relaxed text-ink">{res.alternative.proposal}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {bhs.map((h) => { const g = h.layers.find((l) => /^G/i.test(l.symbol) || l.behaviour === 'rock'); return (
                  <div key={h.id} className="rounded-2xl border border-line-soft bg-sunken/50 p-4"><div className="hud">{h.id}</div><div className="num mt-1 text-[20px]">{g ? `${g.top.toFixed(1)} m` : '—'}</div><div className="text-[12px] text-warm">to top of {g?.symbol ?? 'bearing stratum'}</div></div>
                ); })}
              </div>
              <p className="mt-4 text-[12px] text-muted">Pile capacity design is outside modules P1–P5; GeoFound reports the bearing stratum depth for the alternative proposal.</p>
            </Card>
          </TabPanel>
        </Tabs>
      </Shell>
    </Page>
  );
}
