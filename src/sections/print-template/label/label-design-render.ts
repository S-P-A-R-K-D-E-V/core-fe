import { escapeHtml } from 'src/utils/print-html';

import { buildReceiptQr } from 'src/sections/pos/receipt-print/receipt-qr';
import { isValidEan13, encodeBarcode } from 'src/sections/pos/label-print/barcode';
import { validateLabelTemplate } from 'src/sections/pos/label-print/label-template';
import {
  labelValue,
  formatLabelPrice,
  normalizeQuantity,
  MAX_LABELS_PER_JOB,
} from 'src/sections/pos/label-print/label-sheet';
import {
  cssMm,
  snapMm,
  dotsToMm,
  formatMm,
  mmToDots,
  pageSizeMm,
  barcodeBars,
  labelOrigins,
  labelsPerPage,
  barcodeWidthDots,
  MIN_BARCODE_HEIGHT_MM,
} from 'src/sections/pos/label-print/label-geometry';

import type { EncodedBarcode } from 'src/sections/pos/label-print/barcode';
import type { LabelSource, LabelProblem } from 'src/sections/pos/label-print/label-sheet';
import type { ModuleDots, LabelCalibration } from 'src/sections/pos/label-print/label-template';

import { isSafeLogoSrc, isSafeImageSrc } from '../print-image';

import type { LabelDesign, LabelElement } from './label-design';

// ----------------------------------------------------------------------
// Bố cục tem tự thiết kế + danh sách hàng → các TRANG tem → một tài liệu HTML tự chứa để in (printHtmlDocument).
// Lưới tem, khổ trang, căn chỉnh (lệch / khe) dùng chung với in tem hệ thống (label-geometry). Mỗi phần tử đặt tuyệt đối
// theo mm trong ô tem; chữ được thoát HTML; mã vạch vẽ theo số NGUYÊN điểm in 203 dpi (module 1–3 điểm, tự chọn lớn nhất
// còn vừa khung); mã QR dùng cỡ ô nguyên điểm in như mã QR chuyển khoản trên hoá đơn.
// Phần tử chữ có trường mà mọi trường đều rỗng (vd. giá gốc khi không giảm giá) thì không in.
// ----------------------------------------------------------------------

/** Giảm giá khi in: theo % hoặc số tiền. */
export type LabelDiscount = { percent?: number; amount?: number } | null;

export type DesignLabelSource = LabelSource & { discount?: LabelDiscount };

export type DesignPrintContext = {
  storeName?: string | null;
  warehouse?: { name: string; address?: string | null; phone?: string | null } | null;
  /** Giảm giá chung cho dòng không có giảm giá riêng. */
  discount?: LabelDiscount;
  /** "29/10/2026"; không truyền = hôm nay. */
  printDate?: string;
  /** Logo hiện tại của cửa hàng — cho phần tử ảnh logo. */
  logoUrl?: string | null;
};

export type DesignPrintJob = { items: DesignLabelSource[]; context: DesignPrintContext };

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

const clean = (text: string | null | undefined) => (text ?? '').trim();

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** "20%" → 20 %; "15000" / "15.000" / "15k" → 15.000đ; trống / sai → không giảm. */
export function parseDiscount(input: string | null | undefined): LabelDiscount {
  const text = clean(input).toLowerCase().replace(/\s+/g, '');
  if (!text) return null;
  const percent = /^(\d{1,2}(?:[.,]\d+)?)%$/.exec(text);
  if (percent) {
    const value = Number(percent[1].replace(',', '.'));
    return value > 0 && value < 100 ? { percent: value } : null;
  }
  const thousands = /^(\d+(?:[.,]\d+)?)k$/.exec(text);
  if (thousands) {
    const value = Math.round(Number(thousands[1].replace(',', '.')) * 1000);
    return value > 0 ? { amount: value } : null;
  }
  if (/^\d{1,3}([.,]\d{3})+$|^\d+$/.test(text)) {
    const value = Number(text.replace(/[.,]/g, ''));
    return value > 0 ? { amount: value } : null;
  }
  return null;
}

export function formatDiscount(discount: LabelDiscount): string {
  if (!discount) return '';
  if (discount.percent) return `${String(discount.percent).replace('.', ',')}%`;
  return discount.amount ? formatLabelPrice(discount.amount, { suffix: 'none' }) : '';
}

function todayText(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
}

/** Giá trị chữ của mọi trường cho một dòng hàng. */
export function labelFieldValues(
  source: DesignLabelSource,
  design: Pick<LabelDesign, 'priceSuffix' | 'priceWithUnit'>,
  context: DesignPrintContext
): Record<string, string> {
  const unit = clean(source.unit);
  const money = (amount: number | null | undefined) =>
    formatLabelPrice(amount, {
      suffix: design.priceSuffix,
      unit: design.priceWithUnit ? unit : null,
    });
  const price = source.price ?? null;
  const discount = source.discount ?? context.discount ?? null;

  let off = 0;
  if (price !== null && Number.isFinite(price) && price > 0 && discount) {
    off = discount.percent
      ? Math.round((price * discount.percent) / 100)
      : Math.round(discount.amount ?? 0);
    off = Math.min(Math.max(0, off), Math.round(price));
  }
  const discounted = off > 0 && price !== null;
  const percentText = discounted
    ? `-${discount?.percent ? String(discount.percent).replace('.', ',') : Math.round((off / (price as number)) * 100)}%`
    : '';

  return {
    product_name: clean(source.name),
    product_code: clean(source.code),
    barcode_value: labelValue(source, { valueSource: 'barcode-or-code' }),
    unit,
    price: money(price),
    final_price: discounted ? money((price as number) - off) : money(price),
    original_price: discounted ? money(price) : '',
    discount_percent: percentText,
    discount_amount: discounted ? `-${formatLabelPrice(off, { suffix: design.priceSuffix })}` : '',
    store_name: clean(context.storeName),
    warehouse_name: clean(context.warehouse?.name),
    warehouse_address: clean(context.warehouse?.address),
    warehouse_phone: clean(context.warehouse?.phone),
    print_date: context.printDate ?? todayText(),
  };
}

/** Thay {{ma}} trong chữ của phần tử; null = có trường nhưng mọi trường đều rỗng (không in phần tử). */
export function fillText(text: string, values: Record<string, string>): string | null {
  const keys = Array.from(text.matchAll(TOKEN), (match) => match[1]);
  if (keys.length > 0 && keys.every((key) => !clean(values[key]))) return null;
  return text.replace(TOKEN, (_, key: string) => values[key] ?? '');
}

// ── Phần tử ───────────────────────────────────────────────────────────────

const MM_PER_PT = 25.4 / 72;
const BARCODE_TEXT_PT = 6;
const BARCODE_TEXT_GAP_DOTS = 1;

const barcodeTextHeightDots = () => Math.ceil(BARCODE_TEXT_PT * MM_PER_PT * 1.1 * 8);

/** Chiều cao vạch (điểm in) của phần tử mã vạch sau khi trừ dòng chữ bên dưới. */
export function barcodeBarHeightDots(element: LabelElement): number {
  const total = mmToDots(element.hMm);
  return element.showText ? total - barcodeTextHeightDots() - BARCODE_TEXT_GAP_DOTS : total;
}

/** Lỗi của bố cục (không phụ thuộc hàng): mã vạch thấp quá. */
export function designErrors(design: LabelDesign): string[] {
  const errors = validateLabelTemplate(design.paper);
  design.elements
    .filter((element) => element.type === 'barcode')
    .forEach((element) => {
      if (dotsToMm(barcodeBarHeightDots(element)) < MIN_BARCODE_HEIGHT_MM) {
        errors.push(
          `Khung mã vạch cao ${formatMm(element.hMm)} mm — vạch cần ít nhất ${formatMm(MIN_BARCODE_HEIGHT_MM)} mm${element.showText ? ' (chưa kể dòng mã bên dưới)' : ''}.`
        );
      }
    });
  return errors;
}

type FittedBarcode = { barcode: EncodedBarcode; dots: ModuleDots; widthDots: number };

/** Module lớn nhất (hoặc module đã chọn) mà mã còn vừa bề rộng khung. */
export function fitElementBarcode(
  barcode: EncodedBarcode,
  element: LabelElement
): FittedBarcode | { error: string } {
  const boxDots = mmToDots(element.wMm);
  const choices: ModuleDots[] = element.moduleDots ? [element.moduleDots] : [3, 2, 1];
  const dots = choices.find((d) => barcodeWidthDots(barcode, d) <= boxDots);
  if (!dots) {
    const need = dotsToMm(barcodeWidthDots(barcode, element.moduleDots || 1));
    return {
      error: `Mã quá dài cho khung mã vạch: cần ${formatMm(need)} mm, khung rộng ${formatMm(element.wMm)} mm. Kéo rộng khung${element.moduleDots && element.moduleDots > 1 ? ' hoặc chọn vạch mảnh hơn' : ''}.`,
    };
  }
  return { barcode, dots, widthDots: barcodeWidthDots(barcode, dots) };
}

function boxStyle(element: LabelElement): string {
  return `left:${cssMm(element.xMm)};top:${cssMm(element.yMm)};width:${cssMm(element.wMm)};height:${cssMm(element.hMm)}`;
}

function textInner(element: LabelElement, text: string): string {
  const lines = Math.max(1, element.maxLines ?? 1);
  const style = [
    `font-size:${element.fontPt ?? 7}pt`,
    `font-weight:${element.bold ? 700 : 400}`,
    element.italic ? 'font-style:italic' : '',
    element.strike ? 'text-decoration:line-through' : '',
    `text-align:${element.align ?? 'center'}`,
    `justify-content:${{ left: 'flex-start', center: 'center', right: 'flex-end' }[element.align ?? 'center']}`,
  ]
    .filter(Boolean)
    .join(';');
  return `<div class="tx" style="${style}"><span style="-webkit-line-clamp:${lines}">${escapeHtml(text)}</span></div>`;
}

function barcodeInner(element: LabelElement, fitted: FittedBarcode): string {
  const barDots = barcodeBarHeightDots(element);
  const leftDots = Math.floor((mmToDots(element.wMm) - fitted.widthDots) / 2);
  const rects = barcodeBars(fitted.barcode, fitted.dots)
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${barDots}"/>`)
    .join('');
  const svg =
    `<svg class="bc" style="left:${cssMm(dotsToMm(leftDots))};top:0" width="${cssMm(dotsToMm(fitted.widthDots))}" ` +
    `height="${cssMm(dotsToMm(barDots))}" viewBox="0 0 ${fitted.widthDots} ${barDots}" preserveAspectRatio="none" ` +
    `shape-rendering="crispEdges" fill="#000" role="img" aria-label="${escapeHtml(fitted.barcode.value)}">${rects}</svg>`;
  if (!element.showText) return svg;
  const top = dotsToMm(barDots + BARCODE_TEXT_GAP_DOTS);
  return `${svg}<div class="bt" style="top:${cssMm(top)};font-size:${BARCODE_TEXT_PT}pt">${escapeHtml(fitted.barcode.value)}</div>`;
}

export type RenderedElement = { html: string } | { problem: string } | null;

/** HTML của một phần tử (đã gồm khung đặt vị trí `.el`); null = không in (trường rỗng); problem = hàng không in được. */
export function renderElement(
  element: LabelElement,
  source: DesignLabelSource,
  values: Record<string, string>,
  assets: Pick<DesignPrintContext, 'logoUrl'> = {}
): RenderedElement {
  const open = `<div class="el" style="${boxStyle(element)}">`;

  if (element.type === 'image') {
    // Ảnh vừa khung, giữ tỉ lệ. Logo: cửa hàng chưa có logo thì không in.
    const src = element.logo ? assets.logoUrl : element.src;
    const safe = element.logo ? isSafeLogoSrc(src) : isSafeImageSrc(src);
    if (!src || !safe) return null;
    return { html: `${open}<img class="im" src="${escapeHtml(src.trim())}" alt=""></div>` };
  }

  if (element.type === 'text') {
    const text = fillText(element.text ?? '', values);
    return text === null || !text.trim()
      ? null
      : { html: `${open}${textInner(element, text)}</div>` };
  }

  if (element.type === 'line')
    return { html: `<div class="el ln" style="${boxStyle(element)}"></div>` };

  if (element.type === 'box') {
    return {
      html: `<div class="el bx" style="${boxStyle(element)};border-width:${cssMm(element.strokeMm ?? 0.3)}"></div>`,
    };
  }

  if (element.type === 'barcode') {
    const value = labelValue(source, {
      valueSource: element.source === 'code' ? 'code' : 'barcode-or-code',
    });
    if (!value) return { problem: 'Chưa có mã vạch hoặc mã hàng để in vạch.' };
    const encoded = encodeBarcode(value);
    if (!encoded.ok) return { problem: encoded.error };
    const fitted = fitElementBarcode(encoded.barcode, element);
    if ('error' in fitted) return { problem: fitted.error };
    return { html: `${open}${barcodeInner(element, fitted)}</div>` };
  }

  // Mã QR
  const payload =
    element.source === 'custom'
      ? clean(fillText(element.text ?? '', values))
      : labelValue(source, { valueSource: element.source === 'code' ? 'code' : 'barcode-or-code' });
  if (!payload) return element.source === 'custom' ? null : { problem: 'Chưa có mã để in mã QR.' };
  const qr = buildReceiptQr(payload, Math.min(element.wMm, element.hMm));
  if (!qr)
    return {
      problem: `Nội dung mã QR quá dài cho khung ${formatMm(element.wMm)} × ${formatMm(element.hMm)} mm.`,
    };
  const left = round3((element.wMm - qr.sizeMm) / 2);
  const top = round3((element.hMm - qr.sizeMm) / 2);
  return {
    html: `${open}<div class="qw" style="left:${cssMm(left)};top:${cssMm(top)}">${qr.svg}</div></div>`,
  };
}

/** Phần trong của một tem (các phần tử theo thứ tự vẽ) hoặc lý do không in được. */
export function renderLabelInner(
  design: LabelDesign,
  source: DesignLabelSource,
  context: DesignPrintContext
): { html: string; note?: string } | { problem: string } {
  const values = labelFieldValues(source, design, context);
  const parts: string[] = [];
  for (let i = 0; i < design.elements.length; i += 1) {
    const rendered = renderElement(design.elements[i], source, values, context);
    if (rendered && 'problem' in rendered) return { problem: rendered.problem };
    if (rendered) parts.push(rendered.html);
  }
  const value = labelValue(source, { valueSource: 'barcode-or-code' });
  const note =
    design.elements.some((element) => element.type === 'barcode') &&
    /^\d{13}$/.test(value) &&
    !isValidEan13(value)
      ? 'Mã 13 số nhưng sai số kiểm tra EAN-13 nên in bằng Code 128.'
      : undefined;
  return { html: parts.join(''), note };
}

// ── Lệnh in ───────────────────────────────────────────────────────────────

export type PlannedDesignLabel = {
  source: DesignLabelSource;
  quantity: number;
  html: string;
  note?: string;
};

export type DesignSheetPlan = {
  errors: string[];
  limitError: string | null;
  labels: PlannedDesignLabel[];
  problems: LabelProblem[];
  pages: PlannedDesignLabel[][];
  labelsPerPage: number;
  labelCount: number;
  pageCount: number;
};

const groupThousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function planDesignSheet(job: DesignPrintJob, design: LabelDesign): DesignSheetPlan {
  const errors = designErrors(design);
  const labels: PlannedDesignLabel[] = [];
  const problems: LabelProblem[] = [];

  job.items.forEach((source) => {
    const quantity = normalizeQuantity(source.quantity);
    if (quantity === 0) return;
    const inner = renderLabelInner(design, source, job.context);
    if ('problem' in inner) {
      problems.push({
        key: source.key,
        name: source.name,
        value: labelValue(source, { valueSource: 'barcode-or-code' }),
        reason: inner.problem,
      });
      return;
    }
    labels.push({ source, quantity, html: inner.html, note: inner.note });
  });

  const perPage = labelsPerPage(design.paper);
  const requested = labels.reduce((count, label) => count + label.quantity, 0);
  const limitError =
    requested > MAX_LABELS_PER_JOB
      ? `Mỗi lần in tối đa ${groupThousands(MAX_LABELS_PER_JOB)} tem — đang chọn ${groupThousands(requested)} tem. Giảm số tem hoặc chia thành nhiều lần in.`
      : null;

  const pages: PlannedDesignLabel[][] = [];
  if (errors.length === 0 && !limitError) {
    labels.forEach((label) => {
      for (let copy = 0; copy < label.quantity; copy += 1) {
        const last = pages[pages.length - 1];
        if (last && last.length < perPage) last.push(label);
        else pages.push([label]);
      }
    });
  }

  return {
    errors,
    limitError,
    labels,
    problems,
    pages,
    labelsPerPage: perPage,
    labelCount: pages.reduce((count, page) => count + page.length, 0),
    pageCount: pages.length,
  };
}

const FONT_STACK = 'Arial,"Segoe UI",Tahoma,sans-serif';
// Như in tem hệ thống: khung trang hụt 0,5 mm để trình duyệt làm tròn khổ giấy không đẩy tem sang trang mới.
const PAGE_SAFETY_MM = 0.5;

/** CSS của ô tem và các phần tử — dùng chung cho tài liệu in và khung thiết kế (lớp `.lb`). */
export const LABEL_ELEMENT_CSS = [
  '.lb .el{position:absolute;overflow:hidden}',
  '.lb .tx{position:absolute;inset:0;display:flex;align-items:center;line-height:1.2;overflow:hidden}',
  '.lb .tx span{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;max-width:100%}',
  '.lb .ln{background:#000}',
  '.lb .bx{border-style:solid;border-color:#000;box-sizing:border-box}',
  '.lb .bc{position:absolute;display:block}',
  '.lb .bt{position:absolute;left:0;right:0;text-align:center;line-height:1.1;letter-spacing:0.1mm;white-space:nowrap;overflow:hidden}',
  '.lb .qw{position:absolute}',
  '.lb .qw svg{display:block}',
  '.lb .im{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain}',
].join('\n');

function sheetCss(design: LabelDesign): string {
  const { paper } = design;
  const page = pageSizeMm(paper);
  return [
    `@page{size:${cssMm(page.widthMm)} ${cssMm(page.heightMm)};margin:0}`,
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff}',
    `body{font-family:${FONT_STACK};color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    `.pg{position:relative;width:${cssMm(page.widthMm - PAGE_SAFETY_MM)};height:${cssMm(page.heightMm - PAGE_SAFETY_MM)};overflow:hidden;break-after:page;page-break-after:always}`,
    '.pg:last-child{break-after:auto;page-break-after:auto}',
    `.lb{position:absolute;width:${cssMm(paper.labelWidthMm)};height:${cssMm(paper.labelHeightMm)};overflow:hidden}`,
    LABEL_ELEMENT_CSS,
    '@media screen{body{background:#dfe3e8}.pg{background:#eef1f4;margin-bottom:2mm}.lb{background:#fff;outline:1px dashed #919eab;outline-offset:-1px}}',
  ].join('\n');
}

/**
 * Tài liệu HTML của một lệnh in tem theo bố cục — đưa thẳng vào printHtmlDocument(). Dòng trong `problems` không có mặt;
 * bố cục lỗi / vượt số tem tối đa → không có trang nào.
 */
export function renderDesignSheetHtml(
  job: DesignPrintJob,
  design: LabelDesign,
  calibration: LabelCalibration,
  options: { maxPages?: number } = {}
): string {
  const plan = planDesignSheet(job, design);
  // Giấy cuộn: gốc mỗi ô tem đã nằm trên lưới điểm in (labelOrigins); phần tử trong tem cũng đặt trên lưới đó.
  const origins = labelOrigins(design.paper, calibration);
  const pages = plan.pages.slice(0, options.maxPages).map((page) => {
    const cells = page.map((label, cell) => {
      const origin = origins[cell];
      return `<div class="lb" style="left:${cssMm(origin.leftMm)};top:${cssMm(origin.topMm)}">${label.html}</div>`;
    });
    return `<div class="pg">${cells.join('')}</div>`;
  });

  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(`In tem mã (${plan.labelCount} tem)`)}</title>`,
    `<style>\n${sheetCss(design)}\n</style>`,
    '</head>',
    '<body>',
    ...pages,
    '</body>',
    '</html>',
  ].join('\n');
}

/** Toạ độ phần tử về lưới điểm in (0,125 mm) — gọi khi lưu để vạch không bị driver co giãn. */
export function snapDesignToDots(design: LabelDesign): LabelDesign {
  return {
    ...design,
    elements: design.elements.map((element) => ({
      ...element,
      xMm: snapMm(element.xMm),
      yMm: snapMm(element.yMm),
      wMm: Math.max(0.125, snapMm(element.wMm)),
      hMm: Math.max(0.125, snapMm(element.hMm)),
    })),
  };
}
