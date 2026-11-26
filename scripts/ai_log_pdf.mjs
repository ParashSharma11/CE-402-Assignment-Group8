import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const [, , htmlPath, pdfPath] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.pdf({
  path: pdfPath, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial"><span>CE-402 Geotechnical Design Platform (Group 8) — AI Log &amp; Audit</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
});
await browser.close();
console.log('pdf ok');
