// Dựng bản PDF "Hướng dẫn sử dụng app cho nhân viên CiCi" từ đúng nội dung của trang web
// (src/sections/hr/guide/staff-guide-content.ts), để bản đăng ở "Nội quy & ký xác nhận" khớp với trang.
//
// Chạy (Node ≥ 22.6):
//   node --experimental-strip-types scripts/build-staff-guide-pdf.mts <thư-mục-ra>
// Cần Chrome hoặc Edge; đặt CHROME_PATH nếu không ở chỗ mặc định.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { STAFF_GUIDE } from '../src/sections/hr/guide/staff-guide-content.ts';
import type { GuideBlock } from '../src/sections/hr/guide/staff-guide-types.ts';

const outDir = resolve(process.argv[2] ?? 'staff-guide-out');
// Ảnh chụp app nằm cùng chỗ trang web dùng (public/assets/staff-guide).
const shotsDir = resolve(import.meta.dirname ?? '.', '..', 'public', 'assets', 'staff-guide');
mkdirSync(outDir, { recursive: true });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function block(b: GuideBlock): string {
  switch (b.kind) {
    case 'p':
      return `<p>${esc(b.text)}</p>`;
    case 'steps':
    case 'bullets': {
      const tag = b.kind === 'steps' ? 'ol' : 'ul';
      const title = b.title ? `<p class="bt">${esc(b.title)}</p>` : '';
      return `${title}<${tag}>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>`;
    }
    case 'table': {
      const title = b.title ? `<p class="bt">${esc(b.title)}</p>` : '';
      const head = `<tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
      const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      return `${title}<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    }
    case 'note':
      return `<div class="note ${b.tone}">${esc(b.text)}</div>`;
    case 'shots':
      return `<div class="shots">${b.items
        .map(
          (s) =>
            `<figure><img src="${pathToFileURL(join(shotsDir, s.file)).href}" alt="${esc(s.caption)}"><figcaption>${esc(s.caption)}</figcaption></figure>`
        )
        .join('')}</div>`;
    default:
      return '';
  }
}

const toc = STAFF_GUIDE.parts
  .map(
    (p) =>
      `<li><b>${esc(p.title)}</b><ul>${p.sections.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ul></li>`
  )
  .join('');

const body = STAFF_GUIDE.parts
  .map(
    (p) =>
      `<section class="part"><h2>${esc(p.title)}</h2>${p.sections
        .map(
          (s) =>
            `<div class="sec"><h3>${esc(s.title)}</h3>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}${s.blocks
              .map(block)
              .join('')}</div>`
        )
        .join('')}</section>`
  )
  .join('');

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(STAFF_GUIDE.title)}</title>
<style>
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1c252e; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 4pt; color: #0b4f6c; }
h2 { font-size: 14pt; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #0b4f6c; color: #0b4f6c; }
h3 { font-size: 11.5pt; margin: 12pt 0 4pt; }
p { margin: 0 0 5pt; }
.lead { color: #555; font-style: italic; }
.bt { font-weight: 600; margin-top: 4pt; }
ol, ul { margin: 0 0 6pt; padding-left: 18pt; }
li { margin-bottom: 2pt; }
table { width: 100%; border-collapse: collapse; margin: 2pt 0 8pt; font-size: 9.5pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #c4cdd5; padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { background: #eef4f7; }
.note { border-left: 3px solid #0b84c6; background: #f1f8fc; padding: 5pt 8pt; margin: 2pt 0 8pt; }
.note.warning { border-color: #e08a00; background: #fff6e6; }
.cover { margin-bottom: 14pt; }
.meta { color: #555; }
.toc { columns: 2; column-gap: 18pt; font-size: 9.5pt; margin: 8pt 0 0; padding-left: 14pt; }
.toc ul { padding-left: 12pt; margin: 0 0 4pt; }
.shots { display: flex; flex-wrap: wrap; gap: 8pt; margin: 4pt 0 10pt; page-break-inside: avoid; }
.shots figure { margin: 0; width: 30%; }
.shots img { width: 100%; border: 1px solid #c4cdd5; border-radius: 4pt; display: block; }
.shots figcaption { font-size: 8.5pt; color: #555; margin-top: 2pt; }
.part { page-break-before: always; }
.sec { page-break-inside: auto; }
h3 { page-break-after: avoid; }
</style></head><body>
<div class="cover">
<h1>${esc(STAFF_GUIDE.title)}</h1>
<p class="meta">${esc(STAFF_GUIDE.subtitle)} Cập nhật ngày ${esc(STAFF_GUIDE.updatedAt)}.</p>
<p class="bt">Mục lục</p><ul class="toc">${toc}</ul>
</div>
${body}
</body></html>`;

const htmlPath = join(outDir, 'huong-dan-su-dung-app-nhan-vien-cici.html');
const pdfPath = join(outDir, 'huong-dan-su-dung-app-nhan-vien-cici.pdf');
writeFileSync(htmlPath, html, 'utf8');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.log(`Không thấy Chrome/Edge; đã ghi HTML tại ${htmlPath}`);
  process.exit(0);
}

const r = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: 'inherit', timeout: 120_000 }
);
if (r.status !== 0) {
  console.error('In PDF lỗi', r.error ?? r.status);
  process.exit(1);
}
console.log(`PDF: ${pdfPath}`);
