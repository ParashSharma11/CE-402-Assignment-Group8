# AI log

One entry per working session: date, tool, purpose, key prompts (verbatim), and what was accepted, changed or rejected, with the reason.
Errors found in AI output are written up in `docs/AI_AUDIT.md`.

---

## Session 1 — 26 Nov 2026

**Member.** Harshit Pandey.
**Tool.** Claude Code (model Claude Opus 5.5) in VS Code; Figma MCP server (official, `mcp.figma.com`); Playwright for screenshots.
**Purpose.** Plan, design, build and test the GeoFound web app (phases 0–5 of our build prompt).

### Key prompts (verbatim)
1. *(Build prompt, pasted from `claude-code-prompt.md`)* — "You are building GeoFound, our CE 402 (Geotechnical Engineering, IIT Mandi) foundation-design web app. Read CLAUDE.md and the assignment PDF in this repo first — they are the spec. … Work in PHASES. At every "STOP" you must show me the result and wait for my written approval before continuing."
2. "hey i want really good design that's why i chose figma and i want it dynamic"
3. "not that good design tell me any connector i should install for the reference of the ui ux"
4. "i am giving the site links for the reference design … https://busybox.io/ and https://www.neuroformtech.com/ … either you can use any one of these or make a new one using this reference"
5. "go with the dark brown colour it looks good"
6. "use ony free api key no claude one cause it's paid"
7. "pick some components for boxes and fonts cause it looks like ai generated … it's edges are sharp and could be better if it hover when we place cursor over it"
8. "can you take reference from https://www.neuroformtech.com/ for dynamic site like it's good and continue further now"
9. "isn't while moving down texts are overlapping and i want some more dynamic component like adding video in the background which will be moving continuously"
10. "can you add that moving part which you added in front one for all or something dynamic in the background"

### Accepted
- **Calculation engine** (`src/engine/`, pure TypeScript): P1–P5 with a `// SOURCE:` comment on every equation; 33 Vitest tests from hand calculations (`tests/hand_calcs.md`). Accepted because every benchmark was re-derived by hand and matched.
- **Visual direction D "Core Sample"** (dark brown `#140806`, survey orange `#FF4A1C`), built after studying the two reference sites' CSS and scripts; chosen over three earlier directions (A Field Log, B Section Cut, C Terrace Instrument) and three colour variants (Basalt, Monsoon, Survey Light).
- **Free AI for the summary:** Google Gemini free tier via a Vercel server function, with a deterministic template fallback, a number guard and an "Engineer checked this" gate before AI text enters the PDF.
- **Motion:** loader, liquid headline, scramble hover, section-cut transitions, live WebGL strata backdrop on every page, tickers, magnetic buttons, animated charts; all disabled under `prefers-reduced-motion`.

### Changed
- **Engine assumptions** in `src/examples/mandi.ts` are marked ASSUMED with reasons (E = 500(N + 15), C4 load and eccentricity, BH-3 loose-sand φ = 28°, Cc from LL for BH-2/BH-3) — pending team review.
- **Fonts and components** changed from Inter / IBM Plex with sharp boxes (felt "AI-generated") to Tanker + Cabinet Grotesk + Satoshi + JetBrains Mono with rounded, hover-lift spotlight cards.
- **Landing parallax** changed: the giant word rose over the buttons when scrolling; it now sinks and fades behind the ticker.
- **Footing overlap check and pressure-bulb labels** added/corrected after we spotted the problems (see AI audit items 1–2).

### Rejected
- **Paid Claude API** for the summary — rejected on cost; Gemini free tier used instead.
- **A real background video file** — not used (5–15 MB would hurt load time); replaced by a GPU-drawn live backdrop of zero download size. Can be revisited if the team supplies footage.
- **Completing the full design system in Figma** — the Figma Starter plan's MCP tool-call limit was reached after the landing directions; the remaining screens were designed directly in code, as our prompt's fallback allows.
- **Clause numbers the AI could not verify** — not accepted as fact; all marked TO VERIFY for the team to check against IS 6403, IS 2131 and IS 1904.

### Still to do (next session)
Deploy to Vercel from the team repository; verify TO VERIFY clauses and the IS 1904 limits; add group hand calculations; every member commits.
