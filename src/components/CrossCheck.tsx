import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Badge, Card, Chip } from './ui';
import { teamBearing, teamShear, teamSpt, teamStress, teamU, TEAM_CREDITS } from '../team/bridge';
import { bearingCapacity, correctSpt, deltaSigmaCentre, degreeOfConsolidation, fitDirectShear, type Borehole, type FootingCheck } from '../engine';
import type { ProjectInfo, LabData } from '../store/project';

interface Row { module: string; who: string; what: string; v1: number; v2: number; unit: string; dp: number }

/** Runs the team's v1 engines (platform-v1/js) on the same inputs as GeoFound and shows both side by side. */
export default function CrossCheck({ check, bh, project, lab }: { check: FootingCheck; bh: Borehole; project: ProjectInfo; lab: LabData }) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const f = check.footing;
    try {
      const v1 = teamBearing(f, { P: 0 }, bh, project.FS);
      const v2 = bearingCapacity({ footing: f, layers: bh.layers, zw: bh.designWT, FS: project.FS, mode: project.mode, useDepthFactors: project.useDepthFactors, strength: project.strength ?? 'zone-average', transition: project.transition ?? 'factors' });
      if (v1 && Number.isFinite(v1.qnu)) out.push({ module: 'P3', who: TEAM_CREDITS.P3, what: `qnu, ${f.shape} B = ${f.B.toFixed(2)} m`, v1: v1.qnu, v2: v2.qnu, unit: 'kPa', dp: 1 });
    } catch { /* v1 may reject unusual inputs */ }
    try {
      const s1 = teamSpt(bh, bh.designWT), s2 = correctSpt(bh.spt, bh.layers, bh.designWT).filter((r) => !r.refusal);
      if (s1[0] && s2[0]) out.push({ module: 'P2', who: TEAM_CREDITS.P2, what: `SPT N″ at ${s1[0].depth.toFixed(1)} m`, v1: s1[0].N2, v2: s2[0].Ncorr, unit: '', dp: 2 });
    } catch { /* skip */ }
    const ds = lab.directShear[0];
    if (ds) {
      const a = teamShear(ds.sigma, ds.tau); const b = fitDirectShear(ds.sigma, ds.tau);
      if (a) out.push({ module: 'P2', who: TEAM_CREDITS.P2, what: `φ′ by least squares (${ds.name})`, v1: a.phi, v2: b.phi, unit: '°', dp: 3 });
    }
    const L = f.L ?? f.B;
    const st = teamStress(check.qApplied, f.B, L, f.Df, f.B);
    if (st) out.push({ module: 'P4', who: TEAM_CREDITS.P4, what: `Δσz under centre at z = B`, v1: st.centre, v2: deltaSigmaCentre(check.qApplied, f.B, L, f.B), unit: 'kPa', dp: 2 });
    out.push({ module: 'P5', who: TEAM_CREDITS.P5, what: 'Degree of consolidation at Tv = 0.197', v1: teamU(0.197), v2: degreeOfConsolidation(0.197), unit: '', dp: 4 });
    return out;
  }, [check, bh, project, lab]);

  return (
    <Card interactive={false} className="p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <span className="hud">team engine cross-check · v1 (platform-v1) vs v2 (GeoFound)</span>
        <Chip>two independent implementations</Chip>
      </div>
      <p className="mb-5 max-w-3xl text-[13px] text-warm">The team's original calculation engines run live on the same inputs. Agreement within 0.5 % is shown green; any larger gap is a method difference to justify in the report.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead><tr className="border-b border-line-soft">{['Module', 'Engine author (v1)', 'Quantity', 'v1', 'v2', 'Δ', ''].map((h) => <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const d = Math.abs(r.v1 - r.v2) / Math.max(1e-9, Math.abs(r.v2));
              return (
                <motion.tr key={r.module + r.what} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="border-b border-line-soft/40">
                  <td className="py-2 font-mono text-accent">{r.module}</td>
                  <td className="text-ink">{r.who}</td>
                  <td className="text-warm">{r.what}</td>
                  <td className="num">{r.v1.toFixed(r.dp)} <span className="text-muted">{r.unit}</span></td>
                  <td className="num">{r.v2.toFixed(r.dp)} <span className="text-muted">{r.unit}</span></td>
                  <td className="num">{(d * 100).toFixed(2)} %</td>
                  <td><Badge status={d < 0.005 ? 'pass' : 'warn'}>{d < 0.005 ? 'agree' : 'differs'}</Badge></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
