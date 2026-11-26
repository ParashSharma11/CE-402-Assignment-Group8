# GeoFound

Shallow-foundation design in the browser — IS 6403:1981 bearing capacity, IS 2131 SPT corrections,
Boussinesq / 2:1 stress increase, Schmertmann and 1-D consolidation settlement, and IS 1904 building checks.
CE 402 Geotechnical Engineering, IIT Mandi — Group 8.

**Live app:** _to be added after deployment_

Nothing about the Mandi site is hard-coded: every input (profile, water tables, lab data, grid, loads, limits)
can be changed, and the Mandi data loads only from `src/examples/mandi.ts` via **Open Mandi example**.

## Run it locally
Requires Node 20+.
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: hand-calculation benchmarks + end-to-end design run
npm run build      # type-check + production build into dist/
```
The AI summary needs a free Google AI Studio key in a Vercel environment variable (`GEMINI_API_KEY`,
optional `GEMINI_MODEL`). Without it, the Summary page uses the deterministic template summary.

## What is where
| Path | Contents |
|---|---|
| `src/engine/` | Pure TypeScript calculation engine (P1–P5), every equation with a `// SOURCE:` comment |
| `src/examples/mandi.ts` | The assignment's site data — the only place site values live |
| `tests/` | Vitest suites; `tests/hand_calcs.md` derives every benchmark number by hand |
| `src/pages/` | Landing, Enter data, Ground model, Calculations (+ quick calculator), Design, Summary |
| `api/summary.ts` | Vercel function — Gemini free tier, key server-side only |
| `REFERENCES.md` | Every source cited in the code |
| `AI_LOG.md` | AI use log (date, tool, purpose, prompts, accepted/changed/rejected) |

## Modules
P1 soil profile with measured and design WT · P2 SPT corrections and direct-shear least squares, UU, oedometer ·
P3 IS 6403 for strip, square, rectangle, circle; general/local shear; all factors shown; W′; eccentric loads ·
P4 Boussinesq centre/corner and 2:1, Δσz vs depth · P5 Schmertmann (1978), NC/OC consolidation with ≤ 0.5 m
sublayers, time–settlement with single/double drainage · P8 this repo.

## Team
_Add names, roll numbers and GitHub handles — every member must commit (assignment P8)._

## Stack
React 18 · Vite · TypeScript · Tailwind CSS 4 · Framer Motion · Lenis · Radix UI · react-three-fiber · Zustand ·
Vitest · Playwright · Vercel · Google Gemini (free tier).
