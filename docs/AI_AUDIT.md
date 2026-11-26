# AI audit — engineering errors and weaknesses found in AI output

**DRAFT prepared by Claude Code for the team to verify, edit and own.** CE 402, Group 8. Max two pages —
choose the strongest items (5 and 6 come from cross-checking against our own v1 engines and are the most convincing).
Each item: what the AI produced → how we detected the problem → our correction. All items are real and traceable in
the git history of this repository.

---

### 1. Footings sized wider than the column grid — geometry never checked
**AI output.** The sizing routine (`sizeFooting`, `src/engine/design.ts`) returned the smallest footing that passes
bearing and settlement, and the Design screen reported it as "sized": **B = 6.00 m** for columns A6–D7 (BH-3 zone) and a
**3.55 m × 5.32 m** rectangle for the eccentric column C4 — on a **5 m × 5 m** grid.
**Detection.** The plan view drawn to scale showed neighbouring footings overlapping. Hand check: an isolated footing
needs B ≤ spacing − clearance = 5.0 − 0.3 = 4.7 m; 6.00 m and 5.32 m both exceed it. The AI had treated each column in
isolation.
**Correction.** Added a geometric check in `src/lib/results.ts`: footing B (along the length) and L (across) must not
exceed the grid spacing minus a 0.3 m clear gap (clearance is a stated assumption). It now flags **9 columns** (the eight
BH-3 footings and C4) as FAIL, and the proposal text recommends combined/strip footings or the alternative foundation.
Regression test: `tests/results.test.ts`.

### 2. Pressure-bulb labels placed at invented depths
**AI output.** The pressure-bulb chart (`PressureBulb`, `src/components/viz.tsx`) drew the isobars correctly from the
Boussinesq solution but placed their labels at hard-coded depths: 0.8q at 0.38B, 0.6q at 0.75B, 0.4q at 1.15B,
0.2q at 1.45B, 0.1q at 2.0B.
**Detection.** The labels did not sit on their curves. We evaluated the engine's own Boussinesq centre stress at each
label depth for B = 3 m (`deltaSigmaCentre`): at the "0.4q" label (3.45 m) the true value is **0.274q**; at the "0.6q"
label (2.25 m) it is **0.484q**. A student reading the chart would take the wrong depth for a given stress.
**Correction.** Each label is now placed at the deepest point of its own computed isobar and prints that depth
(e.g. "0.1q = 12 kPa · 6.25 m" for B = 3 m, i.e. ≈ 2.1B, consistent with the textbook ~2B bulb depth).

### 3. Shape factors for an eccentrically loaded square footing
**AI output.** The first version of `bearing.ts` applied the IS 6403 *square* row (sc = 1.3, sq = 1.2, sγ = 0.8)
whenever the footing was declared square — even after eccentricity had reduced it to an effective B′ × L′ rectangle
(B′ = B − 2e).
**Detection.** Code review against IS 6403:1981 Table 2: shape factors depend on the effective plan shape used in the
bearing equation; with e = 0.2 m on a 2 m square, B′/L′ = 1.6/2.0 = 0.8, which is a rectangle.
**Correction.** When B′ ≠ L′ the rectangle expressions sc = sq = 1 + 0.2B′/L′ and sγ = 1 − 0.4B′/L′ are used; a
rectangle with B = L uses the square row. Test: "eccentric load reduces the effective width" (`tests/engine.test.ts`).

### 4. Preconsolidation pressure: an AI hand calculation that disagreed with the AI's code
**AI output.** The AI's own hand derivation of Casagrande's σ′p for UDS-1 took the virgin line through the last **two**
loading points (Cc = 0.2957) and got **≈ 118 kPa**; the engine fits the last **three** points (Cc = 0.2923) and returns
**114.6 kPa**.
**Detection.** Independent hand calculation (`tests/hand_calcs.md` §6) — a 3 % disagreement from one hidden choice.
We also noted that Casagrande's construction depends on plot scale (the bisector angle changes with axis scaling).
**Correction.** The choice (last three loading points) is stated in the code and in the assumptions table; the test
asserts a band (110–119 kPa) rather than a false-precision value; σ′p is shown as an editable estimate the engineer
can override. Unit conversion kg/cm² → kPa (×98.0665) is applied before the fit and tested.

### 5. SPT overburden correction applied to clay — caught by our own v1 engine
**AI output.** GeoFound's `correctSpt` (`src/engine/spt.ts`) applied CN = 0.77 log₁₀(2000/σ′v) to every SPT record,
including the soft CI clay in BH-1 (e.g. N = 6 at 6.0 m → N′ = 6.8).
**Detection.** Benchmark against an independent implementation: the cross-check test (`tests/crosscheck.test.ts`) ran the
team's v1 engine (`platform-v1/js/moduleP2_logic.js`, Parash Sharma), which leaves clay N uncorrected (CN = 1). IS 2131's
overburden and dilatancy corrections are for cohesionless soils.
**Correction.** Corrections now apply only to granular/fill layers; clay rows show "no overburden correction". The same
cross-check also made us adopt v1's lower limit σ′v ≥ 25 kPa in the CN expression (Peck et al. relation valid from
≈ 24 kPa), which changes N″ at 1.5 m in BH-1 from 17.28 to 17.03 (`tests/hand_calcs.md` §3 updated).

### 6. Same code, two readings of the local–general shear transition (73 % apart)
**AI output.** For BH-1, B = 3.2 m, GeoFound gave qnu = 345.0 kPa; the team's v1 engine (Gaurav Dtyal) gave 597.1 kPa.
**Detection.** Cross-check test, then term-by-term comparison. Two method choices differ: (a) soil strength — v1 averages
c, φ, γ over the shear zone Df → Df + B (φ = 31.8°), GeoFound used the founding layer (φ = 30.0°); (b) for 29° < φ < 36°
IS 6403 says "interpolate" — v1 interpolates Nc, Nq, Nγ between local and general values, GeoFound interpolated qnu.
**Correction.** Both choices are now explicit options; with v1's choices GeoFound reproduces 597.1 kPa exactly (test).
The team adopted v1's method as the default and states it in the assumptions table. Effect on the Mandi design: BH-1
footings 2.65–3.00 m instead of 3.15–3.70 m; BH-3 still fails (piles).

---

**General weakness (all items above).** The AI wrote IS clause numbers it could not check against the code text. Every
such reference is marked **TO VERIFY** in the code (`// SOURCE: … TO VERIFY`), shown with an amber chip in the app, and
listed in `REFERENCES.md`. The team verified / corrected: _(fill in after checking IS 6403, IS 2131, IS 1904)_.
