/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P4 Pure Calculation Engine: window.ModuleP4StressLogic
 * ==============================================================================
 * Vertical Stress Increase Beneath Rectangular Shallow Foundations:
 *   1. Boussinesq Centre by 4-Quadrant Superposition (Newmark, 1935)
 *   2. Boussinesq Corner of Full B × L Loaded Rectangle (Boussinesq, 1885; Newmark, 1935)
 *   3. 2:1 Approximate Stress Dispersion Method (Bowles, 1996; Das & Sobhan, 2018)
 *
 * Standards & References:
 *   - Boussinesq, J. (1885), "Application des potentiels à l'étude de l'équilibre
 *     et du mouvement des solides élastiques", Gauthier-Villars, Paris.
 *   - Newmark, N. M. (1935), "Simplified Computation of Vertical Pressures in
 *     Elastic Foundations", University of Illinois Engineering Experiment Station,
 *     Circular No. 24.
 *   - IS 8009 (Part 1):1976 — Code of Practice for Calculation of Settlements of
 *     Foundations (Shallow Foundations Subjected to Symmetrical Static Vertical Loads).
 *   - Bowles, J. E. (1996), "Foundation Analysis and Design", 5th Ed., McGraw-Hill.
 *   - Das, B. M. & Sobhan, K. (2018), "Principles of Geotechnical Engineering", 9th Ed.
 *
 * Strict SI Units: Dimensions/Depths (m), Net Contact Pressure q0 (kPa),
 * Vertical Stress Increase Δσ_z (kPa), Dimensionless Influence Factors (-).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", zero DOM or ES module dependencies).
 */

(function initModuleP4StressLogic(global) {
  "use strict";

  // Geometric tolerance (m) for surface / footing-base contact limit (z' -> 0+)
  var DEPTH_TOL_M = 1e-6;

  // Standard tabular depth increments below footing base z' (m)
  // Source: IS 8009 (Part 1):1976 / Bowles (1996) stress bulb tabulation practice
  var STANDARD_TABLE_DEPTHS_M = Object.freeze([
    0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0
  ]);

  // Default sample rectangular footing inputs in strict SI units (m, kPa)
  var DEFAULT_INPUT = Object.freeze({
    B_m: 2.0,
    L_m: 3.0,
    Df_m: 1.5,
    q0_kPa: 100.0,
    maxDepthBelowBase_m: 10.0,
    queryDepthBelowBase_m: 2.0
  });

  function isFiniteNumber(val) {
    return typeof val === "number" && Number.isFinite(val);
  }

  function clamp(val, minVal, maxVal) {
    if (val < minVal) return minVal;
    if (val > maxVal) return maxVal;
    return val;
  }

  /**
   * Computes the exact Newmark (1935) / Boussinesq (1885) vertical stress
   * influence factor I_corner beneath the corner of a uniformly loaded
   * rectangular area of dimensions B_rect × L_rect at depth z' below the base,
   * where m = B_rect / z' and n = L_rect / z'.
   *
   * Governing Equation (Newmark, 1935, Circular No. 24; Das & Sobhan, 2018):
   *   I_corner(m, n) = (1 / (4π)) × [
   *     ((2·m·n·√(m²+n²+1)) / (m²+n²+1 + m²·n²)) · ((m²+n²+2) / (m²+n²+1))
   *     + atan2(2·m·n·√(m²+n²+1), m²+n²+1 − m²·n²)
   *   ]
   *
   * Note: Using Math.atan2(y, x) automatically returns angles in (0, π) when
   * (m² + n² + 1 − m²·n²) < 0, eliminating the π branch-cut discontinuity in
   * standard Math.atan() formulations (Bowles, 1996, Section 5-4).
   *
   * @param {number} m Dimensionless ratio B_rect / z' (-).
   * @param {number} n Dimensionless ratio L_rect / z' (-).
   * @returns {number} Dimensionless corner influence factor I_corner in [0, 0.25].
   */
  function boussinesqCornerInfluence(m, n) {
    if (m === Infinity && n === Infinity) {
      return 0.25;
    }
    if (!isFiniteNumber(m) || !isFiniteNumber(n) || m <= 0.0 || n <= 0.0) {
      return 0.0;
    }

    var m2 = m * m;
    var n2 = n * n;
    var r2 = m2 + n2 + 1.0;
    var m2n2 = m2 * n2;
    var sqrtR = Math.sqrt(r2);
    var numer = 2.0 * m * n * sqrtR;

    var term1 = (numer / (r2 + m2n2)) * ((r2 + 1.0) / r2);
    var denom = r2 - m2n2;
    var term2 = Math.atan2(numer, denom);

    var iCorner = (1.0 / (4.0 * Math.PI)) * (term1 + term2);
    return clamp(iCorner, 0.0, 0.25);
  }

  /**
   * Evaluates Boussinesq Corner, Boussinesq Centre (via 4-quadrant superposition),
   * and 2:1 Dispersion stress increases at a single depth z' >= 0 below the footing base.
   */
  function evaluateAtDepth(zPrime, B, L, Df, q0) {
    var zBgl = Df + zPrime;
    var B_half = B / 2.0;
    var L_half = L / 2.0;

    // -------------------------------------------------------------------------
    // 1. Boussinesq Corner of Full B × L Loaded Rectangle
    // Source: Boussinesq (1885); Newmark (1935); IS 8009 (Part 1):1976
    // -------------------------------------------------------------------------
    var m_c, n_c, I_corner;
    if (zPrime <= DEPTH_TOL_M) {
      m_c = Infinity;
      n_c = Infinity;
      I_corner = 0.25;
    } else {
      m_c = B / zPrime;
      n_c = L / zPrime;
      I_corner = boussinesqCornerInfluence(m_c, n_c);
    }
    var deltaSigma_corner = q0 * I_corner;

    // -------------------------------------------------------------------------
    // 2. Boussinesq Centre by 4-Quadrant Superposition
    // Source: Principle of Linear Elastic Superposition (Newmark, 1935; Bowles, 1996)
    // Dividing the B × L footing into 4 identical (B/2) × (L/2) quadrants meeting
    // at a shared corner directly above the footing centre:
    //   I_centre = 4 × I_corner(m_q, n_q),   Δσ_z,centre = 4 × q0 × I_corner(m_q, n_q)
    // -------------------------------------------------------------------------
    var m_q, n_q, I_quad, I_centre;
    if (zPrime <= DEPTH_TOL_M) {
      m_q = Infinity;
      n_q = Infinity;
      I_quad = 0.25;
      I_centre = 1.0;
    } else {
      m_q = B_half / zPrime;
      n_q = L_half / zPrime;
      I_quad = boussinesqCornerInfluence(m_q, n_q);
      I_centre = clamp(4.0 * I_quad, 0.0, 1.0);
    }
    var deltaSigma_centre = q0 * I_centre;

    // -------------------------------------------------------------------------
    // 3. 2:1 Approximate Stress Dispersion Method
    // Source: Bowles (1996), Section 5-3; Das & Sobhan (2018), Chapter 10
    // Spreads total net load Q = q0·B·L over (B + z') × (L + z') at depth z':
    //   I_2to1 = (B × L) / ((B + z') × (L + z')),   Δσ_z,2:1 = q0 × I_2to1
    // -------------------------------------------------------------------------
    var I_2to1 = (B * L) / ((B + zPrime) * (L + zPrime));
    var deltaSigma_2to1 = q0 * I_2to1;

    // Comparative ratios for engineering interpretation
    var centreToCornerRatio = I_corner > 1e-9 ? I_centre / I_corner : null;
    var diff2to1Pct =
      deltaSigma_centre > 1e-9
        ? ((deltaSigma_2to1 - deltaSigma_centre) / deltaSigma_centre) * 100.0
        : 0.0;

    return {
      z_prime: zPrime,
      z_bgl: zBgl,
      B_half: B_half,
      L_half: L_half,
      m_c: m_c,
      n_c: n_c,
      I_corner: I_corner,
      deltaSigma_corner: deltaSigma_corner,
      m_q: m_q,
      n_q: n_q,
      I_quad: I_quad,
      I_centre: I_centre,
      deltaSigma_centre: deltaSigma_centre,
      I_2to1: I_2to1,
      deltaSigma_2to1: deltaSigma_2to1,
      centreToCornerRatio: centreToCornerRatio,
      diff2to1Pct: diff2to1Pct
    };
  }

  /**
   * Formats dimensionless ratios m and n cleanly for audit trail strings
   * (renders ∞ at the footing contact plane z' = 0 m).
   */
  function fmtRatio(val) {
    if (val === Infinity) {
      return "∞";
    }
    return isFiniteNumber(val) ? val.toFixed(3) : "—";
  }

  /**
   * Validates inputs and computes vertical stress increase Δσ_z (kPa) across
   * depth using Boussinesq Centre (4-quadrant superposition), Boussinesq Corner,
   * and 2:1 Dispersion methods without mutating the caller's input object.
   *
   * @param {Object} input { B_m, L_m, Df_m, q0_kPa, maxDepthBelowBase_m, queryDepthBelowBase_m }
   * @returns {{ errors: Array<string>, query: Object|null, profile: Array<Object>, tableRows: Array<Object>, steps: Array<string> }}
   */
  function computeStressIncrease(input) {
    var errors = [];

    if (!input || typeof input !== "object") {
      return {
        errors: ["Vertical stress input object is missing or invalid."],
        query: null,
        profile: [],
        tableRows: [],
        steps: []
      };
    }

    var B = input.B_m;
    var L = input.L_m;
    var Df = input.Df_m;
    var q0 = input.q0_kPa;
    var zMax = input.maxDepthBelowBase_m;
    var zQuery = input.queryDepthBelowBase_m;

    // -------------------------------------------------------------------------
    // Strict SI Input Validation
    // -------------------------------------------------------------------------
    if (!isFiniteNumber(B) || !(B > 0)) {
      errors.push("Footing width B_m must be a finite number > 0 m.");
    }
    if (!isFiniteNumber(L) || !(L > 0)) {
      errors.push("Footing length L_m must be a finite number > 0 m.");
    }
    if (!isFiniteNumber(Df) || Df < 0) {
      errors.push("Embedment depth Df_m must be a finite number ≥ 0 m.");
    }
    if (!isFiniteNumber(q0) || !(q0 > 0)) {
      errors.push("Net contact pressure q0_kPa must be a finite number > 0 kPa.");
    }
    if (!isFiniteNumber(zMax) || !(zMax > 0)) {
      errors.push("Maximum plot depth below base maxDepthBelowBase_m must be a finite number > 0 m.");
    }
    if (!isFiniteNumber(zQuery) || zQuery < 0) {
      errors.push("Inspection depth below base queryDepthBelowBase_m must be a finite number ≥ 0 m.");
    } else if (isFiniteNumber(zMax) && zMax > 0 && zQuery > zMax + DEPTH_TOL_M) {
      errors.push(
        "Inspection depth below base z' (" +
          zQuery.toFixed(2) +
          " m) cannot exceed plot depth z_max (" +
          zMax.toFixed(2) +
          " m)."
      );
    }

    if (errors.length > 0) {
      return {
        errors: errors,
        query: null,
        profile: [],
        tableRows: [],
        steps: []
      };
    }

    // Exact evaluation at inspection depth z' = queryDepthBelowBase_m
    var query = evaluateAtDepth(zQuery, B, L, Df, q0);

    // -------------------------------------------------------------------------
    // 31-Point Smooth Profile [0, zMax] with Exact Query Depth Inserted Sorted
    // -------------------------------------------------------------------------
    var profileDepths = [];
    var nProfile = 31;
    var hasQueryDepth = false;

    for (var i = 0; i < nProfile; i++) {
      var frac = i / (nProfile - 1);
      var zp = frac * zMax;
      if (Math.abs(zp - zQuery) <= DEPTH_TOL_M) {
        zp = zQuery;
        hasQueryDepth = true;
      }
      profileDepths.push(zp);
    }

    if (!hasQueryDepth) {
      profileDepths.push(zQuery);
      profileDepths.sort(function (a, b) {
        return a - b;
      });
    }

    var profile = profileDepths.map(function (zp) {
      return evaluateAtDepth(zp, B, L, Df, q0);
    });

    // -------------------------------------------------------------------------
    // Clean Depth-by-Depth Comparison Table Rows Clamped to maxDepthBelowBase_m
    // (Always includes exact inspection depth zQuery in sorted order)
    // -------------------------------------------------------------------------
    var tableDepths = [];
    var tableHasQuery = false;

    for (var j = 0; j < STANDARD_TABLE_DEPTHS_M.length; j++) {
      var stdZ = STANDARD_TABLE_DEPTHS_M[j];
      if (stdZ <= zMax + DEPTH_TOL_M) {
        if (Math.abs(stdZ - zQuery) <= DEPTH_TOL_M) {
          tableHasQuery = true;
        }
        tableDepths.push(stdZ);
      }
    }
    if (
      tableDepths.length === 0 ||
      Math.abs(tableDepths[tableDepths.length - 1] - zMax) > DEPTH_TOL_M
    ) {
      if (Math.abs(zMax - zQuery) <= DEPTH_TOL_M) {
        tableHasQuery = true;
      }
      tableDepths.push(zMax);
    }
    if (!tableHasQuery) {
      tableDepths.push(zQuery);
      tableDepths.sort(function (a, b) {
        return a - b;
      });
    }

    var tableRows = tableDepths.map(function (zp) {
      var row = evaluateAtDepth(zp, B, L, Df, q0);
      row.isQueryDepth = Math.abs(zp - zQuery) <= DEPTH_TOL_M;
      return row;
    });

    // -------------------------------------------------------------------------
    // 5 Numbered Engineering Audit Trail Strings at Inspection Depth z'
    // -------------------------------------------------------------------------
    var diffSign = query.diff2to1Pct >= 0 ? "+" : "";
    var ratioText =
      query.centreToCornerRatio !== null ? query.centreToCornerRatio.toFixed(2) + "×" : "—";

    var steps = [
      "1. Footing & Inspection Datum (SI Units): Loaded rectangle B = " +
        B.toFixed(2) +
        " m × L = " +
        L.toFixed(2) +
        " m (A = " +
        (B * L).toFixed(2) +
        " m²) at embedment D_f = " +
        Df.toFixed(2) +
        " m under net contact pressure q_0 = " +
        q0.toFixed(2) +
        " kPa. Inspection depth z' = " +
        zQuery.toFixed(2) +
        " m below base → z = D_f + z' = " +
        query.z_bgl.toFixed(2) +
        " m bgl.",

      "2. 4-Quadrant Superposition Sub-Rectangle (Newmark, 1935): Partition B × L into 4 identical quadrants of size (B/2) × (L/2) = " +
        query.B_half.toFixed(2) +
        " m × " +
        query.L_half.toFixed(2) +
        " m sharing a corner at the footing centre → m_q = (B/2)/z' = " +
        fmtRatio(query.m_q) +
        ", n_q = (L/2)/z' = " +
        fmtRatio(query.n_q) +
        " → single-quadrant I_quad = I_corner(m_q, n_q) = " +
        query.I_quad.toFixed(4) +
        ".",

      "3. Boussinesq Centre by Superposition (Boussinesq, 1885; IS 8009 Part 1:1976): I_centre = 4 × I_quad = 4 × " +
        query.I_quad.toFixed(4) +
        " = " +
        query.I_centre.toFixed(4) +
        " → Δσ_z,centre = 4 × q_0 × I_corner(m_q, n_q) = 4 × " +
        q0.toFixed(2) +
        " × " +
        query.I_quad.toFixed(4) +
        " = " +
        query.deltaSigma_centre.toFixed(2) +
        " kPa.",

      "4. Boussinesq Corner of Full B × L Rectangle (Newmark, 1935): m_c = B/z' = " +
        fmtRatio(query.m_c) +
        ", n_c = L/z' = " +
        fmtRatio(query.n_c) +
        " → I_corner = " +
        query.I_corner.toFixed(4) +
        " → Δσ_z,corner = q_0 × I_corner = " +
        q0.toFixed(2) +
        " × " +
        query.I_corner.toFixed(4) +
        " = " +
        query.deltaSigma_corner.toFixed(2) +
        " kPa.",

      "5. 2:1 Dispersion Comparison (Bowles, 1996; Das & Sobhan, 2018): I_2:1 = (B·L) / ((B+z')(L+z')) = " +
        (B * L).toFixed(2) +
        " / ((" +
        (B + zQuery).toFixed(2) +
        ")(" +
        (L + zQuery).toFixed(2) +
        ")) = " +
        query.I_2to1.toFixed(4) +
        " → Δσ_z,2:1 = " +
        query.deltaSigma_2to1.toFixed(2) +
        " kPa (" +
        diffSign +
        query.diff2to1Pct.toFixed(1) +
        "% vs. Boussinesq Centre; Centre/Corner ratio = " +
        ratioText +
        ")."
    ];

    return {
      errors: [],
      query: query,
      profile: profile,
      tableRows: tableRows,
      steps: steps
    };
  }

  // Expose frozen pure API on window.ModuleP4StressLogic
  global.ModuleP4StressLogic = Object.freeze({
    DEFAULT_INPUT: DEFAULT_INPUT,
    STANDARD_TABLE_DEPTHS_M: STANDARD_TABLE_DEPTHS_M,
    boussinesqCornerInfluence: boussinesqCornerInfluence,
    computeStressIncrease: computeStressIncrease
  });
})(window);