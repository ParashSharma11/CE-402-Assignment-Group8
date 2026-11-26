# Engineering Audit of AI Output — CE-402 Group 8

AI tools were used to write code: Gemini for the v1 platform (P1–P5 engines) and Claude Code for GeoFound (v2). The
engineering was ours — we chose the methods and codes, set the parameters, made the design decisions and checked
every result. Each module was verified against hand calculations (`tests/hand_calcs.md`), the two independent
implementations (v1 and v2) are run against each other (`tests/crosscheck.test.ts`), and the final design is covered by
59 automated tests. This audit lists every calculation error and every omission we found in AI output, how we found
it, and what we changed. All items are traceable in the git history.

## Summary
| # | Module | AI error or omission | Effect | Fixed |
|---|---|---|---|---|
| A1 | P2 direct shear | Negative cohesion printed with the wrong sign in the equation | wrong equation shown | yes |
| A2 | P3 bearing | L′ reported as L − 2eL instead of max(B′, L′) | false square geometry in the table | yes |
| A3 | P4/P5 sync | Net safe load synced inconsistently with qns | overburden counted twice | yes |
| A4 | P5 settlement | IS 8009 rigidity factor applied to Se only, not Sc | rigid-footing Sc 25 % high | yes |
| A5 | P5 Schmertmann | Iz sampled at sublayer midpoints | strain peak truncated | yes |
| A6 | P5 validation | γsat ≤ γw and gapped layers accepted | negative γ′, corrupt σ′v0 | yes |
| A7 | P5 time rate | Curve and t50/t90 markers fixed at ≥ 1 day | sub-day consolidation off the plot | yes |
| A8 | P4 stress | Load synced without equal area / effective area | Q ≠ q0·A for circles, eccentric loads | yes |
| B1 | Design | Footing size never checked against the grid | 6.0 m footings on a 5 m grid | yes |
| B2 | P4 chart | Pressure-bulb labels at invented depths | wrong depth for a given stress | yes |
| B3 | P3 bearing | Square shape factors used after eccentricity made B′ ≠ L′ | shape factors wrong | yes |
| B4 | P2 oedometer | σ′p construction choice hidden; AI's own checks disagreed | 118 vs 114.6 kPa | yes |
| B5 | P2 SPT | Overburden correction applied to clay; no 25 kPa limit | clay N inflated | yes |
| B6 | P3 bearing | One reading of the 29°–36° transition, not stated | 345 vs 597 kPa (73 %) | yes |
| B7 | Design | Stopped at "fails"; no working design; single-pile artefact | no usable recommendation | yes |
| B8 | Materials | M25 concrete for a severe-exposure site | below IS 456 minimum | yes |
| B9 | Seismic | No liquefaction check in zone V | liquefiable sand missed | yes |
| B10 | P2/P5 | SPT corrections and OCR used the August water table | N″ wrong, settlement low | yes |
| B11 | P3 bearing | Fitted c′ intercept used for non-plastic sand | qnu ≈ 6 % high | yes |
| B12 | P5 / design | Each footing's settlement computed alone | 25–39 mm instead of up to 114 mm → **design changed** | yes |
| B13 | Piles | Column moment ignored in the pile group; C4 oriented badly | C4 pile overloaded (1044 > 875 kN) | yes |
| B14 | Piles | Critical depth 20D measured from the cut-off | Qb ≈ 12 % high | yes |
| B15 | P5 | cv choice described as conservative | wrong justification | yes |
| B16 | Seismic | Zone V hard-coded in text; no zone input | breaks "no site data in code" | yes |
| B17 | All | Clause numbers written without the code text | unverifiable references | marked TO VERIFY |

---

## Part A — v1 platform (Gemini)

**A1. Direct-shear equation sign (P2, `js/moduleP2_logic.js`).** When least squares gave a negative intercept, the
equation text put the sign between the two terms ("τ = |c| (raw) − σ·tanφ"), so it read as if the friction term were
negative. Found by reading the calculation card against the fitted numbers. Fixed to "τ = −c + σ·tanφ" (sign on c).

**A2. Biaxial eccentricity L′ reporting (P3, `js/moduleP3_ui.js`).** The factor table showed B′ = g.B_eff
(= min(B′, L′)) but L′ = g.L_prime (= L − 2eL). When L − 2eL < B − 2eB the table showed the same shorter side for both,
a false square that contradicted B′/L′ in the shape factors (IS 6403 Table 2) and Df/B′ in the depth factors. Fixed to
g.L_eff (= max(B′, L′)) so B′, L′, B′/L′ and A′ agree with the calculation trail under any eccentricity.

**A3. Net safe load synced from P3 (`js/state.js`, `syncP4FromP3`).** The settlement module received a load
inconsistent with the net safe bearing capacity qns, counting the overburden twice. Fixed so the synced net load is consistent with qns
(net, per IS 8009 (Part 1):1976); added a water-table mode and a user-set IS 1904 allowable settlement.

**A4. IS 8009 rigidity factor missing on consolidation (P5, `js/moduleP4_logic.js`).** Rf = 0.80 (rigid footing) was
applied to the immediate settlement Se only. Δσz is evaluated on the centre line of a flexible loaded area, and IS 8009
cl. 9.4 applies the rigidity correction to the centre-line settlement — Se and Sc alike. Without it Sc of a rigid
footing was 1/0.8 = 1.25 times too large. Applied Rf to Sc and recorded it in the audit trail.

**A5. Schmertmann peak truncation (P5).** Iz(z′) was sampled at sublayer midpoints, which cuts off the triangular peak
Izp whenever a sublayer straddles z_peak (noticeable for 1–2 m sublayers). Replaced with exact piecewise-linear
integration split at z_peak, so ∫Iz dz′ is exact for any subdivision.

**A6. Validation that allowed impossible soil (P5).** The check gamma_sat ≥ gamma_moist allowed gamma_sat ≤ γw
(negative buoyant weight) and gapped or overlapping manual layers, silently corrupting σ′v0(z). Added γsat > γw,
layer-continuity validation, and an advisory when Cr > Cc.

**A7. Sub-day time rate (P5).** The time–settlement curve started at 1 day and the t50/t90 markers were limited to
≥ 1 day, so thin or silty strata that consolidate within hours fell off the plot and the time factor C2(t) could be
disabled by mistake. Curve start set to min(1 day, 0.5·t_target), marker bounds follow the curve, and the time input
stays active for Schmertmann's creep factor.

**A8. Stress-module load equilibrium (P4, `js/moduleP4_stress_ui.js`).** Syncing a footing from P3 used the nominal
dimensions, so Q ≠ q0·A for circular and eccentric footings. Fixed with an equal-area square (side D√(π/4)) for circles
and Meyerhof effective dimensions B′, L′ for eccentric loads; custom inspection depths are always kept in the table.

---

## Part B — GeoFound, v2 (Claude Code)

**B1. Footings wider than the column grid.** The sizing routine returned the smallest footing passing bearing and
settlement and reported it as "sized": **B = 6.00 m** for A6–D7 and **3.55 × 5.32 m** for C4 — on a **5 m** grid. Found
on the plan drawn to scale. An isolated footing needs B ≤ 5.0 − 0.3 = 4.7 m. Added the geometric check; such zones go
to the alternative foundation (`tests/results.test.ts`).

**B2. Pressure-bulb labels at invented depths.** Isobars were computed correctly but labelled at hard-coded depths
(0.4q at 1.15B …). Checked with the engine's Boussinesq centre stress for B = 3 m: at the "0.4q" label the true value is
**0.274q**, at "0.6q" it is **0.484q**. Labels are now placed on each computed isobar with its depth (0.1q ≈ 2.1B).

**B3. Shape factors after eccentricity.** The square row of IS 6403 Table 2 (sc = 1.3, sq = 1.2, sγ = 0.8) was used even
when eccentricity made the effective area a rectangle (e = 0.2 m on 2 m: B′/L′ = 0.8). Rectangle expressions are now
used whenever B′ ≠ L′ (`tests/engine.test.ts`).

**B4. Preconsolidation pressure.** The AI's own hand derivation (virgin line through the last two points, ≈ 118 kPa)
disagreed with its code (last three points, **114.6 kPa**). Found by our independent hand calculation (§6). The choice
is stated, the test asserts a band (110–119 kPa), σ′p is editable, and kg/cm² → kPa (×98.0665) is applied first.

**B5. SPT correction applied to clay.** CN = 0.77 log₁₀(2000/σ′v) was applied to every record, including the CI clay
(N = 6 → 6.8). Found by cross-checking against our v1 engine, which (correctly) leaves cohesive N uncorrected — IS 2131
corrections are for cohesionless soil. Also adopted v1's lower limit σ′v ≥ 25 kPa in CN.

**B6. Local–general shear transition read one way, silently (73 % apart).** For BH-1, B = 3.2 m, v2 gave
qnu = 345.0 kPa and v1 597.1 kPa. Term-by-term comparison found two hidden choices: strength of the founding layer
(φ = 30.0°) vs averaged over the shear zone Df → Df + B (φ = 31.8°), and interpolating qnu vs interpolating Nc, Nq, Nγ for
29° < φ < 36°. Both are now explicit options; with our chosen method v2 reproduces 597.1 kPa exactly, and the
criterion (φ) is stated in the assumptions.

**B7. Design that stopped at "fails".** Every column was sized to its own minimum and the building checks then failed
(max 94 mm, δ 68 mm, β 1/73) with no alternative proposed; the first pile layout gave one pile per column, which is not
buildable. We required a design that works: footings proportioned for **equal settlement**, piles where footings
cannot work, minimum two piles per column, and a check of every adjacent pair (`src/engine/finalDesign.ts`).

**B8. Concrete grade.** M25 was assumed (Ec = 25 GPa). Mandi has heavy monsoon rain and a water table that rises every
August — alternate wetting and drying, **severe** exposure (IS 456 Table 3), minimum **M30** (Table 5), cover 45 mm,
footings ≥ 50 mm. fck is now an input (default 30) and Ec = 5000√fck = 27.4 GPa.

**B9. No liquefaction check in seismic zone V.** BH-3 has loose saturated silty sand (N = 6, 24 % fines, water table
0.6 m) 25 m from a stream, and nothing checked it. Added the IS 1893 (Part 1):2016 Annex F simplified procedure
(Youd et al. 2001). BH-3 SM and SP liquefy at 0.18 g (**FS 0.82, 0.98**); BH-1/BH-2 sands pass at 0.18 g but fail at
0.36 g. Piles ignore shaft friction in liquefiable layers and carry it as downdrag (132 kN per pile). Hand check §L.

**B10. Water table at the time of the test.** SPT corrections and σ′v0 for the clay used the August design water
table. The corrections normalise N to the stress when the test was done, and σ′p comes from samples taken in October.
Now: SPT and (N1)60 use the October table (BH-1 1.5 m: N″ 17.0 → **18.9**, no dilatancy above the water table); σ′v0 at
UDS-1 79.5 → **92.0 kPa**, OCR 1.44 → **1.25** (the old value pushed load onto the flat Cr branch and under-predicted
settlement). Bearing, W′, Schmertmann and CSR keep the August table. Hand check §M.

**B11. Cohesion intercept for sand.** The least-squares intercepts (SM 1.03 kPa, SP 0.37 kPa) went into IS 6403,
adding about 6 % to qnu. For non-plastic sand the intercept is a fitting artefact; design c′ = 0, intercepts reported only.

**B12. Footings analysed one at a time — the error that changed the design.** Each footing's clay settlement used
only its own Δσ. On a 5 m grid the pressure bulbs overlap at the depth of the CI clay: superposing the stress from every
footing within 15 m adds about 55 kPa in the clay (one footing alone: about 16 kPa), which takes the lightly
over-consolidated clay past σ′p. Footings that settle 25–39 mm alone settle up to **114 mm** together (limit 50 mm).
**Recommendation changed from footings on lines 1–5 + piles on 6–7 + movement joint to bored piles under every
column** (one foundation type, no joint, maximum 13.1 mm). A test keeps the single-footing result for comparison.

**B13. Moment in pile groups; C4 orientation.** Pile groups were sized for P only. With the rigid-cap distribution
P/n ± M·x/Σx², two piles under C4 would carry 783 + 261 = **1044 kN > 875 kN**; C4 needs **four** (522 kN). C4's
footing also had the eccentricity across its short side; the long side is now along the moment (area loss 2e·B, not
2e·L). Hand check §N.

**B14. Pile critical depth.** P_D was limited at 20D below the cut-off; measured from ground level (IS 2911 overburden)
it is 95.5 instead of 109.5 kPa in BH-3, about 12 % less end bearing. Changed to ground level.

**B15. cv justification.** The AI called cv = 1.99 m²/yr (1–2 kg/cm² increment) conservative. With σ′v0 ≈ 80–92 kPa
plus Δσ the clay works at 98–196 kPa, exactly that increment — the value is accurate, not conservative. Wording fixed.

**B16. Seismic zone hard-coded.** "Zone V" was written into labels and the proposal text, and Z could only be typed as
a number — site data in code, against our own rule. Added a zone dropdown (II–V, IS 1893 Table 3) that sets Z and
amax = Z/2; all labels follow the input. Test: zone II makes BH-3 at 1.5 m safe (FS 2.94).

**B17. Clause numbers without the code text.** The AI wrote IS clause numbers it could not check. Every such reference
is marked **TO VERIFY** in the code (amber chip in the app) and listed in `REFERENCES.md`; we confirm them against
IS 6403, IS 2131, IS 1904, IS 8009, IS 1893 and IS 2911 before submission.

---

**Lessons.** The AI was reliable at turning a stated method into code and at bookkeeping (units, traces, tests). It
was unreliable wherever engineering judgement was needed: which water table applies, whether neighbouring footings
interact, what the site's exposure and seismicity demand, and when a "fails" result needs a design rather than a
report. Each of those was caught only because we checked the numbers by hand, compared two implementations, and read
the output against the problem statement.
