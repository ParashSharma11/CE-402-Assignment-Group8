# Repo integrator — integration, deployment, documentation

1. Push the `geofound` branch (done from this machine) and share `docs/team/README.md` with the team.
2. Deploy to Vercel from the `geofound` branch; add `GEMINI_API_KEY` in Vercel → Settings → Environment Variables.
   Put the URL in `README.md`.
3. GitHub Pages currently serves v1 from `main`. After the pull request `geofound → main` is merged, Pages would serve
   GeoFound's unbuilt source — switch Pages off (Settings → Pages) or point it to `platform-v1/`, and use the Vercel URL.
4. Verify the **IS 1904:1986 settlement limits** (Table 1, RC frame, isolated footings): edit `limitsCandidate` in
   `src/examples/mandi.ts` and the Project step defaults; justify sand vs plastic-clay row in the report.
5. Collect everyone's AI sessions into `AI_LOG.md`; finalise `docs/AI_AUDIT.md` (max two pages).
6. Open the pull request `geofound → main` when all members have committed and `npm test` passes.
