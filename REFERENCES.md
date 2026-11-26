# References

Every equation in `src/engine/` carries a `// SOURCE:` comment. This file lists those sources.
Items marked **TO VERIFY** were written by the AI and have **not** yet been checked against the code text
or textbook. The team must confirm each clause, table or equation number before submission. Textbook equation
numbers depend on the edition you hold.

## Indian Standards
| Code | Used for | Where in code |
|---|---|---|
| IS 6403:1981 — Code of practice for determination of bearing capacity of shallow foundations | Nc, Nq, Nγ (Table 1); shape factors (Table 2); depth, inclination factors; water-table factor W′; local / general shear; effective area B′ = B − 2e; net vs gross pressure; FS = 3 | `bearing.ts`, `design.ts` (clause numbers 5.1.2, 5.1.2.2–5.1.2.4, 5.1.3, 5.2 **TO VERIFY**) |
| IS 2131:1981 — Method for standard penetration test for soils | Overburden correction CN (Fig. 1); dilatancy correction N″ = 15 + ½(N′ − 15) | `spt.ts` (figure/clause numbers **TO VERIFY**; CN cap 2.0 **TO VERIFY**) |
| IS 1904:1986 — Design and construction of foundations in soils: general requirements | Definitions and permissible total settlement, differential settlement and angular distortion for RC frames (Table 1) | `design.ts`, `src/examples/mandi.ts` (limit values **TO VERIFY** — team must cite) |
| IS 8009 (Part 1):1976 — Calculation of settlement of foundations, shallow foundations | Consolidation settlement, 2:1 load spread | `settlement.ts`, `stressIncrease.ts` (**TO VERIFY**) |
| IS 1498:1970 — Classification and identification of soils | Group symbols (SM, SP, CI, GW) and hatching on logs | UI (`viz.tsx`) |
| IS 1893 (Part 1):2016 — Criteria for earthquake resistant design of structures | Zone factor Z (Table 3); liquefaction potential by the simplified procedure (Annex F); separation between blocks | `liquefaction.ts`, `finalDesign.ts` (amax = Z/2 and clause wording **TO VERIFY**; a 2025 revision exists — confirm the edition the course uses) |
| IS 2911 (Part 1/Sec 2):2010 — Design and construction of pile foundations, bored cast-in-situ piles | Static capacity Qb + Qs (Annex B), critical depth 15D–20D, spacing, negative skin friction | `piles.ts` (**TO VERIFY**) |
| IS 456:2000 — Plain and reinforced concrete | Exposure (Table 3), minimum grade M30 for severe (Table 5), cover (cl. 26.4.2), Ec = 5000√fck (cl. 6.2.3.1) | `piles.ts`, assumptions table |

## Papers
- Terzaghi, K. (1925). *Erdbaumechanik auf bodenphysikalischer Grundlage*. Effective stress; 1-D consolidation theory (U–Tv series). `stress.ts`, `settlement.ts`
- Newmark, N. M. (1935). Simplified computation of vertical pressures in elastic foundations. Univ. Illinois Eng. Exp. Station Circ. 24. Corner influence factor. `stressIncrease.ts`
- Casagrande, A. (1936). The determination of the pre-consolidation load and its practical significance. Proc. 1st ICSMFE. σ′p construction. `labTests.ts`
- Skempton, A. W. (1944). Notes on the compressibility of clays. QJGS 100. Cc = 0.009(LL − 10). `labTests.ts`
- Meyerhof, G. G. (1963). Some recent research on the bearing capacity of foundations. Can. Geotech. J. 1(1). Inclination factors. `bearing.ts`
- Vesic, A. S. (1973). Analysis of ultimate loads of shallow foundations. JSMFD ASCE 99(SM1). Nγ = 2(Nq + 1) tanφ. `bearing.ts`
- Peck, R. B., Hanson, W. E. & Thornburn, T. H. (1974). *Foundation Engineering*, 2nd ed. Wiley. SPT overburden correction chart. `spt.ts`
- Seed, H. B. & Idriss, I. M. (1971). Simplified procedure for evaluating soil liquefaction potential. JSMFD ASCE 97(SM9). CSR. `liquefaction.ts`
- Liao, S. S. C. & Whitman, R. V. (1986). Overburden correction factors for SPT in sand. JGE ASCE 112(3). CN = (Pa/σ′v)^0.5. `liquefaction.ts`
- Youd, T. L. et al. (2001). Liquefaction resistance of soils: summary report from the 1996 NCEER and 1998 NCEER/NSF workshops. J. Geotech. Geoenviron. Eng. 127(10), 817–833. rd, CRR, fines correction, CR/CB, MSF. `liquefaction.ts`
- Bray, J. D. & Sancio, R. B. (2006). Assessment of the liquefaction susceptibility of fine-grained soils. J. Geotech. Geoenviron. Eng. 132(9). PI ≥ 12 screening. `liquefaction.ts`
- Vesic, A. S. (1969). Experiments with instrumented pile groups in sand. ASTM STP 444. Group settlement factor √(Bg/D). `piles.ts`
- Schmertmann, J. H., Hartman, J. P. & Brown, P. R. (1978). Improved strain influence factor diagrams. JGED ASCE 104(GT8), 1131–1135. `settlement.ts`

## Textbooks
- Das, B. M. (2014). *Principles of Geotechnical Engineering*, 8th ed. Cengage — §9 (stresses), §11 (consolidation: Eq. 11.29–11.32, 11.46–11.49), §12 (shear strength, UU Eq. 12.26). Equation numbers **TO VERIFY** for your edition.
- Das, B. M. (2016). *Principles of Foundation Engineering*, 8th ed. Cengage — §5 (stress increase Eq. 5.20–5.21, 2:1 Eq. 5.36; Schmertmann §5.14). Equation numbers **TO VERIFY**.
- Bowles, J. E. (1996). *Foundation Analysis and Design*, 5th ed. McGraw-Hill — Table 5-6, E = 500(N + 15) kPa for sand (**ASSUMED** correlation used in the Mandi example only).
- Tomlinson, M. J. & Woodward, J. (2014). *Pile Design and Construction Practice*, 6th ed. CRC Press — D/100 base-settlement rule; rigid-cap load distribution P/n ± M·x/Σx² (**TO VERIFY** section).
- Terzaghi, K. & Peck, R. B. (1948/1967). *Soil Mechanics in Engineering Practice*. Wiley — dilatancy correction; Cc correlation.

## Data
- CE 402 Assignment brief, IIT Mandi, 05 Nov 2026 — borehole logs BH-1/2/3, BH-1 laboratory sheets, building grid and loads. Used only in `src/examples/mandi.ts`.

## Software
React 18, Vite 6, TypeScript 5, Tailwind CSS 4, Framer Motion 11, Lenis, Radix UI, three.js / react-three-fiber / drei,
Zustand, Vitest, Playwright; Google Gemini API (`@google/genai`) for the optional summary.
Fonts: Tanker, Cabinet Grotesk, Satoshi (Indian Type Foundry / Fontshare, free licence); JetBrains Mono (OFL).
