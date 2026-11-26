import markdown, pathlib, sys
root = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
md = markdown.Markdown(extensions=['tables', 'fenced_code', 'sane_lists'])
log = md.convert((root / 'AI_LOG.md').read_text(encoding='utf-8')); md.reset()
audit = md.convert((root / 'docs' / 'AI_AUDIT.md').read_text(encoding='utf-8'))
css = """
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; }
.kicker { color: #1d4ed8; font-weight: 700; letter-spacing: .06em; font-size: 9.5pt; }
h1 { font-size: 21pt; margin: 4px 0 2px; color: #111827; }
.sub { color: #4b5563; margin: 0 0 10px; border-bottom: 3px solid #111827; padding-bottom: 10px; }
h1 + p, h1 + table { margin-top: 6px; }
h2 { font-size: 14pt; color: #111827; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 22px; }
h3 { font-size: 12pt; color: #1e3a8a; margin: 16px 0 4px; }
h3 + p > em:first-child { display: inline-block; border-left: 3px solid #1d4ed8; padding-left: 8px; color: #374151; font-style: normal; font-weight: 700; font-size: 9.5pt; }
blockquote { margin: 6px 0; padding: 6px 12px; border-left: 3px solid #93c5fd; background: #f8fafc; color: #1f2937; }
code { font-family: Consolas, 'Courier New', monospace; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px; padding: 0 3px; font-size: 9pt; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #0f172a; color: #fff; text-align: left; padding: 6px; }
td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
hr { border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0; }
.part { page-break-before: always; }
a { color: #1d4ed8; text-decoration: none; }
"""
html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="kicker">CE-402 GEOTECHNICAL ENGINEERING - GROUP 8</div>
{log}
<div class="part"></div>
{audit}
</body></html>"""
out.write_text(html, encoding='utf-8')
print('html ok')
