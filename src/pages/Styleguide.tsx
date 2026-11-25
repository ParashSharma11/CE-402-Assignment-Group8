import { useEffect, useState } from 'react';
import { Page, Shell } from '../components/layout';
import { Arrow, Badge, Button, Card, Chip, Field, SectionHead, SliderField, Stepper, StepCard, Tabs, Toggle } from '../components/ui';
import { CountUp } from '../components/motion';

const PAIRS = [
  { id: 'a', name: 'A · Tanker + Cabinet Grotesk + Satoshi', note: 'Default. Heavy condensed giant word, characterful grotesk headings, calm body.' },
  { id: 'b', name: 'B · Clash Display + General Sans', note: 'Sharper, more editorial; one family for giant and headings.' },
  { id: 'c', name: 'C · Tanker + Zodiak serif + Switzer', note: 'Engineering-report feel: serif headings, neutral body.' },
];
const EXTRA = 'https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=general-sans@400,500,600&f[]=zodiak@700,800&f[]=switzer@400,500&display=swap';

export default function Styleguide() {
  const [font, setFont] = useState(() => document.documentElement.dataset.font ?? 'a');
  const [tab, setTab] = useState('one');
  const [v, setV] = useState(2.4);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!document.querySelector('link[data-extra-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = EXTRA; l.dataset.extraFonts = '1'; document.head.appendChild(l); }
  }, []);
  useEffect(() => { document.documentElement.dataset.font = font; }, [font]);
  return (
    <Page>
      <Shell>
        <SectionHead k="styleguide" title="Pick the type, feel the components." sub="Hover the cards and buttons: rounded 20 px corners, lift, a spotlight that follows the cursor and an orange edge glow. Labels scramble on hover." />
        <div className="mb-10 grid gap-3 md:grid-cols-3">
          {PAIRS.map((p) => (
            <Card key={p.id} className={`cursor-pointer p-6 ${font === p.id ? 'border-accent/70' : ''}`} onClick={() => setFont(p.id)}>
              <div className="mb-3 flex items-center justify-between"><span className="hud">{p.name.split(' · ')[0]}</span>{font === p.id && <Badge status="pass">active</Badge>}</div>
              <div className="font-giant text-[64px] leading-none" style={{ fontFamily: p.id === 'b' ? 'Clash Display' : 'Tanker' }}>GEOFOUND</div>
              <div className="mt-3 text-[22px] font-bold" style={{ fontFamily: p.id === 'a' ? 'Cabinet Grotesk' : p.id === 'b' ? 'Clash Display' : 'Zodiak' }}>Read the ground first.</div>
              <p className="mt-2 text-[14px] text-warm" style={{ fontFamily: p.id === 'a' ? 'Satoshi' : p.id === 'b' ? 'General Sans' : 'Switzer' }}>{p.note}</p>
              <div className="num mt-3 text-[15px] text-accent">qns = 214.6 kPa · s = 38.2 mm</div>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="grid content-start gap-4 p-6">
            <div className="hud">buttons</div>
            <div className="flex flex-wrap gap-3"><Button label="Start a site" icon={<Arrow />} /><Button variant="secondary" label="Mandi example" /><Button variant="ghost" label="Ghost" /></div>
            <div className="flex flex-wrap gap-2"><Badge status="pass" /><Badge status="fail" /><Badge status="warn" /><Chip>IS 6403:1981</Chip><Chip tone="verify">cl. 5.1.2 — TO VERIFY</Chip></div>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'one', label: 'Isolated' }, { value: 'two', label: 'Raft' }, { value: 'three', label: 'Piles' }]}><span /></Tabs>
          </Card>
          <Card className="grid content-start gap-4 p-6">
            <div className="hud">inputs with units</div>
            <Field label="Footing width B" unit="m" value={v} onChange={(x) => setV(x ?? 0)} />
            <SliderField label="Founding depth Df" unit="m" value={v} min={0.5} max={6} step={0.05} onChange={setV} />
            <Toggle label="Use depth factors" checked={on} onChange={setOn} />
          </Card>
          <Card className="grid content-start gap-4 p-6">
            <div className="hud">numbers</div>
            <CountUp value={758.95} dp={2} className="font-giant text-[72px] leading-none" suffix={<span className="ml-2 font-mono text-[13px] text-muted">kPa</span>} />
            <Stepper steps={['Project', 'Loads', 'Boreholes']} current={1} />
          </Card>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <StepCard index={0} step={{ title: 'Bearing capacity factor Nq', equation: 'Nq = e^(π tanφ) · tan²(45° + φ/2)', substituted: 'Nq = e^(π·tan 30°) · tan²(60°)', value: 18.401, unit: '', source: 'IS 6403:1981 Table 1' }} />
          <StepCard index={1} step={{ title: 'Water-table factor W′', equation: 'W′ = 0.5 + 0.5 (zw − Df)/B', substituted: 'zw = 1.00, Df = 1.50, B = 3.20', value: 0.5, unit: '', source: 'IS 6403:1981 cl. 5.1.2.4 — TO VERIFY' }} />
        </div>
      </Shell>
    </Page>
  );
}
