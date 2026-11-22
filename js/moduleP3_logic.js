/**
- ==============================================================================
- CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
- Module P3 Pure Calculation & Validation Engine: window.ModuleP3Logic
- ==============================================================================
- Shallow Foundation Bearing Capacity strictly following IS 6403:1981
- (Code of Practice for Determination of Bearing Capacity of Shallow Foundations)
- and Meyerhof (1953) effective area concept for eccentric loading.
 *
- Strict SI Units: Dimensions/Depths (m), Stress/Capacity (kPa),
- Unit Weight (kN/m³), Load Capacity (kN or kN/m), Angles (deg).
 *
- Compatible with local file:// execution and GitHub Pages (classic IIFE,
- "use strict", zero DOM or ES module dependencies).
 */

(function initModuleP3Logic(global) {
  "use strict";

  // Source: Terzaghi, Peck, & Mesri (1996) — Standard unit weight of water (kN/m³)
  var DEFAULT_GAMMA_W = 9.81;

  // Geometric tolerance (m) for depth boundary and equality comparisons
  var DEPTH_TOL_M = 1e-6;

  // Source: IS 6403:1981 Table 2 (Shape Factors)
  var FOOTING_SHAPES = Object.freeze([
    "Strip",
    "Square",
    "Rectangular",
    "Circular"
  ]);

  // Source: IS 6403:1981 Clause 5.1.2 (General vs. Local Shear Failure & Transition)
  var SHEAR_MODES = Object.freeze([
    "Auto (IS 6403)",
    "General Shear",
    "Local Shear"
  ]);

  // Source: IS 6403:1981 Clauses 5.1.2 (Drained c'-phi') & 5.1.3 (Undrained phi=0)
  var ANALYSIS_TYPES = Object.freeze([
    "Drained",
    "Undrained"
  ]);

  // Source: EN 1997-1 Clause 2.4.5.1 (Design vs. Measured groundwater elevation)
  var WATER_TABLE_MODES = Object.freeze([
    "Design",
    "Measured"
  ]);

  /**
- Resolves unit weight of water gamma_w (kN/m³) from argument, falling back
- to window.GeotechState.gamma_w and finally 9.81 kN/m³.
   */
  function resolveGammaW(gammaW) {
    if (typeof gammaW === "number" && Number.isFinite(gammaW) && gammaW > 0) {
      return gammaW;
    }
    if (
      global.GeotechState &&
      typeof global.GeotechState.gamma_w === "number" &&
      Number.isFinite(global.GeotechState.gamma_w) &&
      global.GeotechState.gamma_w > 0
    ) {
      return global.GeotechState.gamma_w;
    }
    return DEFAULT_GAMMA_W;
  }

  /**
- Checks whether a value is a finite JavaScript number.
   */
  function isFiniteNumber(val) {
    return typeof val === "number" && Number.isFinite(val);
  }

  /**
- Computes IS 6403:1981 Table 1 / Vesic bearing capacity factors (Nc, Nq, Ngamma)
- for a given friction angle phiDeg (deg).
   *
- Source: IS 6403:1981 Table 1 & Clause 5.1.2 (Prandtl-Reissner Nc/Nq, Vesic Ngamma).
   *
- @param {number} phiDeg - Friction angle in degrees.
- @returns {{ Nc: number, Nq: number, Ngamma: number }}
   */
  function computeFactors(phiDeg) {
    if (!isFiniteNumber(phiDeg) || phiDeg <= 1e-9) {
      return { Nc: 5.14, Nq: 1.0, Ngamma: 0.0 };
    }

    var rad = (phiDeg * Math.PI) / 180.0;
    var tanPhi = Math.tan(rad);
    var tanTerm = Math.tan(((45.0 + phiDeg / 2.0) * Math.PI) / 180.0);

    var nq = Math.exp(Math.PI * tanPhi) * tanTerm * tanTerm;
    var nc = (nq - 1.0) / tanPhi;
    var ngamma = 2.0 * (nq + 1.0) * tanPhi;

    return { Nc: nc, Nq: nq, Ngamma: ngamma };
  }

  /**
- Computes effective footing dimensions and Meyerhof effective bearing area A'
- without mutating input values.
   *
- Source: IS 6403:1981 Clause 5.1.1 & Meyerhof (1953), "The Bearing Capacity of
- Foundations Under Eccentric and Inclined Loads".
   */
  function computeEffectiveGeometry(shape, B_m, L_m, eB_m, eL_m) {
    var B_prime = 0.0;
    var L_prime = 0.0;
    var B_eff = 0.0;
    var L_eff = 0.0;
    var ratio_B_L = 0.0;
    var A_prime = 0.0;
    var isPerMeterRun = false;
    var effectiveShape = shape;
    var nominalL = L_m;
    var e_total = Math.hypot(eB_m, eL_m);

    if (shape === "Strip") {
      nominalL = Infinity;
      B_prime = B_m - 2.0 * eB_m;
      L_prime = Infinity;
      B_eff = B_prime;
      L_eff = Infinity;
      ratio_B_L = 0.0;
      A_prime = B_prime; // m² per m run
      isPerMeterRun = true;
      effectiveShape = "Strip";
      e_total = eB_m;
    } else if (shape === "Square") {
      nominalL = B_m;
      B_prime = B_m - 2.0 * eB_m;
      L_prime = B_m - 2.0 * eL_m;
      B_eff = Math.min(B_prime, L_prime);
      L_eff = Math.max(B_prime, L_prime);
      ratio_B_L = B_eff / L_eff;
      A_prime = B_prime * L_prime;
      isPerMeterRun = false;
      effectiveShape =
        Math.abs(eB_m - eL_m) > 1e-9 ? "Rectangular (Eccentric Square)" : "Square";
    } else if (shape === "Rectangular") {
      nominalL = L_m;
      B_prime = B_m - 2.0 * eB_m;
      L_prime = L_m - 2.0 * eL_m;
      B_eff = Math.min(B_prime, L_prime);
      L_eff = Math.max(B_prime, L_prime);
      ratio_B_L = B_eff / L_eff;
      A_prime = B_prime * L_prime;
      isPerMeterRun = false;
      effectiveShape = "Rectangular";
    } else if (shape === "Circular") {
      nominalL = B_m;
      var R = B_m / 2.0;
      isPerMeterRun = false;

      if (e_total <= 1e-9) {
        B_prime = B_m;
        L_prime = B_m;
        B_eff = B_m;
        L_eff = B_m;
        ratio_B_L = 1.0;
        A_prime = Math.PI * R * R;
        effectiveShape = "Circular";
      } else {
        // Exact Meyerhof (1953) doubly-symmetric lens effective area for eccentric circle
        var ratioER = Math.min(1.0, Math.max(-1.0, e_total / R));
        var radical = Math.sqrt(Math.max(0.0, R * R - e_total * e_total));
        A_prime = 2.0 * (R * R * Math.acos(ratioER) - e_total * radical);
        var aspect = Math.sqrt((R + e_total) / (R - e_total));
        B_prime = Math.sqrt(A_prime / aspect);
        L_prime = A_prime / B_prime;
        B_eff = B_prime;
        L_eff = L_prime;
        ratio_B_L = B_eff / L_eff;
        effectiveShape = "Rectangular (Equivalent)";
      }
    }

    return {
      shape: shape,
      effectiveShape: effectiveShape,
      B_m: B_m,
      L_m: nominalL,
      eB_m: eB_m,
      eL_m: eL_m,
      e_total: e_total,
      B_prime: B_prime,
      L_prime: L_prime,
      B_eff: B_eff,
      L_eff: L_eff,
      ratio_B_L: ratio_B_L,
      A_prime: A_prime,
      isPerMeterRun: isPerMeterRun
    };
  }

  /**
- Computes exact piecewise effective overburden pressure q = sigma_v0'(Df_m)
- from z = 0 to z = Df_m across sorted Module P1 layers split at water table zw.
   *
- Source: Terzaghi's Principle of Effective Stress (sigma' = sigma - u).
   */
  function computeOverburdenFromP1(Df_m, sortedLayers, zw, gw) {
    if (Df_m <= DEPTH_TOL_M) {
      return 0.0;
    }

    var sigmaV0 = 0.0;

    for (var i = 0; i < sortedLayers.length; i++) {
      var lyr = sortedLayers[i];
      var zTop = lyr.z_top;
      var zBot = lyr.z_bot;

      if (!isFiniteNumber(zTop) || !isFiniteNumber(zBot) || zBot <= zTop) {
        continue;
      }
      if (zTop >= Df_m - DEPTH_TOL_M) {
        break;
      }

      var segTop = zTop;
      var segBot = Math.min(zBot, Df_m);
      if (segBot <= segTop + DEPTH_TOL_M) {
        continue;
      }

      var gMoist = lyr.gamma_moist;
      var gSub = isFiniteNumber(lyr.gamma_sub) ? lyr.gamma_sub : lyr.gamma_sat - gw;

      var dzMoist = 0.0;
      var dzSub = 0.0;

      if (segBot <= zw) {
        dzMoist = segBot - segTop;
      } else if (segTop >= zw) {
        dzSub = segBot - segTop;
      } else {
        dzMoist = Math.max(0.0, zw - segTop);
        dzSub = Math.max(0.0, segBot - zw);
      }

      sigmaV0 += dzMoist * gMoist + dzSub * gSub;
    }

    return sigmaV0;
  }

  /**
- Extracts thickness-weighted failure-zone soil parameters across
- [Df_m, min(maxProfileDepth, Df_m + B_eff)] from sorted Module P1 layers.
   *
- Source: IS 6403:1981 Clause 5.1.2 (Significant depth of shear failure zone ~ B' below Df).
   */
  function extractFailureZoneFromP1(Df_m, B_eff, sortedLayers, analysisType) {
    var maxProfileDepth = sortedLayers[sortedLayers.length - 1].z_bot;
    var zoneTop = Df_m;
    var zoneTargetBot = Df_m + B_eff;
    var zoneBot = Math.min(maxProfileDepth, zoneTargetBot);
    var failureZoneTruncated = zoneTargetBot > maxProfileDepth + DEPTH_TOL_M;

    var totalThickness = 0.0;
    var sumGammaMoist = 0.0;
    var sumGammaSat = 0.0;
    var sumC = 0.0;
    var sumPhi = 0.0;
    var zoneLayers = [];

    for (var i = 0; i < sortedLayers.length; i++) {
      var lyr = sortedLayers[i];
      var ovTop = Math.max(lyr.z_top, zoneTop);
      var ovBot = Math.min(lyr.z_bot, zoneBot);
      var thick = ovBot - ovTop;

      if (thick > DEPTH_TOL_M) {
        var cVal = analysisType === "Undrained" ? lyr.su : lyr.c_prime;
        var phiVal = analysisType === "Undrained" ? 0.0 : lyr.phi_prime;

        totalThickness += thick;
        sumGammaMoist += thick * lyr.gamma_moist;
        sumGammaSat += thick * lyr.gamma_sat;
        sumC += thick * cVal;
        sumPhi += thick * phiVal;

        zoneLayers.push({
          layerIndex: i + 1,
          soilType: lyr.soilType || "Layer " + (i + 1),
          z_top: ovTop,
          z_bot: ovBot,
          thickness_m: thick,
          weightFraction: 0.0, // populated after totalThickness is finalized
          gamma_moist: lyr.gamma_moist,
          gamma_sat: lyr.gamma_sat,
          c_val: cVal,
          phi_val: phiVal
        });
      }
    }

    if (totalThickness <= DEPTH_TOL_M) {
      return null;
    }

    for (var j = 0; j < zoneLayers.length; j++) {
      zoneLayers[j].weightFraction = zoneLayers[j].thickness_m / totalThickness;
    }

    return {
      gamma_below: sumGammaMoist / totalThickness,
      gamma_sat_below: sumGammaSat / totalThickness,
      c_base: sumC / totalThickness,
      phi_base: analysisType === "Undrained" ? 0.0 : sumPhi / totalThickness,
      failureZoneTop_m: zoneTop,
      failureZoneBot_m: zoneBot,
      failureZoneThickness_m: totalThickness,
      failureZoneTruncated: failureZoneTruncated,
      zoneLayers: zoneLayers
    };
  }

  /**
- Core IS 6403:1981 evaluator for a single validated footing geometry & soil state.
- Reused both for the primary design calculation and the 9-point width sensitivity sweep.
   */
  function evaluateIS6403Case(params, sortedLayers, zw, gw, includeSteps) {
    var geom = computeEffectiveGeometry(
      params.shape,
      params.B_m,
      params.L_m,
      params.eB_m,
      params.eL_m
    );

    var Df_m = params.Df_m;
    var alpha_deg = params.alpha_deg;
    var FS = params.FS;
    var analysisType = params.analysisType;
    var shearMode = params.shearMode;

    // -------------------------------------------------------------------------
    // C. Soil Parameter & Overburden Extraction
    // -------------------------------------------------------------------------
    var q = 0.0;
    var c_base = 0.0;
    var phi_base = 0.0;
    var gamma_below = 0.0;
    var gamma_sat_below = 0.0;
    var failureZoneTop_m = Df_m;
    var failureZoneBot_m = Df_m + geom.B_eff;
    var failureZoneTruncated = false;
    var zoneLayers = [];
    var soilSourceLabel = "";

    if (params.useManualSoil) {
      // Piecewise overburden from 0 to Df_m split at zw using manual unit weights
      var dzAbove = Math.min(Df_m, zw);
      var dzBelow = Math.max(0.0, Df_m - zw);
      var gammaSubManual = Math.max(1.0, params.manual_gamma_sat_below - gw);
      q = dzAbove * params.manual_gamma_above + dzBelow * gammaSubManual;

      c_base = params.manual_c;
      phi_base = analysisType === "Undrained" ? 0.0 : params.manual_phi;
      gamma_below = params.manual_gamma_below;
      gamma_sat_below = params.manual_gamma_sat_below;
      soilSourceLabel = "Manual Override";
    } else {
      q = computeOverburdenFromP1(Df_m, sortedLayers, zw, gw);
      var zoneData = extractFailureZoneFromP1(Df_m, geom.B_eff, sortedLayers, analysisType);
      if (!zoneData) {
        return null;
      }
      gamma_below = zoneData.gamma_below;
      gamma_sat_below = zoneData.gamma_sat_below;
      c_base = zoneData.c_base;
      phi_base = zoneData.phi_base;
      failureZoneTop_m = zoneData.failureZoneTop_m;
      failureZoneBot_m = zoneData.failureZoneBot_m;
      failureZoneTruncated = zoneData.failureZoneTruncated;
      zoneLayers = zoneData.zoneLayers;
      soilSourceLabel = "Auto (P1 Stratigraphy)";
    }

    // -------------------------------------------------------------------------
    // D. Shear Mode & IS 6403:1981 Bearing Capacity Factors (Table 1 & Cl. 5.1.2)
    // -------------------------------------------------------------------------
    var resolvedShearMode = "";
    var c_m = c_base;
    var phi_m = phi_base;
    var Nc = 5.14;
    var Nq = 1.0;
    var Ngamma = 0.0;
    var interpolationWeight = 1.0;

    if (analysisType === "Undrained") {
      // Source: IS 6403:1981 Clause 5.1.3 (Cohesive soils, phi = 0)
      resolvedShearMode = "General Shear (Undrained φ = 0)";
      c_m = c_base;
      phi_m = 0.0;
      Nc = 5.14;
      Nq = 1.0;
      Ngamma = 0.0;
      interpolationWeight = 1.0;
    } else if (
      shearMode === "General Shear" ||
      (shearMode === "Auto (IS 6403)" && phi_base >= 36.0)
    ) {
      // Source: IS 6403:1981 Clause 5.1.2 (General Shear Failure, phi' >= 36 deg)
      resolvedShearMode = "General Shear";
      c_m = c_base;
      phi_m = phi_base;
      var genF = computeFactors(phi_base);
      Nc = genF.Nc;
      Nq = genF.Nq;
      Ngamma = genF.Ngamma;
      interpolationWeight = 1.0;
    } else if (
      shearMode === "Local Shear" ||
      (shearMode === "Auto (IS 6403)" && phi_base <= 29.0)
    ) {
      // Source: IS 6403:1981 Clause 5.1.2 (Local Shear Failure, phi' <= 29 deg;
      // reduced parameters c_m = (2/3)c and tan(phi_m) = (2/3)tan(phi))
      resolvedShearMode = "Local Shear";
      c_m = (2.0 / 3.0) * c_base;
      phi_m = (Math.atan((2.0 / 3.0) * Math.tan((phi_base * Math.PI) / 180.0)) * 180.0) / Math.PI;
      var locF = computeFactors(phi_m);
      Nc = locF.Nc;
      Nq = locF.Nq;
      Ngamma = locF.Ngamma;
      interpolationWeight = 0.0;
    } else {
      // Source: IS 6403:1981 Clause 5.1.2 (Linear interpolation across 29 deg < phi' < 36 deg)
      var w = (phi_base - 29.0) / (36.0 - 29.0);
      var phiLocal =
        (Math.atan((2.0 / 3.0) * Math.tan((phi_base * Math.PI) / 180.0)) * 180.0) / Math.PI;
      var genFactors = computeFactors(phi_base);
      var locFactors = computeFactors(phiLocal);

      c_m = (2.0 / 3.0) * c_base + w * (1.0 / 3.0) * c_base;
      phi_m = phiLocal + w * (phi_base - phiLocal);
      Nc = locFactors.Nc + w * (genFactors.Nc - locFactors.Nc);
      Nq = locFactors.Nq + w * (genFactors.Nq - locFactors.Nq);
      Ngamma = locFactors.Ngamma + w * (genFactors.Ngamma - locFactors.Ngamma);
      interpolationWeight = w;
      resolvedShearMode = "Interpolated Transition (29° < φ' < 36°)";
    }

    // -------------------------------------------------------------------------
    // E. Shape Factors (IS 6403:1981 Table 2)
    // -------------------------------------------------------------------------
    var sc = 1.0;
    var sq = 1.0;
    var sgamma = 1.0;

    if (geom.effectiveShape === "Strip") {
      sc = 1.0;
      sq = 1.0;
      sgamma = 1.0;
    } else if (geom.effectiveShape === "Square") {
      sc = 1.3;
      sq = 1.2;
      sgamma = 0.8;
    } else if (geom.effectiveShape === "Circular") {
      sc = 1.3;
      sq = 1.2;
      sgamma = 0.6;
    } else {
      // Rectangular, Eccentric Square, or Equivalent Rectangular (Eccentric Circular)
      sc = 1.0 + 0.2 * geom.ratio_B_L;
      sq = 1.0 + 0.2 * geom.ratio_B_L;
      sgamma = 1.0 - 0.4 * geom.ratio_B_L;
    }

    // -------------------------------------------------------------------------
    // F. Depth Factors (IS 6403:1981 Clause 5.1.2.1)
    // -------------------------------------------------------------------------
    var sqrtNphi = Math.tan(((45.0 + phi_m / 2.0) * Math.PI) / 180.0);
    var N_phi = sqrtNphi * sqrtNphi;
    var dc = 1.0 + 0.2 * (Df_m / geom.B_eff) * sqrtNphi;
    var dq = phi_m < 10.0 ? 1.0 : 1.0 + 0.1 * (Df_m / geom.B_eff) * sqrtNphi;
    var dgamma = dq;

    // -------------------------------------------------------------------------
    // G. Inclination Factors (IS 6403:1981 Clause 5.1.2.1)
    // -------------------------------------------------------------------------
    var ic = Math.pow(1.0 - alpha_deg / 90.0, 2);
    var iq = ic;
    var igamma = 1.0;
    var slidingWarning = false;

    if (phi_m > 1e-9) {
      if (alpha_deg >= phi_m) {
        igamma = 0.0;
        slidingWarning = true;
      } else {
        igamma = Math.pow(1.0 - alpha_deg / phi_m, 2);
      }
    } else {
      igamma = 1.0;
    }

    // -------------------------------------------------------------------------
    // H. Water Table Correction Factor W' (IS 6403:1981 Clause 5.1.2.2)
    // -------------------------------------------------------------------------
    var W_prime = 1.0;
    var wtCase = "";

    if (zw <= Df_m) {
      W_prime = 0.5;
      wtCase = "WT at or above footing base (z_w ≤ D_f)";
    } else if (zw >= Df_m + geom.B_eff) {
      W_prime = 1.0;
      wtCase = "WT below failure zone (z_w ≥ D_f + B')";
    } else {
      W_prime = 0.5 + 0.5 * ((zw - Df_m) / geom.B_eff);
      wtCase = "WT within failure zone (D_f < z_w < D_f + B')";
    }

    // -------------------------------------------------------------------------
    // I. Bearing Capacity Terms & Final Capacities (IS 6403 Cl. 5.1.2 & 5.1.3)
    // -------------------------------------------------------------------------
    var term_c = c_m * Nc * sc * dc * ic;
    var term_q = q * (Nq - 1.0) * sq * dq * iq;
    // W_prime applied to moist unit weight gamma_below to prevent double-counting buoyancy
    var term_gamma = 0.5 * gamma_below * geom.B_eff * Ngamma * sgamma * dgamma * igamma * W_prime;

    var q_nu = term_c + term_q + term_gamma; // Net ultimate bearing capacity (kPa)
    var q_u = q_nu + q;                      // Gross ultimate bearing capacity (kPa)
    var q_ns = q_nu / FS;                    // Net safe bearing capacity (kPa)
    var q_s = q_ns + q;                      // Gross safe bearing capacity (kPa)
    var Q_ns = q_ns * geom.A_prime;          // Net safe load capacity (kN or kN/m)
    var Q_s = q_s * geom.A_prime;            // Gross safe load capacity (kN or kN/m)
    var loadUnit = geom.isPerMeterRun ? "kN/m" : "kN";

    var steps = [];
    if (includeSteps) {
      var areaLabel = geom.isPerMeterRun
        ? "A' = " + geom.A_prime.toFixed(3) + " m²/m"
        : "A' = " + geom.A_prime.toFixed(3) + " m²";
      var lEffLabel = Number.isFinite(geom.L_eff) ? geom.L_eff.toFixed(3) + " m" : "∞";

      steps.push(
        "1. Effective Geometry (IS 6403 Cl. 5.1.1 / Meyerhof, 1953): " +
          geom.shape +
          " → " +
          geom.effectiveShape +
          ", B' = " +
          geom.B_eff.toFixed(3) +
          " m, L' = " +
          lEffLabel +
          ", B'/L' = " +
          geom.ratio_B_L.toFixed(3) +
          ", " +
          areaLabel +
          "."
      );

      steps.push(
        "2. Overburden & Failure Zone (" +
          soilSourceLabel +
          ", z_w = " +
          zw.toFixed(2) +
          " m [" +
          params.waterTableMode +
          "]): q = σ'_v0(D_f = " +
          Df_m.toFixed(2) +
          " m) = " +
          q.toFixed(2) +
          " kPa; zone [" +
          failureZoneTop_m.toFixed(2) +
          "–" +
          failureZoneBot_m.toFixed(2) +
          " m]: c = " +
          c_base.toFixed(2) +
          " kPa, φ = " +
          phi_base.toFixed(2) +
          "°, γ_moist = " +
          gamma_below.toFixed(2) +
          " kN/m³."
      );

      steps.push(
        "3. Shear Mode & Bearing Capacity Factors (IS 6403 Table 1 / Cl. 5.1.2): " +
          resolvedShearMode +
          " → c_m = " +
          c_m.toFixed(2) +
          " kPa, φ_m = " +
          phi_m.toFixed(2) +
          "°; N_c = " +
          Nc.toFixed(2) +
          ", N_q = " +
          Nq.toFixed(2) +
          ", N_γ = " +
          Ngamma.toFixed(2) +
          "."
      );

      steps.push(
        "4. Shape Factors (IS 6403 Table 2): s_c = " +
          sc.toFixed(3) +
          ", s_q = " +
          sq.toFixed(3) +
          ", s_γ = " +
          sgamma.toFixed(3) +
          "."
      );

      steps.push(
        "5. Depth Factors (IS 6403 Cl. 5.1.2.1): √N_φ = " +
          sqrtNphi.toFixed(3) +
          ", D_f/B' = " +
          (Df_m / geom.B_eff).toFixed(3) +
          " → d_c = " +
          dc.toFixed(3) +
          ", d_q = " +
          dq.toFixed(3) +
          ", d_γ = " +
          dgamma.toFixed(3) +
          "."
      );

      steps.push(
        "6. Inclination & Water Table Factors (IS 6403 Cl. 5.1.2.1 & 5.1.2.2): α = " +
          alpha_deg.toFixed(1) +
          "° → i_c = " +
          ic.toFixed(3) +
          ", i_q = " +
          iq.toFixed(3) +
          ", i_γ = " +
          igamma.toFixed(3) +
          "; W' = " +
          W_prime.toFixed(3) +
          " (" +
          wtCase +
          ")."
      );

      steps.push(
        "7. Bearing Capacity Components (IS 6403 Cl. 5.1.2): Cohesion term = " +
          term_c.toFixed(2) +
          " kPa, Overburden term = " +
          term_q.toFixed(2) +
          " kPa, Self-weight term = " +
          term_gamma.toFixed(2) +
          " kPa → q_nu = " +
          q_nu.toFixed(2) +
          " kPa, q_u = " +
          q_u.toFixed(2) +
          " kPa."
      );

      steps.push(
        "8. Safe Bearing & Load Capacity (FS = " +
          FS.toFixed(2) +
          "): q_ns = " +
          q_ns.toFixed(2) +
          " kPa, q_s = " +
          q_s.toFixed(2) +
          " kPa; Q_ns = " +
          Q_ns.toFixed(1) +
          " " +
          loadUnit +
          ", Q_s = " +
          Q_s.toFixed(1) +
          " " +
          loadUnit +
          "."
      );
    }

    return {
      geometry: geom,
      soil: {
        soilSourceLabel: soilSourceLabel,
        analysisType: analysisType,
        waterTableMode: params.waterTableMode,
        zw: zw,
        gamma_w: gw,
        q: q,
        c_base: c_base,
        phi_base: phi_base,
        gamma_below: gamma_below,
        gamma_sat_below: gamma_sat_below,
        failureZoneTop_m: failureZoneTop_m,
        failureZoneBot_m: failureZoneBot_m,
        failureZoneTruncated: failureZoneTruncated,
        zoneLayers: zoneLayers
      },
      shear: {
        requestedMode: shearMode,
        resolvedShearMode: resolvedShearMode,
        interpolationWeight: interpolationWeight,
        c_m: c_m,
        phi_m: phi_m
      },
      factors: {
        Nc: Nc,
        Nq: Nq,
        Ngamma: Ngamma,
        sc: sc,
        sq: sq,
        sgamma: sgamma,
        N_phi: N_phi,
        sqrtNphi: sqrtNphi,
        dc: dc,
        dq: dq,
        dgamma: dgamma,
        ic: ic,
        iq: iq,
        igamma: igamma,
        W_prime: W_prime,
        wtCase: wtCase
      },
      terms: {
        term_c: term_c,
        term_q: term_q,
        term_gamma: term_gamma
      },
      capacities: {
        q_nu: q_nu,
        q_u: q_u,
        q_ns: q_ns,
        q_s: q_s,
        Q_ns: Q_ns,
        Q_s: Q_s,
        loadUnit: loadUnit
      },
      slidingWarning: slidingWarning,
      steps: steps
    };
  }

  /**
- Validates inputs and computes shallow foundation bearing capacity per IS 6403:1981
- without mutating any caller objects or arrays.
   *
- @param {Object} p3Input - Footing geometry, loading, and soil configuration from js/state.js.
- @param {Array<Object>} processedLayers - Validated layers from Module P1.
- @param {number} zwMeasured - Measured water table depth (m bgl).
- @param {number} zwDesign - Design water table depth (m bgl).
- @param {number} [gammaW] - Unit weight of water (kN/m³, defaults to 9.81).
- @returns {{ result: Object|null, errors: Array<string> }}
   */
  function computeBearingCapacity(p3Input, processedLayers, zwMeasured, zwDesign, gammaW) {
    var errors = [];
    var gw = resolveGammaW(gammaW);

    if (!p3Input || typeof p3Input !== "object") {
      return {
        result: null,
        errors: ["Module P3 input object is missing or invalid."]
      };
    }

    // Extract inputs without mutating p3Input
    var shape = p3Input.shape;
    var B_m = p3Input.B_m;
    var L_m = p3Input.L_m;
    var Df_m = p3Input.Df_m;
    var eB_m = p3Input.eB_m;
    var eL_m = p3Input.eL_m;
    var alpha_deg = p3Input.alpha_deg;
    var FS = p3Input.FS;
    var shearMode = p3Input.shearMode;
    var analysisType = p3Input.analysisType;
    var waterTableMode = p3Input.waterTableMode;
    var useManualSoil = Boolean(p3Input.useManualSoil);

    // -------------------------------------------------------------------------
    // A. Strict Input Validation
    // -------------------------------------------------------------------------
    if (FOOTING_SHAPES.indexOf(shape) === -1) {
      errors.push("Invalid footing shape '" + String(shape) + "'. Must be one of: " + FOOTING_SHAPES.join(", ") + ".");
    }
    if (SHEAR_MODES.indexOf(shearMode) === -1) {
      errors.push("Invalid shear mode '" + String(shearMode) + "'. Must be one of: " + SHEAR_MODES.join(", ") + ".");
    }
    if (ANALYSIS_TYPES.indexOf(analysisType) === -1) {
      errors.push("Invalid analysis type '" + String(analysisType) + "'. Must be one of: " + ANALYSIS_TYPES.join(", ") + ".");
    }
    if (WATER_TABLE_MODES.indexOf(waterTableMode) === -1) {
      errors.push("Invalid water table mode '" + String(waterTableMode) + "'. Must be one of: " + WATER_TABLE_MODES.join(", ") + ".");
    }

    if (!isFiniteNumber(B_m) || !(B_m > 0)) {
      errors.push("Footing width/diameter B_m must be a finite number > 0 m.");
    }
    if (!isFiniteNumber(Df_m) || Df_m < 0) {
      errors.push("Embedment depth Df_m must be a finite number ≥ 0 m.");
    }
    if (!isFiniteNumber(FS) || FS < 1.0) {
      errors.push("Factor of Safety (FS) must be a finite number ≥ 1.0.");
    }
    if (!isFiniteNumber(eB_m) || eB_m < 0) {
      errors.push("Eccentricity along width eB_m must be a finite number ≥ 0 m.");
    }
    if (!isFiniteNumber(eL_m) || eL_m < 0) {
      errors.push("Eccentricity along length eL_m must be a finite number ≥ 0 m.");
    }
    if (!isFiniteNumber(alpha_deg) || alpha_deg < 0 || alpha_deg >= 90) {
      errors.push("Load inclination angle alpha_deg must be a finite number satisfying 0° ≤ α < 90°.");
    }

    if (shape === "Rectangular") {
      if (!isFiniteNumber(L_m) || !(L_m > 0)) {
        errors.push("Footing length L_m must be a finite number > 0 m for Rectangular footings.");
      } else if (isFiniteNumber(B_m) && L_m < B_m) {
        errors.push(
          "For Rectangular footings, length L_m (" +
            L_m.toFixed(2) +
            " m) must be ≥ width B_m (" +
            B_m.toFixed(2) +
            " m). Swap B and L so B is the shorter side."
        );
      }
    }

    // Eccentricity geometric bounds (IS 6403 Cl. 5.1.1 / Meyerhof)
    if (isFiniteNumber(B_m) && B_m > 0 && isFiniteNumber(eB_m) && isFiniteNumber(eL_m)) {
      if (shape === "Strip") {
        if (!(eB_m < B_m / 2.0)) {
          errors.push(
            "Strip footing eccentricity eB_m (" +
              eB_m.toFixed(3) +
              " m) must be strictly less than B/2 (" +
              (B_m / 2.0).toFixed(3) +
              " m) for positive effective width B'."
          );
        }
      } else if (shape === "Square") {
        if (!(eB_m < B_m / 2.0) || !(eL_m < B_m / 2.0)) {
          errors.push(
            "Square footing eccentricities eB_m and eL_m must both be strictly less than B/2 (" +
              (B_m / 2.0).toFixed(3) +
              " m)."
          );
        }
      } else if (shape === "Rectangular" && isFiniteNumber(L_m) && L_m > 0) {
        if (!(eB_m < B_m / 2.0)) {
          errors.push(
            "Rectangular footing eccentricity eB_m (" +
              eB_m.toFixed(3) +
              " m) must be strictly less than B/2 (" +
              (B_m / 2.0).toFixed(3) +
              " m)."
          );
        }
        if (!(eL_m < L_m / 2.0)) {
          errors.push(
            "Rectangular footing eccentricity eL_m (" +
              eL_m.toFixed(3) +
              " m) must be strictly less than L/2 (" +
              (L_m / 2.0).toFixed(3) +
              " m)."
          );
        }
      } else if (shape === "Circular") {
        var eTotCheck = Math.hypot(eB_m, eL_m);
        if (!(eTotCheck < B_m / 2.0)) {
          errors.push(
            "Circular footing total eccentricity √(eB² + eL²) = " +
              eTotCheck.toFixed(3) +
              " m must be strictly less than radius R = B/2 (" +
              (B_m / 2.0).toFixed(3) +
              " m)."
          );
        }
      }
    }

    // Active water table validation
    var zw = waterTableMode === "Measured" ? zwMeasured : zwDesign;
    if (!isFiniteNumber(zw) || zw < 0) {
      errors.push("Active water table depth (" + String(waterTableMode) + ") must be a finite number ≥ 0 m.");
    }

    // Soil source validation
    var sortedLayers = [];
    if (useManualSoil) {
      if (!isFiniteNumber(p3Input.manual_c) || p3Input.manual_c < 0) {
        errors.push("Manual cohesion/strength manual_c must be a finite number ≥ 0 kPa.");
      }
      if (!isFiniteNumber(p3Input.manual_phi) || p3Input.manual_phi < 0 || p3Input.manual_phi > 50) {
        errors.push("Manual friction angle manual_phi must be a finite number between 0° and 50°.");
      }
      if (!isFiniteNumber(p3Input.manual_gamma_above) || !(p3Input.manual_gamma_above > 0)) {
        errors.push("Manual moist unit weight above base (manual_gamma_above) must be > 0 kN/m³.");
      }
      if (!isFiniteNumber(p3Input.manual_gamma_below) || !(p3Input.manual_gamma_below > 0)) {
        errors.push("Manual moist unit weight below base (manual_gamma_below) must be > 0 kN/m³.");
      }
      if (
        !isFiniteNumber(p3Input.manual_gamma_sat_below) ||
        (isFiniteNumber(p3Input.manual_gamma_below) &&
          p3Input.manual_gamma_sat_below < p3Input.manual_gamma_below)
      ) {
        errors.push(
          "Manual saturated unit weight below base (manual_gamma_sat_below) must be ≥ manual_gamma_below."
        );
      }
    } else {
      if (!Array.isArray(processedLayers) || processedLayers.length === 0) {
        errors.push(
          "No valid Module P1 soil profile is available. Fix Module P1 stratigraphy or enable Manual Soil Override."
        );
      } else {
        sortedLayers = processedLayers.slice().sort(function (a, b) {
          return a.z_top - b.z_top;
        });
        var maxDepthP1 = sortedLayers[sortedLayers.length - 1].z_bot;
        if (isFiniteNumber(Df_m) && Df_m >= maxDepthP1 - DEPTH_TOL_M) {
          errors.push(
            "Embedment depth D_f (" +
              Df_m.toFixed(2) +
              " m) reaches or exceeds bottom of deepest Module P1 layer (" +
              maxDepthP1.toFixed(2) +
              " m). Extend the P1 profile deeper than D_f or switch to Manual Soil Override."
          );
        }
      }
    }

    if (errors.length > 0) {
      return { result: null, errors: errors };
    }

    // -------------------------------------------------------------------------
    // Primary IS 6403:1981 Calculation
    // -------------------------------------------------------------------------
    var primary = evaluateIS6403Case(p3Input, sortedLayers, zw, gw, true);
    if (!primary) {
      return {
        result: null,
        errors: ["Unable to extract valid soil parameters below footing embedment depth D_f."]
      };
    }

    // Non-blocking kern / middle-third uplift check
    var middleThirdWarning = false;
    if (shape === "Strip") {
      middleThirdWarning = eB_m > B_m / 6.0 + 1e-9;
    } else if (shape === "Square") {
      middleThirdWarning = eB_m > B_m / 6.0 + 1e-9 || eL_m > B_m / 6.0 + 1e-9;
    } else if (shape === "Rectangular") {
      middleThirdWarning = eB_m > B_m / 6.0 + 1e-9 || eL_m > L_m / 6.0 + 1e-9;
    } else if (shape === "Circular") {
      middleThirdWarning = Math.hypot(eB_m, eL_m) > B_m / 8.0 + 1e-9;
    }

    var warningMessages = [];
    if (middleThirdWarning) {
      warningMessages.push(
        shape === "Circular"
          ? "Eccentricity exceeds circular kern limit (e > B/8): tension/uplift may develop along the footing edge."
          : "Eccentricity exceeds middle-third kern limit (e > B/6 or L/6): tension/uplift may develop under the footing edge."
      );
    }
    if (primary.slidingWarning) {
      warningMessages.push(
        "Load inclination α (" +
          alpha_deg.toFixed(1) +
          "°) ≥ mobilized friction angle φ_m (" +
          primary.shear.phi_m.toFixed(1) +
          "°): i_γ clamped to 0.000; check base sliding stability."
      );
    }
    if (primary.soil.failureZoneTruncated) {
      warningMessages.push(
        "Failure zone extends to D_f + B' = " +
          (Df_m + primary.geometry.B_eff).toFixed(2) +
          " m, beyond deepest P1 stratum (" +
          primary.soil.failureZoneBot_m.toFixed(2) +
          " m); parameters averaged over available depth."
      );
    }

    // -------------------------------------------------------------------------
    // J. 9-Point Footing Width Sensitivity Curve [max(0.5, 0.5*B), 2.5*B]
    // -------------------------------------------------------------------------
    var bMin = Math.max(0.5, 0.5 * B_m);
    var bMax = Math.max(2.5 * B_m, bMin + 0.8);
    var numPts = 9;
    var widthCurve = [];

    var aspectLoverB = shape === "Rectangular" ? L_m / B_m : 1.0;
    var relEB = eB_m / B_m;
    var relEL = shape === "Rectangular" ? eL_m / L_m : eL_m / B_m;

    for (var k = 0; k < numPts; k++) {
      var frac = numPts > 1 ? k / (numPts - 1) : 0.0;
      var trialB = bMin + frac * (bMax - bMin);
      var trialL = shape === "Rectangular" ? trialB * aspectLoverB : trialB;
      var trialEB = trialB * relEB;
      var trialEL = shape === "Rectangular" ? trialL * relEL : trialB * relEL;

      var trialInput = Object.assign({}, p3Input, {
        B_m: trialB,
        L_m: trialL,
        eB_m: trialEB,
        eL_m: trialEL
      });

      var trialOut = evaluateIS6403Case(trialInput, sortedLayers, zw, gw, false);
      if (trialOut) {
        widthCurve.push({
          B_m: trialB,
          B_eff: trialOut.geometry.B_eff,
          q_nu: trialOut.capacities.q_nu,
          q_ns: trialOut.capacities.q_ns,
          q_u: trialOut.capacities.q_u,
          q_s: trialOut.capacities.q_s,
          Q_ns: trialOut.capacities.Q_ns,
          Q_s: trialOut.capacities.Q_s,
          W_prime: trialOut.factors.W_prime
        });
      }
    }

    var result = {
      inputs: Object.assign({}, p3Input),
      geometry: primary.geometry,
      soil: primary.soil,
      shear: primary.shear,
      factors: primary.factors,
      terms: primary.terms,
      capacities: primary.capacities,
      warnings: {
        middleThirdWarning: middleThirdWarning,
        slidingWarning: primary.slidingWarning,
        failureZoneTruncated: primary.soil.failureZoneTruncated,
        messages: warningMessages
      },
      steps: primary.steps,
      widthCurve: widthCurve
    };

    return {
      result: result,
      errors: []
    };
  }

  // Expose frozen constants and pure IS 6403:1981 calculation engine on window.ModuleP3Logic
  global.ModuleP3Logic = Object.freeze({
    FOOTING_SHAPES: FOOTING_SHAPES,
    SHEAR_MODES: SHEAR_MODES,
    ANALYSIS_TYPES: ANALYSIS_TYPES,
    WATER_TABLE_MODES: WATER_TABLE_MODES,
    computeBearingCapacity: computeBearingCapacity
  });
})(window);