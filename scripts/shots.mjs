// Screenshot every screen of a running GeoFound build (desktop 1440 + mobile 390).
// Usage: node scripts/shots.mjs http://localhost:4173 <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });
const routes = ['/', '/data', '/ground', '/calculations', '/design', '/summary', '/styleguide'];

const browser = await chromium.launch();
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // load the Mandi example once via the landing button
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Mandi example/i }).first().click();
  await page.waitForTimeout(1200);
  for (const r of (label === 'mobile' ? ['/', '/data'] : routes)) {
    await page.goto(base + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${label}${r === '/' ? '-landing' : r.replace('/', '-')}.png`, fullPage: r !== '/' });
  }
  console.log(label, errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
  await ctx.close();
}
await browser.close();
