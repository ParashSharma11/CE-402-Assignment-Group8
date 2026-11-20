/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P1 UI & Plotly Stratigraphic Visualization: window.ModuleP1UI
 * ==============================================================================
 * Renders the interactive Module P1 interface inside #tab-p1 using
 * window.GeotechState and window.ModuleP1Logic.
 * Strict SI Units: Force (kN), Stress/Modulus (kPa), Depth/Thickness (m),
 * Settlement (mm), Unit Weight (kN/m³), Consolidation Coefficient (mm²/s).
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
    kpiTotalDepth: null,
    kpiLayerCount: null,
    kpiZwMeasured: null,
    kpiZwDesign: null,
    inputZwMeasured: null,
    inputZwDesign: null,
    badgeGammaW: null,
    btnReset: null,
    btnAddLayer: null,
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
   * Builds the static skeleton of Module P1 inside #tab-p1 once.
   */
  function buildSkeleton(container) {
    container.innerHTML = [
      '<div class="space-y-6">',
      '  <!-- 1. Top KPI Summary Bar -->',
      '  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">',
      '    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">',
      '      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Total Profile Depth</p>',
      '      <p id="p1-kpi-total-depth" class="mt-1 text-2xl font-bold font-mono text-slate-900">0.00 m</p>',
      '    </div>',
      '    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">',
      '      <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Number of Layers</p>',
      '      <p id="p1-kpi-layer-count" class="mt-1 text-2xl font-bold font-mono text-slate-900">0</p>',
      '    </div>',
      '    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">',
      '      <p class="text-xs font-medium uppercase tracking-wider text-sky-700">Measured Water Table (z<sub>w,meas</sub>)</p>',
      '      <p id="p1-kpi-zw-meas" class="mt-1 text-2xl font-bold font-mono text-sky-700">0.00 m</p>',
      '    </div>',
      '    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">',
      '      <p class="text-xs font-medium uppercase tracking-wider text-rose-700">Design Water Table (z<sub>w,des</sub>)</p>',
      '      <p id="p1-kpi-zw-des" class="mt-1 text-2xl font-bold font-mono text-rose-700">0.00 m</p>',
      '    </div>',
      '  </div>',

      '  <!-- 2. Groundwater & Profile Controls Bar -->',
      '  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">',
      '    <div class="flex flex-wrap items-center gap-4">',
      '      <div>',
      '        <label for="p1-zw-measured" class="block text-xs font-semibold text-slate-700 mb-1">Measured Water Table z<sub>w,meas</sub> (m)</label>',
      '        <input id="p1-zw-measured" type="number" min="0.0" step="0.1" class="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none" />',
      '      </div>',
      '      <div>',
      '        <label for="p1-zw-design" class="block text-xs font-semibold text-slate-700 mb-1">Design Water Table z<sub>w,des</sub> (m)</label>',
      '        <input id="p1-zw-design" type="number" min="0.0" step="0.1" class="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none" />',
      '      </div>',
      '      <div class="self-end">',
      '        <span id="p1-gamma-w-badge" class="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-xs font-mono font-semibold text-slate-700">γ<sub>w</sub> = 9.81 kN/m³</span>',
      '      </div>',
      '    </div>',
      '    <div class="flex items-center gap-3 self-start lg:self-end">',
      '      <button id="p1-btn-add-layer" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow-sm transition-colors cursor-pointer">',
      '        <span>+ Add Layer</span>',
      '      </button>',
      '      <button id="p1-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-sm font-medium transition-colors cursor-pointer">',
      '        <span>Reset to Sample Profile</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- 3. Editable Stratigraphic Input Table -->',
      '  <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">',
      '    <div class="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">',
      '      <div>',
      '        <h2 class="text-base font-semibold text-slate-900">Stratigraphic Soil Layers Input</h2>',
      '        <p class="text-xs text-slate-500">Edit depths, USCS soil type, unit weights (kN/m³), shear strength (kPa, °), stiffness (kPa, -), and consolidation parameters (mm²/s).</p>',
      '      </div>',
      '      <span class="text-xs font-mono text-slate-500">15 Parameters / Layer</span>',
      '    </div>',
      '    <div class="overflow-x-auto">',
      '      <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '        <thead class="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider">',
      '          <tr>',
      '            <th class="px-2.5 py-2.5 text-left sticky left-0 bg-slate-50 z-10 border-r border-slate-200">#</th>',
      '            <th class="px-2.5 py-2.5 text-left min-w-[150px]">Soil Type</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[90px]">z<sub>top</sub> (m)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[90px]">z<sub>bot</sub> (m)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[105px]">γ<sub>moist</sub> (kN/m³)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[105px]">γ<sub>sat</sub> (kN/m³)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[90px]">s<sub>u</sub> (kPa)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[90px]">c&prime; (kPa)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[90px]">&phi;&prime; (&deg;)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[105px]">E&prime; (kPa)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[85px]">&nu;&prime; (-)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[80px]">e<sub>0</sub> (-)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[85px]">C<sub>c</sub> (-)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[85px]">C<sub>r</sub> (-)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[80px]">OCR (-)</th>',
      '            <th class="px-2.5 py-2.5 text-right min-w-[100px]">c<sub>v</sub> (mm²/s)</th>',
      '            <th class="px-2.5 py-2.5 text-center min-w-[75px]">Action</th>',
      '          </tr>',
      '        </thead>',
      '        <tbody id="p1-input-tbody" class="divide-y divide-slate-200 bg-white"></tbody>',
      '      </table>',
      '    </div>',
      '  </div>',

      '  <!-- 4. Validation Alert Banner -->',
      '  <div id="p1-validation-banner" class="hidden rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm" role="alert">',
      '    <div class="flex items-start gap-3">',
      '      <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">!</span>',
      '      <div class="flex-1">',
      '        <h3 class="text-sm font-semibold text-red-900">Profile Validation Errors — Resolve Before Downstream Analysis</h3>',
      '        <ul id="p1-validation-list" class="mt-1.5 list-disc list-inside space-y-1 text-xs text-red-800"></ul>',
      '      </div>',
      '    </div>',
      '  </div>',

      '  <!-- 5. Two-Column Results Workspace (Shown only when errors.length === 0) -->',
      '  <div id="p1-results-section" class="grid grid-cols-1 xl:grid-cols-12 gap-6">',
      '    <!-- Left Column: Derived Parameters Table -->',
      '    <div class="xl:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">',
      '      <div class="px-4 py-3 border-b border-slate-200">',
      '        <h3 class="text-base font-semibold text-slate-900">Derived Stiffness &amp; Buoyant Parameters</h3>',
      '        <p class="text-xs text-slate-500">Computed from validated profile with γ<sub>w</sub> = 9.81 kN/m³ (Terzaghi; Poulos &amp; Davis; Bowles).</p>',
      '      </div>',
      '      <div class="overflow-x-auto flex-1">',
      '        <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '          <thead class="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider">',
      '            <tr>',
      '              <th class="px-3 py-2.5 text-left">Layer</th>',
      '              <th class="px-3 py-2.5 text-left">Soil Type</th>',
      '              <th class="px-3 py-2.5 text-left">Depth (m)</th>',
      '              <th class="px-3 py-2.5 text-right">H<sub>m</sub> (m)</th>',
      '              <th class="px-3 py-2.5 text-right">H<sub>mm</sub> (mm)</th>',
      '              <th class="px-3 py-2.5 text-right">&gamma;&prime;<sub>sub</sub> (kN/m³)</th>',
      '              <th class="px-3 py-2.5 text-right">E<sub>oed</sub> (kPa)</th>',
      '              <th class="px-3 py-2.5 text-right">m<sub>v</sub> (1/kPa)</th>',
      '            </tr>',
      '          </thead>',
      '          <tbody id="p1-derived-tbody" class="divide-y divide-slate-200 font-mono"></tbody>',
      '        </table>',
      '      </div>',
      '    </div>',

      '    <!-- Right Column: Interactive Plotly 2D Stratigraphic Column -->',
      '    <div class="xl:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">',
      '      <div class="px-4 py-3 border-b border-slate-200">',
      '        <h3 class="text-base font-semibold text-slate-900">Stratigraphic Borehole Log &amp; Water Tables</h3>',
      '        <p class="text-xs text-slate-500">Hover over any soil layer to inspect full strength, stiffness, and consolidation properties.</p>',
      '      </div>',
      '      <div class="p-3 flex-1 min-h-[460px]">',
      '        <div id="p1-profile-plot" class="w-full h-[460px]"></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("\n");

    els.kpiTotalDepth = container.querySelector("#p1-kpi-total-depth");
    els.kpiLayerCount = container.querySelector("#p1-kpi-layer-count");
    els.kpiZwMeasured = container.querySelector("#p1-kpi-zw-meas");
    els.kpiZwDesign = container.querySelector("#p1-kpi-zw-des");
    els.inputZwMeasured = container.querySelector("#p1-zw-measured");
    els.inputZwDesign = container.querySelector("#p1-zw-design");
    els.badgeGammaW = container.querySelector("#p1-gamma-w-badge");
    els.btnReset = container.querySelector("#p1-btn-reset");
    els.btnAddLayer = container.querySelector("#p1-btn-add-layer");
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
      var optionsHtml = soilTypes
        .map(function (stType) {
          var selected = layer.soilType === stType ? " selected" : "";
          return '<option value="' + escapeHtml(stType) + '"' + selected + ">" + escapeHtml(stType) + "</option>";
        })
        .join("");

      function numCell(field, step, val) {
        var safeVal = typeof val === "number" && Number.isFinite(val) ? val : "";
        return (
          '<td class="px-1.5 py-1.5 text-right">' +
          '<input type="number" step="' + step + '" data-row="' + idx + '" data-field="' + field + '" value="' + safeVal + '" ' +
          'class="p1-cell-input w-full min-w-[74px] rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs focus:border-sky-500 focus:ring-1 focus:ring-sky-300 outline-none" />' +
          "</td>"
        );
      }

      return [
        '<tr data-row-index="' + idx + '" class="hover:bg-slate-50/80">',
        '  <td class="px-2.5 py-1.5 font-mono font-semibold text-slate-600 sticky left-0 bg-white border-r border-slate-200">L' + (idx + 1) + "</td>",
        '  <td class="px-1.5 py-1.5">',
        '    <select data-row="' + idx + '" data-field="soilType" class="p1-cell-select w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-sky-500 focus:ring-1 focus:ring-sky-300 outline-none">' +
              optionsHtml +
        "    </select>",
        "  </td>",
        numCell("z_top", "0.1", layer.z_top),
        numCell("z_bot", "0.1", layer.z_bot),
        numCell("gamma_moist", "0.1", layer.gamma_moist),
        numCell("gamma_sat", "0.1", layer.gamma_sat),
        numCell("su", "1", layer.su),
        numCell("c_prime", "0.5", layer.c_prime),
        numCell("phi_prime", "0.5", layer.phi_prime),
        numCell("E_prime", "500", layer.E_prime),
        numCell("nu_prime", "0.01", layer.nu_prime),
        numCell("e0", "0.05", layer.e0),
        numCell("Cc", "0.005", layer.Cc),
        numCell("Cr", "0.002", layer.Cr),
        numCell("OCR", "0.1", layer.OCR),
        numCell("cv", "0.005", layer.cv),
        '  <td class="px-2 py-1.5 text-center">',
        '    <button type="button" data-delete-row="' + idx + '" class="p1-delete-btn px-2 py-1 rounded text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer" title="Delete Layer">Del</button>',
        "  </td>",
        "</tr>"
      ].join("");
    });

    els.inputTbody.innerHTML = htmlRows.join("");
  }

  /**
   * Updates the 4 top KPI cards and groundwater control inputs without touching table focus.
   */
  function updateKPIsAndControls(state, processedLayers) {
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

    els.badgeGammaW.innerHTML = "γ<sub>w</sub> = " + formatNum(state.gamma_w, 2) + " kN/m³";
  }

  /**
   * Renders the Derived Parameters table when profile validation passes.
   */
  function renderDerivedTable(processedLayers) {
    var rowsHtml = processedLayers.map(function (layer, idx) {
      var style = getSoilStyle(layer.soilType);
      return [
        '<tr class="hover:bg-slate-50">',
        '  <td class="px-3 py-2 font-semibold text-slate-700">L' + (idx + 1) + "</td>",
        '  <td class="px-3 py-2 font-sans text-slate-800 whitespace-nowrap">',
        '    <span class="inline-flex items-center gap-2">',
        '      <span class="inline-block w-3.5 h-3.5 rounded-sm border shrink-0" style="background-color:' + style.fillColor + ";border-color:" + style.borderColor + ';"></span>',
        "      <span>" + escapeHtml(layer.soilType) + "</span>",
        "    </span>",
        "  </td>",
        '  <td class="px-3 py-2 text-slate-700 whitespace-nowrap">' + formatNum(layer.z_top, 2) + "–" + formatNum(layer.z_bot, 2) + "</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(layer.H_m, 2) + "</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(layer.H_mm, 0) + "</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(layer.gamma_sub, 2) + "</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(layer.E_oed, 0) + "</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatExp(layer.mv, 3) + "</td>",
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
    var yBottomPad = Math.max(0.5, maxDepth * 0.06);
    var yTopPad = Math.max(0.4, maxDepth * 0.04);

    var shapes = [];
    var annotations = [];
    var traces = [];

    // Column geometry in plot x-coordinates: [0.0, 2.4] for soil column, right margin for WT labels
    var colX0 = 0.0;
    var colX1 = 2.4;
    var colMidX = 1.2;

    // Ground surface line at z = 0.0 m
    shapes.push({
      type: "line",
      x0: colX0 - 0.15,
      x1: colX1 + 0.15,
      y0: 0.0,
      y1: 0.0,
      line: { color: "#0f172a", width: 2.5 }
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
        line: { color: style.borderColor, width: 1.5 },
        layer: "below"
      });

      // Centered layer label inside column
      var labelLines = [
        "<b>L" + (idx + 1) + " (" + style.code + ")</b>",
        lyr.soilType,
        lyr.z_top.toFixed(2) + "–" + lyr.z_bot.toFixed(2) + " m (H=" + lyr.H_m.toFixed(2) + " m)"
      ];

      annotations.push({
        x: colMidX,
        y: zMid,
        xref: "x",
        yref: "y",
        text: labelLines.join("<br>"),
        showarrow: false,
        font: { size: 10, color: "#0f172a" },
        align: "center",
        bgcolor: "rgba(255, 255, 255, 0.82)",
        bordercolor: style.borderColor,
        borderwidth: 1,
        borderpad: 3
      });

      // Rich hover polygon spanning the entire soil stratum rectangle
      var hoverHtml = [
        "<b>Layer " + (idx + 1) + ": " + escapeHtml(lyr.soilType) + "</b>",
        "Interval: " + formatNum(lyr.z_top, 2) + " to " + formatNum(lyr.z_bot, 2) + " m (H = " + formatNum(lyr.H_m, 2) + " m / " + formatNum(lyr.H_mm, 0) + " mm)",
        "<b>Unit Weights:</b> γ<sub>moist</sub> = " + formatNum(lyr.gamma_moist, 1) + " kN/m³ | γ<sub>sat</sub> = " + formatNum(lyr.gamma_sat, 1) + " kN/m³ | γ&prime;<sub>sub</sub> = " + formatNum(lyr.gamma_sub, 2) + " kN/m³",
        "<b>Strength:</b> s<sub>u</sub> = " + formatNum(lyr.su, 1) + " kPa | c&prime; = " + formatNum(lyr.c_prime, 1) + " kPa | &phi;&prime; = " + formatNum(lyr.phi_prime, 1) + "&deg;",
        "<b>Stiffness:</b> E&prime; = " + formatNum(lyr.E_prime, 0) + " kPa | &nu;&prime; = " + formatNum(lyr.nu_prime, 2) + " | E<sub>oed</sub> = " + formatNum(lyr.E_oed, 0) + " kPa | m<sub>v</sub> = " + formatExp(lyr.mv, 3) + " 1/kPa",
        "<b>Consolidation:</b> e<sub>0</sub> = " + formatNum(lyr.e0, 2) + " | C<sub>c</sub> = " + formatNum(lyr.Cc, 3) + " | C<sub>r</sub> = " + formatNum(lyr.Cr, 3) + " | OCR = " + formatNum(lyr.OCR, 2) + " | c<sub>v</sub> = " + formatNum(lyr.cv, 3) + " mm²/s"
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
          bgcolor: "#1e293b",
          bordercolor: style.borderColor,
          font: { color: "#f8fafc", size: 11 }
        },
        name: "",
        showlegend: false
      });
    }

    // Measured Water Table (Dashed Blue)
    shapes.push({
      type: "line",
      x0: colX0 - 0.1,
      x1: 3.55,
      y0: zwMeasured,
      y1: zwMeasured,
      line: { color: "#1d4ed8", width: 2, dash: "dash" }
    });
    annotations.push({
      x: 2.52,
      y: zwMeasured,
      xref: "x",
      yref: "y",
      text: "Measured WT (" + formatNum(zwMeasured, 2) + " m)",
      showarrow: false,
      xanchor: "left",
      yanchor: "bottom",
      font: { size: 10, color: "#1d4ed8", family: "sans-serif" },
      bgcolor: "rgba(239, 246, 255, 0.9)",
      borderpad: 2
    });

    // Design Water Table (Solid Red)
    shapes.push({
      type: "line",
      x0: colX0 - 0.1,
      x1: 3.55,
      y0: zwDesign,
      y1: zwDesign,
      line: { color: "#dc2626", width: 2.2, dash: "solid" }
    });
    annotations.push({
      x: 2.52,
      y: zwDesign,
      xref: "x",
      yref: "y",
      text: "Design WT (" + formatNum(zwDesign, 2) + " m)",
      showarrow: false,
      xanchor: "left",
      yanchor: "top",
      font: { size: 10, color: "#dc2626", family: "sans-serif" },
      bgcolor: "rgba(254, 242, 242, 0.9)",
      borderpad: 2
    });

    var layout = {
      margin: { l: 55, r: 20, t: 24, b: 36 },
      xaxis: {
        range: [-0.25, 4.35],
        showgrid: false,
        zeroline: false,
        showticklabels: false,
        fixedrange: true
      },
      yaxis: {
        title: {
          text: "Depth below Ground Surface, z (m)",
          font: { size: 12, color: "#1e293b" }
        },
        range: [maxDepth + yBottomPad, -yTopPad],
        autorange: false,
        gridcolor: "#e2e8f0",
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
      displaylogo: false
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

    // Push validation & derived outputs to global state without re-triggering subscriber loop
    isSyncingFromState = true;
    try {
      state.setProcessedProfile(processedLayers, errors, true);
    } finally {
      isSyncingFromState = false;
    }

    updateKPIsAndControls(state, processedLayers);

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

    els.btnAddLayer.addEventListener("click", handleAddLayer);

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

    // Subscribe to external GeotechState updates (e.g., resetToDefaults or external changes)
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