# Team tasks — how each member contributes to GeoFound (v2)

GeoFound (v2) is in this repo on the branch **`geofound`**. The original platform (v1) is kept unchanged in
`platform-v1/`, with all your commits, and **its calculation engines are used by v2**: the Calculations screen runs your
v1 code live next to the v2 engine ("Team engine cross-check"), and `tests/crosscheck.test.ts` checks they agree.

Each member has one short task file. Every task is real engineering work (verify clauses, add a hand calculation,
review your module) and ends in **a commit from your own GitHub account**, which the assignment requires (P8).

| Member | Owns | Task file |
|---|---|---|
| Parash Sharma | P1 soil profile, P2 SPT + direct shear | [parash.md](parash.md) |
| Gaurav Dtyal | P3 IS 6403 bearing capacity | [gaurav.md](gaurav.md) |
| Muvan | P5 settlement engine (IS 8009, Schmertmann, consolidation) | [muvan.md](muvan.md) |
| Namit Mehta | P4 stress increase | [namit.md](namit.md) |
| Harshit Pandey | GeoFound UI/UX and front-end, integration, deployment, docs | [harshit.md](harshit.md) |

## Setup (once, ~5 min)
```bash
git clone https://github.com/ParashSharma11/CE-402-Assignment-Group8.git
cd CE-402-Assignment-Group8
git checkout geofound
npm install
npm test          # all tests must pass before and after your change
npm run dev       # http://localhost:5173 — open "Open Mandi example"
```

## How to commit your part
```bash
git pull                       # get the latest geofound branch
# ... make your edits ...
npm test
git add <the files you changed>
git commit -m "P3: verify IS 6403 clause numbers and add group hand calculation (Gaurav)"
git push
```
Do not push to `main`. When everyone is done, Harshit opens a pull request `geofound → main`.

## Rules
- Every equation keeps a `// SOURCE:` comment. Replace `TO VERIFY` only after you have checked the code text
  (IS 6403:1981, IS 2131:1981, IS 1904:1986, IS 8009 Part 1:1976) — write the exact clause/table number.
- Where v1 and v2 cite **different** clause numbers for the same thing, settle it from the code and fix both.
- SI units beside every number. Nothing site-specific outside `src/examples/`.
- Record any AI output you rejected or corrected in `AI_LOG.md` (your session) and, if it is an engineering error,
  in `docs/AI_AUDIT.md`.
