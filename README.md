# CE-402 Assignment — Group 8 · GeoFound

Shallow-foundation design in the browser for the CE 402 (Geotechnical Engineering, IIT Mandi) assignment:
IS 2131 SPT corrections, direct-shear least squares, IS 6403:1981 bearing capacity, Boussinesq / 2:1 stress increase,
Schmertmann (1978) and 1-D consolidation settlement, and IS 1904 building checks — every equation with its source.

**Live app (v2):** _Vercel URL — added after deployment_
**v1 platform:** https://parashsharma11.github.io/CE-402-Assignment-Group8/ (GitHub Pages, from `main`)

## Two versions, one team
| | v1 — GeoTech Analytics | v2 — GeoFound |
|---|---|---|
| Where | `platform-v1/` | repo root (`src/`, `api/`, `tests/`) |
| Stack | Vanilla JS, Tailwind, Plotly (no build step) | React + TypeScript (Vite), Vitest, Vercel |
| Engines | P1–P5 by the team (below) | own TypeScript engine **plus the v1 engines, run live as a cross-check** |

The project began as a Python/Streamlit prototype (17–18 Nov), moved to the client-side v1 platform (21 Nov), and v2
was added on 26 Nov. v2 does not replace the team's engines — it calls them: `src/team/bridge.ts` loads
`platform-v1/js/*_logic.js` unchanged, the Calculations screen shows "Team engine cross-check", and
`tests/crosscheck.test.ts` checks that the two implementations agree.

| Module | v1 engine author | v1 ↔ v2 |
|---|---|---|
| P1 Soil profile | Parash Sharma | v1 validates every v2 profile |
| P2 SPT + direct shear | Parash Sharma | identical (v2 corrected to match v1 — see `docs/AI_AUDIT.md`) |
| P3 Bearing capacity (IS 6403) | Gaurav Dtyal | identical with the team method (default) |
| P4 Stress increase | Namit Mehta | identical |
| P5 Settlement | Muvan | U(Tv) identical |

## Run v2 locally
Node 20+.
```bash
npm install
npm run dev        # http://localhost:5173 → "Open Mandi example"
npm test           # hand-calculation benchmarks, v1 cross-checks, end-to-end design run
npm run build      # type-check + production build
```
v1 needs no build: open `platform-v1/index.html` in a browser.

The AI summary on v2's Summary page uses the Google Gemini free tier through a server function (`api/summary.ts`,
key in the Vercel environment variable `GEMINI_API_KEY`). Without a key it falls back to a deterministic template.

## Structure
```text
├── src/engine/          v2 calculation engine (pure TypeScript, // SOURCE: on every equation)
├── src/examples/        Mandi site data — the only place site values live
├── src/team/            bridge to the v1 engines
├── src/pages, components   v2 screens (UI: Harshit Pandey)
├── api/summary.ts       AI summary (server-side key)
├── tests/               Vitest + tests/hand_calcs.md (every benchmark derived by hand)
├── platform-v1/         the team's v1 platform, unchanged, with full history
├── docs/AI_AUDIT.md     AI errors we caught (max two pages)
├── docs/team/           one task file per member
├── AI_LOG.md            AI use log
└── REFERENCES.md        every source cited in the code
```

## Engineering standards
SI units throughout (kN, kPa, m, mm, kN/m³); γw = 9.81 kN/m³; nothing site-specific hard-coded outside
`src/examples/`; every clause not yet checked against the code text is marked **TO VERIFY** (amber in the app).

## Team (Group 8)
| Member | Contribution |
|---|---|
| **Harshit Pandey** | UI/UX design and front-end of GeoFound (v2), visual direction, motion, integration of the team engines, deployment |
| **Parash Sharma** | P1 soil profile and P2 SPT / direct-shear engines, v1 platform architecture |
| **Gaurav Dtyal** | P3 IS 6403 bearing-capacity engine |
| **Muvan** | P5 settlement engine (IS 8009, Schmertmann, consolidation) |
| **Namit Mehta** | P4 stress-increase (Boussinesq / 2:1) module |

See `docs/team/` for each member's verification task.
