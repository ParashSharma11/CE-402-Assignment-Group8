# Muvan — P5 settlement engine (and P3 UI in v1)

Your v1 settlement engine (`platform-v1/js/moduleP4_logic.js`) is cross-checked by GeoFound: Terzaghi U(Tv) agrees to
four decimals. v1 also offers IS 8009 / Janbu elastic settlement and Westergaard stress, which v2 does not — worth a
sentence in the report on why the assignment's Schmertmann (1978) method was used for the granular layers.

## 1. Verify (edit `src/engine/settlement.ts`)
| Item | v2 currently says | Check |
|---|---|---|
| Consolidation NC/OC equations | Das (2014) Eq. 11.29–11.32; IS 8009 (Part 1):1976 — TO VERIFY clause | IS 8009 Part 1 clause |
| Cr = Cc/5 when Cr is missing | TO VERIFY | typical range and source |
| Schmertmann L/B interpolation 1 → 10 | Schmertmann et al. (1978) | confirm in the paper / Das |
| Cc = 0.009(LL − 10) for BH-2, BH-3 | Skempton (1944) | confirm applicability (NC, low sensitivity) |

## 2. Hand calculation → test
Work the consolidation settlement of one 0.5 m sublayer of BH-3 clay under B6 by hand (σ′0, Δσ, e0, Cc) and add it to
`tests/hand_calcs.md` §9 plus a test using `sublayerSettlement` in `tests/engine.test.ts`.

## 3. Optional cross-check
Add a row to `tests/crosscheck.test.ts` comparing your v1 `computeSettlement` consolidation for one footing with v2's
`consolidationSettlement` (same sublayers ≤ 0.5 m, same Δσ method) and explain any difference.

## 4. Commit
`git commit -m "P5: verify IS 8009 consolidation clauses and add BH-3 sublayer hand calculation (Muvan)"`
