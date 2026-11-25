import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Hover scramble (after Neuroform's scramble.js): letters re-roll and lock left → right. */
export function ScrambleText({ text, className, active }: { text: string; className?: string; active?: boolean }) {
  const [out, setOut] = useState(text);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const raf = useRef(0);
  const run = () => {
    if (reduce) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now(), dur = 520, lead = 0.25;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const lock = Math.max(0, (t - lead) / (1 - lead)) * text.length;
      setOut(text.split('').map((ch, i) => (ch === ' ' || i < lock ? ch : CHARS[(Math.random() * CHARS.length) | 0])).join(''));
      if (t < 1) raf.current = requestAnimationFrame(tick); else setOut(text);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => { if (active) run(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setOut(text); }, [text]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // lock width so neighbours don't shift
  const [w, setW] = useState<number>();
  useLayoutEffect(() => { if (ref.current) setW(ref.current.getBoundingClientRect().width); }, [text]);
  return (
    <span ref={ref} aria-label={text} onMouseEnter={active === undefined ? run : undefined} className={className} style={{ display: 'inline-block', minWidth: w, whiteSpace: 'pre' }}>
      <span aria-hidden>{out}</span>
    </span>
  );
}

/** Number that counts up to its value when it scrolls into view and eases to new values afterwards. */
export function CountUp({ value, dp = 1, className, suffix }: { value: number; dp?: number; className?: string; suffix?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  const last = useRef(0);
  useEffect(() => {
    const el = ref.current; if (!el || !inView || !Number.isFinite(value)) { if (el && !Number.isFinite(value)) el.textContent = '—'; return; }
    if (reduce) { el.textContent = value.toFixed(dp); last.current = value; return; }
    const c = animate(last.current, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = v.toFixed(dp); } });
    last.current = value;
    return () => c.stop();
  }, [value, inView, dp, reduce]);
  return <span className={className}><span ref={ref} className="num">0</span>{suffix}</span>;
}

/** Lines rise into a mask when visible (after Neuroform's lines.js). Children: one string per line or a paragraph. */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'p' | 'span' }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-8% 0px' });
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <div ref={ref} className="overflow-hidden" style={{ paddingBottom: 2 }}>
      <Tag className={className} initial={reduce ? false : { y: '110%' }} animate={inView ? { y: 0 } : { y: '110%' }} transition={{ duration: 1.1, ease: [0.215, 0.61, 0.355, 1], delay }}>
        {children}
      </Tag>
    </div>
  );
}

/** Headline "liquid" reveal: each line arrives as a blurred blob, a contrast threshold fuses it, then it sharpens. */
export function LiquidTitle({ lines, className }: { lines: string[]; className?: string }) {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(!!reduce);
  useEffect(() => { if (reduce) return; const t = setTimeout(() => setDone(true), 400 + lines.length * 280 + 900); return () => clearTimeout(t); }, [reduce, lines.length]);
  return (
    <h1 className={`${className ?? ''} ${done ? '' : 'liquid'}`} aria-label={lines.join(' ')}>
      {lines.map((l, i) => (
        <motion.span key={i} aria-hidden className="block" initial={reduce ? false : { filter: 'blur(22px)', opacity: 0, scaleX: 0.92 }}
          animate={{ filter: 'blur(0px)', opacity: 1, scaleX: 1 }} transition={{ duration: 1.1, delay: 0.25 + i * 0.28, ease: [0.215, 0.61, 0.355, 1] }} style={{ transformOrigin: 'left center' }}>
          {l}
        </motion.span>
      ))}
    </h1>
  );
}

/** SVG path that draws itself (trim path) when in view. */
export function DrawPath(props: React.SVGProps<SVGPathElement> & { delay?: number; duration?: number }) {
  const { delay = 0, duration = 1.4, ...rest } = props;
  const reduce = useReducedMotion();
  return (
    <motion.path {...(rest as object)} initial={reduce ? false : pl({ pathLength: 0, opacity: 0 })} whileInView={pl({ pathLength: 1, opacity: 1 })} viewport={{ once: true }}
      transition={{ pathLength: { duration, delay, ease: [0.215, 0.61, 0.355, 1] }, opacity: { duration: 0.2, delay } }} />
  );
}

/** framer-motion 11.18 types reject `pathLength` in SVG animation targets; runtime supports it. */
export const pl = (target: Record<string, unknown>) => target as never;
