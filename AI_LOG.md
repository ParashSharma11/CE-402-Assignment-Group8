# AI Development Log — CE-402 Geotechnical Engineering, Group 8

How AI tools were used to build the two versions of our platform. Prompts are reproduced verbatim (long prompts in
full, follow-ups as written). The geotechnical content — methods, equations, parameters, design decisions and the
checks — was specified and verified by the group; the AI was used to write code to that specification. Every
calculation error we found in AI output is recorded in [`docs/AI_AUDIT.md`](docs/AI_AUDIT.md).

| Version | Tool | Where |
|---|---|---|
| v1 — GeoTech Analytics (P1–P5 engines, vanilla JS) | Gemini | `platform-v1/` |
| v2 — GeoFound (web app: UI/UX, integration, design workflow) | Claude Code (VS Code) | repo root |

---

## Part A — v1 platform (Gemini)

### Prompt 1 — Foundational architecture (`index.html`, `js/state.js`)
*20.11.2026, 23:24*

> You are a senior geotechnical software engineer. We are building a browser-based, zero-installation geotechnical
> engineering web platform (CE-402, Group 8) using HTML5, Tailwind CSS (via CDN), Plotly.js (via CDN), and modular
> Vanilla JavaScript for direct hosting on GitHub Pages with no build tools or backend servers.
>
> In this first step, generate ONLY the foundational architecture across two files:
>
> **index.html:** Include CDN links for Tailwind CSS and Plotly.js. Build a clean, modern engineering dashboard layout
> (slate-navy header bar showing 'CE-402 Geotechnical Design Platform | Group 8', responsive container, and clean tab
> navigation buttons for Module P1: Soil Profile, Module P2: SPT & Direct Shear, Module P3, Module P4, and Module P5).
> Include empty container `<div>` panels for each tab (`#tab-p1` through `#tab-p5`) and a small tab-switching script so
> clicking any tab cleanly toggles the active view (with `#tab-p1` active by default). Load standard `<script>` tags at
> the bottom (do NOT use `type="module"` so the app works both by opening index.html locally and on GitHub Pages) in
> this order: `js/state.js`, `js/moduleP1_logic.js`, `js/moduleP1_ui.js`.
>
> **js/state.js:** Create a global reactive state store `window.GeotechState` holding: `gamma_w = 9.81` (kN/m³),
> `zw_measured` (default 3.50 m), `zw_design` (default 1.50 m), raw `layers` array (pre-populated with 3 realistic
> default layers: Sand SW/SP 0–3 m, Clay CL/CH 3–9 m, Gravel GW/GP 9–14 m using all standard SI geotechnical
> parameters), `processedLayers`, and `validationErrors`. Include `subscribe(callback)` and `notify()` methods so any
> future module (P2–P5) automatically recalculates whenever the user edits the soil profile or groundwater depths.
>
> Do not build the Module P1 calculations or UI yet—just deliver complete, clean code for index.html and js/state.js.

### Prompt 2 — Module P1 calculation and validation engine (`js/moduleP1_logic.js`)
*21.11.2026, 00:47*

> Now build Step 2: create `js/moduleP1_logic.js`, attached to `window.ModuleP1Logic` (classic script using an IIFE
> with "use strict", no ES6 import/export so it runs on file:// and GitHub Pages).
>
> This file must contain ONLY the pure geotechnical validation and calculation engine for Module P1, strictly
> enforcing SI units (kN, kPa, m, mm, kN/m³) with gamma_w = 9.81 kN/m³ (defaulting to `window.GeotechState.gamma_w` if
> available, otherwise 9.81). Match the exact input layer object property names already defined in js/state.js:
> soilType, z_top, z_bot, gamma_moist, gamma_sat, su, c_prime, phi_prime, E_prime, nu_prime, e0, Cc, Cr, OCR, cv.
>
> Implement a function `validateAndProcessProfile(layers, gammaW)` that does NOT mutate the input array, sorts a
> shallow copy of the layers by z_top ascending, and returns `{ processedLayers, errors }`:
>
> **Mandatory Validation Checks** (append clear, layer-indexed error messages to errors if violated): at least one
> soil layer must exist; every required numeric field must be a finite number (no NaN, null, undefined, or Infinity);
> first layer must start at ground surface (|z_top − 0.0| ≤ 1e-3 m); positive thickness for every layer
> (H_m = z_bot − z_top > 0); stratigraphic continuity between adjacent layers (|z_top[i] − z_bot[i-1]| ≤ 1e-3 m, no
> gaps or overlaps); phase relationship validity (gamma_moist > 0 and gamma_sat >= gamma_moist); elastic stability for
> drained Poisson's ratio (0.0 <= nu_prime < 0.499) to prevent division-by-zero singularity in E_oed; physical bounds:
> su >= 0, c_prime >= 0, phi_prime >= 0 (and phi_prime <= 60), E_prime > 0, e0 > 0, Cc > 0, Cr > 0, OCR >= 1.0, cv > 0.
>
> **Derived Engineering Calculations** (compute for every layer when its inputs are numerically valid, and attach
> these exact property names to each object in processedLayers alongside the original fields): H_m = z_bot − z_top (m);
> H_mm = 1000 * H_m (mm); gamma_sub = gamma_sat − gamma_w (kN/m³);
> E_oed = (E_prime * (1 − nu_prime)) / ((1 + nu_prime) * (1 − 2 * nu_prime)) (kPa); mv = 1 / E_oed (1/kPa).
>
> **Also expose on window.ModuleP1Logic:** SOIL_STYLES: a dictionary mapping the 6 USCS categories ("Clay (CL/CH)",
> "Silt (ML/MH)", "Sand (SW/SP)", "Gravel (GW/GP)", "Peat (Pt)", "Rock / Bedrock") to clean, muted geological fill
> colors, border colors, and short codes for Plotly rendering; SOIL_TYPES: an ordered array of those exact 6 USCS
> category strings for dropdown menus.
>
> Include concise engineering comments tracing every equation and validation rule to standard references (Terzaghi,
> Peck & Mesri; Bowles; Das & Sobhan; Eurocode 7 EN 1997-1; ASTM D2487). Deliver ONLY the complete
> js/moduleP1_logic.js file.

### Prompt 3 — Module P1 interactive UI (`js/moduleP1_ui.js`)
*21.11.2026, 01:01*

> Now build Step 3 (final step for Module P1): create `js/moduleP1_ui.js`, attached to `window.ModuleP1UI` (classic
> IIFE with "use strict", no ES6 import/export so it runs cleanly on file:// and GitHub Pages). This file renders the
> complete interactive Module P1 interface inside #tab-p1 of index.html using window.GeotechState and
> window.ModuleP1Logic (including SOIL_TYPES, SOIL_STYLES, and validateAndProcessProfile).
>
> 1. **Top KPI Summary Bar** (4 clean Tailwind cards): Total Profile Depth (m), Number of Layers, Measured Water Table
>    zw_measured (m), and Design Water Table zw_design (m).
> 2. **Groundwater & Profile Controls Bar:** Editable numeric inputs for zw_measured (m) and zw_design (m) (min 0.0,
>    step 0.1) bound to `window.GeotechState.setWaterTables()`; a clean badge displaying gamma_w = 9.81 kN/m³; and a
>    "Reset to Sample Profile" button wired to `window.GeotechState.resetToDefaults()`.
> 3. **Editable Stratigraphic Input Table** (no hard-coded calculations; must accept any unseen soil profile):
>    responsive horizontally scrollable Tailwind table covering all 15 parameters matching js/state.js … Include an
>    "Add Layer" button (automatically setting the new layer's z_top to the last layer's z_bot and z_bot to
>    z_top + 3.0 m, with valid default Sand parameters) and a "Delete" button on each row. *IMPORTANT UX DETAIL:* Do NOT
>    destroy and re-render the entire input table DOM on every keystroke while the user is typing in a numeric cell
>    (which causes focus loss). Update only the KPI cards, validation box, derived table, and Plotly chart on
>    input/change events, and re-render the input table only on initial load, Add Layer, Delete Layer, or Reset.
> 4. **Validation Alert Banner:** Run `window.ModuleP1Logic.validateAndProcessProfile(state.layers, state.gamma_w)` on
>    every update and push the results to `window.GeotechState.setProcessedProfile(processedLayers, errors, true)`
>    (ensure no infinite loop if subscribed). If errors.length > 0, display a prominent red Tailwind alert box listing
>    every validation error and hide the Derived Parameters Table and Plotly chart until fixed.
> 5. **Two-Column Results Workspace** (shown only when errors.length === 0): *Left:* Derived Parameters Table (Layer #,
>    Soil Type with colour swatch, depth interval, H_m, H_mm, gamma_sub, E_oed, mv in scientific notation). *Right:*
>    interactive Plotly.js 2D stratigraphic borehole column (`#p1-profile-plot`) with downward-positive depth axis
>    (autorange: "reversed") labelled "Depth below Ground Surface, z (m)", scaled lithology blocks coloured with
>    SOIL_STYLES, centred annotations (USCS code, soil type, depth/thickness), hover targets showing unit weights,
>    strength (su, c′, φ′), stiffness (E′, ν′, E_oed, mv) and consolidation parameters (e0, Cc, Cr, OCR, cv); horizontal
>    lines and right-side annotations for Measured WT (dashed blue) and Design WT (solid red); using
>    `Plotly.react(..., { responsive: true, displaylogo: false })` for smooth updates.
>
> Initialize automatically on DOMContentLoaded. Deliver ONLY the complete js/moduleP1_ui.js file.

**Follow-up (21.11.2026, 01:21):**
> In js/moduleP1_ui.js, fix the following execution-order bug and apply one small Plotly UX improvement, then output
> the complete updated js/moduleP1_ui.js file:
> 1. **Bug Fix (Critical):** In both handleAddLayer() and handleDeleteLayer(), renderInputTable() is currently called
>    BEFORE state.setLayers(nextLayers). Because renderInputTable() reads from state.layers, the editable table stays
>    out of sync when adding or deleting rows. Update both functions so state.setLayers(nextLayers) is called BEFORE
>    renderInputTable().
> 2. **Minor Cleanup:** In the btnReset click handler, remove the redundant extra call to
>    refreshDerivedAndVisuals(state) since state.resetToDefaults() already notifies subscribers.
> 3. **Plotly UX Improvement:** Instead of a single small invisible hover marker at the center of each layer, render an
>    invisible filled polygon trace (type: "scatter", mode: "lines", fill: "toself", hoveron: "fills",
>    fillcolor: "rgba(0,0,0,0)", line: { width: 0 }) spanning each layer rectangle so hovering anywhere inside a soil
>    stratum displays its full parameter tooltip.
>
> Keep all other logic, Tailwind classes, IDs, SI units, and classic IIFE structure unchanged.

### Phase 2 — Module P2: SPT corrections and direct-shear fitting
*21.11.2026, 22:01 (Step 2A prompt) · 22.11.2026, 17:50–19:20 (Step 2C)*

> We are now moving to Phase 2 (Module P2: SPT Corrections & Direct Shear Parameter Fitting). For Step 2A, update ONLY
> js/state.js (classic IIFE with "use strict", no ES6 modules, attached to window.GeotechState).
> CRITICAL CONSTRAINT: Preserve 100% of the existing Module P1 properties, default layers, and methods … with exact
> backward compatibility so Module P1 continues working unchanged.
> Extend window.GeotechState with a Module P2 state slice using strict SI units (m, kPa, kN/m³):
> 1. `sptRecords`: pre-populated via createDefaultSptRecords() with 5 realistic editable starter SPT observations
>    spanning the default 0–14 m profile (depth_m, N_measured, soilCategory — "Fine Sand / Silt (Dilatancy
>    Applicable)", "Coarse Sand / Gravel (No Dilatancy)", "Cohesive Soil (Clay)" — and sigma_v_override, null by
>    default, meaning auto-compute effective overburden pressure from Module P1 stratigraphy & zw_measured).
> 2. `directShearPoints`: 4 editable starter observations (sigma_n, tau_f in kPa).
> 3. `p2Results`: { sptProcessed: [], sptErrors: [], directShearFit: null, directShearErrors: [] }
> 4. Mutators setSptRecords, setDirectShearPoints, setP2Results(resultsObj, triggerNotify), resetP2Defaults().
> Deliver ONLY the complete updated js/state.js file.

**What was built.** Step 2A extended the state store for P2 with full backward compatibility. Step 2B
(`js/moduleP2_logic.js`) implemented piecewise effective overburden split at the measured water table, IS 2131:1981
overburden correction (σ′v ≥ 25 kPa, CN ≤ 2.0) and dilatancy correction (N′ > 15 below the water table in fine
sands/silts) with step-by-step traces, and ordinary least-squares Mohr–Coulomb fitting (c′, φ′, R², RMSE, residuals)
with a non-negative cohesion check. Step 2C (`js/moduleP2_ui.js`) added the editable SPT and direct-shear tables,
calculation cards and Plotly charts. Error found in review: `docs/AI_AUDIT.md` item A1.

### Phase 3 — Module P3: IS 6403:1981 bearing capacity
*22.11.2026, 21:11–23:00; audit 26.11.2026, 01:01–02:11*

Step 3A extended the state store (17 strict-SI geometry, loading, shear-mode and soil-source fields). Step 3B
(`js/moduleP3_logic.js`) implemented input and eccentricity validation, Meyerhof (1953) effective dimensions for
strip, square, rectangular and circular footings, thickness-weighted failure-zone strength from the P1 profile, IS 6403
shear modes and interpolation, shape / depth / inclination / W′ factors, net and gross ultimate and safe capacities,
audit trails and a footing-width sensitivity curve. Step 3C (`js/moduleP3_ui.js`) added the KPI cards, factor table,
calculation log and charts. Error found in review: `docs/AI_AUDIT.md` item A2.

### Phase 4 — Module P4/P5: settlement (IS 8009 Part 1:1976, IS 1904:1986)
*26.11.2026; Step 4C 05:52–07:30*

Step 4A extended the state store (p4Input, p4Results, deepMerge / cloneValue, syncP4FromP3). Step 4B
(`js/moduleP4_logic.js`) was directed to implement 2:1, Newmark / Boussinesq, circular, strip and Westergaard stress
distribution; IS 8009 / Janbu elastic settlement with the Fox depth correction and Schmertmann (1978) strain
influence; 1-D consolidation with the three NC/OC cases, a 25-term Fourier U(Tv), drainage path, t50/t90 and
time-rate curves. Step 4C (`js/moduleP4_ui.js`) added the settlement UI with IS 1904 presets and three charts. Errors
found in review: `docs/AI_AUDIT.md` items A3–A7.

### Step 5B and P8 — stress increase module and deployment
Exact Newmark (1935) / Boussinesq vertical stress below rectangular corners and centres by four-quadrant
superposition, 2:1 dispersion, depth-profile chart and audit trail (`js/moduleP4_stress_logic.js`,
`js/moduleP4_stress_ui.js`); README added (P8). Error found in review: item A8.

---

## Part B — v2 GeoFound: UI/UX (Claude Code)
*26.11.2026*

GeoFound is the web app that runs the design end-to-end. This part logs the UI/UX work only; the engine, the
foundation design and every calculation decision are covered in `docs/AI_AUDIT.md` and `tests/hand_calcs.md`.

### Prompts (verbatim)
1. "hey i want really good design that's why i chose figma and i want it dynamic"
2. "not that good design tell me any connector i should install for the reference of the ui ux"
3. "i am giving the site links for the reference design the site whose ui should be used as a reference https://busybox.io/ and https://www.neuroformtech.com/ i have provided two references either you can use any one of these or make a new one using this reference"
4. "ui looks good but any different colour can you check for another colour as well of the site i mean it's kinda dark brown"
5. "go with the dark brown colour it looks good"
6. "one more thing pick some components for boxes and fonts cause it looks like ai generated and the font and box is not looking good cause it's edges are sharp and could be better if it hover when we place cursor over it you know and font is not that good i mean if you can find the better font style then use that one the box and all cause it still looks like ai"
7. "can you take reference from https://www.neuroformtech.com/ for dynamic site like it's good and continue further now"
8. "isn't while moving down texts are overlapping and i want some more dynamic component like adding video in the background which will be moving continuously and all"
9. "can you add that moving part which you added in front one for all or something dynamic in the background which moves continuously to make it dynamic"
10. "… when i am clicking it is not going to home page where geofound is writtern and soil profile is shown it directly take us to design page but i want it to go to home page and then person can go anywhere also it get bit unresponsive sometimes and i have to reload it …"
11. "… i am thinking that for the new site data whether a user can enter it or upload the csv file for that"
12. "… when i click on this soil profile then it detaches and show it separately like layerwise are you getting na"
13. "use ony free api key no claude one cause it's paid"
14. "can a person gives the input about seismic zone ??"

### AI reasoning (summarised from the session)
- **Design direction.** *"Four directions were tried. The dark-brown 'Core Sample' direction reads as a soil core
  rather than a generic dashboard: ground #140806, warm ink #F4E8DF, and survey-marking orange #FF4A1C kept for
  actions and pass/fail only, so colour still carries meaning on result screens."*
- **Why it looked AI-made.** *"Inter / IBM Plex and sharp 1 px boxes are the default look of generated dashboards.
  Replace with a display face for headlines (Tanker), a grotesk for text (Cabinet Grotesk / Satoshi) and a monospace
  with tabular figures for numbers (JetBrains Mono), so columns of results line up. Cards get rounded corners, a
  cursor-following spotlight and a small lift on hover."*
- **Background video.** *"A 5–15 MB video loop would cost load time and battery on every page. A WebGL shader that
  draws slowly moving strata gives continuous motion with zero download; cap it at 30 fps behind content pages and
  switch it off under prefers-reduced-motion."*
- **Text overlapping on scroll.** *"The landing page's giant word uses scroll parallax that moves it up — over the
  buttons. Reverse it so it sinks and fades behind the ticker, and give the navigation bar a solid background."*
- **Navigation 'jumping to Design' and freezing.** *"The URL changes but the old page stays on screen:
  `AnimatePresence mode="wait"` keeps the previous route mounted until its exit animation finishes, and rapid clicks
  during a heavy exit leave it stuck. Remove the wait mode; verify with rapid clicks, the logo link and Back."*
- **Exploding soil core.** *"Framer Motion's `y` on an SVG `<g>` does not move the group, so the layers did not
  separate. Use a CSS `transform: translateY` with a transition, and place each layer card below the previous one so
  labels never overlap."*
- **CSV upload.** *"Keep it to one CSV with three record types — borehole, layer, spt — so a site can be prepared in a
  spreadsheet; offer a downloadable template and report what was imported."*
- **Seismic zone input.** *"Z already exists as a number, but a zone dropdown (II–V, IS 1893 Table 3) is what a user
  thinks in; it should fill Z and amax = Z/2 and still allow a custom value. Remove every hard-coded 'zone V' label."*

### Accepted
- Visual direction "Core Sample" (dark brown + survey orange), chosen over three other directions and three colour
  variants; fonts Tanker, Cabinet Grotesk, Satoshi, JetBrains Mono; rounded hover cards.
- Motion: loader, liquid headline, scramble hover, page transitions, live WebGL strata on every page, tickers,
  magnetic buttons, animated charts — all off under `prefers-reduced-motion`.
- Exploding soil core on the landing page (click or Enter) built from the example borehole data.
- Data entry: step-by-step wizard, CSV import with template, project save/open as JSON, seismic zone dropdown.
- AI summary on the Summary page with Google Gemini free tier, a deterministic template fallback, a number check that
  flags any value not in the results, and an "Engineer checked this" gate before AI text goes into the PDF.

### Changed
- Fonts and boxes (felt AI-generated) → new typefaces and rounded hover cards.
- Landing parallax (text over buttons) → sinks and fades; solid navigation bar.
- Route transitions (freeze) → wait mode removed.

### Rejected
- Paid AI API for the summary — free tier only.
- A real background video — replaced by the GPU-drawn backdrop.
- Completing every screen in Figma — the Figma plan's tool-call limit was reached; the remaining screens were designed
  in code in the approved style.
