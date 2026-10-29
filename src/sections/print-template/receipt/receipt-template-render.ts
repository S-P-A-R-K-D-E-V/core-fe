import { escapeHtml } from 'src/utils/print-html';

import { buildReceiptQr } from 'src/sections/pos/receipt-print/receipt-qr';
import { encodeBarcode } from 'src/sections/pos/label-print/barcode';
import { barcodeBars, barcodeWidthDots } from 'src/sections/pos/label-print/label-geometry';

import type { ISalesOrderReceipt } from 'src/types/corecms-api';

import {
  isItemField,
  isPaymentField,
  receiptItemValues,
  receiptScalarValues,
  receiptPaymentValues,
} from './receipt-template-fields';
import {
  contentWidthMm,
  RECEIPT_FONT_STACKS,
  RECEIPT_TEMPLATE_PAPERS,
  normalizeReceiptSettings,
} from './receipt-template-settings';

import type { ReceiptTemplateSettings } from './receipt-template-settings';

// ----------------------------------------------------------------------
// Mẫu hoá đơn (HTML có trường {{ma}}) + phiếu thanh toán → MỘT tài liệu HTML tự chứa để in (printHtmlDocument).
//
//  1. Lọc lại HTML của mẫu theo danh sách trắng (máy chủ đã lọc, đây là lớp thứ hai): tài liệu in chạy trong khung cùng
//     origin nên tuyệt đối không có script / sự kiện / tài nguyên ngoài. Chỉ giữ thẻ định dạng, bảng, kẻ ngang; CSS chỉ
//     text-align và font-size.
//  2. Lặp: các khối liền nhau (hàng bảng, mục danh sách, đoạn) chứa trường dòng hàng `item_*` được nhân bản cho từng món;
//     tương tự `payment_*` cho từng khoản thu.
//  3. Ẩn: đoạn / tiêu đề / mục / hàng bảng có trường mà MỌI trường đều rỗng thì bỏ (giảm giá = 0, chưa có mã số thuế…).
//  4. Thay trường: chữ được thoát qua DOM (text node); trường khối (mã QR, mã vạch, dấu đã huỷ) là SVG / khung do chính
//     web dựng.
// Giấy cuộn: trang rộng bằng khổ cuộn, cao theo nội dung ĐO trong một khung ẩn (driver giấy cuộn không hiểu "auto").
// ----------------------------------------------------------------------

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'SUB',
  'SUP',
  'SPAN',
  'DIV',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'COLGROUP',
  'COL',
]);

// Bỏ cả nội dung (không chỉ thẻ): mã chạy, nhúng, đồ hoạ ngoài, biểu mẫu.
const DROPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'FRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'MATH',
  'TEMPLATE',
  'NOSCRIPT',
  'LINK',
  'META',
  'TITLE',
  'HEAD',
  'IMG',
  'PICTURE',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'BASE',
  'PORTAL',
]);

const HIDEABLE = 'tr, li, p, h1, h2, h3, h4';

const FONT_SIZE = /^(\d{1,3}(?:\.\d+)?)(pt|px|em|%)$/;
const FONT_SIZE_RANGES: Record<string, [number, number]> = {
  pt: [5, 72],
  px: [6, 96],
  em: [0.3, 6],
  '%': [30, 600],
};
const TEXT_ALIGN = /^(left|center|right|justify)$/;

/** style="…" → chỉ text-align và font-size hợp lệ (cỡ chữ trong khoảng đọc được). */
function cleanStyle(style: string): string {
  const kept: string[] = [];
  style.split(';').forEach((declaration) => {
    const index = declaration.indexOf(':');
    if (index < 0) return;
    const property = declaration.slice(0, index).trim().toLowerCase();
    const value = declaration
      .slice(index + 1)
      .trim()
      .toLowerCase();
    if (property === 'text-align' && TEXT_ALIGN.test(value)) kept.push(`text-align:${value}`);
    if (property === 'font-size') {
      const match = FONT_SIZE.exec(value);
      const range = match ? FONT_SIZE_RANGES[match[2]] : null;
      const size = match ? Number(match[1]) : NaN;
      if (range && size >= range[0] && size <= range[1]) kept.push(`font-size:${value}`);
    }
  });
  return kept.join(';');
}

function sanitizeElement(element: Element) {
  Array.from(element.children).forEach((child) => {
    const tag = child.tagName.toUpperCase();
    if (DROPPED_TAGS.has(tag)) {
      child.remove();
      return;
    }
    sanitizeElement(child);
    if (!ALLOWED_TAGS.has(tag)) {
      child.replaceWith(...Array.from(child.childNodes));
      return;
    }
    Array.from(child.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name === 'style') {
        const style = cleanStyle(attribute.value);
        if (style) child.setAttribute('style', style);
        else child.removeAttribute('style');
      } else if ((name === 'colspan' || name === 'rowspan') && /^\d{1,2}$/.test(attribute.value)) {
        child.setAttribute(name, String(Math.min(20, Math.max(1, Number(attribute.value)))));
      } else {
        child.removeAttribute(attribute.name);
      }
    });
  });
  // Chú thích HTML không in ra nhưng có thể chứa token — bỏ.
  Array.from(element.childNodes)
    .filter((node) => node.nodeType === 8)
    .forEach((node) => node.remove());
}

// ── Trường khối ───────────────────────────────────────────────────────────

type Resolved = { text: string } | { html: string };

type Resolver = (key: string) => Resolved | undefined;

const isEmpty = (value: Resolved | undefined) =>
  !value || ('text' in value ? value.text.trim() === '' : value.html === '');

/** Mã vạch Code 128 / EAN-13 của mã hoá đơn: vạch nguyên số điểm in, module lớn nhất còn vừa bề rộng nội dung. */
export function invoiceBarcodeSvg(code: string, maxWidthMm: number, heightMm = 10): string {
  const encoded = encodeBarcode(code);
  if (!encoded.ok) return '';
  const dots = ([3, 2, 1] as const).find(
    (d) => barcodeWidthDots(encoded.barcode, d) / 8 <= maxWidthMm
  );
  if (!dots) return '';
  const widthDots = barcodeWidthDots(encoded.barcode, dots);
  const heightDots = Math.round(heightMm * 8);
  const rects = barcodeBars(encoded.barcode, dots)
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${heightDots}"/>`)
    .join('');
  return (
    `<svg class="bc" xmlns="http://www.w3.org/2000/svg" width="${widthDots / 8}mm" height="${heightMm}mm" ` +
    `viewBox="0 0 ${widthDots} ${heightDots}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" ` +
    `role="img" aria-label="${escapeHtml(encoded.barcode.value)}">${rects}</svg>`
  );
}

function blockValues(
  receipt: ISalesOrderReceipt,
  settings: ReceiptTemplateSettings
): Record<string, string> {
  const width = contentWidthMm(settings);
  const cancelled = !!receipt.invoice.isCancelled;
  const transfer = cancelled ? null : receipt.transferQr;
  const code = (receipt.invoice.code ?? '').trim();
  return {
    cancelled_banner: cancelled ? '<span class="cx">ĐÃ HUỶ</span>' : '',
    transfer_qr: transfer ? (buildReceiptQr(transfer.payload, Math.min(38, width))?.svg ?? '') : '',
    invoice_qr: code ? (buildReceiptQr(code, Math.min(26, width))?.svg ?? '') : '',
    invoice_barcode: code ? invoiceBarcodeSvg(code, width) : '',
  };
}

// ── Lặp, ẩn, thay trường ─────────────────────────────────────────────────

function tokensIn(node: Node): string[] {
  return Array.from((node.textContent ?? '').matchAll(TOKEN), (match) => match[1]);
}

/** Thay mọi token trong các text node của `root`; trường không biết → rỗng. */
function replaceTokens(root: Element, resolve: Resolver) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);

  texts.forEach((textNode) => {
    const text = textNode.data;
    if (!text.includes('{{')) return;
    const parts: Node[] = [];
    let last = 0;
    Array.from(text.matchAll(TOKEN)).forEach((match) => {
      const index = match.index ?? 0;
      if (index > last) parts.push(doc.createTextNode(text.slice(last, index)));
      const value = resolve(match[1]);
      if (value && 'html' in value) {
        if (value.html) {
          const holder = doc.createElement('div');
          holder.innerHTML = value.html;
          parts.push(...Array.from(holder.childNodes));
        }
      } else if (value?.text) {
        parts.push(doc.createTextNode(value.text));
      }
      last = index + match[0].length;
    });
    if (last < text.length) parts.push(doc.createTextNode(text.slice(last)));
    textNode.replaceWith(...parts);
  });
}

/** Bỏ khối mà mọi trường đều rỗng (kể cả chính `root` nếu nó là một khối như vậy). */
function hideEmptyBlocks(root: Element, resolve: Resolver) {
  const blocks = [root, ...Array.from(root.querySelectorAll(HIDEABLE))].filter((el) =>
    el.matches(HIDEABLE)
  );
  blocks.forEach((block) => {
    if (!block.isConnected && block !== root) return;
    const keys = tokensIn(block);
    if (keys.length > 0 && keys.every((key) => isEmpty(resolve(key)))) block.remove();
  });
}

function fill(root: Element, resolve: Resolver) {
  hideEmptyBlocks(root, resolve);
  if (root.isConnected || root.parentNode) replaceTokens(root, resolve);
}

/** Khối được lặp chứa token: hàng bảng / mục danh sách gần nhất, không có thì đoạn / tiêu đề gần nhất. */
function repeatUnitOf(node: Node, body: Element): Element | null {
  const start = node.nodeType === 1 ? (node as Element) : node.parentElement;
  const row = start?.closest('tr, li');
  if (row && body.contains(row)) return row;
  const block = start?.closest('p, h1, h2, h3, h4');
  return block && body.contains(block) ? block : null;
}

function expandRepeats(
  body: Element,
  isRepeatKey: (key: string) => boolean,
  rows: Array<Record<string, string>>,
  outer: Resolver
) {
  const doc = body.ownerDocument;
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  const units: Element[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (tokensIn(node).some(isRepeatKey)) {
      const unit = repeatUnitOf(node, body);
      if (unit && !units.includes(unit)) units.push(unit);
    }
  }

  // Nhóm các khối liền nhau (vd. hàng tên + hàng số lượng của một món) để lặp cùng nhau.
  const groups: Element[][] = [];
  units.forEach((unit) => {
    const current = groups[groups.length - 1];
    if (current && current[current.length - 1].nextElementSibling === unit) current.push(unit);
    else groups.push([unit]);
  });

  groups.forEach((group) => {
    const anchor = group[0];
    rows.forEach((values) => {
      const resolve: Resolver = (key) => (key in values ? { text: values[key] } : outer(key));
      group.forEach((unit) => {
        const clone = unit.cloneNode(true) as Element;
        anchor.parentNode?.insertBefore(clone, anchor);
        fill(clone, resolve);
      });
    });
    group.forEach((unit) => unit.remove());
  });
}

/** Bảng không còn hàng, danh sách không còn mục → bỏ. */
function removeEmptyContainers(body: Element) {
  body.querySelectorAll('thead, tbody, tfoot').forEach((section) => {
    if (!section.querySelector('tr')) section.remove();
  });
  body.querySelectorAll('table').forEach((table) => {
    if (!table.querySelector('tr')) table.remove();
  });
  body.querySelectorAll('ul, ol').forEach((list) => {
    if (!list.querySelector('li')) list.remove();
  });
}

function parseBody(html: string): Element {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html'
  );
  return doc.body;
}

/** HTML của mẫu đã lọc theo danh sách trắng (dùng cả khi xem trước trong trình soạn). */
export function sanitizeReceiptTemplateHtml(html: string): string {
  const body = parseBody(html ?? '');
  sanitizeElement(body);
  return body.innerHTML;
}

/** Phần thân phiếu đã trộn dữ liệu — chỉ còn thẻ an toàn và SVG do web dựng. */
export function mergeReceiptTemplate(
  templateHtml: string,
  receipt: ISalesOrderReceipt,
  settingsInput: ReceiptTemplateSettings | string
): string {
  const settings =
    typeof settingsInput === 'string' ? normalizeReceiptSettings(settingsInput) : settingsInput;
  const body = parseBody(templateHtml ?? '');
  sanitizeElement(body);

  const scalars = receiptScalarValues(receipt);
  const blocks = blockValues(receipt, settings);
  const global: Resolver = (key) => {
    if (key in blocks) return { html: blocks[key] };
    if (key in scalars) return { text: scalars[key] };
    // Trường lặp nằm ngoài khối lặp, hoặc mã lạ → rỗng.
    return { text: '' };
  };

  expandRepeats(body, isItemField, (receipt.lines ?? []).map(receiptItemValues), global);
  expandRepeats(body, isPaymentField, (receipt.payments ?? []).map(receiptPaymentValues), global);
  fill(body, global);
  removeEmptyContainers(body);
  return body.innerHTML;
}

// ── Tài liệu in ───────────────────────────────────────────────────────────

const round2 = (value: number) => Math.round(value * 100) / 100;
const mm = (value: number) => `${round2(value)}mm`;

// Trình duyệt làm tròn khổ trang (58 mm → 57,83 mm): khung nội dung hẹp hơn khổ một chút để trang không bị thu nhỏ.
const PAGE_SAFETY_MM = 0.5;

/** CSS dùng chung cho tài liệu in và khung soạn (mọi quy tắc nằm dưới lớp `.rt`). */
export function receiptTemplateContentCss(settings: ReceiptTemplateSettings): string {
  const border = '0.2mm solid #000';
  const rules = [
    `.rt{font-family:${RECEIPT_FONT_STACKS[settings.fontFamily].css};font-size:${settings.fontSizePt}pt;line-height:${settings.lineHeight};color:#000;overflow-wrap:break-word;font-kerning:none}`,
    '.rt p,.rt h1,.rt h2,.rt h3,.rt h4{margin:0}',
    // Dòng trống người soạn chủ động để lại vẫn cao một dòng khi in.
    '.rt p:empty::after{content:"\\00a0"}',
    '.rt h1{font-size:1.6em;font-weight:700}.rt h2{font-size:1.35em;font-weight:700}.rt h3{font-size:1.15em;font-weight:700}.rt h4{font-size:1em;font-weight:700}',
    '.rt ul,.rt ol{margin:0;padding-left:1.4em}',
    `.rt hr{border:0;border-top:0.3mm ${settings.ruleStyle} #000;margin:1.2mm 0;height:0}`,
    '.rt table{width:100%;border-collapse:collapse;margin:0.5mm 0;table-layout:auto}',
    '.rt td,.rt th{padding:0.3mm 0.6mm;vertical-align:top;text-align:left}',
    '.rt th{font-weight:700}',
    '.rt td>p,.rt th>p{margin:0}',
    '.rt tr{break-inside:avoid;page-break-inside:avoid}',
    '.rt .cx{display:block;border:0.5mm solid #000;padding:0.8mm 0;margin:1mm 0;text-align:center;font-size:14pt;font-weight:700;letter-spacing:0.5mm;white-space:nowrap}',
    '.rt svg.qc,.rt svg.bc{display:inline-block;vertical-align:middle;margin:0.5mm 0}',
  ];
  if (settings.tableBorder === 'rows') rules.push(`.rt td,.rt th{border-bottom:${border}}`);
  if (settings.tableBorder === 'all') rules.push(`.rt td,.rt th{border:${border}}`);
  return rules.join('\n');
}

export type ReceiptTemplatePage = { widthMm: number; heightMm: number };

export function isRollPaper(settings: ReceiptTemplateSettings): boolean {
  return RECEIPT_TEMPLATE_PAPERS[settings.paper].heightMm === null;
}

/** Tài liệu HTML hoàn chỉnh từ phần thân đã trộn. `rollHeightMm`: chiều cao trang giấy cuộn (bỏ qua với A4 / A5). */
export function receiptTemplateDocument(
  bodyHtml: string,
  settings: ReceiptTemplateSettings,
  rollHeightMm: number,
  title = 'Hoá đơn'
): string {
  const paper = RECEIPT_TEMPLATE_PAPERS[settings.paper];
  const roll = paper.heightMm === null;
  const page = roll
    ? `@page{size:${mm(paper.widthMm)} ${mm(rollHeightMm)};margin:0}`
    : `@page{size:${mm(paper.widthMm)} ${mm(paper.heightMm as number)};margin:${mm(settings.marginTopMm)} ${mm(settings.marginRightMm)} ${mm(settings.marginBottomMm)} ${mm(settings.marginLeftMm)}}`;
  const frame = roll
    ? `.rt{box-sizing:border-box;width:${mm(paper.widthMm - PAGE_SAFETY_MM)};padding:${mm(settings.marginTopMm)} ${mm(settings.marginRightMm)} ${mm(settings.marginBottomMm)} ${mm(settings.marginLeftMm)}}`
    : '.rt{box-sizing:border-box;width:100%}';
  const css = [
    page,
    'html,body{margin:0;padding:0;background:#fff}',
    'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    frame,
    receiptTemplateContentCss(settings),
    // Chỉ khi xem trên màn hình (ô xem trước): nền xám quanh tờ phiếu.
    roll
      ? '@media screen{body{background:#dfe3e8}.rt{background:#fff}}'
      : `@media screen{body{background:#dfe3e8}.rt{background:#fff;width:${mm(paper.widthMm)};min-height:${mm(paper.heightMm as number)};padding:${mm(settings.marginTopMm)} ${mm(settings.marginRightMm)} ${mm(settings.marginBottomMm)} ${mm(settings.marginLeftMm)}}}`,
  ].join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>\n${css}\n</style>`,
    '</head>',
    '<body>',
    `<div class="rt">${bodyHtml}</div>`,
    '</body>',
    '</html>',
  ].join('\n');
}

// ── Chiều cao giấy cuộn ───────────────────────────────────────────────────

const PX_TO_MM = 25.4 / 96;
// Trang phải cao hơn rộng (trang thấp hơn bề rộng bị coi là giấy ngang, có driver xoay 90°).
const PAGE_MIN_EXTRA_MM = 10;
const MEASURE_SPARE_MM = 4;
const MEASURE_TIMEOUT_MS = 3000;

export type MeasureHeight = (documentHtml: string, widthMm: number) => Promise<number | null>;

/**
 * Đo chiều cao (mm) của khung `.rt` khi dàn trang ở bề rộng `widthMm`, trong một iframe ẩn chỉ cho phép cùng origin
 * (không chạy script). Không đo được (môi trường không có bố cục, quá thời gian) → null.
 */
export const measureInFrame: MeasureHeight = (documentHtml, widthMm) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${widthMm}mm;height:200px;border:0;visibility:hidden;`;

    let done = false;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      frame.remove();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);

    frame.addEventListener('load', () => {
      window.clearTimeout(timer);
      try {
        const root = frame.contentDocument?.querySelector('.rt');
        const px = root ? root.getBoundingClientRect().height : 0;
        finish(px > 0 ? px * PX_TO_MM : null);
      } catch {
        finish(null);
      }
    });
    frame.srcdoc = documentHtml;
    document.body.appendChild(frame);
  });

/** Ước lượng thô (không có bố cục để đo): số dòng theo độ dài chữ + hình. Luôn dư hơn là thiếu. */
export function estimateReceiptBodyHeightMm(
  bodyHtml: string,
  settings: ReceiptTemplateSettings
): number {
  const body = parseBody(bodyHtml);
  const lineMm = settings.fontSizePt * settings.lineHeight * (25.4 / 72);
  const charMm = settings.fontSizePt * 0.6 * (25.4 / 72);
  const width = contentWidthMm(settings);
  let height = settings.marginTopMm + settings.marginBottomMm;
  body.querySelectorAll('p, h1, h2, h3, h4, li, tr').forEach((block) => {
    if (block.matches('tr') || !block.closest('tr, li')) {
      const chars = (block.textContent ?? '').length;
      const scale = /^H[1-3]$/.test(block.tagName) ? 1.6 : 1;
      height += Math.max(1, Math.ceil((chars * charMm * scale) / width)) * lineMm * scale;
    }
  });
  body.querySelectorAll('hr').forEach(() => {
    height += 3;
  });
  body.querySelectorAll('svg').forEach((svg) => {
    height += parseFloat(svg.getAttribute('height') ?? '0') + 1;
  });
  return height;
}

export function rollPageHeightMm(contentMm: number, settings: ReceiptTemplateSettings): number {
  const { widthMm } = RECEIPT_TEMPLATE_PAPERS[settings.paper];
  return Math.max(widthMm + PAGE_MIN_EXTRA_MM, Math.ceil(contentMm + MEASURE_SPARE_MM));
}

export type RenderedReceiptTemplate = { html: string; page: ReceiptTemplatePage };

/**
 * Tài liệu in của một phiếu theo mẫu. Giấy cuộn: dựng một lần để đo chiều cao nội dung, rồi dựng lại với khổ trang đúng
 * chiều cao đó (đo không được thì ước lượng dư).
 */
export async function renderReceiptTemplate(
  template: { content: string; settings: string | ReceiptTemplateSettings },
  receipt: ISalesOrderReceipt,
  options: { measure?: MeasureHeight; title?: string } = {}
): Promise<RenderedReceiptTemplate> {
  const settings =
    typeof template.settings === 'string'
      ? normalizeReceiptSettings(template.settings)
      : template.settings;
  const paper = RECEIPT_TEMPLATE_PAPERS[settings.paper];
  const body = mergeReceiptTemplate(template.content, receipt, settings);
  const title = options.title ?? `Hoá đơn ${(receipt.invoice.code ?? '').trim()}`.trim();

  if (paper.heightMm !== null) {
    return {
      html: receiptTemplateDocument(body, settings, paper.heightMm, title),
      page: { widthMm: paper.widthMm, heightMm: paper.heightMm },
    };
  }

  const draft = receiptTemplateDocument(body, settings, paper.widthMm + PAGE_MIN_EXTRA_MM, title);
  const measured = await (options.measure ?? measureInFrame)(draft, paper.widthMm);
  const contentMm =
    measured && measured > 0 ? measured : estimateReceiptBodyHeightMm(body, settings);
  const heightMm = rollPageHeightMm(contentMm, settings);
  return {
    html: receiptTemplateDocument(body, settings, heightMm, title),
    page: { widthMm: paper.widthMm, heightMm },
  };
}
