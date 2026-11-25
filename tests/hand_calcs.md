# Hand calculations used as test benchmarks

Every number asserted in `tests/*.test.ts` is derived here by hand, independently of the code.
**Team: add your own group hand calculations in section 9 — the tests will be extended to match.**
Units: kPa, m, kN/m³. γw = 9.81 kN/m³.

## 1. Unit conversions (lab-sheet traps)
- 1 kg/cm² = 9.80665 N / 10⁻⁴ m² = **98.0665 kPa**.
- cv = 6.3 × 10⁻⁴ cm²/s × 10⁻⁴ m²/cm² × 31 557 600 s/yr = **1.9881 m²/yr**.

## 2. Effective stress — BH-1, WT at 2.6 m, z = 7.225 m (mid-height of UDS-1)
| Slice | γ (kN/m³) | h (m) | Δσ (kPa) | Σσv |
|---|---|---|---|---|
| Fill 0–0.6 | 16.5 | 0.6 | 9.90 | 9.90 |
| SM 0.6–2.6 (moist) | 18.0 | 2.0 | 36.00 | 45.90 |
| SM 2.6–3.4 (sat) | 20.0 | 0.8 | 16.00 | 61.90 |
| SP 3.4–5.8 (sat) | 20.4 | 2.4 | 48.96 | 110.86 |
| CI 5.8–7.225 (sat) | 18.6 | 1.425 | 26.505 | **137.365** |

u = 9.81 × (7.225 − 2.6) = 45.371 kPa → **σ′v = 91.994 kPa**.

## 3. SPT correction — BH-1, N = 13 at 1.5 m, design WT 1.0 m
σv = 9.9 + 0.4 × 18.0 + 0.5 × 20.0 = 27.10 kPa; u = 0.5 × 9.81 = 4.905 kPa; σ′v = **22.195 kPa**.
CN = 0.77 log₁₀(2000 / 22.195) = 0.77 × 1.95477 = **1.50517**; N′ = 1.50517 × 13 = **19.567**.
SM below WT and N′ > 15 → dilatancy: N″ = 15 + ½(19.567 − 15) = **17.284**.

## 4. Direct shear least squares — SM soaked (50, 29.8), (100, 58.9), (150, 87.5)
σ̄ = 100, τ̄ = 58.7333; Sxy = (−50)(−28.9333) + (50)(28.7667) = 2885.0; Sxx = 5000.
tanφ′ = 0.5770 → **φ′ = 29.987°**; c′ = 58.7333 − 0.577 × 100 = **1.033 kPa**.

## 5. UU triaxial
UDS-1: cu = (57.2 + 55.8 + 58.1)/3 / 2 = **28.517 kPa**. UDS-2: (71.0 + 73.4 + 72.2)/3 / 2 = **36.100 kPa**.

## 6. Oedometer UDS-1
- Cc (last three loading points 2, 4, 8 kg/cm²; x = log p): x̄ = 0.60206, ē = 0.69133,
  Sxy = −0.052981, Sxx = 0.181238 → **Cc = 0.2923**.
- Cr (8 → 2 → 0.5 kg/cm²): Sxy = −0.027695, Sxx = 0.724952 → **Cr = 0.0382**.
- Casagrande: max curvature at 1.0 kg/cm²; tangent slope = ½(−0.09634 − 0.24582) = −0.17108;
  bisector slope = tan(½ arctan(−0.17108)) = −0.08492; intersect with VCL (slope −0.2923 through (log 8, 0.603)):
  x = 0.014003 / 0.207409 = 0.06751 → p = 1.1682 kg/cm² = **114.6 kPa** (graphical estimate, ± a few kPa).

## 7. IS 6403 factors and a full bearing example
- φ = 30°: Nq = e^(π tan30°) tan²60° = 6.1337 × 3 = **18.401**; Nc = 17.401 / tan30° = **30.140**;
  Nγ = 2 × 19.401 × tan30° = **22.402** (match IS 6403 Table 1). φ = 0: **Nc = 5.14**.
- Local shear φ = 30°: φm = arctan(⅔ tan30°) = **21.05°**.
- Example: square B = 2 m, Df = 1 m, c = 0, φ = 30° (general shear), γ = 18 kN/m³ dry, WT deep.
  q = 18 kPa; sq = 1.2, sγ = 0.8; Nφ = 3, dq = dγ = 1 + 0.1 × 0.5 × √3 = 1.08660; W′ = 1.
  Surcharge term = 18 × 17.401 × 1.2 × 1.0866 = 408.42 kPa.
  Self-weight term = 0.5 × 2 × 18 × 22.402 × 0.8 × 1.0866 = 350.53 kPa.
  **qnu = 758.95 kPa, qns = qnu/3 = 252.98 kPa.**
- W′: zw = Df → 0.5; zw = Df + B → 1.0; zw = Df + B/2 → **0.75**.

## 8. Stress increase and settlement
- Corner influence m = n = 1: I = [2√3/4 · 4/3 + arctan(√3)] / 4π = (1.15470 + 1.04720)/12.5664 = **0.17522**.
- Centre of 2 m × 2 m at z = 1 m: 4 × I(1, 1) = **0.70088 q**. 2:1 at z = B (square): q/4 = **0.25 q**.
- Consolidation, NC: Cc = 0.3, e0 = 0.9, H = 1 m, σ′0 = 100, Δσ = 100 → 0.3/1.9 × log₁₀2 = **47.53 mm**.
- OC crossing: Cc = 0.3, Cr = 0.05, e0 = 0.9, H = 1, σ′0 = 100, σ′p = 150, Δσ = 100:
  (1/1.9)[0.05 log₁₀1.5 + 0.3 log₁₀(200/150)] = (1/1.9)(0.008805 + 0.037482) = **24.36 mm**.
- Terzaghi: U = 50 % ↔ **Tv = 0.197**; U = 90 % ↔ **Tv = 0.848**.
- Schmertmann: dry uniform sand γ = 12.5, E = 10 000 kPa; square B = 2, Df = 1, Δp = 100 kPa, t = 0.1 yr.
  σ′v0 = 12.5 → C1 = 1 − 0.5 × 12.5/100 = 0.9375; C2 = 1. σ′vp at Df + B/2 = 2 m = 25 → Izp = 0.5 + 0.1√4 = 0.70.
  ∫Iz dz = ½(0.1 + 0.7)(1.0) + ½(0.7)(3.0) = 1.45 m → s = 0.9375 × 100 × 1.45 / 10 000 = **13.59 mm**.

## 9. Group 8 hand calculations
_To be added by the team (e.g. one footing per borehole zone with λ = 1.08)._
