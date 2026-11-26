import { useRef, type ReactNode, type MouseEvent } from 'react';
import { motion, useScroll, useSpring, useMotionValue } from 'framer-motion';

/** Endless ticker (CSS transform only). Pauses on hover; stops under reduced motion via global CSS. */
export function Marquee({ items, reverse = false, speed = 40, className = '' }: { items: ReactNode[]; reverse?: boolean; speed?: number; className?: string }) {
  const row = (k: string) => (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={k === 'b'}>
      {items.map((it, i) => (<div key={k + i} className="flex shrink-0 items-center gap-10">{it}<span className="h-1.5 w-1.5 rotate-45 bg-accent" /></div>))}
    </div>
  );
  return (
    <div className={`group relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] ${className}`}>
      <div className="flex w-max group-hover:[animation-play-state:paused]" style={{ animation: `gf-marquee ${speed}s linear infinite ${reverse ? 'reverse' : ''}` }}>
        {row('a')}{row('b')}
      </div>
    </div>
  );
}

/** Thin orange scroll-progress line. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-accent" style={{ scaleX: x }} />;
}

/** Wraps a child so it is pulled gently toward the cursor (magnetic). */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15 }), sy = useSpring(y, { stiffness: 220, damping: 15 });
  const move = (e: MouseEvent) => { const b = ref.current!.getBoundingClientRect(); x.set((e.clientX - b.left - b.width / 2) * strength); y.set((e.clientY - b.top - b.height / 2) * strength); };
  return <motion.div ref={ref} onMouseMove={move} onMouseLeave={() => { x.set(0); y.set(0); }} style={{ x: sx, y: sy }} className="inline-block">{children}</motion.div>;
}
