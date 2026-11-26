/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P4 UI & Plotly Visualization: window.ModuleP4StressUI
 * ==============================================================================
 * Renders the Vertical Stress Increase interface (Boussinesq Centre by
 * 4-Quadrant Superposition, Boussinesq Corner & 2:1 Dispersion) inside #tab-p4
 * using window.ModuleP4StressLogic (and optional sync from window.GeotechState).
 *
 * Strict SI Units: Dimensions/Depths (m), Net Contact Pressure q0 (kPa),
 * Vertical Stress Increase Δσ_z (kPa), Dimensionless Influence Factors (-).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", zero ES module imports/exports).
 */

(function initModuleP4StressUI(global) {
  "use strict";

  // Local reactive module input state (strict SI units)
  var currentInput = {
    B_m: 2.0,
    L_m: 3.0,
    Df_m: 1.5,
    q0_kPa: 100.0,
    maxDepthBelowBase_m: 10.0,
    queryDepthBelowBase_m: 2.0
  };

  // Cached DOM references inside #tab-p4
  var els = {
    container: null,
    statusBadge: null,
    syncNote: null,
    btnSyncP3: null,
    btnReset: null,

    // Left panel inputs
    inputB: null,
    inputL: null,
    inputDf: null,
    inputQ0: null,
    inputZMax: null,
    inputZQuery: null,
    readoutZBgl: null,

    // 4-Quadrant Superposition Visual Breakdown Card
    quadSvgBHalf: null,
    quadSvgLHalf: null,
    quadDimText: null,
    quadMqVal: null,
    quadNqVal: null,
    quadIQuadVal: null,
    quadICentreEq: null,

    // Right panel alerts & results workspace
    errorBanner: null,
    errorList: null,
    resultsWorkspace: null,

    // 4 KPI Cards
    kpiCentreVal: null,
    kpiCentreSub: null,
    kpiCornerVal: null,
    kpiCornerSub: null,
    kpi2to1Val: null,
    kpi2to1Sub: null,
    kpiRatioVal: null,
    kpiRatioSub: null,

    // Chart, Table & Audit Steps
    plotDiv: null,
    tableTbody: null,
    stepsCount: null,
    stepsContainer: null
  };

  function getLogic() {
    return global.ModuleP4StressLogic;
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

  function formatRatio(val) {
    if (val === Infinity) {
      return "∞";
    }
    return formatNum(val, 3);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSampleDefaults() {
    var logic = getLogic();
    if (logic && logic.DEFAULT_INPUT) {
      return Object.assign({}, logic.DEFAULT_INPUT);
    }
    return {
      B_m: 2.0,
      L_m: 3.0,
      Df_m: 1.5,
      q0_kPa: 100.0,
      maxDepthBelowBase_m: 10.0,
      queryDepthBelowBase_m: 2.0
    };
  }

  /**
   * Builds the Precision Engineering layout skeleton inside #tab-p4 once.
   */
  function buildSkeleton(container) {
    container.innerHTML = [
      '<div class="space-y-5">',

      '  <!-- 1. Top Header Bar -->',
      '  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">',
      '    <div>',
      '      <div class="flex flex-wrap items-center gap-2.5">',
      '        <h2 class="text-xl font-bold tracking-tight text-slate-900">Vertical Stress Increase (Boussinesq Superposition &amp; 2:1 Method)</h2>',
      '        <span id="p4s-status-badge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">',
      '          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Valid Inputs',
      '        </span>',
      '      </div>',
      '      <p class="mt-0.5 text-xs text-slate-500">Exact Newmark (1935) / Boussinesq (1885) 4-quadrant centre superposition and full-rectangle corner stress compared with 2:1 dispersion (IS 8009 Part 1:1976).</p>',
      '    </div>',
      '    <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">',
      '      <button id="p4s-btn-sync-p3" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
      '        <span>Sync from P3</span>',
      '      </button>',
      '      <button id="p4s-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-2xs transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      '        <span>Reset Sample</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- Optional Sync Feedback Strip -->',
      '  <div id="p4s-sync-note" class="hidden rounded-lg border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs text-indigo-900 font-mono"></div>',

      '  <!-- Main 12-Column Responsive Layout: Left Panel (4 cols) + Right Panel (8 cols) -->',
      '  <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">',

      '    <!-- ================================================================ -->',
      '    <!-- 2. LEFT PANEL (xl:col-span-4): INPUTS & 4-QUADRANT BREAKDOWN     -->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-4 space-y-4">',

      '      <!-- Footing & Depth Inputs Card -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">Loaded Footing &amp; Depth Inputs</h3>',
      '            <p class="text-[11px] text-slate-500">Uniform rectangular pressure q<sub>0</sub> over B &times; L in strict SI units.</p>',
      '          </div>',
      '          <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold">m &middot; kPa</span>',
      '        </div>',

      '        <div class="p-4 grid grid-cols-2 gap-3.5">',
      '          <div>',
      '            <label for="p4s-B" class="block text-[11px] font-semibold text-slate-700 mb-1">Footing Width B (m)</label>',
      '            <div class="relative">',
      '              <input id="p4s-B" type="number" step="0.1" min="0.1" data-p4s-num="B_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',

      '          <div>',
      '            <label for="p4s-L" class="block text-[11px] font-semibold text-slate-700 mb-1">Footing Length L (m)</label>',
      '            <div class="relative">',
      '              <input id="p4s-L" type="number" step="0.1" min="0.1" data-p4s-num="L_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',

      '          <div>',
      '            <label for="p4s-Df" class="block text-[11px] font-semibold text-slate-700 mb-1">Embedment Depth D<sub>f</sub> (m)</label>',
      '            <div class="relative">',
      '              <input id="p4s-Df" type="number" step="0.1" min="0.0" data-p4s-num="Df_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',

      '          <div>',
      '            <label for="p4s-q0" class="block text-[11px] font-semibold text-slate-700 mb-1">Net Pressure q<sub>0</sub> (kPa)</label>',
      '            <div class="relative">',
      '              <input id="p4s-q0" type="number" step="5" min="1" data-p4s-num="q0_kPa" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-10 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
      '            </div>',
      '          </div>',

      '          <div>',
      '            <label for="p4s-zmax" class="block text-[11px] font-semibold text-slate-700 mb-1">Plot Depth z<sub>max</sub> (m)</label>',
      '            <div class="relative">',
      '              <input id="p4s-zmax" type="number" step="0.5" min="0.5" data-p4s-num="maxDepthBelowBase_m" class="clean-num w-full rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-slate-400">m</span>',
      '            </div>',
      '          </div>',

      '          <div>',
      '            <label for="p4s-zquery" class="block text-[11px] font-semibold text-slate-700 mb-1">Inspection Depth z&prime; (m)</label>',
      '            <div class="relative">',
      '              <input id="p4s-zquery" type="number" step="0.25" min="0.0" data-p4s-num="queryDepthBelowBase_m" class="clean-num w-full rounded-lg border border-indigo-300 bg-indigo-50/40 focus:bg-white pl-2.5 pr-8 py-1.5 text-right font-mono text-xs text-indigo-900 font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />',
      '              <span class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] font-mono text-indigo-500">m</span>',
      '            </div>',
      '          </div>',

      '          <!-- Live Below-Ground-Level Depth Readout -->',
      '          <div class="col-span-2 rounded-lg bg-slate-900 text-white px-3 py-2 flex items-center justify-between text-xs font-mono">',
      '            <span class="text-slate-400">Inspection Elevation (bgl)</span>',
      '            <span id="p4s-readout-zbgl" class="font-semibold text-sky-300">z = D_f + z&prime; = 3.50 m bgl</span>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Visual 4-Quadrant Superposition Breakdown Card -->',
      '      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '          <div>',
      '            <h3 class="text-sm font-semibold text-slate-900">4-Quadrant Superposition Breakdown</h3>',
      '            <p class="text-[11px] text-slate-500">Centre stress = sum of 4 equal (B/2) &times; (L/2) corners.</p>',
      '          </div>',
      '          <span class="inline-flex items-center px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-mono font-semibold">Newmark</span>',
      '        </div>',

      '        <div class="p-4 space-y-3">',
      '          <!-- Crisp Plan-View SVG Schematic -->',
      '          <div class="rounded-lg bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-center">',
      '            <svg viewBox="0 0 240 132" class="w-full max-w-[240px] h-auto" role="img" aria-label="4-quadrant footing superposition plan view">',
      '              <!-- Full Footing Outline -->',
      '              <rect x="44" y="22" width="152" height="84" rx="2" fill="#e0e7ff" stroke="#4f46e5" stroke-width="1.8" />',
      '              <!-- Highlighted Quadrant Q1 -->',
      '              <rect x="44" y="22" width="76" height="42" fill="#c7d2fe" stroke="#4338ca" stroke-width="1.4" />',
      '              <!-- Centerlines dividing into 4 quadrants -->',
      '              <line x1="120" y1="22" x2="120" y2="106" stroke="#4338ca" stroke-width="1.3" stroke-dasharray="4 3" />',
      '              <line x1="44" y1="64" x2="196" y2="64" stroke="#4338ca" stroke-width="1.3" stroke-dasharray="4 3" />',
      '              <!-- Quadrant Labels -->',
      '              <text x="82" y="47" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" fill="#312e81">Q1</text>',
      '              <text x="158" y="47" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#475569">Q2</text>',
      '              <text x="82" y="89" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#475569">Q3</text>',
      '              <text x="158" y="89" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#475569">Q4</text>',
      '              <!-- Dimension Annotations -->',
      '              <text id="p4s-svg-lhalf" x="82" y="14" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" fill="#1e293b">L/2 = 1.50 m</text>',
      '              <text id="p4s-svg-bhalf" x="22" y="46" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" fill="#1e293b" transform="rotate(-90 22 46)">B/2 = 1.00 m</text>',
      '              <!-- Corner Point Marker -->',
      '              <circle cx="44" cy="22" r="4.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />',
      '              <text x="44" y="122" text-anchor="start" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#0369a1">&#9679; Corner (B &#215; L)</text>',
      '              <!-- Centre Point Marker -->',
      '              <circle cx="120" cy="64" r="5" fill="#4f46e5" stroke="#ffffff" stroke-width="1.5" />',
      '              <text x="196" y="122" text-anchor="end" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#4338ca">&#9679; Centre (4 &#215; Q)</text>',
      '            </svg>',
      '          </div>',

      '          <!-- Live Numeric Quadrant Parameters at Inspection Depth -->',
      '          <div class="grid grid-cols-2 gap-2 text-xs font-mono">',
      '            <div class="col-span-2 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2 flex items-center justify-between">',
      '              <span class="font-sans text-[11px] text-slate-500">Quadrant Size (B/2 &times; L/2)</span>',
      '              <span id="p4s-quad-dim" class="font-semibold text-slate-900">—</span>',
      '            </div>',
      '            <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '              <span class="block font-sans text-[10px] text-slate-500">m<sub>q</sub> = (B/2) / z&prime;</span>',
      '              <span id="p4s-quad-mq" class="font-semibold text-slate-900">—</span>',
      '            </div>',
      '            <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '              <span class="block font-sans text-[10px] text-slate-500">n<sub>q</sub> = (L/2) / z&prime;</span>',
      '              <span id="p4s-quad-nq" class="font-semibold text-slate-900">—</span>',
      '            </div>',
      '            <div class="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">',
      '              <span class="block font-sans text-[10px] text-slate-500">Single Quadrant I<sub>quad</sub></span>',
      '              <span id="p4s-quad-iquad" class="font-semibold text-indigo-700">—</span>',
      '            </div>',
      '            <div class="rounded-lg bg-indigo-50/70 border border-indigo-200 px-2.5 py-2">',
      '              <span class="block font-sans text-[10px] text-indigo-700">4 &times; I<sub>quad</sub> = I<sub>centre</sub></span>',
      '              <span id="p4s-quad-icentre" class="font-bold text-indigo-800">—</span>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',

      '    <!-- ================================================================ -->',
      '    <!-- 3. RIGHT PANEL (xl:col-span-8): KPIS, PLOTLY CHART, TABLE, AUDIT -->',
      '    <!-- ================================================================ -->',
      '    <div class="xl:col-span-8 space-y-4">',

      '      <!-- Blocking Validation Error Banner -->',
      '      <div id="p4s-error-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '        <div class="flex items-start gap-3">',
      '          <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '          </div>',
      '          <div class="flex-1">',
      '            <h3 class="text-sm font-semibold text-rose-900">Vertical Stress Input Validation Failed</h3>',
      '            <p class="text-xs text-rose-700 mt-0.5">Correct the following constraints to compute Boussinesq and 2:1 stress profiles:</p>',
      '            <ul id="p4s-error-list" class="mt-2 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Valid Results Workspace -->',
      '      <div id="p4s-results-workspace" class="space-y-4">',

      '        <!-- 4 KPI Cards at Inspection Depth z\' -->',
      '        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-indigo-600 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-indigo-700">Boussinesq Centre &Delta;&sigma;<sub>z</sub></span>',
      '            <p id="p4s-kpi-centre-val" class="mt-1.5 text-lg font-bold font-mono text-indigo-700 tracking-tight">—</p>',
      '            <p id="p4s-kpi-centre-sub" class="mt-0.5 text-[10px] font-mono text-slate-500">I<sub>centre</sub> = 4 &times; I<sub>quad</sub></p>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-sky-700">Boussinesq Corner &Delta;&sigma;<sub>z</sub></span>',
      '            <p id="p4s-kpi-corner-val" class="mt-1.5 text-lg font-bold font-mono text-sky-700 tracking-tight">—</p>',
      '            <p id="p4s-kpi-corner-sub" class="mt-0.5 text-[10px] font-mono text-slate-500">I<sub>corner</sub> (-)</p>',
      '          </div>',

      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-amber-700">2:1 Dispersion &Delta;&sigma;<sub>z</sub></span>',
      '            <p id="p4s-kpi-2to1-val" class="mt-1.5 text-lg font-bold font-mono text-amber-700 tracking-tight">—</p>',
      '            <p id="p4s-kpi-2to1-sub" class="mt-0.5 text-[10px] font-mono text-slate-500">I<sub>2:1</sub> (-)</p>',
      '          </div>',

      '          <div class="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-emerald-300">Centre/Corner &amp; 2:1 Diff</span>',
      '            <p id="p4s-kpi-ratio-val" class="mt-1.5 text-lg font-bold font-mono text-white tracking-tight">—</p>',
      '            <p id="p4s-kpi-ratio-sub" class="mt-0.5 text-[10px] font-mono text-slate-300">—</p>',
      '          </div>',
      '        </div>',

      '        <!-- Interactive Plotly Stress Profile Chart (#p4-stress-increase-plot, 420px) -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">',
      '            <div>',
      '              <h3 class="text-sm font-semibold text-slate-900">Vertical Stress Increase Profile vs. Depth</h3>',
      '              <p class="text-[11px] text-slate-500">Depth below ground surface z (m) vs. &Delta;&sigma;<sub>z</sub> (kPa) comparing Boussinesq Centre (4&times;), Corner, and 2:1 Method.</p>',
      '            </div>',
      '            <span class="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">kPa vs m bgl</span>',
      '          </div>',
      '          <div class="p-3">',
      '            <div id="p4-stress-increase-plot" class="w-full h-[420px]"></div>',
      '          </div>',
      '        </div>',

      '        <!-- Depth-by-Depth Comparison Table -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <div>',
      '              <h3 class="text-sm font-semibold text-slate-900">Depth-by-Depth Stress Comparison Table</h3>',
      '              <p class="text-[11px] text-slate-500">Influence factors and net vertical stress increase &Delta;&sigma;<sub>z</sub> (kPa) at standard depths below footing base.</p>',
      '            </div>',
      '            <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">SI OUTPUT</span>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '              <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '                <tr>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">z bgl (m)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">z&prime; (m)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">I<sub>quad</sub> (-)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">I<sub>centre</sub> (-)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap text-indigo-700">&Delta;&sigma;<sub>z</sub> Centre (kPa)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">I<sub>corner</sub> (-)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap text-sky-700">&Delta;&sigma;<sub>z</sub> Corner (kPa)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap">I<sub>2:1</sub> (-)</th>',
      '                  <th class="px-3 py-2.5 text-right whitespace-nowrap text-amber-700">&Delta;&sigma;<sub>z</sub> 2:1 (kPa)</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p4s-table-tbody" class="divide-y divide-slate-100 font-mono"></tbody>',
      '            </table>',
      '          </div>',
      '        </div>',

      '        <!-- Collapsible Step-by-Step Superposition Audit -->',
      '        <details open class="group bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <summary class="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/80 transition-colors list-none">',
      '            <div class="flex items-center gap-2">',
      '              <svg class="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      '              <h3 class="text-sm font-semibold text-slate-900">Step-by-Step Superposition Audit</h3>',
      '            </div>',
      '            <span id="p4s-steps-count" class="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-medium">0 steps</span>',
      '          </summary>',
      '          <div id="p4s-steps-container" class="p-4 space-y-2 bg-slate-50/40"></div>',
      '        </details>',

      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("\n");

    els.statusBadge = container.querySelector("#p4s-status-badge");
    els.syncNote = container.querySelector("#p4s-sync-note");
    els.btnSyncP3 = container.querySelector("#p4s-btn-sync-p3");
    els.btnReset = container.querySelector("#p4s-btn-reset");

    els.inputB = container.querySelector("#p4s-B");
    els.inputL = container.querySelector("#p4s-L");
    els.inputDf = container.querySelector("#p4s-Df");
    els.inputQ0 = container.querySelector("#p4s-q0");
    els.inputZMax = container.querySelector("#p4s-zmax");
    els.inputZQuery = container.querySelector("#p4s-zquery");
    els.readoutZBgl = container.querySelector("#p4s-readout-zbgl");

    els.quadSvgBHalf = container.querySelector("#p4s-svg-bhalf");
    els.quadSvgLHalf = container.querySelector("#p4s-svg-lhalf");
    els.quadDimText = container.querySelector("#p4s-quad-dim");
    els.quadMqVal = container.querySelector("#p4s-quad-mq");
    els.quadNqVal = container.querySelector("#p4s-quad-nq");
    els.quadIQuadVal = container.querySelector("#p4s-quad-iquad");
    els.quadICentreEq = container.querySelector("#p4s-quad-icentre");

    els.errorBanner = container.querySelector("#p4s-error-banner");
    els.errorList = container.querySelector("#p4s-error-list");
    els.resultsWorkspace = container.querySelector("#p4s-results-workspace");

    els.kpiCentreVal = container.querySelector("#p4s-kpi-centre-val");
    els.kpiCentreSub = container.querySelector("#p4s-kpi-centre-sub");
    els.kpiCornerVal = container.querySelector("#p4s-kpi-corner-val");
    els.kpiCornerSub = container.querySelector("#p4s-kpi-corner-sub");
    els.kpi2to1Val = container.querySelector("#p4s-kpi-2to1-val");
    els.kpi2to1Sub = container.querySelector("#p4s-kpi-2to1-sub");
    els.kpiRatioVal = container.querySelector("#p4s-kpi-ratio-val");
    els.kpiRatioSub = container.querySelector("#p4s-kpi-ratio-sub");

    els.plotDiv = container.querySelector("#p4-stress-increase-plot");
    els.tableTbody = container.querySelector("#p4s-table-tbody");
    els.stepsCount = container.querySelector("#p4s-steps-count");
    els.stepsContainer = container.querySelector("#p4s-steps-container");
  }

  /**
   * Populates input elements from currentInput without overwriting focused
   * controls unless forceSync === true (init, Sync from P3, Reset Sample).
   */
  function syncInputsToDom(forceSync) {
    function setVal(el, val) {
      if (!el) return;
      if (!forceSync && document.activeElement === el) {
        return;
      }
      el.value = isFiniteNum(val) ? String(val) : "";
    }

    setVal(els.inputB, currentInput.B_m);
    setVal(els.inputL, currentInput.L_m);
    setVal(els.inputDf, currentInput.Df_m);
    setVal(els.inputQ0, currentInput.q0_kPa);
    setVal(els.inputZMax, currentInput.maxDepthBelowBase_m);
    setVal(els.inputZQuery, currentInput.queryDepthBelowBase_m);
  }

  /**
   * Renders the interactive Plotly.js Vertical Stress Increase profile
   * (#p4-stress-increase-plot, height 420px).
   * Uses real Unicode symbols only — NEVER raw HTML entities inside Plotly text.
   */
  function renderStressPlot(out) {
    if (typeof global.Plotly === "undefined" || !els.plotDiv || !out || !out.query) {
      return;
    }

    var profile = out.profile || [];
    var q = out.query;
    var Df = currentInput.Df_m;
    var q0 = currentInput.q0_kPa;

    var zVals = [];
    var centreVals = [];
    var cornerVals = [];
    var twoToOneVals = [];
    var hoverCentre = [];
    var hoverCorner = [];
    var hover2to1 = [];

    for (var i = 0; i < profile.length; i++) {
      var pt = profile[i];
      zVals.push(pt.z_bgl);
      centreVals.push(pt.deltaSigma_centre);
      cornerVals.push(pt.deltaSigma_corner);
      twoToOneVals.push(pt.deltaSigma_2to1);

      hoverCentre.push(
        "Boussinesq Centre (4× Superposition)" +
        "<br>Depth z = " + pt.z_bgl.toFixed(2) + " m bgl (z′ = " + pt.z_prime.toFixed(2) + " m)" +
        "<br>I_centre = 4 × " + pt.I_quad.toFixed(4) + " = " + pt.I_centre.toFixed(4) +
        "<br>Δσ_z = " + pt.deltaSigma_centre.toFixed(2) + " kPa"
      );

      hoverCorner.push(
        "Boussinesq Corner (Full B × L)" +
        "<br>Depth z = " + pt.z_bgl.toFixed(2) + " m bgl (z′ = " + pt.z_prime.toFixed(2) + " m)" +
        "<br>I_corner = " + pt.I_corner.toFixed(4) +
        "<br>Δσ_z = " + pt.deltaSigma_corner.toFixed(2) + " kPa"
      );

      hover2to1.push(
        "2:1 Dispersion Method" +
        "<br>Depth z = " + pt.z_bgl.toFixed(2) + " m bgl (z′ = " + pt.z_prime.toFixed(2) + " m)" +
        "<br>I_2:1 = " + pt.I_2to1.toFixed(4) +
        "<br>Δσ_z = " + pt.deltaSigma_2to1.toFixed(2) + " kPa"
      );
    }

    var traces = [
      {
        type: "scatter",
        mode: "lines",
        name: "Boussinesq Centre (4× Superposition)",
        x: centreVals,
        y: zVals,
        text: hoverCentre,
        hoverinfo: "text",
        line: { color: "#4f46e5", width: 2.8 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Boussinesq Corner (B × L)",
        x: cornerVals,
        y: zVals,
        text: hoverCorner,
        hoverinfo: "text",
        line: { color: "#0284c7", width: 2.2 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "2:1 Dispersion Method",
        x: twoToOneVals,
        y: zVals,
        text: hover2to1,
        hoverinfo: "text",
        line: { color: "#d97706", width: 2.2, dash: "dash" }
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Inspection Depth (z′ = " + q.z_prime.toFixed(2) + " m)",
        x: [q.deltaSigma_centre, q.deltaSigma_corner, q.deltaSigma_2to1],
        y: [q.z_bgl, q.z_bgl, q.z_bgl],
        hovertext: [
          "Inspection Point · Boussinesq Centre<br>z = " + q.z_bgl.toFixed(2) + " m (z′ = " + q.z_prime.toFixed(2) + " m)<br>Δσ_z = " + q.deltaSigma_centre.toFixed(2) + " kPa",
          "Inspection Point · Boussinesq Corner<br>z = " + q.z_bgl.toFixed(2) + " m (z′ = " + q.z_prime.toFixed(2) + " m)<br>Δσ_z = " + q.deltaSigma_corner.toFixed(2) + " kPa",
          "Inspection Point · 2:1 Dispersion<br>z = " + q.z_bgl.toFixed(2) + " m (z′ = " + q.z_prime.toFixed(2) + " m)<br>Δσ_z = " + q.deltaSigma_2to1.toFixed(2) + " kPa"
        ],
        hoverinfo: "text",
        marker: {
          size: 11,
          symbol: "diamond",
          color: ["#4f46e5", "#0284c7", "#d97706"],
          line: { color: "#ffffff", width: 1.8 }
        }
      }
    ];

    var shapes = [
      {
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: Df,
        y1: Df,
        line: { color: "#0f172a", width: 1.6, dash: "dash" }
      },
      {
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: q.z_bgl,
        y1: q.z_bgl,
        line: { color: "#e11d48", width: 1.6, dash: "dash" }
      }
    ];

    var annotations = [
      {
        xref: "paper",
        x: 0.99,
        yref: "y",
        y: Df,
        xanchor: "right",
        yanchor: "bottom",
        text: "Footing Base D_f (" + Df.toFixed(2) + " m)",
        showarrow: false,
        font: { size: 10, color: "#0f172a", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(248, 250, 252, 0.94)",
        bordercolor: "#cbd5e1",
        borderwidth: 1,
        borderpad: 2
      }
    ];

    if (q.z_prime > 1e-3) {
      annotations.push({
        xref: "paper",
        x: 0.99,
        yref: "y",
        y: q.z_bgl,
        xanchor: "right",
        yanchor: "top",
        text: "Inspection z = " + q.z_bgl.toFixed(2) + " m (z′ = " + q.z_prime.toFixed(2) + " m)",
        showarrow: false,
        font: { size: 10, color: "#be123c", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(255, 241, 242, 0.94)",
        bordercolor: "#fecdd3",
        borderwidth: 1,
        borderpad: 2
      });
    }

    var yMinTop = Math.max(0.0, Df - Math.max(0.3, currentInput.maxDepthBelowBase_m * 0.05));
    var yMaxBot = Df + currentInput.maxDepthBelowBase_m * 1.04;

    var layout = {
      margin: { l: 60, r: 20, t: 42, b: 48 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Vertical Stress Increase, Δσ_z (kPa)",
          font: { size: 11.5, color: "#475569" }
        },
        range: [0, q0 * 1.08],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Depth below Ground Surface, z (m)",
          font: { size: 11.5, color: "#475569" }
        },
        range: [yMaxBot, yMinTop],
        autorange: false,
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
        y: 1.11,
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

    global.Plotly.react(els.plotDiv, traces, layout, config);
  }

  /**
   * Renders depth-by-depth comparison table rows.
   */
  function renderComparisonTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      els.tableTbody.innerHTML = "";
      return;
    }

    els.tableTbody.innerHTML = rows
      .map(function (r) {
        var rowCls = r.isQueryDepth
          ? "bg-indigo-50/70 font-semibold"
          : "hover:bg-slate-50/80 transition-colors";
        var queryTag = r.isQueryDepth
          ? '<span class="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold bg-indigo-600 text-white">z&prime;</span>'
          : "";

        return [
          '<tr class="' + rowCls + '">',
          '  <td class="px-3 py-2 text-right text-slate-700 whitespace-nowrap">' + formatNum(r.z_bgl, 2) + " m</td>",
          '  <td class="px-3 py-2 text-right text-slate-900 whitespace-nowrap">' + formatNum(r.z_prime, 2) + " m" + queryTag + "</td>",
          '  <td class="px-3 py-2 text-right text-slate-600 whitespace-nowrap">' + formatNum(r.I_quad, 4) + "</td>",
          '  <td class="px-3 py-2 text-right text-slate-700 whitespace-nowrap">' + formatNum(r.I_centre, 4) + "</td>",
          '  <td class="px-3 py-2 text-right font-semibold text-indigo-700 whitespace-nowrap">' + formatNum(r.deltaSigma_centre, 2) + " kPa</td>",
          '  <td class="px-3 py-2 text-right text-slate-600 whitespace-nowrap">' + formatNum(r.I_corner, 4) + "</td>",
          '  <td class="px-3 py-2 text-right font-semibold text-sky-700 whitespace-nowrap">' + formatNum(r.deltaSigma_corner, 2) + " kPa</td>",
          '  <td class="px-3 py-2 text-right text-slate-600 whitespace-nowrap">' + formatNum(r.I_2to1, 4) + "</td>",
          '  <td class="px-3 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">' + formatNum(r.deltaSigma_2to1, 2) + " kPa</td>",
          "</tr>"
        ].join("");
      })
      .join("");
  }

  /**
   * Computes outputs from currentInput and updates all UI elements cleanly.
   */
  function refreshAll() {
    var logic = getLogic();
    if (!logic) {
      return;
    }

    // Live bgl readout in left panel
    if (isFiniteNum(currentInput.Df_m) && isFiniteNum(currentInput.queryDepthBelowBase_m)) {
      var zBgl = currentInput.Df_m + currentInput.queryDepthBelowBase_m;
      els.readoutZBgl.textContent =
        "z = D_f + z′ = " + formatNum(zBgl, 2) + " m bgl";
    } else {
      els.readoutZBgl.textContent = "z = D_f + z′ = — m bgl";
    }

    var out = logic.computeStressIncrease(currentInput);
    var errs = out.errors || [];

    if (errs.length > 0 || !out.query) {
      els.statusBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/25";
      els.statusBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>' +
        errs.length +
        (errs.length === 1 ? " Error" : " Errors");

      els.errorBanner.classList.remove("hidden");
      els.errorList.innerHTML = errs
        .map(function (msg) {
          return "<li>" + escapeHtml(msg) + "</li>";
        })
        .join("");

      els.resultsWorkspace.classList.add("hidden");

      // Clear quadrant numeric breakdown cleanly
      els.quadDimText.textContent = "—";
      els.quadMqVal.textContent = "—";
      els.quadNqVal.textContent = "—";
      els.quadIQuadVal.textContent = "—";
      els.quadICentreEq.textContent = "—";
      return;
    }

    var wasHidden = els.resultsWorkspace.classList.contains("hidden");
    var q = out.query;

    els.statusBadge.className =
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
    els.statusBadge.innerHTML =
      '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' +
      "z&prime; = " + formatNum(q.z_prime, 2) + " m (z = " + formatNum(q.z_bgl, 2) + " m bgl)";

    els.errorBanner.classList.add("hidden");
    els.errorList.innerHTML = "";
    els.resultsWorkspace.classList.remove("hidden");

    // Update 4-Quadrant Superposition Breakdown Card & SVG labels
    if (els.quadSvgBHalf) {
      els.quadSvgBHalf.textContent = "B/2 = " + formatNum(q.B_half, 2) + " m";
    }
    if (els.quadSvgLHalf) {
      els.quadSvgLHalf.textContent = "L/2 = " + formatNum(q.L_half, 2) + " m";
    }
    els.quadDimText.textContent =
      formatNum(q.B_half, 2) + " m × " + formatNum(q.L_half, 2) + " m";
    els.quadMqVal.textContent = formatRatio(q.m_q) + " (-)";
    els.quadNqVal.textContent = formatRatio(q.n_q) + " (-)";
    els.quadIQuadVal.textContent = formatNum(q.I_quad, 4) + " (-)";
    els.quadICentreEq.textContent =
      "4 × " + formatNum(q.I_quad, 4) + " = " + formatNum(q.I_centre, 4);

    // Update 4 KPI Cards at Inspection Depth z'
    els.kpiCentreVal.textContent = formatNum(q.deltaSigma_centre, 2) + " kPa";
    els.kpiCentreSub.textContent =
      "I_centre = 4 × " + formatNum(q.I_quad, 4) + " = " + formatNum(q.I_centre, 4);

    els.kpiCornerVal.textContent = formatNum(q.deltaSigma_corner, 2) + " kPa";
    els.kpiCornerSub.textContent = "I_corner = " + formatNum(q.I_corner, 4) + " (-)";

    els.kpi2to1Val.textContent = formatNum(q.deltaSigma_2to1, 2) + " kPa";
    els.kpi2to1Sub.textContent = "I_2:1 = " + formatNum(q.I_2to1, 4) + " (-)";

    var ratioLabel = q.centreToCornerRatio !== null ? q.centreToCornerRatio.toFixed(2) + "×" : "—";
    var diffSign = q.diff2to1Pct >= 0 ? "+" : "";
    els.kpiRatioVal.textContent = ratioLabel + " (C / Corner)";
    els.kpiRatioSub.textContent = "2:1 vs. Centre: " + diffSign + q.diff2to1Pct.toFixed(1) + "%";

    // Render Plotly Chart, Comparison Table, and Audit Steps
    renderStressPlot(out);
    renderComparisonTable(out.tableRows);

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

    if (wasHidden) {
      resizePlots();
    }
  }

  /**
   * Resizes the Plotly chart safely whenever #tab-p4 or results workspace unhides.
   */
  function resizePlots() {
    if (typeof global.Plotly === "undefined" || !els.plotDiv) {
      return;
    }
    global.requestAnimationFrame(function () {
      if (els.plotDiv && els.plotDiv.classList.contains("js-plotly-plot")) {
        global.Plotly.Plots.resize(els.plotDiv);
      }
    });
  }

  /**
   * Pulls footing geometry (using Meyerhof effective dimensions B' × L' when
   * eccentric, or equal-area equivalent square D·√(π/4) for circular footings)
   * and net safe pressure q_ns (kPa) from window.GeotechState.p3Input / p3Results.
   */
  function handleSyncFromP3() {
    var state = global.GeotechState;
    if (!state || !state.p3Input) {
      els.syncNote.textContent =
        "Module P3 state is not available yet. Using current Module P4 inputs.";
      els.syncNote.classList.remove("hidden");
      return;
    }

    var p3In = state.p3Input;
    var p3Res = state.p3Results && state.p3Results.result ? state.p3Results.result : null;
    var geom = p3Res && p3Res.geometry ? p3Res.geometry : null;
    var isEccentric =
      (isFiniteNum(p3In.eB_m) && p3In.eB_m > 1e-6) ||
      (isFiniteNum(p3In.eL_m) && p3In.eL_m > 1e-6);
    var notes = [];

    if (p3In.shape === "Circular" && isFiniteNum(p3In.B_m) && p3In.B_m > 0) {
      var eqSide = Number((p3In.B_m * Math.sqrt(Math.PI / 4.0)).toFixed(3));
      currentInput.B_m = eqSide;
      currentInput.L_m = eqSide;
      notes.push("Circular D=" + p3In.B_m.toFixed(2) + " m → equal-area square " + eqSide.toFixed(2) + " m");
    } else if (
      isEccentric &&
      geom &&
      isFiniteNum(geom.B_prime) &&
      geom.B_prime > 0 &&
      isFiniteNum(geom.L_prime) &&
      geom.L_prime > 0 &&
      p3In.shape !== "Strip"
    ) {
      currentInput.B_m = Number(geom.B_prime.toFixed(3));
      currentInput.L_m = Number(geom.L_prime.toFixed(3));
      notes.push("Eccentric Meyerhof effective area B′ × L′");
    } else {
      if (isFiniteNum(p3In.B_m) && p3In.B_m > 0) {
        currentInput.B_m = p3In.B_m;
      }
      if (p3In.shape === "Square") {
        currentInput.L_m = currentInput.B_m;
        notes.push("Square (L = B)");
      } else if (p3In.shape === "Strip") {
        currentInput.L_m = Number((currentInput.B_m * 10.0).toFixed(2));
        notes.push("Strip approximated as L = 10·B (" + currentInput.L_m.toFixed(2) + " m)");
      } else if (isFiniteNum(p3In.L_m) && p3In.L_m > 0) {
        currentInput.L_m = p3In.L_m;
      }
    }

    if (isFiniteNum(p3In.Df_m) && p3In.Df_m >= 0) {
      currentInput.Df_m = p3In.Df_m;
    }

    if (
      p3Res &&
      p3Res.capacities &&
      isFiniteNum(p3Res.capacities.q_ns) &&
      p3Res.capacities.q_ns > 0
    ) {
      currentInput.q0_kPa = Number(p3Res.capacities.q_ns.toFixed(2));
      notes.push("q_0 = q_ns (" + currentInput.q0_kPa.toFixed(2) + " kPa)");
    } else {
      notes.push("q_0 retained at " + formatNum(currentInput.q0_kPa, 2) + " kPa (no valid P3 q_ns)");
    }

    syncInputsToDom(true);
    refreshAll();

    els.syncNote.textContent =
      "Synced from Module P3: B = " +
      formatNum(currentInput.B_m, 2) +
      " m, L = " +
      formatNum(currentInput.L_m, 2) +
      " m, D_f = " +
      formatNum(currentInput.Df_m, 2) +
      " m · " +
      notes.join(" · ");
    els.syncNote.classList.remove("hidden");
  }

  /**
   * Resets all inputs back to the clean sample values and re-computes.
   */
  function handleResetSample() {
    currentInput = getSampleDefaults();
    els.syncNote.classList.add("hidden");
    els.syncNote.textContent = "";
    syncInputsToDom(true);
    refreshAll();
  }

  /**
   * Updates numeric input without rebuilding DOM (preserves cursor focus while typing decimals).
   */
  function handleNumericInput(el) {
    var field = el.getAttribute("data-p4s-num");
    if (!field) {
      return;
    }
    var raw = String(el.value).trim();
    var parsed = raw === "" ? NaN : Number(raw);
    currentInput[field] = Number.isFinite(parsed) ? parsed : NaN;
    refreshAll();
  }

  function bindEvents() {
    els.btnSyncP3.addEventListener("click", handleSyncFromP3);
    els.btnReset.addEventListener("click", handleResetSample);

    els.container.addEventListener("input", function (evt) {
      if (evt.target && evt.target.hasAttribute("data-p4s-num")) {
        handleNumericInput(evt.target);
      }
    });

    // Resize Plotly cleanly on #btn-tab-p4 click & MutationObserver tab unhide
    var p4TabBtn = document.getElementById("btn-tab-p4");
    if (p4TabBtn) {
      p4TabBtn.addEventListener("click", resizePlots);
    }

    if (typeof global.MutationObserver !== "undefined" && els.container) {
      var observer = new global.MutationObserver(function () {
        if (!els.container.classList.contains("hidden")) {
          resizePlots();
        }
      });
      observer.observe(els.container, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /**
   * Initializes Module P4 Vertical Stress Increase UI inside #tab-p4.
   */
  function init() {
    var container = document.getElementById("tab-p4");
    if (!container || !getLogic()) {
      return;
    }

    currentInput = getSampleDefaults();
    els.container = container;
    buildSkeleton(container);
    syncInputsToDom(true);
    bindEvents();
    refreshAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ModuleP4StressUI = Object.freeze({
    init: init,
    resizePlots: resizePlots
  });
})(window);