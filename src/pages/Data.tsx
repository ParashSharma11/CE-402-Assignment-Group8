import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, Chip, Field, SectionHead, Select, Stepper, TextField, Toggle } from '../components/ui';
import { SoilColumn } from '../components/viz';
import { useProject, rowLabel } from '../store/project';
import { useResults } from '../hooks/useResults';
import { loadFactor, type SoilLayer, type SoilBehaviour, type ShearMode } from '../engine';

const STEPS = ['Project', 'Building & loads', 'Boreholes', 'Lab tests', 'Review'];

function Cell({ value, onChange, w = 'w-[72px]' }: { value: number | undefined; onChange: (v: number | undefined) => void; w?: string }) {
  const [d, setD] = useState<string | null>(null);
  return (
    <input type="number" step="any" value={d ?? (value === undefined ? '' : String(+value.toFixed(5)))}
      onChange={(e) => { setD(e.target.value); const v = e.target.value === '' ? undefined : Number(e.target.value); if (v === undefined || Number.isFinite(v)) onChange(v); }}
      onBlur={() => setD(null)}
      className={`num ${w} rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-ink outline-none transition-colors hover:border-line focus:border-accent/70 focus:bg-sunken`} />
  );
}

function ProjectStep() {
  const p = useProject((s) => s.project), set = useProject((s) => s.setProject);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <TextField label="Project name" value={p.name} onChange={(v) => set({ name: v })} className="sm:col-span-2" />
        <TextField label="Location" value={p.location} onChange={(v) => set({ location: v })} className="sm:col-span-2" />
        <Field label="Group number g" unit="–" value={p.group} onChange={(v) => set({ group: v ?? 0 })} step={1} hint={`Load factor λ = 1 + g/100 = ${loadFactor(p.group).toFixed(2)}`} />
        <Field label="Founding depth Df" unit="m" value={p.Df} onChange={(v) => set({ Df: v ?? 1.5 })} />
        <Field label="Factor of safety on qnu" unit="–" value={p.FS} onChange={(v) => set({ FS: v ?? 3 })} />
        <Select<ShearMode> label="Shear failure mode" value={p.mode} onChange={(v) => set({ mode: v })} options={[{ value: 'auto', label: 'Auto (IS 6403 interpolation)' }, { value: 'general', label: 'General shear' }, { value: 'local', label: 'Local shear' }]} />
        <Field label="Schmertmann time t" unit="yr" value={p.tYears} onChange={(v) => set({ tYears: v ?? 0.1 })} />
        <Field label="γ footing + backfill" unit="kN/m³" value={p.gammaFB} onChange={(v) => set({ gammaFB: v ?? 20 })} />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Toggle label="Use IS 6403 depth factors (backfill compacted)" checked={p.useDepthFactors} onChange={(v) => set({ useDepthFactors: v })} />
          <Toggle label="Include footing + backfill weight in net pressure" checked={p.includeSelfWeight} onChange={(v) => set({ includeSelfWeight: v })} />
        </div>
      </Card>
      <Card className="grid content-start gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><div className="hud mb-1">settlement limits — IS 1904:1986</div><p className="text-[13px] text-warm">The brief asks you to find, cite and justify these. Defaults are candidates only.</p></div>
        <Field label="Max total settlement" unit="mm" value={p.limits.maxTotal} onChange={(v) => set({ limits: { ...p.limits, maxTotal: v ?? 50 } })} />
        <Field label="Max differential / span" unit="× L" value={p.limits.maxDiffRatio} onChange={(v) => set({ limits: { ...p.limits, maxDiffRatio: v } })} />
        <Field label="Max angular distortion 1/x" unit="x" value={Math.round(1 / p.limits.maxAngular)} onChange={(v) => set({ limits: { ...p.limits, maxAngular: 1 / (v || 500) } })} />
        <TextField label="Clause adopted" value={p.limits.source} onChange={(v) => set({ limits: { ...p.limits, source: v } })} className="sm:col-span-2" />
      </Card>
    </div>
  );
}

function BuildingStep() {
  const b = useProject((s) => s.building), set = useProject((s) => s.setBuilding), setOv = useProject((s) => s.setOverride);
  const bhs = useProject((s) => s.boreholes);
  const [newId, setNewId] = useState('C4');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Grid lines along length (1…n)" unit="no." value={b.nLines} step={1} onChange={(v) => set({ nLines: Math.max(2, Math.round(v ?? 2)) })} />
        <Field label="Rows across width (A…)" unit="no." value={b.nRows} step={1} onChange={(v) => set({ nRows: Math.max(2, Math.round(v ?? 2)) })} />
        <Field label="Spacing along length" unit="m" value={b.sx} onChange={(v) => set({ sx: v ?? 5 })} />
        <Field label="Spacing across width" unit="m" value={b.sy} onChange={(v) => set({ sy: v ?? 5 })} />
        <Field label="Corner column load (service)" unit="kN" value={b.loads.corner} onChange={(v) => set({ loads: { ...b.loads, corner: v ?? 0 } })} />
        <Field label="Edge column load (service)" unit="kN" value={b.loads.edge} onChange={(v) => set({ loads: { ...b.loads, edge: v ?? 0 } })} />
        <Field label="Interior column load (service)" unit="kN" value={b.loads.interior} onChange={(v) => set({ loads: { ...b.loads, interior: v ?? 0 } })} />
        <p className="self-end text-[12px] text-muted">Loads are multiplied by λ automatically.</p>
      </Card>
      <div className="grid content-start gap-4">
        <Card className="p-6">
          <div className="hud mb-4">borehole zoning (grid lines)</div>
          {b.zoning.map((z, i) => (
            <div key={i} className="mb-3 grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-3">
              <Field label="From line" unit="" value={z.from} step={1} onChange={(v) => set({ zoning: b.zoning.map((q, j) => (j === i ? { ...q, from: v ?? 1 } : q)) })} />
              <Field label="To line" unit="" value={z.to} step={1} onChange={(v) => set({ zoning: b.zoning.map((q, j) => (j === i ? { ...q, to: v ?? 1 } : q)) })} />
              <Select label="Borehole" value={z.bh} onChange={(v) => set({ zoning: b.zoning.map((q, j) => (j === i ? { ...q, bh: v } : q)) })} options={bhs.map((h) => ({ value: h.id, label: h.id }))} />
              <Button size="sm" variant="ghost" label="✕" onClick={() => set({ zoning: b.zoning.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="sm" variant="secondary" label="Add zone" onClick={() => set({ zoning: [...b.zoning, { from: 1, to: b.nLines, bh: bhs[0]?.id ?? '' }] })} />
        </Card>
        <Card className="p-6">
          <div className="hud mb-4">special columns (eccentric / different load)</div>
          {Object.entries(b.overrides).map(([id, o]) => (
            <div key={id} className="mb-3 grid grid-cols-[60px_1fr_1fr_1fr_auto] items-end gap-3">
              <span className="num pb-3 text-ink">{id}</span>
              <Field label="P" unit="kN" value={o.P} onChange={(v) => setOv(id, { P: v })} />
              <Field label="M (along B)" unit="kN·m" value={o.MB} onChange={(v) => setOv(id, { MB: v })} />
              <Select label="Shape" value={o.shape ?? 'square'} onChange={(v) => setOv(id, { shape: v })} options={[{ value: 'square', label: 'Square' }, { value: 'rectangle', label: 'Rectangle' }, { value: 'circle', label: 'Circle' }]} />
              <Button size="sm" variant="ghost" label="✕" onClick={() => setOv(id, null)} />
            </div>
          ))}
          <div className="flex items-end gap-3">
            <Select label="Column" value={newId} onChange={setNewId} options={Array.from({ length: b.nRows * b.nLines }, (_, i) => `${rowLabel(Math.floor(i / b.nLines))}${(i % b.nLines) + 1}`).map((v) => ({ value: v, label: v }))} className="w-28" />
            <Button size="sm" variant="secondary" label="Add" onClick={() => setOv(newId, { P: b.loads.interior, MB: 0, shape: 'rectangle' })} />
          </div>
        </Card>
      </div>
    </div>
  );
}

const COLS: [keyof SoilLayer, string, string][] = [['top', 'Top', 'm'], ['bottom', 'Bottom', 'm'], ['gammaMoist', 'γ moist', 'kN/m³'], ['gammaSat', 'γ sat', 'kN/m³'], ['c', "c′", 'kPa'], ['phi', "φ′", '°'], ['cu', 'cu', 'kPa'], ['E', 'E', 'kPa'], ['Cc', 'Cc', '–'], ['Cr', 'Cr', '–'], ['e0', 'e0', '–'], ['sigmaP', "σ′p", 'kPa'], ['cv', 'cv', 'm²/yr']];

function BoreholeStep() {
  const bhs = useProject((s) => s.boreholes);
  const { updateBorehole, updateLayer, addLayer, removeLayer, addBorehole, removeBorehole } = useProject.getState();
  const [sel, setSel] = useState(bhs[0]?.id ?? '');
  const bh = bhs.find((b) => b.id === sel) ?? bhs[0];
  const Df = useProject((s) => s.project.Df);
  const res = useResults();
  if (!bh) return <Button label="Add a borehole" onClick={addBorehole} />;
  const errs = res.perBH[bh.id]?.errors ?? [];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {bhs.map((b) => (
            <button key={b.id} onClick={() => setSel(b.id)} className={`rounded-full border px-4 py-2 font-mono text-[12px] transition-colors ${b.id === bh.id ? 'border-accent bg-accent/15 text-ink' : 'border-line-soft text-muted hover:border-line hover:text-ink'}`}>{b.id}</button>
          ))}
          <Button size="sm" variant="secondary" label="Add borehole" onClick={addBorehole} />
          {bhs.length > 1 && <Button size="sm" variant="ghost" label="Remove" onClick={() => { removeBorehole(bh.id); setSel(bhs[0].id); }} />}
        </div>
        <Card className="grid gap-4 p-6 sm:grid-cols-3 lg:grid-cols-6">
          <TextField label="ID" value={bh.id} onChange={(v) => { updateBorehole(bh.id, { id: v }); setSel(v); }} />
          <Field label="Ground level" unit="m RL" value={bh.groundRL} onChange={(v) => updateBorehole(bh.id, { groundRL: v ?? 100 })} />
          <Field label="Measured WT" unit="m bgl" value={bh.measuredWT} onChange={(v) => updateBorehole(bh.id, { measuredWT: v ?? 0 })} />
          <Field label="Design WT" unit="m bgl" value={bh.designWT} onChange={(v) => updateBorehole(bh.id, { designWT: v ?? 0 })} />
          <Field label="Plan x" unit="m" value={bh.x} onChange={(v) => updateBorehole(bh.id, { x: v })} />
          <Field label="Plan y" unit="m" value={bh.y} onChange={(v) => updateBorehole(bh.id, { y: v })} />
        </Card>
        <Card interactive={false} className="overflow-x-auto p-2">
          <table className="w-full min-w-[1180px] text-left">
            <thead><tr className="border-b border-line-soft">
              <th className="px-2 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Symbol</th>
              <th className="px-2 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Behaviour</th>
              {COLS.map(([, l, u]) => <th key={l} className="px-2 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{l}<span className="ml-1 normal-case text-muted/70">{u}</span></th>)}
              <th className="px-2 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Dil.</th><th />
            </tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {bh.layers.map((l, i) => (
                  <motion.tr key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="border-b border-line-soft/60 hover:bg-ink/[0.02]">
                    <td className="px-1"><input value={l.symbol} onChange={(e) => updateLayer(bh.id, i, { symbol: e.target.value.toUpperCase() })} className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-mono text-[13px] font-semibold text-ink outline-none hover:border-line focus:border-accent/70" /></td>
                    <td className="px-1"><select value={l.behaviour} onChange={(e) => updateLayer(bh.id, i, { behaviour: e.target.value as SoilBehaviour })} className="rounded-lg border border-transparent bg-transparent px-1 py-1.5 text-[13px] text-ink outline-none hover:border-line focus:border-accent/70">{['granular', 'cohesive', 'fill', 'rock'].map((b) => <option key={b} value={b} className="bg-raised">{b}</option>)}</select></td>
                    {COLS.map(([k]) => <td key={k} className="px-0.5"><Cell value={l[k] as number | undefined} onChange={(v) => updateLayer(bh.id, i, { [k]: v } as Partial<SoilLayer>)} /></td>)}
                    <td className="px-2"><input type="checkbox" checked={!!l.dilatancy} onChange={(e) => updateLayer(bh.id, i, { dilatancy: e.target.checked })} className="accent-[#FF4A1C]" /></td>
                    <td className="px-1"><button onClick={() => removeLayer(bh.id, i)} className="rounded-full px-2 py-1 text-muted hover:bg-fail/10 hover:text-fail" aria-label="Remove layer">✕</button></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3"><Button size="sm" variant="secondary" label="Add layer" onClick={() => addLayer(bh.id)} />{errs.length > 0 && <span className="text-[12px] text-fail">{errs[0]}</span>}</div>
        </Card>
        <Card className="p-6">
          <div className="hud mb-3">SPT records — depth (m) : N (blows / 300 mm); N ≥ 100 = refusal</div>
          <div className="flex flex-wrap gap-2">
            {bh.spt.map((s, i) => (
              <div key={i} className="flex items-center rounded-xl border border-line-soft bg-sunken/60 pl-1">
                <Cell value={s.depth} w="w-[60px]" onChange={(v) => updateBorehole(bh.id, { spt: bh.spt.map((q, j) => (j === i ? { ...q, depth: v ?? 0 } : q)) })} /><span className="text-muted">:</span>
                <Cell value={s.N} w="w-[56px]" onChange={(v) => updateBorehole(bh.id, { spt: bh.spt.map((q, j) => (j === i ? { ...q, N: v ?? 0, refusal: (v ?? 0) >= 100 } : q)) })} />
                <button onClick={() => updateBorehole(bh.id, { spt: bh.spt.filter((_, j) => j !== i) })} className="px-2 text-muted hover:text-fail" aria-label="Remove">✕</button>
              </div>
            ))}
            <Button size="sm" variant="ghost" label="+ Add" onClick={() => updateBorehole(bh.id, { spt: [...bh.spt, { depth: (bh.spt.at(-1)?.depth ?? 0) + 1.5, N: 10 }] })} />
          </div>
        </Card>
      </div>
      <Card interactive={false} className="sticky top-24 self-start p-5">
        <div className="mb-2 flex items-center justify-between"><span className="hud">soil column · {bh.id}</span>{errs.length ? <Badge status="fail">invalid</Badge> : <Badge status="pass">valid</Badge>}</div>
        <SoilColumn bh={bh} Df={Df} />
      </Card>
    </div>
  );
}

function LabStep() {
  const lab = useProject((s) => s.lab), setLab = useProject((s) => s.setLab);
  const bhs = useProject((s) => s.boreholes), updateLayer = useProject((s) => s.updateLayer);
  const res = useResults();
  const applyToSymbol = (sym: string, patch: Partial<SoilLayer>) => bhs.forEach((b) => b.layers.forEach((l, i) => { if (l.symbol === sym) updateLayer(b.id, i, patch); }));
  const [target, setTarget] = useState('SM');
  const symbols = [...new Set(bhs.flatMap((b) => b.layers.map((l) => l.symbol)))];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-6 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div className="hud">direct shear — least-squares c′, φ′</div>
          <div className="flex items-end gap-2"><Select label="Apply to layers with symbol" value={target} onChange={setTarget} options={symbols.map((s) => ({ value: s, label: s }))} className="w-48" /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {lab.directShear.map((d, i) => {
            const f = res.lab.shear.find((x) => x.name === d.name);
            return (
              <div key={i} className="rounded-2xl border border-line-soft bg-sunken/50 p-4">
                <input value={d.name} onChange={(e) => setLab({ directShear: lab.directShear.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)) })} className="mb-3 w-full bg-transparent font-display text-[16px] font-bold text-ink outline-none" />
                <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-2 text-[11px] text-muted"><span /><span className="px-2">σn kPa</span><span className="px-2">τf kPa</span>
                  {d.sigma.map((s, k) => (<Fragment key={k}>
                    <span key={'n' + k}>{k + 1}</span>
                    <Cell key={'s' + k} value={s} onChange={(v) => setLab({ directShear: lab.directShear.map((q, j) => (j === i ? { ...q, sigma: q.sigma.map((x, m) => (m === k ? v ?? 0 : x)) } : q)) })} />
                    <Cell key={'t' + k} value={d.tau[k]} onChange={(v) => setLab({ directShear: lab.directShear.map((q, j) => (j === i ? { ...q, tau: q.tau.map((x, m) => (m === k ? v ?? 0 : x)) } : q)) })} />
                  </Fragment>))}
                </div>
                {f && <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3"><span className="num text-[14px]">φ′ {f.phi.toFixed(2)}° · c′ {f.c.toFixed(2)} kPa</span><span className="num text-[11px] text-muted">R² {f.r2.toFixed(4)}</span></div>}
                {f && <Button size="sm" variant="secondary" className="mt-3" label={`Use for ${target}`} onClick={() => applyToSymbol(target, { phi: +f.phi.toFixed(2), c: +f.c.toFixed(2) })} />}
              </div>
            );
          })}
          <button onClick={() => setLab({ directShear: [...lab.directShear, { name: `Set ${lab.directShear.length + 1}`, sigma: [50, 100, 150], tau: [30, 60, 90] }] })} className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-line text-muted transition-colors hover:border-accent hover:text-ink">+ Add direct-shear set</button>
        </div>
      </Card>
      <Card className="p-6">
        <div className="hud mb-4">UU triaxial — cu = (σ1 − σ3)f / 2</div>
        {lab.uu.map((u, i) => (
          <div key={i} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-sunken/50 p-3">
            <span className="w-40 text-[13px] text-warm">{u.name}</span>
            {u.dev.map((d, k) => <Cell key={k} value={d} onChange={(v) => setLab({ uu: lab.uu.map((q, j) => (j === i ? { ...q, dev: q.dev.map((x, m) => (m === k ? v ?? 0 : x)) } : q)) })} />)}
            <span className="num ml-auto text-[14px] text-ink">cu {res.lab.uu[i]?.cu.toFixed(2)} kPa</span>
            <Button size="sm" variant="ghost" label={`→ ${target}`} onClick={() => res.lab.uu[i] && applyToSymbol(target, { cu: +res.lab.uu[i].cu.toFixed(2) })} />
          </div>
        ))}
        <Button size="sm" variant="secondary" label="Add UU sample" onClick={() => setLab({ uu: [...lab.uu, { name: `Sample ${lab.uu.length + 1}`, dev: [60, 60, 60] }] })} />
      </Card>
      <Card className="p-6">
        <div className="mb-4 flex items-end justify-between gap-3"><div className="hud">oedometer — e vs log σ′</div>
          <Select label="Pressure unit on lab sheet" value={lab.oed.unit} onChange={(v) => setLab({ oed: { ...lab.oed, unit: v } })} options={[{ value: 'kg/cm2', label: 'kg/cm² (×98.0665)' }, { value: 'kPa', label: 'kPa' }]} className="w-56" />
        </div>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-x-2 text-[11px] text-muted"><span className="px-2">p</span><span className="px-2">e</span><span className="px-2">stage</span><span />
          {lab.oed.points.map((pt, i) => (<Fragment key={i}>
            <Cell key={'p' + i} value={pt.p} onChange={(v) => setLab({ oed: { ...lab.oed, points: lab.oed.points.map((q, j) => (j === i ? { ...q, p: v ?? 0 } : q)) } })} />
            <Cell key={'e' + i} value={pt.e} onChange={(v) => setLab({ oed: { ...lab.oed, points: lab.oed.points.map((q, j) => (j === i ? { ...q, e: v ?? 0 } : q)) } })} />
            <span key={'s' + i} className="px-2 py-1.5 text-[12px] text-warm">{pt.stage}</span>
            <button key={'x' + i} onClick={() => setLab({ oed: { ...lab.oed, points: lab.oed.points.filter((_, j) => j !== i) } })} className="text-muted hover:text-fail" aria-label="Remove">✕</button>
          </Fragment>))}
        </div>
        {res.lab.oed && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
            {[['Cc', res.lab.oed.Cc.toFixed(4), ''], ['Cr', res.lab.oed.Cr.toFixed(4), ''], ["σ′p", res.lab.oed.sigmaP.toFixed(1), 'kPa']].map(([k, v, u]) => <div key={k}><div className="hud">{k}</div><div className="num text-[20px]">{v} <span className="text-[12px] text-muted">{u}</span></div></div>)}
            <Button size="sm" variant="secondary" className="col-span-3 justify-self-start" label={`Use Cc, Cr, σ′p for ${target}`} onClick={() => applyToSymbol(target, { Cc: +res.lab.oed!.Cc.toFixed(4), Cr: +res.lab.oed!.Cr.toFixed(4), sigmaP: +res.lab.oed!.sigmaP.toFixed(1) })} />
          </div>
        )}
        <div className="mt-4 flex gap-2"><Button size="sm" variant="ghost" label="+ loading point" onClick={() => setLab({ oed: { ...lab.oed, points: [...lab.oed.points, { p: 1, e: 0.8, stage: 'loading' }] } })} /><Button size="sm" variant="ghost" label="+ unloading point" onClick={() => setLab({ oed: { ...lab.oed, points: [...lab.oed.points, { p: 1, e: 0.8, stage: 'unloading' }] } })} /></div>
      </Card>
    </div>
  );
}

function ReviewStep() {
  const res = useResults();
  const s = useProject();
  const nav = useNavigate();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <div className="hud mb-4">inputs check</div>
        {res.errors.length === 0 ? <div className="flex items-center gap-3"><Badge status="pass">ready</Badge><span className="text-warm">All boreholes and lab sets are valid. Results update live as you edit.</span></div>
          : <ul className="grid gap-2">{res.errors.map((e) => <li key={e} className="flex items-start gap-3 text-[14px]"><Badge status="fail">fix</Badge><span className="text-warm">{e}</span></li>)}</ul>}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[['Boreholes', s.boreholes.length, ''], ['Columns', res.columns.length, ''], ['λ', res.lambda.toFixed(2), '']].map(([k, v]) => <div key={String(k)} className="rounded-2xl border border-line-soft bg-sunken/50 p-4"><div className="hud">{k}</div><div className="font-giant text-[48px] leading-none">{v}</div></div>)}
        </div>
      </Card>
      <Card className="flex flex-col justify-between gap-6 p-6">
        <p className="font-display text-[24px] font-bold leading-tight">See the ground model and the calculations.</p>
        <div className="flex flex-wrap gap-2"><Button label="Ground model" icon={<Arrow />} onClick={() => nav('/ground')} /><Chip>auto-saved in this browser</Chip></div>
      </Card>
    </div>
  );
}

export default function Data() {
  const [step, setStep] = useState(0);
  const loaded = useProject((s) => s.exampleLoaded);
  const loadExample = useProject((s) => s.loadExample);
  const Body = [ProjectStep, BuildingStep, BoreholeStep, LabStep, ReviewStep][step];
  return (
    <Page>
      <Shell>
        <SectionHead k="02 · enter data" title="Tell GeoFound about the site." sub="Every input shows its SI unit. Results recalculate about 200 ms after you stop typing — no Calculate button."
          right={!loaded ? <Button variant="secondary" label="Load Mandi example" onClick={() => loadExample()} /> : <Chip>Mandi example loaded</Chip>} />
        <div className="mb-8"><Stepper steps={STEPS} current={step} onSelect={setStep} /></div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.215, 0.61, 0.355, 1] }}>
            <Body />
          </motion.div>
        </AnimatePresence>
        <div className="mt-8 flex justify-between">
          <Button variant="ghost" label="Back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} />
          {step < STEPS.length - 1 && <Button label="Next" icon={<Arrow />} onClick={() => setStep((s) => s + 1)} />}
        </div>
      </Shell>
    </Page>
  );
}
