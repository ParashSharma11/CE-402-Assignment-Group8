# Harshit Pandey — GeoFound UI/UX, foundation design, integration, deployment

## Calculation modules you own
| Module | File | Verify |
|---|---|---|
| Final design — equal-settlement footings with neighbouring-footing stress, IS 1904 checks, piles where footings fail | `src/engine/finalDesign.ts`, `design.ts` | IS 1904:1986 Table 1 limits (total, δ, β) for RC frames; justify the row used |
| Bored piles — capacity, downdrag, moment in the group, settlement | `src/engine/piles.ts` | IS 2911 (Part 1/Sec 2) Annex B; K = 1.5, α = 1.0, FS = 2.5, critical depth 20D from ground level, spacing 3D, minimum 2 piles; D/100 rule; Vesic group factor |
| Liquefaction | `src/engine/liquefaction.ts` | IS 1893 (Part 1):2016 Annex F: amax (Z/2 assumed), Mw, CE (hammer energy), FS criterion; which edition the course uses |
| Oedometer (Cc, Cr, σ′p) and UU cu | `src/engine/labTests.ts` | Casagrande construction (last three loading points); kg/cm² → kPa |

Hand calculations already in `tests/hand_calcs.md` §L (liquefaction), §M (test-time WT), §N (C4 piles). Still to add:
one pile by hand (BH-3, Ø0.5 m, toe 12.7 m: Qb, Qs per layer, downdrag, Q_safe) → §9 and `tests/final.test.ts`.

## Integration and documentation
1. ~~Deploy to Vercel, add `GEMINI_API_KEY`~~ — done: https://geofound.vercel.app
2. Get C4's assigned P and M from the brief / instructor; enter them on the Data page and update `src/examples/mandi.ts`
   and `docs/DESIGN_SUMMARY.md`.
3. Default branch: ask the owner (Parash) to make `geofound` the default branch (Settings → Default branch). GitHub
   Pages serves v1 from `main`; keep it, or point it to `platform-v1/`.
4. Collect everyone's AI sessions into `AI_LOG.md`; keep `docs/AI_AUDIT.md` within two pages for the report.
