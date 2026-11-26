# Design summary — Mandi students' hostel (Group 8)

Numbers produced by the GeoFound engine for the Mandi example (`src/examples/mandi.ts`), group g = 8, λ = 1.08.
Every value can be traced on the app's screens (equation → substituted values → result → source) and most are
benchmarked by hand in `tests/hand_calcs.md`. Items marked **ASSUMED** or **TO VERIFY** must be confirmed by the team.
If an input changes (e.g. C4's assigned P and M), re-run the app; these tables are a snapshot of 26 Nov 2026.

## 1. Loads (×λ = 1.08)
| Column | P, kN | M, kN·m |
|---|---|---|
| Corner A1, A7, D1, D7 | 702 | 0 |
| Edge (14) | 1080 | 0 |
| Interior (9) | 1566 | 0 |
| C4 (eccentric) | 1566 **ASSUMED** | 391.5 **ASSUMED** (e = 0.25 m, along the footing's long side) |

## 2. Soil parameters
| Parameter | Value | Basis |
|---|---|---|
| SM, soaked direct shear | φ′ = 29.98°, c′ = 1.03 kPa (fit) → **design c′ = 0** | least squares; non-plastic sand |
| SP, soaked direct shear | φ′ = 34.41°, c′ = 0.37 kPa (fit) → **design c′ = 0** | least squares |
| CI, UU triaxial | cu = 28.5 kPa (UDS-1), 36.1 kPa (UDS-2) | cu = mean deviator / 2 |
| CI, oedometer (UDS-1) | Cc = 0.292, Cr = 0.038, σ′p = 114.6 kPa | kg/cm² × 98.0665; Casagrande |
| OCR at UDS-1 (7.225 m) | σ′v0 = 92.0 kPa (October WT) → **OCR = 1.25** | WT at the time of sampling |
| cv (design) | 6.3 × 10⁻⁴ cm²/s = **1.99 m²/yr** | 1–2 kg/cm² increment (the clay works at 98–196 kPa) |
| BH-3 clay (no oedometer) | Cc = 0.009(LL − 10) = 0.315, e0 = w·Gs = 0.945, NC | Skempton (1944) |

## 3. Water tables
| Use | Water table | Why |
|---|---|---|
| Bearing capacity, W′, Schmertmann, liquefaction CSR | seasonal high (Aug): BH-1 1.0, BH-2 1.7, BH-3 0.6 m | lowest effective stress (conservative) |
| SPT corrections, (N1)60, σ′v0 / OCR in the clay | measured 24 h after boring (Oct): 2.6, 3.2, 1.9 m | stress state when the test / sample was taken |

## 4. Isolated footings (tried first)
Smallest footing passing IS 6403 (FS = 3) and settlement **for that footing alone**:

| Column (zone) | Size, m | qn, kPa | qnu / qns, kPa | si / sc (alone), mm |
|---|---|---|---|---|
| A1 (BH-2) | 2.40 | 125.4 | 377.1 / 125.7 | 11.0 / 7.6 |
| B2 (BH-2) | 3.05 | 171.9 | 526.8 / 175.6 | 19.3 / 15.8 |
| A3 (BH-1) | 2.70 | 151.0 | 474.7 / 158.2 | 15.5 / 9.5 |
| B3 (BH-1) | 3.00 | 176.9 | 535.8 / 178.6 | 19.4 / 15.2 |
| C4 (BH-1) | 2.85 × 4.28 | 152.2 | 470.7 / 156.9 | 16.2 / 18.8 |
| B6 (BH-3) | 6.00 (max) | 46.8 | 58.0 / 19.3 | 2.9 / 91.4 — **fails** |

**Why isolated footings are rejected.** On the 5 m grid the pressure bulbs of neighbouring footings overlap at the
depth of the CI clay. Superposing the Boussinesq stress from every footing within 15 m adds about 55 kPa in the clay
(one footing alone: about 16 kPa), which takes the lightly over-consolidated clay past σ′p. With the best
equal-settlement layout the footings then settle up to **114 mm** (limit 50 mm), with δ up to 50.7 mm (C2–C3). BH-3
also fails on bearing and is liquefiable.

## 5. Liquefaction (IS 1893 (Part 1):2016 Annex F; Youd et al. 2001)
Seismic zone V, Z = 0.36, amax = Z/2 = 0.18 g **ASSUMED (TO VERIFY)**, Mw = 7.5.

| Borehole | Min FS at 0.18 g | Liquefiable at 0.18 g | At amax = Z = 0.36 g |
|---|---|---|---|
| BH-1 | 1.58 | none | SM, SP (FS 0.79) |
| BH-2 | 1.77 | none | SM (FS 0.88) |
| BH-3 | **0.82** | **SM 0.9–2.6 m, SP 2.6–4.4 m** | SM, SP (FS 0.41) |

Clay (PI 20–22 %) is not susceptible (Bray & Sancio 2006); the gravel is too dense.

## 6. Recommended foundation — bored cast-in-situ piles under every column
Ø0.5 m, socket 1.5 m into the very dense GW, FS = 2.5, spacing 3D = 1.5 m, square caps with tie beams, M30 concrete.
Critical depth 20D from ground level. In BH-3, shaft friction in the liquefiable sands is ignored and carried as
downdrag (132 kN per pile).

| Zone | Toe, m | Length, m | Qb / Qs, kN | Q_safe per pile, kN |
|---|---|---|---|---|
| BH-2 (lines 1–2) | 11.1 | 9.6 | 1512 / 1020 | 1013 |
| BH-1 (lines 3–5) | 12.1 | 10.6 | 1372 / 816 | 875 |
| BH-3 (lines 6–7) | 12.7 | 11.2 | 1267 / 588 (+132 downdrag) | 742 |

| Columns | Piles | Max pile load, kN | Settlement, mm |
|---|---|---|---|
| A1, D1 | 2 | 351 | 11.3 |
| A2, B1, C1, D2 | 2 | 540 | 11.9 |
| B2, C2 | 2 | 783 | 12.8 |
| A3–A5, D3–D5 | 2 | 540 | 12.1 |
| B3–B5, C3, C5 | 2 | 783 | 13.1 |
| **C4** | **4** (moment: 2 piles would carry 1044 kN > 875) | 522 | 11.5 |
| A6, B7, C7, D6 | 2 | 672 (incl. downdrag) | 12.8 |
| A7, D7 | 2 | 483 | 12.0 |
| **B6, C6** | **3** (downdrag) | 654 | 12.7 |

One foundation type for the whole building, so no movement joint is needed.

## 7. Checks on the final design
| Check | Value | Limit | Status |
|---|---|---|---|
| Pile capacity (governing A6) | 672 kN per pile | ≤ Q_safe 742 kN | pass |
| Maximum total settlement | 13.1 mm | ≤ 50 mm | pass |
| Differential settlement (B4–C4) | 1.54 mm | ≤ 0.0015 L = 7.5 mm | pass |
| Angular distortion (B4–C4) | 1/3239 | ≤ 1/666 | pass |
| Pile caps fit the grid | 2.3 m | ≤ 4.7 m | pass |
| Liquefaction | BH-3 liquefiable | piles bypass it | addressed |

Settlement limits: IS 1904:1986 Table 1, RC frame, isolated foundations on sand — **TO VERIFY** and justify in the report.

## 8. Open items for the team
1. C4's assigned P and M (enter on the Data page; re-run).
2. amax for Annex F (Z/2 assumed) and the IS 1893 edition your course uses.
3. IS 1904 limits, IS 2911 pile items (K, α, critical depth, spacing), every **TO VERIFY** clause.
4. Pile structural design (reinforcement, cap thickness) is outside this app.
