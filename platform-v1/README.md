# GeoTech Analytics — CE-402 Geotechnical Engineering Platform (Group 8)

Interactive browser-based geotechnical investigation and shallow foundation design platform developed for **CE-402 (IIT Mandi)**. Built with modular vanilla JavaScript, Tailwind CSS, and Plotly.js for zero-installation local (`file://`) and public GitHub Pages execution.

**Live Application:** https://parashsharma11.github.io/CE-402-Assignment-Group8/

## Architecture Note
The platform began as a Python/Streamlit prototype (Nov 17–18) and was migrated on Nov 21 to a client-side HTML5, Tailwind CSS, Plotly.js, and Vanilla JavaScript architecture to enable zero-installation local (`file://`) execution and direct public hosting on GitHub Pages.

## Engineering Standards & Units
- **Strict SI Units:** Force (`kN`), Stress/Modulus (`kPa`), Depth/Thickness (`m`), Settlement (`mm`), Unit Weight (`kN/m³`), Consolidation Coefficient (`mm²/s`), Friction Angle (`deg`).
- **Physical Constant:** Freshwater unit weight $\gamma_w = 9.81\text{ kN/m}^3$.
- **Zero Hard-Coded Site Data:** All tables accept arbitrary unseen soil profiles, groundwater levels, and test datasets.

## Module Progress
- [x] **Module P1 — Soil Profile & Stratigraphy:** 15-parameter editable stratigraphy, continuity & elastic stability validation, derived stiffness ($E_{\text{oed}}$, $m_v$, $\gamma'_{\text{sub}}$), and interactive 2D borehole log.
- [ ] **Module P2 — Parameter Tools:** IS 2131:1981 SPT overburden/dilatancy corrections and IS 2720 (Part 13) OLS Direct Shear fitting *(In Progress)*.
- [ ] **Module P3 — Bearing Capacity:** IS 6403:1981 general/local shear analysis with full factor breakdowns.
- [ ] **Module P4 — Stress Increase:** Boussinesq (superposition) vs. 2:1 stress distribution comparison.
- [ ] **Module P5 — Settlement Analysis:** Schmertmann et al. (1978) granular settlement and 1D clay consolidation ($\le 0.5\text{ m}$ sublayers).

## Project Structure
```text
├── index.html             # Application shell, navigation, and CDN setup
└── js/
    ├── state.js           # Centralized reactive pub/sub store (window.GeotechState)
    ├── moduleP1_logic.js  # Pure SI validation & derived parameter engine (P1)
    ├── moduleP1_ui.js     # Interactive P1 tables & Plotly borehole visualization
    ├── moduleP2_logic.js  # Pure IS 2131 SPT & OLS Direct Shear math engine (P2)
    └── moduleP2_ui.js     # Interactive P2 workspace & Plotly charts