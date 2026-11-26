import { useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import { Page } from '../components/layout';
import { Arrow, Button, Card, Chip } from '../components/ui';
import { CountUp, LiquidTitle, Reveal, pl } from '../components/motion';
import { useProject } from '../store/project';
import ShaderBackdrop from '../components/ShaderBackdrop';
import { Magnetic, Marquee } from '../components/extras';
import { soilColor } from '../components/viz';
import { boreholes as exampleBoreholes } from '../examples/mandi';

/* Hero core: BH-1 from the example data (src/examples), drawn as in the approved Figma frame "D · Landing 1440".
   Click (or Enter / Space) separates the core into its layers, each with its own data card; click again to reassemble. */
const BH1 = exampleBoreholes.find((b) => b.id === 'BH-1') ?? exampleBoreholes[0];
const DRIFT = [0, 4, 8, 12, 16, 18, 20];
const f1 = (x: number | undefined, d = 1) => (x === undefined ? '–' : x.toFixed(d));
const STRATA = [...BH1.layers].sort((a, b) => a.top - b.top).map((l, i) => {
  const Ns = BH1.spt.filter((s) => s.depth >= l.top && s.depth < l.bottom && !(s.refusal || s.N >= 100)).map((s) => s.N);
  const refusal = BH1.spt.some((s) => s.depth >= l.top && s.depth < l.bottom && (s.refusal || s.N >= 100));
  const nTxt = refusal && !Ns.length ? 'N > 100' : Ns.length ? `N ${Math.min(...Ns)}${Ns.length > 1 ? '–' + Math.max(...Ns) : ''}` : '';
  const kind = l.behaviour === 'cohesive' ? `cu ≈ ${f1(l.cu, 0)} kPa` : l.behaviour === 'fill' ? 'made ground' : nTxt;
  const info = [
    `${l.top.toFixed(1)}–${l.bottom.toFixed(1)} m · ${(l.bottom - l.top).toFixed(1)} m thick`,
    l.gammaMoist ? `γ ${f1(l.gammaMoist)} / ${f1(l.gammaSat)} kN/m³` : `γsat ${f1(l.gammaSat)} kN/m³`,
    l.behaviour === 'cohesive' ? `cu ${f1(l.cu)} kPa · Cc ${f1(l.Cc, 3)} · e0 ${f1(l.e0, 3)}` : `φ′ ${f1(l.phi)}° · c′ ${f1(l.c)} kPa${nTxt ? ' · ' + nTxt : ''}`,
  ];
  const d = (l.description ?? '').toLowerCase();
  const noun = ['gravel', 'clay', 'silt', 'sand'].find((w) => d.includes(w));
  const short = noun ? `${/silty/.test(d) && noun !== 'silt' ? 'silty ' : ''}${noun}` : l.behaviour;
  return { a: l.top, b: l.bottom, c: soilColor(l.symbol), sym: l.symbol, lab: l.behaviour === 'fill' ? 'made ground' : `${kind} · ${short}`, info, drift: DRIFT[i] ?? 20 };
});
const shade = (h: string, f: number) => '#' + [1, 3, 5].map((i) => Math.round(Math.min(255, parseInt(h.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('');
const GAP = 40; // px between separated layers
/** Where each layer's data card sits when separated (pushed down so thin layers' cards never overlap). */
const cardYs = (top: number, k: number) => {
  const out: number[] = [];
  STRATA.forEach((s, i) => { const c = top + ((s.a + s.b) / 2) * k + i * GAP; out.push(i ? Math.max(c, out[i - 1] + 52) : c); });
  return out;
};

function Layer({ s, i, cx, rw, ry, top, k, scrollY, ready, exploded, cardY }: { s: (typeof STRATA)[number]; i: number; cx: number; rw: number; ry: number; top: number; k: number; scrollY: MotionValue<number>; ready: boolean; exploded: boolean; cardY: number }) {
  const y = useTransform(scrollY, [0, 800], [0, s.drift]);
  const y1 = top + s.a * k, y2 = top + s.b * k, ym = (y1 + y2) / 2;
  const cy = cardY - i * GAP; // card baseline in this layer's own (shifted) frame
  return (
    <g style={{ transform: `translateY(${exploded ? i * GAP : 0}px)`, transition: `transform 0.7s cubic-bezier(.34,1.45,.64,1) ${exploded ? i * 0.05 : (STRATA.length - i) * 0.03}s` }}>
      <motion.g style={{ y }} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: [0.215, 0.61, 0.355, 1] }}>
        <defs>
          <linearGradient id={`lg${i}`} x1={cx - rw} x2={cx + rw} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={shade(s.c, 0.45)} /><stop offset="0.38" stopColor={shade(s.c, 1.12)} /><stop offset="0.75" stopColor={shade(s.c, 0.8)} /><stop offset="1" stopColor={shade(s.c, 0.4)} />
          </linearGradient>
        </defs>
        <path d={`M${cx - rw} ${y1}L${cx - rw} ${y2}A${rw} ${ry} 0 0 0 ${cx + rw} ${y2}L${cx + rw} ${y1}A${rw} ${ry} 0 0 1 ${cx - rw} ${y1}Z`} fill={`url(#lg${i})`} />
        <path d={`M${cx - rw} ${y2}A${rw} ${ry} 0 0 0 ${cx + rw} ${y2}`} stroke="#140806" strokeOpacity="0.55" fill="none" />
        {s.sym === 'CI' && Array.from({ length: Math.floor((y2 - y1 - 12) / 7) }, (_, r) => <path key={r} d={`M${cx - rw + 12 + (r % 2) * 8} ${y1 + 10 + r * 7}h${rw * 2 - 30}`} stroke="#140806" strokeOpacity="0.3" strokeDasharray="9 7" />)}
        {/^G/.test(s.sym) && Array.from({ length: 30 }, (_, r) => <circle key={r} cx={cx - rw + 14 + (r % 6) * 24 + ((r / 6) | 0) % 2 * 10} cy={y1 + 14 + ((r / 6) | 0) * 18} r={2 + (r % 3)} fill="none" stroke="#140806" strokeOpacity="0.35" />)}
        {/^S/.test(s.sym) && Array.from({ length: Math.floor((y2 - y1 - 6) / 6) * 8 }, (_, r) => <rect key={r} x={cx - rw + 8 + (r % 8) * 18 + (((r / 8) | 0) % 2) * 6} y={y1 + 6 + ((r / 8) | 0) * 6} width={1.3} height={1.3} fill="#140806" fillOpacity="0.4" />)}
        {/* top face of the disc — only seen when the layers are separated */}
        {i > 0 && <motion.ellipse cx={cx} cy={y1} rx={rw} ry={ry} fill={shade(s.c, 1.3)} stroke="#140806" strokeOpacity="0.4" initial={false} animate={{ opacity: exploded ? 1 : 0 }} transition={{ duration: 0.3 }} />}
        {/* collapsed label (stratum + short description) */}
        {i > 0 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: ready && !exploded ? 1 : 0 }} transition={{ delay: exploded ? 0 : 0.2 + i * 0.05 }}>
            <path d={`M${cx + rw + 6} ${ym}H600`} stroke="#F4E8DF" strokeOpacity="0.35" strokeDasharray="2 3" />
            <circle cx={600} cy={ym} r={2.5} fill="#F4E8DF" />
            <text x={610} y={ym - 4} className="num" fontSize="11" fontWeight={600} fill="#F4E8DF">{s.sym}</text>
            <text x={610} y={ym + 11} className="num" fontSize="10" fill="#A88A80">{s.lab}</text>
          </motion.g>
        )}
        {/* data card for the separated layer, with a leader to its disc */}
        <g style={{ pointerEvents: 'none', opacity: exploded ? 1 : 0, transform: `translateX(${exploded ? 0 : -12}px)`, transition: `opacity 0.35s ease ${exploded ? 0.2 + i * 0.06 : 0}s, transform 0.35s ease ${exploded ? 0.2 + i * 0.06 : 0}s` }}>
          <path d={`M${cx + rw + 6} ${ym}H570L590 ${cy - 4}H600`} stroke="#F4E8DF" strokeOpacity="0.45" strokeDasharray="2 3" fill="none" />
          <circle cx={600} cy={cy - 4} r={2.5} fill="#FF4A1C" />
          <text x={610} y={cy} className="num" fontSize="11.5" fontWeight={700} fill="#F4E8DF">{s.sym}</text>
          {s.info.map((t, j) => <text key={j} x={610} y={cy + 14 + j * 13} className="num" fontSize="10" fill={j === 0 ? '#E9C2B8' : '#A88A80'}>{t}</text>)}
        </g>
      </motion.g>
    </g>
  );
}

function Core({ ready }: { ready: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const coreY = useTransform(scrollY, [0, 800], [0, -60]);
  const [hz, setHz] = useState<number | null>(null);
  const [exploded, setExploded] = useState(false);
  const W = 820, H = 740, cx = 380, rw = 78, ry = 17, top = 150, k = 360 / 15;
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (exploded) return;
    const r = ref.current!.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * H;
    const z = (y - top) / k;
    setHz(z >= 0 && z <= 15 ? z : null);
  };
  const toggle = () => { setExploded((v) => !v); setHz(null); };
  const orb = [[0.7, 114, ''], [1.6, 164, ''], [2.9, 224, '7 5'], [4.4, 282, '3 6']] as const;
  const wy = top + BH1.measuredWT * k;
  const stratum = hz === null ? null : STRATA.find((s) => hz >= s.a && hz < s.b) ?? STRATA[STRATA.length - 1];
  const fade = { opacity: exploded ? 0 : 1 };
  const cards = cardYs(top, k);
  return (
    <div className="relative">
      <motion.svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full cursor-pointer select-none outline-none" style={{ y: coreY }} onMouseMove={onMove} onMouseLeave={() => setHz(null)}
        onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        role="button" tabIndex={0} aria-pressed={exploded} aria-label={`Soil core of ${BH1.id}. ${exploded ? 'Layers separated — activate to reassemble.' : 'Activate to separate the layers.'}`}>
        {/* WT plane + back halves of the pressure-bulb rings (hidden while the layers are separated) */}
        <motion.g animate={fade} transition={{ duration: 0.3 }}>
          <motion.ellipse cx={cx} cy={wy} rx={320} ry={56} fill="none" stroke="#F4E8DF" strokeOpacity="0.3" strokeDasharray="2 6" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: 1.2 }} />
          {orb.map(([d, rx, dash], i) => (
            <motion.path key={'b' + i} d={`M${cx - rx} ${top + d * k}A${rx} ${rx * 0.2} 0 0 1 ${cx + rx} ${top + d * k}`} fill="none" stroke="#FF4A1C" strokeOpacity={0.35 - i * 0.06} strokeWidth={1.4} strokeDasharray={dash || undefined}
              initial={pl({ pathLength: 0 })} animate={pl({ pathLength: ready ? 1 : 0 })} transition={{ duration: 1.2, delay: 0.9 + i * 0.15 }} />
          ))}
        </motion.g>
        {STRATA.map((s, i) => <Layer key={s.sym + i} s={s} i={i} cx={cx} rw={rw} ry={ry} top={top} k={k} scrollY={scrollY} ready={ready} exploded={exploded} cardY={cards[i]} />)}
        {/* cap, footing, column, load */}
        <ellipse cx={cx} cy={top} rx={rw} ry={ry} fill={shade(STRATA[0]?.c ?? '#6B4535', 1.25)} />
        <g style={{ transform: `translateY(${exploded ? -26 : 0}px)`, transition: 'transform 0.6s cubic-bezier(.34,1.45,.64,1)' }}>
        <motion.g initial={{ y: -40, opacity: 0 }} animate={{ y: ready ? 0 : -40, opacity: ready ? 1 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.8 }}>
          <path d={`M${cx - 58} ${top - 4}L${cx} ${top + 9}L${cx + 58} ${top - 4}V${top - 17}L${cx} ${top - 4}L${cx - 58} ${top - 17}Z`} fill={shade('#F4E8DF', 0.62)} />
          <path d={`M${cx - 58} ${top - 17}L${cx} ${top - 30}L${cx + 58} ${top - 17}L${cx} ${top - 4}Z`} fill="#F4E8DF" />
          <path d={`M${cx - 10} ${top - 17}V${top - 75}L${cx} ${top - 81}L${cx + 10} ${top - 75}V${top - 17}L${cx} ${top - 12}Z`} fill={shade('#F4E8DF', 0.8)} />
          <motion.g animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
            <path d={`M${cx} ${top - 128}V${top - 90}M${cx - 7} ${top - 98}L${cx} ${top - 86}L${cx + 7} ${top - 98}`} stroke="#FF4A1C" strokeWidth="2.5" fill="none" />
            <text x={cx + 10} y={top - 122} className="num" fontSize="13" fontWeight={600} fill="#FF4A1C">P</text>
          </motion.g>
        </motion.g>
        </g>
        {/* front halves of the rings + nodes */}
        <motion.g animate={fade} transition={{ duration: 0.3 }}>
          {orb.map(([d, rx, dash], i) => (
            <g key={'f' + i}>
              <motion.path d={`M${cx - rx} ${top + d * k}A${rx} ${rx * 0.2} 0 0 0 ${cx + rx} ${top + d * k}`} fill="none" stroke="#FF4A1C" strokeOpacity={1 - i * 0.18} strokeWidth={1.6} strokeDasharray={dash || undefined}
                initial={pl({ pathLength: 0 })} animate={pl({ pathLength: ready ? 1 : 0 })} transition={{ duration: 1.2, delay: 0.9 + i * 0.15, ease: [0.215, 0.61, 0.355, 1] }} />
              <motion.circle cx={cx - rx} cy={top + d * k} r={3.5} fill="#FF4A1C" initial={{ scale: 0 }} animate={{ scale: ready ? 1 : 0 }} transition={{ delay: 1.6 + i * 0.1 }} />
              <motion.text x={cx - rx - 42} y={top + d * k + 4} className="num" fontSize="11" fontWeight={600} fill="#FF4A1C" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: 1.8 + i * 0.1 }}>{['0.8q', '0.5q', '0.2q', '0.1q'][i]}</motion.text>
            </g>
          ))}
          <text x={cx + 150} y={wy + 46} className="num" fontSize="10" fill="#6CC4D6">▽ WT {BH1.measuredWT.toFixed(2)} m</text>
        </motion.g>
        <text x={cx + 70} y={top - 46} className="num" fontSize="10" fill="#F4E8DF" style={{ transform: `translateY(${exploded ? -26 : 0}px)`, transition: 'transform 0.6s ease' }}>FOOTING · Df 1.50 m</text>
        {/* depth ruler */}
        <motion.g animate={fade}>
          <path d={`M806 ${top}V${top + 15 * k}`} stroke="#F4E8DF" strokeOpacity="0.5" />
          {Array.from({ length: 16 }, (_, d) => <path key={d} d={`M806 ${top + d * k}h${d % 5 ? -6 : -12}`} stroke="#F4E8DF" strokeOpacity="0.5" />)}
          <text x={792} y={top - 10} textAnchor="end" className="num" fontSize="9" fill="#A88A80">0 m</text>
          <text x={792} y={top + 15 * k + 14} textAnchor="end" className="num" fontSize="9" fill="#A88A80">15 m</text>
        </motion.g>
        {/* crosshair readout */}
        {!exploded && hz !== null && stratum && (
          <g pointerEvents="none">
            <path d={`M0 ${top + hz * k}H${W}`} stroke="#FF4A1C" strokeOpacity="0.6" strokeDasharray="2 4" />
            <rect x={cx - rw - 150} y={top + hz * k - 26} width={138} height={22} rx={11} fill="#140806" stroke="#FF4A1C" strokeOpacity="0.7" />
            <text x={cx - rw - 81} y={top + hz * k - 11} textAnchor="middle" className="num" fontSize="11" fill="#F4E8DF">z = {hz.toFixed(2)} m · {stratum.sym}</text>
          </g>
        )}
      </motion.svg>
      <motion.div className="hud pointer-events-none absolute bottom-2 left-[22%] flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: 2.2 }}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />{exploded ? 'click to reassemble the core' : `click the core to separate the layers · ${BH1.id}`}
      </motion.div>
    </div>
  );
}

function GiantWord({ ready }: { ready: boolean }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 90]);
  const opacity = useTransform(scrollY, [0, 500, 800], [1, 0.85, 0.25]);
  return (
    <motion.div style={{ y, opacity }} className="pointer-events-none relative mt-6 select-none overflow-hidden" aria-hidden>
      <div className="flex justify-between font-giant text-[21.5vw] leading-[0.8] tracking-[-0.01em] text-ink">
        {'GEOFOUND'.split('').map((ch, i) => (
          <motion.span key={i} initial={{ y: '100%' }} animate={{ y: ready ? '0%' : '100%' }} transition={{ duration: 1, delay: 0.5 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}>{ch}</motion.span>
        ))}
      </div>
    </motion.div>
  );
}

const TICKER_A = [
  'BH-1 · N 13 @ 1.50 m → N″ 17.3', 'σ′v 22.2 kPa · CN 1.505', 'BH-2 · SP N 34 @ 7.50 m', 'BH-3 · CI N 4 @ 4.50 m — soft clay',
  'WT design 0.60 m (Aug) · measured 1.90 m', 'UDS-1 cu 28.5 kPa', 'Cc 0.292 · Cr 0.038 · σ′p ≈ 115 kPa', 'φ′ 29.99° · c′ 1.03 kPa (SM, soaked)',
  'GW refusal >100 @ 12.0 m', 'λ = 1.08 · group 8',
];
const TICKER_B = ['IS 6403:1981', 'BEARING CAPACITY', 'IS 1904:1986', 'SETTLEMENT', 'IS 2131:1981', 'SPT N', 'BOUSSINESQ', 'SCHMERTMANN 1978', 'CONSOLIDATION'];

const TEAM = [
  { name: 'Harshit Pandey', tag: 'UI · UX', role: 'GeoFound UI/UX design and front-end, visual direction and motion, integration of the team engines, deployment.', lead: true },
  { name: 'Parash Sharma', tag: 'P1 · P2', role: 'Soil-profile engine; IS 2131 SPT corrections and direct-shear least squares; v1 platform architecture.' },
  { name: 'Gaurav Dtyal', tag: 'P3', role: 'IS 6403:1981 bearing-capacity engine — shape, depth, inclination and water-table factors.' },
  { name: 'Namit Mehta', tag: 'P4', role: 'Stress increase — Boussinesq superposition under centre and corner, and the 2:1 method.' },
  { name: 'Muvan', tag: 'P5', role: 'Settlement engine — Schmertmann (1978), 1-D consolidation and time–settlement.' },
];

const METHOD = [
  { n: '01', t: 'Enter the ground', b: 'Boreholes, water tables and lab sheets. The soil column draws itself as you type each layer.', c: 'IS 1498 · IS 2131', to: '/data' },
  { n: '02', t: 'Correct the data', b: 'SPT N corrected for overburden and dilatancy; c′ and φ′ fitted to direct-shear results by least squares.', c: 'IS 2131:1981', to: '/calculations' },
  { n: '03', t: 'Check capacity', b: 'Net ultimate and net safe bearing capacity with every shape, depth, inclination and water-table factor shown.', c: 'IS 6403:1981', to: '/calculations' },
  { n: '04', t: 'Check settlement', b: 'Schmertmann for sand, 1-D consolidation for clay in 0.5 m sublayers, time–settlement, and the building checks.', c: 'IS 1904:1986', to: '/design' },
];

export default function Landing({ ready }: { ready: boolean }) {
  const nav = useNavigate();
  const loadExample = useProject((s) => s.loadExample);
  const resetBlank = useProject((s) => s.resetBlank);
  return (
    <Page>
      <section className="relative overflow-hidden">
        <ShaderBackdrop />
        <div aria-hidden className="stripes pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ground" />
        <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-6 px-4 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div className="relative z-10">
            <div className="hud mb-8 flex justify-between lg:block"><span>Site · any terrace, any profile</span><span className="lg:hidden">SI units</span></div>
            <div className="hud mb-5 flex items-center gap-2 text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />live ground model</div>
            {ready && <LiquidTitle lines={['Foundation design,', 'read from the', 'ground up.']} className="font-display text-[clamp(42px,5.4vw,84px)] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink" />}
            {!ready && <h1 className="font-display text-[clamp(42px,5.4vw,84px)] font-extrabold leading-[0.95] tracking-[-0.045em] text-transparent">Foundation design, read from the ground up.</h1>}
            <Reveal delay={1.2} className="mt-7 max-w-[30rem] text-[18px] leading-[1.6] text-warm" as="p">
              Enter boreholes, water levels and lab sheets. GeoFound builds the ground model and checks bearing capacity and settlement to IS 6403 and IS 1904 — live, with every factor and clause on screen.
            </Reveal>
            <motion.div className="mt-9 flex flex-wrap gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 16 }} transition={{ delay: 1.5, duration: 0.6 }}>
              <Magnetic><Button label="Start a new site" icon={<Arrow />} onClick={() => { resetBlank(); nav('/data'); }} /></Magnetic>
              <Magnetic><Button label="Open Mandi example" variant="secondary" onClick={async () => { await loadExample(); nav('/data'); }} /></Magnetic>
            </motion.div>
          </div>
          <div className="relative">
            <div className="hud absolute right-0 top-0 hidden text-right lg:block">BH-1 · RL 100.00 m<br />shell & auger · Oct 2026</div>
            <Core ready={ready} />
          </div>
        </div>
        <div className="relative mx-auto flex max-w-[1440px] justify-between px-4 sm:px-8"><span className="hud">FS ≥ 3.0 · IS 6403:1981 · s ≤ IS 1904:1986</span><span className="hud">scroll ↓ 01 / 04</span></div>
        <GiantWord ready={ready} />
      </section>

      <section aria-label="Live borehole readings" className="relative z-10 border-y border-line-soft bg-ground py-5">
        <Marquee speed={55} items={TICKER_A.map((t) => <span key={t} className="num whitespace-nowrap text-[13px] text-warm">{t}</span>)} />
        <Marquee speed={70} reverse className="mt-3" items={TICKER_B.map((t) => <span key={t} className="font-giant whitespace-nowrap text-[34px] leading-none tracking-[0.02em] text-ink/80">{t}</span>)} />
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-24 sm:px-8">
        <div className="mb-14 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="hud mb-4 flex items-center gap-2 text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />the method · 02</div>
            <Reveal className="font-display text-[clamp(32px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.035em]" as="p">From borehole to footing,</Reveal>
            <Reveal delay={0.1} className="font-display text-[clamp(32px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.035em] text-warm" as="p">in four steps you can audit.</Reveal>
          </div>
          <Reveal delay={0.2} className="self-end text-[17px] leading-[1.65] text-warm" as="p">
            Every step shows the equation, the numbers substituted into it, the result with its unit, and the IS clause it came from. Nothing is a black box — you stay the engineer of record.
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {METHOD.map((m, i) => (
            <motion.div key={m.n} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: 0.7, delay: i * 0.1, ease: [0.215, 0.61, 0.355, 1] }}>
              <Card className="group flex h-full cursor-pointer flex-col p-6" onClick={() => nav(m.to)}>
                <div className="flex items-start justify-between">
                  <span className="font-giant text-[96px] leading-[0.8] text-ink transition-colors duration-300 group-hover:text-accent">{m.n}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-warm transition-all duration-300 group-hover:rotate-[-45deg] group-hover:border-accent group-hover:bg-accent group-hover:text-ground"><Arrow /></span>
                </div>
                <h3 className="mt-10 font-display text-[24px] font-bold tracking-[-0.02em]">{m.t}</h3>
                <p className="mt-3 flex-1 text-[15px] leading-[1.6] text-warm">{m.b}</p>
                <div className="mt-6"><Chip>{m.c}</Chip></div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <Card interactive={false} className="relative grid gap-10 overflow-hidden p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <ShaderBackdrop tone={0.6} className="opacity-90" />
          <div className="relative">
            <div className="hud mb-4">assignment modules</div>
            <p className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">Five modules. One ground model. Every number traceable.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {['P1 Soil profile', 'P2 Parameter tools', 'P3 Bearing capacity', 'P4 Stress increase', 'P5 Settlement'].map((x) => <Chip key={x}>{x}</Chip>)}
            </div>
            <div className="mt-10"><Magnetic><Button label="Open the Mandi example" icon={<Arrow />} onClick={async () => { await loadExample(); nav('/design'); }} /></Magnetic></div>
          </div>
          <div className="relative grid grid-cols-2 gap-4 self-center">
            {[[28, 0, 'columns on a 5 m grid'], [3, 0, 'boreholes, west → east'], [1.08, 2, 'load factor λ (group 8)'], [15, 0, 'm of borehole each']].map(([v, dp, l]) => (
              <div key={String(l)} className="rounded-2xl border border-line-soft bg-sunken/70 p-5 backdrop-blur-sm">
                <CountUp value={v as number} dp={dp as number} className="font-giant text-[56px] leading-none text-ink" />
                <div className="mt-2 text-[13px] text-warm">{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pt-24 sm:px-8" aria-label="Team">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="hud mb-3 flex items-center gap-2 text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />the team · group 8</div>
            <Reveal className="font-display text-[clamp(30px,4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.035em]" as="p">Built by Group 8.</Reveal>
          </div>
          <span className="hud">CE 402 Geotechnical Engineering · IIT Mandi</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {TEAM.map((m, i) => (
            <motion.div key={m.name} className={m.lead ? 'sm:col-span-2 xl:col-span-1' : ''} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.08 }}>
              <Card className={`flex h-full flex-col p-6 ${m.lead ? 'border-accent/60' : ''}`}>
                <div className="mb-6 flex items-center justify-between">
                  <span className={`grid h-12 w-12 place-items-center rounded-full font-giant text-[22px] ${m.lead ? 'bg-accent text-ground' : 'bg-sunken text-ink ring-1 ring-line'}`}>{m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                  <span className="font-mono text-[11px] text-accent">{m.tag}</span>
                </div>
                <div className="font-display text-[20px] font-bold leading-tight">{m.name}</div>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-warm">{m.role}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </Page>
  );
}
