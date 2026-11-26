/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P1 Pure Calculation & Validation Engine: window.ModuleP1Logic
 * ==============================================================================
 * Strict SI Units: Force (kN), Stress/Modulus (kPa), Depth/Thickness (m),
 * Settlement (mm), Unit Weight (kN/m³), Consolidation Coefficient (mm²/s).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", zero DOM or ES module dependencies).
 */

(function initModuleP1Logic(global) {
  "use strict";

  // Source: Terzaghi, Peck, & Mesri (1996), "Soil Mechanics in Engineering Practice",
  // 3rd Ed., Wiley — Standard freshwater unit weight: 1.000 Mg/m³ * 9.81 m/s² = 9.81 kN/m³.
  var DEFAULT_GAMMA_W = 9.81;

  // Source: ASTM D2487 (USCS) & BS 5930 / ISO 14688 visual lithology palette
  // using muted fill colors, dark borders, and concise codes for Plotly charts.
  var SOIL_STYLES = Object.freeze({
    "Clay (CL/CH)": Object.freeze({
      code: "CL/CH",
      fillColor: "#d98880",
      borderColor: "#78281f"
    }),
    "Silt (ML/MH)": Object.freeze({
      code: "ML/MH",
      fillColor: "#f5cba7",
      borderColor: "#7e5109"
    }),
    "Sand (SW/SP)": Object.freeze({
      code: "SW/SP",
      fillColor: "#f9e79f",
      borderColor: "#7d6608"
    }),
    "Gravel (GW/GP)": Object.freeze({
      code: "GW/GP",
      fillColor: "#ccd1d1",
      borderColor: "#424949"
    }),
    "Peat (Pt)": Object.freeze({
      code: "Pt",
      fillColor: "#a06235",
      borderColor: "#4a230a"
    }),
    "Rock / Bedrock": Object.freeze({
      code: "RK",
      fillColor: "#85929e",
      borderColor: "#2c3e50"
    })
  });

  // Ordered USCS categories for UI dropdown selection
  // Source: ASTM D2487 (Standard Practice for Classification of Soils for Engineering Purposes)
  var SOIL_TYPES = Object.freeze([
    "Clay (CL/CH)",
    "Silt (ML/MH)",
    "Sand (SW/SP)",
    "Gravel (GW/GP)",
    "Peat (Pt)",
    "Rock / Bedrock"
  ]);

  // Exact numeric fields expected on each layer object from js/state.js
  var NUMERIC_FIELDS = [
    "z_top",
    "z_bot",
    "gamma_moist",
    "gamma_sat",
    "su",
    "c_prime",
    "phi_prime",
    "E_prime",
    "nu_prime",
    "e0",
    "Cc",
    "Cr",
    "OCR",
    "cv"
  ];

  // Tolerance (m) for ground-surface datum and layer-to-layer continuity checks
  // Source: EN 1997-2 (Eurocode 7: Ground Investigation and Testing), Section 2.4
  var DEPTH_TOL_M = 1e-3;

  /**
   * Resolves the unit weight of water (kN/m³) from an explicit argument,
   * falling back to window.GeotechState.gamma_w and finally 9.81 kN/m³.
   * Source: Terzaghi, Peck, & Mesri (1996).
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
   * Checks whether every required numeric property on a layer is a finite number.
   * Returns an array of missing or non-finite field names.
   */
  function findInvalidNumericFields(layer) {
    var invalid = [];
    for (var i = 0; i < NUMERIC_FIELDS.length; i++) {
      var key = NUMERIC_FIELDS[i];
      var val = layer[key];
      // Reject booleans, null, undefined, NaN, +/-Infinity, or non-finite values
      if (typeof val !== "number" || !Number.isFinite(val)) {
        invalid.push(key);
      }
    }
    return invalid;
  }

  /**
   * Validates a stratigraphic profile and computes derived SI geotechnical
   * parameters without mutating the input array.
   *
   * @param {Array<Object>} layers - Array of raw layer objects.
   * @param {number} [gammaW] - Unit weight of water in kN/m³ (default 9.81).
   * @returns {{ processedLayers: Array<Object>, errors: Array<string> }}
   */
  function validateAndProcessProfile(layers, gammaW) {
    var errors = [];
    var processedLayers = [];
    var gw = resolveGammaW(gammaW);

    // Rule 1: At least one soil layer must exist.
    // Source: EN 1997-1 (Eurocode 7), Clause 2.4.2 (Geotechnical design sections)
    if (!Array.isArray(layers) || layers.length === 0) {
      errors.push("At least one soil layer must be defined in the stratigraphic profile.");
      return { processedLayers: processedLayers, errors: errors };
    }

    // Shallow copy and sort ascending by z_top without mutating caller's array
    // Source: EN 1997-2, Section 2.4 (Stratigraphic sequence from ground surface)
    var sortedLayers = layers.slice().sort(function (a, b) {
      var aTop = typeof a.z_top === "number" && Number.isFinite(a.z_top) ? a.z_top : Number.POSITIVE_INFINITY;
      var bTop = typeof b.z_top === "number" && Number.isFinite(b.z_top) ? b.z_top : Number.POSITIVE_INFINITY;
      return aTop - bTop;
    });

    for (var i = 0; i < sortedLayers.length; i++) {
      var raw = sortedLayers[i] || {};
      var layerNum = i + 1;
      var prefix = "Layer " + layerNum + (raw.soilType ? " (" + raw.soilType + ")" : "") + ": ";

      // Rule 2: Every required numeric field must be a finite number.
      var badFields = findInvalidNumericFields(raw);
      if (badFields.length > 0) {
        errors.push(
          prefix + "Invalid or non-finite numeric value(s) in field(s): " + badFields.join(", ") + "."
        );
        continue;
      }

      var zTop = raw.z_top;
      var zBot = raw.z_bot;
      var gammaMoist = raw.gamma_moist;
      var gammaSat = raw.gamma_sat;
      var su = raw.su;
      var cPrime = raw.c_prime;
      var phiPrime = raw.phi_prime;
      var ePrime = raw.E_prime;
      var nuPrime = raw.nu_prime;
      var e0 = raw.e0;
      var cc = raw.Cc;
      var cr = raw.Cr;
      var ocr = raw.OCR;
      var cv = raw.cv;

      // Rule 3: First layer must start at ground surface (|z_top - 0.0| <= 1e-3 m).
      // Source: Standard Geotechnical Datum Convention (z = 0.0 m at ground surface)
      if (i === 0 && Math.abs(zTop - 0.0) > DEPTH_TOL_M) {
        errors.push(
          prefix + "Top depth of the first layer (z_top = " + zTop.toFixed(3) + " m) must start at ground surface (0.000 m)."
        );
      }

      // Rule 4: Positive layer thickness (H_m = z_bot - z_top > 0).
      // Source: Das & Sobhan (2018), "Principles of Geotechnical Engineering"
      var hM = zBot - zTop;
      if (!(hM > 0)) {
        errors.push(
          prefix + "Bottom depth (" + zBot.toFixed(3) + " m) must be greater than top depth (" + zTop.toFixed(3) + " m) for positive thickness."
        );
      }

      // Rule 5: Stratigraphic continuity between adjacent layers (|z_top[i] - z_bot[i-1]| <= 1e-3 m).
      // Source: EN 1997-2, Section 2.4; Terzaghi, Peck, & Mesri (1996)
      if (i > 0) {
        var prevBot = sortedLayers[i - 1].z_bot;
        if (typeof prevBot === "number" && Number.isFinite(prevBot)) {
          var gapOrOverlap = zTop - prevBot;
          if (Math.abs(gapOrOverlap) > DEPTH_TOL_M) {
            errors.push(
              prefix + "Depth discontinuity detected: z_top (" + zTop.toFixed(3) +
              " m) does not match previous layer z_bot (" + prevBot.toFixed(3) +
              " m; difference = " + gapOrOverlap.toFixed(3) + " m)."
            );
          }
        }
      }

      // Rule 6: Phase relationship validity (gamma_moist > 0 and gamma_sat >= gamma_moist).
      // Source: Das & Sobhan (2018), Chapter 3 (Weight-Volume Relationships; degree of saturation S <= 100%)
      if (!(gammaMoist > 0)) {
        errors.push(prefix + "Moist unit weight gamma_moist (" + gammaMoist + " kN/m³) must be greater than 0.");
      }
      if (gammaSat < gammaMoist) {
        errors.push(
          prefix + "Saturated unit weight gamma_sat (" + gammaSat.toFixed(2) +
          " kN/m³) must be greater than or equal to moist unit weight (" + gammaMoist.toFixed(2) + " kN/m³)."
        );
      }

      // Rule 7: Elastic stability for drained Poisson's ratio (0.0 <= nu_prime < 0.499)
      // to prevent division-by-zero singularity in E_oed when nu' -> 0.5.
      // Source: Timoshenko & Goodier (1970); Bowles (1996), "Foundation Analysis and Design", 5th Ed.
      if (!(nuPrime >= 0.0 && nuPrime < 0.499)) {
        errors.push(
          prefix + "Drained Poisson's ratio nu_prime (" + nuPrime +
          ") must satisfy 0.0 <= nu_prime < 0.499 for elastic stability and finite E_oed."
        );
      }

      // Rule 8: Physical bounds on strength, stiffness, and consolidation parameters.
      // Source: Bowles (1996); Das & Sobhan (2018); Terzaghi, Peck, & Mesri (1996)
      if (!(su >= 0)) {
        errors.push(prefix + "Undrained shear strength su (" + su + " kPa) must be >= 0.");
      }
      if (!(cPrime >= 0)) {
        errors.push(prefix + "Effective cohesion c_prime (" + cPrime + " kPa) must be >= 0.");
      }
      if (!(phiPrime >= 0 && phiPrime <= 60)) {
        errors.push(
          prefix + "Effective friction angle phi_prime (" + phiPrime + " deg) must be between 0 and 60 deg."
        );
      }
      if (!(ePrime > 0)) {
        errors.push(prefix + "Drained Young's modulus E_prime (" + ePrime + " kPa) must be > 0.");
      }
      if (!(e0 > 0)) {
        errors.push(prefix + "Initial void ratio e0 (" + e0 + ") must be > 0.");
      }
      if (!(cc > 0)) {
        errors.push(prefix + "Compression index Cc (" + cc + ") must be > 0.");
      }
      if (!(cr > 0)) {
        errors.push(prefix + "Recompression index Cr (" + cr + ") must be > 0.");
      }
      if (!(ocr >= 1.0)) {
        errors.push(prefix + "Overconsolidation ratio OCR (" + ocr + ") must be >= 1.0.");
      }
      if (!(cv > 0)) {
        errors.push(prefix + "Coefficient of consolidation cv (" + cv + " mm²/s) must be > 0.");
      }

      // Derived Engineering Calculations (computed for every numerically valid layer)
      // Layer thickness in m: H_m = z_bot - z_top
      // Source: EN 1997-1, Section 2.4.2
      var derivedHM = zBot - zTop;

      // Layer thickness in mm for consolidation settlement integration: H_mm = 1000 * H_m
      // Source: SI unit conversion (ISO 80000-1)
      var derivedHMm = 1000.0 * derivedHM;

      // Submerged (buoyant) unit weight: gamma_sub = gamma_sat - gamma_w (kN/m³)
      // Source: Terzaghi (1943), "Theoretical Soil Mechanics" (Archimedes buoyancy in saturated porous media)
      var derivedGammaSub = gammaSat - gw;

      // 1D constrained (oedometer) modulus from isotropic elasticity (kPa):
      // E_oed = [E' * (1 - nu')] / [(1 + nu') * (1 - 2 * nu')]
      // Source: Poulos & Davis (1974), Eq. 2.7; Bowles (1996), Table 2-8
      var derivedEOed =
        (ePrime * (1.0 - nuPrime)) / ((1.0 + nuPrime) * (1.0 - 2.0 * nuPrime));

      // Coefficient of volume compressibility (1/kPa): mv = 1 / E_oed
      // Source: Terzaghi, Peck, & Mesri (1996), Section 16.3 (1D Consolidation Theory)
      var derivedMv = 1.0 / derivedEOed;

      // Build new object preserving all input fields plus exact derived property names
      var processedLayer = {
        soilType: raw.soilType,
        z_top: zTop,
        z_bot: zBot,
        gamma_moist: gammaMoist,
        gamma_sat: gammaSat,
        su: su,
        c_prime: cPrime,
        phi_prime: phiPrime,
        E_prime: ePrime,
        nu_prime: nuPrime,
        e0: e0,
        Cc: cc,
        Cr: cr,
        OCR: ocr,
        cv: cv,
        H_m: derivedHM,
        H_mm: derivedHMm,
        gamma_sub: derivedGammaSub,
        E_oed: derivedEOed,
        mv: derivedMv
      };

      processedLayers.push(processedLayer);
    }

    return {
      processedLayers: processedLayers,
      errors: errors
    };
  }

  // Expose pure calculation engine and lithology constants on window.ModuleP1Logic
  global.ModuleP1Logic = Object.freeze({
    SOIL_STYLES: SOIL_STYLES,
    SOIL_TYPES: SOIL_TYPES,
    validateAndProcessProfile: validateAndProcessProfile
  });
})(window);