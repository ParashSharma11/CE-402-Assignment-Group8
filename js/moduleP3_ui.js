/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P3 UI & Plotly Interactive Charts: window.ModuleP3UI
 * ==============================================================================
 * Renders the interactive Shallow Foundation Bearing Capacity (IS 6403:1981)
 * interface inside #tab-p3 using window.GeotechState and window.ModuleP3Logic.
 *
 * Strict SI Units: Dimensions/Depths (m), Stress/Capacity (kPa),
 * Unit Weight (kN/m³), Load Capacity (kN or kN/m), Angles (deg / °).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", no ES module imports/exports).
 */

(function initModuleP3UI(global) {
  "use strict";

  // Guard flag to prevent recursive GeotechState notification loops
  var isSyncingFromState = false;

  // Cached DOM references inside #tab-p3
  var els = {
    container: null,
    syncBadge: null,
    btnResetP3: null,

    // Controls: Configuration & Geometry
    selectShape: null,
    selectAnalysisType: null,
    selectShearMode: null,
    shearModeHint: null,
    selectWaterTableMode: null,
    labelB: null,
    inputB: null,
    labelL: null,
    inputL: null,
    hintL: null,
    inputDf: null,
    inputEB: null,
    inputEL: null,
    hintEL: null,
    inputAlpha: null,
    inputFS: null,

    // Soil Source Toggle & Panels
    btnSoilAuto: null,
    btnSoilManual: null,
    panelAutoSoil: null,
    autoSoilBody: null,
    panelManualSoil: null,
    labelManualC: null,
    inputManualC: null,
    inputManualPhi: null,
    hintManualPhi: null,
    inputManualGammaAbove: null,
    inputManualGammaBelow: null,
    inputManualGammaSatBelow: null,

    // Alerts & Warnings
    errorBanner: null,
    errorList: null,
    warningBanner: null,
    warningList: null,

    // Results Workspace
    resultsWorkspace: null,
    kpiQns: null,
    kpiQnsSub: null,
    kpiQs: null,
    kpiQsSub: null,
    kpiQnu: null,
    kpiQu: null,
    kpiLoadNs: null,
    kpiLoadS: null,
    kpiLoadAreaNote: null,

    // Factor & Component Breakdown Table
    factorTableBody: null,
    resolvedShearPill: null,

    // Step-by-Step Breakdown
    stepsCount: null,
    stepsContainer: null,

    // Plotly Containers
    termsPlotDiv: null,
    sensitivityPlotDiv: null
  };

  function getState() {
    return global.GeotechState;
  }

  function getLogic() {
    return global.ModuleP3Logic;
  }

  function formatNum(val, decimals) {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return "—";
    }
    return val.toFixed(decimals);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Builds options HTML for a <select> from a frozen array of labels.
   */
  function buildSelectOptions(items) {
    return (items || [])
      .map(function (item) {
        return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + "</option>";
      })
      .join("");
  }

  /**
   * Builds the static Precision Engineering layout skeleton inside #tab-p3 once.
   */
  function buildSkeleton(container) {
    var logic = getLogic();
    var shapeOpts = buildSelectOptions(logic.FOOTING_SHAPES);
    var analysisOpts = buildSelectOptions(logic.ANALYSIS_TYPES);
    var shearOpts = buildSelectOptions(logic.SHEAR_MODES);
    var wtOpts = buildSelectOptions(logic.WATER_TABLE_MODES);

    container.innerHTML = [
      '<div class="space-y-5">',

      '  <!-- 1. Top Header & Live P1 / Water Table Sync Status Bar -->',
      '  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">',
      '    <div>',
      '      <div class="flex flex-wrap items-center gap-2.5">',
      '        <h2 class="text-xl font-bold tracking-tight text-slate-900">Bearing Capacity Analysis (IS 6403:1981)</h2>',
      '        <span id="p3-sync-badge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">',
      '          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Auto (P1 Stratigraphy)',
      '        </span>',
      '      </div>',
      '      <p class="mt-0.5 text-xs text-slate-500">Shallow foundation ultimate and safe bearing capacity per IS 6403:1981 (Cl. 5.1.1&ndash;5.1.3, Tables 1&ndash;2) with Meyerhof (1953) eccentric effective area.</p>',
      '    </div>',
      '    <div class="flex items-center gap-2.5 self-start sm:self-auto">',
      '      <button id="p3-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-2xs transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      '        <span>Reset P3 Sample</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- Main Two-Column Grid: Left Input Panel (4 cols) + Right Results Workspace (8 cols) -->',
      '  <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">',

      '    <!-- ================================================================ -->',
      '    <!-- 2. LEFT INPUT PANEL: FOOTING GEOMETRY, LOADING & SOIL SOURCE     -->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-4 space-y-4">',

      '      <!-- Card A: Analysis Configuration -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Footing &amp; Analysis Setup</h3>',
      '            <p class="text-[11px] text-slate-500">Select foundation shape, drainage condition, failure mode, and water table.</p>',
      '          </div>',
      '          <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold">IS 6403</span>',
      '        </div>',
      '        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">',
      '          <div>',
      '            <label for="p3-shape" class="block text-[11px] font-semibold text-slate-700 mb-1">Footing Shape</label>',
      '            <select id="p3-shape" data-p3-select="shape" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + shapeOpts + "</select>",
      '          </div>',
      '          <div>',
      '            <label for="p3-analysis-type" class="block text-[11px] font-semibold text-slate-700 mb-1">Analysis Type</label>',
      '            <select id="p3-analysis-type" data-p3-select="analysisType" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + analysisOpts + "</select>",
      '          </div>',
      '          <div>',
      '            <label for="p3-shear-mode" class="block text-[11px] font-semibold text-slate-700 mb-1">Shear Failure Mode</label>',
      '            <select id="p3-shear-mode" data-p3-select="shearMode" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400">' + shearOpts + "</select>",
      '            <p id="p3-shear-mode-hint" class="hidden mt-1 text-[10px] text-slate-400">Undrained (&phi; = 0) uses N<sub>c</sub> = 5.14.</p>',
      '          </div>',
      '          <div>',
      '            <label for="p3-wt-mode" class="block text-[11px] font-semibold text-slate-700 mb-1">Water Table Mode</label>',
      '            <select id="p3-wt-mode" data-p3-select="waterTableMode" class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all">' + wtOpts + "</select>",
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Card B: Geometry & Loading Inputs (Strict SI Units) -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Geometry &amp; Loading</h3>',
      '            <p class="text-[11px] text-slate-500">Dimensions, embedment, eccentricity, inclination, and factor of safety.</p>',
      '          </div>',
      '          <span class="text-[10px] font-mono text-slate-400">m &middot; deg &middot; -</span>',
      '        </div>',
      '        <div class="p-4 grid grid-cols-2 gap-3.5">',
      '          <div>',
      '            <label id="p3-label-B" for="p3-B" class="block text-[11px] font-semibold text-slate-700 mb-1">Width B (m)</label>',
      '            <div class="relative">',
      '              <input id="p3-B" type="number" step="0.1" min="0.1" data-p3-num="B_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label id="p3-label-L" for="p3-L" class="block text-[11px] font-semibold text-slate-700 mb-1">Length L (m)</label>',
      '            <div class="relative">',
      '              <input id="p3-L" type="number" step="0.1" min="0.1" data-p3-num="L_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '            <p id="p3-hint-L" class="hidden mt-0.5 text-[10px] font-mono text-slate-400"></p>',
      '          </div>',
      '          <div>',
      '            <label for="p3-Df" class="block text-[11px] font-semibold text-slate-700 mb-1">Embedment Depth D<sub>f</sub> (m)</label>',
      '            <div class="relative">',
      '              <input id="p3-Df" type="number" step="0.1" min="0.0" data-p3-num="Df_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-FS" class="block text-[11px] font-semibold text-slate-700 mb-1">Factor of Safety FS (-)</label>',
      '            <div class="relative">',
      '              <input id="p3-FS" type="number" step="0.1" min="1.0" data-p3-num="FS" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-7 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">-</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-eB" class="block text-[11px] font-semibold text-slate-700 mb-1">Eccentricity e<sub>B</sub> (m)</label>',
      '            <div class="relative">',
      '              <input id="p3-eB" type="number" step="0.05" min="0.0" data-p3-num="eB_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-eL" class="block text-[11px] font-semibold text-slate-700 mb-1">Eccentricity e<sub>L</sub> (m)</label>',
      '            <div class="relative">',
      '              <input id="p3-eL" type="number" step="0.05" min="0.0" data-p3-num="eL_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '            <p id="p3-hint-eL" class="hidden mt-0.5 text-[10px] font-mono text-slate-400">Not used for Strip.</p>',
      '          </div>',
      '          <div class="col-span-2">',
      '            <label for="p3-alpha" class="block text-[11px] font-semibold text-slate-700 mb-1">Load Inclination &alpha; from Vertical (deg)</label>',
      '            <div class="relative">',
      '              <input id="p3-alpha" type="number" step="1" min="0" max="89" data-p3-num="alpha_deg" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-10 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">deg</span>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Card C: Soil Parameter Source Toggle (Auto P1 vs. Manual Override) -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 space-y-2.5">',
      '          <div class="flex items-center justify-between">',
      '            <h3 class="text-sm font-semibold text-slate-900">Soil Parameter Source</h3>',
      '            <span class="text-[10px] font-mono text-slate-400">kPa &middot; deg &middot; kN/m&sup3;</span>',
      '          </div>',
      '          <div class="grid grid-cols-2 p-1 rounded-lg bg-slate-100 border border-slate-200/80 gap-1" role="group" aria-label="Soil parameter source">',
      '            <button id="p3-btn-soil-auto" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer bg-white text-indigo-700 shadow-xs">Auto from Module P1</button>',
      '            <button id="p3-btn-soil-manual" type="button" class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-slate-600 hover:text-slate-900">Manual Soil Override</button>',
      '          </div>',
      '        </div>',

      '        <!-- Auto from P1 Failure-Zone Summary -->',
      '        <div id="p3-panel-auto-soil" class="p-4">',
      '          <div id="p3-auto-soil-body" class="space-y-2.5 text-xs text-slate-600"></div>',
      '        </div>',

      '        <!-- Manual Soil Override Inputs -->',
      '        <div id="p3-panel-manual-soil" class="hidden p-4 grid grid-cols-2 gap-3">',
      '          <div>',
      '            <label id="p3-label-manual-c" for="p3-manual-c" class="block text-[11px] font-semibold text-slate-700 mb-1">Cohesion c&prime; (kPa)</label>',
      '            <div class="relative">',
      '              <input id="p3-manual-c" type="number" step="1" min="0" data-p3-num="manual_c" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-9 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-manual-phi" class="block text-[11px] font-semibold text-slate-700 mb-1">Friction Angle &phi;&prime; (deg)</label>',
      '            <div class="relative">',
      '              <input id="p3-manual-phi" type="number" step="0.5" min="0" max="50" data-p3-num="manual_phi" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 pl-2.5 pr-9 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">deg</span>',
      '            </div>',
      '            <p id="p3-hint-manual-phi" class="hidden mt-0.5 text-[10px] font-mono text-slate-400">Fixed 0&deg; (Undrained)</p>',
      '          </div>',
      '          <div class="col-span-2">',
      '            <label for="p3-manual-g-above" class="block text-[11px] font-semibold text-slate-700 mb-1">Moist Unit Weight Above Base &gamma;<sub>above</sub> (kN/m&sup3;)</label>',
      '            <div class="relative">',
      '              <input id="p3-manual-g-above" type="number" step="0.5" min="1" data-p3-num="manual_gamma_above" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-14 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kN/m&sup3;</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-manual-g-below" class="block text-[11px] font-semibold text-slate-700 mb-1">Moist &gamma;<sub>below</sub> (kN/m&sup3;)</label>',
      '            <div class="relative">',
      '              <input id="p3-manual-g-below" type="number" step="0.5" min="1" data-p3-num="manual_gamma_below" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-12 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kN/m&sup3;</span>',
      '            </div>',
      '          </div>',
      '          <div>',
      '            <label for="p3-manual-gsat-below" class="block text-[11px] font-semibold text-slate-700 mb-1">Sat. &gamma;<sub>sat,below</sub> (kN/m&sup3;)</label>',
      '            <div class="relative">',
      '              <input id="p3-manual-gsat-below" type="number" step="0.5" min="1" data-p3-num="manual_gamma_sat_below" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-12 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kN/m&sup3;</span>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',

      '    <!-- ================================================================ -->',
      '    <!-- 3 & 4. RIGHT RESULTS WORKSPACE (ALERTS, KPIS, TABLE, CHARTS)     -->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-8 space-y-4">',

      '      <!-- Validation Error Alert Banner -->',
      '      <div id="p3-error-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '        <div class="flex items-start gap-3">',
      '          <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '          </div>',
      '          <div class="flex-1">',
      '            <h3 class="text-sm font-semibold text-rose-900">IS 6403:1981 Input Validation Failed</h3>',
      '            <p class="text-xs text-rose-700 mt-0.5">Resolve the following constraints to compute shallow foundation bearing capacity:</p>',
      '            <ul id="p3-error-list" class="mt-2 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Non-Blocking Engineering Warning Banner -->',
      '      <div id="p3-warning-banner" class="hidden rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-amber-950 shadow-sm" role="status">',
      '        <div class="flex items-start gap-3">',
      '          <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '          </div>',
      '          <div class="flex-1">',
      '            <h3 class="text-sm font-semibold text-amber-950">Engineering Design Advisories</h3>',
      '            <ul id="p3-warning-list" class="mt-1.5 list-disc list-inside space-y-1 text-xs font-mono text-amber-900"></ul>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Valid Results Container -->',
      '      <div id="p3-results-workspace" class="space-y-4">',

      '        <!-- Prominent Capacity KPI Cards -->',
      '        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-indigo-600 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-indigo-700">Net Safe q<sub>ns</sub></span>',
      '            <p id="p3-kpi-qns" class="mt-1.5 text-lg font-bold font-mono text-indigo-700 tracking-tight">—</p>',
      '            <p id="p3-kpi-qns-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">q<sub>nu</sub> / FS</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-emerald-700">Gross Safe q<sub>s</sub></span>',
      '            <p id="p3-kpi-qs" class="mt-1.5 text-lg font-bold font-mono text-emerald-700 tracking-tight">—</p>',
      '            <p id="p3-kpi-qs-sub" class="mt-0.5 text-[10px] font-mono text-slate-400">q<sub>ns</sub> + q</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-600">Net Ultimate q<sub>nu</sub></span>',
      '            <p id="p3-kpi-qnu" class="mt-1.5 text-lg font-bold font-mono text-slate-900 tracking-tight">—</p>',
      '            <p class="mt-0.5 text-[10px] font-mono text-slate-400">IS 6403 Cl. 5.1.2</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-slate-400 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-600">Gross Ultimate q<sub>u</sub></span>',
      '            <p id="p3-kpi-qu" class="mt-1.5 text-lg font-bold font-mono text-slate-800 tracking-tight">—</p>',
      '            <p class="mt-0.5 text-[10px] font-mono text-slate-400">q<sub>nu</sub> + q</p>',
      '          </div>',
      '          <div class="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm p-3.5 sm:col-span-2 lg:col-span-1">',
      '            <span class="text-[11px] font-medium text-sky-300">Safe Load Q<sub>ns</sub> / Q<sub>s</sub></span>',
      '            <p id="p3-kpi-load-ns" class="mt-1 text-base font-bold font-mono text-white tracking-tight">—</p>',
      '            <p id="p3-kpi-load-s" class="text-[11px] font-mono text-emerald-300">—</p>',
      '            <p id="p3-kpi-load-area" class="mt-0.5 text-[10px] font-mono text-slate-400">—</p>',
      '          </div>',
      '        </div>',

      '        <!-- Two Interactive Plotly Charts Side-by-Side -->',
      '        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">',
      '          <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '            <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '              <div>',
      '                <h3 class="text-sm font-semibold text-slate-900">Net Ultimate Capacity Components</h3>',
      '                <p class="text-[11px] text-slate-500">Cohesion, overburden, and self-weight contributions to q<sub>nu</sub> (kPa).</p>',
      '              </div>',
      '              <span class="text-[10px] font-mono text-slate-400">kPa</span>',
      '            </div>',
      '            <div class="p-3">',
      '              <div id="p3-terms-plot" class="w-full h-[320px]"></div>',
      '            </div>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '            <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '              <div>',
      '                <h3 class="text-sm font-semibold text-slate-900">Footing Width Sensitivity</h3>',
      '                <p class="text-[11px] text-slate-500">Net safe q<sub>ns</sub> and net ultimate q<sub>nu</sub> (kPa) vs. width B (m).</p>',
      '              </div>',
      '              <span class="text-[10px] font-mono text-slate-400">0.5B &ndash; 2.5B</span>',
      '            </div>',
      '            <div class="p-3">',
      '              <div id="p3-sensitivity-plot" class="w-full h-[320px]"></div>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Complete IS 6403:1981 Factor & Component Breakdown Table -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">',
      '            <div>',
      '              <h3 class="text-sm font-semibold text-slate-900">IS 6403:1981 Factor &amp; Component Breakdown</h3>',
      '              <p class="text-[11px] text-slate-500">Explicit audit of Meyerhof effective dimensions, mobilized shear, factors, water table correction, and terms.</p>',
      '            </div>',
      '            <span id="p3-resolved-shear-pill" class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium ring-1 ring-inset ring-indigo-600/20">—</span>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '              <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '                <tr>',
      '                  <th class="px-4 py-2.5 text-left w-48">Category</th>',
      '                  <th class="px-4 py-2.5 text-left">Parameter / Factor Values (SI Units)</th>',
      '                  <th class="px-4 py-2.5 text-left w-52">Reference / Notes</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p3-factor-tbody" class="divide-y divide-slate-100"></tbody>',
      '            </table>',
      '          </div>',
      '        </div>',

      '        <!-- Collapsible Step-by-Step Calculation Breakdown -->',
      '        <details open class="group bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <summary class="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/80 transition-colors list-none">',
      '            <div class="flex items-center gap-2">',
      '              <svg class="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      '              <h3 class="text-sm font-semibold text-slate-900">Step-by-Step IS 6403:1981 Calculation Audit</h3>',
      '            </div>',
      '            <span id="p3-steps-count" class="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-medium">0 steps</span>',
      '          </summary>',
      '          <div id="p3-steps-container" class="p-4 space-y-2 bg-slate-50/40"></div>',
      '        </details>',

      '      </div>',
      '    </div>',

      '  </div>',
      '</div>'
    ].join("\n");

    // Cache DOM references
    els.syncBadge = container.querySelector("#p3-sync-badge");
    els.btnResetP3 = container.querySelector("#p3-btn-reset");

    els.selectShape = container.querySelector("#p3-shape");
    els.selectAnalysisType = container.querySelector("#p3-analysis-type");
    els.selectShearMode = container.querySelector("#p3-shear-mode");
    els.shearModeHint = container.querySelector("#p3-shear-mode-hint");
    els.selectWaterTableMode = container.querySelector("#p3-wt-mode");
    els.labelB = container.querySelector("#p3-label-B");
    els.inputB = container.querySelector("#p3-B");
    els.labelL = container.querySelector("#p3-label-L");
    els.inputL = container.querySelector("#p3-L");
    els.hintL = container.querySelector("#p3-hint-L");
    els.inputDf = container.querySelector("#p3-Df");
    els.inputEB = container.querySelector("#p3-eB");
    els.inputEL = container.querySelector("#p3-eL");
    els.hintEL = container.querySelector("#p3-hint-eL");
    els.inputAlpha = container.querySelector("#p3-alpha");
    els.inputFS = container.querySelector("#p3-FS");

    els.btnSoilAuto = container.querySelector("#p3-btn-soil-auto");
    els.btnSoilManual = container.querySelector("#p3-btn-soil-manual");
    els.panelAutoSoil = container.querySelector("#p3-panel-auto-soil");
    els.autoSoilBody = container.querySelector("#p3-auto-soil-body");
    els.panelManualSoil = container.querySelector("#p3-panel-manual-soil");
    els.labelManualC = container.querySelector("#p3-label-manual-c");
    els.inputManualC = container.querySelector("#p3-manual-c");
    els.inputManualPhi = container.querySelector("#p3-manual-phi");
    els.hintManualPhi = container.querySelector("#p3-hint-manual-phi");
    els.inputManualGammaAbove = container.querySelector("#p3-manual-g-above");
    els.inputManualGammaBelow = container.querySelector("#p3-manual-g-below");
    els.inputManualGammaSatBelow = container.querySelector("#p3-manual-gsat-below");

    els.errorBanner = container.querySelector("#p3-error-banner");
    els.errorList = container.querySelector("#p3-error-list");
    els.warningBanner = container.querySelector("#p3-warning-banner");
    els.warningList = container.querySelector("#p3-warning-list");

    els.resultsWorkspace = container.querySelector("#p3-results-workspace");
    els.kpiQns = container.querySelector("#p3-kpi-qns");
    els.kpiQnsSub = container.querySelector("#p3-kpi-qns-sub");
    els.kpiQs = container.querySelector("#p3-kpi-qs");
    els.kpiQsSub = container.querySelector("#p3-kpi-qs-sub");
    els.kpiQnu = container.querySelector("#p3-kpi-qnu");
    els.kpiQu = container.querySelector("#p3-kpi-qu");
    els.kpiLoadNs = container.querySelector("#p3-kpi-load-ns");
    els.kpiLoadS = container.querySelector("#p3-kpi-load-s");
    els.kpiLoadAreaNote = container.querySelector("#p3-kpi-load-area");

    els.factorTableBody = container.querySelector("#p3-factor-tbody");
    els.resolvedShearPill = container.querySelector("#p3-resolved-shear-pill");
    els.stepsCount = container.querySelector("#p3-steps-count");
    els.stepsContainer = container.querySelector("#p3-steps-container");
    els.termsPlotDiv = container.querySelector("#p3-terms-plot");
    els.sensitivityPlotDiv = container.querySelector("#p3-sensitivity-plot");
  }

  /**
   * Synchronizes input controls from state.p3Input WITHOUT interrupting active
   * cursor focus unless forceSync === true (used on init and Reset P3 Sample).
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

    setControlVal(els.selectShape, input.shape);
    setControlVal(els.selectAnalysisType, input.analysisType);
    setControlVal(els.selectShearMode, input.shearMode);
    setControlVal(els.selectWaterTableMode, input.waterTableMode);

    setControlVal(els.inputB, input.B_m);
    setControlVal(els.inputDf, input.Df_m);
    setControlVal(els.inputEB, input.eB_m);
    setControlVal(els.inputEL, input.eL_m);
    setControlVal(els.inputAlpha, input.alpha_deg);
    setControlVal(els.inputFS, input.FS);

    setControlVal(els.inputManualC, input.manual_c);
    setControlVal(els.inputManualPhi, input.manual_phi);
    setControlVal(els.inputManualGammaAbove, input.manual_gamma_above);
    setControlVal(els.inputManualGammaBelow, input.manual_gamma_below);
    setControlVal(els.inputManualGammaSatBelow, input.manual_gamma_sat_below);

    // Shape-dependent labels & disabled states for B, L, and eL
    var shape = input.shape;
    if (shape === "Circular") {
      els.labelB.textContent = "Diameter B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      els.inputL.placeholder = "";
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = Number.isFinite(input.B_m) ? String(input.B_m) : "";
      }
      els.hintL.textContent = "Synced to diameter B.";
      els.hintL.classList.remove("hidden");
      els.inputEL.disabled = false;
      els.hintEL.classList.add("hidden");
    } else if (shape === "Square") {
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      els.inputL.placeholder = "";
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = Number.isFinite(input.B_m) ? String(input.B_m) : "";
      }
      els.hintL.textContent = "Square: L = B.";
      els.hintL.classList.remove("hidden");
      els.inputEL.disabled = false;
      els.hintEL.classList.add("hidden");
    } else if (shape === "Strip") {
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = true;
      if (forceSync || document.activeElement !== els.inputL) {
        els.inputL.value = "";
        els.inputL.placeholder = "∞ (Strip)";
      }
      els.hintL.textContent = "Strip: L → ∞ (per m run).";
      els.hintL.classList.remove("hidden");
      els.inputEL.disabled = true;
      els.hintEL.classList.remove("hidden");
    } else {
      // Rectangular
      els.labelB.textContent = "Width B (m)";
      els.labelL.textContent = "Length L (m)";
      els.inputL.disabled = false;
      els.inputL.placeholder = "";
      setControlVal(els.inputL, input.L_m);
      els.hintL.classList.add("hidden");
      els.inputEL.disabled = false;
      els.hintEL.classList.add("hidden");
    }

    // Drainage condition dependent states (Drained vs. Undrained)
    var isUndrained = input.analysisType === "Undrained";
    els.selectShearMode.disabled = isUndrained;
    els.shearModeHint.classList.toggle("hidden", !isUndrained);
    els.labelManualC.innerHTML = isUndrained
      ? "Undrained Strength s<sub>u</sub> (kPa)"
      : "Effective Cohesion c&prime; (kPa)";
    els.inputManualPhi.disabled = isUndrained;
    els.hintManualPhi.classList.toggle("hidden", !isUndrained);

    // Soil source segmented toggle visual state
    var isManual = Boolean(input.useManualSoil);
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
   * Updates the top live P1 & Water Table Sync Status pill.
   */
  function updateSyncBadge(state) {
    var input = state.p3Input || {};
    var isManual = Boolean(input.useManualSoil);
    var wtMode = input.waterTableMode === "Measured" ? "Measured" : "Design";
    var zw = wtMode === "Measured" ? state.zw_measured : state.zw_design;
    var hasP1Errors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;
    var hasLayers = Array.isArray(state.processedLayers) && state.processedLayers.length > 0;

    if (isManual) {
      els.syncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25";
      els.syncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>' +
        "Manual Override · " +
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
   * Renders the compact failure-zone summary panel when Auto from Module P1 is active.
   */
  function renderAutoSoilSummary(state, result) {
    if (!result || !result.soil || state.p3Input.useManualSoil) {
      var hasP1Errors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;
      if (!state.p3Input.useManualSoil) {
        els.autoSoilBody.innerHTML = hasP1Errors
          ? '<p class="text-rose-700 font-medium">Module P1 profile has validation errors. Resolve them in Tab P1 or switch to Manual Soil Override.</p>'
          : '<p class="text-slate-500">Adjust geometry inputs so D<sub>f</sub> lies within the Module P1 soil profile to preview failure-zone parameters.</p>';
      }
      return;
    }

    var s = result.soil;
    var isUndrained = s.analysisType === "Undrained";
    var cLabel = isUndrained ? "s<sub>u</sub>" : "c&prime;";

    var layersHtml = (s.zoneLayers || [])
      .map(function (zl) {
        var pct = (zl.weightFraction * 100.0).toFixed(0);
        return (
          '<li class="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-600">' +
          '<span class="truncate">L' + zl.layerIndex + " " + escapeHtml(zl.soilType) + " (" + formatNum(zl.z_top, 2) + "&ndash;" + formatNum(zl.z_bot, 2) + " m)</span>" +
          '<span class="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + pct + "%</span>" +
          "</li>"
        );
      })
      .join("");

    els.autoSoilBody.innerHTML = [
      '<div class="flex items-center justify-between text-[11px]">',
      '  <span class="font-medium text-slate-500">Failure Zone [D<sub>f</sub>, D<sub>f</sub> + B&prime;]</span>',
      '  <span class="font-mono font-semibold text-indigo-700">' + formatNum(s.failureZoneTop_m, 2) + " &ndash; " + formatNum(s.failureZoneBot_m, 2) + " m</span>",
      "</div>",
      '<div class="grid grid-cols-2 gap-2">',
      '  <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '    <span class="block text-[10px] text-slate-500">Overburden q at D<sub>f</sub></span>',
      '    <span class="font-mono font-semibold text-slate-900">' + formatNum(s.q, 2) + " kPa</span>",
      "  </div>",
      '  <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '    <span class="block text-[10px] text-slate-500">Weighted &gamma;<sub>moist</sub></span>',
      '    <span class="font-mono font-semibold text-slate-900">' + formatNum(s.gamma_below, 2) + " kN/m&sup3;</span>",
      "  </div>",
      '  <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '    <span class="block text-[10px] text-slate-500">Weighted ' + cLabel + "</span>",
      '    <span class="font-mono font-semibold text-slate-900">' + formatNum(s.c_base, 2) + " kPa</span>",
      "  </div>",
      '  <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '    <span class="block text-[10px] text-slate-500">Weighted &phi;&prime;</span>',
      '    <span class="font-mono font-semibold text-slate-900">' + formatNum(s.phi_base, 2) + " deg</span>",
      "  </div>",
      "</div>",
      layersHtml
        ? '<div class="pt-1 border-t border-slate-100"><p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Contributing P1 Strata</p><ul class="space-y-1">' + layersHtml + "</ul></div>"
        : ""
    ].join("");
  }

  /**
   * Renders the complete IS 6403:1981 Factor & Component Breakdown table.
   */
  function renderFactorTable(result) {
    var g = result.geometry;
    var s = result.soil;
    var sh = result.shear;
    var f = result.factors;
    var t = result.terms;
    var cap = result.capacities;

    var areaUnit = g.isPerMeterRun ? "m²/m" : "m²";
    var lPrimeStr = g.L_eff === Infinity ? "∞ (Strip)" : formatNum(g.L_eff, 3) + " m";
    var qnuTotal = cap.q_nu > 1e-9 ? cap.q_nu : 1.0;

    function pctShare(val) {
      return ((val / qnuTotal) * 100.0).toFixed(1) + "%";
    }

    var rows = [
      {
        cat: "Effective Geometry",
        vals:
          "B&prime; = <b>" + formatNum(g.B_eff, 3) + " m</b> &nbsp;|&nbsp; " +
          "L&prime; = <b>" + lPrimeStr + "</b> &nbsp;|&nbsp; " +
          "B&prime;/L&prime; = <b>" + formatNum(g.ratio_B_L, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "A&prime; = <b>" + formatNum(g.A_prime, 3) + " " + areaUnit + "</b>",
        ref: "IS 6403 Cl. 5.1.1 / Meyerhof (1953) &middot; " + escapeHtml(g.effectiveShape)
      },
      {
        cat: "Overburden &amp; Soil",
        vals:
          "q = <b>" + formatNum(s.q, 2) + " kPa</b> &nbsp;|&nbsp; " +
          "&gamma;<sub>below</sub> = <b>" + formatNum(s.gamma_below, 2) + " kN/m&sup3;</b> &nbsp;|&nbsp; " +
          "z<sub>w</sub> = <b>" + formatNum(s.zw, 2) + " m</b> (" + escapeHtml(s.waterTableMode) + ")",
        ref: escapeHtml(s.soilSourceLabel) + " &middot; " + escapeHtml(s.analysisType)
      },
      {
        cat: "Mobilized Shear",
        vals:
          "c<sub>m</sub> = <b>" + formatNum(sh.c_m, 2) + " kPa</b> &nbsp;|&nbsp; " +
          "&phi;<sub>m</sub> = <b>" + formatNum(sh.phi_m, 2) + " deg</b>",
        ref: escapeHtml(sh.resolvedShearMode)
      },
      {
        cat: "Bearing Capacity Factors",
        vals:
          "N<sub>c</sub> = <b>" + formatNum(f.Nc, 2) + " (-)</b> &nbsp;|&nbsp; " +
          "N<sub>q</sub> = <b>" + formatNum(f.Nq, 2) + " (-)</b> &nbsp;|&nbsp; " +
          "N<sub>&gamma;</sub> = <b>" + formatNum(f.Ngamma, 2) + " (-)</b>",
        ref: "IS 6403:1981 Table 1 / Cl. 5.1.2"
      },
      {
        cat: "Shape Factors",
        vals:
          "s<sub>c</sub> = <b>" + formatNum(f.sc, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "s<sub>q</sub> = <b>" + formatNum(f.sq, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "s<sub>&gamma;</sub> = <b>" + formatNum(f.sgamma, 3) + " (-)</b>",
        ref: "IS 6403:1981 Table 2"
      },
      {
        cat: "Depth Factors",
        vals:
          "d<sub>c</sub> = <b>" + formatNum(f.dc, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "d<sub>q</sub> = <b>" + formatNum(f.dq, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "d<sub>&gamma;</sub> = <b>" + formatNum(f.dgamma, 3) + " (-)</b>",
        ref: "IS 6403 Cl. 5.1.2.1 (&radic;N<sub>&phi;</sub> = " + formatNum(f.sqrtNphi, 3) + ")"
      },
      {
        cat: "Inclination Factors",
        vals:
          "i<sub>c</sub> = <b>" + formatNum(f.ic, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "i<sub>q</sub> = <b>" + formatNum(f.iq, 3) + " (-)</b> &nbsp;|&nbsp; " +
          "i<sub>&gamma;</sub> = <b>" + formatNum(f.igamma, 3) + " (-)</b>",
        ref: "IS 6403 Cl. 5.1.2.1 (&alpha; = " + formatNum(result.inputs.alpha_deg, 1) + " deg)"
      },
      {
        cat: "Water Table Factor",
        vals: "W&prime; = <b>" + formatNum(f.W_prime, 3) + " (-)</b>",
        ref: "IS 6403 Cl. 5.1.2.2 &middot; " + escapeHtml(f.wtCase)
      },
      {
        cat: "Capacity Terms (q<sub>nu</sub>)",
        vals:
          "Cohesion: <b class=\"text-indigo-700\">" + formatNum(t.term_c, 2) + " kPa</b> (" + pctShare(t.term_c) + ") &nbsp;|&nbsp; " +
          "Overburden: <b class=\"text-sky-700\">" + formatNum(t.term_q, 2) + " kPa</b> (" + pctShare(t.term_q) + ") &nbsp;|&nbsp; " +
          "Self-Weight: <b class=\"text-emerald-700\">" + formatNum(t.term_gamma, 2) + " kPa</b> (" + pctShare(t.term_gamma) + ")",
        ref: "Sum = " + formatNum(cap.q_nu, 2) + " kPa (Net Ultimate)"
      }
    ];

    els.factorTableBody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr class="hover:bg-slate-50/80 transition-colors">' +
          '  <td class="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">' + r.cat + "</td>" +
          '  <td class="px-4 py-2.5 font-mono text-slate-800 leading-relaxed">' + r.vals + "</td>" +
          '  <td class="px-4 py-2.5 text-[11px] text-slate-500">' + r.ref + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /**
   * Renders the Component Contribution Bar Chart (#p3-terms-plot).
   * Uses real Unicode symbols only (never raw HTML entities).
   */
  function renderTermsPlot(result) {
    if (typeof global.Plotly === "undefined" || !els.termsPlotDiv || !result) {
      return;
    }

    var t = result.terms;
    var qnu = result.capacities.q_nu;
    var denom = qnu > 1e-9 ? qnu : 1.0;

    var values = [t.term_c, t.term_q, t.term_gamma];
    var colors = ["#4f46e5", "#0284c7", "#10b981"];

    var barText = values.map(function (v) {
      var pct = ((v / denom) * 100.0).toFixed(1);
      return v.toFixed(1) + " kPa (" + pct + "%)";
    });

    var hoverText = [
      "Cohesion Component (c_m · N_c · s_c · d_c · i_c)<br>Contribution = " + t.term_c.toFixed(2) + " kPa (" + ((t.term_c / denom) * 100.0).toFixed(1) + "% of q_nu)",
      "Overburden Component (q · (N_q – 1) · s_q · d_q · i_q)<br>Contribution = " + t.term_q.toFixed(2) + " kPa (" + ((t.term_q / denom) * 100.0).toFixed(1) + "% of q_nu)",
      "Self-Weight Component (0.5 · γ · B' · N_γ · s_γ · d_γ · i_γ · W')<br>Contribution = " + t.term_gamma.toFixed(2) + " kPa (" + ((t.term_gamma / denom) * 100.0).toFixed(1) + "% of q_nu)"
    ];

    var maxVal = Math.max(10.0, Math.max.apply(null, values));

    var traces = [
      {
        type: "bar",
        x: ["Cohesion", "Overburden", "Self-Weight"],
        y: values,
        text: barText,
        textposition: "outside",
        cliponaxis: false,
        hovertext: hoverText,
        hoverinfo: "text",
        marker: {
          color: colors,
          line: { color: "#1e293b", width: 1 }
        },
        textfont: {
          family: "JetBrains Mono, monospace",
          size: 10,
          color: "#334155"
        },
        showlegend: false
      }
    ];

    var layout = {
      margin: { l: 58, r: 16, t: 30, b: 44 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        tickfont: { size: 11, color: "#334155" },
        showgrid: false
      },
      yaxis: {
        title: {
          text: "Bearing Capacity Term (kPa)",
          font: { size: 11, color: "#475569" }
        },
        range: [0, maxVal * 1.24],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      annotations: [
        {
          xref: "paper",
          yref: "paper",
          x: 0.99,
          y: 0.98,
          xanchor: "right",
          yanchor: "top",
          text: "Total q_nu = " + qnu.toFixed(2) + " kPa",
          showarrow: false,
          font: { size: 10.5, color: "#1e293b", family: "JetBrains Mono, monospace" },
          bgcolor: "rgba(248, 250, 252, 0.95)",
          bordercolor: "#cbd5e1",
          borderwidth: 1,
          borderpad: 4
        }
      ],
      hoverlabel: {
        bgcolor: "#0f172a",
        bordercolor: "#4f46e5",
        font: { color: "#f8fafc", size: 11, family: "Inter, system-ui, sans-serif" }
      },
      plot_bgcolor: "#ffffff",
      paper_bgcolor: "#ffffff"
    };

    var config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
    };

    global.Plotly.react(els.termsPlotDiv, traces, layout, config);
  }

  /**
   * Renders the Footing Width Sensitivity Chart (#p3-sensitivity-plot).
   * Uses real Unicode symbols only (never raw HTML entities).
   */
  function renderSensitivityPlot(result) {
    if (typeof global.Plotly === "undefined" || !els.sensitivityPlotDiv || !result) {
      return;
    }

    var curve = result.widthCurve || [];
    if (curve.length === 0) {
      return;
    }

    var widths = [];
    var qnsVals = [];
    var qnuVals = [];
    var hoverQns = [];
    var hoverQnu = [];
    var maxY = 10.0;

    for (var i = 0; i < curve.length; i++) {
      var pt = curve[i];
      widths.push(pt.B_m);
      qnsVals.push(pt.q_ns);
      qnuVals.push(pt.q_nu);
      if (pt.q_nu > maxY) maxY = pt.q_nu;
      if (pt.q_ns > maxY) maxY = pt.q_ns;

      hoverQns.push(
        "Footing Width B = " + pt.B_m.toFixed(2) + " m (B' = " + pt.B_eff.toFixed(2) + " m)" +
        "<br>Net Safe q_ns = " + pt.q_ns.toFixed(2) + " kPa" +
        "<br>Gross Safe q_s = " + pt.q_s.toFixed(2) + " kPa" +
        "<br>Water Table Factor W' = " + pt.W_prime.toFixed(3)
      );

      hoverQnu.push(
        "Footing Width B = " + pt.B_m.toFixed(2) + " m (B' = " + pt.B_eff.toFixed(2) + " m)" +
        "<br>Net Ultimate q_nu = " + pt.q_nu.toFixed(2) + " kPa" +
        "<br>Gross Ultimate q_u = " + pt.q_u.toFixed(2) + " kPa"
      );
    }

    var currB = result.geometry.B_m;
    var currQns = result.capacities.q_ns;
    var currQnu = result.capacities.q_nu;

    var traces = [
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Net Ultimate q_nu (kPa)",
        x: widths,
        y: qnuVals,
        text: hoverQnu,
        hoverinfo: "text",
        line: { color: "#0284c7", width: 2, dash: "dash" },
        marker: { size: 6, color: "#0284c7" }
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Net Safe q_ns (kPa)",
        x: widths,
        y: qnsVals,
        text: hoverQns,
        hoverinfo: "text",
        line: { color: "#4f46e5", width: 2.8 },
        marker: { size: 7, color: "#4f46e5" }
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Current Design B (" + currB.toFixed(2) + " m)",
        x: [currB],
        y: [currQns],
        hovertext: [
          "Current Design Footing" +
          "<br>B = " + currB.toFixed(2) + " m" +
          "<br>q_ns = " + currQns.toFixed(2) + " kPa" +
          "<br>q_nu = " + currQnu.toFixed(2) + " kPa"
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

    var layout = {
      margin: { l: 58, r: 16, t: 38, b: 44 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Footing Width, B (m)",
          font: { size: 11, color: "#475569" }
        },
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Bearing Capacity (kPa)",
          font: { size: 11, color: "#475569" }
        },
        range: [0, maxY * 1.15],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      shapes: [
        {
          type: "line",
          x0: currB,
          x1: currB,
          y0: 0,
          y1: maxY * 1.15,
          line: { color: "#e11d48", width: 1.4, dash: "dot" }
        }
      ],
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

    global.Plotly.react(els.sensitivityPlotDiv, traces, layout, config);
  }

  /**
   * Renders KPIs, warning banners, factor breakdown, steps, and Plotly charts.
   */
  function renderResults(state, result, errors) {
    renderAutoSoilSummary(state, result);

    if (errors.length > 0 || !result) {
      els.errorBanner.classList.remove("hidden");
      els.errorList.innerHTML = errors
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
    var warnMsgs = (result.warnings && result.warnings.messages) || [];
    if (warnMsgs.length > 0) {
      els.warningBanner.classList.remove("hidden");
      els.warningList.innerHTML = warnMsgs
        .map(function (msg) {
          return "<li>" + escapeHtml(msg) + "</li>";
        })
        .join("");
    } else {
      els.warningBanner.classList.add("hidden");
      els.warningList.innerHTML = "";
    }

    // KPI Cards
    var cap = result.capacities;
    var g = result.geometry;
    var areaUnit = g.isPerMeterRun ? "m²/m" : "m²";

    els.kpiQns.textContent = formatNum(cap.q_ns, 2) + " kPa";
    els.kpiQnsSub.textContent = "FS = " + formatNum(result.inputs.FS, 2) + " (-)";
    els.kpiQs.textContent = formatNum(cap.q_s, 2) + " kPa";
    els.kpiQsSub.textContent = "q = " + formatNum(result.soil.q, 2) + " kPa";
    els.kpiQnu.textContent = formatNum(cap.q_nu, 2) + " kPa";
    els.kpiQu.textContent = formatNum(cap.q_u, 2) + " kPa";

    els.kpiLoadNs.textContent = "Q_ns: " + formatNum(cap.Q_ns, 1) + " " + cap.loadUnit;
    els.kpiLoadS.textContent = "Q_s: " + formatNum(cap.Q_s, 1) + " " + cap.loadUnit;
    els.kpiLoadAreaNote.textContent = "A' = " + formatNum(g.A_prime, 2) + " " + areaUnit;

    // Resolved shear mode badge & factor table
    els.resolvedShearPill.textContent = result.shear.resolvedShearMode;
    renderFactorTable(result);

    // Step-by-step calculation breakdown
    var steps = result.steps || [];
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

    // Render Plotly charts
    renderTermsPlot(result);
    renderSensitivityPlot(result);
    if (wasHidden) {
      resizeP3Plots();
    }
  }

  /**
   * Executes IS 6403:1981 calculation, syncs state.p3Results with loop guard,
   * and updates all UI outputs without disturbing active input cursor focus.
   */
  function refreshAll(state, forceSyncInputs) {
    var logic = getLogic();
    if (!logic || !state) {
      return;
    }

    syncInputsFromState(state.p3Input, Boolean(forceSyncInputs));
    updateSyncBadge(state);

    var p1ValidLayers =
      Array.isArray(state.validationErrors) && state.validationErrors.length === 0
        ? state.processedLayers
        : [];

    var out = logic.computeBearingCapacity(
      state.p3Input,
      p1ValidLayers,
      state.zw_measured,
      state.zw_design,
      state.gamma_w
    );

    // Loop guard: persist computed results without recursive notify()
    isSyncingFromState = true;
    try {
      state.setP3Results(
        {
          result: out.result,
          errors: out.errors
        },
        false
      );
    } finally {
      isSyncingFromState = false;
    }

    renderResults(state, out.result, out.errors);
  }

  /**
   * Resizes both Module P3 Plotly charts cleanly whenever #tab-p3 becomes visible.
   */
  function resizeP3Plots() {
    if (typeof global.Plotly === "undefined") {
      return;
    }
    global.requestAnimationFrame(function () {
      if (els.termsPlotDiv && els.termsPlotDiv.classList.contains("js-plotly-plot")) {
        global.Plotly.Plots.resize(els.termsPlotDiv);
      }
      if (els.sensitivityPlotDiv && els.sensitivityPlotDiv.classList.contains("js-plotly-plot")) {
        global.Plotly.Plots.resize(els.sensitivityPlotDiv);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // EVENT HANDLERS (Preserving Cursor Focus & Reactive Sync)
  // ---------------------------------------------------------------------------

  function handleNumericInput(el) {
    var state = getState();
    var field = el.getAttribute("data-p3-num");
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
    if (field === "B_m" && (state.p3Input.shape === "Square" || state.p3Input.shape === "Circular")) {
      patch.L_m = parsedVal;
    }

    state.setP3Input(patch);
  }

  function handleSelectChange(el) {
    var state = getState();
    var field = el.getAttribute("data-p3-select");
    if (!field || !state) {
      return;
    }

    var patch = {};
    patch[field] = el.value;

    // Cleanly align dependent dimensions when switching shape
    if (field === "shape") {
      var curB = state.p3Input.B_m;
      if (el.value === "Square" || el.value === "Circular") {
        if (Number.isFinite(curB)) {
          patch.L_m = curB;
        }
      } else if (el.value === "Rectangular") {
        if (Number.isFinite(curB) && (!Number.isFinite(state.p3Input.L_m) || state.p3Input.L_m < curB)) {
          patch.L_m = Number((curB * 1.5).toFixed(2));
        }
      } else if (el.value === "Strip") {
        patch.eL_m = 0.0;
      }
    }

    state.setP3Input(patch);
  }

  function bindEvents() {
    var state = getState();

    // Reset P3 Sample button
    els.btnResetP3.addEventListener("click", function () {
      state.resetP3Defaults();
      syncInputsFromState(state.p3Input, true);
    });

    // Soil source segmented toggle buttons
    els.btnSoilAuto.addEventListener("click", function () {
      if (state.p3Input.useManualSoil) {
        state.setP3Input({ useManualSoil: false });
      }
    });

    els.btnSoilManual.addEventListener("click", function () {
      if (!state.p3Input.useManualSoil) {
        state.setP3Input({ useManualSoil: true });
      }
    });

    // Delegate numeric inputs inside #tab-p3 (preserves active cursor focus)
    els.container.addEventListener("input", function (evt) {
      if (evt.target && evt.target.hasAttribute("data-p3-num")) {
        handleNumericInput(evt.target);
      }
    });

    // Delegate select dropdown changes inside #tab-p3
    els.container.addEventListener("change", function (evt) {
      if (evt.target && evt.target.hasAttribute("data-p3-select")) {
        handleSelectChange(evt.target);
      }
    });

    // Ensure Plotly charts resize cleanly whenever #tab-p3 becomes visible
    var p3TabBtn = document.getElementById("btn-tab-p3");
    if (p3TabBtn) {
      p3TabBtn.addEventListener("click", resizeP3Plots);
    }

    if (typeof global.MutationObserver !== "undefined" && els.container) {
      var observer = new global.MutationObserver(function () {
        if (!els.container.classList.contains("hidden")) {
          resizeP3Plots();
        }
      });
      observer.observe(els.container, { attributes: true, attributeFilter: ["class"] });
    }

    // Reactive subscription to Module P1 stratigraphy, water tables, and P3 state updates
    state.subscribe(function (updatedState) {
      if (isSyncingFromState) {
        return;
      }
      refreshAll(updatedState, false);
    });
  }

  /**
   * Initializes Module P3 UI inside #tab-p3.
   */
  function init() {
    var container = document.getElementById("tab-p3");
    if (!container || !getState() || !getLogic()) {
      return;
    }

    els.container = container;
    buildSkeleton(container);
    bindEvents();
    refreshAll(getState(), true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ModuleP3UI = Object.freeze({
    init: init,
    resizePlots: resizeP3Plots
  });
})(window);