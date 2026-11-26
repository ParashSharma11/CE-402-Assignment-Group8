import { useMemo, useState } from 'react';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, SectionHead, SliderField, Tabs, TabPanel } from '../components/ui';
import { DepthChart, PressureBulb, SectionView, SoilColumn } from '../components/viz';
import { useProject } from '../store/project';
import { useResults } from '../hooks/useResults';
import { deltaSigmaProfile } from '../engine';

export default function Ground() {
  const bhs = useProject((s) => s.boreholes);
  const Df = useProject((s) => s.project.Df);
  const res = useResults();
  const [sel, setSel] = useState(bhs[0]?.id ?? '');
  const bh = bhs.find((b) => b.id === sel) ?? bhs[0];
  const [wt, setWt] = useState<'design' | 'measured'>('design');
  const [B, setB] = useState(3); const [q, setQ] = useState(120);
  const prof = res.perBH[bh?.id ?? '']?.[wt === 'design' ? 'stressDesign' : 'stressMeasured'] ?? [];
  const ds = useMemo(() => deltaSigmaProfile(q, B, B, 4 * B, B / 20), [q, B]);
  if (!bh) return <Page><Shell><p>No boreholes yet.</p><Button to="/data" label="Enter data" /></Shell></Page>;
  return (
    <Page>
      <Shell>
        <SectionHead k="03 · ground model" title="The ground, drawn from your boreholes." sub="Strata are correlated across boreholes west → east. Water tables: dashed = design (seasonal high), dotted = measured 24 h after boring." right={<Button to="/calculations" label="Calculations" icon={<Arrow />} />} />
        <Card interactive={false} className="mb-4 p-4 sm:p-6"><SectionView boreholes={bhs} /></Card>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {bhs.map((b) => <button key={b.id} onClick={() => setSel(b.id)} className={`rounded-full border px-4 py-2 font-mono text-[12px] transition-colors ${b.id === bh.id ? 'border-accent bg-accent/15 text-ink' : 'border-line-soft text-muted hover:border-line hover:text-ink'}`}>{b.id}</button>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="p-5"><div className="hud mb-2">log · {bh.id}</div><SoilColumn bh={bh} Df={Df} /></Card>
          <Card className="p-5">
            <Tabs value={wt} onChange={(v) => setWt(v as 'design' | 'measured')} tabs={[{ value: 'design', label: `Design WT ${bh.designWT} m` }, { value: 'measured', label: `Measured WT ${bh.measuredWT} m` }]}>
              <TabPanel value={wt} className="mt-4">
                <DepthChart xLabel="Stress, kPa" series={[
                  { name: 'σv total', color: '#F4E8DF', pts: prof.map((p) => ({ x: p.sigmaV, z: p.z })) },
                  { name: 'u pore pressure', color: '#6CC4D6', pts: prof.map((p) => ({ x: p.u, z: p.z })), dash: '6 4' },
                  { name: "σ′v effective", color: '#FF4A1C', pts: prof.map((p) => ({ x: p.sigmaVEff, z: p.z })) },
                ]} markers={[{ z: wt === 'design' ? bh.designWT : bh.measuredWT, label: '▽ WT', color: '#6CC4D6' }, { z: Df, label: 'Df', color: '#FF4A1C' }]} />
              </TabPanel>
            </Tabs>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between"><span className="hud">pressure bulb · Boussinesq</span><Badge status="info">square footing</Badge></div>
            <div className="mb-6 grid gap-5 sm:grid-cols-2">
              <SliderField label="Footing width B" unit="m" value={B} min={1} max={6} step={0.05} onChange={setB} />
              <SliderField label="Net pressure q" unit="kPa" value={q} min={20} max={400} step={5} onChange={setQ} dp={0} />
            </div>
            <PressureBulb B={B} L={B} q={q} />
          </Card>
          <Card className="p-6">
            <div className="hud mb-4">Δσz below the footing — centre, corner, 2:1</div>
            <DepthChart xLabel="Δσz, kPa" zLabel="Depth below base, m" series={[
              { name: 'Centre (Boussinesq)', color: '#FF4A1C', pts: ds.map((p) => ({ x: p.centre, z: p.z })) },
              { name: 'Corner (Boussinesq)', color: '#E9C2B8', pts: ds.map((p) => ({ x: p.corner, z: p.z })), dash: '6 4' },
              { name: '2:1 method', color: '#6CC4D6', pts: ds.map((p) => ({ x: p.twoToOne, z: p.z })), dash: '2 4' },
            ]} />
          </Card>
        </div>

        <Card interactive={false} className="mt-4 overflow-x-auto p-6">
          <div className="hud mb-4">SPT corrections · IS 2131 · {bh.id} · design WT</div>
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead><tr className="border-b border-line-soft">{['Depth m', 'N', "σ′v kPa", 'CN', "N′ = CN·N", "N″ (dilatancy)", ''].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
            <tbody>{(res.perBH[bh.id]?.spt ?? []).map((s) => (
              <tr key={s.depth} className="border-b border-line-soft/50">
                <td className="num py-2">{s.depth.toFixed(2)}</td><td className="num">{s.refusal ? '>100' : s.N}</td><td className="num">{s.sigmaVEff.toFixed(1)}</td><td className="num">{s.CN.toFixed(3)}</td>
                <td className="num">{s.refusal ? '—' : s.N1.toFixed(1)}</td><td className="num">{s.refusal ? '—' : s.Ncorr.toFixed(1)}</td>
                <td>{s.refusal ? <Badge status="info">refusal</Badge> : s.dilatancyApplied ? <Badge status="warn">dilatancy</Badge> : null}</td>
              </tr>))}</tbody>
          </table>
        </Card>
      </Shell>
    </Page>
  );
}
