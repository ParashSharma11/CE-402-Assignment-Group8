import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Lenis from 'lenis';
import { ScrambleText, pl } from './motion';
import { useProject } from '../store/project';
import { ScrollProgress } from './extras';

/* ---------------- Smooth scroll (Lenis) ---------------- */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  const loc = useLocation();
  const lenis = useRef<Lenis | null>(null);
  useEffect(() => {
    if (reduce) return;
    const l = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.current = l;
    let id = 0;
    const raf = (t: number) => { l.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); l.destroy(); lenis.current = null; };
  }, [reduce]);
  useEffect(() => { lenis.current ? lenis.current.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0); }, [loc.pathname]);
  return null;
}

/* ---------------- Film grain (drawn once, fixed, 5 %) ---------------- */
export function Grain() {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const T = 220, c = document.createElement('canvas'); c.width = c.height = T;
    const cx = c.getContext('2d'); if (!cx) return;
    const img = cx.createImageData(T, T), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() < 0.08 ? 0.4 + Math.random() * 0.6 : 0; d[i] = 244; d[i + 1] = 232; d[i + 2] = 223; d[i + 3] = 255 * v; }
    cx.putImageData(img, 0, 0);
    setUrl(c.toDataURL());
  }, []);
  if (!url) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05] mix-blend-screen" style={{ backgroundImage: `url(${url})`, backgroundSize: '220px' }} />;
}

/* ---------------- Loader: depth counter 0 → 15 m, core fills, rings draw ---------------- */
export function Loader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (reduce) { onDone(); return; }
    const t0 = performance.now(), D = 2200; let id = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / D); setP(1 - Math.pow(1 - k, 3)); if (k < 1) id = requestAnimationFrame(tick); else setTimeout(onDone, 350); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [reduce, onDone]);
  const layers = [[0, 0.04, '#6B4535'], [0.04, 0.23, '#9A7550'], [0.23, 0.39, '#B89A68'], [0.39, 0.71, '#6A625E'], [0.71, 1, '#857565']] as const;
  const H = 220;
  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-ground" exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}>
      <div className="stripes absolute inset-0" />
      {[['left-6 top-6', 'M0 14V0h14'], ['right-6 top-6', 'M14 14V0H0'], ['bottom-6 left-6', 'M0 0v14h14'], ['bottom-6 right-6', 'M14 0v14H0']].map(([pos, d]) => (
        <svg key={pos} className={`absolute ${pos}`} width="14" height="14" aria-hidden><motion.path d={d} stroke="#F4E8DF" strokeWidth="1.5" fill="none" animate={{ opacity: [0, 1, 0.3, 1] }} transition={{ duration: 0.6 }} /></svg>
      ))}
      <div className="relative flex flex-col items-center gap-8">
        <svg width="260" height="300" viewBox="-130 -40 260 300" aria-hidden>
          {layers.map(([a, b, c], i) => {
            const fill = Math.max(0, Math.min(1, (p - a) / (b - a)));
            return <rect key={i} x={-34} y={a * H} width={68} height={(b - a) * H * fill} rx={i === 0 ? 6 : 0} fill={c} />;
          })}
          <rect x={-34} y={0} width={68} height={H} rx={6} fill="none" stroke="#4A3A34" />
          {[0.12, 0.28, 0.46, 0.66].map((d, i) => (
            <motion.ellipse key={i} cx={0} cy={d * H} rx={50 + i * 26} ry={(50 + i * 26) * 0.2} fill="none" stroke="#FF4A1C" strokeOpacity={1 - i * 0.18} strokeWidth={1.4}
              initial={pl({ pathLength: 0 })} animate={pl({ pathLength: Math.max(0, Math.min(1, (p - 0.1 - i * 0.1) / 0.4)) })} transition={{ duration: 0 }} />
          ))}
          <path d={`M-60 ${0.18 * H} H60`} stroke="#6CC4D6" strokeDasharray="3 4" opacity={p > 0.3 ? 0.8 : 0} />
        </svg>
        <div className="text-center">
          <div className="num text-[44px] font-semibold leading-none text-ink">{(p * 15).toFixed(2)}<span className="ml-2 text-[16px] text-muted">m bgl</span></div>
          <div className="hud mt-3">reading the ground · {Math.round(p * 100).toString().padStart(3, '0')}%</div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Page transition: a section-cut wipe ---------------- */
export function Page({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.main initial="enter" animate="show" exit="leave" className="relative">
      {!reduce && (
        <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[80]"
          variants={{ enter: { x: '0%' }, show: { x: '102%', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1], delay: 0.05 } }, leave: { x: ['-102%', '0%'], transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] } } }}>
          <div className="absolute inset-0 bg-raised" style={{ clipPath: 'polygon(0 0, 97% 0, 99% 12%, 96.5% 27%, 99.5% 41%, 97% 58%, 100% 73%, 97.5% 88%, 99% 100%, 0 100%)' }} />
          <div className="absolute inset-y-0 right-[1.5%] w-[2px] bg-accent shadow-[0_0_24px_4px_rgb(255_74_28/0.5)]" />
        </motion.div>
      )}
      <motion.div variants={{ enter: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.25, ease: [0.215, 0.61, 0.355, 1] } }, leave: { opacity: 0, transition: { duration: 0.3 } } }}>
        {children}
      </motion.div>
    </motion.main>
  );
}

/* ---------------- Navigation ---------------- */
const LINKS = [['/data', 'Data', 'I'], ['/ground', 'Ground', 'II'], ['/calculations', 'Calculations', 'III'], ['/design', 'Design', 'IV'], ['/summary', 'Summary', 'V']] as const;

export function Nav() {
  const name = useProject((s) => s.project.name);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <header className="no-print sticky top-0 z-50 border-b border-line-soft/80 bg-ground/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-8">
        <NavLink to="/" className="font-giant text-[26px] leading-none tracking-[0.02em] text-ink">GEOFOUND</NavLink>
        <span className="hud hidden truncate lg:block">{name}</span>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto" aria-label="Main">
          {LINKS.map(([to, label, roman]) => (
            <NavLink key={to} to={to} onMouseEnter={() => setHover(to)} onMouseLeave={() => setHover(null)}
              className={({ isActive }) => `relative rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-ink/8 ring-1 ring-line" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <ScrambleText text={label} active={hover === to ? true : undefined} key={hover === to ? 'h' : 'n'} />
                <sup className="ml-1 text-[8px] text-muted">{roman}</sup>
              </>)}
            </NavLink>
          ))}
        </nav>
      </div>
      <ScrollProgress />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print mt-24 border-t border-line-soft">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8">
        <span className="hud">GeoFound · CE 402 · IIT Mandi · Group 8 — UI/UX Harshit Pandey · P1–P2 Parash Sharma · P3 Gaurav Dtyal · P4 Namit Mehta · P5 Muvan</span>
        <span className="hud">IS 6403:1981 · IS 1904:1986 · IS 2131:1981 · SI units</span>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-10 sm:px-8">{children}</div>;
}

export { AnimatePresence };
