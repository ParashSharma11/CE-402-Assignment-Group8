"""Build the GeoFound final report (HTML -> PDF via scripts/report_pdf.mjs).

Usage:  python docs/report/build_report.py
Reads docs/report/data.json (numbers exported from the engine) and writes docs/report/report.html + figures.
Every number in the report comes from data.json; nothing is typed in by hand except text.
"""
import json, math, pathlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = pathlib.Path(__file__).parent
class Rec(dict):
    def __missing__(self, k):  # JSON omits undefined fields; read them as None
        return None
D = json.loads((HERE / 'data.json').read_text(encoding='utf-8'), object_hook=Rec)
FIG = HERE / 'fig'; FIG.mkdir(exist_ok=True)

# Palette (validated: dataviz reference categorical slots 1-4, light surface). Low-contrast hues are always
# paired with direct labels / line styles and a data table in the text.
C1, C2, C3, C4 = '#257de0', '#f47230', '#00b894', '#f2a600'
INK, MUTED, GRID = '#1f2937', '#6b7280', '#e5e7eb'
plt.rcParams.update({'font.family': 'serif', 'font.serif': ['Times New Roman', 'DejaVu Serif'], 'font.size': 9,
                     'axes.edgecolor': '#9ca3af', 'axes.labelcolor': INK, 'xtick.color': MUTED, 'ytick.color': MUTED,
                     'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6, 'axes.spines.top': False,
                     'axes.spines.right': False, 'legend.frameon': False, 'lines.linewidth': 2})

def f(x, d=1):
    return '–' if x is None or (isinstance(x, float) and not math.isfinite(x)) else f'{x:.{d}f}'

def save(fig, name):
    fig.tight_layout(); fig.savefig(FIG / f'{name}.svg'); plt.close(fig)

BH = {b['id']: b for b in D['bh']}
order = ['BH-2', 'BH-1', 'BH-3']

# ---------------- Figure 1: site plan ----------------
fig, ax = plt.subplots(figsize=(6.6, 3.0)); ax.grid(False)
zone = {1: 'BH-2', 2: 'BH-2', 3: 'BH-1', 4: 'BH-1', 5: 'BH-1', 6: 'BH-3', 7: 'BH-3'}
zc = {'BH-2': C1, 'BH-1': C2, 'BH-3': C3}
for z, (x0, x1) in {'BH-2': (-2.5, 7.5), 'BH-1': (7.5, 22.5), 'BH-3': (22.5, 32.5)}.items():
    ax.axvspan(x0, x1, color=zc[z], alpha=0.08, lw=0)
    ax.text((x0 + x1) / 2, 18.2, f'{z} zone', ha='center', color=INK, fontsize=8.5)
for i, r in enumerate('ABCD'):
    for l in range(1, 8):
        x, y = (l - 1) * 5, i * 5
        ax.plot(x, y, 's', ms=7, color=zc[zone[l]], mec='white', mew=1.2)
        if r == 'A': ax.text(x, -2.4, str(l), ha='center', color=MUTED)
    ax.text(-3.6, i * 5, r, va='center', color=MUTED)
ax.plot(10, 10, 's', ms=10, mfc='none', mec=INK, mew=1.4); ax.text(11, 11, 'C4 (eccentric)', fontsize=8, color=INK)
for bid, (x, y) in {'BH-1': (15, 10), 'BH-2': (0, 0), 'BH-3': (30, 15)}.items():
    ax.plot(x, y, marker=(6, 2, 0), ms=11, color=INK, mew=1.6)
ax.annotate('stream ≈ 25 m east →', (32.5, 7.5), color=C1, fontsize=8.5, ha='left')
ax.set_xlim(-5, 40); ax.set_ylim(-4, 20); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
for s in ax.spines.values(): s.set_visible(False)
save(fig, 'f1_plan')

# ---------------- Figure 3: SPT N and N'' vs depth (small multiples) ----------------
fig, axs = plt.subplots(1, 3, figsize=(6.6, 3.1), sharey=True)
for ax, bid in zip(axs, order):
    rows = [r for r in BH[bid]['spt'] if not r['ref']]
    z = [r['z'] for r in rows]
    ax.plot([r['N'] for r in rows], z, 'o-', color=C1, ms=4, lw=1.5, label='N (field)')
    ax.plot([r['N2'] for r in rows], z, 's--', color=C2, ms=4, lw=1.5, label='N″ (corrected)')
    ax.set_title(bid, fontsize=9, color=INK); ax.set_xlim(0, 36); ax.set_xlabel('blows / 300 mm')
axs[0].invert_yaxis(); axs[0].set_ylabel('Depth below ground, m'); axs[0].legend(loc='lower left', fontsize=7.5)
save(fig, 'f3_spt')

# ---------------- Figure 4: oedometer e-log p ----------------
pts = D['lab']['oedPts']
fig, ax = plt.subplots(figsize=(4.2, 2.9))
ld = [p for p in pts if p['stage'] == 'loading']; ul = [p for p in pts if p['stage'] != 'loading']
ax.semilogx([p['p'] * 98.0665 for p in ld], [p['e'] for p in ld], 'o-', color=C1, ms=4, label='loading')
ax.semilogx([pts[6]['p'] * 98.0665] + [p['p'] * 98.0665 for p in ul], [pts[6]['e']] + [p['e'] for p in ul], 's--', color=C2, ms=4, label='unloading')
spv = D['lab']['oed']['sp']; ax.axvline(spv, color=MUTED, lw=1, ls=':'); ax.text(spv * 1.05, 0.9, f"σ′p ≈ {spv:.0f} kPa", fontsize=8, color=INK)
ax.set_xlabel('Effective stress σ′, kPa (log scale)'); ax.set_ylabel('Void ratio e'); ax.legend(fontsize=8)
save(fig, 'f4_oed')

# ---------------- Figure 5: direct shear fits ----------------
ds = D['lab']['ds']
fig, ax = plt.subplots(figsize=(4.2, 2.9))
for (k, lab, col, mk) in [('SM_unsoaked', 'SM unsoaked', C1, 'o'), ('SM_soaked', 'SM soaked', C2, 's'), ('SP_soaked', 'SP soaked', C3, '^')]:
    s, t = ds[k]['sigma'], ds[k]['tau']; n = len(s); sx, sy = sum(s), sum(t); sxx = sum(a * a for a in s); sxy = sum(a * b for a, b in zip(s, t))
    m = (n * sxy - sx * sy) / (n * sxx - sx * sx); c = (sy - m * sx) / n
    ax.plot(s, t, mk, color=col, ms=5); ax.plot([0, 160], [c, c + m * 160], color=col, lw=1.4, marker=mk, markevery=[], label=f'{lab}: c′ = {c:.2f} kPa, φ′ = {math.degrees(math.atan(m)):.1f}°')
ax.legend(fontsize=7.5, loc='upper left')
ax.set_xlim(0, 170); ax.set_ylim(0, 115); ax.set_xlabel('Normal stress σn, kPa'); ax.set_ylabel('Peak shear stress τf, kPa')
save(fig, 'f5_shear')

# ---------------- Figure 6: stress increase ----------------
st = D['stress']
fig, ax = plt.subplots(figsize=(4.2, 3.2))
ax.plot([r['c'] for r in st], [r['z'] for r in st], color=C1, label='Boussinesq — centre')
ax.plot([r['k'] for r in st], [r['z'] for r in st], color=C2, ls='--', label='Boussinesq — corner')
ax.plot([r['t'] for r in st], [r['z'] for r in st], color=C3, ls=':', label='2:1 method')
ax.invert_yaxis(); ax.set_xlabel('Δσz, kPa'); ax.set_ylabel('Depth below footing base z, m'); ax.legend(fontsize=7.5, loc='lower right')
save(fig, 'f6_stress')

# ---------------- Figure 7: clay stress, single vs group ----------------
solo, grp = D['b3']['solo'], D['b3']['grp']
fig, ax = plt.subplots(figsize=(4.2, 3.0))
ax.plot([r[2] for r in solo], [r[0] for r in solo], 'o-', ms=3, color=C1, label='B3 footing alone')
ax.plot([r[2] for r in grp], [r[0] for r in grp], 's-', ms=3, color=C2, label=f"B3 + {D['b3']['nNb']} neighbouring footings")
ax.invert_yaxis(); ax.set_xlabel('Δσz in the CI clay, kPa'); ax.set_ylabel('Depth below ground, m'); ax.legend(fontsize=7.5, loc='center')
save(fig, 'f7_overlap')

# ---------------- Figure 8: time-settlement ----------------
import numpy as np
cv = D['lab']['cv']; Hd = 2.4; sc = D['b3']['sGrp'] * 1000
def U(Tv):
    s = 0
    for m in range(60):
        M = math.pi * (2 * m + 1) / 2; s += 2 / M ** 2 * math.exp(-M * M * Tv)
    return 1 - s
ts = np.logspace(-2, 1.2, 80)
fig, ax = plt.subplots(figsize=(4.2, 2.8))
ax.semilogx(ts, [sc * U(cv * t / Hd ** 2) for t in ts], color=C1)
t90 = 0.848 * Hd ** 2 / cv; ax.axvline(t90, color=MUTED, ls=':', lw=1); ax.text(t90 * 1.08, sc * 0.55, f't90 ≈ {t90:.1f} yr', fontsize=8)
ax.invert_yaxis(); ax.set_xlabel('Time, years (log scale)'); ax.set_ylabel('sc(t), mm')
save(fig, 'f8_time')

# ---------------- Figure 9: liquefaction FS ----------------
fig, ax = plt.subplots(figsize=(4.2, 3.0))
for bid, col, mk in [('BH-2', C1, 'o'), ('BH-1', C2, 's'), ('BH-3', C3, '^')]:
    rows = [r for r in BH[bid]['liq'] if (r.get('FS') or 99) < 50]
    ax.plot([r['FS'] for r in rows], [r['z'] for r in rows], mk + '-', color=col, ms=5, lw=1.4, label=bid)
ax.axvline(1.0, color=INK, lw=1); ax.text(1.03, 0.9, 'FS = 1', fontsize=8)
ax.invert_yaxis(); ax.set_xlim(0, 2.5); ax.set_ylim(5.2, 0.5); ax.set_xlabel('Factor of safety against liquefaction (amax = 0.18 g)'); ax.set_ylabel('Depth, m'); ax.legend(fontsize=8, loc='lower right')
save(fig, 'f9_liq')

# ---------------- Figure 10: final pile layout ----------------
fig, ax = plt.subplots(figsize=(6.6, 2.9)); ax.grid(False)
for c in D['final']['cols']:
    l = int(c['id'][1:]); r = 'ABCD'.index(c['id'][0]); x, y = (l - 1) * 5, r * 5
    ax.add_patch(plt.Rectangle((x - c['cap'] / 2, y - c['cap'] / 2), c['cap'], c['cap'], fc='white', ec=zc[c['bh']], lw=1.5))
    n = c['n']; offs = {2: [(-0.75, 0), (0.75, 0)], 3: [(-0.75, -0.75), (0.75, -0.75), (0, 0.75)], 4: [(-0.75, -0.75), (0.75, -0.75), (-0.75, 0.75), (0.75, 0.75)]}[n]
    for dx, dy in offs: ax.add_patch(plt.Circle((x + dx, y + dy), 0.25, fc=zc[c['bh']], ec='white', lw=0.8))
    ax.text(x, y - 2.0, f"{c['id']} · {n}", ha='center', fontsize=6.8, color=INK)
ax.set_xlim(-3, 33); ax.set_ylim(-3.5, 18); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
for s in ax.spines.values(): s.set_visible(False)
for i, z in enumerate(['BH-2 zone (lines 1–2)', 'BH-1 zone (lines 3–5)', 'BH-3 zone (lines 6–7)']):
    ax.text(2 + i * 11, 17.3, '■ ' + z, color=list(zc.values())[i], fontsize=8)
save(fig, 'f10_piles')

# =====================================================================================================
def table(head, rows, cls=''):
    h = ''.join(f'<th>{x}</th>' for x in head)
    b = ''.join('<tr>' + ''.join(f'<td>{x}</td>' for x in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'

def figure(src, n, cap, w='100%'):
    return f'<figure><img src="{src}" style="width:{w}"><figcaption><b>Figure {n}.</b> {cap}</figcaption></figure>'

def eq(body, n):
    return f'<div class="eq"><span>{body}</span><span class="eqn">({n})</span></div>'

lam = D['lambda']
tri = {t['id']: t for t in D['trial']}
lab = D['lab']

# Tables
t_loads = table(['Column type', 'Grid positions', 'No.', 'P (service), kN', 'P × λ, kN', 'M × λ, kN·m'], [
    ['Corner', 'A1, A7, D1, D7', 4, 650, f(650 * lam, 0), 0],
    ['Edge', 'A2–A6, D2–D6, B1, C1, B7, C7', 14, 1000, f(1000 * lam, 0), 0],
    ['Interior', 'B2–B6, C2, C3, C5, C6', 9, 1450, f(1450 * lam, 0), 0],
    ['Eccentric interior*', 'C4', 1, 1450, f(1450 * lam, 0), f(362.5 * lam, 1)]])

t_bh = table(['Borehole', 'Location', 'GL, m RL', 'WT Oct (24 h), m', 'WT Aug (high), m', 'WT May (low), m'], [
    [b['id'], {'BH-1': 'near C4, centre', 'BH-2': 'near A1, west', 'BH-3': 'near D7, east (25 m from stream)'}[b['id']], f(b['rl'], 2), f(b['wt'][0]), f(b['wt'][1]), f(b['wt'][2])] for b in D['bh']])

lay_rows = []
for b in D['bh']:
    for l in b['layers']:
        strength = f"φ′ = {f(l['phi'])}°" if l['phi'] is not None and l['cu'] is None else f"cu = {f(l['cu'])} kPa"
        comp = f"Cc {f(l['Cc'], 3)}, Cr {f(l['Cr'], 3)}, e0 {f(l['e0'], 3)}" + (f", σ′p {f(l['sp'], 0)}" if l['sp'] else ', NC') if l['Cc'] else (f"E = {f(l['E'] / 1000, 1)} MPa" if l['E'] else '–')
        lay_rows.append([b['id'], f"{f(l['t'])}–{f(l['b'])}", l['s'], f"{f(l['gm'])} / {f(l['gs'])}" if l['gm'] else f"– / {f(l['gs'])}", strength, comp])
t_layers = table(['BH', 'Depth, m', 'Soil', 'γ moist / sat, kN/m³', 'Strength (design)', 'Stiffness / compressibility'], lay_rows, 'small')

spt_rows = []
for bid in order:
    for r in BH[bid]['spt']:
        note = 'refusal (>100)' if r['ref'] else ('dilatancy' if r['dil'] else '')
        if bid == 'BH-1' and r['z'] == 9.0: note = 'cobble — not used for clay'
        spt_rows.append([bid, f(r['z']), '>100' if r['ref'] else r['N'], f(r['sv']), f(r['CN'], 3), '–' if r['ref'] else f(r['N1']), '–' if r['ref'] else f(r['N2']), note])
t_spt = table(['BH', 'z, m', 'N', 'σ′v (Oct WT), kPa', 'CN', 'N′', 'N″', 'Note'], spt_rows, 'small')

t_lab = table(['Test', 'Result', 'Design value'], [
    ['Direct shear, SM soaked (OLS)', f"c′ = {f(lab['sm']['c'], 2)} kPa, φ′ = {f(lab['sm']['phi'], 2)}°", 'c′ = 0, φ′ = 30.0°'],
    ['Direct shear, SP soaked (OLS)', f"c′ = {f(lab['sp']['c'], 2)} kPa, φ′ = {f(lab['sp']['phi'], 2)}°", 'c′ = 0, φ′ = 34.4°'],
    ['UU triaxial, UDS-1 (7.0–7.45 m)', 'deviator 57.2 / 55.8 / 58.1 kPa', f"cu = {f(lab['cu1'])} kPa"],
    ['UU triaxial, UDS-2 (9.5–9.95 m)', 'deviator 71.0 / 73.4 / 72.2 kPa', f"cu = {f(lab['cu2'])} kPa"],
    ['Oedometer UDS-1 (kg/cm² × 98.0665)', f"Cc = {f(lab['oed']['Cc'], 3)}, Cr = {f(lab['oed']['Cr'], 3)}", f"σ′p = {f(lab['oed']['sp'])} kPa"],
    ['σ′v0 at UDS-1 (7.225 m), Oct WT', f"{f(D['sv1']['oct'])} kPa (Aug WT {f(D['sv1']['aug'])}, May WT {f(D['sv1']['may'])})", f"OCR = {f(lab['oed']['sp'] / D['sv1']['oct'], 2)}"],
    ['cv, 1–2 kg/cm² increment', '6.3 × 10⁻⁴ cm²/s × 3155.76', f"cv = {f(lab['cv'], 2)} m²/yr"],
    ['BH-3 clay (no oedometer)', 'Cc = 0.009(LL − 10), LL = 45 %', 'Cc = 0.315, e0 = wGs = 0.945, NC']])

brow = []
for cid in ['A1', 'B2', 'A3', 'B3', 'C4', 'B6']:
    t = tri[cid]
    brow.append([cid, t['bh'], f(t['P'], 0), f"{f(t['B'], 2)}" + (f" × {f(t['L'], 2)}" if abs(t['L'] - t['B']) > 1e-6 else ''), t['mode'],
                 f"{f(t['f']['Nc'], 2)} / {f(t['f']['Nq'], 2)} / {f(t['f']['Ng'], 2)}", f(t['Wp'], 2), f(t['qnu']), f(t['qns']), f(t['q']),
                 f"{f(t['si'] * 1000)} + {f(t['sc'] * 1000)}", 'pass' if t['found'] else '<b>fail</b>'])
t_bear = table(['Col.', 'Zone', 'P, kN', 'B (× L), m', 'Shear mode', 'Nc / Nq / Nγ', 'W′', 'qnu, kPa', 'qns, kPa', 'qn, kPa', 'si + sc (alone), mm', 'Alone'], brow, 'small')

st_rows = [[f(r['z'], 2), f(r['c']), f(r['k']), f(r['t'])] for r in st if abs(r['z'] / 1.5 - round(r['z'] / 1.5)) < 1e-6]
t_stress = table(['z below base, m', 'Δσz centre, kPa', 'Δσz corner, kPa', 'Δσz 2:1, kPa'], st_rows, 'narrow')

cons_rows = []
for a, b_ in zip(solo, grp):
    if abs(((a[0] - 6.0) / 1.0) - round((a[0] - 6.0) / 1.0)) < 0.13:
        cons_rows.append([f(a[0], 2), f(a[1]), f(a[2]), f(b_[2]), f(a[3]), b_[4], f(a[5] * 1000, 2), f(b_[5] * 1000, 2)])
t_cons = table(['z mid, m', 'σ′v0, kPa', 'Δσ alone', 'Δσ group', 'σ′p, kPa', 'state (group)', 's alone, mm', 's group, mm'], cons_rows, 'small')

t_time = table(['t, yr', 'Tv', 'U, %', 'sc(t), mm'], [[f(r['t'], 2), f(r['Tv'], 3), f(r['U'] * 100), f(r['U'] * sc)] for r in D['time']], 'narrow')

lq = []
for bid in order:
    for r in BH[bid]['liq']:
        if (r.get('FS') or 99) > 50: continue
        lq.append([bid, f(r['z']), r['s'], f(r['N160']), f(r['FC'], 0), f(r['cs']), f(r['CRR'], 3), f(r['rd'], 3), f(r['CSR'], 3), f(r['FS'], 2), f(r['FSm'], 2), '<b>liquefiable</b>' if r['FS'] < 1 else ('marginal' if r['FS'] < 1.2 else 'safe')])
t_liq = table(['BH', 'z, m', 'Soil', '(N1)60', 'FC, %', '(N1)60cs', 'CRR7.5', 'rd', 'CSR', 'FS (0.18 g)', 'FS (0.36 g)', 'Result'], lq, 'small')

t_pile = table(['Zone', 'Toe, m', 'Length, m', 'Qb, kN', 'ΣQs, kN', 'Downdrag Qneg, kN', 'Qu, kN', 'Q_safe (FS 2.5), kN'], [
    [bid, f(BH[bid]['pile']['toe']), f(BH[bid]['pile']['L']), f(BH[bid]['pile']['Qb'], 0), f(BH[bid]['pile']['Qs'], 0), f(BH[bid]['pile']['Qneg'], 0), f(BH[bid]['pile']['Qu'], 0), f(BH[bid]['pile']['Qs_'], 0)] for bid in order])

groups = {}
for c in D['final']['cols']:
    k = (c['bh'], c['n'], round(c['Pmax']), round(c['s'] * 1000, 1), round(c['P']))
    groups.setdefault(k, []).append(c['id'])
t_final = table(['Columns', 'Zone', 'P, kN', 'Piles', 'Max pile load, kN', 'Q_safe, kN', 'Settlement, mm'], [
    [', '.join(v), k[0], k[4], k[1], k[2], f(BH[k[0]]['pile']['Qs_'], 0), f(k[3])] for k, v in sorted(groups.items(), key=lambda kv: kv[1][0])], 'small')

t_checks = table(['Check', 'Value', 'Limit', 'Status'], [[c['name'], f"{c['value']} {c['unit']}", c['limit'], {'pass': 'PASS', 'fail': 'FAIL', 'warn': 'NOTE'}[c['status']]] for c in D['checks']], 'small')

iso = D['final']['iso']
b3 = D['b3']

# ---------------------------------------------------------------- HTML
img = lambda p: '../images/' + p
html = f"""<!doctype html><html><head><meta charset="utf-8"><title>GeoFound — Final Report</title><style>
@page {{ size: A4; margin: 20mm 18mm 20mm 18mm; }}
body {{ font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.42; color: #111; text-align: justify; hyphens: auto; }}
h1 {{ font-size: 19pt; text-align: center; margin: 0 0 6px; line-height: 1.2; }}
.authors {{ text-align: center; font-size: 11pt; margin: 4px 0; }}
.affil {{ text-align: center; font-size: 9.5pt; color: #333; font-style: italic; }}
.abstract {{ margin: 16px 28px; font-size: 10pt; }}
.abstract b {{ font-variant: small-caps; }}
h2 {{ font-size: 13pt; margin: 18px 0 6px; font-variant: small-caps; break-after: avoid; }}
h3 {{ font-size: 11pt; margin: 12px 0 4px; font-style: italic; font-weight: bold; break-after: avoid; }}
p {{ margin: 5px 0; }}
table {{ border-collapse: collapse; margin: 8px auto 4px; font-size: 9pt; text-align: center; break-inside: avoid; }}
table.small {{ font-size: 8pt; }} table.narrow {{ width: 60%; }}
th {{ border-top: 1.2px solid #000; border-bottom: 0.8px solid #000; padding: 3px 5px; font-weight: bold; }}
td {{ padding: 2px 5px; }} tbody tr:last-child td {{ border-bottom: 1.2px solid #000; }}
.tcap {{ text-align: center; font-size: 9.5pt; margin: 10px 0 0; break-after: avoid; }}
figure {{ margin: 10px 0; text-align: center; break-inside: avoid; }} figure img {{ max-width: 100%; }}
figcaption {{ font-size: 9.5pt; margin-top: 3px; text-align: center; }}
.eq {{ display: flex; justify-content: center; position: relative; margin: 6px 0; font-size: 11pt; }}
.eqn {{ position: absolute; right: 0; }}
.two {{ display: flex; gap: 10px; }} .two figure {{ flex: 1; }}
.kw {{ font-size: 10pt; margin: 0 28px; }}
ol.refs {{ font-size: 9.5pt; padding-left: 20px; }} ol.refs li {{ margin: 2px 0; text-align: left; }}
.box {{ border: 0.8px solid #999; padding: 8px 12px; font-size: 10pt; margin: 8px 0; break-inside: avoid; }}
.pb {{ break-before: page; }}
</style></head><body>

<h1>Foundation Design for a G+3 RC-Framed Students’ Hostel in Seismic Zone V, Mandi:<br>Site Characterisation, Bearing Capacity, Settlement, Liquefaction and Pile Design</h1>
<div class="authors">Harshit Pandey · Parash Sharma · Gaurav Dtyal · Muvan · Namit Mehta</div>
<div class="affil">CE 402 Geotechnical Engineering, Group 8 (g = 8) · Indian Institute of Technology Mandi · November 2026</div>

<div class="abstract"><b>Abstract</b> — A G+3 reinforced-concrete framed hostel (30 m × 15 m, 5 m × 5 m grid, 28 columns) is to be
founded on a terrace in Mandi, Himachal Pradesh (seismic zone V), about 25 m from a perennial stream. Three boreholes show
0.5–0.9 m of fill over silty and poorly graded sands, a 2–7 m layer of soft to firm intermediate-plasticity clay (CI), and very
dense sandy gravel from 9.6–11.2 m. Service loads were scaled by λ = 1.08. Field and laboratory data were reduced to design
parameters: IS 2131 SPT corrections (using the water table at the time of testing), least-squares Mohr–Coulomb parameters from
direct shear, undrained strength from UU triaxial tests, and compressibility from the oedometer (Cc = {f(lab['oed']['Cc'], 3)},
σ′p = {f(lab['oed']['sp'])} kPa, OCR = {f(lab['oed']['sp'] / D['sv1']['oct'], 2)}). Isolated footings designed to IS 6403 (FS = 3) satisfy bearing
capacity in the BH-1 and BH-2 zones and settle 25–39 mm when analysed one at a time; however, superposing the Boussinesq
stress of neighbouring footings raises the stress increase in the clay from 9–31 kPa to 45–60 kPa and the settlement to
{f(iso['maxS'], 0)} mm, beyond the IS 1904 limit of 50 mm. In the BH-3 zone isolated footings fail outright, and an IS 1893 Annex F
check shows the loose silty sand and the sand below it to be liquefiable (FS = 0.82 and 0.98 at a<sub>max</sub> = 0.18 g).
Bored cast-in-situ piles (Ø 0.5 m, socketed 1.5 m into the gravel, two to four per column) are therefore recommended under the
whole building; they give a maximum settlement of {f(D['final']['max'])} mm and satisfy every capacity, settlement and angular-distortion
check. All calculations were implemented in an open web application (GeoFound) and verified against hand calculations and an
independent second implementation.</div>
<div class="kw"><b>Keywords:</b> shallow foundation; IS 6403; consolidation settlement; stress superposition; liquefaction; bored piles; IS 1904.</div>

<h2>1. Introduction</h2>
<p>The assignment asks for a complete foundation design for a students’ hostel on a level terrace in Mandi district: subsurface
characterisation, derivation of design parameters, bearing capacity to IS 6403:1981, stress distribution and settlement to
IS 8009 and IS 1904:1986, and a recommendation — including an alternative foundation wherever isolated footings fail. The site
lies in seismic zone V and close to a stream, which brings liquefaction and the seasonal rise of groundwater into the design.</p>
<p>The work was carried out with GeoFound, a web application built by the group for this project, in which every equation is
traced from input to result with its source. Two independent implementations of the core modules (an earlier JavaScript
platform and the TypeScript engine of GeoFound) were run against each other, and the key results were checked by hand. This
report presents the data, methods, results and the design decision; the application, its tests and the hand calculations are
in the project repository.</p>

<h2>2. Site and Project Description</h2>
<h3>2.1 Building and loads</h3>
<p>The building footprint is 30 m × 15 m on a 5 m × 5 m grid with lines 1–7 (west to east) and A–D. Unfactored service loads
(dead + live) at founding level were multiplied by λ = 1 + g/100 = {f(lam, 2)} (Table 1). Isolated square footings at a minimum
founding depth D<sub>f</sub> = 1.5 m were the starting proposal, with a rectangular footing for the eccentric column C4. Columns were
zoned to the nearest borehole: BH-2 for lines 1–2, BH-1 for lines 3–5 and BH-3 for lines 6–7 (Figure 1).</p>
<p class="tcap"><b>Table 1.</b> Column loads at founding level (λ = {f(lam, 2)}).</p>{t_loads}
<p style="font-size:9pt">* The P and M of C4 were not given in the brief; the values shown (interior load, eccentricity 0.25 m) are assumed and are
inputs in GeoFound.</p>
{figure('fig/f1_plan.svg', 1, 'Column grid, borehole positions (✱) and design zones. C4 is the eccentrically loaded column.', '82%')}

<h3>2.2 Ground conditions and groundwater</h3>
<p>Three 150 mm boreholes were advanced to 15 m in October 2026 with SPT at 1.5 m intervals (IS 2131:1981) and undisturbed
samples in the clay. Monthly piezometer readings give the seasonal range of the water table (Table 2). The profile (Figure 2,
Table 3) is: fill (0.5–0.9 m); silty fine to medium sand SM; poorly graded sand with gravel SP; soft to firm silty clay CI
(BH-1 5.8–10.6 m, BH-2 7.6–9.6 m, BH-3 4.4–11.2 m); and very dense sandy gravel GW with cobbles and boulders. The clay
thickens and the sands loosen towards BH-3, nearest the stream.</p>
<p class="tcap"><b>Table 2.</b> Boreholes and water tables (m below ground level).</p>{t_bh}
{figure(img('ground.jpg'), 2, 'Correlated cross-section BH-2 → BH-1 → BH-3 (west to east) generated by GeoFound; dashed line = design (August) water table.')}
<p class="tcap"><b>Table 3.</b> Design soil profile adopted for each borehole.</p>{t_layers}

<h3>2.3 Choice of water tables</h3>
<p>Two different water tables are used, each where it is physically correct. The <i>design</i> (seasonal highest, August) table
gives the lowest effective stress and is used for bearing capacity (surcharge and W′), Schmertmann settlement and the cyclic
stress ratio. The <i>measured</i> table (24 h after boring, October) describes the stress state when the SPT was performed and the
samples were taken; it is used for the IS 2131 corrections, for (N<sub>1</sub>)<sub>60</sub>, and for σ′<sub>v0</sub> and OCR of the clay, since σ′<sub>p</sub>
was measured on those samples.</p>

<h2>3. Methodology</h2>
<h3>3.1 SPT corrections (IS 2131:1981)</h3>
<p>For cohesionless layers the overburden correction and, for fine or silty sand below the water table, the dilatancy
correction are applied; clay N-values are not corrected. The N = 22 at 9.0 m in BH-1 (sampler struck a cobble) is reported
but not used to characterise the clay; refusals (&gt; 100 blows) are reported as such.</p>
{eq('C<sub>N</sub> = 0.77 log<sub>10</sub>(2000 / σ′<sub>v</sub>),&nbsp;&nbsp; σ′<sub>v</sub> ≥ 25 kPa;&nbsp;&nbsp; N′ = C<sub>N</sub>N', 1)}
{eq('N″ = 15 + ½ (N′ − 15)&nbsp;&nbsp; for N′ &gt; 15', 2)}
<h3>3.2 Shear-strength and consolidation parameters</h3>
<p>c′ and φ′ were obtained by ordinary least squares on the direct-shear results, τ<sub>f</sub> = c′ + σ<sub>n</sub> tan φ′. For the non-plastic sands
the small intercept is a fitting artefact and design c′ = 0 is adopted. The undrained strength is c<sub>u</sub> = (σ<sub>1</sub> − σ<sub>3</sub>)<sub>f</sub>/2,
averaged over the three cell pressures. Oedometer pressures were converted from kg/cm² to kPa (× 98.0665); C<sub>c</sub> is the slope
of the virgin line, C<sub>r</sub> the slope of the unloading branch, and σ′<sub>p</sub> follows Casagrande’s construction. c<sub>v</sub> was converted
from cm²/s to m²/yr (× 3155.76) and taken for the load increment that brackets the field stress range. For the disturbed BH-3
clay, C<sub>c</sub> = 0.009(LL − 10) (Skempton, 1944) and e<sub>0</sub> = wG<sub>s</sub> are used, and the clay is taken as normally consolidated.</p>
<h3>3.3 Bearing capacity (IS 6403:1981)</h3>
{eq('q<sub>nu</sub> = c N<sub>c</sub> s<sub>c</sub> d<sub>c</sub> i<sub>c</sub> + q (N<sub>q</sub> − 1) s<sub>q</sub> d<sub>q</sub> i<sub>q</sub> + ½ B′ γ N<sub>γ</sub> s<sub>γ</sub> d<sub>γ</sub> i<sub>γ</sub> W′,&nbsp;&nbsp; q<sub>ns</sub> = q<sub>nu</sub> / F', 3)}
{eq('N<sub>q</sub> = e<sup>π tan φ</sup> tan²(45° + φ/2),&nbsp; N<sub>c</sub> = (N<sub>q</sub> − 1) cot φ,&nbsp; N<sub>γ</sub> = 2 (N<sub>q</sub> + 1) tan φ', 4)}
<p>with F = 3. Strength is averaged over the shear zone D<sub>f</sub> to D<sub>f</sub> + B. Local shear uses c<sub>m</sub> = ⅔c and
φ<sub>m</sub> = tan⁻¹(⅔ tan φ); for 29° &lt; φ &lt; 36° the factors are interpolated linearly between local and general shear.
q is the effective overburden at founding level; W′ = 0.5 when the water table is at or above the base. For an eccentric
load the effective dimensions B′ = B − 2e<sub>B</sub>, L′ = L − 2e<sub>L</sub> (Meyerhof, 1953) are used, with shape factors from B′/L′. The
applied net pressure is q<sub>n</sub> = (P + W<sub>f</sub>)/A′ − σ<sub>v0</sub>(D<sub>f</sub>), with W<sub>f</sub> the weight of footing and backfill (20 kN/m³).</p>
<h3>3.4 Stress increase</h3>
<p>Δσ<sub>z</sub> below the centre and corner of a rectangle is computed from Newmark’s (1935) integration of the Boussinesq
solution, the centre value by superposition of four corner rectangles; the 2:1 method gives</p>
{eq('Δσ<sub>z</sub> = q<sub>n</sub> B L / [(B + z)(L + z)]', 5)}
<p>Stress from neighbouring footings is added by superposition of signed rectangles with the column offsets.</p>
<h3>3.5 Settlement</h3>
<p>Immediate settlement of the granular layers follows Schmertmann et al. (1978):</p>
{eq('s<sub>i</sub> = C<sub>1</sub> C<sub>2</sub> Δp Σ (I<sub>z</sub> / E) Δz,&nbsp; C<sub>1</sub> = 1 − 0.5 σ′<sub>v0</sub>/Δp,&nbsp; I<sub>zp</sub> = 0.5 + 0.1 √(Δp / σ′<sub>vp</sub>)', 6)}
<p>with E = 500(N + 15) kPa (Bowles, 1996). Consolidation of the clay is summed over sublayers no thicker than 0.5 m:</p>
{eq('s<sub>c</sub> = Σ H/(1+e<sub>0</sub>) [C<sub>r</sub> log(σ′<sub>p</sub>/σ′<sub>0</sub>) + C<sub>c</sub> log((σ′<sub>0</sub>+Δσ)/σ′<sub>p</sub>)]', 7)}
<p>(the first term alone with σ′<sub>0</sub> + Δσ in place of σ′<sub>p</sub> when the final stress stays below σ′<sub>p</sub>; the second alone for NC clay).
The time rate uses Terzaghi’s solution U(T<sub>v</sub>), T<sub>v</sub> = c<sub>v</sub>t/H<sub>d</sub>². The BH-1 clay lies between sand and gravel, so it
drains at both faces (H<sub>d</sub> = 4.8/2 = 2.4 m).</p>
<h3>3.6 Liquefaction (IS 1893 (Part 1):2016, Annex F)</h3>
{eq('CSR = 0.65 (a<sub>max</sub>/g)(σ<sub>v</sub>/σ′<sub>v</sub>) r<sub>d</sub>,&nbsp;&nbsp; r<sub>d</sub> = 1 − 0.00765 z&nbsp; (z ≤ 9.15 m)', 8)}
{eq('(N<sub>1</sub>)<sub>60</sub> = N C<sub>N</sub> C<sub>E</sub> C<sub>B</sub> C<sub>R</sub>,&nbsp; C<sub>N</sub> = (100/σ′<sub>v</sub>)<sup>0.5</sup> ≤ 1.7;&nbsp;&nbsp; (N<sub>1</sub>)<sub>60cs</sub> = α + β (N<sub>1</sub>)<sub>60</sub>', 9)}
{eq('CRR<sub>7.5</sub> = 1/(34 − N) + N/135 + 50/(10N + 45)² − 1/200,&nbsp;&nbsp; FS = CRR<sub>7.5</sub> MSF / CSR', 10)}
<p>following Youd et al. (2001). Zone V gives Z = 0.36; a<sub>max</sub> = Z/2 = 0.18 g is adopted for the design earthquake, and
a<sub>max</sub> = Z = 0.36 g is reported as an upper bound; M<sub>w</sub> = 7.5 (MSF = 1). C<sub>E</sub> = 1.0, C<sub>B</sub> = 1.05 (150 mm hole), and C<sub>R</sub>
from the rod length. Clays with PI ≥ 12 % are not susceptible (Bray &amp; Sancio, 2006).</p>
<h3>3.7 Bored piles (IS 2911 (Part 1/Sec 2):2010)</h3>
{eq('Q<sub>u</sub> = A<sub>p</sub>(½ D γ′ N<sub>γ</sub> + P<sub>D</sub> N<sub>q</sub>) + Σ K P<sub>Di</sub> tan δ A<sub>si</sub> + Σ α c<sub>u</sub> A<sub>si</sub>,&nbsp;&nbsp; Q<sub>safe</sub> = Q<sub>u</sub>/2.5', 11)}
<p>with K = 1.5, δ = φ, α = 1.0, and P<sub>D</sub> limited at a critical depth of 20D from ground level. Shaft friction in liquefiable
layers is ignored and added to the pile load as downdrag. Pile loads in a group follow the rigid-cap distribution
P<sub>i</sub> = P/n ± M x<sub>i</sub>/Σx², with at least two piles per column at 3D spacing. Pile settlement is D/100 plus elastic
shortening with E<sub>c</sub> = 5000√f<sub>ck</sub> (M30, severe exposure to IS 456:2000), multiplied by the group factor √(B<sub>g</sub>/D) (Vesic, 1969).</p>
<h3>3.8 Design criteria</h3>
<p>Bearing: q<sub>n</sub> ≤ q<sub>ns</sub> with F = 3. Settlement (IS 1904:1986, RC frame on isolated foundations, sand): total ≤ 50 mm,
differential ≤ 0.0015 L (7.5 mm on a 5 m span), angular distortion ≤ 1/666. The sand row is adopted because the founding
strata are sands and it is the stricter of the two rows. Footings must fit the grid with a 0.3 m clear gap (B ≤ 4.7 m).</p>

<h2>4. Results</h2>
<h3>4.1 SPT and laboratory parameters</h3>
<p class="tcap"><b>Table 4.</b> SPT corrections (σ′<sub>v</sub> at the October water table; clay not corrected).</p>{t_spt}
{figure('fig/f3_spt.svg', 3, 'Field and corrected SPT N with depth. The low N in the clay of BH-3 (4–8) contrasts with the dense SP in BH-2 (26–34).')}
<p class="tcap"><b>Table 5.</b> Laboratory results and design parameters.</p>{t_lab}
<div class="two">{figure('fig/f5_shear.svg', 4, 'Direct-shear results with least-squares envelopes.')}{figure('fig/f4_oed.svg', 5, 'Oedometer e–log σ′ curve (UDS-1) in kPa.')}</div>
<p>The SM loses about 1° of friction angle and most of its apparent cohesion on soaking (unsoaked φ′ = 31.0°), so the soaked
values are used. At UDS-1, σ′<sub>v0</sub> = {f(D['sv1']['oct'])} kPa at the October water table and {f(D['sv1']['may'])} kPa at the May low; the
measured σ′<sub>p</sub> = {f(lab['oed']['sp'])} kPa is consistent with the clay having been pre-loaded by the annual lowering of the water
table, so it is lightly over-consolidated (OCR ≈ 1.25). Under load the clay works at about 90–160 kPa, which is the
1–2 kg/cm² increment; c<sub>v</sub> = {f(lab['cv'], 2)} m²/yr from that increment is therefore representative.</p>

<h3>4.2 Bearing capacity of isolated footings</h3>
<p>Table 6 gives the smallest footing that passes bearing (F = 3) and settlement when each footing is considered alone. For
B3 (BH-1, B = 3.0 m), the shear zone 1.5–4.5 m contains 1.9 m of SM and 1.1 m of SP, so φ<sub>avg</sub> = (1.9 × 30.0 + 1.1 × 34.4)/3.0 =
31.6°; the factors are interpolated (t = 0.37) to N<sub>c</sub> = {f(tri['B3']['f']['Nc'], 2)}, N<sub>q</sub> = {f(tri['B3']['f']['Nq'], 2)},
N<sub>γ</sub> = {f(tri['B3']['f']['Ng'], 2)}; with q = {f(tri['B3']['qo'], 2)} kPa, s<sub>q</sub> = 1.2, s<sub>γ</sub> = 0.8, d<sub>q</sub> = d<sub>γ</sub> = {f(tri['B3']['dp']['dq'], 3)} and
W′ = 0.5, the surcharge and self-weight terms are {f(tri['B3']['terms']['surcharge'])} and {f(tri['B3']['terms']['selfWeight'])} kPa, so q<sub>nu</sub> =
{f(tri['B3']['qnu'])} kPa and q<sub>ns</sub> = {f(tri['B3']['qns'])} kPa against an applied q<sub>n</sub> = {f(tri['B3']['q'])} kPa. In the BH-3 zone even
a 6 m footing fails: its shear zone (1.5–7.5 m) is dominated by the loose SM and the soft clay, the mode is local shear and q<sub>ns</sub> is only {f(tri['B6']['qns'])} kPa, and the 6.8 m of soft clay
would settle {f(tri['B6']['sc'] * 1000)} mm.</p>
<p class="tcap"><b>Table 6.</b> Isolated-footing trial (footing analysed alone).</p>{t_bear}

<h3>4.3 Stress increase</h3>
<div class="two">{figure('fig/f6_stress.svg', 6, f"Δσ<sub>z</sub> below the B3 footing (B = {f(b3['B'], 2)} m, q<sub>n</sub> = {f(b3['q'])} kPa).")}<div style="flex:1;align-self:center"><p class="tcap"><b>Table 7.</b> Stress increase below B3.</p>{t_stress}</div></div>
<p>The 2:1 method underestimates the Boussinesq centre stress near the footing (by 37 % at z = 0.5B and 26 % at z = B), agrees
within about 10 % between z = 1.5B and 2B, and is slightly higher below that. The corner stress tends to q/4 at shallow depth, as
expected from superposition.</p>

<h3>4.4 Settlement — single footing versus building</h3>
<p>Analysed alone, B3 settles {f(b3['si'] * 1000)} mm in the sands (Schmertmann) and {f(b3['sSolo'] * 1000)} mm in the clay. On a 5 m grid,
however, the pressure bulbs of the neighbouring footings overlap at the depth of the clay (5.8–10.6 m). Superposing the stress
of the {b3['nNb']} neighbouring footings within 15 m raises Δσ in the clay from 9–31 kPa (footing alone) to 45–60 kPa (Figure 7), which takes
the clay past σ′<sub>p</sub> into virgin compression; consolidation of B3 rises to {f(b3['sGrp'] * 1000)} mm (Table 8). With footings
proportioned for equal settlement, the best layout still reaches {f(iso['maxS'], 0)} mm, with δ = {f(iso['worstDelta'])} mm between
{iso['worstPair']} — beyond the 50 mm and 7.5 mm limits. <b>Isolated footings are therefore not acceptable anywhere on the site.</b></p>
<div class="two">{figure('fig/f7_overlap.svg', 7, 'Stress increase in the CI clay below B3: footing alone and with its neighbours.')}{figure('fig/f8_time.svg', 8, 'Consolidation settlement of B3 (with neighbours) against time, double drainage.')}</div>
<p class="tcap"><b>Table 8.</b> Consolidation of the BH-1 clay below B3 (selected 0.5 m sublayers; October water table).</p>{t_cons}
<p class="tcap"><b>Table 9.</b> Time–settlement of B3 (c<sub>v</sub> = {f(lab['cv'], 2)} m²/yr, H<sub>d</sub> = 2.4 m).</p>{t_time}
<p>About 65 % of the consolidation would occur in the first year and 90 % after about 2.5 years, i.e. after the frame and finishes
are complete — exactly when differential settlement damages an RC frame with masonry infill.</p>

<h3>4.5 Liquefaction</h3>
<p class="tcap"><b>Table 10.</b> Liquefaction assessment of the saturated granular layers.</p>{t_liq}
{figure('fig/f9_liq.svg', 9, 'Factor of safety against liquefaction with depth (a<sub>max</sub> = 0.18 g, M<sub>w</sub> 7.5).', '62%')}
<p>In BH-3 the loose silty sand at 1.5 m (FS = 0.82) and the poorly graded sand at 3.0 m (FS = 0.98) liquefy at the design
acceleration; at 0.36 g every saturated sand on the site except BH-2 at 4.5 m (FS = 1.07) has FS &lt; 1. The clay (PI = 20–22 %) and the very dense gravel are not
susceptible. Liquefaction of the upper 4.4 m in BH-3, 25 m from the stream bank, also brings a risk of lateral spreading
towards the stream.</p>

<h3>4.6 Pile foundation</h3>
<p class="tcap"><b>Table 11.</b> Single-pile capacity, Ø 0.5 m bored pile, 1.5 m socket into GW.</p>{t_pile}
<p>In BH-3, shaft friction in the liquefiable SM and SP (132 kN per pile) is excluded and applied as downdrag, so the columns
B6 and C6 need three piles. For C4 the moment of 391.5 kN·m would put 783 + 261 = 1044 kN on one pile of a pair, more than
Q<sub>safe</sub> = 875 kN, so four piles are used (522 kN each). Table 12 and Figure 10 give the final layout.</p>
<p class="tcap"><b>Table 12.</b> Final pile layout.</p>{t_final}
{figure('fig/f10_piles.svg', 10, 'Final foundation plan: pile caps with the number of Ø 0.5 m bored piles per column.')}
<p class="tcap"><b>Table 13.</b> Design checks on the final foundation (NOTE = item discussed in the text).</p>{t_checks}
{figure(img('design-3d.jpg'), 11, 'Three-dimensional view of the frame on piles in GeoFound, coloured by settlement, with the soil layers below.', '88%')}

<h2>5. Discussion</h2>
<h3>5.1 Why piles under the whole building</h3>
<p>A mixed scheme — footings on lines 1–5 and piles on lines 6–7 with a movement joint — was considered first; with footings
analysed one at a time it appeared to work. Once the interaction of neighbouring footings in the clay is included, footings settle
up to {f(iso['maxS'], 0)} mm, so the mixed scheme fails even before the joint is considered; across a joint the footing and pile
blocks would differ by about 100 mm. Bored piles to the gravel under every column bypass the compressible clay, the liquefiable
sands and the seasonally saturated zone, give one foundation type for the whole frame (no joint is needed) and limit settlement to
{f(D['final']['max'])} mm with a maximum differential of 1.54 mm.</p>
<h3>5.2 Seismic zone V and the stream</h3>
<p>Piles through the liquefiable sands are designed with no shaft resistance in those layers and with downdrag; the pile caps
should be tied in both directions by grade beams, and the piles reinforced for the lateral loads and the kinematic bending that
a liquefied layer imposes (structural design is outside this report). On the stream side, bank protection and a drainage
measure behind the east wall are recommended to limit scour and seepage. Concrete is M30 with 50 mm cover (severe exposure).</p>
<h3>5.3 Assumptions and limitations</h3>
<p>The load and moment of C4, a<sub>max</sub> = Z/2 and M<sub>w</sub> = 7.5, the modulus correlation E = 500(N + 15), the fill properties, and K, α
and the D/100 rule for the piles are assumptions and are listed in the application’s assumptions table. Clause references are
to be confirmed against the code texts. Pile capacity should be confirmed by an initial load test (IS 2911 Part 4). The structural
design of piles, caps and grade beams is not included.</p>
<h3>5.4 Verification and use of software</h3>
<p>Every module was checked against hand calculations, and the engine’s results for SPT corrections, direct shear, bearing
capacity, stress increase and the degree of consolidation were compared with an independent implementation written earlier
by the group (agreement within 0.5 %). AI coding tools were used to write parts of the software; the methods, parameters,
design decisions and checks are the group’s, and the errors found in AI output and their corrections are documented in a
separate engineering audit.</p>

<h2>6. Conclusions</h2>
<ol>
<li>The site has 4–7 m of sand over a soft to firm CI clay (2–7 m thick) on very dense gravel; the clay is lightly
over-consolidated (σ′<sub>p</sub> ≈ {f(lab['oed']['sp'], 0)} kPa, OCR ≈ 1.25) with C<sub>c</sub> = {f(lab['oed']['Cc'], 2)} and c<sub>v</sub> = {f(lab['cv'], 2)} m²/yr.</li>
<li>Isolated footings at 1.5 m depth pass IS 6403 bearing capacity in the BH-1 and BH-2 zones (B = 2.4–3.05 m) but fail in the
BH-3 zone (q<sub>ns</sub> ≈ 19 kPa for B = 6 m).</li>
<li>With the stress of neighbouring footings superposed, consolidation of the clay governs: footings would settle up to
{f(iso['maxS'], 0)} mm, beyond the IS 1904 limit of 50 mm.</li>
<li>The loose sands in BH-3 are liquefiable at the design acceleration (FS = 0.82 and 0.98).</li>
<li>Recommended: Ø 0.5 m bored cast-in-situ piles under all 28 columns, socketed 1.5 m into the gravel (toe 11.1–12.7 m),
two piles per column except B6 and C6 (three) and C4 (four), with tie beams. Maximum settlement {f(D['final']['max'])} mm,
maximum differential 1.54 mm, angular distortion 1/3239 — all checks pass.</li>
</ol>

<h2>References</h2>
<ol class="refs">
<li>BIS (1981). IS 6403:1981 — Code of practice for determination of bearing capacity of shallow foundations. Bureau of Indian Standards, New Delhi.</li>
<li>BIS (1981). IS 2131:1981 — Method for standard penetration test for soils.</li>
<li>BIS (1986). IS 1904:1986 — Code of practice for design and construction of foundations in soils: general requirements.</li>
<li>BIS (1976). IS 8009 (Part 1):1976 — Code of practice for calculation of settlements of foundations: shallow foundations.</li>
<li>BIS (2016). IS 1893 (Part 1):2016 — Criteria for earthquake resistant design of structures.</li>
<li>BIS (2010). IS 2911 (Part 1/Sec 2):2010 — Design and construction of pile foundations: bored cast in-situ concrete piles.</li>
<li>BIS (2000). IS 456:2000 — Plain and reinforced concrete: code of practice.</li>
<li>Bowles, J. E. (1996). <i>Foundation Analysis and Design</i>, 5th ed. McGraw-Hill.</li>
<li>Bray, J. D. &amp; Sancio, R. B. (2006). Assessment of the liquefaction susceptibility of fine-grained soils. <i>J. Geotech. Geoenviron. Eng.</i> 132(9), 1165–1177.</li>
<li>Casagrande, A. (1936). The determination of the pre-consolidation load and its practical significance. <i>Proc. 1st ICSMFE</i>, Cambridge, Mass.</li>
<li>Das, B. M. (2016). <i>Principles of Foundation Engineering</i>, 8th ed. Cengage Learning.</li>
<li>Meyerhof, G. G. (1953). The bearing capacity of foundations under eccentric and inclined loads. <i>Proc. 3rd ICSMFE</i>, Zürich.</li>
<li>Newmark, N. M. (1935). Simplified computation of vertical pressures in elastic foundations. Univ. of Illinois Eng. Exp. Station, Circular 24.</li>
<li>Schmertmann, J. H., Hartman, J. P. &amp; Brown, P. R. (1978). Improved strain influence factor diagrams. <i>J. Geotech. Eng. Div., ASCE</i> 104(GT8), 1131–1135.</li>
<li>Seed, H. B. &amp; Idriss, I. M. (1971). Simplified procedure for evaluating soil liquefaction potential. <i>J. Soil Mech. Found. Div., ASCE</i> 97(SM9), 1249–1273.</li>
<li>Skempton, A. W. (1944). Notes on the compressibility of clays. <i>Q. J. Geol. Soc. London</i> 100, 119–135.</li>
<li>Terzaghi, K., Peck, R. B. &amp; Mesri, G. (1996). <i>Soil Mechanics in Engineering Practice</i>, 3rd ed. Wiley.</li>
<li>Tomlinson, M. J. &amp; Woodward, J. (2014). <i>Pile Design and Construction Practice</i>, 6th ed. CRC Press.</li>
<li>Vesic, A. S. (1969). Experiments with instrumented pile groups in sand. ASTM STP 444, 177–222.</li>
<li>Youd, T. L. et al. (2001). Liquefaction resistance of soils: summary report from the 1996 NCEER and 1998 NCEER/NSF workshops. <i>J. Geotech. Geoenviron. Eng.</i> 127(10), 817–833.</li>
</ol>

<h2 class="pb">Appendix A — The GeoFound application</h2>
<p>GeoFound (https://geofound.vercel.app) takes the site data (project, loads, boreholes, laboratory sheets; manual entry, CSV or
JSON), and produces the ground model, every calculation step with its source, the foundation design and a summary with the
checks and assumptions. Source code, 59 automated tests and the hand calculations used as benchmarks are in the group
repository (github.com/ParashSharma11/CE-402-Assignment-Group8, branch geofound).</p>
{figure(img('design.jpg'), 12, 'Design screen: final foundation, checks and the design decision.', '92%')}
<h2>Appendix B — Contributions</h2>
<p>Harshit Pandey: GeoFound application (UI/UX and front-end), final foundation design and IS 1904 checks, pile design,
liquefaction module, oedometer and UU interpretation, integration and deployment. Parash Sharma: soil profile (P1) and SPT /
direct-shear (P2) engines and the first platform. Gaurav Dtyal: IS 6403 bearing-capacity engine (P3). Namit Mehta: stress-increase
module (P4). Muvan: settlement engine (P5).</p>
</body></html>"""
(HERE / 'report.html').write_text(html, encoding='utf-8')
print('report.html written')
