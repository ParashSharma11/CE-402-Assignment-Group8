# Namit Mehta — P4 stress increase

Your v1 stress module (`platform-v1/js/moduleP4_stress_logic.js`) agrees with v2 to six decimals for centre, corner
and 2:1 at every depth tested (`tests/crosscheck.test.ts`, P4 row) and runs live in the Calculations cross-check.

## 1. Verify (edit `src/engine/stressIncrease.ts`)
| Item | v2 currently says | Check |
|---|---|---|
| Newmark corner formula | Newmark (1935); Das (2016) Eq. 5.20–5.21 | equation numbers in your edition |
| 2:1 method | Das (2016) Eq. 5.36; IS 8009 (Part 1):1976 — TO VERIFY | clause in IS 8009 |
| atan branch for m²n² > m² + n² + 1 | +π added | v1 uses atan2 — note both are equivalent |

## 2. Hand calculation → test
Compute Δσz under the centre and a corner of the C3 trial footing (B = 3.00 m, q = 176.9 kPa — Design → Isolated trial) at z = 2 m by hand
with the influence chart or formula; add to `tests/hand_calcs.md` §9 and as a test in `tests/engine.test.ts`.

## 3. Superposition
The final design now adds the stress from neighbouring footings in the clay (`finalDesign.ts`, `deltaSigmaAt` with
offsets). Check one value by hand: Δσz at 6 m below B3's base caused by the B4 footing 5 m away, and note it in §9.

## 4. Pressure-bulb check
The pressure-bulb labels were wrong in an earlier AI version (`docs/AI_AUDIT.md` item B2). Check two isobar depths on the
Ground screen against your hand values and note the result in the audit.

## 5. Commit
`git commit -m "P4: verify stress-increase sources and add C3 hand calculation (Namit)"`
