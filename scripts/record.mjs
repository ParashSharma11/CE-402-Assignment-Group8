// Record a walkthrough video of GeoFound with motion ON, plus timed frames for review.
// Usage: node scripts/record.mjs http://localhost:4173 <outDir>
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'video';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
let n = 0;
const frame = async (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);
const wheel = async (dy, steps = 10, gap = 80) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await wait(gap); } };

// 1. Loader → landing
await page.goto(base + '/');
await wait(900); await frame('loader-mid');
await wait(1900); await frame('landing-intro');
await wait(1800); await frame('landing-settled');
// crosshair over the core
await page.mouse.move(1060, 470); await wait(400); await frame('core-crosshair');
await page.mouse.move(1060, 360); await wait(300);
// hover the secondary button (scramble)
await page.getByRole('button', { name: /Open Mandi example/i }).first().hover(); await wait(200); await frame('button-scramble');
// scroll: strata drift, giant word parallax, method cards reveal
await wheel(700, 14, 90); await frame('landing-scrolled');
await wheel(700, 14, 90); await page.mouse.move(500, 560); await wait(500); await frame('method-card-hover');
await wheel(-1400, 10, 40); await wait(600);

// 2. Load example → data wizard
await page.getByRole('button', { name: /Open Mandi example/i }).first().click();
await wait(350); await frame('page-transition');
await wait(1200);
await page.getByRole('button', { name: /Boreholes/ }).first().click(); await wait(800); await frame('data-boreholes');
// change design WT to watch the line slide, add a layer to watch it grow
const wt = page.getByLabel('Design WT'); await wt.fill('3.5'); await wait(700); await frame('data-wt-slid');
await wt.fill('1'); await wait(500);
await page.getByRole('button', { name: /Add layer/ }).click(); await wait(500); await frame('data-layer-added');
await page.getByRole('button', { name: /✕|Remove layer/ }).last().click(); await wait(400);

// 3. Ground model: pressure bulb slider
await page.goto(base + '/ground'); await wait(1600); await frame('ground');
await wheel(1500, 12, 80); await wait(500);
const thumb = page.getByRole('slider').first(); await thumb.focus();
for (let i = 0; i < 25; i++) { await page.keyboard.press('ArrowRight'); await wait(40); }
await wait(500); await frame('ground-bulb-B-changed');

// 4. Calculations: quick calculator sliders + step cards
await page.goto(base + '/calculations'); await wait(1500); await frame('calcs');
const s1 = page.getByRole('slider').first(); await s1.focus();
for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); await wait(60); }
await wait(600); await frame('calcs-B-up');
await wheel(1400, 14, 90); await wait(400); await frame('calcs-step-cards');

// 5. Design: plan grows, 3D view
await page.goto(base + '/design'); await wait(700); await frame('design-plan-growing');
await wait(1200); await frame('design-plan');
await wheel(900, 10, 80); await wait(300);
await page.getByRole('button', { name: /Load the 3D view/i }).click(); await wait(3500); await frame('design-3d');
const canvas = page.locator('canvas').first();
const bb = await canvas.boundingBox();
if (bb) {
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 220, bb.y + bb.height / 2 - 40, { steps: 25 }); await page.mouse.up();
  await wait(800); await frame('design-3d-orbited');
}

// 6. Summary streaming
await page.goto(base + '/summary'); await wait(700); await frame('summary-streaming');
await wait(2500); await frame('summary-done');

console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
const vid = await page.video()?.path();
await ctx.close(); await browser.close();
if (vid) { renameSync(vid, `${out}/geofound-walkthrough.webm`); console.log('video:', `${out}/geofound-walkthrough.webm`); }
