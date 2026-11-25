import { useMemo } from 'react';
import { pl } from './motion';
import { motion, AnimatePresence } from 'framer-motion';
import { deltaSigmaAt, type Borehole, type SoilLayer } from '../engine';
import type { ColumnResult } from '../lib/results';

export const SOIL_COLOR: Record<string, string> = { FILL: '#6B4535', SM: '#9A7550', SP: '#B89A68', SW: '#C2A574', SC: '#8E6A4E', ML: '#8C7B6B', MH: '#7C6E62', CL: '#73685F', CI: '#6A625E', CH: '#5C5652', GW: '#857565', GP: '#7A6D60', OL: '#3E3328', OH: '#3E3328', PT: '#2F2620', ROCK: '#5B5550' };
export const soilColor = (sym: string) => SOIL_COLOR[sym.toUpperCase()] ?? '#7d6a5c';

/** IS 1498-style fill pattern ids per behaviour. */
function Patterns() {
  return (
    <defs>
      <pattern id="p-sand" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#140806" fillOpacity="0.45" /><circle cx="6" cy="6" r="0.9" fill="#140806" fillOpacity="0.45" /></pattern>
      <pattern id="p-clay" width="18" height="7" patternUnits="userSpaceOnUse"><path d="M2 4h11" stroke="#140806" strokeOpacity="0.45" /></pattern>
      <pattern id="p-gravel" width="16" height="13" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="3" fill="none" stroke="#140806" strokeOpacity="0.45" /><circle cx="12" cy="11" r="2" fill="none" stroke="#140806" strokeOpacity="0.4" /></pattern>
      <pattern id="p-fill" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10L10 0M-2 2l4-4M8 12l4-4" stroke="#140806" strokeOpacity="0.45" /></pattern>
    </defs>
  );
}
const patternFor = (l: SoilLayer) => l.behaviour === 'fill' ? 'url(#p-fill)' : l.behaviour === 'cohesive' ? 'url(#p-clay)' : /^G/i.test(l.symbol) ? 'url(#p-gravel)' : 'url(#p-sand)';

/* ---------------- Soil column (grows layer by layer, WT slides) ---------------- */
export function SoilColumn({ bh, height = 460, width = 300, Df }: { bh: Borehole; height?: number; width?: number; Df?: number }) {
  const layers = [...bh.layers].sort((a, b) => a.top - b.top);
  const zMax = Math.max(15, layers.length ? layers[layers.length - 1].bottom : 15);
  const k = (height - 30) / zMax, x0 = 54, w = 86;
  const y = (z: number) => 14 + z * k;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`Soil column ${bh.id}`}>
      <Patterns />
      {Array.from({ length: Math.floor(zMax) + 1 }, (_, d) => (
        <g key={d}><path d={`M${x0 - (d % 5 ? 6 : 12)} ${y(d)}H${x0}`} stroke="#A88A80" strokeOpacity="0.7" />{d % 5 === 0 && <text x={x0 - 16} y={y(d) + 3} textAnchor="end" className="num" fontSize="10" fill="#A88A80">{d}</text>}</g>
      ))}
      <AnimatePresence initial={true}>
        {layers.map((l, i) => (
          <motion.g key={`${i}-${l.symbol}`} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.215, 0.61, 0.355, 1] }} style={{ transformOrigin: `0px ${y(l.top)}px` }}>
            <motion.rect x={x0} width={w} rx={3} animate={{ y: y(l.top), height: Math.max(0.5, (l.bottom - l.top) * k) }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} fill={soilColor(l.symbol)} />
            <motion.rect x={x0} width={w} animate={{ y: y(l.top), height: Math.max(0.5, (l.bottom - l.top) * k) }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} fill={patternFor(l)} />
            <motion.text x={x0 + w + 14} animate={{ y: y((l.top + l.bottom) / 2) - 2 }} className="num" fontSize="11" fontWeight={600} fill="#F4E8DF">{l.symbol}</motion.text>
            <motion.text x={x0 + w + 14} animate={{ y: y((l.top + l.bottom) / 2) + 12 }} className="num" fontSize="10" fill="#A88A80">{l.top.toFixed(1)}–{l.bottom.toFixed(1)} m</motion.text>
          </motion.g>
        ))}
      </AnimatePresence>
      {bh.spt.filter((s) => s.depth <= zMax).map((s) => (
        <g key={s.depth}><path d={`M${x0 + w} ${y(s.depth)}h6`} stroke="#FF4A1C" /><text x={width - 6} y={y(s.depth) + 3} textAnchor="end" className="num" fontSize="9.5" fill={s.N <= 8 ? '#FF4A1C' : '#E9C2B8'}>{s.refusal || s.N >= 100 ? '>100' : s.N}</text></g>
      ))}
      <motion.g animate={{ y: y(bh.designWT) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
        <path d={`M${x0 - 10} 0H${x0 + w + 10}`} stroke="#6CC4D6" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={`M${x0 + w + 4} -10h10l-5 8z`} fill="#6CC4D6" />
        <text x={x0 - 12} y={-4} textAnchor="end" className="num" fontSize="9" fill="#6CC4D6">design</text>
      </motion.g>
      <motion.g animate={{ y: y(bh.measuredWT) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
        <path d={`M${x0} 0H${x0 + w}`} stroke="#6CC4D6" strokeOpacity="0.55" strokeDasharray="2 3" />
        <text x={x0 - 12} y={3} textAnchor="end" className="num" fontSize="9" fill="#6CC4D6" fillOpacity="0.7">meas.</text>
      </motion.g>
      {Df !== undefined && <g><path d={`M${x0 - 4} ${y(Df)}H${x0 + w + 4}`} stroke="#FF4A1C" strokeWidth="2" /><text x={x0 + w / 2} y={y(Df) - 4} textAnchor="middle" className="num" fontSize="9" fill="#FF4A1C">Df</text></g>}
      <text x={x0 + w + 14} y={10} className="hud" fontSize="9" fill="#A88A80">SPT N →</text>
    </svg>
  );
}

/* ---------------- Generic depth chart (depth downward) ---------------- */
export interface Series { name: string; color: string; pts: { x: number; z: number }[]; dash?: string; width?: number }
export function DepthChart({ series, xLabel, zLabel = 'Depth, m', height = 420, xMax, zMax, markers = [] }: { series: Series[]; xLabel: string; zLabel?: string; height?: number; xMax?: number; zMax?: number; markers?: { z: number; label: string; color: string }[] }) {
  const W = 560, H = height, L = 52, R = 18, T = 26, B = 40;
  const xm = xMax ?? Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p.x))) * 1.08;
  const zm = zMax ?? Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p.z)));
  const X = (x: number) => L + (x / xm) * (W - L - R), Z = (z: number) => T + (z / zm) * (H - T - B);
  const ticks = (m: number) => { const st = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => m / s <= 6) ?? 1000; return Array.from({ length: Math.floor(m / st) + 1 }, (_, i) => i * st); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={xLabel}>
      {ticks(xm).map((t) => <g key={'x' + t}><path d={`M${X(t)} ${T}V${H - B}`} stroke="#F4E8DF" strokeOpacity="0.06" /><text x={X(t)} y={T - 8} textAnchor="middle" className="num" fontSize="10" fill="#A88A80">{t}</text></g>)}
      {ticks(zm).map((t) => <g key={'z' + t}><path d={`M${L} ${Z(t)}H${W - R}`} stroke="#F4E8DF" strokeOpacity="0.06" /><text x={L - 8} y={Z(t) + 3} textAnchor="end" className="num" fontSize="10" fill="#A88A80">{t}</text></g>)}
      <path d={`M${L} ${T}V${H - B}M${L} ${T}H${W - R}`} stroke="#A88A80" strokeOpacity="0.6" />
      {markers.map((m) => <g key={m.label}><path d={`M${L} ${Z(m.z)}H${W - R}`} stroke={m.color} strokeDasharray="5 4" strokeOpacity="0.8" /><text x={W - R - 4} y={Z(m.z) - 5} textAnchor="end" className="num" fontSize="10" fill={m.color}>{m.label}</text></g>)}
      {series.map((s) => (
        <motion.path key={s.name} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.2} strokeDasharray={s.dash} strokeLinejoin="round"
          initial={pl({ pathLength: 0 })} animate={pl({ pathLength: 1, d: s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Z(p.z).toFixed(1)}`).join('') })}
          transition={{ pathLength: { duration: 1.2, ease: [0.215, 0.61, 0.355, 1] }, d: { duration: 0.5 } }} />
      ))}
      <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" className="hud" fontSize="10" fill="#A88A80">{xLabel}</text>
      <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="hud" fontSize="10" fill="#A88A80">{zLabel}</text>
      <g transform={`translate(${L + 10} ${H - B - 10 - series.length * 16})`}>
        {series.map((s, i) => <g key={s.name} transform={`translate(0 ${i * 16})`}><path d="M0 0h18" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /><text x={24} y={4} fontSize="11" fill="#E9C2B8">{s.name}</text></g>)}
      </g>
    </svg>
  );
}

/* ---------------- Time chart (x = time, y = settlement downward) ---------------- */
export function TimeChart({ pts, final, t90 }: { pts: { t: number; s: number }[]; final: number; t90: number }) {
  const W = 560, H = 300, L = 52, R = 18, T = 20, B = 40;
  const tm = Math.max(...pts.map((p) => p.t)), sm = Math.max(final, 1e-6) * 1.1;
  const lx = (t: number) => Math.log10(Math.max(t, 0.01));
  const X = (t: number) => L + ((lx(t) + 2) / (Math.log10(tm) + 2)) * (W - L - R), Y = (s: number) => T + (s / sm) * (H - T - B);
  const d = pts.filter((p) => p.t > 0).map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.s).toFixed(1)}`).join('');
  const dec = [0.01, 0.1, 1, 10, 100].filter((t) => t <= tm);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Time–settlement curve">
      {dec.map((t) => <g key={t}><path d={`M${X(t)} ${T}V${H - B}`} stroke="#F4E8DF" strokeOpacity="0.06" /><text x={X(t)} y={H - B + 16} textAnchor="middle" className="num" fontSize="10" fill="#A88A80">{t}</text></g>)}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><path d={`M${L} ${Y(f * final)}H${W - R}`} stroke="#F4E8DF" strokeOpacity="0.06" /><text x={L - 8} y={Y(f * final) + 3} textAnchor="end" className="num" fontSize="10" fill="#A88A80">{(f * final).toFixed(0)}</text></g>)}
      <path d={`M${L} ${Y(final)}H${W - R}`} stroke="#FF4A1C" strokeDasharray="5 4" />
      {Number.isFinite(t90) && t90 <= tm && <g><path d={`M${X(t90)} ${T}V${H - B}`} stroke="#6CC4D6" strokeDasharray="3 4" /><text x={X(t90) + 4} y={T + 12} className="num" fontSize="10" fill="#6CC4D6">t90 = {t90.toFixed(2)} yr</text></g>}
      <motion.path d={d} fill="none" stroke="#F4E8DF" strokeWidth="2.4" initial={pl({ pathLength: 0 })} animate={pl({ pathLength: 1 })} transition={{ duration: 1.4 }} />
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="hud" fontSize="10" fill="#A88A80">time, years (log)</text>
      <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="hud" fontSize="10" fill="#A88A80">settlement, mm</text>
    </svg>
  );
}

/* ---------------- Pressure bulb: Boussinesq isobars in the x–z plane through the centre ---------------- */
export function PressureBulb({ B, L, q, levels = [0.8, 0.6, 0.4, 0.2, 0.1] }: { B: number; L: number; q: number; levels?: number[] }) {
  const W = 520, H = 380, cx = W / 2, top = 40;
  const span = Math.max(4 * B, 6);
  const k = (W - 40) / span; // px per m (same both axes)
  const contours = useMemo(() => levels.map((lv) => {
    const pts: [number, number][] = [];
    for (let z = 0.02; z <= 4 * B; z += B / 40) {
      // half-width x where Δσ(x, z) = lv·q, by bisection along the B direction through the centre
      const f = (x: number) => deltaSigmaAt(1, B, L, B / 2 + x, L / 2, z) - lv;
      if (f(0) < 0) break;
      let lo = 0, hi = 3 * B;
      if (f(hi) > 0) continue;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
      pts.push([lo, z]);
    }
    if (!pts.length) return { lv, d: '' };
    const right = pts.map(([x, z]) => `${(cx + x * k).toFixed(1)} ${(top + z * k).toFixed(1)}`);
    const left = [...pts].reverse().map(([x, z]) => `${(cx - x * k).toFixed(1)} ${(top + z * k).toFixed(1)}`);
    return { lv, d: `M${left.join('L')}L${right.join('L')}` };
  }), [B, L, levels, k, cx]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pressure bulb">
      <path d={`M0 ${top}H${W}`} stroke="#F4E8DF" strokeOpacity="0.5" />
      <rect x={cx - (B / 2) * k} y={top - 10} width={B * k} height={10} fill="#F4E8DF" />
      {contours.map(({ lv, d }, i) => (
        <motion.path key={lv} d={d} fill="none" stroke="#FF4A1C" strokeOpacity={1 - i * 0.15} strokeWidth={1.6} strokeDasharray={i > 2 ? '6 4' : undefined}
          initial={pl({ pathLength: 0, scale: 0.6 })} animate={pl({ pathLength: 1, scale: 1, d })} transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }} style={{ transformOrigin: `${cx}px ${top}px` }} />
      ))}
      {contours.map(({ lv }, i) => {
        const z = [0.38, 0.75, 1.15, 1.45, 2.0][i] ?? 1;
        return <text key={'t' + lv} x={cx + 6} y={top + z * B * k} className="num" fontSize="11" fill="#FF4A1C">{lv}q = {(lv * q).toFixed(0)} kPa</text>;
      })}
      {[1, 2, 3, 4].map((m) => <text key={m} x={8} y={top + m * B * k} className="num" fontSize="10" fill="#A88A80">{m}B</text>)}
    </svg>
  );
}

/* ---------------- Ground section across boreholes ---------------- */
export function SectionView({ boreholes, height = 360 }: { boreholes: Borehole[]; height?: number }) {
  const bhs = [...boreholes].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  if (!bhs.length) return null;
  const W = 900, H = height, L = 60, R = 60, T = 30;
  const xs = bhs.map((b, i) => b.x ?? i * 10);
  const xmin = Math.min(...xs), xmax = Math.max(...xs) || 1;
  const X = (x: number) => L + ((x - xmin) / (xmax - xmin || 1)) * (W - L - R);
  const zMax = Math.max(15, ...bhs.map((b) => Math.max(...b.layers.map((l) => l.bottom))));
  const rlTop = Math.max(...bhs.map((b) => b.groundRL));
  const Z = (bh: Borehole, z: number) => T + ((rlTop - bh.groundRL) + z) * ((H - T - 30) / (zMax + 1));
  // Correlate strata by order (same index across boreholes), as on the brief's graphic log.
  const nL = Math.min(...bhs.map((b) => b.layers.length));
  const polys = Array.from({ length: nL }, (_, i) => {
    const topPts = bhs.map((b, j) => `${X(xs[j])} ${Z(b, [...b.layers].sort((p, q) => p.top - q.top)[i].top)}`);
    const botPts = bhs.map((b, j) => `${X(xs[j])} ${Z(b, [...b.layers].sort((p, q) => p.top - q.top)[i].bottom)}`).reverse();
    const sym = [...bhs[0].layers].sort((p, q) => p.top - q.top)[i];
    return { d: `M${topPts.join('L')}L${botPts.join('L')}Z`, sym };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Soil section across boreholes">
      <Patterns />
      {polys.map((p, i) => (
        <motion.g key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.6 }}>
          <path d={p.d} fill={soilColor(p.sym.symbol)} fillOpacity="0.9" />
          <path d={p.d} fill={patternFor(p.sym)} />
          <path d={p.d} fill="none" stroke="#140806" strokeOpacity="0.6" />
        </motion.g>
      ))}
      <path d={`M${bhs.map((b, j) => `${X(xs[j])} ${Z(b, b.designWT)}`).join('L')}`} stroke="#6CC4D6" strokeWidth="1.8" strokeDasharray="7 5" fill="none" />
      {bhs.map((b, j) => (
        <g key={b.id}>
          <path d={`M${X(xs[j])} ${Z(b, 0) - 14}V${Z(b, zMax)}`} stroke="#F4E8DF" strokeOpacity="0.85" strokeWidth="1.5" />
          <text x={X(xs[j])} y={Z(b, 0) - 18} textAnchor="middle" className="num" fontSize="12" fontWeight={600} fill="#F4E8DF">{b.id}</text>
          <path d={`M${X(xs[j]) - 6} ${Z(b, b.designWT) - 10}h12l-6 8z`} fill="#6CC4D6" />
        </g>
      ))}
      {polys.map((p, i) => <text key={'l' + i} x={W - R + 6} y={(Z(bhs[bhs.length - 1], p.sym.top) + Z(bhs[bhs.length - 1], p.sym.bottom)) / 2 + 3} className="num" fontSize="10" fill="#E9C2B8">{p.sym.symbol}</text>)}
      <text x={L} y={H - 6} className="hud" fontSize="10" fill="#A88A80">west → east · strata correlated by order · vertical exaggerated</text>
    </svg>
  );
}

/* ---------------- Plan to scale with footings ---------------- */
export function PlanView({ results, nLines, nRows, sx, sy, selected, onSelect }: { results: ColumnResult[]; nLines: number; nRows: number; sx: number; sy: number; selected?: string; onSelect?: (id: string) => void }) {
  const Lx = (nLines - 1) * sx, Ly = (nRows - 1) * sy;
  const pad = 4, k = 760 / (Lx + 2 * pad);
  const W = (Lx + 2 * pad) * k, H = (Ly + 2 * pad) * k;
  const X = (x: number) => (x + pad) * k, Y = (y: number) => H - (y + pad) * k;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Foundation plan">
      {Array.from({ length: nLines }, (_, i) => <g key={'v' + i}><path d={`M${X(i * sx)} ${Y(-1.8)}V${Y(Ly + 1.8)}`} stroke="#F4E8DF" strokeOpacity="0.14" strokeDasharray="8 3 2 3" /><circle cx={X(i * sx)} cy={Y(-2.6)} r={11} fill="none" stroke="#A88A80" /><text x={X(i * sx)} y={Y(-2.6) + 4} textAnchor="middle" className="num" fontSize="11" fill="#E9C2B8">{i + 1}</text></g>)}
      {Array.from({ length: nRows }, (_, j) => <g key={'h' + j}><path d={`M${X(-1.8)} ${Y(j * sy)}H${X(Lx + 1.8)}`} stroke="#F4E8DF" strokeOpacity="0.14" strokeDasharray="8 3 2 3" /><circle cx={X(-2.6)} cy={Y(j * sy)} r={11} fill="none" stroke="#A88A80" /><text x={X(-2.6)} y={Y(j * sy) + 4} textAnchor="middle" className="num" fontSize="11" fill="#E9C2B8">{String.fromCharCode(65 + j)}</text></g>)}
      {results.map((r, i) => {
        const f = r.check?.footing; const B = f?.B ?? 1, Lf = f?.L ?? B;
        const ok = r.found, sel = selected === r.col.id;
        return (
          <g key={r.col.id} onClick={() => onSelect?.(r.col.id)} style={{ cursor: 'pointer' }}>
            <motion.rect initial={{ width: 0, height: 0, x: X(r.col.x), y: Y(r.col.y) }} animate={{ width: B * k, height: Lf * k, x: X(r.col.x) - (B * k) / 2, y: Y(r.col.y) - (Lf * k) / 2 }}
              transition={{ type: 'spring', stiffness: 120, damping: 16, delay: i * 0.015 }} rx={3}
              fill={ok ? '#8FD48A' : '#FF6B6B'} fillOpacity={sel ? 0.45 : 0.18} stroke={sel ? '#FF4A1C' : ok ? '#8FD48A' : '#FF6B6B'} strokeWidth={sel ? 2.5 : 1.2} />
            <rect x={X(r.col.x) - 4} y={Y(r.col.y) - 4} width={8} height={8} fill="#F4E8DF" />
            <text x={X(r.col.x)} y={Y(r.col.y) + (Lf * k) / 2 + 13} textAnchor="middle" className="num" fontSize="10" fill="#E9C2B8">{r.col.id} · {B.toFixed(2)}{f?.L ? `×${Lf.toFixed(2)}` : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- Footing section with dimensions ---------------- */
export function FootingSection({ B, Df, zw, label }: { B: number; Df: number; zw: number; label: string }) {
  const W = 420, H = 300, k = Math.min(260 / (B + 1.5), 150 / (Df + 1.5)), cx = W / 2, gy = 60;
  const fy = gy + Df * k, t = 0.45 * k;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Section of footing ${label}`}>
      <rect x={0} y={gy} width={W} height={H - gy} fill="#9A7550" fillOpacity="0.18" />
      <path d={`M0 ${gy}H${W}`} stroke="#F4E8DF" strokeOpacity="0.7" />
      <motion.rect initial={{ width: 0, x: cx }} animate={{ width: B * k, x: cx - (B * k) / 2 }} transition={{ type: 'spring', stiffness: 110, damping: 16 }} y={fy - t} height={t} fill="#F4E8DF" fillOpacity="0.85" />
      <rect x={cx - 0.2 * k} y={gy - 40} width={0.4 * k} height={fy - t - gy + 40} fill="#F4E8DF" fillOpacity="0.55" />
      {zw < Df + 3 && <path d={`M0 ${gy + zw * k}H${W}`} stroke="#6CC4D6" strokeDasharray="6 4" />}
      <path d={`M${cx - (B * k) / 2} ${fy + 26}H${cx + (B * k) / 2}M${cx - (B * k) / 2} ${fy + 20}v12M${cx + (B * k) / 2} ${fy + 20}v12`} stroke="#FF4A1C" />
      <text x={cx} y={fy + 44} textAnchor="middle" className="num" fontSize="12" fill="#FF4A1C">B = {B.toFixed(2)} m</text>
      <path d={`M${cx - (B * k) / 2 - 30} ${gy}V${fy}M${cx - (B * k) / 2 - 36} ${gy}h12M${cx - (B * k) / 2 - 36} ${fy}h12`} stroke="#FF4A1C" />
      <text x={cx - (B * k) / 2 - 40} y={(gy + fy) / 2 + 4} textAnchor="end" className="num" fontSize="12" fill="#FF4A1C">Df = {Df.toFixed(2)} m</text>
      <text x={12} y={24} className="hud" fontSize="10" fill="#A88A80">section {label}</text>
    </svg>
  );
}
