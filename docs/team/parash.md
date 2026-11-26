# Parash Sharma — P1 soil profile, P2 SPT and direct shear

Your v1 engines (`platform-v1/js/moduleP1_logic.js`, `moduleP2_logic.js`) are used live by GeoFound. The cross-check
found that **your v1 was right and v2 was wrong** on two points (v2 corrected clay N; v2 lacked the 25 kPa limit) —
see `docs/AI_AUDIT.md` item B5. v2 now matches your engine exactly (`tests/crosscheck.test.ts`, P2 rows).

## 1. Verify clauses (edit `src/engine/spt.ts`, and v1 if needed)
| Item | v2 currently says | v1 says | Check in IS 2131:1981 |
|---|---|---|---|
| Overburden correction CN = 0.77 log₁₀(2000/σ′v) | "Fig. 1 — TO VERIFY" | "IS 2131 Fig. 1 (Peck, Hanson & Thornburn 1974)" | figure / clause number |
| Lower limit σ′v ≥ 25 kPa, CN ≤ 2.0 | "TO VERIFY" | used in code | is a limit stated in the code? |
| Dilatancy N″ = 15 + ½(N′ − 15) | "TO VERIFY clause" | "Clause 3.6.2" | confirm 3.6.2 |
| Corrections only for cohesionless soil | "IS 2131:1981" | used in code | clause wording |

## 2. Hand calculation → test
Add one SPT row of your choice (e.g. BH-2, N = 26 at 4.5 m, WT at test time 3.2 m — corrections use the October WT, see `docs/AI_AUDIT.md` item B10) to `tests/hand_calcs.md` §9 with σ′v, CN,
N′, N″ worked by hand, then add a matching `it(...)` in `tests/engine.test.ts` (copy the §3 test pattern).

## 3. Commit
`git commit -m "P2: verify IS 2131 clauses and add BH-2 SPT hand calculation (Parash)"`
