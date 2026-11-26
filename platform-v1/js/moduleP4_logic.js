/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P4 Pure Calculation & Validation Engine: window.ModuleP4Logic
 * ==============================================================================
 * Shallow Foundation Settlement Analysis (Immediate Elastic Settlement +
 * 1D Terzaghi Primary Consolidation Settlement + Time-Rate of Consolidation).
 *
 * Standards & References:
 *   - IS 8009 (Part 1):1976 — Calculation of Settlements of Foundations (Shallow)
 *   - IS 1904:1986 — Design and Construction of Foundations in Soils (Table 1 limits)
 *   - Newmark, N. M. (1935) — Simplified Computation of Vertical Pressures in Elastic Foundations
 *   - Westergaard, H. M. (1938) — A Problem of Elasticity Suggested by a Problem in Soil Mechanics
 *   - Schmertmann, J. H., Hartman, J. P., & Brown, P. R. (1978) — Improved Strain Influence Factor Diagrams
 *   - Terzaghi, K. (1943) — Theoretical Soil Mechanics (1D Consolidation Theory)
 *
 * Strict SI Units: Dimensions/Depths (m), Net Load (kN or kN/m for Strip),
 * Stress/Modulus (kPa), Unit Weight (kN/m³), Settlement (mm),
 * Consolidation Coefficient cv (mm²/s), Time (days, yr).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", zero DOM or ES module dependencies).
 */

(function initModuleP4Logic(global) {
  "use strict";

  // Source: Terzaghi, Peck, & Mesri (1996) — Standard freshwater unit weight (kN/m³)
  var DEFAULT_GAMMA_W = 9.81;

  // Time unit conversion constants (SI seconds to days / Julian years)
  var SECONDS_PER_DAY = 86400.0;
  var DAYS_PER_YEAR = 365.25;

  // Geometric tolerances (m) for depth and layer boundary checks
  var DEPTH_TOL_M = 1e-6;
  var BOUNDARY_TOL_M = 1e-4;

  // Source: IS 8009 (Part 1):1976 Clauses 9.2.2 & 9.4 (Flexible vs. Rigid footing factor)
  var FOOTING_TYPES = Object.freeze([
    "Flexible",
    "Rigid"
  ]);

  // Supported shallow foundation plan geometries
  var FOOTING_SHAPES = Object.freeze([
    "Rectangular",
    "Square",
    "Circular",
    "Strip"
  ]);

  // Load specification modes (Net contact stress q0 vs. Net total vertical load Q_net)
  var LOAD_INPUT_MODES = Object.freeze([
    "Stress",
    "Total Load"
  ]);

  // Source: EN 1997-1 Clause 2.4.5.1 (Design vs. Measured phreatic level)
  var WATER_TABLE_MODES = Object.freeze([
    "Design",
    "Measured"
  ]);

  // Vertical stress dispersion methods beneath foundation base
  var STRESS_METHODS = Object.freeze([
    "2:1 Dispersion",
    "Boussinesq Point Integration",
    "Westergaard"
  ]);

  // Immediate / elastic settlement calculation models
  var ELASTIC_METHODS = Object.freeze([
    "IS 8009 / Janbu",
    "Schmertmann (1978)"
  ]);

  // Source: Terzaghi (1943) — 1D vertical drainage boundary conditions for clay layers
  var DRAINAGE_CONDITIONS = Object.freeze([
    "Double",
    "Single Top",
    "Single Bottom"
  ]);

  /**
   * Clamps a numeric value to [minVal, maxVal].
   */
  function clamp(val, minVal, maxVal) {
    if (val < minVal) return minVal;
    if (val > maxVal) return maxVal;
    return val;
  }

  /**
   * Checks whether a value is a finite JavaScript number.
   */
  function isFiniteNumber(val) {
    return typeof val === "number" && Number.isFinite(val);
  }

  /**
   * Base-10 logarithm helper for universal browser compatibility.
   */
  function log10(x) {
    return Math.log(x) / Math.LN10;
  }

  /**
   * Resolves unit weight of water gamma_w (kN/m³) from explicit argument,
   * falling back to window.GeotechState.gamma_w and finally 9.81 kN/m³.
   */
  function resolveGammaW(gammaW) {
    if (isFiniteNumber(gammaW) && gammaW > 0) {
      return gammaW;
    }
    if (
      global.GeotechState &&
      isFiniteNumber(global.GeotechState.gamma_w) &&
      global.GeotechState.gamma_w > 0
    ) {
      return global.GeotechState.gamma_w;
    }
    return DEFAULT_GAMMA_W;
  }

  /**
   * Computes dimensionless vertical stress influence factor I_sigma in [0, 1]
   * beneath the center of a uniformly loaded shallow foundation at depth
   * z' = zBelowBase (m) below the footing base.
   *
   * Sources:
   *   - 2:1 Dispersion: Approximate trapezoidal stress spread (Bowles, 1996)
   *   - Boussinesq Point Integration: Newmark (1935) exact corner integration (4 quadrants),
   *     Boussinesq circular center solution, and infinite strip solution (Das & Sobhan, 2018)
   *   - Westergaard: Westergaard (1938) elastic layered medium solution (IS 8009 Part 1)
   *
   * @param {number} zBelowBase Depth below footing base z' (m).
   * @param {string} shape Footing shape ("Rectangular", "Square", "Circular", "Strip").
   * @param {number} B_m Footing width or diameter (m).
   * @param {number} L_m Footing length (m; ignored for Square, Circular, Strip).
   * @param {string} method Stress dispersion method from STRESS_METHODS.
   * @param {number} [nu=0.30] Drained Poisson's ratio (-) used in Westergaard solution.
   * @returns {number} Influence factor I_sigma in [0, 1].
   */
  function computeStressInfluence(zBelowBase, shape, B_m, L_m, method, nu) {
    if (!isFiniteNumber(zBelowBase) || zBelowBase <= 1e-6) {
      return 1.0;
    }
    if (!isFiniteNumber(B_m) || !(B_m > 0)) {
      return 0.0;
    }

    var z = zBelowBase;
    var B = B_m;
    var L = shape === "Rectangular" && isFiniteNumber(L_m) && L_m > 0 ? L_m : B;
    var influence = 0.0;

    if (method === "2:1 Dispersion") {
      if (shape === "Rectangular") {
        influence = (B * L) / ((B + z) * (L + z));
      } else if (shape === "Strip") {
        influence = B / (B + z);
      } else {
        // Square or Circular
        influence = (B * B) / ((B + z) * (B + z));
      }
      return clamp(influence, 0.0, 1.0);
    }

    if (method === "Boussinesq Point Integration") {
      if (shape === "Circular") {
        // Exact Boussinesq vertical stress beneath center of uniformly loaded circular area
        var R = B / 2.0;
        var rOverZ = R / z;
        influence = 1.0 - Math.pow(1.0 / (1.0 + rOverZ * rOverZ), 1.5);
      } else if (shape === "Strip") {
        // Exact Boussinesq vertical stress beneath center of infinite strip of width B
        var beta = 2.0 * Math.atan(B / (2.0 * z));
        influence = (beta + Math.sin(beta)) / Math.PI;
      } else {
        // Rectangular / Square: Exact Newmark (1935) center = 4 * I_corner(m, n)
        var m = (B / 2.0) / z;
        var n = (L / 2.0) / z;
        var m2 = m * m;
        var n2 = n * n;
        var r2 = m2 + n2 + 1.0;
        var sqrtR = Math.sqrt(r2);
        var numer = 2.0 * m * n * sqrtR;
        var term1 = (numer / (r2 + m2 * n2)) * ((r2 + 1.0) / r2);
        var denom = r2 - m2 * n2;
        // Math.atan2 handles denom < 0 seamlessly in (0, pi) without branch jump
        var term2 = Math.atan2(numer, denom);
        var iCorner = (1.0 / (4.0 * Math.PI)) * (term1 + term2);
        influence = 4.0 * iCorner;
      }
      return clamp(influence, 0.0, 1.0);
    }

    if (method === "Westergaard") {
      // Source: Westergaard (1938); Poisson's ratio clamped in [0.0, 0.45] for numerical stability
      var nuSafe = clamp(isFiniteNumber(nu) ? nu : 0.30, 0.0, 0.45);
      var k = Math.sqrt((1.0 - 2.0 * nuSafe) / (2.0 - 2.0 * nuSafe));

      if (shape === "Circular") {
        var Rw = B / 2.0;
        var rOverZw = Rw / z;
        influence = 1.0 - k / Math.sqrt(k * k + rOverZw * rOverZw);
      } else if (shape === "Strip") {
        influence = (2.0 / Math.PI) * Math.atan(B / (2.0 * k * z));
      } else {
        // Rectangular / Square (4 symmetric quadrants)
        var mw = (B / 2.0) / z;
        var nw = (L / 2.0) / z;
        influence =
          (2.0 / Math.PI) *
          Math.atan((mw * nw) / (k * Math.sqrt(mw * mw + nw * nw + k * k)));
      }
      return clamp(influence, 0.0, 1.0);
    }

    return 0.0;
  }

  /**
   * Computes exact 1D Terzaghi average degree of consolidation U in [0, 1]
   * from dimensionless time factor Tv using a 25-term Fourier series:
   *   U = 1 - sum_{m=0}^{24} (2 / M^2) * exp(-M^2 * Tv),  M = (pi / 2) * (2m + 1)
   *
   * Source: Terzaghi (1943), "Theoretical Soil Mechanics", Chapter XIII;
   * IS 8009 (Part 1):1976 Section 10.
   *
   * @param {number} Tv Dimensionless time factor (-).
   * @returns {number} Average degree of consolidation U in [0, 1].
   */
  function computeDegreeOfConsolidation(Tv) {
    if (!isFiniteNumber(Tv) || Tv <= 0.0) {
      return 0.0;
    }
    if (Tv >= 5.0) {
      return 1.0;
    }

    var sum = 0.0;
    for (var m = 0; m < 25; m++) {
      var M = (Math.PI / 2.0) * (2 * m + 1);
      var M2 = M * M;
      sum += (2.0 / M2) * Math.exp(-M2 * Tv);
    }

    return clamp(1.0 - sum, 0.0, 1.0);
  }

  /**
   * Computes exact piecewise effective vertical overburden stress sigma_v0'(z) (kPa)
   * from ground surface z = 0 to depth z across sorted layers split at zw.
   * If z extends slightly beyond the deepest stratum (e.g., Schmertmann z_peak check),
   * extrapolates conservatively using the bottom stratum's unit weight.
   *
   * Source: Terzaghi's Principle of Effective Stress (sigma' = sigma - u).
   */
  function sigmaV0AtDepth(zTarget, sortedLayers, zw, gw) {
    if (!isFiniteNumber(zTarget) || zTarget <= DEPTH_TOL_M || sortedLayers.length === 0) {
      return 0.0;
    }

    var sigmaV0 = 0.0;

    for (var i = 0; i < sortedLayers.length; i++) {
      var lyr = sortedLayers[i];
      var zTop = lyr.z_top;
      var zBot = lyr.z_bot;

      if (zTop >= zTarget - DEPTH_TOL_M) {
        break;
      }

      var segTop = zTop;
      var segBot = Math.min(zBot, zTarget);
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

    // Extrapolate cleanly if zTarget exceeds deepest stratum bottom
    var lastLayer = sortedLayers[sortedLayers.length - 1];
    if (zTarget > lastLayer.z_bot + DEPTH_TOL_M) {
      var extTop = lastLayer.z_bot;
      var extBot = zTarget;
      var gMoistLast = lastLayer.gamma_moist;
      var gSubLast = isFiniteNumber(lastLayer.gamma_sub)
        ? lastLayer.gamma_sub
        : lastLayer.gamma_sat - gw;

      var extMoist = 0.0;
      var extSub = 0.0;
      if (extBot <= zw) {
        extMoist = extBot - extTop;
      } else if (extTop >= zw) {
        extSub = extBot - extTop;
      } else {
        extMoist = Math.max(0.0, zw - extTop);
        extSub = Math.max(0.0, extBot - zw);
      }
      sigmaV0 += extMoist * gMoistLast + extSub * gSubLast;
    }

    return sigmaV0;
  }

  /**
   * Finds the soil layer containing depth z (m), clamping to the bottom layer at z = maxDepth.
   */
  function findLayerAtDepth(z, sortedLayers) {
    for (var i = 0; i < sortedLayers.length; i++) {
      var lyr = sortedLayers[i];
      if (z >= lyr.z_top - DEPTH_TOL_M && z <= lyr.z_bot + DEPTH_TOL_M) {
        return lyr;
      }
    }
    return sortedLayers[sortedLayers.length - 1] || null;
  }

  /**
   * Classifies whether a soil stratum undergoes 1D primary consolidation settlement.
   * Granular strata (Sand/Gravel with Cc < 0.05) undergo immediate elastic settlement
   * only (Sc_i = 0) to prevent double-counting.
   *
   * Source: IS 8009 (Part 1):1976 Clauses 9 & 10.
   */
  function isLayerConsolidating(lyr) {
    var soilName = String(lyr.soilType || "");
    if (/clay|silt|peat|organic/i.test(soilName)) {
      return true;
    }
    if (isFiniteNumber(lyr.Cc) && lyr.Cc >= 0.05 && isFiniteNumber(lyr.cv) && lyr.cv > 0) {
      return true;
    }
    return false;
  }

  /**
   * Discretizes all strata below Df_m into sub-layers of thickness <= subdivisionM.
   */
  function buildSubLayersBelowDf(sortedLayers, Df_m, subdivisionM) {
    var subLayers = [];
    var parentMeta = [];

    for (var i = 0; i < sortedLayers.length; i++) {
      var lyr = sortedLayers[i];
      var effTop = Math.max(lyr.z_top, Df_m);
      var effBot = lyr.z_bot;
      var effThick = effBot - effTop;

      if (effThick <= DEPTH_TOL_M) {
        continue;
      }

      var consolidating = isLayerConsolidating(lyr);
      var nSub = Math.max(1, Math.ceil(effThick / subdivisionM));
      var dH = effThick / nSub;

      var parentIdx = parentMeta.length;
      parentMeta.push({
        layerIndex: i + 1,
        soilType: lyr.soilType || "Layer " + (i + 1),
        isConsolidating: consolidating,
        z_top: effTop,
        z_bot: effBot,
        thickness_m: effThick,
        subLayerCount: nSub,
        layerRef: lyr
      });

      for (var s = 0; s < nSub; s++) {
        var subTop = effTop + s * dH;
        var subBot = s === nSub - 1 ? effBot : effTop + (s + 1) * dH;
        subLayers.push({
          parentIdx: parentIdx,
          layerIndex: i + 1,
          layerRef: lyr,
          isConsolidating: consolidating,
          z_top: subTop,
          z_bot: subBot,
          z_mid: 0.5 * (subTop + subBot),
          H_m: subBot - subTop
        });
      }
    }

    return {
      subLayers: subLayers,
      parentMeta: parentMeta
    };
  }

  /**
   * Core elastic + 1D primary consolidation settlement evaluator for a given net
   * contact stress q0 (kPa). Reused both for the primary design evaluation and
   * for the 9-point settlement-vs-load sensitivity curve.
   */
  function evaluateSettlementAtStress(q0, ctx, includeDetailedBreakdown) {
    var p4 = ctx.p4Input;
    var sortedLayers = ctx.sortedLayers;
    var subLayers = ctx.subLayers;
    var parentMeta = ctx.parentMeta;
    var Df_m = p4.Df_m;
    var B_m = p4.B_m;
    var L_eff = ctx.L_eff;
    var Rf = ctx.Rf;
    var zw = ctx.zw;
    var gw = ctx.gw;
    var maxDepth = ctx.maxProfileDepth;
    var method = p4.stressDistributionMethod;
    var elasticMethod = p4.elasticMethod;
    var nuDefault = p4.poissonRatioDefault;

    // -------------------------------------------------------------------------
    // Elastic Method Precomputation (IS 8009 / Janbu vs. Schmertmann 1978)
    // -------------------------------------------------------------------------
    var mu_0 = Math.max(0.75, 1.0 - 0.12 * Math.min(2.0, Df_m / B_m));
    var zElasticLimit = Math.min(maxDepth, Df_m + 4.0 * B_m);

    // Schmertmann (1978) strain influence diagram parameters
    var lOverB = 1.0;
    if (p4.shape === "Rectangular") {
      lOverB = p4.L_m / B_m;
    } else if (p4.shape === "Strip") {
      lOverB = 10.0;
    }
    var frac = clamp((lOverB - 1.0) / 9.0, 0.0, 1.0);
    var z_peak = (0.5 + 0.5 * frac) * B_m;
    var z_max = (2.0 + 2.0 * frac) * B_m;
    var Iz0 = 0.1 + 0.1 * frac;
    var sigma_vp = Math.max(1.0, sigmaV0AtDepth(Df_m + z_peak, sortedLayers, zw, gw));
    var Izp = 0.5 + 0.1 * Math.sqrt(Math.max(0.0, q0) / sigma_vp);
    var sigmaV0_Df = sigmaV0AtDepth(Df_m, sortedLayers, zw, gw);
    var C1 = Math.max(0.5, 1.0 - 0.5 * (sigmaV0_Df / Math.max(1e-6, q0)));
    var t_yr = Math.max(0.1, p4.targetTime_days / DAYS_PER_YEAR);
    var C2 = 1.0 + 0.2 * log10(t_yr / 0.1);
    var zSchmertLimit = Math.min(maxDepth, Df_m + z_max);

    function evalSchmertmannIz(zPrime) {
      if (zPrime <= 0.0) return Iz0;
      if (zPrime >= z_max) return 0.0;
      if (zPrime <= z_peak) {
        return Iz0 + (Izp - Iz0) * (zPrime / z_peak);
      }
      return Izp * (1.0 - (zPrime - z_peak) / (z_max - z_peak));
    }

    var parentAccum = null;
    if (includeDetailedBreakdown) {
      parentAccum = parentMeta.map(function (pm) {
        return {
          layerIndex: pm.layerIndex,
          soilType: pm.soilType,
          isConsolidating: pm.isConsolidating,
          z_top: pm.z_top,
          z_bot: pm.z_bot,
          thickness_m: pm.thickness_m,
          subLayerCount: pm.subLayerCount,
          E_prime_kPa: pm.layerRef.E_prime,
          nu_prime: isFiniteNumber(pm.layerRef.nu_prime) ? pm.layerRef.nu_prime : nuDefault,
          e0: pm.layerRef.e0,
          Cc: pm.layerRef.Cc,
          Cr: pm.layerRef.Cr,
          OCR: pm.layerRef.OCR,
          cv: pm.layerRef.cv,
          sumSigmaV0H: 0.0,
          sumDeltaSigmaH: 0.0,
          Se_i: 0.0,
          Sc_i: 0.0,
          sawNC: false,
          sawOCBelow: false,
          sawOCCross: false,
          maxStressRatio: 0.0
        };
      });
    }

    var totalSe = 0.0;
    var totalSc = 0.0;
    var maxClayStressRatio = 0.0;

    for (var i = 0; i < subLayers.length; i++) {
      var sub = subLayers[i];
      var lyr = sub.layerRef;
      var nu_i = isFiniteNumber(lyr.nu_prime) ? lyr.nu_prime : nuDefault;
      var zBelowMid = sub.z_mid - Df_m;

      var iSig = computeStressInfluence(zBelowMid, p4.shape, B_m, L_eff, method, nu_i);
      var deltaSigmaZ = q0 * iSig;
      var sigmaV0Mid = Math.max(1.0, sigmaV0AtDepth(sub.z_mid, sortedLayers, zw, gw));

      // -----------------------------------------------------------------------
      // D. Immediate / Elastic Settlement Se_i (mm)
      // -----------------------------------------------------------------------
      var Se_i = 0.0;

      if (elasticMethod === "IS 8009 / Janbu") {
        // Source: IS 8009 (Part 1):1976 Clauses 9.2 & 9.4 — Layered elastic compression
        // with rigidity factor Rf and embedment depth factor mu_0 (Janbu / Fox)
        if (sub.z_top < zElasticLimit - DEPTH_TOL_M) {
          var eBot = Math.min(sub.z_bot, zElasticLimit);
          var eH = eBot - sub.z_top;
          if (eH > DEPTH_TOL_M) {
            var eMid = 0.5 * (sub.z_top + eBot);
            var iSigEl =
              Math.abs(eMid - sub.z_mid) < DEPTH_TOL_M
                ? iSig
                : computeStressInfluence(eMid - Df_m, p4.shape, B_m, L_eff, method, nu_i);
            var dSigEl = q0 * iSigEl;
            Se_i = Rf * mu_0 * (dSigEl / lyr.E_prime) * (1.0 - nu_i * nu_i) * eH * 1000.0;
          }
        }
      } else {
        // Source: Schmertmann, Hartman & Brown (1978) — Exact piecewise-linear
        // integration of Iz(z') across [z1, z2], split at z_peak to avoid peak clipping
        if (!sub.isConsolidating && sub.z_top < zSchmertLimit - DEPTH_TOL_M) {
          var sBot = Math.min(sub.z_bot, zSchmertLimit);
          var z1 = Math.max(0.0, sub.z_top - Df_m);
          var z2 = Math.min(z_max, sBot - Df_m);
          if (z2 > z1 + DEPTH_TOL_M) {
            var integralIzDz = 0.0;
            if (z1 < z_peak && z2 > z_peak) {
              integralIzDz =
                0.5 * (evalSchmertmannIz(z1) + Izp) * (z_peak - z1) +
                0.5 * (Izp + evalSchmertmannIz(z2)) * (z2 - z_peak);
            } else {
              integralIzDz = 0.5 * (evalSchmertmannIz(z1) + evalSchmertmannIz(z2)) * (z2 - z1);
            }
            Se_i = Rf * C1 * C2 * q0 * (integralIzDz / lyr.E_prime) * 1000.0;
          }
        }
      }

      // -----------------------------------------------------------------------
      // E. 1D Terzaghi Primary Consolidation Settlement Sc_i (mm)
      // -----------------------------------------------------------------------
      var Sc_i = 0.0;
      var regime = "granular";

      if (sub.isConsolidating && deltaSigmaZ > 1e-9) {
        var e0 = lyr.e0;
        var Cc = lyr.Cc;
        var Cr = lyr.Cr;
        var OCR = isFiniteNumber(lyr.OCR) && lyr.OCR >= 1.0 ? lyr.OCR : 1.0;
        var sigmaP = Math.max(1.0, OCR) * sigmaV0Mid;
        var sigmaVf = sigmaV0Mid + deltaSigmaZ;
        var stressRatio = deltaSigmaZ / sigmaV0Mid;

        if (stressRatio > maxClayStressRatio) {
          maxClayStressRatio = stressRatio;
        }

        // Source: Terzaghi (1943); IS 8009 (Part 1):1976 Cl. 10.2 & Cl. 9.4 (Rf = 0.80
        // converts flexible center-line consolidation settlement to uniform rigid settlement)
        var rawSc = 0.0;
        if (OCR <= 1.001) {
          regime = "NC";
          rawSc = ((Cc * sub.H_m) / (1.0 + e0)) * log10(sigmaVf / sigmaV0Mid) * 1000.0;
        } else if (sigmaVf <= sigmaP) {
          regime = "OC_below";
          rawSc = ((Cr * sub.H_m) / (1.0 + e0)) * log10(sigmaVf / sigmaV0Mid) * 1000.0;
        } else {
          regime = "OC_cross";
          rawSc =
            (sub.H_m / (1.0 + e0)) *
            (Cr * log10(sigmaP / sigmaV0Mid) + Cc * log10(sigmaVf / sigmaP)) *
            1000.0;
        }
        Sc_i = Rf * rawSc;
      }

      totalSe += Se_i;
      totalSc += Sc_i;

      if (includeDetailedBreakdown) {
        var acc = parentAccum[sub.parentIdx];
        acc.sumSigmaV0H += sigmaV0Mid * sub.H_m;
        acc.sumDeltaSigmaH += deltaSigmaZ * sub.H_m;
        acc.Se_i += Se_i;
        acc.Sc_i += Sc_i;

        if (sub.isConsolidating) {
          var ratioSub = deltaSigmaZ / sigmaV0Mid;
          if (ratioSub > acc.maxStressRatio) {
            acc.maxStressRatio = ratioSub;
          }
          if (regime === "NC") acc.sawNC = true;
          else if (regime === "OC_below") acc.sawOCBelow = true;
          else if (regime === "OC_cross") acc.sawOCCross = true;
        }
      }
    }

    var layerBreakdown = [];
    if (includeDetailedBreakdown) {
      for (var p = 0; p < parentAccum.length; p++) {
        var pa = parentAccum[p];
        var regimeLabel = "Granular (Elastic Only)";
        if (pa.isConsolidating) {
          if (pa.sawOCCross) {
            regimeLabel = "OC (Crosses σ'_p)";
          } else if (pa.sawOCBelow && !pa.sawNC) {
            regimeLabel = "OC (σ'_vf ≤ σ'_p)";
          } else {
            regimeLabel = "Normally Consolidated";
          }
        }

        layerBreakdown.push({
          layerIndex: pa.layerIndex,
          soilType: pa.soilType,
          isConsolidating: pa.isConsolidating,
          consolidationRegime: regimeLabel,
          z_top: pa.z_top,
          z_bot: pa.z_bot,
          thickness_m: pa.thickness_m,
          subLayerCount: pa.subLayerCount,
          sigma_v0_kPa: pa.sumSigmaV0H / pa.thickness_m,
          delta_sigma_z: pa.sumDeltaSigmaH / pa.thickness_m,
          E_prime_kPa: pa.E_prime_kPa,
          nu_prime: pa.nu_prime,
          e0: pa.e0,
          Cc: pa.Cc,
          Cr: pa.Cr,
          OCR: pa.OCR,
          cv: pa.cv,
          Se_i: pa.Se_i,
          Sc_i: pa.Sc_i,
          Stot_i: pa.Se_i + pa.Sc_i
        });
      }
    }

    return {
      elasticSettlement_mm: totalSe,
      consolidationSettlement_mm: totalSc,
      totalSettlement_mm: totalSe + totalSc,
      layerBreakdown: layerBreakdown,
      maxClayStressRatio: maxClayStressRatio,
      elasticDiagnostics: {
        mu_0: mu_0,
        zElasticLimit: zElasticLimit,
        z_peak: z_peak,
        z_max: z_max,
        Iz0: Iz0,
        Izp: Izp,
        C1: C1,
        C2: C2,
        sigma_vp: sigma_vp
      }
    };
  }

  /**
   * Validates inputs and computes foundation immediate elastic settlement,
   * 1D primary consolidation settlement, stress profile, time-rate curve,
   * and load sensitivity curve per IS 8009 (Part 1):1976 and IS 1904:1986.
   *
   * Never mutates caller objects or arrays.
   *
   * @param {Object} p4Input Settlement inputs from window.GeotechState.p4Input.
   * @param {Array<Object>} processedLayers Validated Module P1 layers.
   * @param {number} zwMeasured Measured water table depth (m bgl).
   * @param {number} zwDesign Design water table depth (m bgl).
   * @param {number} [gammaW] Unit weight of water (kN/m³, defaults to 9.81).
   * @returns {Object} Structured results matching window.GeotechState.p4Results.
   */
  function computeSettlement(p4Input, processedLayers, zwMeasured, zwDesign, gammaW) {
    var errors = [];
    var warnings = [];
    var gw = resolveGammaW(gammaW);

    function makeErrorReturn(errList, allowLimit) {
      return {
        status: "error",
        elasticSettlement_mm: 0.0,
        consolidationSettlement_mm: 0.0,
        totalSettlement_mm: 0.0,
        allowableSettlement_mm: isFiniteNumber(allowLimit) && allowLimit > 0 ? allowLimit : 50.0,
        isSafeSettlement: false,
        layerBreakdown: [],
        stressProfile: [],
        timeRateCurve: [],
        timeRateSummary: null,
        settlementVsLoadCurve: [],
        steps: [],
        warnings: [],
        errors: errList,
        meta: null
      };
    }

    if (!p4Input || typeof p4Input !== "object") {
      return makeErrorReturn(["Module P4 input object is missing or invalid."], 50.0);
    }

    // -------------------------------------------------------------------------
    // A. Input & Stratigraphy Validation
    // -------------------------------------------------------------------------
    var footingType = p4Input.footingType;
    var shape = p4Input.shape;
    var B_m = p4Input.B_m;
    var L_m = p4Input.L_m;
    var Df_m = p4Input.Df_m;
    var appliedLoad_kN = p4Input.appliedLoad_kN;
    var contactStress_kPa = p4Input.contactStress_kPa;
    var loadInputMode = p4Input.loadInputMode;
    var waterTableMode = p4Input.waterTableMode || "Design";
    var stressDistributionMethod = p4Input.stressDistributionMethod;
    var elasticMethod = p4Input.elasticMethod;
    var poissonRatioDefault = p4Input.poissonRatioDefault;
    var allowableSettlement_mm = isFiniteNumber(p4Input.allowableSettlement_mm)
      ? p4Input.allowableSettlement_mm
      : 50.0;
    var overrideSoilParams = Boolean(p4Input.overrideSoilParams);
    var consolidationSubdivision_m = p4Input.consolidationSubdivision_m;
    var timeRateCalc = Boolean(p4Input.timeRateCalc);
    var drainageCondition = p4Input.drainageCondition;
    var targetTime_days = p4Input.targetTime_days;

    if (FOOTING_TYPES.indexOf(footingType) === -1) {
      errors.push("Invalid footingType '" + String(footingType) + "'. Must be one of: " + FOOTING_TYPES.join(", ") + ".");
    }
    if (FOOTING_SHAPES.indexOf(shape) === -1) {
      errors.push("Invalid footing shape '" + String(shape) + "'. Must be one of: " + FOOTING_SHAPES.join(", ") + ".");
    }
    if (LOAD_INPUT_MODES.indexOf(loadInputMode) === -1) {
      errors.push("Invalid loadInputMode '" + String(loadInputMode) + "'. Must be one of: " + LOAD_INPUT_MODES.join(", ") + ".");
    }
    if (WATER_TABLE_MODES.indexOf(waterTableMode) === -1) {
      errors.push("Invalid waterTableMode '" + String(waterTableMode) + "'. Must be one of: " + WATER_TABLE_MODES.join(", ") + ".");
    }
    if (STRESS_METHODS.indexOf(stressDistributionMethod) === -1) {
      errors.push("Invalid stressDistributionMethod '" + String(stressDistributionMethod) + "'. Must be one of: " + STRESS_METHODS.join(", ") + ".");
    }
    if (ELASTIC_METHODS.indexOf(elasticMethod) === -1) {
      errors.push("Invalid elasticMethod '" + String(elasticMethod) + "'. Must be one of: " + ELASTIC_METHODS.join(", ") + ".");
    }
    if (DRAINAGE_CONDITIONS.indexOf(drainageCondition) === -1) {
      errors.push("Invalid drainageCondition '" + String(drainageCondition) + "'. Must be one of: " + DRAINAGE_CONDITIONS.join(", ") + ".");
    }

    if (!isFiniteNumber(B_m) || !(B_m > 0)) {
      errors.push("Footing width/diameter B_m must be a finite number > 0 m.");
    }
    if (!isFiniteNumber(Df_m) || Df_m < 0) {
      errors.push("Embedment depth Df_m must be a finite number ≥ 0 m.");
    }
    if (!isFiniteNumber(p4Input.allowableSettlement_mm) && p4Input.allowableSettlement_mm !== undefined) {
      errors.push("Allowable settlement limit allowableSettlement_mm must be a finite number > 0 mm.");
    } else if (!(allowableSettlement_mm > 0)) {
      errors.push("Allowable settlement limit allowableSettlement_mm must be > 0 mm.");
    }
    if (!isFiniteNumber(poissonRatioDefault) || poissonRatioDefault < 0.0 || poissonRatioDefault > 0.49) {
      errors.push("Default Poisson's ratio poissonRatioDefault must satisfy 0.00 ≤ ν ≤ 0.49.");
    }
    if (
      !isFiniteNumber(consolidationSubdivision_m) ||
      consolidationSubdivision_m < 0.1 ||
      consolidationSubdivision_m > 0.5
    ) {
      errors.push("Sub-layer discretization consolidationSubdivision_m must be between 0.10 m and 0.50 m.");
    }
    if (!isFiniteNumber(targetTime_days) || !(targetTime_days > 0)) {
      errors.push("Target consolidation time targetTime_days must be a finite number > 0 days.");
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
            " m)."
        );
      }
    }

    if (loadInputMode === "Stress") {
      if (!isFiniteNumber(contactStress_kPa) || !(contactStress_kPa > 0)) {
        errors.push("Net applied contact stress contactStress_kPa must be a finite number > 0 kPa.");
      }
    } else if (loadInputMode === "Total Load") {
      if (!isFiniteNumber(appliedLoad_kN) || !(appliedLoad_kN > 0)) {
        errors.push("Net applied service load appliedLoad_kN must be a finite number > 0 kN.");
      }
    }

    var zw = waterTableMode === "Measured" ? zwMeasured : zwDesign;
    if (!isFiniteNumber(zw) || zw < 0) {
      errors.push("Active water table depth (" + String(waterTableMode) + ") must be a finite number ≥ 0 m.");
    }

    // Active soil layer selection & validation
    var rawLayers = overrideSoilParams ? p4Input.manualSoilLayers : processedLayers;
    var sortedLayers = [];

    if (!Array.isArray(rawLayers) || rawLayers.length === 0) {
      errors.push(
        overrideSoilParams
          ? "Manual soil override is enabled, but manualSoilLayers is empty. Add at least one layer or disable override."
          : "No valid Module P1 soil profile is available. Resolve Module P1 validation errors first."
      );
    } else {
      sortedLayers = rawLayers.slice().sort(function (a, b) {
        return a.z_top - b.z_top;
      });

      for (var li = 0; li < sortedLayers.length; li++) {
        var lyr = sortedLayers[li] || {};
        var tag = "Soil Layer " + (li + 1) + ": ";
        if (!isFiniteNumber(lyr.z_top) || !isFiniteNumber(lyr.z_bot) || lyr.z_bot <= lyr.z_top) {
          errors.push(tag + "Invalid depth interval (z_bot must exceed z_top).");
        }
        if (li > 0 && isFiniteNumber(lyr.z_top) && isFiniteNumber(sortedLayers[li - 1].z_bot)) {
          var gap = lyr.z_top - sortedLayers[li - 1].z_bot;
          if (Math.abs(gap) > BOUNDARY_TOL_M) {
            errors.push(
              tag +
                (gap > 0 ? "Depth gap" : "Depth overlap") +
                " detected between Layer " +
                li +
                " bottom (" +
                sortedLayers[li - 1].z_bot.toFixed(2) +
                " m) and Layer " +
                (li + 1) +
                " top (" +
                lyr.z_top.toFixed(2) +
                " m)."
            );
          }
        }
        if (!isFiniteNumber(lyr.gamma_moist) || !(lyr.gamma_moist > 0)) {
          errors.push(tag + "gamma_moist must be > 0 kN/m³.");
        }
        if (
          !isFiniteNumber(lyr.gamma_sat) ||
          (isFiniteNumber(lyr.gamma_moist) && lyr.gamma_sat < lyr.gamma_moist)
        ) {
          errors.push(tag + "gamma_sat must be ≥ gamma_moist.");
        } else if (lyr.gamma_sat <= gw) {
          errors.push(
            tag +
              "gamma_sat (" +
              lyr.gamma_sat.toFixed(2) +
              " kN/m³) must exceed γ_w (" +
              gw.toFixed(2) +
              " kN/m³) so submerged unit weight γ' > 0."
          );
        }
        if (!isFiniteNumber(lyr.E_prime) || !(lyr.E_prime > 0)) {
          errors.push(tag + "Drained modulus E_prime must be > 0 kPa.");
        }
        if (isLayerConsolidating(lyr)) {
          if (!isFiniteNumber(lyr.e0) || !(lyr.e0 > 0)) {
            errors.push(tag + "Consolidating stratum requires initial void ratio e0 > 0.");
          }
          if (!isFiniteNumber(lyr.Cc) || lyr.Cc < 0) {
            errors.push(tag + "Consolidating stratum requires compression index Cc ≥ 0.");
          }
          if (!isFiniteNumber(lyr.Cr) || lyr.Cr < 0) {
            errors.push(tag + "Consolidating stratum requires recompression index Cr ≥ 0.");
          }
          if (isFiniteNumber(lyr.Cr) && isFiniteNumber(lyr.Cc) && lyr.Cr > lyr.Cc + 1e-9) {
            warnings.push(
              tag +
                "Recompression index Cr (" +
                lyr.Cr.toFixed(3) +
                ") exceeds virgin compression index Cc (" +
                lyr.Cc.toFixed(3) +
                "); verify laboratory consolidation curve parameters."
            );
          }
          if (!isFiniteNumber(lyr.OCR) || lyr.OCR < 1.0) {
            errors.push(tag + "Consolidating stratum requires OCR ≥ 1.0.");
          }
          if (timeRateCalc && (!isFiniteNumber(lyr.cv) || !(lyr.cv > 0))) {
            errors.push(tag + "Consolidating stratum requires cv > 0 mm²/s for time-rate analysis.");
          }
        }
      }

      if (errors.length === 0) {
        var deepestZ = sortedLayers[sortedLayers.length - 1].z_bot;
        if (isFiniteNumber(Df_m) && deepestZ <= Df_m + DEPTH_TOL_M) {
          errors.push(
            "Deepest soil stratum bottom (" +
              deepestZ.toFixed(2) +
              " m) must exceed footing embedment depth D_f (" +
              Df_m.toFixed(2) +
              " m)."
          );
        }
      }
    }

    if (errors.length > 0) {
      return makeErrorReturn(errors, allowableSettlement_mm);
    }

    // -------------------------------------------------------------------------
    // B. Net Contact Stress q0 (kPa), Footprint Area A & Rigidity Factor Rf
    // -------------------------------------------------------------------------
    var A_m2 = 0.0;
    var L_eff = B_m;
    var loadUnit = "kN";
    var areaUnit = "m²";

    if (shape === "Rectangular") {
      A_m2 = B_m * L_m;
      L_eff = L_m;
    } else if (shape === "Square") {
      A_m2 = B_m * B_m;
      L_eff = B_m;
    } else if (shape === "Circular") {
      var R_m = B_m / 2.0;
      A_m2 = Math.PI * R_m * R_m;
      L_eff = B_m;
    } else {
      // Strip footing per unit metre run
      A_m2 = B_m;
      L_eff = Infinity;
      loadUnit = "kN/m";
      areaUnit = "m²/m";
    }

    var q0 = loadInputMode === "Stress" ? contactStress_kPa : appliedLoad_kN / A_m2;
    var Q_net = loadInputMode === "Stress" ? q0 * A_m2 : appliedLoad_kN;

    // Source: IS 8009 (Part 1):1976 Cl. 9.2.2 & Cl. 9.4 — Rigidity factor Rf = 0.80
    var Rf = footingType === "Rigid" ? 0.80 : 1.00;

    // -------------------------------------------------------------------------
    // C, D, E. Discretize Sub-Layers & Evaluate Elastic + Consolidation Settlement
    // -------------------------------------------------------------------------
    var maxProfileDepth = sortedLayers[sortedLayers.length - 1].z_bot;
    var discretization = buildSubLayersBelowDf(sortedLayers, Df_m, consolidationSubdivision_m);

    var ctx = {
      p4Input: Object.assign({}, p4Input, {
        waterTableMode: waterTableMode,
        allowableSettlement_mm: allowableSettlement_mm
      }),
      sortedLayers: sortedLayers,
      subLayers: discretization.subLayers,
      parentMeta: discretization.parentMeta,
      L_eff: L_eff,
      Rf: Rf,
      zw: zw,
      gw: gw,
      maxProfileDepth: maxProfileDepth
    };

    var primary = evaluateSettlementAtStress(q0, ctx, true);
    var elasticSettlement_mm = primary.elasticSettlement_mm;
    var consolidationSettlement_mm = primary.consolidationSettlement_mm;
    var totalSettlement_mm = primary.totalSettlement_mm;
    var layerBreakdown = primary.layerBreakdown;

    // -------------------------------------------------------------------------
    // F. Total Settlement & IS 1904:1986 Serviceability Check + Warnings
    // -------------------------------------------------------------------------
    var isSafeSettlement = totalSettlement_mm <= allowableSettlement_mm + 1e-6;

    if (!isSafeSettlement) {
      warnings.push(
        "Total settlement (" +
          totalSettlement_mm.toFixed(2) +
          " mm) exceeds IS 1904:1986 allowable limit (" +
          allowableSettlement_mm.toFixed(1) +
          " mm) by " +
          (totalSettlement_mm - allowableSettlement_mm).toFixed(2) +
          " mm. Consider widening the footing, reducing net pressure, or ground improvement."
      );
    }

    if (Df_m + 2.0 * B_m > maxProfileDepth + DEPTH_TOL_M) {
      warnings.push(
        "Significant influence zone (D_f + 2B = " +
          (Df_m + 2.0 * B_m).toFixed(2) +
          " m) extends deeper than the bottom of the defined soil profile (" +
          maxProfileDepth.toFixed(2) +
          " m). Extend stratigraphy in Module P1 for complete bulb coverage."
      );
    }

    if (primary.maxClayStressRatio > 2.0) {
      warnings.push(
        "High stress increment ratio in cohesive stratum (max Δσ_z / σ'_v0 = " +
          primary.maxClayStressRatio.toFixed(2) +
          " > 2.00): verify bearing capacity safety factor and non-linear soft-clay behavior."
      );
    }

    var hasConsolidatingStratum = false;
    for (var cb = 0; cb < layerBreakdown.length; cb++) {
      if (layerBreakdown[cb].isConsolidating) {
        hasConsolidatingStratum = true;
        break;
      }
    }
    if (!hasConsolidatingStratum) {
      warnings.push(
        "No consolidating cohesive stratum exists below D_f = " +
          Df_m.toFixed(2) +
          " m: 1D primary consolidation settlement S_c = 0.00 mm (immediate elastic settlement governs)."
      );
    }

    // -------------------------------------------------------------------------
    // G. Time-Rate of Consolidation (Terzaghi 1D Theory)
    // -------------------------------------------------------------------------
    var timeRateCurve = [];
    var timeRateSummary = null;

    if (timeRateCalc && consolidationSettlement_mm > 1e-9) {
      // Identify governing consolidating stratum below Df (highest Sc_i contribution)
      var govLayer = null;
      for (var gIdx = 0; gIdx < layerBreakdown.length; gIdx++) {
        var cand = layerBreakdown[gIdx];
        if (cand.isConsolidating && cand.Sc_i > 0 && isFiniteNumber(cand.cv) && cand.cv > 0) {
          if (!govLayer || cand.Sc_i > govLayer.Sc_i) {
            govLayer = cand;
          }
        }
      }

      if (govLayer) {
        var H_clay_m = govLayer.thickness_m;
        var Hd_m = drainageCondition === "Double" ? H_clay_m / 2.0 : H_clay_m;
        var Hd_mm = Hd_m * 1000.0;
        var cv_mm2_s = govLayer.cv;

        var Tv_target = (cv_mm2_s * targetTime_days * SECONDS_PER_DAY) / (Hd_mm * Hd_mm);
        var Ut_target = computeDegreeOfConsolidation(Tv_target);
        var Sc_t_target_mm = Ut_target * consolidationSettlement_mm;
        var St_target_mm = elasticSettlement_mm + Sc_t_target_mm;

        // Source: Terzaghi (1943) — Tv(50%) = 0.197, Tv(90%) = 0.848
        var t50_days = (0.197 * Hd_mm * Hd_mm) / (cv_mm2_s * SECONDS_PER_DAY);
        var t90_days = (0.848 * Hd_mm * Hd_mm) / (cv_mm2_s * SECONDS_PER_DAY);

        var tMin = Math.min(1.0, Math.max(0.05, targetTime_days * 0.5));
        var tMax = Math.max(targetTime_days * 1.5, t90_days * 2.0, 365.0);
        var nTimePts = 25;
        var logMin = Math.log(tMin);
        var logMax = Math.log(tMax);

        for (var ti = 0; ti < nTimePts; ti++) {
          var fracT = nTimePts > 1 ? ti / (nTimePts - 1) : 0.0;
          var t_days = Math.exp(logMin + fracT * (logMax - logMin));
          var Tv = (cv_mm2_s * t_days * SECONDS_PER_DAY) / (Hd_mm * Hd_mm);
          var Ut = computeDegreeOfConsolidation(Tv);
          var Sc_t_mm = Ut * consolidationSettlement_mm;
          timeRateCurve.push({
            t_days: t_days,
            t_yr: t_days / DAYS_PER_YEAR,
            Tv: Tv,
            Ut_pct: Ut * 100.0,
            Sc_t_mm: Sc_t_mm,
            St_mm: elasticSettlement_mm + Sc_t_mm
          });
        }

        timeRateSummary = {
          governingLayerName: "L" + govLayer.layerIndex + " · " + govLayer.soilType,
          governingLayerIndex: govLayer.layerIndex,
          H_clay_m: H_clay_m,
          Hd_m: Hd_m,
          cv: cv_mm2_s,
          drainageCondition: drainageCondition,
          targetTime_days: targetTime_days,
          Tv_target: Tv_target,
          Ut_target_pct: Ut_target * 100.0,
          Sc_t_target_mm: Sc_t_target_mm,
          St_target_mm: St_target_mm,
          t50_days: t50_days,
          t90_days: t90_days
        };
      }
    }

    // -------------------------------------------------------------------------
    // H. Depth Stress Profile (25 pts) & Load Sensitivity Curve (9 pts)
    // -------------------------------------------------------------------------
    var stressProfile = [];
    var nDepthPts = 25;
    for (var di = 0; di < nDepthPts; di++) {
      var dFrac = nDepthPts > 1 ? di / (nDepthPts - 1) : 0.0;
      var z_m = Df_m + dFrac * (maxProfileDepth - Df_m);
      var z_below = z_m - Df_m;
      var lyrAtZ = findLayerAtDepth(z_m, sortedLayers);
      var nuAtZ = lyrAtZ && isFiniteNumber(lyrAtZ.nu_prime) ? lyrAtZ.nu_prime : poissonRatioDefault;

      var iAtZ = computeStressInfluence(z_below, shape, B_m, L_eff, stressDistributionMethod, nuAtZ);
      var dSigAtZ = q0 * iAtZ;
      var sigV0AtZ = sigmaV0AtDepth(z_m, sortedLayers, zw, gw);

      stressProfile.push({
        z_m: z_m,
        z_below_base_m: z_below,
        sigma_v0_kPa: sigV0AtZ,
        delta_sigma_z_kPa: dSigAtZ,
        sigma_vf_kPa: sigV0AtZ + dSigAtZ,
        influenceFactor_I: iAtZ
      });
    }

    var settlementVsLoadCurve = [];
    var nLoadPts = 9;
    var qMin = 0.25 * q0;
    var qMax = 2.0 * q0;
    for (var qi = 0; qi < nLoadPts; qi++) {
      var qFrac = nLoadPts > 1 ? qi / (nLoadPts - 1) : 0.0;
      var trialQ0 = qMin + qFrac * (qMax - qMin);
      var trialOut = evaluateSettlementAtStress(trialQ0, ctx, false);
      settlementVsLoadCurve.push({
        q0_kPa: trialQ0,
        Se_mm: trialOut.elasticSettlement_mm,
        Sc_mm: trialOut.consolidationSettlement_mm,
        Stot_mm: trialOut.totalSettlement_mm
      });
    }

    // -------------------------------------------------------------------------
    // I. Step-by-Step Engineering Audit Trail (7 concise numbered strings)
    // -------------------------------------------------------------------------
    var steps = [];
    var dimSummary =
      shape === "Rectangular"
        ? "B = " + B_m.toFixed(2) + " m × L = " + L_m.toFixed(2) + " m"
        : shape === "Strip"
          ? "B = " + B_m.toFixed(2) + " m (Strip, per m run)"
          : "B = " + B_m.toFixed(2) + " m (" + shape + ")";

    steps.push(
      "1. Footing Geometry & Net Applied Stress (IS 8009 Part 1:1976): " +
        dimSummary +
        ", D_f = " +
        Df_m.toFixed(2) +
        " m, A = " +
        A_m2.toFixed(2) +
        " " +
        areaUnit +
        "; q_0 = " +
        q0.toFixed(2) +
        " kPa (Q_net = " +
        Q_net.toFixed(1) +
        " " +
        loadUnit +
        "), Rigidity Factor R_f = " +
        Rf.toFixed(2) +
        " (" +
        footingType +
        ", Cl. 9.4 applied to S_e & S_c)."
    );

    var sigmaV0Base = sigmaV0AtDepth(Df_m, sortedLayers, zw, gw);
    steps.push(
      "2. Groundwater & In-Situ Overburden: Active " +
        waterTableMode +
        " WT at z_w = " +
        zw.toFixed(2) +
        " m (γ_w = " +
        gw.toFixed(2) +
        " kN/m³) → σ'_v0(D_f) = " +
        sigmaV0Base.toFixed(2) +
        " kPa; profile discretized into " +
        discretization.subLayers.length +
        " sub-layers (≤ " +
        consolidationSubdivision_m.toFixed(2) +
        " m) across [" +
        Df_m.toFixed(2) +
        "–" +
        maxProfileDepth.toFixed(2) +
        " m]."
    );

    var refDepth = Math.min(maxProfileDepth, Df_m + B_m);
    var refLyr = findLayerAtDepth(refDepth, sortedLayers);
    var refNu = refLyr && isFiniteNumber(refLyr.nu_prime) ? refLyr.nu_prime : poissonRatioDefault;
    var iRef = computeStressInfluence(
      refDepth - Df_m,
      shape,
      B_m,
      L_eff,
      stressDistributionMethod,
      refNu
    );
    steps.push(
      "3. Vertical Stress Dispersion (" +
        stressDistributionMethod +
        "): At reference depth z = " +
        refDepth.toFixed(2) +
        " m (z' = " +
        (refDepth - Df_m).toFixed(2) +
        " m below base), I_σ = " +
        iRef.toFixed(3) +
        " → Δσ_z = " +
        (q0 * iRef).toFixed(2) +
        " kPa."
    );

    var diag = primary.elasticDiagnostics;
    if (elasticMethod === "IS 8009 / Janbu") {
      steps.push(
        "4. Immediate Elastic Settlement (IS 8009 / Janbu): Depth factor μ_0 = " +
          diag.mu_0.toFixed(3) +
          ", R_f = " +
          Rf.toFixed(2) +
          ", integrated down to z = " +
          diag.zElasticLimit.toFixed(2) +
          " m (D_f + 4B) → S_e = " +
          elasticSettlement_mm.toFixed(2) +
          " mm."
      );
    } else {
      steps.push(
        "4. Immediate Elastic Settlement (Schmertmann, 1978): C_1 = " +
          diag.C1.toFixed(3) +
          ", C_2(" +
          (targetTime_days / DAYS_PER_YEAR).toFixed(2) +
          " yr) = " +
          diag.C2.toFixed(3) +
          ", R_f = " +
          Rf.toFixed(2) +
          ", I_zp = " +
          diag.Izp.toFixed(3) +
          " at z_p = " +
          diag.z_peak.toFixed(2) +
          " m (z_max = " +
          diag.z_max.toFixed(2) +
          " m) → S_e = " +
          elasticSettlement_mm.toFixed(2) +
          " mm."
      );
    }

    var consNames = layerBreakdown
      .filter(function (lb) {
        return lb.isConsolidating;
      })
      .map(function (lb) {
        return "L" + lb.layerIndex + " (" + lb.Sc_i.toFixed(2) + " mm)";
      });
    steps.push(
      "5. 1D Primary Consolidation Settlement (Terzaghi, 1943 / IS 8009 Cl. 10 & Cl. 9.4): " +
        (consNames.length > 0
          ? "Consolidating strata " +
            consNames.join(", ") +
            " (R_f = " +
            Rf.toFixed(2) +
            ") → S_c = " +
            consolidationSettlement_mm.toFixed(2) +
            " mm."
          : "No cohesive consolidating strata below D_f → S_c = 0.00 mm.")
    );

    steps.push(
      "6. Total Settlement & Serviceability Check (IS 1904:1986 Table 1): S_tot = S_e + S_c = " +
        elasticSettlement_mm.toFixed(2) +
        " + " +
        consolidationSettlement_mm.toFixed(2) +
        " = " +
        totalSettlement_mm.toFixed(2) +
        " mm vs. S_allow = " +
        allowableSettlement_mm.toFixed(1) +
        " mm → " +
        (isSafeSettlement ? "PASS (Within Limit)." : "EXCEEDS LIMIT.")
    );

    if (timeRateSummary) {
      steps.push(
        "7. Time-Rate of Consolidation (" +
          timeRateSummary.governingLayerName +
          ", " +
          timeRateSummary.drainageCondition +
          " Drainage): H_d = " +
          timeRateSummary.Hd_m.toFixed(2) +
          " m, c_v = " +
          timeRateSummary.cv.toFixed(4) +
          " mm²/s → t_50 = " +
          timeRateSummary.t50_days.toFixed(1) +
          " days (" +
          (timeRateSummary.t50_days / DAYS_PER_YEAR).toFixed(2) +
          " yr), t_90 = " +
          timeRateSummary.t90_days.toFixed(1) +
          " days (" +
          (timeRateSummary.t90_days / DAYS_PER_YEAR).toFixed(2) +
          " yr); at t = " +
          timeRateSummary.targetTime_days.toFixed(0) +
          " days, U(t) = " +
          timeRateSummary.Ut_target_pct.toFixed(1) +
          "% and S(t) = " +
          timeRateSummary.St_target_mm.toFixed(2) +
          " mm."
      );
    } else {
      steps.push(
        "7. Time-Rate of Consolidation: " +
          (!timeRateCalc
            ? "Disabled by user configuration."
            : "Not applicable because primary consolidation settlement S_c = 0.00 mm.")
      );
    }

    return {
      status: "computed",
      elasticSettlement_mm: elasticSettlement_mm,
      consolidationSettlement_mm: consolidationSettlement_mm,
      totalSettlement_mm: totalSettlement_mm,
      allowableSettlement_mm: allowableSettlement_mm,
      isSafeSettlement: isSafeSettlement,
      layerBreakdown: layerBreakdown,
      stressProfile: stressProfile,
      timeRateCurve: timeRateCurve,
      timeRateSummary: timeRateSummary,
      settlementVsLoadCurve: settlementVsLoadCurve,
      steps: steps,
      warnings: warnings,
      errors: [],
      meta: {
        q0_kPa: q0,
        Q_net: Q_net,
        loadUnit: loadUnit,
        A_m2: A_m2,
        areaUnit: areaUnit,
        Rf: Rf,
        zw_m: zw,
        waterTableMode: waterTableMode,
        footingType: footingType,
        shape: shape,
        stressDistributionMethod: stressDistributionMethod,
        elasticMethod: elasticMethod,
        subLayerCount: discretization.subLayers.length,
        elasticDiagnostics: diag
      }
    };
  }

  // Expose frozen constants, audit helpers, and core settlement engine on window.ModuleP4Logic
  global.ModuleP4Logic = Object.freeze({
    FOOTING_TYPES: FOOTING_TYPES,
    FOOTING_SHAPES: FOOTING_SHAPES,
    LOAD_INPUT_MODES: LOAD_INPUT_MODES,
    WATER_TABLE_MODES: WATER_TABLE_MODES,
    STRESS_METHODS: STRESS_METHODS,
    ELASTIC_METHODS: ELASTIC_METHODS,
    DRAINAGE_CONDITIONS: DRAINAGE_CONDITIONS,
    computeStressInfluence: computeStressInfluence,
    computeDegreeOfConsolidation: computeDegreeOfConsolidation,
    computeSettlement: computeSettlement
  });
})(window);