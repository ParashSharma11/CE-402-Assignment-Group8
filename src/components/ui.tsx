import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RSlider from '@radix-ui/react-slider';
import * as RSwitch from '@radix-ui/react-switch';
import * as RTabs from '@radix-ui/react-tabs';
import { ScrambleText } from './motion';
import type { Step } from '../engine';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------------- Card with cursor spotlight + lift ---------------- */
export function Card({ children, className, interactive = true, as = 'div', ...rest }: { children: ReactNode; className?: string; interactive?: boolean; as?: 'div' | 'section' | 'article' } & React.HTMLAttributes<HTMLDivElement>) {
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const Tag = motion[as];
  return (
    <Tag
      onMouseMove={interactive ? onMove : undefined}
      whileHover={interactive ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={cx('spot rounded-[var(--radius-card)] border border-line-soft bg-raised/80 shadow-[0_1px_0_0_rgb(244_232_223/0.04)_inset,0_20px_40px_-24px_rgb(0_0_0/0.6)]',
        interactive && 'transition-[border-color,box-shadow] duration-300 hover:border-line hover:shadow-[0_1px_0_0_rgb(244_232_223/0.06)_inset,0_30px_60px_-28px_rgb(255_74_28/0.25)]', className)}
      {...(rest as object)}
    >
      {children}
    </Tag>
  );
}

/* ---------------- Buttons (scramble label on hover) ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'sm'; to?: string; icon?: ReactNode; label: string };
const btnCls = (variant: BtnProps['variant'], size: BtnProps['size']) => cx(
  'group relative inline-flex items-center justify-center gap-2 rounded-full font-mono font-semibold uppercase tracking-[0.12em] transition-[background,color,border-color,transform,box-shadow] duration-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none',
  size === 'sm' ? 'h-9 px-4 text-[11px]' : 'h-12 px-6 text-[12px]',
  variant === 'primary' && 'bg-accent text-ground hover:shadow-[0_10px_30px_-8px_rgb(255_74_28/0.7)] hover:-translate-y-0.5',
  variant === 'secondary' && 'border border-ink/25 text-ink hover:border-ink/60 hover:bg-ink/5 hover:-translate-y-0.5',
  variant === 'ghost' && 'text-warm hover:text-ink hover:bg-ink/5',
);
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', to, icon, label, className, ...rest }, ref) {
  const [h, setH] = useState(0);
  const inner = (<><ScrambleText text={label} active={h > 0 ? true : undefined} key={h} />{icon && <span className="transition-transform duration-300 group-hover:translate-x-1">{icon}</span>}</>);
  if (to) return <Link to={to} onMouseEnter={() => setH((x) => x + 1)} className={cx(btnCls(variant, size), className)}>{inner}</Link>;
  return <button ref={ref} onMouseEnter={() => setH((x) => x + 1)} className={cx(btnCls(variant, size), className)} {...rest}>{inner}</button>;
});
export const Arrow = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M1 7h11M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ---------------- Inputs ---------------- */
export function Field({ label, unit, value, onChange, step = 'any', min, max, hint, className, width = 'w-full' }: { label: string; unit?: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number | 'any'; min?: number; max?: number; hint?: string; className?: string; width?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined || Number.isNaN(value) ? '' : String(+value.toFixed(6)));
  return (
    <label className={cx('group block', className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-warm">{label}</span>
      <span className={cx('flex items-center rounded-[var(--radius-ctl)] border border-line-soft bg-sunken/70 transition-colors duration-200 focus-within:border-accent/70 focus-within:bg-sunken hover:border-line', width)}>
        <input
          type="number" inputMode="decimal" step={step} min={min} max={max} value={shown}
          onChange={(e) => { setDraft(e.target.value); const v = e.target.value === '' ? undefined : Number(e.target.value); if (v === undefined || Number.isFinite(v)) onChange(v); }}
          onBlur={() => setDraft(null)}
          className="num min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        {unit !== undefined && <span className="num shrink-0 pr-3 text-[12px] text-muted">{unit || '–'}</span>}
      </span>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-warm">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[var(--radius-ctl)] border border-line-soft bg-sunken/70 px-3 py-2.5 text-[15px] text-ink outline-none transition-colors hover:border-line focus:border-accent/70" />
    </label>
  );
}

export function Select<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-warm">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full appearance-none rounded-[var(--radius-ctl)] border border-line-soft bg-sunken/70 px-3 py-2.5 text-[15px] text-ink outline-none transition-colors hover:border-line focus:border-accent/70">
        {options.map((o) => <option key={o.value} value={o.value} className="bg-raised">{o.label}</option>)}
      </select>
    </label>
  );
}

export function SliderField({ label, unit, value, min, max, step, onChange, dp = 2 }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; dp?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-warm">{label}</span>
        <span className="num text-[15px] text-ink">{value.toFixed(dp)} <span className="text-[12px] text-muted">{unit}</span></span>
      </div>
      <RSlider.Root value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="relative flex h-5 w-full touch-none select-none items-center" aria-label={label}>
        <RSlider.Track className="relative h-[3px] grow rounded-full bg-line"><RSlider.Range className="absolute h-full rounded-full bg-accent" /></RSlider.Track>
        <RSlider.Thumb className="block h-5 w-5 rounded-full border-2 border-accent bg-ground shadow-[0_0_0_4px_rgb(255_74_28/0.15)] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      </RSlider.Root>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[13px] text-warm">
      <RSwitch.Root checked={checked} onCheckedChange={onChange} className="relative h-6 w-11 shrink-0 rounded-full border border-line bg-sunken transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent/25">
        <RSwitch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-muted transition-transform duration-200 data-[state=checked]:translate-x-6 data-[state=checked]:bg-accent" />
      </RSwitch.Root>
      {label}
    </label>
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs({ tabs, value, onChange, children }: { tabs: { value: string; label: string }[]; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <RTabs.Root value={value} onValueChange={onChange}>
      <RTabs.List className="relative inline-flex rounded-full border border-line-soft bg-sunken/70 p-1">
        {tabs.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} className="relative z-10 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted transition-colors data-[state=active]:text-ground">
            {value === t.value && <motion.span layoutId="tab-pill" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}
export const TabPanel = RTabs.Content;

/* ---------------- Badges / chips ---------------- */
export function Badge({ status, children }: { status: 'pass' | 'fail' | 'warn' | 'info'; children?: ReactNode }) {
  const c = { pass: 'text-pass border-pass/40 bg-pass/10', fail: 'text-fail border-fail/40 bg-fail/10', warn: 'text-warn border-warn/40 bg-warn/10', info: 'text-warm border-line bg-ink/5' }[status];
  const dot = { pass: 'bg-pass', fail: 'bg-fail', warn: 'bg-warn', info: 'bg-muted' }[status];
  return (
    <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
      className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]', c)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />{children ?? status}
    </motion.span>
  );
}
export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'verify' }) {
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.06em]', tone === 'verify' ? 'border-warn/40 text-warn' : 'border-line text-warm')}>{children}</span>;
}

/* ---------------- Stepper ---------------- */
export function Stepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect?: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'next';
        return (
          <li key={s} className="flex items-center gap-2">
            <button onClick={() => onSelect?.(i)} className={cx('group flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 transition-colors', state === 'now' ? 'border-accent/70 bg-accent/10' : 'border-line-soft hover:border-line')}>
              <span className={cx('grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-semibold transition-colors', state === 'done' ? 'bg-ink text-ground' : state === 'now' ? 'bg-accent text-ground' : 'bg-sunken text-muted')}>
                {state === 'done' ? '✓' : String(i + 1).padStart(2, '0')}
              </span>
              <span className={cx('text-[13px]', state === 'next' ? 'text-muted' : 'text-ink')}>{s}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="relative h-px w-6 bg-line">
                <motion.span className="absolute inset-y-0 left-0 bg-accent" initial={false} animate={{ width: i < current ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Step card (equation → substituted → result → clause) ---------------- */
export function StepCard({ step, index }: { step: Step; index: number }) {
  const verify = /TO VERIFY/i.test(step.source);
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ duration: 0.6, delay: Math.min(index, 8) * 0.05, ease: [0.215, 0.61, 0.355, 1] }}>
      <Card className="h-full p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="font-mono text-[11px] text-muted">{String(index + 1).padStart(2, '0')}</span>
          <Chip tone={verify ? 'verify' : 'default'}>{step.source}</Chip>
        </div>
        <h4 className="font-display text-[17px] font-bold leading-tight text-ink">{step.title}</h4>
        <p className="num mt-3 text-[13px] leading-relaxed text-warm">{step.equation}</p>
        {step.substituted && <p className="num mt-1 text-[12px] leading-relaxed text-muted">{step.substituted}</p>}
        <div className="mt-4 flex items-baseline gap-2 border-t border-line-soft pt-3">
          <span className="num text-[26px] font-semibold text-ink">{Number.isFinite(step.value) ? +step.value.toFixed(Math.abs(step.value) < 1 ? 4 : 2) : '—'}</span>
          <span className="num text-[13px] text-muted">{step.unit}</span>
        </div>
        {step.note && <p className="mt-2 text-[12px] text-warn">{step.note}</p>}
      </Card>
    </motion.div>
  );
}

/* ---------------- Section heading with HUD label ---------------- */
export function SectionHead({ k, title, sub, right }: { k: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="hud mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{k}</div>
        <h2 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">{title}</h2>
        {sub && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-warm">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** HUD corner ticks around a box. */
export function Ticks({ className }: { className?: string }) {
  return (
    <svg className={cx('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden>
      <path d="M0.75 14V0.75H14" stroke="currentColor" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
      <g style={{ transform: 'translateX(100%) scaleX(-1)' }}><path d="M0.75 14V0.75H14" stroke="currentColor" strokeWidth="1.5" fill="none" /></g>
    </svg>
  );
}
