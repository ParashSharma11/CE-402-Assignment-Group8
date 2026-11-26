/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P1 UI & Plotly Stratigraphic Visualization: window.ModuleP1UI
 * ==============================================================================
 * Precision Engineering UI inside #tab-p1 using window.GeotechState and
 * window.ModuleP1Logic. Strict SI Units: kN, kPa, m, mm, kN/m³, mm²/s.
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", no ES module imports/exports).
 */

(function initModuleP1UI(global) {
  "use strict";

  var DEFAULT_FALLBACK_STYLE = Object.freeze({
    code: "SOIL",
    fillColor: "#cbd5e1",
    borderColor: "#334155"
  });

  // Guard flag to prevent recursive GeotechState subscriber loops
  var isSyncingFromState = false;

  // Cached DOM references inside #tab-p1
  var els = {
    container: null,
    statusBadge: null,
    kpiTotalDepth: null,
    kpiLayerCount: null,
    kpiZwMeasured: null,
    kpiZwDesign: null,
    inputZwMeasured: null,
    inputZwDesign: null,
    badgeGammaW: null,
    btnReset: null,
    btnAddLayerTop: null,
    btnAddLayerBottom: null,
    inputTbody: null,
    validationBanner: null,
    validationList: null,
    resultsSection: null,
    derivedTbody: null,
    plotDiv: null
  };

  function getState() {
    return global.GeotechState;
  }

  function getLogic() {
    return global.ModuleP1Logic;
  }

  function getSoilStyle(soilType) {
    var logic = getLogic();
    if (logic && logic.SOIL_STYLES && logic.SOIL_STYLES[soilType]) {
      return logic.SOIL_STYLES[soilType];
    }
    return DEFAULT_FALLBACK_STYLE;
  }

  function formatNum(val, decimals) {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return "—";
    }
    return val.toFixed(decimals);
  }

  function formatExp(val, decimals) {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return "—";
    }
    return val.toExponential(decimals);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Builds the Precision Engineering layout skeleton of Module P1 inside #tab-p1 once.
   */
  function buildSkeleton(container) {
    container.innerHTML = [
      '<div class="space-y-5">',

      '  <!-- 0. Module Page Header with Live Status & Reset Action -->',
      '  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">',
      '    <div>',
      '      <div class="flex items-center gap-2.5">',
      '        <h2 class="text-xl font-bold tracking-tight text-slate-900">Stratigraphic Soil Profile</h2>',
      '        <span id="p1-status-badge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">',
      '          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Valid Profile',
      '        </span>',
      '      </div>',
      '      <p class="mt-0.5 text-xs text-slate-500">Define continuous strata from ground surface (z = 0.00 m) and phreatic boundaries for downstream modules P2&ndash;P5.</p>',
      '    </div>',
      '    <div class="flex items-center gap-2.5 self-start sm:self-auto">',
      '      <button id="p1-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-2xs transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      '        <span>Reset to Sample</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- 1. Bento Top Strip: 4 KPI Telemetry Cards + Dedicated Groundwater Panel -->',
      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">',
      '    <!-- KPI Metrics Grid (7 cols) -->',
      '    <div class="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3.5 flex flex-col justify-between">',
      '        <div class="flex items-center justify-between">',
      '          <span class="text-[11px] font-medium text-slate-500">Total Depth</span>',
      '          <span class="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="m8 17 4 4 4-4"/><path d="M5 3h14"/></svg>',
      '          </span>',
      '        </div>',
      '        <p id="p1-kpi-total-depth" class="mt-2 text-lg font-bold font-mono text-slate-900 tracking-tight">0.00 m</p>',
      '      </div>',

      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3.5 flex flex-col justify-between">',
      '        <div class="flex items-center justify-between">',
      '          <span class="text-[11px] font-medium text-slate-500">Soil Layers</span>',
      '          <span class="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
      '          </span>',
      '        </div>',
      '        <p id="p1-kpi-layer-count" class="mt-2 text-lg font-bold font-mono text-slate-900 tracking-tight">0</p>',
      '      </div>',

      '      <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 shadow-sm p-3.5 flex flex-col justify-between">',
      '        <span class="text-[11px] font-medium text-sky-700">Measured WT</span>',
      '        <p id="p1-kpi-zw-meas" class="mt-2 text-lg font-bold font-mono text-sky-700 tracking-tight">0.00 m</p>',
      '      </div>',

      '      <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-rose-500 shadow-sm p-3.5 flex flex-col justify-between">',
      '        <span class="text-[11px] font-medium text-rose-700">Design WT</span>',
      '        <p id="p1-kpi-zw-des" class="mt-2 text-lg font-bold font-mono text-rose-700 tracking-tight">0.00 m</p>',
      '      </div>',
      '    </div>',

      '    <!-- Groundwater & Datum Controls Card (5 cols) -->',
      '    <div class="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-sm p-3.5 flex flex-col justify-between gap-2.5">',
      '      <div class="flex items-center justify-between">',
      '        <span class="text-xs font-semibold text-slate-800">Groundwater Conditions</span>',
      '        <span id="p1-gamma-w-badge" class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono font-medium text-slate-600 ring-1 ring-inset ring-slate-200">&gamma;<sub>w</sub> = 9.81 kN/m&sup3;</span>',
      '      </div>',
      '      <div class="grid grid-cols-2 gap-3">',
      '        <div>',
      '          <label for="p1-zw-measured" class="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 mb-1">',
      '            <span class="w-2 h-2 rounded-full bg-sky-500"></span>Measured z<sub>w,meas</sub>',
      '          </label>',
      '          <div class="relative">',
      '            <input id="p1-zw-measured" type="number" min="0.0" step="0.1" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-3 pr-8 py-1.5 text-sm font-mono text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all" />',
      '            <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-mono text-slate-400">m</span>',
      '          </div>',
      '        </div>',
      '        <div>',
      '          <label for="p1-zw-design" class="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 mb-1">',
      '            <span class="w-2 h-2 rounded-full bg-rose-500"></span>Design z<sub>w,des</sub>',
      '          </label>',
      '          <div class="relative">',
      '            <input id="p1-zw-design" type="number" min="0.0" step="0.1" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-3 pr-8 py-1.5 text-sm font-mono text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all" />',
      '            <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-mono text-slate-400">m</span>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>',

      '  <!-- 2. Editable Stratigraphic Input Table with Grouped Headers & Contextual Add Button -->',
      '  <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '    <div class="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white">',
      '      <div>',
      '        <h3 class="text-sm font-semibold text-slate-900">Stratigraphic Layer Parameters</h3>',
      '        <p class="text-[11px] text-slate-500">All 15 SI parameters update live without interrupting cursor focus. Scroll horizontally for consolidation inputs.</p>',
      '      </div>',
      '      <div class="flex items-center gap-2 self-start sm:self-auto">',
      '        <button id="p1-btn-add-layer-top" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer">',
      '          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '          <span>Add Soil Layer</span>',
      '        </button>',
      '      </div>',
      '    </div>',

      '    <div class="overflow-x-auto">',
      '      <table class="min-w-full border-collapse text-xs">',
      '        <thead>',
      '          <!-- Group Super-Headers -->',
      '          <tr class="text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200">',
      '            <th colspan="4" class="px-3 py-1.5 text-left bg-slate-100/80 text-slate-600 border-r border-slate-200">Stratigraphy</th>',
      '            <th colspan="2" class="px-3 py-1.5 text-center bg-sky-50/70 text-sky-800 border-r border-slate-200">Unit Weights (kN/m&sup3;)</th>',
      '            <th colspan="3" class="px-3 py-1.5 text-center bg-amber-50/70 text-amber-800 border-r border-slate-200">Shear Strength</th>',
      '            <th colspan="2" class="px-3 py-1.5 text-center bg-indigo-50/70 text-indigo-800 border-r border-slate-200">Elastic Stiffness</th>',
      '            <th colspan="5" class="px-3 py-1.5 text-center bg-emerald-50/70 text-emerald-800 border-r border-slate-200">1D Consolidation</th>',
      '            <th class="px-2 py-1.5 bg-slate-100/80"></th>',
      '          </tr>',
      '          <!-- Column Sub-Headers -->',
      '          <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">',
      '            <th class="px-2.5 py-2.5 text-left sticky left-0 bg-slate-50 z-20 border-r border-slate-200 w-10">#</th>',
      '            <th class="px-2.5 py-2.5 text-left min-w-[165px]">Soil Type (USCS)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[82px]">z<sub>top</sub> (m)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[82px] border-r border-slate-200">z<sub>bot</sub> (m)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[88px]">&gamma;<sub>moist</sub></th>',
      '            <th class="px-2 py-2.5 text-right min-w-[88px] border-r border-slate-200">&gamma;<sub>sat</sub></th>',
      '            <th class="px-2 py-2.5 text-right min-w-[82px]">s<sub>u</sub> (kPa)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[82px]">c&prime; (kPa)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[82px] border-r border-slate-200">&phi;&prime; (&deg;)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[96px]">E&prime; (kPa)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[78px] border-r border-slate-200">&nu;&prime; (-)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[76px]">e<sub>0</sub> (-)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[80px]">C<sub>c</sub> (-)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[80px]">C<sub>r</sub> (-)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[76px]">OCR (-)</th>',
      '            <th class="px-2 py-2.5 text-right min-w-[96px] border-r border-slate-200">c<sub>v</sub> (mm&sup2;/s)</th>',
      '            <th class="px-2 py-2.5 text-center sticky right-0 bg-slate-50 z-20 border-l border-slate-200 w-12">Del</th>',
      '          </tr>',
      '        </thead>',
      '        <tbody id="p1-input-tbody" class="divide-y divide-slate-100 bg-white"></tbody>',
      '      </table>',
      '    </div>',

      '    <!-- Spreadsheet-style Bottom Quick Add Bar -->',
      '    <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between">',
      '      <button id="p1-btn-add-layer-bottom" type="button" class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '        <span>Append new layer (+3.00 m depth increment)</span>',
      '      </button>',
      '      <span class="hidden sm:inline text-[11px] text-slate-400 font-mono">z_top[i] must equal z_bot[i-1] (&plusmn;1 mm)</span>',
      '    </div>',
      '  </div>',

      '  <!-- 3. Validation Alert Banner -->',
      '  <div id="p1-validation-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '    <div class="flex items-start gap-3">',
      '      <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '      </div>',
      '      <div class="flex-1">',
      '        <h3 class="text-sm font-semibold text-rose-900">Stratigraphic Validation Failed</h3>',
      '        <p class="text-xs text-rose-700 mt-0.5">Correct the following engineering constraints to unlock derived parameters and the borehole log:</p>',
      '        <ul id="p1-validation-list" class="mt-2 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '      </div>',
      '    </div>',
      '  </div>',

      '  <!-- 4. Two-Column Results Workspace (Shown only when errors.length === 0) -->',
      '  <div id="p1-results-section" class="grid grid-cols-1 xl:grid-cols-12 gap-5">',
      '    <!-- Left Column: Derived Parameters Table -->',
      '    <div class="xl:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '      <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '        <div>',
      '          <h3 class="text-sm font-semibold text-slate-900">Derived Stiffness &amp; Buoyant Parameters</h3>',
      '          <p class="text-[11px] text-slate-500">Auto-computed from elasticity &amp; buoyancy equations (Terzaghi; Poulos &amp; Davis; Bowles).</p>',
      '        </div>',
      '        <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">SI OUTPUT</span>',
      '      </div>',
      '      <div class="overflow-x-auto flex-1">',
      '        <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '          <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '            <tr>',
      '              <th class="px-3.5 py-2.5 text-left">Layer</th>',
      '              <th class="px-3.5 py-2.5 text-left">Soil Type</th>',
      '              <th class="px-3.5 py-2.5 text-left">Depth (m)</th>',
      '              <th class="px-3.5 py-2.5 text-right">H<sub>m</sub> (m)</th>',
      '              <th class="px-3.5 py-2.5 text-right">H<sub>mm</sub> (mm)</th>',
      '              <th class="px-3.5 py-2.5 text-right">&gamma;&prime;<sub>sub</sub> (kN/m&sup3;)</th>',
      '              <th class="px-3.5 py-2.5 text-right">E<sub>oed</sub> (kPa)</th>',
      '              <th class="px-3.5 py-2.5 text-right">m<sub>v</sub> (1/kPa)</th>',
      '            </tr>',
      '          </thead>',
      '          <tbody id="p1-derived-tbody" class="divide-y divide-slate-100 font-mono"></tbody>',
      '        </table>',
      '      </div>',
      '      <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex flex-wrap gap-x-4 gap-y-1">',
      '        <span>&gamma;&prime;<sub>sub</sub> = &gamma;<sub>sat</sub> &minus; &gamma;<sub>w</sub></span>',
      '        <span>E<sub>oed</sub> = E&prime;(1&minus;&nu;&prime;) / [(1+&nu;&prime;)(1&minus;2&nu;&prime;)]</span>',
      '        <span>m<sub>v</sub> = 1 / E<sub>oed</sub></span>',
      '      </div>',
      '    </div>',

      '    <!-- Right Column: Interactive Plotly 2D Stratigraphic Column -->',
      '    <div class="xl:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '      <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '        <div>',
      '          <h3 class="text-sm font-semibold text-slate-900">Borehole Stratigraphic Log</h3>',
      '          <p class="text-[11px] text-slate-500">Hover anywhere inside a stratum for complete geotechnical metadata.</p>',
      '        </div>',
      '        <div class="flex items-center gap-2 text-[10px] font-medium">',
      '          <span class="inline-flex items-center gap-1 text-sky-700"><span class="w-3 border-t-2 border-dashed border-sky-600"></span>Meas</span>',
      '          <span class="inline-flex items-center gap-1 text-rose-700"><span class="w-3 border-t-2 border-solid border-rose-600"></span>Des</span>',
      '        </div>',
      '      </div>',
      '      <div class="p-3 flex-1 min-h-[480px]">',
      '        <div id="p1-profile-plot" class="w-full h-[480px]"></div>',
      '      </div>',
      '    </div>',
      '  </div>',

      '</div>'
    ].join("\n");

    els.statusBadge = container.querySelector("#p1-status-badge");
    els.kpiTotalDepth = container.querySelector("#p1-kpi-total-depth");
    els.kpiLayerCount = container.querySelector("#p1-kpi-layer-count");
    els.kpiZwMeasured = container.querySelector("#p1-kpi-zw-meas");
    els.kpiZwDesign = container.querySelector("#p1-kpi-zw-des");
    els.inputZwMeasured = container.querySelector("#p1-zw-measured");
    els.inputZwDesign = container.querySelector("#p1-zw-design");
    els.badgeGammaW = container.querySelector("#p1-gamma-w-badge");
    els.btnReset = container.querySelector("#p1-btn-reset");
    els.btnAddLayerTop = container.querySelector("#p1-btn-add-layer-top");
    els.btnAddLayerBottom = container.querySelector("#p1-btn-add-layer-bottom");
    els.inputTbody = container.querySelector("#p1-input-tbody");
    els.validationBanner = container.querySelector("#p1-validation-banner");
    els.validationList = container.querySelector("#p1-validation-list");
    els.resultsSection = container.querySelector("#p1-results-section");
    els.derivedTbody = container.querySelector("#p1-derived-tbody");
    els.plotDiv = container.querySelector("#p1-profile-plot");
  }

  /**
   * Renders the editable input table rows. Called ONLY on initial load,
   * Add Layer, Delete Layer, or Reset — never on numeric typing to preserve focus.
   */
  function renderInputTable() {
    var state = getState();
    var logic = getLogic();
    var layers = state.layers || [];
    var soilTypes = (logic && logic.SOIL_TYPES) || [
      "Clay (CL/CH)",
      "Silt (ML/MH)",
      "Sand (SW/SP)",
      "Gravel (GW/GP)",
      "Peat (Pt)",
      "Rock / Bedrock"
    ];

    var htmlRows = layers.map(function (layer, idx) {
      var style = getSoilStyle(layer.soilType);
      var optionsHtml = soilTypes
        .map(function (stType) {
          var selected = layer.soilType === stType ? " selected" : "";
          return '<option value="' + escapeHtml(stType) + '"' + selected + ">" + escapeHtml(stType) + "</option>";
        })
        .join("");

      function numCell(field, step, val, rightBorder) {
        var safeVal = typeof val === "number" && Number.isFinite(val) ? val : "";
        var borderCls = rightBorder ? " border-r border-slate-200" : "";
        return (
          '<td class="px-1.5 py-1.5 text-right' + borderCls + '">' +
          '<input type="number" step="' + step + '" data-row="' + idx + '" data-field="' + field + '" value="' + safeVal + '" ' +
          'class="p1-cell-input clean-num w-full min-w-[68px] rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 px-2 py-1 text-right font-mono text-xs text-slate-800 outline-none transition-all" />' +
          "</td>"
        );
      }

      return [
        '<tr data-row-index="' + idx + '" class="group hover:bg-indigo-50/30 transition-colors">',
        '  <td class="px-2.5 py-1.5 font-mono font-semibold text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200">L' + (idx + 1) + "</td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="flex items-center gap-2">',
        '      <span class="p1-row-swatch inline-block w-3 h-3 rounded-sm border shrink-0" data-swatch-row="' + idx + '" style="background-color:' + style.fillColor + ";border-color:" + style.borderColor + ';"></span>',
        '      <select data-row="' + idx + '" data-field="soilType" class="p1-cell-select w-full rounded-md border border-slate-200 bg-white hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-2 py-1 text-xs font-medium text-slate-800 outline-none transition-all">' +
                optionsHtml +
        "      </select>",
        "    </div>",
        "  </td>",
        numCell("z_top", "0.1", layer.z_top, false),
        numCell("z_bot", "0.1", layer.z_bot, true),
        numCell("gamma_moist", "0.1", layer.gamma_moist, false),
        numCell("gamma_sat", "0.1", layer.gamma_sat, true),
        numCell("su", "1", layer.su, false),
        numCell("c_prime", "0.5", layer.c_prime, false),
        numCell("phi_prime", "0.5", layer.phi_prime, true),
        numCell("E_prime", "500", layer.E_prime, false),
        numCell("nu_prime", "0.01", layer.nu_prime, true),
        numCell("e0", "0.05", layer.e0, false),
        numCell("Cc", "0.005", layer.Cc, false),
        numCell("Cr", "0.002", layer.Cr, false),
        numCell("OCR", "0.1", layer.OCR, false),
        numCell("cv", "0.005", layer.cv, true),
        '  <td class="px-2 py-1.5 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-200">',
        '    <button type="button" data-delete-row="' + idx + '" class="p1-delete-btn inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Layer L' + (idx + 1) + '" aria-label="Delete Layer L' + (idx + 1) + '">',
        '      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/></svg>',
        "    </button>",
        "  </td>",
        "</tr>"
      ].join("");
    });

    els.inputTbody.innerHTML = htmlRows.join("");
  }

  /**
   * Updates KPI cards, status pill, and groundwater inputs without touching table focus.
   */
  function updateKPIsAndControls(state, processedLayers, errorCount) {
    var layers = state.layers || [];
    var maxDepth = 0.0;

    if (Array.isArray(processedLayers) && processedLayers.length > 0) {
      for (var i = 0; i < processedLayers.length; i++) {
        if (typeof processedLayers[i].z_bot === "number" && Number.isFinite(processedLayers[i].z_bot)) {
          if (processedLayers[i].z_bot > maxDepth) {
            maxDepth = processedLayers[i].z_bot;
          }
        }
      }
    } else {
      for (var j = 0; j < layers.length; j++) {
        if (typeof layers[j].z_bot === "number" && Number.isFinite(layers[j].z_bot)) {
          if (layers[j].z_bot > maxDepth) {
            maxDepth = layers[j].z_bot;
          }
        }
      }
    }

    els.kpiTotalDepth.textContent = formatNum(maxDepth, 2) + " m";
    els.kpiLayerCount.textContent = String(layers.length);
    els.kpiZwMeasured.textContent = formatNum(state.zw_measured, 2) + " m";
    els.kpiZwDesign.textContent = formatNum(state.zw_design, 2) + " m";

    if (document.activeElement !== els.inputZwMeasured) {
      els.inputZwMeasured.value = String(state.zw_measured);
    }
    if (document.activeElement !== els.inputZwDesign) {
      els.inputZwDesign.value = String(state.zw_design);
    }

    els.badgeGammaW.innerHTML = "&gamma;<sub>w</sub> = " + formatNum(state.gamma_w, 2) + " kN/m&sup3;";

    if (errorCount > 0) {
      els.statusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20";
      els.statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>' + errorCount + (errorCount === 1 ? " Error" : " Errors");
    } else {
      els.statusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
      els.statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Valid Profile';
    }
  }

  /**
   * Renders the Derived Parameters table when profile validation passes.
   */
  function renderDerivedTable(processedLayers) {
    var rowsHtml = processedLayers.map(function (layer, idx) {
      var style = getSoilStyle(layer.soilType);
      return [
        '<tr class="hover:bg-slate-50/80 transition-colors">',
        '  <td class="px-3.5 py-2.5 font-semibold text-slate-600">L' + (idx + 1) + "</td>",
        '  <td class="px-3.5 py-2.5 font-sans text-slate-800 whitespace-nowrap">',
        '    <span class="inline-flex items-center gap-2">',
        '      <span class="inline-block w-3 h-3 rounded-sm border shrink-0" style="background-color:' + style.fillColor + ";border-color:" + style.borderColor + ';"></span>',
        '      <span class="font-medium">' + escapeHtml(layer.soilType) + "</span>",
        "    </span>",
        "  </td>",
        '  <td class="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">' + formatNum(layer.z_top, 2) + "&ndash;" + formatNum(layer.z_bot, 2) + "</td>",
        '  <td class="px-3.5 py-2.5 text-right text-slate-800">' + formatNum(layer.H_m, 2) + "</td>",
        '  <td class="px-3.5 py-2.5 text-right text-slate-600">' + formatNum(layer.H_mm, 0) + "</td>",
        '  <td class="px-3.5 py-2.5 text-right text-slate-800">' + formatNum(layer.gamma_sub, 2) + "</td>",
        '  <td class="px-3.5 py-2.5 text-right font-semibold text-indigo-700">' + formatNum(layer.E_oed, 0) + "</td>",
        '  <td class="px-3.5 py-2.5 text-right text-slate-700">' + formatExp(layer.mv, 3) + "</td>",
        "</tr>"
      ].join("");
    });

    els.derivedTbody.innerHTML = rowsHtml.join("");
  }

  /**
   * Renders or updates the interactive Plotly.js 2D Stratigraphic Borehole Log.
   */
  function renderProfilePlot(processedLayers, zwMeasured, zwDesign) {
    if (typeof global.Plotly === "undefined" || !els.plotDiv) {
      return;
    }

    var maxLayerDepth = 0.0;
    for (var i = 0; i < processedLayers.length; i++) {
      if (processedLayers[i].z_bot > maxLayerDepth) {
        maxLayerDepth = processedLayers[i].z_bot;
      }
    }

    var maxDepth = Math.max(maxLayerDepth, zwMeasured, zwDesign);
    var yBottomPad = Math.max(0.6, maxDepth * 0.06);
    var yTopPad = Math.max(0.45, maxDepth * 0.045);

    var shapes = [];
    var annotations = [];
    var traces = [];

    var colX0 = 0.0;
    var colX1 = 2.45;
    var colMidX = 1.225;

    // Ground surface datum line (z = 0.00 m)
    shapes.push({
      type: "line",
      x0: colX0 - 0.18,
      x1: colX1 + 0.18,
      y0: 0.0,
      y1: 0.0,
      line: { color: "#0f172a", width: 2.5 }
    });

    annotations.push({
      x: colMidX,
      y: 0.0,
      xref: "x",
      yref: "y",
      text: "GL (0.00 m)",
      showarrow: false,
      yshift: 10,
      font: { size: 10, color: "#475569", family: "JetBrains Mono, monospace" }
    });

    for (var idx = 0; idx < processedLayers.length; idx++) {
      var lyr = processedLayers[idx];
      var style = getSoilStyle(lyr.soilType);
      var zMid = 0.5 * (lyr.z_top + lyr.z_bot);

      // Lithology rectangle
      shapes.push({
        type: "rect",
        x0: colX0,
        x1: colX1,
        y0: lyr.z_top,
        y1: lyr.z_bot,
        fillcolor: style.fillColor,
        line: { color: style.borderColor, width: 1.4 },
        layer: "below"
      });

      // Centered layer annotation pill
      var labelLines = [
        "<b>L" + (idx + 1) + " &middot; " + style.code + "</b>",
        lyr.soilType,
        lyr.z_top.toFixed(2) + "&ndash;" + lyr.z_bot.toFixed(2) + " m (H=" + lyr.H_m.toFixed(2) + " m)"
      ];

      annotations.push({
        x: colMidX,
        y: zMid,
        xref: "x",
        yref: "y",
        text: labelLines.join("<br>"),
        showarrow: false,
        font: { size: 10, color: "#0f172a", family: "Inter, system-ui, sans-serif" },
        align: "center",
        bgcolor: "rgba(255, 255, 255, 0.88)",
        bordercolor: style.borderColor,
        borderwidth: 1,
        borderpad: 4
      });

      // Full-stratum invisible polygon hover target
      var hoverHtml = [
        "<b>Layer " + (idx + 1) + ": " + escapeHtml(lyr.soilType) + "</b>",
        "Depth: " + formatNum(lyr.z_top, 2) + " to " + formatNum(lyr.z_bot, 2) + " m (H = " + formatNum(lyr.H_m, 2) + " m / " + formatNum(lyr.H_mm, 0) + " mm)",
        "<b>Unit Weights:</b> &gamma;<sub>moist</sub> = " + formatNum(lyr.gamma_moist, 1) + " | &gamma;<sub>sat</sub> = " + formatNum(lyr.gamma_sat, 1) + " | &gamma;&prime;<sub>sub</sub> = " + formatNum(lyr.gamma_sub, 2) + " kN/m&sup3;",
        "<b>Strength:</b> s<sub>u</sub> = " + formatNum(lyr.su, 1) + " kPa | c&prime; = " + formatNum(lyr.c_prime, 1) + " kPa | &phi;&prime; = " + formatNum(lyr.phi_prime, 1) + "&deg;",
        "<b>Stiffness:</b> E&prime; = " + formatNum(lyr.E_prime, 0) + " kPa | &nu;&prime; = " + formatNum(lyr.nu_prime, 2) + " | E<sub>oed</sub> = " + formatNum(lyr.E_oed, 0) + " kPa | m<sub>v</sub> = " + formatExp(lyr.mv, 3) + " 1/kPa",
        "<b>Consolidation:</b> e<sub>0</sub> = " + formatNum(lyr.e0, 2) + " | C<sub>c</sub> = " + formatNum(lyr.Cc, 3) + " | C<sub>r</sub> = " + formatNum(lyr.Cr, 3) + " | OCR = " + formatNum(lyr.OCR, 2) + " | c<sub>v</sub> = " + formatNum(lyr.cv, 3) + " mm&sup2;/s"
      ].join("<br>");

      traces.push({
        type: "scatter",
        mode: "lines",
        x: [colX0, colX1, colX1, colX0, colX0],
        y: [lyr.z_top, lyr.z_top, lyr.z_bot, lyr.z_bot, lyr.z_top],
        fill: "toself",
        hoveron: "fills",
        fillcolor: "rgba(0,0,0,0)",
        line: { width: 0 },
        text: hoverHtml,
        hoverinfo: "text",
        hoverlabel: {
          bgcolor: "#0f172a",
          bordercolor: style.borderColor,
          font: { color: "#f8fafc", size: 11, family: "Inter, system-ui, sans-serif" }
        },
        name: "",
        showlegend: false
      });
    }

    // Measured Water Table (Dashed Sky Blue)
    shapes.push({
      type: "line",
      x0: colX0 - 0.12,
      x1: 3.65,
      y0: zwMeasured,
      y1: zwMeasured,
      line: { color: "#0284c7", width: 2, dash: "dash" }
    });
    annotations.push({
      x: 2.55,
      y: zwMeasured,
      xref: "x",
      yref: "y",
      text: "Measured WT (" + formatNum(zwMeasured, 2) + " m)",
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      font: { size: 10, color: "#0369a1", family: "JetBrains Mono, monospace" },
      bgcolor: "rgba(240, 249, 255, 0.95)",
      bordercolor: "#bae6fd",
      borderwidth: 1,
      borderpad: 2
    });

    // Design Water Table (Solid Rose Red)
    shapes.push({
      type: "line",
      x0: colX0 - 0.12,
      x1: 3.65,
      y0: zwDesign,
      y1: zwDesign,
      line: { color: "#e11d48", width: 2.2, dash: "solid" }
    });
    annotations.push({
      x: 2.55,
      y: zwDesign,
      xref: "x",
      yref: "y",
      text: "Design WT (" + formatNum(zwDesign, 2) + " m)",
      showarrow: false,
      xanchor: "left",
      yanchor: "top",
      font: { size: 10, color: "#be123c", family: "JetBrains Mono, monospace" },
      bgcolor: "rgba(255, 241, 242, 0.95)",
      bordercolor: "#fecdd3",
      borderwidth: 1,
      borderpad: 2
    });

    var layout = {
      margin: { l: 54, r: 16, t: 22, b: 28 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        range: [-0.25, 4.45],
        showgrid: false,
        zeroline: false,
        showticklabels: false,
        fixedrange: true
      },
      yaxis: {
        title: {
          text: "Depth below Ground Surface, z (m)",
          font: { size: 11, color: "#475569" }
        },
        range: [maxDepth + yBottomPad, -yTopPad],
        autorange: false,
        gridcolor: "#f1f5f9",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" },
        zeroline: false
      },
      shapes: shapes,
      annotations: annotations,
      plot_bgcolor: "#ffffff",
      paper_bgcolor: "#ffffff",
      hovermode: "closest"
    };

    var config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
    };

    global.Plotly.react(els.plotDiv, traces, layout, config);
  }

  /**
   * Executes validation, syncs processed state, and updates KPIs, alerts,
   * derived table, and Plotly chart.
   */
  function refreshDerivedAndVisuals(state) {
    var logic = getLogic();
    if (!logic) {
      return;
    }

    var result = logic.validateAndProcessProfile(state.layers, state.gamma_w);
    var processedLayers = result.processedLayers;
    var errors = result.errors;

    isSyncingFromState = true;
    try {
      state.setProcessedProfile(processedLayers, errors, true);
    } finally {
      isSyncingFromState = false;
    }

    updateKPIsAndControls(state, processedLayers, errors.length);

    if (errors.length > 0) {
      els.validationBanner.classList.remove("hidden");
      els.validationList.innerHTML = errors
        .map(function (err) {
          return "<li>" + escapeHtml(err) + "</li>";
        })
        .join("");
      els.resultsSection.classList.add("hidden");
    } else {
      els.validationBanner.classList.add("hidden");
      els.validationList.innerHTML = "";
      els.resultsSection.classList.remove("hidden");
      renderDerivedTable(processedLayers);
      renderProfilePlot(processedLayers, state.zw_measured, state.zw_design);
    }
  }

  /**
   * Reads a single cell change from the input table without destroying focus.
   */
  function handleCellUpdate(target, isChangeEvent) {
    var state = getState();
    var rowAttr = target.getAttribute("data-row");
    var field = target.getAttribute("data-field");
    if (rowAttr === null || !field) {
      return;
    }

    var rowIdx = parseInt(rowAttr, 10);
    if (!Number.isInteger(rowIdx) || !state.layers[rowIdx]) {
      return;
    }

    var updatedLayers = state.layers.map(function (lyr, i) {
      if (i !== rowIdx) {
        return lyr;
      }
      var copy = Object.assign({}, lyr);
      if (field === "soilType") {
        copy.soilType = target.value;
      } else {
        var rawStr = String(target.value).trim();
        if (rawStr === "") {
          copy[field] = NaN;
        } else {
          var parsed = Number(rawStr);
          copy[field] = Number.isFinite(parsed) ? parsed : NaN;
        }
      }
      return copy;
    });

    // Update the inline row color swatch immediately when soilType changes
    if (field === "soilType") {
      var swatch = els.inputTbody.querySelector('[data-swatch-row="' + rowIdx + '"]');
      if (swatch) {
        var style = getSoilStyle(target.value);
        swatch.style.backgroundColor = style.fillColor;
        swatch.style.borderColor = style.borderColor;
      }
    }

    state.layers = updatedLayers;
    refreshDerivedAndVisuals(state);

    if (isChangeEvent && field === "soilType") {
      state.notify();
    }
  }

  /**
   * Adds a new layer starting at the previous layer's z_bot (or 0.0 m if none)
   * with z_bot = z_top + 3.0 m and valid default Sand parameters.
   */
  function handleAddLayer() {
    var state = getState();
    var currentLayers = state.layers || [];
    var startDepth = 0.0;

    if (currentLayers.length > 0) {
      var lastLayer = currentLayers[currentLayers.length - 1];
      if (typeof lastLayer.z_bot === "number" && Number.isFinite(lastLayer.z_bot)) {
        startDepth = Number(lastLayer.z_bot.toFixed(2));
      }
    }

    var newLayer = {
      soilType: "Sand (SW/SP)",
      z_top: startDepth,
      z_bot: Number((startDepth + 3.0).toFixed(2)),
      gamma_moist: 18.0,
      gamma_sat: 20.0,
      su: 0.0,
      c_prime: 0.0,
      phi_prime: 32.0,
      E_prime: 25000.0,
      nu_prime: 0.30,
      e0: 0.65,
      Cc: 0.020,
      Cr: 0.005,
      OCR: 1.00,
      cv: 10.000
    };

    var nextLayers = currentLayers.concat([newLayer]);
    state.setLayers(nextLayers);
    renderInputTable();
  }

  /**
   * Deletes a layer at the specified row index and re-renders the input table.
   */
  function handleDeleteLayer(rowIdx) {
    var state = getState();
    var currentLayers = state.layers || [];
    if (rowIdx < 0 || rowIdx >= currentLayers.length) {
      return;
    }

    var nextLayers = currentLayers.filter(function (_, idx) {
      return idx !== rowIdx;
    });

    state.setLayers(nextLayers);
    renderInputTable();
  }

  /**
   * Binds DOM event listeners once after building the skeleton.
   */
  function bindEvents() {
    var state = getState();

    els.inputZwMeasured.addEventListener("input", function () {
      var val = parseFloat(els.inputZwMeasured.value);
      state.setWaterTables(Number.isFinite(val) ? val : 0.0, state.zw_design);
    });

    els.inputZwDesign.addEventListener("input", function () {
      var val = parseFloat(els.inputZwDesign.value);
      state.setWaterTables(state.zw_measured, Number.isFinite(val) ? val : 0.0);
    });

    els.btnAddLayerTop.addEventListener("click", handleAddLayer);
    els.btnAddLayerBottom.addEventListener("click", handleAddLayer);

    els.btnReset.addEventListener("click", function () {
      state.resetToDefaults();
      renderInputTable();
    });

    // Delegate input and change events on the editable table body (preserves focus)
    els.inputTbody.addEventListener("input", function (evt) {
      if (evt.target && (evt.target.classList.contains("p1-cell-input") || evt.target.classList.contains("p1-cell-select"))) {
        handleCellUpdate(evt.target, false);
      }
    });

    els.inputTbody.addEventListener("change", function (evt) {
      if (evt.target && (evt.target.classList.contains("p1-cell-input") || evt.target.classList.contains("p1-cell-select"))) {
        handleCellUpdate(evt.target, true);
      }
    });

    els.inputTbody.addEventListener("click", function (evt) {
      var delBtn = evt.target.closest ? evt.target.closest(".p1-delete-btn") : null;
      if (delBtn) {
        var idx = parseInt(delBtn.getAttribute("data-delete-row"), 10);
        if (Number.isInteger(idx)) {
          handleDeleteLayer(idx);
        }
      }
    });

    // Subscribe to external GeotechState updates
    state.subscribe(function (updatedState) {
      if (isSyncingFromState) {
        return;
      }
      refreshDerivedAndVisuals(updatedState);
    });
  }

  /**
   * Initializes Module P1 UI inside #tab-p1.
   */
  function init() {
    var container = document.getElementById("tab-p1");
    if (!container || !getState() || !getLogic()) {
      return;
    }

    els.container = container;
    buildSkeleton(container);
    renderInputTable();
    bindEvents();
    refreshDerivedAndVisuals(getState());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ModuleP1UI = Object.freeze({
    init: init
  });
})(window);