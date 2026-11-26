# GeoFound — project guide for Claude Code

CE 402 Geotechnical Engineering, IIT Mandi — group 8. Browser app for shallow-foundation design.
Spec = `CE 402_Assignment-05.11.2026.pdf` (this repo) + the phased prompt. Deadline 26 Nov 2026.
This file was drafted by Claude from the PDF and the prompt because no CLAUDE.md was supplied; the team owns it.

## 1. Non-negotiables
- **Nothing site-specific is hard-coded outside `src/examples/`.** The instructor tests with unseen data.
- **SI units everywhere** (kN, kPa, m, mm, kN/m³). Every input and output shows its unit beside it.
- **Every equation carries a source comment**: `// SOURCE: IS 6403:1981 cl. x.y` or `// SOURCE: Das (2019) Eq. 4.12`.
  If unsure write `// SOURCE: TO VERIFY` — never invent a clause number.
- The engine is the graded part: correctness and traceability before UI polish.
- Group number g is an input; loads are multiplied by λ = 1 + g/100 (group 8 → λ = 1.08).
- Small commits with clear messages. Never push to `main` without asking.

## 2. Stack
Vite + React 18 + TypeScript (strict) · Tailwind CSS · Framer Motion · react-three-fiber (3D frame view)
· Vitest · Vercel (static site + one serverless function `api/summary.ts`).
AI summary: Google Gemini **free tier** via `@google/genai` (server-side only, key `GEMINI_API_KEY`,
model from `GEMINI_MODEL`, default `gemini-3.5-flash-lite`), deterministic template fallback.

## 3. Assignment modules (PDF "Platform specification")
| Module | Must do |
|---|---|
| P1 Soil profile | layered profile (depths, type, γ moist/sat, strength, stiffness, consolidation), measured WT **and** separate design WT; draw it |
| P2 Parameter tools | IS 2131 SPT corrections (overburden; dilatancy where it applies) with each step shown; c′, φ′ from direct shear by least squares |
| P3 Bearing capacity | IS 6403:1981 net ultimate + net safe for strip/square/rectangle/circle; general + local shear; shape, depth, inclination factors; W′; effective area for eccentric loads; display every factor |
| P4 Stress increase | Boussinesq below centre and corner of a rectangle (superposition) + 2:1 method; plot Δσz vs depth |
| P5 Settlement | Schmertmann et al. (1978) for granular layers; 1-D consolidation NC + OC clay with sublayers ≤ 0.5 m; time–settlement curve with user-selected drainage |
| P8 Code & deploy | GitHub with commits from every member, README on how to run |

Design criteria: FS = 3.0 on net ultimate (IS 6403); total/differential settlement and angular distortion
within IS 1904:1986 limits for an RC frame (team must cite and justify the adopted limits); propose an
alternative foundation where isolated footings fail.

## 4. Data traps called out in the PDF (put each in the AI audit if AI gets it wrong)
- Oedometer pressures in **kg/cm²** (× 98.0665 → kPa); cv in **cm²/s** (× 3155.76 → m²/yr).
- Net vs gross pressure; effective overburden q at founding level when the WT is above it.
- Design WT (seasonal high, August) ≠ measured WT (24 h after boring).
- BH-3 clay has no consolidation test → Cc must come from a cited correlation.
- BH-1 SPT at 9.0 m hit a cobble (N = 22) → not representative of the clay.
- SPT corrections and σ′v0/OCR use the WT at the time of the test (measured, Oct); bearing, W′, Schmertmann and CSR use
  the design (Aug) WT.
- Non-plastic sand: report the least-squares c′ but design with c′ = 0.
- Seismic zone V and a stream 25 m away → liquefaction check; footings on a 5 m grid → superpose neighbouring bulbs.

## 5. Engine layout — `src/engine/` (pure TypeScript, no React, no DOM)
```
src/engine/
  units.ts            unit conversions + constants (γw = 9.81 kN/m³)
  types.ts            SoilLayer, Profile, Footing, Load, results types (every number has a unit in its name or doc)
  stress.ts           P1  σv, u, σ′v at any depth for a given WT
  spt.ts              P2  IS 2131 overburden + dilatancy corrections, step-by-step trace
  labTests.ts         P2  direct-shear least squares (c′, φ′), UU cu, oedometer (Cc, Cr, σ′p Casagrande, unit conversion)
  bearing.ts          P3  IS 6403 factors + net ultimate / net safe, general / local shear, W′, effective area
  stressIncrease.ts   P4  Boussinesq corner/centre (Newmark), 2:1, Δσz profiles
  settlement.ts       P5  Schmertmann 1978, consolidation (≤ 0.5 m sublayers), Terzaghi U(Tv), time–settlement
  design.ts           footing sizing per column, differential settlement, angular distortion, checks vs limits
  liquefaction.ts     IS 1893 Annex F simplified SPT procedure (Youd et al. 2001); zone ↔ Z table
  piles.ts            IS 2911 bored piles: Qb + Qs, downdrag in liquefiable layers, moment in the group, settlement
  finalDesign.ts      whole-building decision: equal-settlement footings incl. neighbouring-footing stress, else piles
  trace.ts            Step type: { title, equation, substituted, result, unit, source } — every module returns steps
  index.ts            public API
src/examples/         Mandi site data (boreholes, lab sheets, grid, loads) — the ONLY place site values live
tests/                Vitest; tests/hand_calcs.md documents every benchmark number used by the tests
```
Every public engine function returns `{ value(s), steps: Step[] }` so the UI can show
equation → substituted numbers → result → clause chip without recomputing anything.

## 6. Commands
`npm run dev` · `npm test` · `npm run build` · `npm run lint`
