// Print docs/report/report.html to docs/GeoFound_Final_Report.pdf (A4, page numbers).
// Usage: node scripts/report_pdf.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(pathToFileURL(resolve('docs/report/report.html')).href, { waitUntil: 'load' });
await p.pdf({ path: 'docs/GeoFound_Final_Report.pdf', format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div style="width:100%;font-size:7.5px;color:#666;padding:0 18mm;font-family:Times New Roman;text-align:right">CE 402 Geotechnical Engineering — Group 8 — Foundation design, Mandi</div>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#444;text-align:center;font-family:Times New Roman"><span class="pageNumber"></span></div>',
  margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' } });
await b.close(); console.log('pdf ok');
