/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P4 UI & Plotly Interactive Charts: window.ModuleP4UI
 * ==============================================================================
 * Renders the interactive Foundation Settlement Analysis interface inside #tab-p4
 * using window.GeotechState and window.ModuleP4Logic:
 *   - Immediate Elastic Settlement (IS 8009 / Janbu & Schmertmann 1978)
 *   - 1D Terzaghi Primary Consolidation Settlement & Time-Rate Analysis
 *   - IS 1904:1986 Serviceability Limit Checks & Sensitivity Plots
 *
 * Strict SI Units: Dimensions/Depths (m), Net Load (kN or kN/m for Strip),
 * Stress/Modulus (kPa), Unit Weight (kN/m³), Settlement (mm),
 * Consolidation Coefficient cv (mm²/s), Time (days, yr).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", no ES module imports/exports).
 */

(function initModuleP4UI(global) {
  "use strict";

  // Guard flag to prevent recursive GeotechState notification loops
  var isSyncingFromState = false;

  var DAYS_PER_YEAR = 365.25;

  // Cached DOM references inside #tab-p4
  var els = {
    container: null,
    syncBadge: null,
    btnSyncP3: null,
    btnResetP4: null,

    // Card A: Foundation & Method Setup
    selectFootingType: null,
    selectShape: null,
    selectWaterTableMode: null,
    selectStressMethod: null,
    selectElasticMethod: null,

    // Card B: Geometry, Loading & Serviceability
    labelB: null,
    inputB: null,
    labelL: null,
    inputL: null,
    hintL: null,
    inputDf: null,
    btnLoadStress: null,
    btnLoadTotal: null,
    wrapStressInput: null,
    wrapLoadInput: null,
    inputContactStress: null,
    inputAppliedLoad: null,
    unitAppliedLoad: null,
    labelAppliedLoad: null,
    inputAllowable: null,
    presetButtons: null,
    inputNuDefault: null,
    inputSubdivision: null,

    // Card C: Time-Rate & Soil Source
    checkTimeRate: null,
    selectDrainage: null,
    labelTargetTime: null,
    inputTargetTime: null,
    targetTimeYrBadge: null,
    btnSoilAuto: null,
    btnSoilManual: null,
    panelAutoSoil: null,
    autoSoilBody: null,
    panelManualSoil: null,
    btnAddManualLayer: null,
    manualSoilTbody: null,

    // Alerts & Warnings
    errorBanner: null,
    errorList: null,
    warningBanner: null,
    warningList: null,

    // Results Workspace & 5 KPI Cards
    resultsWorkspace: null,
    kpiStotCard: null,
    kpiStotVal: null,
    kpiStotBadge: null,
    kpiStotSub: null,
    kpiSeVal: null,
    kpiSeSub: null,
    kpiScVal: null,
    kpiScSub: null,
    kpiStVal: null,
    kpiStSub: null,
    kpiMetaStress: null,
    kpiMetaLoad: null,
    kpiMetaRf: null,
    kpiMetaTimes: null,

    // Plotly Containers & Placeholders
    stressPlotDiv: null,
    timeRatePlotDiv: null,
    timeRateEmpty: null,
    timeRateHeaderBadge: null,
    loadPlotDiv: null,

    // Layer Breakdown Table & Audit Steps
    layerBreakdownTbody: null,
    layerBreakdownTfoot: null,
    stepsCount: null,
    stepsContainer: null
  };

  function getState() {
    return global.GeotechState;
  }

  function getLogic() {
    return global.ModuleP4Logic;
  }

  function isFiniteNum(val) {
    return typeof val === "number" && Number.isFinite(val);
  }

  function formatNum(val, decimals) {
    if (!isFiniteNum(val)) {
      return "—";
    }
    return val.toFixed(decimals);
  }

  function formatDaysShort(days) {
    if (!isFiniteNum(days) || days < 0) {
      return "—";
    }
    return days < 10 ? days.toFixed(1) : days.toFixed(0);
  }

  function formatDuration(days) {
    if (!isFiniteNum(days) || days < 0) {
      return "—";
    }
    if (days >= 730) {
      return (days / DAYS_PER_YEAR).toFixed(2) + " yr";
    }
    if (days >= 100) {
      return days.toFixed(0) + " d (" + (days / DAYS_PER_YEAR).toFixed(2) + " yr)";
    }
    return days.toFixed(1) + " d";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildSelectOptions(items) {
    return (items || [])
      .map(function (item) {
        return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + "</option>";
      })
      .join("");
  }

  /**
   * Computes footprint bearing area A (m² or m²/m for Strip) from p4Input.
   */
  function computeFootprintArea(input) {
    if (!input || !isFiniteNum(input.B_m) || !(input.B_m > 0)) {
      return NaN;
    }
    var B = input.B_m;
    if (input.shape === "Rectangular") {
      return isFiniteNum(input.L_m) && input.L_m > 0 ? B * input.L_m : NaN;
    }
    if (input.shape === "Square") {
      return B * B;
    }
    if (input.shape === "Circular") {
      var R = B / 2.0;
      return Math.PI * R * R;
    }
    // Strip (per unit metre run)
    return B;
  }

  /**
   * Resolves summary metadata cleanly from out.meta with safe fallbacks
   * when an engine build omits optional meta fields.
   */
  function resolveMeta(state, out) {
    var m = out && out.meta && typeof out.meta === "object" ? out.meta : {};
    var inp = (state && state.p4Input) || {};
    var isStrip = inp.shape === "Strip";
    var fallbackA = computeFootprintArea(inp);
    var A_m2 = isFiniteNum(m.A_m2) ? m.A_m2 : fallbackA;
    var loadUnit = m.loadUnit || (isStrip ? "kN/m" : "kN");
    var areaUnit = m.areaUnit || (isStrip ? "m²/m" : "m²");

    var q0_kPa = isFiniteNum(m.q0_kPa)
      ? m.q0_kPa
      : inp.loadInputMode === "Stress"
        ? inp.contactStress_kPa
        : isFiniteNum(A_m2) && A_m2 > 0
          ? inp.appliedLoad_kN / A_m2
          : NaN;

    var Q_net = isFiniteNum(m.Q_net)
      ? m.Q_net
      : inp.loadInputMode === "Total Load"
        ? inp.appliedLoad_kN
        : isFiniteNum(q0_kPa) && isFiniteNum(A_m2)
          ? q0_kPa * A_m2
          : NaN;

    var Rf = isFiniteNum(m.Rf) ? m.Rf : inp.footingType === "Rigid" ? 0.80 : 1.00;
    var zw_m = isFiniteNum(m.zw_m)
      ? m.zw_m
      : inp.waterTableMode === "Measured"
        ? state.zw_measured
        : state.zw_design;

    var subLayerCount = isFiniteNum(m.subLayerCount) ? m.subLayerCount : 0;
    if (!isFiniteNum(m.subLayerCount) && out && Array.isArray(out.layerBreakdown)) {
      for (var i = 0; i < out.layerBreakdown.length; i++) {
        if (isFiniteNum(out.layerBreakdown[i].subLayerCount)) {
          subLayerCount += out.layerBreakdown[i].subLayerCount;
        }
      }
    }

    return {
      q0_kPa: q0_kPa,
      Q_net: Q_net,
      loadUnit: loadUnit,
      A_m2: A_m2,
      areaUnit: areaUnit,
      Rf: Rf,
      zw_m: zw_m,
      subLayerCount: subLayerCount,
      elasticDiagnostics: m.elasticDiagnostics || null
    };
  }

  /**
   * Builds the Precision Engineering layout skeleton inside #tab-p4 once.
   */
  function buildSkeleton(container) {
    var logic = getLogic();
    var footingTypeOpts = buildSelectOptions(logic.FOOTING_TYPES);
    var shapeOpts = buildSelectOptions(logic.FOOTING_SHAPES);
    var wtOpts = buildSelectOptions(logic.WATER_TABLE_MODES);
    var stressOpts = buildSelectOptions(logic.STRESS_METHODS);
    var elasticOpts = buildSelectOptions(logic.ELASTIC_METHODS);
    var drainageOpts = buildSelectOptions(logic.DRAINAGE_CONDITIONS);

    container.innerHTML = [
      '<div class="space-y-5">',

      '  <!-- 1. Top Header & Live Sync Status Bar -->',
      '  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">',
      '    <div>',
      '      <div class="flex flex-wrap items-center gap-2.5">',
      '        <h2 class="text-xl font-bold tracking-tight text-slate-900">Foundation Settlement Analysis (IS 8009 Part 1:1976)</h2>',
      '        <span id="p4-sync-badge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">',
      '          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Auto (P1 Stratigraphy)',
      '        </span>',
      '      </div>',
      '      <p class="mt-0.5 text-xs text-slate-500">Immediate elastic compression, 1D Terzaghi primary consolidation, time-rate curves, and IS 1904:1986 serviceability checks.</p>',
      '    </div>',
      '    <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">',
      '      <button id="p4-btn-sync-p3" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
      '        <span>Sync from P3</span>',
      '      </button>',
      '      <button id="p4-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-2xs transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      '        <span>Reset P4 Sample</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- Main 12-Column Grid: Left Input Panel (4 cols) + Right Results Workspace (8 cols) -->',
      '  <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">',

      '    <!-- ================================================================ -->',
      '    <!-- 2. LEFT INPUT PANEL (3 CLEAN CARDS)                              -->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-4 space-y-4">',

      '      <!-- Card A: Foundation & Method Setup -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Foundation &amp; Method Setup</h3>',
      '            <p class="text-[11px] text-slate-500">Rigidity, shape, groundwater datum, stress dispersion, and elastic model.</p>',
      '          </div>',
      '          <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold">IS 8009</span>',
      '        </div>',
      '        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">',
      '          <div>',
      '            <label for="p4-footing-type" class="block text-[11px] font-semibold text-slate-700 mb-1">Footing Rigidity</label>',
      '            <select id="p4-footing-type" data-p4-select="footingType" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + footingTypeOpts + "</select>",
      '          </div>',
      '          <div>',
      '            <label for="p4-shape" class="block text-[11px] font-semibold text-slate-700 mb-1">Footing Shape</label>',
      '            <select id="p4-shape" data-p4-select="shape" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + shapeOpts + "</select>",
      '          </div>',
      '          <div class="sm:col-span-2">',
      '            <label for="p4-wt-mode" class="block text-[11px] font-semibold text-slate-700 mb-1">Water Table Mode</label>',
      '            <select id="p4-wt-mode" data-p4-select="waterTableMode" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + wtOpts + "</select>",
      '          </div>',
      '          <div class="sm:col-span-2">',
      '            <label for="p4-stress-method" class="block text-[11px] font-semibold text-slate-700 mb-1">Stress Distribution Method</label>',
      '            <select id="p4-stress-method" data-p4-select="stressDistributionMethod" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + stressOpts + "</select>",
      '          </div>',
      '          <div class="sm:col-span-2">',
      '            <label for="p4-elastic-method" class="block text-[11px] font-semibold text-slate-700 mb-1">Immediate Elastic Settlement Method</label>',
      '            <select id="p4-elastic-method" data-p4-select="elasticMethod" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + elasticOpts + "</select>",
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Card B: Geometry, Loading & Serviceability -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Geometry, Loading &amp; Serviceability</h3>',
      '            <p class="text-[11px] text-slate-500">Footprint, net service load/pressure, and IS 1904 settlement limit.</p>',
      '          </div>',
      '          <span class="text-[10px] font-mono text-slate-400">m &middot; kPa &middot; kN &middot; mm</span>',
      '        </div>',
      '        <div class="p-4 space-y-3.5">',
      '          <div class="grid grid-cols-3 gap-2.5">',
      '            <div>',
      '              <label id="p4-label-B" for="p4-B" class="block text-[11px] font-semibold text-slate-700 mb-1">Width B (m)</label>',
      '              <div class="relative">',
      '                <input id="p4-B" type="number" step="0.1" min="0.1" data-p4-num="B_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '              </div>',
      '            </div>',
      '            <div>',
      '              <label id="p4-label-L" for="p4-L" class="block text-[11px] font-semibold text-slate-700 mb-1">Length L (m)</label>',
      '              <div class="relative">',
      '                <input id="p4-L" type="number" step="0.1" min="0.1" data-p4-num="L_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 pl-2 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '              </div>',
      '              <p id="p4-hint-L" class="hidden mt-0.5 text-[10px] font-mono text-slate-400 truncate"></p>',
      '            </div>',
      '            <div>',
      '              <label for="p4-Df" class="block text-[11px] font-semibold text-slate-700 mb-1">Depth D<sub>f</sub> (m)</label>',
      '              <div class="relative">',
      '                <input id="p4-Df" type="number" step="0.1" min="0.0" data-p4-num="Df_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '              </div>',
      '            </div>',
      '          </div>',

      '          <!-- Segmented Load Input Mode Toggle -->',
      '          <div class="pt-1 border-t border-slate-100 space-y-2.5">',
      '            <div class="flex items-center justify-between">',
      '              <span class="text-[11px] font-semibold text-slate-700">Net Applied Load Input Mode</span>',
      '              <span class="text-[10px] font-mono text-slate-400">q<sub>0</sub> = Q<sub>net</sub> / A</span>',
      '            </div>',
      '            <div class="grid grid-cols-2 p-1 rounded-lg bg-slate-100 border border-slate-200/80 gap-1" role="group" aria-label="Load input mode">',
      '              <button id="p4-btn-load-stress" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs">Net Stress (q<sub>0</sub>)</button>',
      '              <button id="p4-btn-load-total" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900">Net Load (Q<sub>net</sub>)</button>',
      '            </div>',
      '            <div class="grid grid-cols-2 gap-3">',
      '              <div id="p4-wrap-stress" class="rounded-lg p-2 border border-indigo-200 bg-indigo-50/40 transition-colors">',
      '                <label for="p4-contact-stress" class="block text-[11px] font-semibold text-slate-700 mb-1">Net Stress q<sub>0</sub> (kPa)</label>',
      '                <div class="relative">',
      '                  <input id="p4-contact-stress" type="number" step="5" min="1" data-p4-num="contactStress_kPa" class="clean-num w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 pl-2.5 pr-9 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                  <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
      '                </div>',
      '              </div>',
      '              <div id="p4-wrap-load" class="rounded-lg p-2 border border-slate-200 bg-slate-50/50 transition-colors">',
      '                <label id="p4-label-applied-load" for="p4-applied-load" class="block text-[11px] font-semibold text-slate-700 mb-1">Net Load Q<sub>net</sub> (kN)</label>',
      '                <div class="relative">',
      '                  <input id="p4-applied-load" type="number" step="25" min="1" data-p4-num="appliedLoad_kN" class="clean-num w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 pl-2.5 pr-11 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                  <span id="p4-unit-applied-load" class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kN</span>',
      '                </div>',
      '              </div>',
      '            </div>',
      '          </div>',

      '          <!-- IS 1904 Allowable Settlement & Numerical Controls -->',
      '          <div class="pt-2 border-t border-slate-100 space-y-2.5">',
      '            <div>',
      '              <div class="flex items-center justify-between mb-1">',
      '                <label for="p4-allowable" class="text-[11px] font-semibold text-slate-700">IS 1904 Allowable Settlement S<sub>allow</sub> (mm)</label>',
      '                <span class="text-[10px] font-mono text-slate-400">Table 1</span>',
      '              </div>',
      '              <div class="relative">',
      '                <input id="p4-allowable" type="number" step="5" min="5" data-p4-num="allowableSettlement_mm" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-10 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">mm</span>',
      '              </div>',
      '              <div class="mt-2 flex flex-wrap gap-1.5">',
      '                <button type="button" data-p4-preset="50" class="p4-preset-btn px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer">50 mm Sand</button>',
      '                <button type="button" data-p4-preset="75" class="p4-preset-btn px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer">75 mm Clay</button>',
      '                <button type="button" data-p4-preset="100" class="p4-preset-btn px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer">100 mm Raft</button>',
      '              </div>',
      '            </div>',

      '            <div class="grid grid-cols-2 gap-3 pt-1">',
      '              <div>',
      '                <label for="p4-nu-default" class="block text-[11px] font-semibold text-slate-700 mb-1">Default Poisson &nu; (-)</label>',
      '                <div class="relative">',
      '                  <input id="p4-nu-default" type="number" step="0.01" min="0" max="0.49" data-p4-num="poissonRatioDefault" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                  <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">-</span>',
      '                </div>',
      '              </div>',
      '              <div>',
      '                <label for="p4-subdivision" class="block text-[11px] font-semibold text-slate-700 mb-1">Sub-Layer Step (m)</label>',
      '                <div class="relative">',
      '                  <input id="p4-subdivision" type="number" step="0.1" min="0.1" max="5.0" data-p4-num="consolidationSubdivision_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                  <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '                </div>',
      '              </div>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Card C: Consolidation Time-Rate & Soil Source -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Time-Rate &amp; Soil Stratigraphy</h3>',
      '            <p class="text-[11px] text-slate-500">1D drainage path, target time, and P1 vs. manual layer overrides.</p>',
      '          </div>',
      '          <span class="text-[10px] font-mono text-slate-400">Terzaghi 1D</span>',
      '        </div>',

      '        <!-- Time-Rate Controls -->',
      '        <div class="p-4 border-b border-slate-200 space-y-3">',
      '          <label class="flex items-center justify-between gap-3 cursor-pointer select-none">',
      '            <span class="text-xs font-semibold text-slate-800">Compute Time-Rate of Consolidation U(t)</span>',
      '            <input id="p4-check-timerate" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />',
      '          </label>',
      '          <div class="grid grid-cols-2 gap-3">',
      '            <div>',
      '              <label for="p4-drainage" class="block text-[11px] font-semibold text-slate-700 mb-1">Drainage Condition</label>',
      '              <select id="p4-drainage" data-p4-select="drainageCondition" class="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + drainageOpts + "</select>",
      '            </div>',
      '            <div>',
      '              <div class="flex items-center justify-between mb-1">',
      '                <label id="p4-label-target-time" for="p4-target-time" class="text-[11px] font-semibold text-slate-700">Target Time</label>',
      '                <span id="p4-target-time-yr" class="text-[10px] font-mono text-indigo-600">1.00 yr</span>',
      '              </div>',
      '              <div class="relative">',
      '                <input id="p4-target-time" type="number" step="30" min="0.1" data-p4-num="targetTime_days" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 pl-2.5 pr-11 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '                <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">days</span>',
      '              </div>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Soil Parameter Source Segmented Toggle -->',
      '        <div class="px-4 py-3 border-b border-slate-100 space-y-2">',
      '          <div class="flex items-center justify-between">',
      '            <span class="text-xs font-semibold text-slate-800">Soil Stratigraphy Source</span>',
      '            <span class="text-[10px] font-mono text-slate-400">E&prime;, C<sub>c</sub>, C<sub>r</sub>, OCR, c<sub>v</sub></span>',
      '          </div>',
      '          <div class="grid grid-cols-2 p-1 rounded-lg bg-slate-100 border border-slate-200/80 gap-1" role="group" aria-label="Soil stratigraphy source">',
      '            <button id="p4-btn-soil-auto" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs">Auto from Module P1</button>',
      '            <button id="p4-btn-soil-manual" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900">Manual Soil Override</button>',
      '          </div>',
      '        </div>',

      '        <!-- Auto from P1 Summary Panel -->',
      '        <div id="p4-panel-auto-soil" class="p-4">',
      '          <div id="p4-auto-soil-body" class="space-y-2 text-xs text-slate-600"></div>',
      '        </div>',

      '        <!-- Manual Soil Override Editable Table Panel -->',
      '        <div id="p4-panel-manual-soil" class="hidden">',
      '          <div class="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <span class="text-[11px] text-slate-500">Edit custom layers (strict SI units)</span>',
      '            <button id="p4-btn-add-manual-layer" type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer">+ Add Layer</button>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full border-collapse text-[11px]">',
      '              <thead>',
      '                <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">',
      '                  <th class="px-2 py-2 text-left min-w-[115px]">Soil Type</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[64px]">z<sub>top</sub> (m)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[64px]">z<sub>bot</sub> (m)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[74px]">&gamma;<sub>m</sub> (kN/m&sup3;)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[76px]">&gamma;<sub>sat</sub> (kN/m&sup3;)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[78px]">E&prime; (kPa)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[60px]">e<sub>0</sub> (-)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[64px]">C<sub>c</sub> (-)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[64px]">C<sub>r</sub> (-)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[60px]">OCR (-)</th>',
      '                  <th class="px-1.5 py-2 text-right min-w-[78px]">c<sub>v</sub> (mm&sup2;/s)</th>',
      '                  <th class="px-1.5 py-2 text-center w-9">Del</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p4-manual-soil-tbody" class="divide-y divide-slate-100 bg-white"></tbody>',
      '            </table>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',

      '    <!-- ================================================================ -->',
      '    <!-- 3. RIGHT RESULTS WORKSPACE (ALERTS, KPIS, 3 CHARTS, TABLE, AUDIT)-->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-8 space-y-4">',

      '      <!-- Blocking Validation Error Banner -->',
      '      <div id="p4-error-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '        <div class="flex items-start gap-3">',
      '          <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '          </div>',
      '          <div class="flex-1">',
      '            <h3 class="text-sm font-semibold text-rose-900">IS 8009 Settlement Input Validation Failed</h3>',
      '            <p class="text-xs text-rose-700 mt-0.5">Resolve the following issues to compute elastic and consolidation settlement:</p>',
      '            <ul id="p4-error-list" class="mt-2 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Non-Blocking Engineering Advisory Banner -->',
      '      <div id="p4-warning-banner" class="hidden rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-amber-950 shadow-sm" role="status">',
      '        <div class="flex items-start gap-3">',
      '          <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '          </div>',
      '          <div class="flex-1">',
      '            <h3 class="text-sm font-semibold text-amber-950">Engineering Serviceability Advisories</h3>',
      '            <ul id="p4-warning-list" class="mt-1.5 list-disc list-inside space-y-1 text-xs font-mono text-amber-900"></ul>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Valid Results Workspace -->',
      '      <div id="p4-results-workspace" class="space-y-4">',

      '        <!-- 5 KPI Telemetry Cards -->',
      '        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">',
      '          <div id="p4-kpi-stot-card" class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-3.5">',
      '            <div class="flex items-center justify-between gap-1">',
      '              <span class="text-[11px] font-medium text-slate-600">Total S<sub>tot</sub></span>',
      '              <span id="p4-kpi-stot-badge" class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">PASS</span>',
      '            </div>',
      '            <p id="p4-kpi-stot-val" class="mt-1.5 text-lg font-bold font-mono text-slate-900 tracking-tight">—</p>',
      '            <p id="p4-kpi-stot-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">Limit: 50.0 mm</p>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-indigo-600 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-indigo-700">Elastic S<sub>e</sub></span>',
      '            <p id="p4-kpi-se-val" class="mt-1.5 text-lg font-bold font-mono text-indigo-700 tracking-tight">—</p>',
      '            <p id="p4-kpi-se-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">—</p>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-sky-700">Consolidation S<sub>c</sub></span>',
      '            <p id="p4-kpi-sc-val" class="mt-1.5 text-lg font-bold font-mono text-sky-700 tracking-tight">—</p>',
      '            <p id="p4-kpi-sc-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">—</p>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-amber-700">At Target Time S(t)</span>',
      '            <p id="p4-kpi-st-val" class="mt-1.5 text-lg font-bold font-mono text-amber-700 tracking-tight">—</p>',
      '            <p id="p4-kpi-st-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">—</p>',
      '          </div>',

      '          <div class="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm p-3.5 sm:col-span-2 lg:col-span-1">',
      '            <span class="text-[11px] font-medium text-sky-300">Loading &amp; Time-Rate</span>',
      '            <p id="p4-kpi-meta-stress" class="mt-1 text-xs font-bold font-mono text-white truncate">—</p>',
      '            <p id="p4-kpi-meta-load" class="text-[11px] font-mono text-emerald-300 truncate">—</p>',
      '            <p id="p4-kpi-meta-rf" class="text-[10px] font-mono text-slate-300 truncate">—</p>',
      '            <p id="p4-kpi-meta-times" class="mt-0.5 text-[10px] font-mono text-amber-300 truncate">—</p>',
      '          </div>',
      '        </div>',

      '        <!-- Charts Row 1: Subsurface Stress Profile + Load-Settlement Sensitivity -->',
      '        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">',
      '          <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '            <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '              <div>',
      '                <h3 class="text-sm font-semibold text-slate-900">Subsurface Stress Profile</h3>',
      '                <p class="text-[11px] text-slate-500">In-situ &sigma;&prime;<sub>v0</sub>, increment &Delta;&sigma;<sub>z</sub>, and final &sigma;&prime;<sub>vf</sub> (kPa) vs. depth z (m).</p>',
      '              </div>',
      '              <span class="text-[10px] font-mono text-slate-400">kPa vs m</span>',
      '            </div>',
      '            <div class="p-3">',
      '              <div id="p4-stress-plot" class="w-full h-[350px]"></div>',
      '            </div>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '            <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '              <div>',
      '                <h3 class="text-sm font-semibold text-slate-900">Load&ndash;Settlement Sensitivity</h3>',
      '                <p class="text-[11px] text-slate-500">S<sub>e</sub>, S<sub>c</sub>, and S<sub>tot</sub> (mm) vs. net contact stress q<sub>0</sub> (kPa) with IS 1904 limit.</p>',
      '              </div>',
      '              <span class="text-[10px] font-mono text-slate-400">0.25q<sub>0</sub>&ndash;2.0q<sub>0</sub></span>',
      '            </div>',
      '            <div class="p-3">',
      '              <div id="p4-load-plot" class="w-full h-[350px]"></div>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Charts Row 2: Time-Rate of Consolidation (Full Width of Right Workspace) -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">',
      '            <div>',
      '              <h3 class="text-sm font-semibold text-slate-900">1D Terzaghi Time-Rate of Consolidation</h3>',
      '              <p class="text-[11px] text-slate-500">Total settlement S(t) (mm) and average degree of consolidation U(t) (%) vs. log time t (days).</p>',
      '            </div>',
      '            <span id="p4-timerate-badge" class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-medium">—</span>',
      '          </div>',
      '          <div class="p-3 relative">',
      '            <div id="p4-timerate-plot" class="w-full h-[330px]"></div>',
      '            <div id="p4-timerate-empty" class="hidden absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50/70">',
      '              <p class="text-xs font-semibold text-slate-700">Time-Rate Curve Not Applicable</p>',
      '              <p class="mt-1 text-[11px] text-slate-500 max-w-md">Enable time-rate calculation and ensure at least one consolidating cohesive stratum with S<sub>c</sub> &gt; 0 mm exists below D<sub>f</sub>.</p>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Layer-by-Layer Settlement Breakdown Table -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <div>',
      '              <h3 class="text-sm font-semibold text-slate-900">Layer-by-Layer Settlement Breakdown</h3>',
      '              <p class="text-[11px] text-slate-500">Sub-layer integrated stress increments and individual elastic &amp; consolidation contributions below D<sub>f</sub>.</p>',
      '            </div>',
      '            <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">SI OUTPUT (mm)</span>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '              <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '                <tr>',
      '                  <th class="px-3.5 py-2.5 text-left">Layer &amp; Depth (m)</th>',
      '                  <th class="px-3 py-2.5 text-left">Behavior / Regime</th>',
      '                  <th class="px-3 py-2.5 text-right">Avg &sigma;&prime;<sub>v0</sub> / &Delta;&sigma;<sub>z</sub> (kPa)</th>',
      '                  <th class="px-3 py-2.5 text-left">Modulus &amp; Compressibility</th>',
      '                  <th class="px-3 py-2.5 text-right">S<sub>e</sub> (mm)</th>',
      '                  <th class="px-3 py-2.5 text-right">S<sub>c</sub> (mm)</th>',
      '                  <th class="px-3.5 py-2.5 text-right">S<sub>tot</sub> (mm)</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p4-layer-tbody" class="divide-y divide-slate-100"></tbody>',
      '              <tfoot id="p4-layer-tfoot" class="bg-slate-50/90 border-t-2 border-slate-200 font-mono text-xs font-bold text-slate-900"></tfoot>',
      '            </table>',
      '          </div>',
      '        </div>',

      '        <!-- Collapsible Step-by-Step IS 8009 Calculation Audit -->',
      '        <details open class="group bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <summary class="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/80 transition-colors list-none">',
      '            <div class="flex items-center gap-2">',
      '              <svg class="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      '              <h3 class="text-sm font-semibold text-slate-900">Step-by-Step IS 8009 Calculation Audit</h3>',
      '            </div>',
      '            <span id="p4-steps-count" class="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-medium">0 steps</span>',
      '          </summary>',
      '          <div id="p4-steps-container" class="p-4 space-y-2 bg-slate-50/40"></div>',
      '        </details>',

      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("\n");

    // Cache DOM references
    els.syncBadge = container.querySelector("#p4-sync-badge");
    els.btnSyncP3 = container.querySelector("#p4-btn-sync-p3");
    els.btnResetP4 = container.querySelector("#p4-btn-reset");

    els.selectFootingType = container.querySelector("#p4-footing-type");
    els.selectShape = container.querySelector("#p4-shape");
    els.selectWaterTableMode = container.querySelector("#p4-wt-mode");
    els.selectStressMethod = container.querySelector("#p4-stress-method");
    els.selectElasticMethod = container.querySelector("#p4-elastic-method");

    els.labelB = container.querySelector("#p4-label-B");
    els.inputB = container.querySelector("#p4-B");
    els.labelL = container.querySelector("#p4-label-L");
    els.inputL = container.querySelector("#p4-L");
    els.hintL = container.querySelector("#p4-hint-L");
    els.inputDf = container.querySelector("#p4-Df");
    els.btnLoadStress = container.querySelector("#p4-btn-load-stress");
    els.btnLoadTotal = container.querySelector("#p4-btn-load-total");
    els.wrapStressInput = container.querySelector("#p4-wrap-stress");
    els.wrapLoadInput = container.querySelector("#p4-wrap-load");
    els.inputContactStress = container.querySelector("#p4-contact-stress");
    els.inputAppliedLoad = container.querySelector("#p4-applied-load");
    els.unitAppliedLoad = container.querySelector("#p4-unit-applied-load");
    els.labelAppliedLoad = container.querySelector("#p4-label-applied-load");
    els.inputAllowable = container.querySelector("#p4-allowable");
    els.presetButtons = container.querySelectorAll(".p4-preset-btn");
    els.inputNuDefault = container.querySelector("#p4-nu-default");
    els.inputSubdivision = container.querySelector("#p4-subdivision");

    els.checkTimeRate = container.querySelector("#p4-check-timerate");
    els.selectDrainage = container.querySelector("#p4-drainage");
    els.labelTargetTime = container.querySelector("#p4-label-target-time");
    els.inputTargetTime = container.querySelector("#p4-target-time");
    els.targetTimeYrBadge = container.querySelector("#p4-target-time-yr");
    els.btnSoilAuto = container.querySelector("#p4-btn-soil-auto");
    els.btnSoilManual = container.querySelector("#p4-btn-soil-manual");
    els.panelAutoSoil = container.querySelector("#p4-panel-auto-soil");
    els.autoSoilBody = container.querySelector("#p4-auto-soil-body");
    els.panelManualSoil = container.querySelector("#p4-panel-manual-soil");
    els.btnAddManualLayer = container.querySelector("#p4-btn-add-manual-layer");
    els.manualSoilTbody = container.querySelector("#p4-manual-soil-tbody");

    els.errorBanner = container.querySelector("#p4-error-banner");
    els.errorList = container.querySelector("#p4-error-list");
    els.warningBanner = container.querySelector("#p4-warning-banner");
    els.warningList = container.querySelector("#p4-warning-list");

    els.resultsWorkspace = container.querySelector("#p4-results-workspace");
    els.kpiStotCard = container.querySelector("#p4-kpi-stot-card");
    els.kpiStotVal = container.querySelector("#p4-kpi-stot-val");
    els.kpiStotBadge = container.querySelector("#p4-kpi-stot-badge");
    els.kpiStotSub = container.querySelector("#p4-kpi-stot-sub");
    els.kpiSeVal = container.querySelector("#p4-kpi-se-val");
    els.kpiSeSub = container.querySelector("#p4-kpi-se-sub");
    els.kpiScVal = container.querySelector("#p4-kpi-sc-val");
    els.kpiScSub = container.querySelector("#p4-kpi-sc-sub");
    els.kpiStVal = container.querySelector("#p4-kpi-st-val");
    els.kpiStSub = container.querySelector("#p4-kpi-st-sub");
    els.kpiMetaStress = container.querySelector("#p4-kpi-meta-stress");
    els.kpiMetaLoad = container.querySelector("#p4-kpi-meta-load");
    els.kpiMetaRf = container.querySelector("#p4-kpi-meta-rf");
    els.kpiMetaTimes = container.querySelector("#p4-kpi-meta-times");

    els.stressPlotDiv = container.querySelector("#p4-stress-plot");
    els.timeRatePlotDiv = container.querySelector("#p4-timerate-plot");
    els.timeRateEmpty = container.querySelector("#p4-timerate-empty");
    els.timeRateHeaderBadge = container.querySelector("#p4-timerate-badge");
    els.loadPlotDiv = container.querySelector("#p4-load-plot");

    els.layerBreakdownTbody = container.querySelector("#p4-layer-tbody");
    els.layerBreakdownTfoot = container.querySelector("#p4-layer-tfoot");
    els.stepsCount = container.querySelector("#p4-steps-count");
    els.stepsContainer = container.querySelector("#p4-steps-container");
  }

  /**
   * Synchronizes input controls from state.p4Input WITHOUT disturbing cursor focus
   * unless forceSync === true (used on init, Sync from P3, or Reset P4 Sample).
   */
  function syncInputsFromState(input, forceSync) {
    if (!input) {
      return;
    }

    function setControlVal(el, val) {
      if (!el) return;
      if (!forceSync && document.activeElement === el) {
        return;
      }
      if (typeof val === "number") {
        el.value = Number.isFinite(val) ? String(val) : "";
      } else {
        el.value = val !== null && val !== undefined ? String(val) : "";
      }
    }

    setControlVal(els.selectFootingType, input.footingType);
    setControlVal(els.selectShape, input.shape);
    setControlVal(els.selectWaterTableMode, input.waterTableMode || "Design");
    setControlVal(els.selectStressMethod, input.stressDistributionMethod);
    setControlVal(els.selectElasticMethod, input.elasticMethod);

    setControlVal(els.inputB, input.B_m);
    setControlVal(els.inputDf, input.Df_m);
    setControlVal(els.inputAllowable, input.allowableSettlement_mm);
    setControlVal(els.inputNuDefault, input.poissonRatioDefault);
    setControlVal(els.inputSubdivision, input.consolidationSubdivision_m);
    setControlVal(els.selectDrainage, input.drainageCondition);
    setControlVal(els.inputTargetTime, input.targetTime_days);

    // Shape-dependent labels, syncing & placeholder management for B and L
    var shape = input.shape;
    if (shape === "Circular") {
      els.labelB.textContent = "Diameter B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      els.inputL.placeholder = "";
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = isFiniteNum(input.B_m) ? String(input.B_m) : "";
      }
      els.hintL.textContent = "L = B (Circular)";
      els.hintL.classList.remove("hidden");
    } else if (shape === "Square") {
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      els.inputL.placeholder = "";
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = isFiniteNum(input.B_m) ? String(input.B_m) : "";
      }
      els.hintL.textContent = "L = B (Square)";
      els.hintL.classList.remove("hidden");
    } else if (shape === "Strip") {
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = "";
        els.inputL.placeholder = "∞ (Strip)";
      }
      els.hintL.textContent = "Per m run";
      els.hintL.classList.remove("hidden");
    } else {
      // Rectangular
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = false;
      els.inputL.placeholder = "";
      setControlVal(els.inputL, input.L_m);
      els.hintL.classList.add("hidden");
    }

    // Load unit labels (kN vs kN/m for Strip)
    var loadUnit = shape === "Strip" ? "kN/m" : "kN";
    els.unitAppliedLoad.textContent = loadUnit;
    els.labelAppliedLoad.innerHTML = "Net Load Q<sub>net</sub> (" + loadUnit + ")";

    // Segmented Load Input Mode toggle & derived counterpart display
    var area = computeFootprintArea(input);
    var isStressMode = input.loadInputMode !== "Total Load";

    if (isStressMode) {
      els.btnLoadStress.className =
        "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs";
      els.btnLoadTotal.className =
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900";
      els.wrapStressInput.className =
        "rounded-lg p-2 border border-indigo-200 bg-indigo-50/40 transition-colors";
      els.wrapLoadInput.className =
        "rounded-lg p-2 border border-slate-200 bg-slate-50/50 transition-colors";

      els.inputContactStress.disabled = false;
      els.inputAppliedLoad.disabled = true;
      setControlVal(els.inputContactStress, input.contactStress_kPa);
      var derivedQ =
        isFiniteNum(input.contactStress_kPa) && isFiniteNum(area)
          ? Number((input.contactStress_kPa * area).toFixed(2))
          : NaN;
      setControlVal(els.inputAppliedLoad, derivedQ);
    } else {
      els.btnLoadTotal.className =
        "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs";
      els.btnLoadStress.className =
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900";
      els.wrapLoadInput.className =
        "rounded-lg p-2 border border-indigo-200 bg-indigo-50/40 transition-colors";
      els.wrapStressInput.className =
        "rounded-lg p-2 border border-slate-200 bg-slate-50/50 transition-colors";

      els.inputAppliedLoad.disabled = false;
      els.inputContactStress.disabled = true;
      setControlVal(els.inputAppliedLoad, input.appliedLoad_kN);
      var derivedQ0 =
        isFiniteNum(input.appliedLoad_kN) && isFiniteNum(area) && area > 0
          ? Number((input.appliedLoad_kN / area).toFixed(2))
          : NaN;
      setControlVal(els.inputContactStress, derivedQ0);
    }

    // IS 1904 Preset Pill Highlights
    if (els.presetButtons) {
      els.presetButtons.forEach(function (btn) {
        var presetVal = Number(btn.getAttribute("data-p4-preset"));
        var active =
          isFiniteNum(input.allowableSettlement_mm) &&
          Math.abs(input.allowableSettlement_mm - presetVal) < 1e-6;
        btn.className = active
          ? "p4-preset-btn px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border border-indigo-400 bg-indigo-50 text-indigo-700 transition-colors cursor-pointer"
          : "p4-preset-btn px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer";
      });
    }

    // Time-Rate controls & Schmertmann (1978) C2 creep time availability
    var trEnabled = Boolean(input.timeRateCalc);
    var isSchmertmann = input.elasticMethod === "Schmertmann (1978)";
    els.checkTimeRate.checked = trEnabled;
    els.selectDrainage.disabled = !trEnabled;
    els.inputTargetTime.disabled = !trEnabled && !isSchmertmann;
    els.labelTargetTime.innerHTML =
      !trEnabled && isSchmertmann ? "Creep Time (C<sub>2</sub>)" : "Target Time";
    els.targetTimeYrBadge.textContent =
      isFiniteNum(input.targetTime_days) && input.targetTime_days > 0
        ? (input.targetTime_days / DAYS_PER_YEAR).toFixed(2) + " yr"
        : "—";

    // Soil source segmented toggle visual state
    var isManual = Boolean(input.overrideSoilParams);
    if (isManual) {
      els.btnSoilManual.className =
        "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs";
      els.btnSoilAuto.className =
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900";
      els.panelManualSoil.classList.remove("hidden");
      els.panelAutoSoil.classList.add("hidden");
    } else {
      els.btnSoilAuto.className =
        "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs";
      els.btnSoilManual.className =
        "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900";
      els.panelAutoSoil.classList.remove("hidden");
      els.panelManualSoil.classList.add("hidden");
    }
  }

  /**
   * Renders the editable Manual Soil Override table. Called ONLY on init,
   * toggle-to-manual, Add Layer, Delete Layer, or Reset — never on numeric typing.
   */
  function renderManualLayersTable() {
    var state = getState();
    var layers = (state && state.p4Input && state.p4Input.manualSoilLayers) || [];
    var soilOptions =
      (global.ModuleP1Logic && global.ModuleP1Logic.SOIL_TYPES) || [
        "Clay (CL/CH)",
        "Silt (ML/MH)",
        "Sand (SW/SP)",
        "Gravel (GW/GP)",
        "Peat (Pt)",
        "Rock / Bedrock"
      ];

    if (layers.length === 0) {
      els.manualSoilTbody.innerHTML =
        '<tr><td colspan="12" class="px-3 py-5 text-center text-xs text-slate-400">No manual soil layers defined. Click "+ Add Layer" above.</td></tr>';
      return;
    }

    var rowsHtml = layers.map(function (lyr, idx) {
      var optsHtml = soilOptions
        .map(function (st) {
          var sel = lyr.soilType === st ? " selected" : "";
          return '<option value="' + escapeHtml(st) + '"' + sel + ">" + escapeHtml(st) + "</option>";
        })
        .join("");

      function cell(field, step, val) {
        var safeVal = isFiniteNum(val) ? val : "";
        return (
          '<td class="px-1 py-1">' +
          '<input type="number" step="' + step + '" data-m-row="' + idx + '" data-m-field="' + field + '" value="' + safeVal + '" ' +
          'class="p4-manual-input clean-num w-full rounded border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-indigo-500 px-1.5 py-1 text-right font-mono text-[11px] text-slate-800 outline-none" />' +
          "</td>"
        );
      }

      return [
        '<tr class="hover:bg-slate-50/70">',
        '  <td class="px-1.5 py-1">',
        '    <select data-m-row="' + idx + '" data-m-field="soilType" class="p4-manual-select w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-800 outline-none focus:border-indigo-500">' +
              optsHtml +
        "    </select>",
        "  </td>",
        cell("z_top", "0.5", lyr.z_top),
        cell("z_bot", "0.5", lyr.z_bot),
        cell("gamma_moist", "0.5", lyr.gamma_moist),
        cell("gamma_sat", "0.5", lyr.gamma_sat),
        cell("E_prime", "500", lyr.E_prime),
        cell("e0", "0.05", lyr.e0),
        cell("Cc", "0.01", lyr.Cc),
        cell("Cr", "0.005", lyr.Cr),
        cell("OCR", "0.1", lyr.OCR),
        cell("cv", "0.005", lyr.cv),
        '  <td class="px-1 py-1 text-center">',
        '    <button type="button" data-delete-manual="' + idx + '" class="p4-manual-del-btn inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Layer">',
        '      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/></svg>',
        "    </button>",
        "  </td>",
        "</tr>"
      ].join("");
    });

    els.manualSoilTbody.innerHTML = rowsHtml.join("");
  }

  /**
   * Updates top Live Sync Status badge (Auto P1, Manual Override, or P1 Error).
   */
  function updateSyncBadge(state) {
    var inp = state.p4Input || {};
    var isManual = Boolean(inp.overrideSoilParams);
    var wtMode = inp.waterTableMode === "Measured" ? "Measured" : "Design";
    var zw = wtMode === "Measured" ? state.zw_measured : state.zw_design;
    var hasP1Errors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;
    var hasLayers = Array.isArray(state.processedLayers) && state.processedLayers.length > 0;

    if (isManual) {
      els.syncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25";
      els.syncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>' +
        "Manual Soil Override · " +
        escapeHtml(wtMode) +
        " WT z<sub>w</sub> = " +
        formatNum(zw, 2) +
        " m";
    } else if (hasP1Errors || !hasLayers) {
      var errCount = hasP1Errors ? state.validationErrors.length : 0;
      var msg = hasP1Errors
        ? "P1 Profile Has " + errCount + (errCount === 1 ? " Error" : " Errors") + " — Fix P1 or Use Manual Override"
        : "No Valid P1 Profile — Fix P1 or Use Manual Override";

      els.syncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/25";
      els.syncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>' + escapeHtml(msg);
    } else {
      els.syncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
      els.syncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' +
        "Auto (P1 Stratigraphy) · " +
        escapeHtml(wtMode) +
        " WT z<sub>w</sub> = " +
        formatNum(zw, 2) +
        " m";
    }
  }

  /**
   * Renders compact Auto-P1 active strata summary below Df inside Card C.
   */
  function renderAutoSoilSummary(state, out) {
    if (state.p4Input.overrideSoilParams) {
      return;
    }

    var hasP1Errors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;
    if (hasP1Errors) {
      els.autoSoilBody.innerHTML =
        '<p class="text-rose-700 font-medium">Module P1 stratigraphy currently has validation errors. Resolve them in Tab P1 or switch to Manual Soil Override.</p>';
      return;
    }

    var breakdown = out && Array.isArray(out.layerBreakdown) ? out.layerBreakdown : [];
    if (breakdown.length === 0) {
      els.autoSoilBody.innerHTML =
        '<p class="text-slate-500">Adjust embedment depth D<sub>f</sub> within the Module P1 profile to inspect active compressible strata below the footing base.</p>';
      return;
    }

    var cardsHtml = breakdown.map(function (lb) {
      var tagHtml = lb.isConsolidating
        ? '<span class="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 text-[10px] font-semibold">Consolidating</span>'
        : '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">Elastic Only</span>';

      var paramsLine = lb.isConsolidating
        ? "E&prime;=" + formatNum(lb.E_prime_kPa, 0) + " kPa &middot; C<sub>c</sub>=" + formatNum(lb.Cc, 3) + " &middot; OCR=" + formatNum(lb.OCR, 2) + " &middot; c<sub>v</sub>=" + formatNum(lb.cv, 3) + " mm&sup2;/s"
        : "E&prime;=" + formatNum(lb.E_prime_kPa, 0) + " kPa &middot; &nu;&prime;=" + formatNum(lb.nu_prime, 2);

      return [
        '<div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2 space-y-1">',
        '  <div class="flex items-center justify-between gap-2">',
        '    <span class="font-semibold text-slate-800 truncate">L' + lb.layerIndex + " " + escapeHtml(lb.soilType) + " (" + formatNum(lb.z_top, 2) + "&ndash;" + formatNum(lb.z_bot, 2) + " m)</span>",
        "    " + tagHtml,
        "  </div>",
        '  <p class="font-mono text-[10px] text-slate-500">' + paramsLine + "</p>",
        "</div>"
      ].join("");
    });

    els.autoSoilBody.innerHTML =
      '<div class="flex items-center justify-between text-[11px] mb-1.5"><span class="font-medium text-slate-500">Active P1 Strata Below D<sub>f</sub></span><span class="font-mono text-indigo-700 font-semibold">' +
      breakdown.length +
      (breakdown.length === 1 ? " layer" : " layers") +
      "</span></div>" +
      cardsHtml.join("");
  }

  /**
   * Renders the Layer-by-Layer Settlement Breakdown Table + bold Totals footer.
   */
  function renderLayerBreakdownTable(out) {
    var rows = out.layerBreakdown || [];
    var totSe = out.elasticSettlement_mm;
    var totSc = out.consolidationSettlement_mm;
    var totS = out.totalSettlement_mm;
    var denom = totS > 1e-9 ? totS : 1.0;

    if (rows.length === 0) {
      els.layerBreakdownTbody.innerHTML =
        '<tr><td colspan="7" class="px-4 py-6 text-center text-xs text-slate-400">No strata below footing base.</td></tr>';
      els.layerBreakdownTfoot.innerHTML = "";
      return;
    }

    els.layerBreakdownTbody.innerHTML = rows
      .map(function (r) {
        var sharePct = ((r.Stot_i / denom) * 100.0).toFixed(1);
        var regimeBadge = r.isConsolidating
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20">' + escapeHtml(r.consolidationRegime) + "</span>"
          : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">' + escapeHtml(r.consolidationRegime) + "</span>";

        var modLine = r.isConsolidating
          ? "E&prime; = " + formatNum(r.E_prime_kPa, 0) + " kPa<br><span class=\"text-[10px] text-slate-500\">C<sub>c</sub>=" + formatNum(r.Cc, 3) + " &middot; C<sub>r</sub>=" + formatNum(r.Cr, 3) + " &middot; OCR=" + formatNum(r.OCR, 2) + "</span>"
          : "E&prime; = " + formatNum(r.E_prime_kPa, 0) + " kPa<br><span class=\"text-[10px] text-slate-500\">&nu;&prime; = " + formatNum(r.nu_prime, 2) + " (Granular)</span>";

        return [
          '<tr class="hover:bg-slate-50/80 transition-colors">',
          '  <td class="px-3.5 py-2.5 whitespace-nowrap">',
          '    <div class="font-semibold text-slate-800">L' + r.layerIndex + " &middot; " + escapeHtml(r.soilType) + "</div>",
          '    <div class="font-mono text-[10px] text-slate-500">' + formatNum(r.z_top, 2) + "&ndash;" + formatNum(r.z_bot, 2) + " m (H=" + formatNum(r.thickness_m, 2) + " m, " + r.subLayerCount + " sub)</div>",
          "  </td>",
          '  <td class="px-3 py-2.5 whitespace-nowrap">' + regimeBadge + "</td>",
          '  <td class="px-3 py-2.5 text-right font-mono whitespace-nowrap">',
          '    <div class="text-slate-800">&sigma;&prime;<sub>v0</sub>: ' + formatNum(r.sigma_v0_kPa, 1) + " kPa</div>",
          '    <div class="text-indigo-700 text-[11px]">&Delta;&sigma;<sub>z</sub>: ' + formatNum(r.delta_sigma_z, 1) + " kPa</div>",
          "  </td>",
          '  <td class="px-3 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">' + modLine + "</td>",
          '  <td class="px-3 py-2.5 text-right font-mono text-indigo-700 whitespace-nowrap">' + formatNum(r.Se_i, 2) + " mm</td>",
          '  <td class="px-3 py-2.5 text-right font-mono text-sky-700 whitespace-nowrap">' + formatNum(r.Sc_i, 2) + " mm</td>",
          '  <td class="px-3.5 py-2.5 text-right font-mono whitespace-nowrap">',
          '    <div class="font-semibold text-slate-900">' + formatNum(r.Stot_i, 2) + " mm</div>",
          '    <div class="text-[10px] text-slate-400">' + sharePct + "%</div>",
          "  </td>",
          "</tr>"
        ].join("");
      })
      .join("");

    els.layerBreakdownTfoot.innerHTML = [
      "<tr>",
      '  <td colspan="4" class="px-3.5 py-2.5 font-sans text-slate-700">Total Foundation Settlement (S<sub>tot</sub> = S<sub>e</sub> + S<sub>c</sub>)</td>',
      '  <td class="px-3 py-2.5 text-right text-indigo-700 whitespace-nowrap">' + formatNum(totSe, 2) + " mm</td>",
      '  <td class="px-3 py-2.5 text-right text-sky-700 whitespace-nowrap">' + formatNum(totSc, 2) + " mm</td>",
      '  <td class="px-3.5 py-2.5 text-right text-slate-900 whitespace-nowrap">' + formatNum(totS, 2) + " mm (100%)</td>",
      "</tr>"
    ].join("");
  }

  // ---------------------------------------------------------------------------
  // PLOTLY.JS INTERACTIVE CHARTS (Strict Real Unicode — ZERO HTML Entities)
  // ---------------------------------------------------------------------------

  /**
   * 1. Subsurface Stress Profile (#p4-stress-plot)
   * Depth z (m, reversed y-axis) vs. σ'_v0, Δσ_z, and σ'_vf (kPa) with Df & zw markers.
   */
  function renderStressPlot(state, out, meta) {
    if (typeof global.Plotly === "undefined" || !els.stressPlotDiv) {
      return;
    }

    var profile = out.stressProfile || [];
    if (profile.length === 0) {
      return;
    }

    var zVals = [];
    var sigV0 = [];
    var dSig = [];
    var sigVf = [];
    var hoverV0 = [];
    var hoverDSig = [];
    var hoverVf = [];

    for (var i = 0; i < profile.length; i++) {
      var p = profile[i];
      zVals.push(p.z_m);
      sigV0.push(p.sigma_v0_kPa);
      dSig.push(p.delta_sigma_z_kPa);
      sigVf.push(p.sigma_vf_kPa);

      hoverV0.push(
        "Depth z = " + p.z_m.toFixed(2) + " m (z' = " + p.z_below_base_m.toFixed(2) + " m below base)" +
        "<br>In-Situ Effective Stress σ'_v0 = " + p.sigma_v0_kPa.toFixed(2) + " kPa"
      );
      hoverDSig.push(
        "Depth z = " + p.z_m.toFixed(2) + " m (z' = " + p.z_below_base_m.toFixed(2) + " m below base)" +
        "<br>Stress Increment Δσ_z = " + p.delta_sigma_z_kPa.toFixed(2) + " kPa" +
        "<br>Influence Factor I_σ = " + p.influenceFactor_I.toFixed(3)
      );
      hoverVf.push(
        "Depth z = " + p.z_m.toFixed(2) + " m" +
        "<br>Final Effective Stress σ'_vf = " + p.sigma_vf_kPa.toFixed(2) + " kPa"
      );
    }

    var Df_m = state.p4Input.Df_m;
    var zw_m = meta.zw_m;
    var wtLabel = state.p4Input.waterTableMode || "Design";

    var traces = [
      {
        type: "scatter",
        mode: "lines",
        name: "In-Situ σ'_v0 (kPa)",
        x: sigV0,
        y: zVals,
        text: hoverV0,
        hoverinfo: "text",
        line: { color: "#64748b", width: 2, dash: "dot" }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Increment Δσ_z (kPa)",
        x: dSig,
        y: zVals,
        text: hoverDSig,
        hoverinfo: "text",
        fill: "tozerox",
        fillcolor: "rgba(79, 70, 229, 0.08)",
        line: { color: "#4f46e5", width: 2.5 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Final σ'_vf (kPa)",
        x: sigVf,
        y: zVals,
        text: hoverVf,
        hoverinfo: "text",
        line: { color: "#0284c7", width: 2.5 }
      }
    ];

    var shapes = [
      {
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: Df_m,
        y1: Df_m,
        line: { color: "#0f172a", width: 1.6, dash: "dash" }
      }
    ];

    var annotations = [
      {
        xref: "paper",
        x: 0.99,
        yref: "y",
        y: Df_m,
        xanchor: "right",
        yanchor: "top",
        text: "Footing Base D_f (" + Df_m.toFixed(2) + " m)",
        showarrow: false,
        font: { size: 9.5, color: "#0f172a", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(248, 250, 252, 0.92)",
        bordercolor: "#cbd5e1",
        borderwidth: 1,
        borderpad: 2
      }
    ];

    if (isFiniteNum(zw_m)) {
      shapes.push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: zw_m,
        y1: zw_m,
        line: { color: "#0284c7", width: 1.6, dash: "dash" }
      });

      var wtBelowDf = zw_m > Df_m + 0.35;
      annotations.push({
        xref: "paper",
        x: wtBelowDf ? 0.99 : 0.01,
        yref: "y",
        y: zw_m,
        xanchor: wtBelowDf ? "right" : "left",
        yanchor: "bottom",
        text: wtLabel + " WT (" + zw_m.toFixed(2) + " m)",
        showarrow: false,
        font: { size: 9.5, color: "#0369a1", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(240, 249, 255, 0.92)",
        bordercolor: "#bae6fd",
        borderwidth: 1,
        borderpad: 2
      });

      // Invisible depth anchor if WT sits above Df so autorange: "reversed" includes WT cleanly
      if (zw_m < Df_m) {
        traces.push({
          type: "scatter",
          mode: "markers",
          x: [0],
          y: [Math.max(0, zw_m - 0.1)],
          marker: { opacity: 0, size: 1 },
          hoverinfo: "skip",
          showlegend: false
        });
      }
    }

    var layout = {
      margin: { l: 56, r: 16, t: 38, b: 44 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Vertical Stress (kPa)",
          font: { size: 11, color: "#475569" }
        },
        rangemode: "tozero",
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Depth below Ground Surface, z (m)",
          font: { size: 11, color: "#475569" }
        },
        autorange: "reversed",
        gridcolor: "#f1f5f9",
        zerolinecolor: "#94a3b8",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      shapes: shapes,
      annotations: annotations,
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 1.12,
        yanchor: "bottom",
        font: { size: 10, color: "#334155" }
      },
      hoverlabel: {
        bgcolor: "#0f172a",
        bordercolor: "#4f46e5",
        font: { color: "#f8fafc", size: 11, family: "Inter, system-ui, sans-serif" }
      },
      plot_bgcolor: "#ffffff",
      paper_bgcolor: "#ffffff",
      hovermode: "closest"
    };

    var config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
    };

    global.Plotly.react(els.stressPlotDiv, traces, layout, config);
  }

  /**
   * 2. Time-Rate of Consolidation (#p4-timerate-plot)
   * Log-scale Time t (days) vs. S(t) (mm) on y1 and U(t) (%) on y2,
   * highlighting target time diamond, t50, and t90.
   */
  function renderTimeRatePlot(out) {
    if (typeof global.Plotly === "undefined" || !els.timeRatePlotDiv) {
      return;
    }

    var curve = out.timeRateCurve || [];
    var sum = out.timeRateSummary;

    if (curve.length === 0 || !sum) {
      els.timeRateEmpty.classList.remove("hidden");
      els.timeRateHeaderBadge.textContent = "Inactive / Elastic Only";
      if (els.timeRatePlotDiv.data) {
        global.Plotly.purge(els.timeRatePlotDiv);
      }
      return;
    }

    els.timeRateEmpty.classList.add("hidden");
    els.timeRateHeaderBadge.textContent =
      sum.governingLayerName + " · H_d = " + formatNum(sum.Hd_m, 2) + " m (" + sum.drainageCondition + ")";

    var tVals = [];
    var stVals = [];
    var utVals = [];
    var hoverSt = [];
    var hoverUt = [];

    for (var i = 0; i < curve.length; i++) {
      var pt = curve[i];
      tVals.push(pt.t_days);
      stVals.push(pt.St_mm);
      utVals.push(pt.Ut_pct);

      hoverSt.push(
        "Time t = " + pt.t_days.toFixed(1) + " days (" + pt.t_yr.toFixed(2) + " yr)" +
        "<br>Time Factor T_v = " + pt.Tv.toFixed(3) +
        "<br>Total Settlement S(t) = " + pt.St_mm.toFixed(2) + " mm" +
        "<br>Consolidation S_c(t) = " + pt.Sc_t_mm.toFixed(2) + " mm"
      );
      hoverUt.push(
        "Time t = " + pt.t_days.toFixed(1) + " days (" + pt.t_yr.toFixed(2) + " yr)" +
        "<br>Degree of Consolidation U(t) = " + pt.Ut_pct.toFixed(1) + "%"
      );
    }

    var targetDaysLabel = formatDaysShort(sum.targetTime_days);

    var traces = [
      {
        type: "scatter",
        mode: "lines",
        name: "Total Settlement S(t) (mm)",
        x: tVals,
        y: stVals,
        yaxis: "y",
        text: hoverSt,
        hoverinfo: "text",
        line: { color: "#4f46e5", width: 2.8 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Consolidation U(t) (%)",
        x: tVals,
        y: utVals,
        yaxis: "y2",
        text: hoverUt,
        hoverinfo: "text",
        line: { color: "#0284c7", width: 2.2, dash: "dash" }
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Target Time (" + targetDaysLabel + " d)",
        x: [sum.targetTime_days],
        y: [sum.St_target_mm],
        yaxis: "y",
        hovertext: [
          "Target Time Evaluation" +
          "<br>t = " + targetDaysLabel + " days (" + (sum.targetTime_days / DAYS_PER_YEAR).toFixed(2) + " yr)" +
          "<br>T_v = " + sum.Tv_target.toFixed(3) +
          "<br>U(t) = " + sum.Ut_target_pct.toFixed(1) + "%" +
          "<br>S(t) = " + sum.St_target_mm.toFixed(2) + " mm"
        ],
        hoverinfo: "text",
        marker: {
          size: 12,
          color: "#e11d48",
          symbol: "diamond",
          line: { color: "#ffffff", width: 2 }
        }
      }
    ];

    var shapes = [];
    var annotations = [];
    var tMinCurve = tVals[0];
    var tMaxCurve = tVals[tVals.length - 1];

    if (isFiniteNum(sum.t50_days) && sum.t50_days >= tMinCurve && sum.t50_days <= tMaxCurve) {
      shapes.push({
        type: "line",
        xref: "x",
        x0: sum.t50_days,
        x1: sum.t50_days,
        yref: "paper",
        y0: 0,
        y1: 1,
        line: { color: "#d97706", width: 1.4, dash: "dot" }
      });
      annotations.push({
        xref: "x",
        x: sum.t50_days,
        yref: "paper",
        y: 0.98,
        xanchor: "left",
        yanchor: "top",
        xshift: 4,
        text: "t_50 = " + formatDuration(sum.t50_days),
        showarrow: false,
        font: { size: 9.5, color: "#b45309", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(255, 251, 235, 0.92)",
        bordercolor: "#fde68a",
        borderwidth: 1,
        borderpad: 2
      });
    }

    if (isFiniteNum(sum.t90_days) && sum.t90_days >= tMinCurve && sum.t90_days <= tMaxCurve) {
      shapes.push({
        type: "line",
        xref: "x",
        x0: sum.t90_days,
        x1: sum.t90_days,
        yref: "paper",
        y0: 0,
        y1: 1,
        line: { color: "#059669", width: 1.4, dash: "dot" }
      });
      annotations.push({
        xref: "x",
        x: sum.t90_days,
        yref: "paper",
        y: 0.84,
        xanchor: "left",
        yanchor: "top",
        xshift: 4,
        text: "t_90 = " + formatDuration(sum.t90_days),
        showarrow: false,
        font: { size: 9.5, color: "#047857", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(236, 253, 245, 0.92)",
        bordercolor: "#a7f3d0",
        borderwidth: 1,
        borderpad: 2
      });
    }

    var maxS = Math.max(10.0, out.totalSettlement_mm * 1.15);

    var layout = {
      margin: { l: 58, r: 58, t: 38, b: 46 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Elapsed Time, t (days — log scale)",
          font: { size: 11, color: "#475569" }
        },
        type: "log",
        gridcolor: "#f1f5f9",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Total Settlement, S(t) (mm)",
          font: { size: 11, color: "#4f46e5" }
        },
        range: [0, maxS],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#4f46e5" }
      },
      yaxis2: {
        title: {
          text: "Degree of Consolidation, U(t) (%)",
          font: { size: 11, color: "#0284c7" }
        },
        overlaying: "y",
        side: "right",
        range: [0, 105],
        showgrid: false,
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#0284c7" }
      },
      shapes: shapes,
      annotations: annotations,
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 1.13,
        yanchor: "bottom",
        font: { size: 10, color: "#334155" }
      },
      hoverlabel: {
        bgcolor: "#0f172a",
        bordercolor: "#4f46e5",
        font: { color: "#f8fafc", size: 11, family: "Inter, system-ui, sans-serif" }
      },
      plot_bgcolor: "#ffffff",
      paper_bgcolor: "#ffffff",
      hovermode: "closest"
    };

    var config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
    };

    global.Plotly.react(els.timeRatePlotDiv, traces, layout, config);
  }

  /**
   * 3. Load–Settlement Sensitivity (#p4-load-plot)
   * Net Contact Stress q0 (kPa) vs. Se, Sc, and Stot (mm) with IS 1904 limit line
   * and diamond marker at current design q0.
   */
  function renderLoadSensitivityPlot(out, meta) {
    if (typeof global.Plotly === "undefined" || !els.loadPlotDiv) {
      return;
    }

    var curve = out.settlementVsLoadCurve || [];
    if (curve.length === 0) {
      return;
    }

    var qVals = [];
    var seVals = [];
    var scVals = [];
    var stotVals = [];
    var hoverTot = [];
    var maxY = out.allowableSettlement_mm || 50.0;

    for (var i = 0; i < curve.length; i++) {
      var pt = curve[i];
      qVals.push(pt.q0_kPa);
      seVals.push(pt.Se_mm);
      scVals.push(pt.Sc_mm);
      stotVals.push(pt.Stot_mm);
      if (pt.Stot_mm > maxY) {
        maxY = pt.Stot_mm;
      }

      hoverTot.push(
        "Net Contact Stress q_0 = " + pt.q0_kPa.toFixed(1) + " kPa" +
        "<br>Elastic S_e = " + pt.Se_mm.toFixed(2) + " mm" +
        "<br>Consolidation S_c = " + pt.Sc_mm.toFixed(2) + " mm" +
        "<br>Total S_tot = " + pt.Stot_mm.toFixed(2) + " mm"
      );
    }

    var currQ0 = meta.q0_kPa;
    var currStot = out.totalSettlement_mm;
    var allowMm = out.allowableSettlement_mm;

    var traces = [
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Elastic S_e (mm)",
        x: qVals,
        y: seVals,
        hovertemplate: "q_0 = %{x:.1f} kPa<br>S_e = %{y:.2f} mm<extra></extra>",
        line: { color: "#6366f1", width: 1.8, dash: "dot" },
        marker: { size: 5, color: "#6366f1" }
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Consolidation S_c (mm)",
        x: qVals,
        y: scVals,
        hovertemplate: "q_0 = %{x:.1f} kPa<br>S_c = %{y:.2f} mm<extra></extra>",
        line: { color: "#0284c7", width: 2, dash: "dash" },
        marker: { size: 5, color: "#0284c7" }
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Total S_tot (mm)",
        x: qVals,
        y: stotVals,
        text: hoverTot,
        hoverinfo: "text",
        line: { color: "#0f172a", width: 2.8 },
        marker: { size: 6, color: "#0f172a" }
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Current q_0 (" + formatNum(currQ0, 1) + " kPa)",
        x: [currQ0],
        y: [currStot],
        hovertext: [
          "Current Design Point" +
          "<br>q_0 = " + formatNum(currQ0, 2) + " kPa" +
          "<br>S_tot = " + formatNum(currStot, 2) + " mm" +
          "<br>IS 1904 Limit = " + formatNum(allowMm, 1) + " mm"
        ],
        hoverinfo: "text",
        marker: {
          size: 12,
          color: out.isSafeSettlement ? "#10b981" : "#e11d48",
          symbol: "diamond",
          line: { color: "#ffffff", width: 2 }
        }
      }
    ];

    var layout = {
      margin: { l: 56, r: 16, t: 38, b: 44 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Net Applied Contact Stress, q_0 (kPa)",
          font: { size: 11, color: "#475569" }
        },
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Settlement (mm)",
          font: { size: 11, color: "#475569" }
        },
        range: [0, Math.max(10.0, maxY * 1.18)],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      shapes: [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          yref: "y",
          y0: allowMm,
          y1: allowMm,
          line: { color: "#e11d48", width: 1.8, dash: "dash" }
        }
      ],
      annotations: [
        {
          xref: "paper",
          x: 0.01,
          yref: "y",
          y: allowMm,
          xanchor: "left",
          yanchor: "bottom",
          text: "IS 1904 Limit (" + allowMm.toFixed(1) + " mm)",
          showarrow: false,
          font: { size: 9.5, color: "#be123c", family: "JetBrains Mono, monospace" },
          bgcolor: "rgba(255, 241, 242, 0.92)",
          bordercolor: "#fecdd3",
          borderwidth: 1,
          borderpad: 2
        }
      ],
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 1.12,
        yanchor: "bottom",
        font: { size: 9.5, color: "#334155" }
      },
      hoverlabel: {
        bgcolor: "#0f172a",
        bordercolor: "#0f172a",
        font: { color: "#f8fafc", size: 11, family: "Inter, system-ui, sans-serif" }
      },
      plot_bgcolor: "#ffffff",
      paper_bgcolor: "#ffffff",
      hovermode: "closest"
    };

    var config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
    };

    global.Plotly.react(els.loadPlotDiv, traces, layout, config);
  }

  /**
   * Renders all right-workspace KPIs, advisories, 3 Plotly charts, layer breakdown,
   * and step-by-step audit cards. Accepts `out` directly so `out.meta` is preserved.
   */
  function renderResults(state, out) {
    renderAutoSoilSummary(state, out);

    var errs = (out && Array.isArray(out.errors)) ? out.errors : [];
    if (!out || out.status === "error" || errs.length > 0) {
      els.errorBanner.classList.remove("hidden");
      els.errorList.innerHTML = errs
        .map(function (err) {
          return "<li>" + escapeHtml(err) + "</li>";
        })
        .join("");
      els.warningBanner.classList.add("hidden");
      els.warningList.innerHTML = "";
      els.resultsWorkspace.classList.add("hidden");
      return;
    }

    var wasHidden = els.resultsWorkspace.classList.contains("hidden");
    els.errorBanner.classList.add("hidden");
    els.errorList.innerHTML = "";
    els.resultsWorkspace.classList.remove("hidden");

    // Non-blocking engineering advisories
    var warns = Array.isArray(out.warnings) ? out.warnings : [];
    if (warns.length > 0) {
      els.warningBanner.classList.remove("hidden");
      els.warningList.innerHTML = warns
        .map(function (w) {
          return "<li>" + escapeHtml(w) + "</li>";
        })
        .join("");
    } else {
      els.warningBanner.classList.add("hidden");
      els.warningList.innerHTML = "";
    }

    var meta = resolveMeta(state, out);
    var totS = out.totalSettlement_mm;
    var se = out.elasticSettlement_mm;
    var sc = out.consolidationSettlement_mm;
    var denom = totS > 1e-9 ? totS : 1.0;

    // 1. Total Settlement & IS 1904 Pass/Fail Card
    els.kpiStotVal.textContent = formatNum(totS, 2) + " mm";
    els.kpiStotSub.textContent = "Limit: " + formatNum(out.allowableSettlement_mm, 1) + " mm (IS 1904)";
    if (out.isSafeSettlement) {
      els.kpiStotCard.className =
        "bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-3.5";
      els.kpiStotBadge.className =
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
      els.kpiStotBadge.textContent = "PASS";
      els.kpiStotVal.className = "mt-1.5 text-lg font-bold font-mono text-emerald-700 tracking-tight";
    } else {
      els.kpiStotCard.className =
        "bg-white rounded-xl border border-rose-200 border-l-4 border-l-rose-600 shadow-sm p-3.5";
      els.kpiStotBadge.className =
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/25";
      els.kpiStotBadge.textContent = "EXCEEDS IS 1904";
      els.kpiStotVal.className = "mt-1.5 text-lg font-bold font-mono text-rose-700 tracking-tight";
    }

    // 2. Elastic Settlement Card
    els.kpiSeVal.textContent = formatNum(se, 2) + " mm";
    els.kpiSeSub.textContent =
      ((se / denom) * 100.0).toFixed(1) + "% · " + state.p4Input.elasticMethod;

    // 3. 1D Consolidation Settlement Card
    els.kpiScVal.textContent = formatNum(sc, 2) + " mm";
    els.kpiScSub.textContent =
      ((sc / denom) * 100.0).toFixed(1) + "% · R_f = " + formatNum(meta.Rf, 2);

    // 4. Target-Time Settlement Card
    var trSum = out.timeRateSummary;
    if (trSum) {
      els.kpiStVal.textContent = formatNum(trSum.St_target_mm, 2) + " mm";
      els.kpiStSub.textContent =
        "U(" + formatDaysShort(trSum.targetTime_days) + " d) = " + formatNum(trSum.Ut_target_pct, 1) + "%";
    } else if (!state.p4Input.timeRateCalc && sc > 1e-6) {
      els.kpiStVal.textContent = "—";
      els.kpiStSub.textContent = "Time-Rate Disabled";
    } else {
      els.kpiStVal.textContent = formatNum(totS, 2) + " mm";
      els.kpiStSub.textContent = "Instantaneous (Elastic Only)";
    }

    // 5. Dark Slate Summary Card
    els.kpiMetaStress.textContent = "q_0: " + formatNum(meta.q0_kPa, 2) + " kPa";
    els.kpiMetaLoad.textContent = "Q_net: " + formatNum(meta.Q_net, 1) + " " + meta.loadUnit;
    els.kpiMetaRf.textContent =
      "R_f = " + formatNum(meta.Rf, 2) + " · A = " + formatNum(meta.A_m2, 2) + " " + meta.areaUnit;
    els.kpiMetaTimes.textContent = trSum
      ? "t50: " + formatDuration(trSum.t50_days) + " | t90: " + formatDuration(trSum.t90_days)
      : "t50 / t90: N/A";

    // Render Table, Audit Steps & 3 Plotly Charts
    renderLayerBreakdownTable(out);

    var steps = out.steps || [];
    els.stepsCount.textContent = steps.length + (steps.length === 1 ? " step" : " steps");
    els.stepsContainer.innerHTML = steps
      .map(function (line) {
        return (
          '<div class="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-mono text-slate-700 leading-relaxed shadow-2xs">' +
          escapeHtml(line) +
          "</div>"
        );
      })
      .join("");

    renderStressPlot(state, out, meta);
    renderTimeRatePlot(out);
    renderLoadSensitivityPlot(out, meta);

    if (wasHidden) {
      resizeP4Plots();
    }
  }

  /**
   * Executes IS 8009 settlement calculation, syncs state.p4Results with loop guard,
   * and updates all Module P4 visuals cleanly.
   */
  function refreshAll(state, forceSyncInputs) {
    var logic = getLogic();
    if (!logic || !state) {
      return;
    }

    syncInputsFromState(state.p4Input, Boolean(forceSyncInputs));
    updateSyncBadge(state);

    var p1ValidLayers =
      Array.isArray(state.validationErrors) && state.validationErrors.length === 0
        ? state.processedLayers
        : [];

    var out = logic.computeSettlement(
      state.p4Input,
      p1ValidLayers,
      state.zw_measured,
      state.zw_design,
      state.gamma_w
    );

    // Loop guard: persist computed results without recursive notify()
    isSyncingFromState = true;
    try {
      state.setP4Results(out, false);
    } finally {
      isSyncingFromState = false;
    }

    renderResults(state, out);
  }

  /**
   * Resizes all three Module P4 Plotly charts cleanly whenever #tab-p4 or
   * #p4-results-workspace becomes visible.
   */
  function resizeP4Plots() {
    if (typeof global.Plotly === "undefined") {
      return;
    }
    global.requestAnimationFrame(function () {
      var divs = [els.stressPlotDiv, els.timeRatePlotDiv, els.loadPlotDiv];
      for (var i = 0; i < divs.length; i++) {
        if (divs[i] && divs[i].classList.contains("js-plotly-plot")) {
          global.Plotly.Plots.resize(divs[i]);
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // EVENT HANDLERS (Preserving Cursor Focus & State-Before-Render Order)
  // ---------------------------------------------------------------------------

  function handleNumericInput(el) {
    var state = getState();
    var field = el.getAttribute("data-p4-num");
    if (!field || !state) {
      return;
    }

    var rawStr = String(el.value).trim();
    var parsedVal = rawStr === "" ? NaN : Number(rawStr);
    if (!Number.isFinite(parsedVal)) {
      parsedVal = NaN;
    }

    var patch = {};
    patch[field] = parsedVal;

    // Keep L_m synced when editing B_m on Square or Circular footings
    if (field === "B_m" && (state.p4Input.shape === "Square" || state.p4Input.shape === "Circular")) {
      patch.L_m = parsedVal;
    }

    state.setP4Input(patch);
  }

  function handleSelectChange(el) {
    var state = getState();
    var field = el.getAttribute("data-p4-select");
    if (!field || !state) {
      return;
    }

    var patch = {};
    patch[field] = el.value;

    if (field === "shape") {
      var curB = state.p4Input.B_m;
      if (el.value === "Square" || el.value === "Circular") {
        if (isFiniteNum(curB)) {
          patch.L_m = curB;
        }
      } else if (el.value === "Rectangular") {
        if (isFiniteNum(curB) && (!isFiniteNum(state.p4Input.L_m) || state.p4Input.L_m < curB)) {
          patch.L_m = Number((curB * 1.5).toFixed(2));
        }
      }
    }

    state.setP4Input(patch);
  }

  function handleSwitchLoadMode(targetMode) {
    var state = getState();
    if (!state || state.p4Input.loadInputMode === targetMode) {
      return;
    }

    var inp = state.p4Input;
    var area = computeFootprintArea(inp);
    var patch = { loadInputMode: targetMode };

    // Sync counterpart cleanly so switching modes preserves net pressure
    if (targetMode === "Total Load" && isFiniteNum(inp.contactStress_kPa) && isFiniteNum(area) && area > 0) {
      patch.appliedLoad_kN = Number((inp.contactStress_kPa * area).toFixed(2));
    } else if (targetMode === "Stress" && isFiniteNum(inp.appliedLoad_kN) && isFiniteNum(area) && area > 0) {
      patch.contactStress_kPa = Number((inp.appliedLoad_kN / area).toFixed(2));
    }

    state.setP4Input(patch);
  }

  function cloneLayersForManualSeed(sourceLayers) {
    return (sourceLayers || []).map(function (lyr) {
      return {
        soilType: lyr.soilType || "Sand (SW/SP)",
        z_top: isFiniteNum(lyr.z_top) ? lyr.z_top : 0.0,
        z_bot: isFiniteNum(lyr.z_bot) ? lyr.z_bot : 3.0,
        gamma_moist: isFiniteNum(lyr.gamma_moist) ? lyr.gamma_moist : 18.0,
        gamma_sat: isFiniteNum(lyr.gamma_sat) ? lyr.gamma_sat : 20.0,
        E_prime: isFiniteNum(lyr.E_prime) ? lyr.E_prime : 15000.0,
        nu_prime: isFiniteNum(lyr.nu_prime) ? lyr.nu_prime : 0.30,
        e0: isFiniteNum(lyr.e0) ? lyr.e0 : 0.75,
        Cc: isFiniteNum(lyr.Cc) ? lyr.Cc : 0.20,
        Cr: isFiniteNum(lyr.Cr) ? lyr.Cr : 0.04,
        OCR: isFiniteNum(lyr.OCR) ? lyr.OCR : 1.0,
        cv: isFiniteNum(lyr.cv) ? lyr.cv : 0.05
      };
    });
  }

  function handleEnableManualSoil() {
    var state = getState();
    if (!state) return;

    var existing = state.p4Input.manualSoilLayers;
    if (!Array.isArray(existing) || existing.length === 0) {
      var seedSource =
        Array.isArray(state.processedLayers) && state.processedLayers.length > 0
          ? state.processedLayers
          : state.layers || [];
      var seeded = cloneLayersForManualSeed(seedSource);
      state.setP4Input({ overrideSoilParams: true, manualSoilLayers: seeded });
    } else {
      state.setP4Input({ overrideSoilParams: true });
    }
    renderManualLayersTable();
  }

  function handleManualCellUpdate(target) {
    var state = getState();
    var rowAttr = target.getAttribute("data-m-row");
    var field = target.getAttribute("data-m-field");
    if (rowAttr === null || !field || !state) {
      return;
    }

    var rowIdx = parseInt(rowAttr, 10);
    var curLayers = state.p4Input.manualSoilLayers || [];
    if (!Number.isInteger(rowIdx) || !curLayers[rowIdx]) {
      return;
    }

    var updated = curLayers.map(function (lyr, i) {
      if (i !== rowIdx) {
        return lyr;
      }
      var copy = Object.assign({}, lyr);
      if (field === "soilType") {
        copy.soilType = target.value;
      } else {
        var raw = String(target.value).trim();
        var num = raw === "" ? NaN : Number(raw);
        copy[field] = Number.isFinite(num) ? num : NaN;
      }
      return copy;
    });

    // Update without re-rendering manual table DOM (preserves active input focus)
    state.setP4Input({ manualSoilLayers: updated });
  }

  function handleAddManualLayer() {
    var state = getState();
    var cur = (state && state.p4Input && state.p4Input.manualSoilLayers) || [];
    var startZ = 0.0;
    if (cur.length > 0 && isFiniteNum(cur[cur.length - 1].z_bot)) {
      startZ = Number(cur[cur.length - 1].z_bot.toFixed(2));
    }

    var next = cur.concat([
      {
        soilType: "Clay (CL/CH)",
        z_top: startZ,
        z_bot: Number((startZ + 4.0).toFixed(2)),
        gamma_moist: 17.5,
        gamma_sat: 18.5,
        E_prime: 8000.0,
        nu_prime: 0.35,
        e0: 1.05,
        Cc: 0.30,
        Cr: 0.05,
        OCR: 1.2,
        cv: 0.05
      }
    ]);

    // Execution order: update state BEFORE re-rendering manual table
    state.setP4Input({ manualSoilLayers: next });
    renderManualLayersTable();
  }

  function handleDeleteManualLayer(rowIdx) {
    var state = getState();
    var cur = (state && state.p4Input && state.p4Input.manualSoilLayers) || [];
    if (rowIdx < 0 || rowIdx >= cur.length) {
      return;
    }

    var next = cur.filter(function (_, idx) {
      return idx !== rowIdx;
    });

    // Execution order: update state BEFORE re-rendering manual table
    state.setP4Input({ manualSoilLayers: next });
    renderManualLayersTable();
  }

  function bindEvents() {
    var state = getState();

    // Sync from P3 button
    els.btnSyncP3.addEventListener("click", function () {
      state.syncP4FromP3();
      syncInputsFromState(state.p4Input, true);
    });

    // Reset P4 Sample button
    els.btnResetP4.addEventListener("click", function () {
      state.resetP4Defaults();
      syncInputsFromState(state.p4Input, true);
      renderManualLayersTable();
    });

    // Load Input Mode toggle
    els.btnLoadStress.addEventListener("click", function () {
      handleSwitchLoadMode("Stress");
    });
    els.btnLoadTotal.addEventListener("click", function () {
      handleSwitchLoadMode("Total Load");
    });

    // IS 1904 Allowable Settlement preset pills
    els.presetButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = Number(btn.getAttribute("data-p4-preset"));
        if (isFiniteNum(val)) {
          state.setP4Input({ allowableSettlement_mm: val });
          syncInputsFromState(state.p4Input, true);
        }
      });
    });

    // Time-Rate checkbox
    els.checkTimeRate.addEventListener("change", function () {
      state.setP4Input({ timeRateCalc: Boolean(els.checkTimeRate.checked) });
    });

    // Soil Source segmented toggle
    els.btnSoilAuto.addEventListener("click", function () {
      if (state.p4Input.overrideSoilParams) {
        state.setP4Input({ overrideSoilParams: false });
      }
    });
    els.btnSoilManual.addEventListener("click", handleEnableManualSoil);

    // Manual Soil Override add/edit/delete
    els.btnAddManualLayer.addEventListener("click", handleAddManualLayer);

    els.manualSoilTbody.addEventListener("input", function (evt) {
      if (evt.target && evt.target.classList.contains("p4-manual-input")) {
        handleManualCellUpdate(evt.target);
      }
    });

    els.manualSoilTbody.addEventListener("change", function (evt) {
      if (evt.target && evt.target.classList.contains("p4-manual-select")) {
        handleManualCellUpdate(evt.target);
      }
    });

    els.manualSoilTbody.addEventListener("click", function (evt) {
      var delBtn = evt.target.closest ? evt.target.closest(".p4-manual-del-btn") : null;
      if (delBtn) {
        var idx = parseInt(delBtn.getAttribute("data-delete-manual"), 10);
        if (Number.isInteger(idx)) {
          handleDeleteManualLayer(idx);
        }
      }
    });

    // Delegated primary form inputs & dropdowns (preserves active cursor focus)
    els.container.addEventListener("input", function (evt) {
      if (evt.target && evt.target.hasAttribute("data-p4-num")) {
        handleNumericInput(evt.target);
      }
    });

    els.container.addEventListener("change", function (evt) {
      if (evt.target && evt.target.hasAttribute("data-p4-select")) {
        handleSelectChange(evt.target);
      }
    });

    // Responsive Plotly resizing on #btn-tab-p4 click & tab unhide MutationObserver
    var p4TabBtn = document.getElementById("btn-tab-p4");
    if (p4TabBtn) {
      p4TabBtn.addEventListener("click", resizeP4Plots);
    }

    if (typeof global.MutationObserver !== "undefined" && els.container) {
      var observer = new global.MutationObserver(function () {
        if (!els.container.classList.contains("hidden")) {
          resizeP4Plots();
        }
      });
      observer.observe(els.container, { attributes: true, attributeFilter: ["class"] });
    }

    // Reactive subscription to P1 stratigraphy, water tables, and P4 updates
    state.subscribe(function (updatedState) {
      if (isSyncingFromState) {
        return;
      }
      refreshAll(updatedState, false);
    });
  }

  /**
   * Initializes Module P4 UI inside #tab-p4.
   */
  function init() {
    var container = document.getElementById("tab-p4");
    if (!container || !getState() || !getLogic()) {
      return;
    }

    els.container = container;
    buildSkeleton(container);
    renderManualLayersTable();
    bindEvents();
    refreshAll(getState(), true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ModuleP4UI = Object.freeze({
    init: init,
    resizePlots: resizeP4Plots
  });
})(window);