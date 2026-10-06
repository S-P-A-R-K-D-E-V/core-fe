import { escapeHtml } from 'src/utils/print-html';

import { isValidEan13, encodeBarcode } from './barcode';
import {
  cssMm,
  dotsToMm,
  formatMm,
  fitBarcode,
  pageSizeMm,
  barcodeBars,
  storeNamePt,
  labelOrigins,
  labelsPerPage,
  moduleWidthText,
  computeLabelLayout,
} from './label-geometry';

import type { EncodedBarcode } from './barcode';
import type { LabelBlock, LabelLayout } from './label-geometry';
import type {
  LabelOptions,
  LabelTemplate,
  LabelCalibration,
  LabelPriceSuffix,
} from './label-template';

// ----------------------------------------------------------------------
// Từ danh sách hàng cần in → các TRANG tem → một tài liệu HTML tự chứa để đưa vào iframe in.
//
//  - Một trang in là một lưới tem (số hàng × số tem mỗi hàng của mẫu). Giấy cuộn: mỗi trang là một
//    hàng, khổ trang = khổ cuộn × chiều cao tem. Giấy tờ: mỗi trang là một tờ. N tem của một mã lấp các
//    ô liên tiếp; trang cuối có thể thiếu tem.
//  - Mã không mã hoá được / không vừa tem bị loại khỏi lệnh in và trả về trong `problems` kèm lý do.
//  - Quá MAX_LABELS_PER_JOB tem thì từ chối cả lệnh in.
//  - HTML chỉ có CSS trong <style> (kèm @page size, lề 0), font hệ thống, mã vạch là SVG <rect> theo
//    điểm in; không script, không tài nguyên ngoài.
// ----------------------------------------------------------------------

export type LabelSource = {
  /** Khoá duy nhất của dòng (id sản phẩm / biến thể). */
  key: string;
  name: string;
  code?: string | null;
  barcode?: string | null;
  price?: number | null;
  /** Đơn vị tính ("cái", "hộp") — in sau giá khi bật tuỳ chọn. */
  unit?: string | null;
  /** Số tem cần in; 0 = bỏ qua dòng này. */
  quantity: number;
};

export type LabelPrintJob = {
  items: LabelSource[];
  options: LabelOptions;
  /** Tên cửa hàng — chỉ in khi options.showStoreName bật và có tên. */
  storeName?: string | null;
};

export type PlannedLabel = {
  source: LabelSource;
  quantity: number;
  barcode: EncodedBarcode;
  /** Mép trái của mã vạch (kể cả vùng trắng) so với mép trái tem. */
  barcodeLeftMm: number;
  /** Bề rộng mã vạch kể cả vùng trắng, tính bằng điểm in. */
  barcodeWidthDots: number;
  /** Lưu ý không chặn việc in (vd. mã 13 số sai số kiểm tra nên in bằng Code 128). */
  note?: string;
};

export type LabelProblem = { key: string; name: string; value: string; reason: string };

export type LabelSheetPlan = {
  /** Lỗi của mẫu tem / bố cục: không in được tem nào cho tới khi sửa. */
  layoutError: string | null;
  /** Vượt quá số tem tối đa của một lần in. */
  limitError: string | null;
  labels: PlannedLabel[];
  problems: LabelProblem[];
  /** Mỗi phần tử là một trang, tối đa `labelsPerPage` tem; rỗng khi có layoutError / limitError. */
  pages: PlannedLabel[][];
  labelsPerPage: number;
  /** Tổng số tem của các mã in được (kể cả khi lệnh in bị từ chối). */
  requestedCount: number;
  /** Số tem thật sự được in. */
  labelCount: number;
  pageCount: number;
};

export const MAX_LABELS_PER_JOB = 5000;

// Chặn số gõ nhầm quá lớn ở một dòng; giới hạn thật là MAX_LABELS_PER_JOB cho cả lệnh in.
const MAX_QUANTITY_INPUT = 99999;

/** Số tem hợp lệ của một dòng: số nguyên không âm. */
export function normalizeQuantity(quantity: unknown): number {
  const number = Math.floor(Number(quantity));
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(MAX_QUANTITY_INPUT, number);
}

/** Giá trị đem mã hoá của một dòng theo tuỳ chọn (đã bỏ khoảng trắng đầu / cuối). */
export function labelValue(source: LabelSource, options: Pick<LabelOptions, 'valueSource'>): string {
  const code = (source.code ?? '').trim();
  if (options.valueSource === 'code') return code;
  return (source.barcode ?? '').trim() || code;
}

const groupThousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Tiền Việt không có phần lẻ: "185.000đ" (mặc định), "185.000 VND", "185.000"; có đơn vị thì thêm
 * "/cái". Không có giá → chuỗi rỗng.
 */
export function formatLabelPrice(
  price: number | null | undefined,
  format: { suffix?: LabelPriceSuffix; unit?: string | null } = {}
): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return '';
  const rounded = Math.round(price);
  const amount = `${rounded < 0 ? '-' : ''}${groupThousands(Math.abs(rounded))}`;
  const suffix = format.suffix ?? 'đ';
  const money = suffix === 'none' ? amount : `${amount}${suffix === 'VND' ? ' VND' : 'đ'}`;
  const unit = (format.unit ?? '').trim();
  return unit ? `${money}/${unit}` : money;
}

/** Dòng giá của một tem theo tuỳ chọn in. */
export function labelPriceText(source: LabelSource, options: LabelOptions): string {
  return formatLabelPrice(source.price, {
    suffix: options.priceSuffix,
    unit: options.showUnit ? source.unit : null,
  });
}

// Chỉ chừa dòng "tên cửa hàng" khi thật sự có tên để in.
function effectiveOptions(job: LabelPrintJob): LabelOptions {
  const storeName = (job.storeName ?? '').trim();
  return { ...job.options, showStoreName: job.options.showStoreName && storeName !== '' };
}

/** Mã hoá + kiểm tra vừa tem cho từng dòng, rồi chia các tem vào từng trang. */
export function planLabelSheet(
  job: LabelPrintJob,
  template: LabelTemplate,
  calibration: LabelCalibration
): LabelSheetPlan {
  const layout = computeLabelLayout(template, effectiveOptions(job));
  const labels: PlannedLabel[] = [];
  const problems: LabelProblem[] = [];

  job.items.forEach((source) => {
    const quantity = normalizeQuantity(source.quantity);
    if (quantity === 0) return;

    const value = labelValue(source, job.options);
    const problem = (reason: string) =>
      problems.push({ key: source.key, name: source.name, value, reason });

    if (!value) {
      problem(
        job.options.valueSource === 'code'
          ? 'Chưa có mã hàng để in vạch.'
          : 'Chưa có mã vạch hoặc mã hàng để in vạch.'
      );
      return;
    }

    const encoded = encodeBarcode(value);
    if (!encoded.ok) {
      problem(encoded.error);
      return;
    }

    const fit = fitBarcode(encoded.barcode, template, calibration.moduleDots);
    if (!fit.fits) {
      problem(fit.message);
      return;
    }

    labels.push({
      source,
      quantity,
      barcode: encoded.barcode,
      barcodeLeftMm: fit.leftMm,
      barcodeWidthDots: fit.widthDots,
      note:
        /^\d{13}$/.test(value) && !isValidEan13(value)
          ? 'Mã 13 số nhưng sai số kiểm tra EAN-13 nên in bằng Code 128.'
          : undefined,
    });
  });

  const perPage = labelsPerPage(template);
  const requestedCount = labels.reduce((count, label) => count + label.quantity, 0);
  const limitError =
    requestedCount > MAX_LABELS_PER_JOB
      ? `Mỗi lần in tối đa ${groupThousands(MAX_LABELS_PER_JOB)} tem — đang chọn ${groupThousands(requestedCount)} tem. Giảm số tem hoặc chia thành nhiều lần in.`
      : null;

  const pages: PlannedLabel[][] = [];
  if (layout.ok && !limitError) {
    labels.forEach((label) => {
      for (let copy = 0; copy < label.quantity; copy += 1) {
        const last = pages[pages.length - 1];
        if (last && last.length < perPage) last.push(label);
        else pages.push([label]);
      }
    });
  }

  return {
    layoutError: layout.ok ? null : layout.error,
    limitError,
    labels,
    problems,
    pages,
    labelsPerPage: perPage,
    requestedCount,
    labelCount: pages.reduce((count, page) => count + page.length, 0),
    pageCount: pages.length,
  };
}

// ── HTML ──────────────────────────────────────────────────────────────────

const FONT_STACK = 'Arial,"Segoe UI",Tahoma,sans-serif';

// Khung của mỗi trang nhỏ hơn khổ trang 0,25 mm mỗi chiều: nếu trình duyệt làm tròn khổ giấy xuống một
// chút thì nội dung vẫn không tràn (tràn dọc → thêm một trang trắng sau mỗi trang; tràn ngang → trình
// duyệt tự thu nhỏ cả trang, làm lệch vạch). Vị trí các tem không đổi vì chúng đặt tuyệt đối theo mm.
const PAGE_SAFETY_MM = 0.25;

/** Khung của bản in thử cách mép tem bấy nhiêu mm về mỗi phía. */
export const MARK_INSET_MM = 0.5;

const boxCss = (box: LabelBlock) =>
  `position:absolute;left:${cssMm(box.leftMm)};top:${cssMm(box.topMm)};width:${cssMm(box.widthMm)};height:${cssMm(box.heightMm)}`;

const oneLineCss = (box: LabelBlock, pt: number) =>
  `${boxCss(box)};line-height:${cssMm(box.heightMm)};font-size:${pt}pt;text-align:center;white-space:nowrap;overflow:hidden`;

function sheetCss(template: LabelTemplate, layout: LabelLayout | null): string {
  const page = pageSizeMm(template);
  const rules = [
    `@page{size:${cssMm(page.widthMm)} ${cssMm(page.heightMm)};margin:0}`,
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff}',
    `body{font-family:${FONT_STACK};color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    `.pg{position:relative;width:${cssMm(page.widthMm - PAGE_SAFETY_MM)};height:${cssMm(page.heightMm - PAGE_SAFETY_MM)};overflow:hidden;break-after:page;page-break-after:always}`,
    '.pg:last-child{break-after:auto;page-break-after:auto}',
    `.lb{position:absolute;width:${cssMm(template.labelWidthMm)};height:${cssMm(template.labelHeightMm)};overflow:hidden}`,
    '.bc{position:absolute;display:block}',
    // Khung in thử nằm LÙI vào trong mép tem MARK_INSET_MM để cả 4 cạnh luôn in ra, không bị mép trang cắt.
    `.mk{position:absolute;left:${cssMm(MARK_INSET_MM)};top:${cssMm(MARK_INSET_MM)};right:${cssMm(MARK_INSET_MM)};bottom:${cssMm(MARK_INSET_MM)};border:${cssMm(PAGE_SAFETY_MM)} solid #000}`,
    `.pz{position:absolute;top:0;height:100%;border-left:${cssMm(PAGE_SAFETY_MM)} dashed #000}`,
    `.ct{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:1mm;font-size:${template.namePt}pt;font-weight:700}`,
  ];

  if (layout) {
    if (layout.store) {
      rules.push(`.st{${oneLineCss(layout.store, storeNamePt(template))};text-overflow:ellipsis}`);
    }
    if (layout.name) {
      rules.push(
        `.nm{${boxCss(layout.name)};display:flex;align-items:center;justify-content:center;text-align:center;font-size:${template.namePt}pt;font-weight:700;line-height:${cssMm(layout.name.lineHeightMm)}}`,
        // Tối đa N dòng, dòng cuối tự thêm "…". Ba chi tiết đã kiểm bằng bản in thật của Chromium:
        //  - padding trên chừa chỗ cho dấu chồng của dòng đầu;
        //  - clip-path cắt dải trống ở đáy để nét dấu của dòng bị ẩn kế tiếp không ló vào;
        //  - padding ngang 0,5em bù bằng margin âm: chữ căn giữa có "…" tràn mép phải tới nửa độ rộng
        //    dấu "…", không có khoảng đệm này thì chấm cuối bị cắt (bề rộng dòng chữ không đổi).
        `.nm span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${layout.name.lines};overflow:hidden;max-height:${cssMm(layout.name.heightMm)};padding:${cssMm(layout.name.inkTopMm)} 0.5em 0;margin:0 -0.5em;overflow-wrap:anywhere;clip-path:inset(0 0 ${cssMm(layout.name.clipBottomMm)} 0)}`
      );
    }
    rules.push(`.cd{${oneLineCss(layout.code, template.codePt)};letter-spacing:0.1mm}`);
    if (layout.price) {
      rules.push(`.pr{${oneLineCss(layout.price, template.pricePt)};font-weight:700}`);
    }
  }

  // Chỉ khi xem trên màn hình (ô xem trước): nền xám cho giấy đế, viền nét đứt quanh từng tem.
  rules.push(
    '@media screen{body{background:#dfe3e8}.pg{background:#eef1f4;margin-bottom:2mm}.lb{background:#fff;outline:1px dashed #919eab;outline-offset:-1px}}'
  );
  return rules.join('\n');
}

/** SVG của mã vạch: viewBox tính bằng điểm in, mỗi vạch là một <rect> có x / width nguyên. */
function barcodeSvg(
  label: Pick<PlannedLabel, 'barcode' | 'barcodeLeftMm' | 'barcodeWidthDots'>,
  layout: LabelLayout,
  calibration: LabelCalibration
): string {
  const { heightDots } = layout.barcode;
  const widthDots = label.barcodeWidthDots;
  const rects = barcodeBars(label.barcode, calibration.moduleDots)
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.width}" height="${heightDots}"/>`)
    .join('');
  return (
    `<svg class="bc" style="left:${cssMm(label.barcodeLeftMm)};top:${cssMm(layout.barcode.topMm)}" ` +
    `width="${cssMm(dotsToMm(widthDots))}" height="${cssMm(layout.barcode.heightMm)}" ` +
    `viewBox="0 0 ${widthDots} ${heightDots}" preserveAspectRatio="none" shape-rendering="crispEdges" ` +
    `fill="#000" role="img" aria-label="${escapeHtml(label.barcode.value)}">${rects}</svg>`
  );
}

function labelInnerHtml(
  label: PlannedLabel,
  layout: LabelLayout,
  job: LabelPrintJob,
  calibration: LabelCalibration
): string {
  const parts: string[] = [];
  if (layout.store) {
    parts.push(`<div class="st">${escapeHtml((job.storeName ?? '').trim())}</div>`);
  }
  if (layout.name) {
    parts.push(`<div class="nm"><span>${escapeHtml(label.source.name)}</span></div>`);
  }
  parts.push(barcodeSvg(label, layout, calibration));
  parts.push(`<div class="cd">${escapeHtml(label.barcode.value)}</div>`);
  if (layout.price) {
    parts.push(`<div class="pr">${escapeHtml(labelPriceText(label.source, job.options))}</div>`);
  }
  return parts.join('');
}

function documentHtml(title: string, css: string, pages: string[]): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>\n${css}\n</style>`,
    '</head>',
    '<body>',
    ...pages,
    '</body>',
    '</html>',
  ].join('\n');
}

export type RenderLabelSheetOptions = {
  /** Chỉ dựng N trang đầu (ô xem trước dùng 1). */
  maxPages?: number;
};

/**
 * Tài liệu HTML hoàn chỉnh của một lệnh in tem — đưa thẳng vào printHtmlDocument().
 * Các dòng trong `problems` của planLabelSheet() không có mặt trong tài liệu; lệnh in bị từ chối
 * (layoutError / limitError) cho ra tài liệu không có trang nào.
 */
export function renderLabelSheetHtml(
  job: LabelPrintJob,
  template: LabelTemplate,
  calibration: LabelCalibration,
  renderOptions: RenderLabelSheetOptions = {}
): string {
  const plan = planLabelSheet(job, template, calibration);
  const layoutResult = computeLabelLayout(template, effectiveOptions(job));
  const layout = layoutResult.ok ? layoutResult.layout : null;
  const origins = labelOrigins(template, calibration);

  const innerByLabel = new Map<PlannedLabel, string>();
  const pages = (layout ? plan.pages : []).slice(0, renderOptions.maxPages).map((page) => {
    const cells = page.map((label, cell) => {
      let inner = innerByLabel.get(label);
      if (inner === undefined) {
        inner = labelInnerHtml(label, layout as LabelLayout, job, calibration);
        innerByLabel.set(label, inner);
      }
      const origin = origins[cell];
      return `<div class="lb" style="left:${cssMm(origin.leftMm)};top:${cssMm(origin.topMm)}">${inner}</div>`;
    });
    return `<div class="pg">${cells.join('')}</div>`;
  });

  return documentHtml(`In tem mã (${plan.labelCount} tem)`, sheetCss(template, layout), pages);
}

// ── In thử căn chỉnh ──────────────────────────────────────────────────────

const signedMm = (mm: number) => `${mm > 0 ? '+' : ''}${formatMm(mm)}`;

/**
 * MỘT trang để căn máy in (giấy cuộn: một hàng tem; giấy tờ: cả tờ): mỗi ô có một khung cách đều mép
 * tem MARK_INSET_MM, số thứ tự ô, các độ lệch đang đặt và một mã vạch thử ở đúng độ rộng vạch đang
 * chọn. Khung sát / lệch về phía nào thì chỉnh ngược lại. Mẫu có giới hạn vùng in thì thêm vạch nét
 * đứt ở mép vùng in.
 */
export function renderCalibrationSheetHtml(
  template: LabelTemplate,
  calibration: LabelCalibration
): string {
  const layoutResult = computeLabelLayout(template, {
    showName: true,
    showStoreName: false,
    showPrice: false,
    priceSuffix: 'đ',
    showUnit: false,
    valueSource: 'code',
  });
  const layout = layoutResult.ok ? layoutResult.layout : null;
  const origins = labelOrigins(template, calibration);
  const isSheet = template.kind === 'sheet';

  const summary = [
    `trái ${signedMm(calibration.offsetLeftMm)}`,
    `trên ${signedMm(calibration.offsetTopMm)}`,
    `${isSheet ? 'khe cột' : 'khe'} ${signedMm(calibration.extraColumnGapMm)}`,
    ...(isSheet ? [`khe hàng ${signedMm(calibration.extraRowGapMm)}`] : []),
    `vạch ${moduleWidthText(template, calibration.moduleDots)}`,
  ].join(' · ');

  // Mã thử dài nhất còn vừa tem ở độ rộng vạch đang chọn.
  const sample = ['12345678', '1234']
    .map((value) => encodeBarcode(value))
    .map((result) => (result.ok ? result.barcode : null))
    .map((barcode) => {
      const fit = barcode ? fitBarcode(barcode, template, calibration.moduleDots) : null;
      return barcode && fit?.fits
        ? { barcode, barcodeLeftMm: fit.leftMm, barcodeWidthDots: fit.widthDots }
        : null;
    })
    .find((candidate) => candidate !== null);

  const printZone =
    template.printWidthMm > 0 && template.printWidthMm < template.labelWidthMm
      ? `<div class="pz" style="left:${cssMm(template.printWidthMm)}"></div>`
      : '';

  const cells = origins.map((origin, cell) => {
    const text = `Tem ${cell + 1}/${origins.length} · ${summary}`;
    const inner =
      layout && sample
        ? `<div class="nm"><span>${escapeHtml(text)}</span></div>` +
          barcodeSvg(sample, layout, calibration) +
          `<div class="cd">${escapeHtml(sample.barcode.value)}</div>`
        : `<div class="ct">${escapeHtml(text)}</div>`;
    return `<div class="lb" style="left:${cssMm(origin.leftMm)};top:${cssMm(origin.topMm)}">${inner}${printZone}<div class="mk"></div></div>`;
  });

  return documentHtml('In thử căn chỉnh tem', sheetCss(template, layout), [
    `<div class="pg">${cells.join('')}</div>`,
  ]);
}

// ── Xuất danh sách ────────────────────────────────────────────────────────

const UTF8_BOM = String.fromCharCode(0xfeff);

// Excel coi ô bắt đầu bằng = + - @ là công thức → thêm dấu nháy đơn để ô luôn là chữ.
function csvCell(value: string | number | null | undefined): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = value ?? '';
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Danh sách tem dạng CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt): mã hàng, mã vạch, tên hàng,
 * giá bán, số tem — mỗi mã một dòng, bỏ các dòng có số tem 0.
 */
export function buildLabelListCsv(items: LabelSource[]): string {
  const rows = items
    .map((item) => ({ item, quantity: normalizeQuantity(item.quantity) }))
    .filter(({ quantity }) => quantity > 0)
    .map(({ item, quantity }) =>
      [
        (item.code ?? '').trim(),
        (item.barcode ?? '').trim(),
        item.name,
        item.price === null || item.price === undefined ? '' : Math.round(item.price),
        quantity,
      ]
        .map(csvCell)
        .join(',')
    );

  return `${UTF8_BOM}${['Mã hàng,Mã vạch,Tên hàng,Giá bán,Số tem', ...rows].join('\r\n')}\r\n`;
}
