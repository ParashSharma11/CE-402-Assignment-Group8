# Harshit Pandey — GeoFound UI/UX, foundation design, integration, deployment

## Calculation modules you own
| Module | File | Verify |
|---|---|---|
| Final design — equal-settlement sizing, IS 1904 building checks | `src/engine/finalDesign.ts`, `design.ts` | IS 1904:1986 Table 1 limits (total, δ, β) for RC frames; justify the sand vs plastic-clay row |
| Pile alternative — capacity, number of piles, settlement | `src/engine/piles.ts` | IS 2911 (Part 1/Sec 2) Annex B formula and clause numbers; K = 1.5, α = 1.0, FS = 2.5, spacing ≥ 3D, minimum 2 piles; D/100 rule; Vesic group factor |
| Movement joint between piled and footing blocks | `finalDesign.ts` | IS 1893 / IS 4326 separation requirement for seismic zone V |
| Oedometer (Cc, Cr, σ′p) and UU cu | `src/engine/labTests.ts` | Casagrande construction choice (last three loading points); kg/cm² → kPa |

Hand calculation → test: work one pile by hand (BH-3, Ø0.5 m, toe at 12.7 m: Qb, Qs per layer, Q_safe) and add it to
`tests/hand_calcs.md` §9 and `tests/final.test.ts`.

## Integration and documentation

1. Push the `geofound` branch (done from this machine) and share `docs/team/README.md` with the team.
2. Deploy to Vercel from the `geofound` branch; add `GEMINI_API_KEY` in Vercel → Settings → Environment Variables.
   Put the URL in `README.md`.
3. GitHub Pages currently serves v1 from `main`. After the pull request `geofound → main` is merged, Pages would serve
   GeoFound's unbuilt source — switch Pages off (Settings → Pages) or point it to `platform-v1/`, and use the Vercel URL.
4. Verify the **IS 1904:1986 settlement limits** (Table 1, RC frame, isolated footings): edit `limitsCandidate` in
   `src/examples/mandi.ts` and the Project step defaults; justify sand vs plastic-clay row in the report.
5. Collect everyone's AI sessions into `AI_LOG.md`; finalise `docs/AI_AUDIT.md` (max two pages).
6. Open the pull request `geofound → main` when all members have committed and `npm test` passes.
