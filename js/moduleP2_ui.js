/**
 * ==============================================================================
 * CE-402 GEOTECHNICAL DESIGN PLATFORM (GROUP 8)
 * Module P2 UI & Plotly Interactive Charts: window.ModuleP2UI
 * ==============================================================================
 * Renders the interactive Module P2 interface inside #tab-p2 using
 * window.GeotechState and window.ModuleP2Logic:
 *   - Section A: IS 2131:1981 SPT Corrections (Overburden & Dilatancy)
 *   - Section B: IS 2720 (Part 13) Direct Shear Mohr-Coulomb OLS Fitting
 *
 * Strict SI Units: Depth (m), Stress/Strength (kPa), Unit Weight (kN/m³),
 * Friction Angle (deg / °), Blow Count (blows).
 *
 * Compatible with local file:// execution and GitHub Pages (classic IIFE,
 * "use strict", no ES module imports/exports).
 */

(function initModuleP2UI(global) {
  "use strict";

  // Guard flag to prevent recursive GeotechState notification loops
  var isSyncingFromState = false;

  // Cached DOM references inside #tab-p2
  var els = {
    container: null,
    p1SyncBadge: null,
    btnResetP2: null,

    // Section A: SPT Corrections
    btnAddSptTop: null,
    btnAddSptBottom: null,
    sptInputTbody: null,
    sptErrorBanner: null,
    sptErrorList: null,
    sptResultsTbody: null,
    sptStepsCount: null,
    sptStepsContainer: null,
    sptPlotDiv: null,
    sptPlotEmpty: null,

    // Section B: Direct Shear Fitting
    btnAddShearTop: null,
    btnAddShearBottom: null,
    shearInputTbody: null,
    shearErrorBanner: null,
    shearErrorList: null,
    shearResultsWorkspace: null,
    shearResidualsCard: null,
    shearResidualsTbody: null,
    kpiCohesionVal: null,
    kpiCohesionSub: null,
    kpiPhiVal: null,
    kpiPhiSub: null,
    kpiR2Val: null,
    kpiRmseVal: null,
    shearEquationText: null,
    shearNegCohesionBanner: null,
    shearNegCohesionBody: null,
    shearPlotDiv: null
  };

  function getState() {
    return global.GeotechState;
  }

  function getLogic() {
    return global.ModuleP2Logic;
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
   * Builds the static Precision Engineering layout skeleton inside #tab-p2 once.
   */
  function buildSkeleton(container) {
    container.innerHTML = [
      '<div class="space-y-6">',

      '  <!-- 1. Top Header & Live P1 Sync Status Bar -->',
      '  <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">',
      '    <div>',
      '      <div class="flex flex-wrap items-center gap-2.5">',
      '        <h2 class="text-xl font-bold tracking-tight text-slate-900">Parameter Tools: SPT Corrections &amp; Direct Shear Fitting</h2>',
      '        <span id="p2-p1-sync-badge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">',
      '          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Synced with P1',
      '        </span>',
      '      </div>',
      '      <p class="mt-0.5 text-xs text-slate-500">IS 2131:1981 Standard Penetration Test corrections (overburden &amp; dilatancy) and IS 2720 (Part 13) Direct Shear Mohr-Coulomb OLS regression.</p>',
      '    </div>',
      '    <div class="flex items-center gap-2.5 self-start sm:self-auto">',
      '      <button id="p2-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium shadow-2xs transition-colors cursor-pointer">',
      '        <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      '        <span>Reset P2 Sample</span>',
      '      </button>',
      '    </div>',
      '  </div>',

      '  <!-- ================================================================== -->',
      '  <!-- SECTION A: IS 2131:1981 SPT CORRECTIONS                            -->',
      '  <!-- ================================================================== -->',
      '  <section class="space-y-4">',
      '    <div class="flex items-center justify-between">',
      '      <div class="flex items-center gap-2.5">',
      '        <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600 text-white font-mono text-xs font-semibold shadow-xs">A</span>',
      '        <div>',
      '          <h3 class="text-base font-semibold text-slate-900">IS 2131:1981 SPT N-Value Corrections</h3>',
      '          <p class="text-[11px] text-slate-500">Piecewise effective overburden stress &sigma;&prime;<sub>v0</sub> (kPa) auto-integrated from Module P1 stratigraphy unless manually overridden.</p>',
      '        </div>',
      '      </div>',
      '      <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono text-slate-600 ring-1 ring-inset ring-slate-200">IS 2131 Cl. 3.6.1 &amp; 3.6.2</span>',
      '    </div>',

      '    <!-- A1. Editable SPT Input Table -->',
      '    <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '      <div class="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">',
      '        <div>',
      '          <h4 class="text-sm font-semibold text-slate-900">Borehole SPT Observations</h4>',
      '          <p class="text-[11px] text-slate-500">Enter test depth z (m), field blow count N (blows), IS 2131 soil category, and optional manual &sigma;&prime;<sub>v0</sub> override (kPa).</p>',
      '        </div>',
      '        <button id="p2-btn-add-spt-top" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto">',
      '          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '          <span>Add SPT Row</span>',
      '        </button>',
      '      </div>',

      '      <div class="overflow-x-auto">',
      '        <table class="min-w-full border-collapse text-xs">',
      '          <thead>',
      '            <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">',
      '              <th class="px-3 py-2.5 text-left w-12 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">#</th>',
      '              <th class="px-3 py-2.5 text-right min-w-[130px]">Depth z (m)</th>',
      '              <th class="px-3 py-2.5 text-right min-w-[140px]">Measured N (blows)</th>',
      '              <th class="px-3 py-2.5 text-left min-w-[270px]">Soil Category (IS 2131:1981)</th>',
      '              <th class="px-3 py-2.5 text-right min-w-[190px]">Manual &sigma;&prime;<sub>v0</sub> Override (kPa)</th>',
      '              <th class="px-2.5 py-2.5 text-center w-14 sticky right-0 bg-slate-50 z-10 border-l border-slate-200">Del</th>',
      '            </tr>',
      '          </thead>',
      '          <tbody id="p2-spt-input-tbody" class="divide-y divide-slate-100 bg-white"></tbody>',
      '        </table>',
      '      </div>',

      '      <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between">',
      '        <button id="p2-btn-add-spt-bottom" type="button" class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">',
      '          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '          <span>Append SPT row (+1.50 m standard interval)</span>',
      '        </button>',
      '        <span class="hidden sm:inline text-[11px] text-slate-400 font-mono">Leave override blank for Auto (P1) &sigma;&prime;<sub>v0</sub></span>',
      '      </div>',
      '    </div>',

      '    <!-- A2. SPT Validation Alert Banner -->',
      '    <div id="p2-spt-error-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '      <div class="flex items-start gap-3">',
      '        <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '        </div>',
      '        <div class="flex-1">',
      '          <h4 class="text-sm font-semibold text-rose-900">SPT Input &amp; Overburden Validation Issues</h4>',
      '          <ul id="p2-spt-error-list" class="mt-1.5 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '        </div>',
      '      </div>',
      '    </div>',

      '    <!-- A3. Two-Column SPT Results & Profile Plot -->',
      '    <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">',
      '      <!-- Left (7 cols): Computed SPT Results Table + Step-by-Step Breakdown -->',
      '      <div class="xl:col-span-7 space-y-4">',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <div>',
      '              <h4 class="text-sm font-semibold text-slate-900">Computed IS 2131:1981 SPT Corrections</h4>',
      '              <p class="text-[11px] text-slate-500">Sequential overburden correction (C<sub>N</sub>, N&prime;) followed by dilatancy correction (N&Prime;) where applicable.</p>',
      '            </div>',
      '            <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">SI OUTPUT</span>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '              <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '                <tr>',
      '                  <th class="px-3 py-2.5 text-left">Row</th>',
      '                  <th class="px-3 py-2.5 text-right">Depth (m)</th>',
      '                  <th class="px-3 py-2.5 text-right">Resolved &sigma;&prime;<sub>v0</sub> (kPa)</th>',
      '                  <th class="px-3 py-2.5 text-right">C<sub>N</sub> (-)</th>',
      '                  <th class="px-3 py-2.5 text-right">N&prime; (blows)</th>',
      '                  <th class="px-3 py-2.5 text-center">Dilatancy</th>',
      '                  <th class="px-3 py-2.5 text-right">N&Prime; (blows)</th>',
      '                  <th class="px-3 py-2.5 text-right">Design N (blows)</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p2-spt-results-tbody" class="divide-y divide-slate-100 font-mono"></tbody>',
      '            </table>',
      '          </div>',
      '          <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex flex-wrap gap-x-4 gap-y-1">',
      '            <span>C<sub>N</sub> = min(2.00, 0.77&middot;log<sub>10</sub>(2000/&sigma;&prime;<sub>eff</sub>))</span>',
      '            <span>N&prime; = C<sub>N</sub>&middot;N</span>',
      '            <span>N&Prime; = 15 + 0.5&middot;(N&prime; &minus; 15)</span>',
      '          </div>',
      '        </div>',

      '        <!-- Auditable Step-by-Step Calculation Breakdown -->',
      '        <details open class="group bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <summary class="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/80 transition-colors list-none">',
      '            <div class="flex items-center gap-2">',
      '              <svg class="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      '              <h4 class="text-sm font-semibold text-slate-900">Step-by-Step Calculation Breakdown</h4>',
      '            </div>',
      '            <span id="p2-spt-steps-count" class="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-medium">0 rows</span>',
      '          </summary>',
      '          <div id="p2-spt-steps-container" class="p-4 space-y-3 bg-slate-50/40 max-h-[380px] overflow-y-auto"></div>',
      '        </details>',
      '      </div>',

      '      <!-- Right (5 cols): Interactive Plotly SPT Depth Profile -->',
      '      <div class="xl:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '          <div>',
      '            <h4 class="text-sm font-semibold text-slate-900">SPT Blow Count Profile vs. Depth</h4>',
      '            <p class="text-[11px] text-slate-500">Comparison of N<sub>measured</sub>, N&prime; (overburden), and N&Prime; (final) with z<sub>w,meas</sub>.</p>',
      '          </div>',
      '          <span class="inline-flex items-center gap-1 text-[10px] font-mono text-sky-700"><span class="w-3 border-t-2 border-dashed border-sky-600"></span>WT</span>',
      '        </div>',
      '        <div class="p-3 flex-1 min-h-[470px] relative">',
      '          <div id="p2-spt-plot" class="w-full h-[470px]"></div>',
      '          <div id="p2-spt-plot-empty" class="hidden absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-400">Add valid SPT observations to visualize the blow-count depth profile.</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </section>',

      '  <hr class="border-slate-200" />',

      '  <!-- ================================================================== -->',
      '  <!-- SECTION B: DIRECT SHEAR PARAMETER FITTING (MOHR-COULOMB OLS)       -->',
      '  <!-- ================================================================== -->',
      '  <section class="space-y-4">',
      '    <div class="flex items-center justify-between">',
      '      <div class="flex items-center gap-2.5">',
      '        <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-sky-600 text-white font-mono text-xs font-semibold shadow-xs">B</span>',
      '        <div>',
      '          <h3 class="text-base font-semibold text-slate-900">Direct Shear Parameter Fitting (Mohr-Coulomb OLS)</h3>',
      '          <p class="text-[11px] text-slate-500">Ordinary Least Squares linear regression of peak shear stress &tau;<sub>f</sub> (kPa) vs. normal stress &sigma;<sub>n</sub> (kPa) per IS 2720 (Part 13).</p>',
      '        </div>',
      '      </div>',
      '      <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono text-slate-600 ring-1 ring-inset ring-slate-200">&tau;<sub>f</sub> = c&prime; + &sigma;<sub>n</sub>&middot;tan(&phi;&prime;)</span>',
      '    </div>',

      '    <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">',
      '      <!-- Left (5 cols): Editable Direct Shear Input Table + Validation + Residuals -->',
      '      <div class="xl:col-span-5 space-y-4">',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <div>',
      '              <h4 class="text-sm font-semibold text-slate-900">Direct Shear Test Points</h4>',
      '              <p class="text-[11px] text-slate-500">Minimum 2 points with distinct &sigma;<sub>n</sub> values (kPa).</p>',
      '            </div>',
      '            <button id="p2-btn-add-shear-top" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer">',
      '              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '              <span>Add Test Point</span>',
      '            </button>',
      '          </div>',

      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full border-collapse text-xs">',
      '              <thead>',
      '                <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">',
      '                  <th class="px-3 py-2.5 text-left w-16">Test #</th>',
      '                  <th class="px-3 py-2.5 text-right">Normal Stress &sigma;<sub>n</sub> (kPa)</th>',
      '                  <th class="px-3 py-2.5 text-right">Peak Shear Stress &tau;<sub>f</sub> (kPa)</th>',
      '                  <th class="px-2.5 py-2.5 text-center w-14">Del</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p2-shear-input-tbody" class="divide-y divide-slate-100 bg-white"></tbody>',
      '            </table>',
      '          </div>',

      '          <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between">',
      '            <button id="p2-btn-add-shear-bottom" type="button" class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">',
      '              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      '              <span>Append test point (+50 kPa normal stress)</span>',
      '            </button>',
      '          </div>',
      '        </div>',

      '        <!-- Direct Shear Validation Alert Banner -->',
      '        <div id="p2-shear-error-banner" class="hidden rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 shadow-sm" role="alert">',
      '          <div class="flex items-start gap-3">',
      '            <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">',
      '              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '            </div>',
      '            <div class="flex-1">',
      '              <h4 class="text-sm font-semibold text-rose-900">Direct Shear Regression Validation Failed</h4>',
      '              <ul id="p2-shear-error-list" class="mt-1.5 list-disc list-inside space-y-1 text-xs font-mono text-rose-800"></ul>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Compact Residuals Table -->',
      '        <div id="p2-shear-residuals-card" class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">',
      '            <div>',
      '              <h4 class="text-sm font-semibold text-slate-900">Regression Residuals</h4>',
      '              <p class="text-[11px] text-slate-500">Observed vs. OLS-predicted peak shear stresses (kPa).</p>',
      '            </div>',
      '            <span class="text-[10px] font-mono text-slate-500">r = &tau;<sub>f</sub> &minus; &tau;<sub>pred</sub></span>',
      '          </div>',
      '          <div class="overflow-x-auto">',
      '            <table class="min-w-full divide-y divide-slate-200 text-xs">',
      '              <thead class="bg-slate-50 text-slate-600 font-semibold text-[11px]">',
      '                <tr>',
      '                  <th class="px-3 py-2 text-right">&sigma;<sub>n</sub> (kPa)</th>',
      '                  <th class="px-3 py-2 text-right">Measured &tau;<sub>f</sub> (kPa)</th>',
      '                  <th class="px-3 py-2 text-right">Predicted &tau;<sub>pred</sub> (kPa)</th>',
      '                  <th class="px-3 py-2 text-right">Residual (kPa)</th>',
      '                </tr>',
      '              </thead>',
      '              <tbody id="p2-shear-residuals-tbody" class="divide-y divide-slate-100 font-mono"></tbody>',
      '            </table>',
      '          </div>',
      '        </div>',
      '      </div>',

      '      <!-- Right (7 cols): 4 Metric Cards + Equation Banner + Negative Cohesion Warning + Plotly Chart -->',
      '      <div id="p2-shear-results-workspace" class="xl:col-span-7 space-y-4">',
      '        <!-- 4 Prominent Result Metric Cards -->',
      '        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-indigo-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-500">Effective Cohesion c&prime;</span>',
      '            <p id="p2-kpi-cohesion-val" class="mt-1.5 text-lg font-bold font-mono text-indigo-700 tracking-tight">—</p>',
      '            <p id="p2-kpi-cohesion-sub" class="mt-0.5 text-[10px] text-slate-400">OLS Intercept</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-sky-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-500">Friction Angle &phi;&prime;</span>',
      '            <p id="p2-kpi-phi-val" class="mt-1.5 text-lg font-bold font-mono text-sky-700 tracking-tight">—</p>',
      '            <p id="p2-kpi-phi-sub" class="mt-0.5 text-[10px] text-slate-400">arctan(slope)</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-500 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-500">Goodness of Fit R&sup2;</span>',
      '            <p id="p2-kpi-r2-val" class="mt-1.5 text-lg font-bold font-mono text-emerald-700 tracking-tight">—</p>',
      '            <p class="mt-0.5 text-[10px] text-slate-400">Dimensionless (-)</p>',
      '          </div>',
      '          <div class="bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-slate-400 shadow-sm p-3.5">',
      '            <span class="text-[11px] font-medium text-slate-500">Fit Error (RMSE)</span>',
      '            <p id="p2-kpi-rmse-val" class="mt-1.5 text-lg font-bold font-mono text-slate-800 tracking-tight">—</p>',
      '            <p class="mt-0.5 text-[10px] text-slate-400">Root Mean Sq. Err.</p>',
      '          </div>',
      '        </div>',

      '        <!-- Highlighted Fitted Equation Banner -->',
      '        <div class="rounded-xl bg-slate-900 text-white px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">',
      '          <div class="flex items-center gap-2">',
      '            <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-400/30 text-[10px] font-mono uppercase">Mohr-Coulomb Fit</span>',
      '            <span id="p2-shear-equation-text" class="font-mono text-sm font-semibold text-white">—</span>',
      '          </div>',
      '          <span class="text-[11px] font-mono text-slate-400">Units: &tau;, c&prime;, &sigma;<sub>n</sub> in kPa | &phi;&prime; in deg</span>',
      '        </div>',

      '        <!-- Negative Cohesion Engineering Warning Banner -->',
      '        <div id="p2-shear-neg-cohesion-banner" class="hidden rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-amber-950 shadow-sm" role="status">',
      '          <div class="flex items-start gap-3">',
      '            <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">',
      '              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      '            </div>',
      '            <div class="flex-1 text-xs">',
      '              <h4 class="font-semibold text-amber-950">Negative Raw Cohesion Intercept Detected (c&prime;<sub>raw</sub> &lt; 0 kPa)</h4>',
      '              <p id="p2-shear-neg-cohesion-body" class="mt-1 font-mono text-amber-900 leading-relaxed"></p>',
      '            </div>',
      '          </div>',
      '        </div>',

      '        <!-- Interactive Plotly Direct Shear Mohr-Coulomb Chart -->',
      '        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">',
      '          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">',
      '            <div>',
      '              <h4 class="text-sm font-semibold text-slate-900">Mohr-Coulomb Failure Envelope</h4>',
      '              <p class="text-[11px] text-slate-500">Normal stress &sigma;<sub>n</sub> (kPa) vs. peak shear stress &tau;<sub>f</sub> (kPa) with OLS regression envelope.</p>',
      '            </div>',
      '            <span class="text-[10px] font-mono text-slate-500">IS 2720 (Part 13)</span>',
      '          </div>',
      '          <div class="p-3">',
      '            <div id="p2-shear-plot" class="w-full h-[410px]"></div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </section>',

      '</div>'
    ].join("\n");

    els.p1SyncBadge = container.querySelector("#p2-p1-sync-badge");
    els.btnResetP2 = container.querySelector("#p2-btn-reset");

    els.btnAddSptTop = container.querySelector("#p2-btn-add-spt-top");
    els.btnAddSptBottom = container.querySelector("#p2-btn-add-spt-bottom");
    els.sptInputTbody = container.querySelector("#p2-spt-input-tbody");
    els.sptErrorBanner = container.querySelector("#p2-spt-error-banner");
    els.sptErrorList = container.querySelector("#p2-spt-error-list");
    els.sptResultsTbody = container.querySelector("#p2-spt-results-tbody");
    els.sptStepsCount = container.querySelector("#p2-spt-steps-count");
    els.sptStepsContainer = container.querySelector("#p2-spt-steps-container");
    els.sptPlotDiv = container.querySelector("#p2-spt-plot");
    els.sptPlotEmpty = container.querySelector("#p2-spt-plot-empty");

    els.btnAddShearTop = container.querySelector("#p2-btn-add-shear-top");
    els.btnAddShearBottom = container.querySelector("#p2-btn-add-shear-bottom");
    els.shearInputTbody = container.querySelector("#p2-shear-input-tbody");
    els.shearErrorBanner = container.querySelector("#p2-shear-error-banner");
    els.shearErrorList = container.querySelector("#p2-shear-error-list");
    els.shearResultsWorkspace = container.querySelector("#p2-shear-results-workspace");
    els.shearResidualsCard = container.querySelector("#p2-shear-residuals-card");
    els.shearResidualsTbody = container.querySelector("#p2-shear-residuals-tbody");
    els.kpiCohesionVal = container.querySelector("#p2-kpi-cohesion-val");
    els.kpiCohesionSub = container.querySelector("#p2-kpi-cohesion-sub");
    els.kpiPhiVal = container.querySelector("#p2-kpi-phi-val");
    els.kpiPhiSub = container.querySelector("#p2-kpi-phi-sub");
    els.kpiR2Val = container.querySelector("#p2-kpi-r2-val");
    els.kpiRmseVal = container.querySelector("#p2-kpi-rmse-val");
    els.shearEquationText = container.querySelector("#p2-shear-equation-text");
    els.shearNegCohesionBanner = container.querySelector("#p2-shear-neg-cohesion-banner");
    els.shearNegCohesionBody = container.querySelector("#p2-shear-neg-cohesion-body");
    els.shearPlotDiv = container.querySelector("#p2-shear-plot");
  }

  /**
   * Renders the editable SPT Input Table.
   * Called ONLY on init(), Add SPT Row, Delete SPT Row, or Reset P2 Sample
   * so numeric typing never loses cursor focus.
   */
  function renderSptInputTable() {
    var state = getState();
    var logic = getLogic();
    var records = (state && state.sptRecords) || [];
    var categories = (logic && logic.SPT_SOIL_CATEGORIES) || [
      "Fine Sand / Silt (Dilatancy Applicable)",
      "Coarse Sand / Gravel (No Dilatancy)",
      "Cohesive Soil (Clay)"
    ];

    if (records.length === 0) {
      els.sptInputTbody.innerHTML =
        '<tr><td colspan="6" class="px-4 py-6 text-center text-xs text-slate-400">No SPT observations entered. Click "+ Add SPT Row" to begin.</td></tr>';
      return;
    }

    var rowsHtml = records.map(function (rec, idx) {
      var depthVal = typeof rec.depth_m === "number" && Number.isFinite(rec.depth_m) ? rec.depth_m : "";
      var nVal = typeof rec.N_measured === "number" && Number.isFinite(rec.N_measured) ? rec.N_measured : "";
      var overrideVal =
        rec.sigma_v_override !== null &&
        rec.sigma_v_override !== undefined &&
        typeof rec.sigma_v_override === "number" &&
        Number.isFinite(rec.sigma_v_override)
          ? rec.sigma_v_override
          : "";

      var optionsHtml = categories
        .map(function (cat) {
          var selected = rec.soilCategory === cat ? " selected" : "";
          return '<option value="' + escapeHtml(cat) + '"' + selected + ">" + escapeHtml(cat) + "</option>";
        })
        .join("");

      return [
        '<tr data-spt-row="' + idx + '" class="group hover:bg-indigo-50/30 transition-colors">',
        '  <td class="px-3 py-1.5 font-mono font-semibold text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200">S' + (idx + 1) + "</td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="relative">',
        '      <input type="number" step="0.1" min="0.1" data-row="' + idx + '" data-field="depth_m" value="' + depthVal + '" ' +
        '        class="p2-spt-input clean-num w-full rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 pl-2.5 pr-7 py-1 text-right font-mono text-xs text-slate-800 outline-none transition-all" />',
        '      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">m</span>',
        "    </div>",
        "  </td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="relative">',
        '      <input type="number" step="1" min="0" max="150" data-row="' + idx + '" data-field="N_measured" value="' + nVal + '" ' +
        '        class="p2-spt-input clean-num w-full rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 pl-2.5 pr-12 py-1 text-right font-mono text-xs text-slate-800 outline-none transition-all" />',
        '      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">blows</span>',
        "    </div>",
        "  </td>",
        '  <td class="px-2 py-1.5">',
        '    <select data-row="' + idx + '" data-field="soilCategory" class="p2-spt-select w-full rounded-md border border-slate-200 bg-white hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none transition-all">' +
              optionsHtml +
        "    </select>",
        "  </td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="relative">',
        '      <input type="number" step="1" min="0.1" placeholder="Auto (P1)" data-row="' + idx + '" data-field="sigma_v_override" value="' + overrideVal + '" ' +
        '        class="p2-spt-input clean-num w-full rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 pl-2.5 pr-9 py-1 text-right font-mono text-xs text-slate-800 placeholder:text-slate-400 placeholder:font-sans outline-none transition-all" />',
        '      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
        "    </div>",
        "  </td>",
        '  <td class="px-2 py-1.5 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-200">',
        '    <button type="button" data-delete-spt="' + idx + '" class="p2-spt-delete-btn inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete SPT Row S' + (idx + 1) + '" aria-label="Delete SPT Row S' + (idx + 1) + '">',
        '      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/></svg>',
        "    </button>",
        "  </td>",
        "</tr>"
      ].join("");
    });

    els.sptInputTbody.innerHTML = rowsHtml.join("");
  }

  /**
   * Renders the editable Direct Shear Input Table.
   * Called ONLY on init(), Add Test Point, Delete Test Point, or Reset P2 Sample
   * so numeric typing never loses cursor focus.
   */
  function renderShearInputTable() {
    var state = getState();
    var points = (state && state.directShearPoints) || [];

    if (points.length === 0) {
      els.shearInputTbody.innerHTML =
        '<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-400">No Direct Shear points entered. Click "+ Add Test Point" to begin.</td></tr>';
      return;
    }

    var rowsHtml = points.map(function (pt, idx) {
      var sigVal = typeof pt.sigma_n === "number" && Number.isFinite(pt.sigma_n) ? pt.sigma_n : "";
      var tauVal = typeof pt.tau_f === "number" && Number.isFinite(pt.tau_f) ? pt.tau_f : "";

      return [
        '<tr data-shear-row="' + idx + '" class="group hover:bg-indigo-50/30 transition-colors">',
        '  <td class="px-3 py-1.5 font-mono font-semibold text-slate-500">T' + (idx + 1) + "</td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="relative">',
        '      <input type="number" step="5" min="0" data-row="' + idx + '" data-field="sigma_n" value="' + sigVal + '" ' +
        '        class="p2-shear-input clean-num w-full rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 pl-2.5 pr-9 py-1 text-right font-mono text-xs text-slate-800 outline-none transition-all" />',
        '      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
        "    </div>",
        "  </td>",
        '  <td class="px-2 py-1.5">',
        '    <div class="relative">',
        '      <input type="number" step="0.5" min="0" data-row="' + idx + '" data-field="tau_f" value="' + tauVal + '" ' +
        '        class="p2-shear-input clean-num w-full rounded-md border border-transparent bg-slate-50/70 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 pl-2.5 pr-9 py-1 text-right font-mono text-xs text-slate-800 outline-none transition-all" />',
        '      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-slate-400">kPa</span>',
        "    </div>",
        "  </td>",
        '  <td class="px-2 py-1.5 text-center">',
        '    <button type="button" data-delete-shear="' + idx + '" class="p2-shear-delete-btn inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Test Point T' + (idx + 1) + '" aria-label="Delete Test Point T' + (idx + 1) + '">',
        '      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/></svg>',
        "    </button>",
        "  </td>",
        "</tr>"
      ].join("");
    });

    els.shearInputTbody.innerHTML = rowsHtml.join("");
  }

  /**
   * Updates the top P1 Sync Status pill showing groundwater depth or P1 validation warning.
   */
  function updateP1SyncStatus(state) {
    var hasP1Errors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;
    var hasLayers = Array.isArray(state.processedLayers) && state.processedLayers.length > 0;

    if (hasP1Errors || !hasLayers) {
      var errCount = hasP1Errors ? state.validationErrors.length : 0;
      var msg = hasP1Errors
        ? "P1 Profile Has " + errCount + (errCount === 1 ? " Error" : " Errors") + " — Auto σ'v0 Paused"
        : "No Valid P1 Profile — Use Manual σ'v0 Override";

      els.p1SyncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25";
      els.p1SyncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>' + escapeHtml(msg);
    } else {
      var maxDepth = 0;
      for (var i = 0; i < state.processedLayers.length; i++) {
        if (state.processedLayers[i].z_bot > maxDepth) {
          maxDepth = state.processedLayers[i].z_bot;
        }
      }
      els.p1SyncBadge.className =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
      els.p1SyncBadge.innerHTML =
        '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' +
        "Synced with P1 (" +
        state.processedLayers.length +
        " layers, 0–" +
        formatNum(maxDepth, 2) +
        " m · z<sub>w,meas</sub> = " +
        formatNum(state.zw_measured, 2) +
        " m)";
    }
  }

  /**
   * Renders computed SPT results table and auditable step-by-step calculation cards.
   */
  function renderSptResultsAndSteps(sptProcessed, sptErrors) {
    // Validation alert banner
    if (sptErrors.length > 0) {
      els.sptErrorBanner.classList.remove("hidden");
      els.sptErrorList.innerHTML = sptErrors
        .map(function (err) {
          return "<li>" + escapeHtml(err) + "</li>";
        })
        .join("");
    } else {
      els.sptErrorBanner.classList.add("hidden");
      els.sptErrorList.innerHTML = "";
    }

    // Computed SPT results table
    if (!Array.isArray(sptProcessed) || sptProcessed.length === 0) {
      els.sptResultsTbody.innerHTML =
        '<tr><td colspan="8" class="px-4 py-6 text-center font-sans text-xs text-slate-400">No valid SPT results to display.</td></tr>';
      els.sptStepsCount.textContent = "0 rows";
      els.sptStepsContainer.innerHTML =
        '<p class="text-xs text-slate-400 text-center py-3">Enter valid SPT rows above to inspect step-by-step IS 2131:1981 derivations.</p>';
      return;
    }

    var tableRowsHtml = sptProcessed.map(function (item) {
      var isManual = item.sigma_v0_source === "Manual Override";
      var sourceBadge = isManual
        ? '<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">Manual</span>'
        : '<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20">Auto (P1)</span>';

      var dilatancyPill = item.dilatancyApplied
        ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Applied</span>'
        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-slate-100 text-slate-500">No</span>';

      var clampTag = item.overburdenClamped
        ? '<span class="block text-[9px] font-sans text-amber-600">clamped ≥25 kPa</span>'
        : "";

      return [
        '<tr class="hover:bg-slate-50/80 transition-colors">',
        '  <td class="px-3 py-2.5 font-semibold text-slate-600">S' + (item.rowIndex + 1) + "</td>",
        '  <td class="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">' + formatNum(item.depth_m, 2) + " m</td>",
        '  <td class="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">' + formatNum(item.sigma_v0, 2) + " kPa" + sourceBadge + "</td>",
        '  <td class="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">' + formatNum(item.CN, 3) + clampTag + "</td>",
        '  <td class="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">' + formatNum(item.N_prime, 2) + "</td>",
        '  <td class="px-3 py-2.5 text-center">' + dilatancyPill + "</td>",
        '  <td class="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">' + formatNum(item.N_double_prime, 2) + "</td>",
        '  <td class="px-3 py-2.5 text-right whitespace-nowrap"><span class="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">' + item.N_final_rounded + " blows</span></td>",
        "</tr>"
      ].join("");
    });

    els.sptResultsTbody.innerHTML = tableRowsHtml.join("");

    // Step-by-Step Calculation Breakdown stacked cards
    els.sptStepsCount.textContent = sptProcessed.length + (sptProcessed.length === 1 ? " row" : " rows");

    var stepCardsHtml = sptProcessed.map(function (item) {
      var stepsListHtml = (item.steps || [])
        .map(function (stepLine) {
          return '<li class="text-[11px] font-mono text-slate-700 leading-relaxed">' + escapeHtml(stepLine) + "</li>";
        })
        .join("");

      return [
        '<div class="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">',
        '  <div class="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">',
        '    <div class="flex items-center gap-2">',
        '      <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-semibold">S' + (item.rowIndex + 1) + "</span>",
        '      <span class="text-xs font-semibold text-slate-800">z = ' + formatNum(item.depth_m, 2) + " m &middot; " + escapeHtml(item.soilCategory) + "</span>",
        "    </div>",
        '    <span class="text-[11px] font-mono font-semibold text-indigo-700">N = ' + formatNum(item.N_measured, 0) + " &rarr; N&Prime; = " + formatNum(item.N_double_prime, 2) + " (" + item.N_final_rounded + " blows)</span>",
        "  </div>",
        '  <ul class="space-y-1">' + stepsListHtml + "</ul>",
        "</div>"
      ].join("");
    });

    els.sptStepsContainer.innerHTML = stepCardsHtml.join("");
  }

  /**
   * Renders the interactive Plotly.js SPT blow count vs. depth chart (#p2-spt-plot).
   * Uses real Unicode symbols only (never raw HTML entities).
   */
  function renderSptPlot(sptProcessed, zwMeasured) {
    if (typeof global.Plotly === "undefined" || !els.sptPlotDiv) {
      return;
    }

    if (!Array.isArray(sptProcessed) || sptProcessed.length === 0) {
      els.sptPlotEmpty.classList.remove("hidden");
      if (els.sptPlotDiv.data) {
        global.Plotly.purge(els.sptPlotDiv);
      }
      return;
    }

    els.sptPlotEmpty.classList.add("hidden");

    // Sort a shallow copy by depth_m ascending so profile lines connect cleanly downward
    var sorted = sptProcessed.slice().sort(function (a, b) {
      return a.depth_m - b.depth_m;
    });

    var depths = [];
    var nMeas = [];
    var nPrime = [];
    var nDoublePrime = [];
    var hoverMeas = [];
    var hoverPrime = [];
    var hoverFinal = [];

    var maxN = 10;
    var maxDepth = Number.isFinite(zwMeasured) ? zwMeasured : 0;

    for (var i = 0; i < sorted.length; i++) {
      var r = sorted[i];
      depths.push(r.depth_m);
      nMeas.push(r.N_measured);
      nPrime.push(r.N_prime);
      nDoublePrime.push(r.N_double_prime);

      if (r.depth_m > maxDepth) maxDepth = r.depth_m;
      if (r.N_measured > maxN) maxN = r.N_measured;
      if (r.N_prime > maxN) maxN = r.N_prime;
      if (r.N_double_prime > maxN) maxN = r.N_double_prime;

      hoverMeas.push(
        "Row S" + (r.rowIndex + 1) + " · " + r.soilCategory +
        "<br>Depth z = " + r.depth_m.toFixed(2) + " m" +
        "<br>N_measured = " + r.N_measured.toFixed(0) + " blows" +
        "<br>σ'_v0 = " + r.sigma_v0.toFixed(2) + " kPa (" + r.sigma_v0_source + ")"
      );

      hoverPrime.push(
        "Row S" + (r.rowIndex + 1) + " · Overburden Correction" +
        "<br>Depth z = " + r.depth_m.toFixed(2) + " m" +
        "<br>C_N = " + r.CN.toFixed(3) + " (-)" +
        "<br>N' = " + r.N_prime.toFixed(2) + " blows"
      );

      hoverFinal.push(
        "Row S" + (r.rowIndex + 1) + " · Final Corrected SPT" +
        "<br>Depth z = " + r.depth_m.toFixed(2) + " m" +
        "<br>Dilatancy: " + (r.dilatancyApplied ? "Applied" : "Not Applied") +
        "<br>N'' = " + r.N_double_prime.toFixed(2) + " blows (Design: " + r.N_final_rounded + " blows)"
      );
    }

    var xUpper = Math.max(20, Math.ceil((maxN * 1.18) / 5) * 5);
    var yBottomPad = Math.max(0.8, maxDepth * 0.08);
    var yTopPad = Math.max(0.4, maxDepth * 0.04);

    var traces = [
      {
        type: "scatter",
        mode: "lines+markers",
        name: "N measured (blows)",
        x: nMeas,
        y: depths,
        text: hoverMeas,
        hoverinfo: "text",
        line: { color: "#64748b", width: 1.8 },
        marker: { size: 7, color: "#64748b", symbol: "circle" }
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "N' Overburden (blows)",
        x: nPrime,
        y: depths,
        text: hoverPrime,
        hoverinfo: "text",
        line: { color: "#0284c7", width: 2, dash: "dash" },
        marker: { size: 7, color: "#0284c7", symbol: "diamond" }
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "N'' Final Corrected (blows)",
        x: nDoublePrime,
        y: depths,
        text: hoverFinal,
        hoverinfo: "text",
        line: { color: "#4f46e5", width: 3 },
        marker: { size: 8, color: "#4f46e5", symbol: "square" }
      }
    ];

    var shapes = [];
    var annotations = [];

    if (typeof zwMeasured === "number" && Number.isFinite(zwMeasured)) {
      shapes.push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: zwMeasured,
        y1: zwMeasured,
        line: { color: "#0284c7", width: 1.8, dash: "dash" }
      });

      annotations.push({
        xref: "paper",
        x: 0.99,
        yref: "y",
        y: zwMeasured,
        xanchor: "right",
        yanchor: "bottom",
        text: "Measured WT (" + zwMeasured.toFixed(2) + " m)",
        showarrow: false,
        font: { size: 10, color: "#0369a1", family: "JetBrains Mono, monospace" },
        bgcolor: "rgba(240, 249, 255, 0.92)",
        bordercolor: "#bae6fd",
        borderwidth: 1,
        borderpad: 2
      });
    }

    var layout = {
      margin: { l: 56, r: 18, t: 36, b: 48 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "SPT Blow Count, N (blows / 300 mm)",
          font: { size: 11, color: "#475569" }
        },
        range: [0, xUpper],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#cbd5e1",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Depth below Ground Surface, z (m)",
          font: { size: 11, color: "#475569" }
        },
        range: [maxDepth + yBottomPad, -yTopPad],
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
        y: 1.09,
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

    global.Plotly.react(els.sptPlotDiv, traces, layout, config);
  }

  /**
   * Renders Direct Shear metrics, equation banner, negative cohesion warning,
   * residuals table, and Plotly Mohr-Coulomb envelope (#p2-shear-plot).
   */
  function renderDirectShearResults(directShearFit, directShearErrors) {
    if (directShearErrors.length > 0 || !directShearFit) {
      els.shearErrorBanner.classList.remove("hidden");
      els.shearErrorList.innerHTML = directShearErrors
        .map(function (err) {
          return "<li>" + escapeHtml(err) + "</li>";
        })
        .join("");
      els.shearResultsWorkspace.classList.add("hidden");
      els.shearResidualsCard.classList.add("hidden");
      return;
    }

    els.shearErrorBanner.classList.add("hidden");
    els.shearErrorList.innerHTML = "";
    els.shearResultsWorkspace.classList.remove("hidden");
    els.shearResidualsCard.classList.remove("hidden");

    var fit = directShearFit;

    // 4 Result Metric Cards
    if (fit.negativeCohesionWarning) {
      els.kpiCohesionVal.textContent = formatNum(fit.c_prime_design, 2) + " kPa";
      els.kpiCohesionSub.textContent = "Design (raw: " + formatNum(fit.c_prime_raw, 2) + " kPa)";
      els.kpiPhiVal.textContent = formatNum(fit.phi_prime_design, 2) + "°";
      els.kpiPhiSub.textContent = "Design (raw: " + formatNum(fit.phi_prime_raw, 2) + "°)";
    } else {
      els.kpiCohesionVal.textContent = formatNum(fit.c_prime_design, 2) + " kPa";
      els.kpiCohesionSub.textContent = "OLS Intercept (kPa)";
      els.kpiPhiVal.textContent = formatNum(fit.phi_prime_design, 2) + "°";
      els.kpiPhiSub.textContent = "OLS tan(φ') = " + formatNum(fit.slope, 4);
    }

    els.kpiR2Val.textContent = formatNum(fit.R2, 4);
    els.kpiRmseVal.textContent = formatNum(fit.rmse, 2) + " kPa";

    // Fitted Equation Banner
    els.shearEquationText.textContent = fit.equationText;

    // Negative Cohesion Warning Banner
    if (fit.negativeCohesionWarning) {
      els.shearNegCohesionBanner.classList.remove("hidden");
      els.shearNegCohesionBody.textContent =
        "Raw OLS Fit: c'_raw = " +
        formatNum(fit.c_prime_raw, 2) +
        " kPa, φ'_raw = " +
        formatNum(fit.phi_prime_raw, 2) +
        "°  |  Constrained Origin Design Fit: c'_design = " +
        formatNum(fit.c_prime_design, 2) +
        " kPa, φ'_design = " +
        formatNum(fit.phi_prime_design, 2) +
        "° (recommended for cohesionless soils).";
    } else {
      els.shearNegCohesionBanner.classList.add("hidden");
      els.shearNegCohesionBody.textContent = "";
    }

    // Compact Residuals Table
    var resHtml = (fit.residuals || []).map(function (row) {
      var resSign = row.residual > 0 ? "+" : "";
      var resColor = Math.abs(row.residual) > fit.rmse * 1.25 ? "text-amber-700 font-semibold" : "text-slate-700";
      return [
        '<tr class="hover:bg-slate-50/80">',
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(row.sigma_n, 1) + " kPa</td>",
        '  <td class="px-3 py-2 text-right text-slate-800">' + formatNum(row.tau_f, 2) + " kPa</td>",
        '  <td class="px-3 py-2 text-right text-indigo-700">' + formatNum(row.tau_pred, 2) + " kPa</td>",
        '  <td class="px-3 py-2 text-right ' + resColor + '">' + resSign + formatNum(row.residual, 2) + " kPa</td>",
        "</tr>"
      ].join("");
    });
    els.shearResidualsTbody.innerHTML = resHtml.join("");

    // Render Plotly Mohr-Coulomb Envelope
    renderDirectShearPlot(fit);
  }

  /**
   * Renders the interactive Plotly.js Direct Shear Mohr-Coulomb envelope (#p2-shear-plot).
   * Uses real Unicode symbols only (never raw HTML entities).
   */
  function renderDirectShearPlot(fit) {
    if (typeof global.Plotly === "undefined" || !els.shearPlotDiv || !fit) {
      return;
    }

    var obsX = [];
    var obsY = [];
    var obsHover = [];

    for (var i = 0; i < fit.residuals.length; i++) {
      var r = fit.residuals[i];
      obsX.push(r.sigma_n);
      obsY.push(r.tau_f);
      obsHover.push(
        "Test T" + (i + 1) +
        "<br>σ_n = " + r.sigma_n.toFixed(1) + " kPa" +
        "<br>Measured τ_f = " + r.tau_f.toFixed(2) + " kPa" +
        "<br>Predicted τ_pred = " + r.tau_pred.toFixed(2) + " kPa" +
        "<br>Residual = " + (r.residual >= 0 ? "+" : "") + r.residual.toFixed(2) + " kPa"
      );
    }

    var lineX = fit.linePoints.x;
    var lineY = fit.linePoints.y;
    var xEnd = lineX[lineX.length - 1];

    var traces = [
      {
        type: "scatter",
        mode: "markers",
        name: "Measured Test Points",
        x: obsX,
        y: obsY,
        text: obsHover,
        hoverinfo: "text",
        marker: {
          size: 10,
          color: "#0284c7",
          line: { color: "#0f172a", width: 1.2 }
        }
      },
      {
        type: "scatter",
        mode: "lines",
        name: fit.negativeCohesionWarning
          ? "Raw OLS Envelope (c' = " + fit.c_prime_raw.toFixed(2) + " kPa, φ' = " + fit.phi_prime_raw.toFixed(1) + "°)"
          : "OLS Mohr-Coulomb Envelope (R² = " + fit.R2.toFixed(4) + ")",
        x: lineX,
        y: lineY,
        hoverinfo: "name+x+y",
        line: {
          color: "#4f46e5",
          width: 2.6
        }
      }
    ];

    // Overlay constrained zero-cohesion origin fit line if c'_raw < 0
    if (fit.negativeCohesionWarning && typeof fit.slope_origin === "number" && Number.isFinite(fit.slope_origin)) {
      traces.push({
        type: "scatter",
        mode: "lines",
        name: "Constrained Origin Design Fit (c' = 0.00 kPa, φ' = " + fit.phi_prime_design.toFixed(1) + "°)",
        x: [0.0, xEnd],
        y: [0.0, fit.slope_origin * xEnd],
        hoverinfo: "name+x+y",
        line: {
          color: "#d97706",
          width: 2.4,
          dash: "dash"
        }
      });
    }

    var minY = Math.min(0.0, lineY[0]);
    var maxY = Math.max(lineY[lineY.length - 1], Math.max.apply(null, obsY));
    if (fit.negativeCohesionWarning && typeof fit.slope_origin === "number") {
      maxY = Math.max(maxY, fit.slope_origin * xEnd);
    }

    var yPadTop = Math.max(5.0, maxY * 0.12);
    var yPadBot = minY < 0 ? Math.abs(minY) * 0.25 + 3.0 : Math.max(2.0, maxY * 0.04);

    var layout = {
      margin: { l: 60, r: 20, t: 38, b: 48 },
      font: { family: "Inter, system-ui, sans-serif", color: "#334155" },
      xaxis: {
        title: {
          text: "Normal Stress, σ_n (kPa)",
          font: { size: 11, color: "#475569" }
        },
        range: [0, xEnd],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#94a3b8",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      yaxis: {
        title: {
          text: "Peak Shear Stress, τ_f (kPa)",
          font: { size: 11, color: "#475569" }
        },
        range: [minY - yPadBot, maxY + yPadTop],
        gridcolor: "#f1f5f9",
        zerolinecolor: "#94a3b8",
        tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#64748b" }
      },
      annotations: [
        {
          xref: "paper",
          yref: "paper",
          x: 0.02,
          y: 0.96,
          xanchor: "left",
          yanchor: "top",
          text: fit.equationText + "  ·  R² = " + fit.R2.toFixed(4),
          showarrow: false,
          font: { size: 10.5, color: "#1e293b", family: "JetBrains Mono, monospace" },
          bgcolor: "rgba(248, 250, 252, 0.95)",
          bordercolor: "#cbd5e1",
          borderwidth: 1,
          borderpad: 4
        }
      ],
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
        bordercolor: "#0284c7",
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

    global.Plotly.react(els.shearPlotDiv, traces, layout, config);
  }

  /**
   * Executes both SPT and Direct Shear calculations, stores p2Results with
   * loop guard, and refreshes all P2 output panels and charts.
   */
  function refreshAll(state) {
    var logic = getLogic();
    if (!logic || !state) {
      return;
    }

    updateP1SyncStatus(state);

    var p1ValidLayers =
      Array.isArray(state.validationErrors) && state.validationErrors.length === 0
        ? state.processedLayers
        : [];

    var sptOut = logic.processSptRecords(
      state.sptRecords,
      p1ValidLayers,
      state.zw_measured,
      state.gamma_w
    );

    var shearOut = logic.fitDirectShear(state.directShearPoints);

    // Loop guard: sync computed results into global state without recursive re-trigger
    isSyncingFromState = true;
    try {
      state.setP2Results(
        {
          sptProcessed: sptOut.sptProcessed,
          sptErrors: sptOut.sptErrors,
          directShearFit: shearOut.directShearFit,
          directShearErrors: shearOut.directShearErrors
        },
        false
      );
    } finally {
      isSyncingFromState = false;
    }

    renderSptResultsAndSteps(sptOut.sptProcessed, sptOut.sptErrors);
    renderSptPlot(sptOut.sptProcessed, state.zw_measured);
    renderDirectShearResults(shearOut.directShearFit, shearOut.directShearErrors);
  }

  /**
   * Resizes both P2 Plotly charts safely when #tab-p2 becomes visible.
   */
  function resizeP2Plots() {
    if (typeof global.Plotly === "undefined") {
      return;
    }
    global.requestAnimationFrame(function () {
      if (els.sptPlotDiv && els.sptPlotDiv.classList.contains("js-plotly-plot")) {
        global.Plotly.Plots.resize(els.sptPlotDiv);
      }
      if (els.shearPlotDiv && els.shearPlotDiv.classList.contains("js-plotly-plot")) {
        global.Plotly.Plots.resize(els.shearPlotDiv);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // INPUT HANDLERS (Preserving Focus & Strict State-Before-Render Order)
  // ---------------------------------------------------------------------------

  function handleSptCellUpdate(target) {
    var state = getState();
    var rowAttr = target.getAttribute("data-row");
    var field = target.getAttribute("data-field");
    if (rowAttr === null || !field) {
      return;
    }

    var rowIdx = parseInt(rowAttr, 10);
    if (!Number.isInteger(rowIdx) || !state.sptRecords[rowIdx]) {
      return;
    }

    var updatedRecords = state.sptRecords.map(function (rec, idx) {
      if (idx !== rowIdx) {
        return rec;
      }
      var copy = Object.assign({}, rec);
      if (field === "soilCategory") {
        copy.soilCategory = target.value;
      } else if (field === "sigma_v_override") {
        var trimmed = String(target.value).trim();
        if (trimmed === "") {
          copy.sigma_v_override = null;
        } else {
          var parsedOv = Number(trimmed);
          copy.sigma_v_override = Number.isFinite(parsedOv) ? parsedOv : NaN;
        }
      } else {
        var rawStr = String(target.value).trim();
        if (rawStr === "") {
          copy[field] = NaN;
        } else {
          var parsedNum = Number(rawStr);
          copy[field] = Number.isFinite(parsedNum) ? parsedNum : NaN;
        }
      }
      return copy;
    });

    // Update array without rebuilding input table DOM (preserves cursor focus)
    state.sptRecords = updatedRecords;
    refreshAll(state);
  }

  function handleShearCellUpdate(target) {
    var state = getState();
    var rowAttr = target.getAttribute("data-row");
    var field = target.getAttribute("data-field");
    if (rowAttr === null || !field) {
      return;
    }

    var rowIdx = parseInt(rowAttr, 10);
    if (!Number.isInteger(rowIdx) || !state.directShearPoints[rowIdx]) {
      return;
    }

    var updatedPoints = state.directShearPoints.map(function (pt, idx) {
      if (idx !== rowIdx) {
        return pt;
      }
      var copy = Object.assign({}, pt);
      var rawStr = String(target.value).trim();
      if (rawStr === "") {
        copy[field] = NaN;
      } else {
        var parsedNum = Number(rawStr);
        copy[field] = Number.isFinite(parsedNum) ? parsedNum : NaN;
      }
      return copy;
    });

    // Update array without rebuilding input table DOM (preserves cursor focus)
    state.directShearPoints = updatedPoints;
    refreshAll(state);
  }

  function handleAddSptRow() {
    var state = getState();
    var current = state.sptRecords || [];
    var nextDepth = 1.5;

    if (current.length > 0) {
      var last = current[current.length - 1];
      if (typeof last.depth_m === "number" && Number.isFinite(last.depth_m)) {
        nextDepth = Number((last.depth_m + 1.5).toFixed(2));
      }
    }

    var newRow = {
      depth_m: nextDepth,
      N_measured: 15,
      soilCategory: "Fine Sand / Silt (Dilatancy Applicable)",
      sigma_v_override: null
    };

    var nextRecords = current.concat([newRow]);
    // Execution order: mutate state BEFORE re-rendering input table
    state.setSptRecords(nextRecords);
    renderSptInputTable();
  }

  function handleDeleteSptRow(rowIdx) {
    var state = getState();
    var current = state.sptRecords || [];
    if (rowIdx < 0 || rowIdx >= current.length) {
      return;
    }

    var nextRecords = current.filter(function (_, idx) {
      return idx !== rowIdx;
    });

    // Execution order: mutate state BEFORE re-rendering input table
    state.setSptRecords(nextRecords);
    renderSptInputTable();
  }

  function handleAddShearPoint() {
    var state = getState();
    var current = state.directShearPoints || [];
    var nextSigma = 50.0;
    var nextTau = 35.0;

    if (current.length > 0) {
      var last = current[current.length - 1];
      if (typeof last.sigma_n === "number" && Number.isFinite(last.sigma_n)) {
        nextSigma = Number((last.sigma_n + 50.0).toFixed(1));
      }
      if (typeof last.tau_f === "number" && Number.isFinite(last.tau_f)) {
        nextTau = Number((last.tau_f + 30.0).toFixed(1));
      }
    }

    var nextPoints = current.concat([{ sigma_n: nextSigma, tau_f: nextTau }]);
    // Execution order: mutate state BEFORE re-rendering input table
    state.setDirectShearPoints(nextPoints);
    renderShearInputTable();
  }

  function handleDeleteShearPoint(rowIdx) {
    var state = getState();
    var current = state.directShearPoints || [];
    if (rowIdx < 0 || rowIdx >= current.length) {
      return;
    }

    var nextPoints = current.filter(function (_, idx) {
      return idx !== rowIdx;
    });

    // Execution order: mutate state BEFORE re-rendering input table
    state.setDirectShearPoints(nextPoints);
    renderShearInputTable();
  }

  /**
   * Binds DOM event listeners and GeotechState subscription once.
   */
  function bindEvents() {
    var state = getState();

    // Reset P2 Sample button
    els.btnResetP2.addEventListener("click", function () {
      state.resetP2Defaults();
      renderSptInputTable();
      renderShearInputTable();
    });

    // SPT Add / Edit / Delete
    els.btnAddSptTop.addEventListener("click", handleAddSptRow);
    els.btnAddSptBottom.addEventListener("click", handleAddSptRow);

    els.sptInputTbody.addEventListener("input", function (evt) {
      if (evt.target && evt.target.classList.contains("p2-spt-input")) {
        handleSptCellUpdate(evt.target);
      }
    });

    els.sptInputTbody.addEventListener("change", function (evt) {
      if (evt.target && (evt.target.classList.contains("p2-spt-input") || evt.target.classList.contains("p2-spt-select"))) {
        handleSptCellUpdate(evt.target);
      }
    });

    els.sptInputTbody.addEventListener("click", function (evt) {
      var delBtn = evt.target.closest ? evt.target.closest(".p2-spt-delete-btn") : null;
      if (delBtn) {
        var idx = parseInt(delBtn.getAttribute("data-delete-spt"), 10);
        if (Number.isInteger(idx)) {
          handleDeleteSptRow(idx);
        }
      }
    });

    // Direct Shear Add / Edit / Delete
    els.btnAddShearTop.addEventListener("click", handleAddShearPoint);
    els.btnAddShearBottom.addEventListener("click", handleAddShearPoint);

    els.shearInputTbody.addEventListener("input", function (evt) {
      if (evt.target && evt.target.classList.contains("p2-shear-input")) {
        handleShearCellUpdate(evt.target);
      }
    });

    els.shearInputTbody.addEventListener("change", function (evt) {
      if (evt.target && evt.target.classList.contains("p2-shear-input")) {
        handleShearCellUpdate(evt.target);
      }
    });

    els.shearInputTbody.addEventListener("click", function (evt) {
      var delBtn = evt.target.closest ? evt.target.closest(".p2-shear-delete-btn") : null;
      if (delBtn) {
        var idx = parseInt(delBtn.getAttribute("data-delete-shear"), 10);
        if (Number.isInteger(idx)) {
          handleDeleteShearPoint(idx);
        }
      }
    });

    // Ensure Plotly charts resize cleanly whenever #tab-p2 becomes visible
    var p2TabBtn = document.getElementById("btn-tab-p2");
    if (p2TabBtn) {
      p2TabBtn.addEventListener("click", resizeP2Plots);
    }

    if (typeof global.MutationObserver !== "undefined" && els.container) {
      var observer = new global.MutationObserver(function () {
        if (!els.container.classList.contains("hidden")) {
          resizeP2Plots();
        }
      });
      observer.observe(els.container, { attributes: true, attributeFilter: ["class"] });
    }

    // Reactive subscription to Module P1 stratigraphy / water table / P2 state updates
    state.subscribe(function (updatedState) {
      if (isSyncingFromState) {
        return;
      }
      refreshAll(updatedState);
    });
  }

  /**
   * Initializes Module P2 UI inside #tab-p2.
   */
  function init() {
    var container = document.getElementById("tab-p2");
    if (!container || !getState() || !getLogic()) {
      return;
    }

    els.container = container;
    buildSkeleton(container);
    renderSptInputTable();
    renderShearInputTable();
    bindEvents();
    refreshAll(getState());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ModuleP2UI = Object.freeze({
    init: init,
    resizePlots: resizeP2Plots
  });
})(window);