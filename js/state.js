/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Global Reactive State Store: window.GeotechState
 * ==============================================================================
 * Acts as the Single Source of Truth across Modules P1 through P5.
 * Strict SI Units: Force (kN), Stress/Modulus (kPa), Depth (m), Settlement (mm),
 * Unit Weight (kN/m³), Consolidation Coefficient (mm²/s), Time (days / yr).
 *
 * Compatible with local file:// execution and GitHub Pages (no ES modules).
 */

(function initGeotechState(global) {
  "use strict";

  // ----------------------------------------------------------------------------
  // IMMUTABLE CLONING & DEEP-MERGE UTILITIES
  // ----------------------------------------------------------------------------

  /**
   * Checks whether a value is a plain JavaScript object (non-null, non-Array).
   * @param {*} val Value to inspect.
   * @returns {boolean}
   */
  function isPlainObject(val) {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  }

  /**
   * Immutably clones arrays and plain objects to prevent shared-reference mutations.
   * @param {*} value Source value.
   * @returns {*} Cloned copy.
   */
  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.slice().map(cloneValue);
    }
    if (isPlainObject(value)) {
      var out = {};
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        out[keys[i]] = cloneValue(value[keys[i]]);
      }
      return out;
    }
    return value;
  }

  /**
   * Immutably deep-merges a plain source object into a plain target object.
   * Arrays in source replace target arrays with cloned copies.
   * @param {Object} target Base object.
   * @param {Object} source Partial update object.
   * @returns {Object} New merged object.
   */
  function deepMerge(target, source) {
    var result = cloneValue(isPlainObject(target) ? target : {});
    if (!isPlainObject(source)) {
      return result;
    }

    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var srcVal = source[key];
      var tgtVal = result[key];

      if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
        result[key] = deepMerge(tgtVal, srcVal);
      } else {
        result[key] = cloneValue(srcVal);
      }
    }
    return result;
  }

  // ----------------------------------------------------------------------------
  // DEFAULT FACTORY FUNCTIONS (MODULES P1 – P4)
  // ----------------------------------------------------------------------------

  /**
   * Default 3-layer stratigraphic profile for Module P1 out-of-the-box testing.
   * Representative SI geotechnical parameters based on:
   *  - Look, B. G. (2014), "Handbook of Geotechnical Investigation and Design Tables", 2nd Ed.
   *  - Bowles, J. E. (1996), "Foundation Analysis and Design", 5th Ed.
   */
  function createDefaultLayers() {
    return [
      {
        soilType: "Sand (SW/SP)",
        z_top: 0.0,         // Top depth below ground surface (m)
        z_bot: 3.0,         // Bottom depth below ground surface (m)
        gamma_moist: 18.0,  // Moist / bulk unit weight (kN/m³)
        gamma_sat: 20.0,    // Saturated unit weight (kN/m³)
        su: 0.0,            // Undrained shear strength (kPa)
        c_prime: 0.0,       // Effective cohesion intercept (kPa)
        phi_prime: 34.0,    // Effective friction angle (deg)
        E_prime: 25000.0,   // Drained Young's modulus (kPa)
        nu_prime: 0.30,     // Drained Poisson's ratio (-)
        e0: 0.65,           // Initial void ratio (-)
        Cc: 0.020,          // Compression index (-)
        Cr: 0.005,          // Recompression / swell index (-)
        OCR: 1.00,          // Overconsolidation ratio (-)
        cv: 10.000          // Coefficient of consolidation (mm²/s)
      },
      {
        soilType: "Clay (CL/CH)",
        z_top: 3.0,
        z_bot: 9.0,
        gamma_moist: 17.5,
        gamma_sat: 18.5,
        su: 45.0,
        c_prime: 5.0,
        phi_prime: 24.0,
        E_prime: 8000.0,
        nu_prime: 0.35,
        e0: 1.10,
        Cc: 0.350,
        Cr: 0.060,
        OCR: 1.50,
        cv: 0.045
      },
      {
        soilType: "Gravel (GW/GP)",
        z_top: 9.0,
        z_bot: 14.0,
        gamma_moist: 20.0,
        gamma_sat: 21.5,
        su: 0.0,
        c_prime: 0.0,
        phi_prime: 38.0,
        E_prime: 60000.0,
        nu_prime: 0.25,
        e0: 0.45,
        Cc: 0.010,
        Cr: 0.002,
        OCR: 1.00,
        cv: 50.000
      }
    ];
  }

  /**
   * Default 5 SPT observations spanning the 0–14 m starter profile for Module P2.
   * Categories align with IS 2131:1981 Clauses 3.6.1 (Overburden) & 3.6.2 (Dilatancy).
   * sigma_v_override = null indicates automatic overburden integration from Module P1.
   */
  function createDefaultSptRecords() {
    return [
      {
        depth_m: 1.5,
        N_measured: 12,
        soilCategory: "Fine Sand / Silt (Dilatancy Applicable)",
        sigma_v_override: null
      },
      {
        depth_m: 3.0,
        N_measured: 18,
        soilCategory: "Fine Sand / Silt (Dilatancy Applicable)",
        sigma_v_override: null
      },
      {
        depth_m: 4.5,
        N_measured: 10,
        soilCategory: "Cohesive Soil (Clay)",
        sigma_v_override: null
      },
      {
        depth_m: 7.5,
        N_measured: 14,
        soilCategory: "Cohesive Soil (Clay)",
        sigma_v_override: null
      },
      {
        depth_m: 10.5,
        N_measured: 28,
        soilCategory: "Coarse Sand / Gravel (No Dilatancy)",
        sigma_v_override: null
      }
    ];
  }

  /**
   * Default 4 Direct Shear (Mohr-Coulomb) test observations in strict SI units (kPa).
   * Source: Typical drained direct shear envelope (IS 2720 Part 13 / ASTM D3080).
   */
  function createDefaultDirectShearPoints() {
    return [
      { sigma_n: 50.0,  tau_f: 38.5 },
      { sigma_n: 100.0, tau_f: 69.0 },
      { sigma_n: 150.0, tau_f: 96.5 },
      { sigma_n: 200.0, tau_f: 128.0 }
    ];
  }

  /**
   * Creates a clean Module P2 computed results container.
   */
  function createEmptyP2Results() {
    return {
      sptProcessed: [],
      sptErrors: [],
      directShearFit: null,
      directShearErrors: []
    };
  }

  /**
   * Default shallow foundation geometry, loading, and analysis parameters for Module P3.
   * Compatible with IS 6403:1981 (Code of Practice for Determination of Bearing Capacity
   * of Shallow Foundations) and the default 3-layer Module P1 profile.
   * Strict SI units: Dimensions/Eccentricity (m), Stress/Strength (kPa),
   * Unit Weight (kN/m³), Angles (deg), Factor of Safety (-).
   */
  function createDefaultP3Input() {
    return {
      shape: "Rectangular",         // Allowed: "Strip", "Square", "Rectangular", "Circular"
      B_m: 2.0,                     // Footing width or diameter (m)
      L_m: 3.0,                     // Footing length (m); ignored/synced for Strip, Square, Circular
      Df_m: 1.5,                    // Embedment depth below ground surface (m)
      eB_m: 0.0,                    // Load eccentricity along width B (m)
      eL_m: 0.0,                    // Load eccentricity along length L (m)
      alpha_deg: 0.0,               // Load inclination angle from vertical (deg)
      FS: 2.5,                      // Factor of safety for net safe bearing capacity (-)
      shearMode: "Auto (IS 6403)",  // Allowed: "Auto (IS 6403)", "General Shear", "Local Shear"
      analysisType: "Drained",      // Allowed: "Drained" (c', phi'), "Undrained" (su, phi=0)
      waterTableMode: "Design",     // Allowed: "Design" (zw_design), "Measured" (zw_measured)
      useManualSoil: false,         // false = auto-extract from Module P1; true = use manual fields below
      manual_c: 0.0,                // Manual cohesion c' or su (kPa)
      manual_phi: 34.0,             // Manual friction angle phi' (deg)
      manual_gamma_above: 18.0,     // Manual moist unit weight above footing base (kN/m³)
      manual_gamma_below: 18.0,     // Manual moist unit weight in failure zone below base (kN/m³)
      manual_gamma_sat_below: 20.0  // Manual saturated unit weight in failure zone below base (kN/m³)
    };
  }

  /**
   * Creates a clean Module P3 computed results container.
   *  - result: Full IS 6403:1981 computed object populated by Module P3 logic.
   *  - errors: Array of validation error strings.
   */
  function createEmptyP3Results() {
    return {
      result: null,
      errors: []
    };
  }

  /**
   * Default foundation settlement analysis inputs for Module P4.
   * Adheres to IS 8009 (Part 1):1976 (Calculation of Settlements of Foundations —
   * Shallow Foundations Subjected to Symmetrical Static Vertical Loads) and
   * classical 1D Terzaghi primary consolidation theory.
   * Strict SI units: Dimensions/Depths (m), Net Load (kN or kN/m), Net Stress (kPa),
   * Settlement (mm), Time (days).
   */
  function createDefaultP4Input() {
    return {
      footingType: "Flexible",                     // Options: "Flexible", "Rigid"
      shape: "Rectangular",                        // Options: "Rectangular", "Square", "Circular", "Strip"
      B_m: 2.0,                                    // Footing width or diameter (m)
      L_m: 3.0,                                    // Footing length (m)
      Df_m: 1.5,                                   // Embedment depth below ground surface (m)
      appliedLoad_kN: 600.0,                       // Net applied vertical service load Q_net (kN; or kN/m for Strip)
      contactStress_kPa: 100.0,                    // Net applied foundation contact stress q0 = Q_net / A (kPa)
      loadInputMode: "Stress",                     // Options: "Stress", "Total Load"
      waterTableMode: "Design",                    // Options: "Design" (zw_design), "Measured" (zw_measured)
      stressDistributionMethod: "2:1 Dispersion",  // Options: "2:1 Dispersion", "Boussinesq Point Integration", "Westergaard"
      elasticMethod: "IS 8009 / Janbu",            // Options: "IS 8009 / Janbu", "Schmertmann (1978)"
      poissonRatioDefault: 0.30,                   // Default drained Poisson's ratio (-)
      allowableSettlement_mm: 50.0,                // IS 1904:1986 Table 1 allowable total settlement limit (mm)
      overrideSoilParams: false,                   // false = use Module P1 profile; true = use manualSoilLayers
      manualSoilLayers: [],                        // Optional custom override layer array
      consolidationSubdivision_m: 0.5,             // Sub-layer discretization for thick clay strata (m)
      timeRateCalc: true,                          // Compute Terzaghi 1D time-rate of consolidation U(t), S(t)
      drainageCondition: "Double",                 // Options: "Double", "Single Top", "Single Bottom"
      targetTime_days: 365                         // Target elapsed time for degree of consolidation Ut (days)
    };
  }

  /**
   * Creates a clean Module P4 computed settlement results container.
   * Allowable settlement defaults to 50.0 mm per IS 1904:1986 Table 1 (isolated
   * footings on sand/hard clay; user-configurable via p4Input.allowableSettlement_mm).
   */
  function createEmptyP4Results() {
    return {
      status: "idle",                  // Options: "idle", "computed", "error"
      elasticSettlement_mm: 0.0,       // Immediate / elastic settlement Se (mm)
      consolidationSettlement_mm: 0.0, // 1D primary consolidation settlement Sc (mm)
      totalSettlement_mm: 0.0,         // Total settlement Stot = Se + Sc (mm)
      allowableSettlement_mm: 50.0,    // Active IS 1904 allowable settlement limit (mm)
      isSafeSettlement: true,          // true when totalSettlement_mm <= allowableSettlement_mm
      layerBreakdown: [],              // Layer-by-layer { delta_sigma_z, Se_i, Sc_i, ... }
      stressProfile: [],               // Depth profile { z_m, delta_sigma_z_kPa, sigma_v0_kPa, ... }
      timeRateCurve: [],               // Time-rate curve { t_days, t_yr, Tv, Ut_pct, St_mm }
      timeRateSummary: null,           // Governing clay layer summary { Hd_m, cv, Tv_target, Ut_pct, St_mm, t50_days, t90_days }
      settlementVsLoadCurve: [],       // Sensitivity curve { q0_kPa, Se_mm, Sc_mm, Stot_mm }
      steps: [],                       // Step-by-step calculation audit strings
      warnings: [],                    // Non-blocking advisories or diagnostic messages
      errors: []                       // Blocking validation error messages
    };
  }

  // Internal list of reactive subscriber callbacks (Modules P1–P5)
  var subscribers = [];

  var GeotechState = {
    // --------------------------------------------------------------------------
    // PHYSICAL CONSTANTS & GROUNDWATER CONDITIONS (Module P1)
    // --------------------------------------------------------------------------
    // Unit weight of water: gamma_w = rho_w * g = 1.000 Mg/m³ * 9.81 m/s² = 9.81 kN/m³
    // Source: Terzaghi, Peck, & Mesri (1996), "Soil Mechanics in Engineering Practice", 3rd Ed.
    gamma_w: 9.81,

    // Measured groundwater depth during site investigation (m bgl)
    // Source: EN 1997-1 (Eurocode 7), Clause 2.4.5.1
    zw_measured: 3.50,

    // Unfavorable design groundwater depth for ULS/SLS checks (m bgl)
    // Source: EN 1997-1 (Eurocode 7), Clause 2.4.5.1
    zw_design: 1.50,

    // --------------------------------------------------------------------------
    // MODULE P1: STRATIGRAPHIC DATA ARRAYS
    // --------------------------------------------------------------------------
    // Raw user-editable soil layers (strict SI parameters)
    layers: createDefaultLayers(),

    // Validated & derived layer objects populated by Module P1 logic
    // (holds H_m, H_mm, gamma_sub, E_oed, mv, etc.)
    processedLayers: [],

    // Validation error messages populated by Module P1 logic
    validationErrors: [],

    // --------------------------------------------------------------------------
    // MODULE P2: SPT CORRECTIONS & DIRECT SHEAR TEST DATA
    // --------------------------------------------------------------------------
    // Editable SPT borehole observations (m, blow count, IS 2131 category, optional kPa override)
    sptRecords: createDefaultSptRecords(),

    // Editable Direct Shear failure envelope points (sigma_n in kPa, tau_f in kPa)
    directShearPoints: createDefaultDirectShearPoints(),

    // Computed outputs and validation diagnostics populated by Module P2 logic
    p2Results: createEmptyP2Results(),

    // --------------------------------------------------------------------------
    // MODULE P3: SHALLOW FOUNDATION BEARING CAPACITY (IS 6403:1981)
    // --------------------------------------------------------------------------
    // Editable shallow footing geometry, loading, and soil source configuration
    p3Input: createDefaultP3Input(),

    // Computed IS 6403:1981 bearing capacity output and validation diagnostics
    p3Results: createEmptyP3Results(),

    // --------------------------------------------------------------------------
    // MODULE P4: FOUNDATION SETTLEMENT ANALYSIS (IS 8009 PART 1:1976)
    // --------------------------------------------------------------------------
    // Editable settlement geometry, loading, stress dispersion, and time-rate inputs
    p4Input: createDefaultP4Input(),

    // Computed immediate, primary consolidation, stress profile, and time-rate results
    p4Results: createEmptyP4Results(),

    // --------------------------------------------------------------------------
    // REACTIVE PUB/SUB ENGINE
    // --------------------------------------------------------------------------

    /**
     * Registers a callback function to be executed whenever state changes.
     * Returns an unsubscribe function for clean lifecycle management.
     *
     * @param {Function} callback Invoked with (GeotechState) upon notify().
     * @returns {Function} Unsubscribe handler.
     */
    subscribe: function (callback) {
      if (typeof callback !== "function") {
        console.warn("[GeotechState] subscribe() expects a function.");
        return function () {};
      }
      if (subscribers.indexOf(callback) === -1) {
        subscribers.push(callback);
      }
      return function unsubscribe() {
        var idx = subscribers.indexOf(callback);
        if (idx !== -1) {
          subscribers.splice(idx, 1);
        }
      };
    },

    /**
     * Broadcasts the latest state snapshot to all subscribed modules (P1–P5).
     * Errors in one subscriber are isolated so downstream modules still update.
     */
    notify: function () {
      subscribers.forEach(function (callback) {
        try {
          callback(GeotechState);
        } catch (err) {
          console.error("[GeotechState] Subscriber notification error:", err);
        }
      });
    },

    // --------------------------------------------------------------------------
    // MODULE P1 MUTATORS (Exact Backward Compatibility Preserved)
    // --------------------------------------------------------------------------

    /**
     * Updates measured and/or design water table depths (m) and notifies subscribers.
     * @param {number} zwMeasured Measured water table depth (m bgl).
     * @param {number} zwDesign Design water table depth (m bgl).
     */
    setWaterTables: function (zwMeasured, zwDesign) {
      if (Number.isFinite(zwMeasured)) {
        this.zw_measured = Math.max(0.0, zwMeasured);
      }
      if (Number.isFinite(zwDesign)) {
        this.zw_design = Math.max(0.0, zwDesign);
      }
      this.notify();
    },

    /**
     * Replaces the raw layers array and notifies subscribers.
     * @param {Array<Object>} newLayers Array of soil layer objects.
     */
    setLayers: function (newLayers) {
      if (!Array.isArray(newLayers)) {
        console.warn("[GeotechState] setLayers() expects an array.");
        return;
      }
      this.layers = newLayers.slice();
      this.notify();
    },

    /**
     * Stores validated/derived layers and validation errors computed by Module P1.
     * Does not auto-call notify() to avoid infinite loops when called inside a subscriber;
     * callers can pass triggerNotify = true if explicitly updating from an event handler.
     *
     * @param {Array<Object>} processedLayers
     * @param {Array<string>} validationErrors
     * @param {boolean} [triggerNotify=false]
     */
    setProcessedProfile: function (processedLayers, validationErrors, triggerNotify) {
      this.processedLayers = Array.isArray(processedLayers) ? processedLayers.slice() : [];
      this.validationErrors = Array.isArray(validationErrors) ? validationErrors.slice() : [];
      if (triggerNotify) {
        this.notify();
      }
    },

    /**
     * Resets the Module P1 profile and groundwater inputs back to the default 3-layer model.
     * Leaves Module P2, Module P3, and Module P4 data intact.
     */
    resetToDefaults: function () {
      this.zw_measured = 3.50;
      this.zw_design = 1.50;
      this.layers = createDefaultLayers();
      this.processedLayers = [];
      this.validationErrors = [];
      this.notify();
    },

    // --------------------------------------------------------------------------
    // MODULE P2 MUTATORS (SPT Corrections & Direct Shear Parameter Fitting)
    // --------------------------------------------------------------------------

    /**
     * Replaces the SPT records array and notifies subscribers.
     * @param {Array<Object>} records Array of SPT record objects.
     */
    setSptRecords: function (records) {
      if (!Array.isArray(records)) {
        console.warn("[GeotechState] setSptRecords() expects an array.");
        return;
      }
      this.sptRecords = records.slice();
      this.notify();
    },

    /**
     * Replaces the Direct Shear test points array and notifies subscribers.
     * @param {Array<Object>} points Array of { sigma_n, tau_f } objects (kPa).
     */
    setDirectShearPoints: function (points) {
      if (!Array.isArray(points)) {
        console.warn("[GeotechState] setDirectShearPoints() expects an array.");
        return;
      }
      this.directShearPoints = points.slice();
      this.notify();
    },

    /**
     * Stores computed Module P2 results without auto-looping unless triggerNotify is true.
     * Preserves existing keys in this.p2Results when a partial resultsObj is passed.
     * @param {Object} resultsObj Partial or full { sptProcessed, sptErrors, directShearFit, directShearErrors }
     * @param {boolean} [triggerNotify=false]
     */
    setP2Results: function (resultsObj, triggerNotify) {
      var obj = resultsObj && typeof resultsObj === "object" ? resultsObj : {};
      var current = this.p2Results || createEmptyP2Results();
      var hasOwn = Object.prototype.hasOwnProperty;

      this.p2Results = {
        sptProcessed: hasOwn.call(obj, "sptProcessed")
          ? (Array.isArray(obj.sptProcessed) ? obj.sptProcessed.slice() : [])
          : current.sptProcessed,
        sptErrors: hasOwn.call(obj, "sptErrors")
          ? (Array.isArray(obj.sptErrors) ? obj.sptErrors.slice() : [])
          : current.sptErrors,
        directShearFit: hasOwn.call(obj, "directShearFit")
          ? obj.directShearFit
          : current.directShearFit,
        directShearErrors: hasOwn.call(obj, "directShearErrors")
          ? (Array.isArray(obj.directShearErrors) ? obj.directShearErrors.slice() : [])
          : current.directShearErrors
      };
      if (triggerNotify) {
        this.notify();
      }
    },

    /**
     * Resets only Module P2 SPT records, Direct Shear points, and P2 results to defaults,
     * preserving the active Module P1 soil profile, Module P3, and Module P4 state.
     */
    resetP2Defaults: function () {
      this.sptRecords = createDefaultSptRecords();
      this.directShearPoints = createDefaultDirectShearPoints();
      this.p2Results = createEmptyP2Results();
      this.notify();
    },

    // --------------------------------------------------------------------------
    // MODULE P3 MUTATORS (IS 6403:1981 Shallow Foundation Bearing Capacity)
    // --------------------------------------------------------------------------

    /**
     * Merges a partial or full plain object into this.p3Input (preserving omitted keys)
     * and notifies all subscribed modules.
     * @param {Object} updates Partial or full Module P3 input fields.
     */
    setP3Input: function (updates) {
      if (!isPlainObject(updates)) {
        console.warn("[GeotechState] setP3Input() expects a plain object.");
        return;
      }
      this.p3Input = Object.assign({}, this.p3Input, updates);
      this.notify();
    },

    /**
     * Stores computed Module P3 results using defensive partial-update preservation.
     * Only overwrites "result" or "errors" if explicitly present on resultsObj, and
     * only notifies subscribers when triggerNotify === true to prevent recursive loops.
     * @param {Object} resultsObj Partial or full { result, errors } object.
     * @param {boolean} [triggerNotify=false]
     */
    setP3Results: function (resultsObj, triggerNotify) {
      var obj = resultsObj && typeof resultsObj === "object" ? resultsObj : {};
      var current = this.p3Results || createEmptyP3Results();
      var hasOwn = Object.prototype.hasOwnProperty;

      this.p3Results = {
        result: hasOwn.call(obj, "result") ? obj.result : current.result,
        errors: hasOwn.call(obj, "errors")
          ? (Array.isArray(obj.errors) ? obj.errors.slice() : [])
          : current.errors
      };
      if (triggerNotify === true) {
        this.notify();
      }
    },

    /**
     * Resets ONLY Module P3 footing inputs and computed results back to defaults,
     * leaving Module P1, Module P2, and Module P4 state completely intact.
     */
    resetP3Defaults: function () {
      this.p3Input = createDefaultP3Input();
      this.p3Results = createEmptyP3Results();
      this.notify();
    },

    // --------------------------------------------------------------------------
    // MODULE P4 MUTATORS (IS 8009 Part 1:1976 Foundation Settlement Analysis)
    // --------------------------------------------------------------------------

    /**
     * Partially updates this.p4Input using an immutable deep merge for nested
     * objects and cloned arrays. Notifies subscribers unless notifyCaller === false.
     *
     * @param {Object} patch Partial or full Module P4 input fields.
     * @param {boolean} [notifyCaller=true] Pass false to suppress notify().
     */
    setP4Input: function (patch, notifyCaller) {
      if (!isPlainObject(patch)) {
        console.warn("[GeotechState] setP4Input() expects a plain object.");
        return;
      }
      this.p4Input = deepMerge(this.p4Input, patch);
      if (notifyCaller !== false) {
        this.notify();
      }
    },

    /**
     * Stores computed Module P4 settlement results using defensive partial-update
     * preservation. Does NOT trigger notify() unless notifyCaller === true so
     * reactive subscribers never enter recursive update loops.
     *
     * @param {Object} results Partial or full Module P4 results object.
     * @param {boolean} [notifyCaller=false] Pass true only if explicitly notifying.
     */
    setP4Results: function (results, notifyCaller) {
      var obj = isPlainObject(results) ? results : {};
      var current = this.p4Results || createEmptyP4Results();
      var hasOwn = Object.prototype.hasOwnProperty;

      var next = Object.assign({}, current);

      if (hasOwn.call(obj, "status")) {
        next.status = obj.status;
      }
      if (hasOwn.call(obj, "elasticSettlement_mm")) {
        next.elasticSettlement_mm = obj.elasticSettlement_mm;
      }
      if (hasOwn.call(obj, "consolidationSettlement_mm")) {
        next.consolidationSettlement_mm = obj.consolidationSettlement_mm;
      }
      if (hasOwn.call(obj, "totalSettlement_mm")) {
        next.totalSettlement_mm = obj.totalSettlement_mm;
      }
      if (hasOwn.call(obj, "allowableSettlement_mm")) {
        next.allowableSettlement_mm = obj.allowableSettlement_mm;
      }
      if (hasOwn.call(obj, "isSafeSettlement")) {
        next.isSafeSettlement = Boolean(obj.isSafeSettlement);
      }
      if (hasOwn.call(obj, "layerBreakdown")) {
        next.layerBreakdown = Array.isArray(obj.layerBreakdown) ? cloneValue(obj.layerBreakdown) : [];
      }
      if (hasOwn.call(obj, "stressProfile")) {
        next.stressProfile = Array.isArray(obj.stressProfile) ? cloneValue(obj.stressProfile) : [];
      }
      if (hasOwn.call(obj, "timeRateCurve")) {
        next.timeRateCurve = Array.isArray(obj.timeRateCurve) ? cloneValue(obj.timeRateCurve) : [];
      }
      if (hasOwn.call(obj, "timeRateSummary")) {
        next.timeRateSummary = isPlainObject(obj.timeRateSummary)
          ? cloneValue(obj.timeRateSummary)
          : null;
      }
      if (hasOwn.call(obj, "settlementVsLoadCurve")) {
        next.settlementVsLoadCurve = Array.isArray(obj.settlementVsLoadCurve)
          ? cloneValue(obj.settlementVsLoadCurve)
          : [];
      }
      if (hasOwn.call(obj, "steps")) {
        next.steps = Array.isArray(obj.steps) ? obj.steps.slice() : [];
      }
      if (hasOwn.call(obj, "warnings")) {
        next.warnings = Array.isArray(obj.warnings) ? obj.warnings.slice() : [];
      }
      if (hasOwn.call(obj, "errors")) {
        next.errors = Array.isArray(obj.errors) ? obj.errors.slice() : [];
      }

      this.p4Results = next;
      if (notifyCaller === true) {
        this.notify();
      }
    },

    /**
     * Resets ONLY Module P4 settlement inputs and computed results to factory
     * engineering defaults, leaving Modules P1, P2, and P3 completely intact.
     *
     * @param {boolean} [notifyCaller=true] Pass false to suppress notify().
     */
    resetP4Defaults: function (notifyCaller) {
      this.p4Input = createDefaultP4Input();
      this.p4Results = createEmptyP4Results();
      if (notifyCaller !== false) {
        this.notify();
      }
    },

    /**
     * Pulls compatible footing dimensions (B_m, L_m, Df_m, shape, waterTableMode)
     * from Module P3 inputs and NET safe load / contact stress (Q_ns, q_ns) from
     * Module P3 results directly into p4Input, then notifies subscribers.
     *
     * Source: IS 8009 (Part 1):1976 — Settlement is governed by net applied pressure
     * q_net (kPa) and corresponding net vertical load Q_net (kN or kN/m).
     *
     * @returns {Object} Updated p4Input snapshot.
     */
    syncP4FromP3: function () {
      var p3In = this.p3Input || {};
      var p3Res = this.p3Results && this.p3Results.result ? this.p3Results.result : null;
      var patch = {};

      var allowedShapes = ["Rectangular", "Square", "Circular", "Strip"];
      var syncedShape =
        allowedShapes.indexOf(p3In.shape) !== -1 ? p3In.shape : this.p4Input.shape;
      patch.shape = syncedShape;

      if (p3In.waterTableMode === "Design" || p3In.waterTableMode === "Measured") {
        patch.waterTableMode = p3In.waterTableMode;
      }

      if (typeof p3In.B_m === "number" && Number.isFinite(p3In.B_m) && p3In.B_m > 0) {
        patch.B_m = p3In.B_m;
      }

      if (syncedShape === "Square" || syncedShape === "Circular") {
        if (typeof patch.B_m === "number") {
          patch.L_m = patch.B_m;
        }
      } else if (syncedShape === "Rectangular") {
        if (typeof p3In.L_m === "number" && Number.isFinite(p3In.L_m) && p3In.L_m > 0) {
          patch.L_m = p3In.L_m;
        }
      }

      if (typeof p3In.Df_m === "number" && Number.isFinite(p3In.Df_m) && p3In.Df_m >= 0) {
        patch.Df_m = p3In.Df_m;
      }

      // Pull NET safe load Q_ns (kN or kN/m) and NET safe contact stress q_ns (kPa)
      // consistently so toggling Stress vs. Total Load never double-counts overburden q.
      if (p3Res && p3Res.capacities) {
        var cap = p3Res.capacities;
        var geom = p3Res.geometry || {};

        if (typeof cap.Q_ns === "number" && Number.isFinite(cap.Q_ns) && cap.Q_ns > 0) {
          patch.appliedLoad_kN = Number(cap.Q_ns.toFixed(2));
        }

        if (typeof cap.q_ns === "number" && Number.isFinite(cap.q_ns) && cap.q_ns > 0) {
          patch.contactStress_kPa = Number(cap.q_ns.toFixed(2));
        } else if (
          typeof cap.Q_ns === "number" &&
          Number.isFinite(cap.Q_ns) &&
          typeof geom.A_prime === "number" &&
          Number.isFinite(geom.A_prime) &&
          geom.A_prime > 0
        ) {
          patch.contactStress_kPa = Number((cap.Q_ns / geom.A_prime).toFixed(2));
        }
      }

      this.setP4Input(patch, true);
      return this.p4Input;
    }
  };

  // Expose globally for classic <script> modules (P1–P5)
  global.GeotechState = GeotechState;
})(window);