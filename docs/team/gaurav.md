# Gaurav Dtyal — P3 IS 6403 bearing capacity

Your v1 engine (`platform-v1/js/moduleP3_logic.js`) runs live in GeoFound's cross-check. The first comparison differed
by 73 % (597.1 vs 345.0 kPa, BH-1, B = 3.2 m) because of two method choices — your shear-zone averaging of c, φ, γ and
your interpolation of Nc, Nq, Nγ between local and general shear. Both are now options in v2, **your method is the
default**, and v2 reproduces your 597.1 kPa exactly. See `docs/AI_AUDIT.md` item B6.

## 1. Settle the method from the code text and justify it (2–3 sentences in the report)
- IS 6403:1981 wording for 29° < φ < 36°: interpolate the **factors**, the **strength**, or the **capacity**?
- Averaging over Df → Df + B: cite the basis (IS 6403 or a textbook).

## 2. Verify clause numbers — v1 and v2 disagree
| Item | v2 (`src/engine/bearing.ts`) | v1 (your code) |
|---|---|---|
| Depth factors | cl. 5.1.2.2 — TO VERIFY | cl. 5.1.2.1 |
| Inclination factors | cl. 5.1.2.3 — TO VERIFY | cl. 5.1.2.1 |
| Water-table factor W′ | cl. 5.1.2.4 — TO VERIFY | cl. 5.1.2.2 |
| Undrained (φ = 0) | cl. 5.2 — TO VERIFY | cl. 5.1.3 |
| Effective area B′ = B − 2e | cl. 5.1.3 — TO VERIFY | cl. 5.1.1 |
Fix the wrong ones in **both** files.

## 3. Hand calculation → test
Work one footing by hand (e.g. A1 on BH-2, B = 2.40 m, Df = 1.5 m, P = 702 kN) with every factor, add it to
`tests/hand_calcs.md` §9 and as a test in `tests/engine.test.ts`.

## 4. Commit
`git commit -m "P3: verify IS 6403 clause numbers, justify transition method, add A1 hand calculation (Gaurav)"`
