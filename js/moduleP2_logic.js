/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P2 Pure Calculation & Validation Engine: window.ModuleP2Logic
 * ==============================================================================
 * Covers IS 2131:1981 SPT N-Value Corrections (Overburden & Dilatancy) and
 * Direct Shear Mohr-Coulomb Ordinary Least Squares (OLS) Envelope Fitting.
 * Strict SI Units: Depth (m), Stress/Strength (kPa), Unit Weight (kN/m³), Angle (deg).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", zero DOM or ES module dependencies).
 */

(function initModuleP2Logic(global) {
  "use strict";

  // Source: Terzaghi, Peck, & Mesri (1996), "Soil Mechanics in Engineering Practice",
  // 3rd Ed., Wiley — Standard freshwater unit weight: 9.81 kN/m³.
  var DEFAULT_GAMMA_W = 9.81;

  // Tolerance (m) for comparing test depth against bottom of deepest P1 layer.
  var DEPTH_TOL_M = 1e-6;

  // Source: IS 2131:1981 (Method for Standard Penetration Test for Soils),
  // Clauses 3.6.1 (Overburden correction) & 3.6.2 (Dilatancy correction).
  var SPT_SOIL_CATEGORIES = Object.freeze([
    "Fine Sand / Silt (Dilatancy Applicable)",
    "Coarse Sand / Gravel (No Dilatancy)",
    "Cohesive Soil (Clay)"
  ]);

  /**
   * Resolves the unit weight of water (kN/m³) from an explicit argument,
   * falling back to window.GeotechState.gamma_w and finally 9.81 kN/m³.
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
   * Checks whether a value is a finite JavaScript number (excludes booleans/strings/NaN/Infinity).
   */
  function isFiniteNumber(val) {
    return typeof val === "number" && Number.isFinite(val);
  }

  /**
   * Computes exact piecewise vertical total stress, hydrostatic pore water pressure,
   * and effective overburden stress sigma_v0' (kPa) from z = 0 to z = depthM across
   * processedLayers, splitting any layer that straddles zwMeasured.
   *
   * Source: Terzaghi's Principle of Effective Stress (sigma' = sigma - u) &
   * EN 1997-2 / IS 2131:1981 stress evaluation.
   *
   * @param {number} depthM - SPT test depth below ground surface (m).
   * @param {Array<Object>} processedLayers - Validated P1 layers sorted or unsorted.
   * @param {number} zwMeasured - Measured water table depth below ground surface (m).
   * @param {number} [gammaW] - Unit weight of water (kN/m³).
   * @returns {{ sigma_v0: number|null, totalStress: number|null, porePressure: number|null, layerBreakdown: Array<Object>, error: string|null }}
   */
  function computeEffectiveOverburden(depthM, processedLayers, zwMeasured, gammaW) {
    var gw = resolveGammaW(gammaW);
    var zw = isFiniteNumber(zwMeasured) && zwMeasured >= 0 ? zwMeasured : 0.0;

    if (!isFiniteNumber(depthM) || !(depthM > 0)) {
      return {
        sigma_v0: null,
        totalStress: null,
        porePressure: null,
        layerBreakdown: [],
        error: "Test depth must be a finite number greater than 0.00 m."
      };
    }

    if (!Array.isArray(processedLayers) || processedLayers.length === 0) {
      return {
        sigma_v0: null,
        totalStress: null,
        porePressure: null,
        layerBreakdown: [],
        error:
          "No valid P1 soil profile available. Define a valid soil profile in Module P1 or enter a manual sigma_v_override (kPa)."
      };
    }

    // Sort shallow copy ascending by z_top without mutating caller's array
    var sorted = processedLayers.slice().sort(function (a, b) {
      return a.z_top - b.z_top;
    });

    var maxProfileDepth = sorted[sorted.length - 1].z_bot;
    if (depthM > maxProfileDepth + DEPTH_TOL_M) {
      return {
        sigma_v0: null,
        totalStress: null,
        porePressure: null,
        layerBreakdown: [],
        error:
          "Test depth (" +
          depthM.toFixed(2) +
          " m) exceeds bottom of deepest P1 layer (" +
          maxProfileDepth.toFixed(2) +
          " m). Extend the P1 soil profile or enter a manual sigma_v_override (kPa)."
      };
    }

    var totalStress = 0.0;
    var sigmaV0 = 0.0;
    var layerBreakdown = [];

    for (var i = 0; i < sorted.length; i++) {
      var lyr = sorted[i];
      var zTop = lyr.z_top;
      var zBot = lyr.z_bot;

      if (!isFiniteNumber(zTop) || !isFiniteNumber(zBot) || zBot <= zTop) {
        continue;
      }

      // Stop once current stratum begins at or below target depthM
      if (zTop >= depthM - DEPTH_TOL_M) {
        break;
      }

      var segTop = zTop;
      var segBot = Math.min(zBot, depthM);
      if (segBot <= segTop + DEPTH_TOL_M) {
        continue;
      }

      var gammaMoist = isFiniteNumber(lyr.gamma_moist) ? lyr.gamma_moist : 0.0;
      var gammaSat = isFiniteNumber(lyr.gamma_sat) ? lyr.gamma_sat : gammaMoist;
      var gammaSub = isFiniteNumber(lyr.gamma_sub) ? lyr.gamma_sub : gammaSat - gw;

      var dzMoist = 0.0;
      var dzSub = 0.0;

      // Split stratum across zwMeasured into moist and submerged sub-intervals
      // Source: Terzaghi (1943) / Das & Sobhan (2018) piecewise stress integration
      if (segBot <= zw) {
        dzMoist = segBot - segTop;
      } else if (segTop >= zw) {
        dzSub = segBot - segTop;
      } else {
        dzMoist = Math.max(0.0, zw - segTop);
        dzSub = Math.max(0.0, segBot - zw);
      }

      var segTotalStress = dzMoist * gammaMoist + dzSub * gammaSat;
      var segEffectiveStress = dzMoist * gammaMoist + dzSub * gammaSub;

      totalStress += segTotalStress;
      sigmaV0 += segEffectiveStress;

      layerBreakdown.push({
        layerIndex: i + 1,
        soilType: lyr.soilType || "Stratum " + (i + 1),
        z_top: segTop,
        z_bot: segBot,
        dz_moist: dzMoist,
        dz_sub: dzSub,
        gamma_moist: gammaMoist,
        gamma_sat: gammaSat,
        gamma_sub: gammaSub,
        deltaTotalStress: segTotalStress,
        deltaEffectiveStress: segEffectiveStress
      });
    }

    // Hydrostatic pore water pressure below measured water table: u = gamma_w * max(0, depthM - zw)
    // Source: Terzaghi's Principle of Effective Stress (u = sigma_v - sigma_v')
    var porePressure = depthM > zw ? gw * (depthM - zw) : 0.0;

    return {
      sigma_v0: sigmaV0,
      totalStress: totalStress,
      porePressure: porePressure,
      layerBreakdown: layerBreakdown,
      error: null
    };
  }

  /**
   * Validates and processes an array of SPT records according to IS 2131:1981
   * without mutating the input array.
   *
   * Source:
   * - IS 2131:1981 Clause 3.6.1 (Overburden correction; Peck, Hanson & Thornburn, 1974)
   * - IS 2131:1981 Clause 3.6.2 (Dilatancy correction for fine sands/silts; Terzaghi & Peck, 1967)
   *
   * @param {Array<Object>} sptRecords
   * @param {Array<Object>} processedLayers
   * @param {number} zwMeasured
   * @param {number} [gammaW]
   * @returns {{ sptProcessed: Array<Object>, sptErrors: Array<string> }}
   */
  function processSptRecords(sptRecords, processedLayers, zwMeasured, gammaW) {
    var sptErrors = [];
    var sptProcessed = [];
    var gw = resolveGammaW(gammaW);
    var zw = isFiniteNumber(zwMeasured) && zwMeasured >= 0 ? zwMeasured : 0.0;

    if (!Array.isArray(sptRecords) || sptRecords.length === 0) {
      return { sptProcessed: [], sptErrors: [] };
    }

    for (var idx = 0; idx < sptRecords.length; idx++) {
      var rec = sptRecords[idx] || {};
      var rowNum = idx + 1;
      var prefix = "SPT Row " + rowNum + ": ";
      var rowHasError = false;

      var depthM = rec.depth_m;
      var nMeasured = rec.N_measured;
      var soilCategory = rec.soilCategory;
      var overrideRaw = rec.sigma_v_override;

      if (!isFiniteNumber(depthM) || !(depthM > 0)) {
        sptErrors.push(prefix + "depth_m must be a finite number > 0 m.");
        rowHasError = true;
      }

      if (!isFiniteNumber(nMeasured) || nMeasured < 0 || nMeasured > 150) {
        sptErrors.push(prefix + "N_measured must be a finite number between 0 and 150.");
        rowHasError = true;
      }

      if (SPT_SOIL_CATEGORIES.indexOf(soilCategory) === -1) {
        sptErrors.push(
          prefix +
            "Invalid soilCategory ('" +
            String(soilCategory) +
            "'). Must be one of: " +
            SPT_SOIL_CATEGORIES.join(", ") +
            "."
        );
        rowHasError = true;
      }

      var hasManualOverride = false;
      var manualSigmaV = null;
      if (overrideRaw !== null && overrideRaw !== undefined && String(overrideRaw).trim() !== "") {
        var parsedOverride = typeof overrideRaw === "number" ? overrideRaw : Number(overrideRaw);
        if (!isFiniteNumber(parsedOverride) || !(parsedOverride > 0)) {
          sptErrors.push(prefix + "sigma_v_override, when provided, must be a finite number > 0 kPa.");
          rowHasError = true;
        } else {
          hasManualOverride = true;
          manualSigmaV = parsedOverride;
        }
      }

      if (rowHasError) {
        continue;
      }

      // Resolve effective overburden pressure sigma_v0' (kPa)
      var sigmaV0 = null;
      var sigmaV0Source = "Auto (P1)";
      var totalStress = null;
      var porePressure = null;

      if (hasManualOverride) {
        sigmaV0 = manualSigmaV;
        sigmaV0Source = "Manual Override";
      } else {
        var obResult = computeEffectiveOverburden(depthM, processedLayers, zw, gw);
        if (obResult.error || !isFiniteNumber(obResult.sigma_v0)) {
          sptErrors.push(prefix + obResult.error);
          continue;
        }
        sigmaV0 = obResult.sigma_v0;
        totalStress = obResult.totalStress;
        porePressure = obResult.porePressure;
        sigmaV0Source = "Auto (P1)";
      }

      var isBelowWT = depthM > zw;
      var isCohesionless =
        soilCategory === "Fine Sand / Silt (Dilatancy Applicable)" ||
        soilCategory === "Coarse Sand / Gravel (No Dilatancy)";
      var isFineSandOrSilt = soilCategory === "Fine Sand / Silt (Dilatancy Applicable)";

      // Step 2a: IS 2131:1981 Clause 3.6.1 — Overburden Correction
      // Analytical representation of IS 2131 Fig. 1 by Peck, Hanson & Thornburn (1974):
      // CN = 0.77 * log10(2000 / sigma_eff), where sigma_eff is in kPa and CN <= 2.0.
      var overburdenApplied = false;
      var overburdenClamped = false;
      var sigmaEff = sigmaV0;
      var cn = 1.0;
      var nPrime = nMeasured;

      if (isCohesionless) {
        overburdenApplied = true;
        if (sigmaV0 < 25.0) {
          overburdenClamped = true;
          sigmaEff = 25.0;
        }
        var rawCn = 0.77 * (Math.log(2000.0 / sigmaEff) / Math.LN10);
        cn = Math.min(2.0, Math.max(0.0, rawCn));
        nPrime = cn * nMeasured;
      } else {
        overburdenApplied = false;
        overburdenClamped = false;
        cn = 1.0;
        nPrime = nMeasured;
      }

      // Step 2b: IS 2131:1981 Clause 3.6.2 — Dilatancy / Submergence Correction
      // Applies only to fine sands and silts below water table when N' > 15:
      // N'' = 15 + 0.5 * (N' - 15)  (Terzaghi & Peck, 1967 / IS 2131:1981 Clause 3.6.2)
      var dilatancyApplied = isFineSandOrSilt && isBelowWT && nPrime > 15.0;
      var nDoublePrime = dilatancyApplied ? 15.0 + 0.5 * (nPrime - 15.0) : nPrime;
      var nFinalRounded = Math.round(nDoublePrime);

      // Concise step-by-step calculation log for UI inspection
      var steps = [];
      if (hasManualOverride) {
        steps.push(
          "1. Overburden (Manual Override): σ'_v0 = " + sigmaV0.toFixed(2) + " kPa at z = " + depthM.toFixed(2) + " m."
        );
      } else {
        steps.push(
          "1. Overburden (P1 Integration): σ'_v0 = " +
            sigmaV0.toFixed(2) +
            " kPa (σ_v = " +
            totalStress.toFixed(2) +
            " kPa, u = " +
            porePressure.toFixed(2) +
            " kPa at z_w = " +
            zw.toFixed(2) +
            " m)."
        );
      }

      if (overburdenApplied) {
        var clampNote = overburdenClamped
          ? " [clamped from " + sigmaV0.toFixed(2) + " to 25.00 kPa per IS 2131 Cl. 3.6.1]"
          : "";
        steps.push(
          "2. Overburden Correction (IS 2131 Cl. 3.6.1 / Peck et al., 1974): σ_eff = " +
            sigmaEff.toFixed(2) +
            " kPa" +
            clampNote +
            " → C_N = min(2.00, 0.77·log10(2000/" +
            sigmaEff.toFixed(2) +
            ")) = " +
            cn.toFixed(3) +
            "; N' = " +
            cn.toFixed(3) +
            " × " +
            nMeasured.toFixed(1) +
            " = " +
            nPrime.toFixed(2) +
            "."
        );
      } else {
        steps.push(
          "2. Overburden Correction (IS 2131 Cl. 3.6.1): Skipped for cohesive soil → C_N = 1.000, N' = " +
            nPrime.toFixed(2) +
            "."
        );
      }

      if (dilatancyApplied) {
        steps.push(
          "3. Dilatancy Correction (IS 2131 Cl. 3.6.2): Fine sand/silt below WT (z = " +
            depthM.toFixed(2) +
            " m > " +
            zw.toFixed(2) +
            " m) with N' = " +
            nPrime.toFixed(2) +
            " > 15 → N'' = 15 + 0.5·(" +
            nPrime.toFixed(2) +
            " − 15) = " +
            nDoublePrime.toFixed(2) +
            " (rounded: " +
            nFinalRounded +
            ")."
        );
      } else {
        var reason = !isFineSandOrSilt
          ? "not fine sand/silt"
          : !isBelowWT
            ? "above or at water table (z ≤ z_w)"
            : "N' ≤ 15";
        steps.push(
          "3. Dilatancy Correction (IS 2131 Cl. 3.6.2): Not applied (" +
            reason +
            ") → N'' = " +
            nDoublePrime.toFixed(2) +
            " (rounded: " +
            nFinalRounded +
            ")."
        );
      }

      sptProcessed.push({
        rowIndex: idx,
        depth_m: depthM,
        N_measured: nMeasured,
        soilCategory: soilCategory,
        sigma_v_override: hasManualOverride ? manualSigmaV : null,
        sigma_v0: sigmaV0,
        sigma_v0_source: sigmaV0Source,
        isBelowWT: isBelowWT,
        overburdenApplied: overburdenApplied,
        overburdenClamped: overburdenClamped,
        CN: cn,
        N_prime: nPrime,
        dilatancyApplied: dilatancyApplied,
        N_double_prime: nDoublePrime,
        N_final_rounded: nFinalRounded,
        steps: steps
      });
    }

    return {
      sptProcessed: sptProcessed,
      sptErrors: sptErrors
    };
  }

  /**
   * Performs Ordinary Least Squares (OLS) linear regression on Direct Shear
   * failure points (sigma_n, tau_f) in kPa to fit the Mohr-Coulomb shear
   * strength envelope: tau_f = c' + sigma_n * tan(phi').
   *
   * Source: IS 2720 (Part 13) — Direct Shear Test; ASTM D3080; Terzaghi, Peck, & Mesri (1996).
   *
   * @param {Array<Object>} points - Array of { sigma_n, tau_f } in kPa.
   * @returns {{ directShearFit: Object|null, directShearErrors: Array<string> }}
   */
  function fitDirectShear(points) {
    var directShearErrors = [];

    if (!Array.isArray(points) || points.length < 2) {
      directShearErrors.push(
        "At least 2 Direct Shear test observations (σ_n, τ_f) are required to fit a Mohr-Coulomb envelope."
      );
      return { directShearFit: null, directShearErrors: directShearErrors };
    }

    var cleanPts = [];
    for (var i = 0; i < points.length; i++) {
      var pt = points[i] || {};
      var sig = pt.sigma_n;
      var tau = pt.tau_f;

      if (!isFiniteNumber(sig) || sig < 0) {
        directShearErrors.push("Direct Shear Row " + (i + 1) + ": Normal stress σ_n must be a finite number ≥ 0 kPa.");
        continue;
      }
      if (!isFiniteNumber(tau) || tau < 0) {
        directShearErrors.push("Direct Shear Row " + (i + 1) + ": Peak shear stress τ_f must be a finite number ≥ 0 kPa.");
        continue;
      }
      cleanPts.push({ sigma_n: sig, tau_f: tau });
    }

    if (directShearErrors.length > 0) {
      return { directShearFit: null, directShearErrors: directShearErrors };
    }

    if (cleanPts.length < 2) {
      directShearErrors.push("At least 2 valid Direct Shear points are required.");
      return { directShearFit: null, directShearErrors: directShearErrors };
    }

    var n = cleanPts.length;
    var sumX = 0.0;
    var sumY = 0.0;
    for (var j = 0; j < n; j++) {
      sumX += cleanPts[j].sigma_n;
      sumY += cleanPts[j].tau_f;
    }

    var meanSigma = sumX / n;
    var meanTau = sumY / n;

    var sXx = 0.0;
    var sXy = 0.0;
    var sYy = 0.0;
    var sumX2 = 0.0;
    var sumXY = 0.0;
    var maxSigma = 0.0;

    for (var k = 0; k < n; k++) {
      var x = cleanPts[k].sigma_n;
      var y = cleanPts[k].tau_f;
      var dx = x - meanSigma;
      var dy = y - meanTau;

      sXx += dx * dx;
      sXy += dx * dy;
      sYy += dy * dy;
      sumX2 += x * x;
      sumXY += x * y;
      if (x > maxSigma) {
        maxSigma = x;
      }
    }

    // Prevent division-by-zero singularity when all normal stresses are identical
    if (!(sXx > 1e-9)) {
      directShearErrors.push(
        "Normal stresses σ_n must span at least two distinct values (S_xx must exceed 1e-9) for Mohr-Coulomb regression."
      );
      return { directShearFit: null, directShearErrors: directShearErrors };
    }

    var slope = sXy / sXx;

    // Mohr-Coulomb friction angle phi' cannot be negative in physical shear testing
    if (!(slope >= 0)) {
      directShearErrors.push(
        "Fitted Mohr-Coulomb slope tan(φ') is negative (" +
          slope.toFixed(4) +
          "). Shear strength τ_f generally increases with normal stress σ_n; check input data."
      );
      return { directShearFit: null, directShearErrors: directShearErrors };
    }

    var cPrimeRaw = meanTau - slope * meanSigma;
    var phiPrimeRaw = Math.atan(slope) * (180.0 / Math.PI);
    var r2 = sYy > 1e-12 ? (sXy * sXy) / (sXx * sYy) : 1.0;
    r2 = Math.min(1.0, Math.max(0.0, r2));

    var sumSqErr = 0.0;
    var residuals = [];
    for (var m = 0; m < n; m++) {
      var sigPt = cleanPts[m].sigma_n;
      var tauPt = cleanPts[m].tau_f;
      var tauPred = cPrimeRaw + slope * sigPt;
      var res = tauPt - tauPred;
      sumSqErr += res * res;
      residuals.push({
        sigma_n: sigPt,
        tau_f: tauPt,
        tau_pred: tauPred,
        residual: res
      });
    }

    var rmse = Math.sqrt(sumSqErr / n);

    // Engineering Non-Negative Cohesion Check:
    // Cohesionless/lightly bonded soils with slight scatter can yield c' < 0 in unconstrained OLS;
    // provide constrained origin fit (c'_design = 0 kPa) alongside raw OLS values.
    var negativeCohesionWarning = cPrimeRaw < 0.0;
    var cPrimeDesign = cPrimeRaw;
    var phiPrimeDesign = phiPrimeRaw;
    var slopeOrigin = null;
    var phiPrimeOrigin = null;

    if (negativeCohesionWarning && sumX2 > 1e-9) {
      slopeOrigin = Math.max(0.0, sumXY / sumX2);
      phiPrimeOrigin = Math.atan(slopeOrigin) * (180.0 / Math.PI);
      cPrimeDesign = 0.0;
      phiPrimeDesign = phiPrimeOrigin;
    }

    var signStr = cPrimeRaw >= 0 ? " + " : " − ";
    var equationText =
      "τ = " +
      Math.abs(cPrimeRaw).toFixed(2) +
      (cPrimeRaw >= 0 ? "" : " (raw)") +
      signStr +
      "σ_n · tan(" +
      phiPrimeRaw.toFixed(1) +
      "°)";

    var xEnd = Math.max(10.0, maxSigma * 1.1);
    var linePoints = {
      x: [0.0, xEnd],
      y: [cPrimeRaw, cPrimeRaw + slope * xEnd]
    };

    return {
      directShearFit: {
        n: n,
        meanSigma: meanSigma,
        meanTau: meanTau,
        S_xx: sXx,
        S_xy: sXy,
        S_yy: sYy,
        slope: slope,
        c_prime_raw: cPrimeRaw,
        phi_prime_raw: phiPrimeRaw,
        R2: r2,
        rmse: rmse,
        residuals: residuals,
        negativeCohesionWarning: negativeCohesionWarning,
        c_prime_design: cPrimeDesign,
        phi_prime_design: phiPrimeDesign,
        slope_origin: slopeOrigin,
        phi_prime_origin: phiPrimeOrigin,
        equationText: equationText,
        linePoints: linePoints
      },
      directShearErrors: []
    };
  }

  // Expose pure calculation engine and IS 2131 soil categories on window.ModuleP2Logic
  global.ModuleP2Logic = Object.freeze({
    SPT_SOIL_CATEGORIES: SPT_SOIL_CATEGORIES,
    computeEffectiveOverburden: computeEffectiveOverburden,
    processSptRecords: processSptRecords,
    fitDirectShear: fitDirectShear
  });
})(window);