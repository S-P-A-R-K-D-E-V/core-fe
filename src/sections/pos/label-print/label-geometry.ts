import { totalModules } from './barcode';

import type { EncodedBarcode } from './barcode';
import type { ModuleDots, LabelOptions, LabelTemplate, LabelCalibration } from './label-template';

// ----------------------------------------------------------------------
// Hình học theo ĐIỂM IN của máy in tem nhiệt: 203 dpi = 8 điểm / mm, tức 1 điểm = 0,125 mm.
//
// Nguyên tắc để vạch không bị driver co giãn (resample) làm mờ / lệch:
//  - 1 module = số NGUYÊN điểm in (1, 2 hoặc 3; mặc định 2 = 0,25 mm);
//  - mọi vạch có x và độ rộng là bội nguyên của module → bội nguyên của điểm in;
//  - trên giấy CUỘN mọi toạ độ của trang (vị trí tem, mã vạch) được làm tròn về lưới 0,125 mm;
//  - mã không vừa tem thì BÁO LỖI, không thu nhỏ theo tỉ lệ lẻ.
// Giấy TỜ (A4 / A5, máy laser hay in phun): module vẫn là một bề rộng cố định tính bằng mm (0,125 /
// 0,25 / 0,375 mm) và không bao giờ co giãn theo tem; vị trí các tem giữ đúng số mm của mẫu (không làm
// tròn về lưới điểm in, để sai số không dồn qua 13 hàng tem).
// Tính toán bên trong một tem dùng số nguyên điểm in rồi mới đổi ra mm, để không dính sai số số thực.
// ----------------------------------------------------------------------

export const DOTS_PER_MM = 8;

export const mmToDots = (mm: number): number => Math.round(mm * DOTS_PER_MM);

export const dotsToMm = (dots: number): number => dots / DOTS_PER_MM;

/** Làm tròn về điểm in gần nhất. */
export const snapMm = (mm: number): number => dotsToMm(mmToDots(mm));

const round3 = (mm: number): number => Math.round(mm * 1000) / 1000;

/** "35,75" — hiện cho người dùng (dấu phẩy thập phân, bỏ số 0 thừa). */
export function formatMm(mm: number): string {
  return String(round3(mm)).replace('.', ',');
}

/** "35.75mm" — dùng trong CSS / SVG. */
export function cssMm(mm: number): string {
  return `${round3(mm)}mm`;
}

/** "2 điểm" với giấy cuộn, "0,25 mm" với giấy tờ. */
export function moduleWidthText(template: Pick<LabelTemplate, 'kind'>, moduleDots: ModuleDots): string {
  return template.kind === 'sheet' ? `${formatMm(dotsToMm(moduleDots))} mm` : `${moduleDots} điểm`;
}

// ── Mã vạch → vạch theo điểm in ───────────────────────────────────────────

export type BarRect = { x: number; width: number };

/** Bề rộng cả mã vạch, GỒM vùng trắng hai bên, tính bằng điểm in. */
export function barcodeWidthDots(barcode: EncodedBarcode, moduleDots: ModuleDots): number {
  return totalModules(barcode) * moduleDots;
}

/**
 * Các vạch đen (đã gộp các module đen liền nhau) theo điểm in; x tính từ mép trái của vùng trắng trái.
 * x và width luôn là bội nguyên của moduleDots.
 */
export function barcodeBars(barcode: EncodedBarcode, moduleDots: ModuleDots): BarRect[] {
  const bars: BarRect[] = [];
  const { modules, quietLeft } = barcode;
  let index = 0;
  while (index < modules.length) {
    if (modules[index] === '1') {
      let end = index;
      while (modules[end] === '1') end += 1;
      bars.push({ x: (quietLeft + index) * moduleDots, width: (end - index) * moduleDots });
      index = end;
    } else {
      index += 1;
    }
  }
  return bars;
}

// ── Vùng in bên trong một tem ─────────────────────────────────────────────

type Zone = { left: number; width: number };

/** Bề rộng được in tính từ mép trái tem (điểm in): cả tem, hoặc `printWidthMm` nếu mẫu có giới hạn. */
function printLimitDots(template: LabelTemplate): number {
  const label = mmToDots(template.labelWidthMm);
  return template.printWidthMm > 0 ? Math.min(label, mmToDots(template.printWidthMm)) : label;
}

/** Vùng dành cho mã vạch + mã, và vùng dành cho chữ (tên cửa hàng, tên hàng, giá). */
function contentZones(template: LabelTemplate): { barcode: Zone; text: Zone } {
  const padding = mmToDots(template.paddingMm);
  const limit = printLimitDots(template);

  if (template.layout === 'split') {
    const half = Math.floor(limit / 2);
    return {
      barcode: { left: padding, width: Math.max(0, half - 2 * padding) },
      text: { left: half + padding, width: Math.max(0, limit - half - 2 * padding) },
    };
  }

  const zone = { left: padding, width: Math.max(0, limit - 2 * padding) };
  return { barcode: zone, text: zone };
}

/** Bề rộng dành cho mã vạch bên trong một tem (đã trừ lề trong), tính bằng điểm in. */
export function printableWidthDots(template: LabelTemplate): number {
  return contentZones(template).barcode.width;
}

export type BarcodeFit =
  | {
      fits: true;
      widthDots: number;
      widthMm: number;
      availableMm: number;
      /** Mép trái của mã vạch (kể cả vùng trắng) so với mép trái tem — đã căn giữa, đúng lưới điểm in. */
      leftMm: number;
    }
  | { fits: false; widthDots: number; widthMm: number; availableMm: number; message: string };

/** Mã vạch ở độ rộng module đã chọn có vừa vùng dành cho mã vạch của tem không. */
export function fitBarcode(
  barcode: EncodedBarcode,
  template: LabelTemplate,
  moduleDots: ModuleDots
): BarcodeFit {
  const zone = contentZones(template).barcode;
  const widthDots = barcodeWidthDots(barcode, moduleDots);
  const widthMm = dotsToMm(widthDots);
  const availableMm = dotsToMm(zone.width);

  if (widthDots <= zone.width) {
    const leftDots = zone.left + Math.floor((zone.width - widthDots) / 2);
    return { fits: true, widthDots, widthMm, availableMm, leftMm: dotsToMm(leftDots) };
  }

  // Gợi ý độ rộng vạch nhỏ hơn mà vừa (lớn nhất có thể); không có thì chỉ còn cách đổi mẫu tem.
  const smaller = ([2, 1] as ModuleDots[]).find(
    (dots) => dots < moduleDots && barcodeWidthDots(barcode, dots) <= zone.width
  );
  const advice = smaller
    ? `Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống ${moduleWidthText(template, smaller)}.`
    : 'Chọn mẫu tem rộng hơn.';

  return {
    fits: false,
    widthDots,
    widthMm,
    availableMm,
    message: `Mã quá dài cho khổ tem này: cần ${formatMm(widthMm)} mm, tem chỉ in được ${formatMm(availableMm)} mm. ${advice}`,
  };
}

// ── Bố cục bên trong một tem ──────────────────────────────────────────────

const MM_PER_PT = 25.4 / 72;

// Tên hàng tiếng Việt có dấu chồng ("Ấ", "ể"): nét dấu vượt lên trên hộp dòng của chính nó khoảng 0,1 em.
//  - dòng cao 1,35 lần cỡ chữ để phần trống trên / dưới mỗi dòng chứa được nét dấu đó;
//  - chừa thêm NAME_INK_EM phía trên dòng đầu;
//  - cắt NAME_CLIP_EM ở đáy khối tên: khi tên dài hơn số dòng cho phép, nét dấu của dòng bị ẩn kế tiếp
//    không ló vào tem (dải bị cắt là khoảng trống dưới chân chữ của dòng cuối, không có mực).
const NAME_LINE_FACTOR = 1.35;
const NAME_INK_EM = 0.1;
const NAME_CLIP_EM = 0.09;
const TEXT_LINE_FACTOR = 1.1;
const GAP_TEXT_BARCODE_DOTS = 2;
const GAP_BARCODE_CODE_DOTS = 1;

/** Vạch thấp hơn mức này thì máy quét khó đọc. */
export const MIN_BARCODE_HEIGHT_MM = 4;
export const MAX_NAME_LINES = 2;

const MIN_BARCODE_ZONE_MM = 10;
const MIN_TEXT_ZONE_MM = 8;

const lineHeightDots = (pt: number, factor: number) => Math.ceil(pt * MM_PER_PT * factor * DOTS_PER_MM);

/** Cỡ chữ tên cửa hàng: nhỏ hơn mã 1 pt, không dưới 6 pt. */
export function storeNamePt(template: Pick<LabelTemplate, 'codePt'>): number {
  return Math.max(6, template.codePt - 1);
}

/** Một khối nội dung, toạ độ so với góc trên-trái của tem. */
export type LabelBlock = { leftMm: number; topMm: number; widthMm: number; heightMm: number };

export type LabelLayout = {
  store: LabelBlock | null;
  name:
    | (LabelBlock & {
        lines: number;
        lineHeightMm: number;
        /** Khoảng chừa phía trên dòng đầu cho dấu chồng. */
        inkTopMm: number;
        /** Dải cắt bỏ ở đáy khối tên (xem NAME_CLIP_EM). */
        clipBottomMm: number;
      })
    | null;
  /** Dải dành cho mã vạch: mã được căn giữa theo chiều ngang trong dải này (xem fitBarcode). */
  barcode: LabelBlock & { heightDots: number };
  code: LabelBlock;
  price: LabelBlock | null;
};

export type LabelLayoutResult = { ok: true; layout: LabelLayout } | { ok: false; error: string };

const block = (zone: Zone, top: number, height: number): LabelBlock => ({
  leftMm: dotsToMm(zone.left),
  topMm: dotsToMm(top),
  widthMm: dotsToMm(zone.width),
  heightMm: dotsToMm(height),
});

/**
 * 'stacked' — xếp từ trên xuống: tên cửa hàng → tên hàng (tối đa 2 dòng) → mã vạch → mã đọc bằng mắt →
 * giá; mã vạch nhận hết phần chiều cao còn lại.
 * 'split' — nửa trái: mã vạch + mã; nửa phải: tên cửa hàng, tên hàng, giá (căn giữa theo chiều dọc).
 * Không đủ chỗ thì rút tên còn 1 dòng, vẫn thiếu thì báo lỗi — không bao giờ tự bỏ bớt nội dung.
 */
export function computeLabelLayout(template: LabelTemplate, options: LabelOptions): LabelLayoutResult {
  const zones = contentZones(template);
  const padding = mmToDots(template.paddingMm);
  const available = mmToDots(template.labelHeightMm) - 2 * padding;
  const split = template.layout === 'split';

  if (zones.barcode.width < mmToDots(MIN_BARCODE_ZONE_MM) || zones.text.width < mmToDots(MIN_TEXT_ZONE_MM)) {
    return {
      ok: false,
      error: split
        ? 'Tem quá hẹp: mỗi nửa của vùng in phải rộng ít nhất 10 mm.'
        : 'Tem quá hẹp: phần in được phải rộng ít nhất 10 mm.',
    };
  }

  const nameLine = lineHeightDots(template.namePt, NAME_LINE_FACTOR);
  const codeHeight = lineHeightDots(template.codePt, TEXT_LINE_FACTOR);
  const storeHeight = options.showStoreName
    ? lineHeightDots(storeNamePt(template), TEXT_LINE_FACTOR)
    : 0;
  const priceHeight = options.showPrice ? lineHeightDots(template.pricePt, TEXT_LINE_FACTOR) : 0;
  const minBarcode = mmToDots(MIN_BARCODE_HEIGHT_MM);
  const nameInkTop = lineHeightDots(template.namePt, NAME_INK_EM);
  const nameHeightOf = (lines: number) => (lines > 0 ? nameInkTop + lines * nameLine : 0);

  const tooLow = (what: string, shortBy: number) => ({
    ok: false as const,
    error: `Tem cao ${formatMm(template.labelHeightMm)} mm không đủ chỗ cho ${what} (thiếu ${formatMm(dotsToMm(shortBy))} mm). Tắt bớt tên hoặc giá, giảm cỡ chữ, hoặc tăng chiều cao tem.`,
  });

  // Thử 2 dòng tên trước, không đủ chỗ thì 1 dòng (không in tên: 0 dòng).
  let lines = options.showName ? MAX_NAME_LINES : 0;
  let barcodeHeight = 0;
  let textHeight = 0;
  let gapAbove = 0;
  const fits = () => {
    textHeight = storeHeight + nameHeightOf(lines);
    if (split) {
      barcodeHeight = available - GAP_BARCODE_CODE_DOTS - codeHeight;
      return textHeight + priceHeight <= available;
    }
    gapAbove = textHeight > 0 ? GAP_TEXT_BARCODE_DOTS : 0;
    barcodeHeight = available - textHeight - gapAbove - GAP_BARCODE_CODE_DOTS - codeHeight - priceHeight;
    return barcodeHeight >= minBarcode;
  };
  while (!fits() && lines > 1) lines -= 1;

  if (barcodeHeight < minBarcode) return tooLow('mã vạch', minBarcode - barcodeHeight);
  if (split && textHeight + priceHeight > available) {
    return tooLow('tên và giá bên cạnh mã vạch', textHeight + priceHeight - available);
  }

  const nameMetrics = {
    lines,
    lineHeightMm: dotsToMm(nameLine),
    inkTopMm: dotsToMm(nameInkTop),
    clipBottomMm: round3(template.namePt * MM_PER_PT * NAME_CLIP_EM),
  };
  const nameHeight = nameHeightOf(lines);

  if (split) {
    const textTop = padding + Math.floor((available - textHeight - priceHeight) / 2);
    const codeTop = padding + barcodeHeight + GAP_BARCODE_CODE_DOTS;
    return {
      ok: true,
      layout: {
        store: storeHeight ? block(zones.text, textTop, storeHeight) : null,
        name: lines > 0 ? { ...block(zones.text, textTop + storeHeight, nameHeight), ...nameMetrics } : null,
        barcode: { ...block(zones.barcode, padding, barcodeHeight), heightDots: barcodeHeight },
        code: block(zones.barcode, codeTop, codeHeight),
        price: priceHeight ? block(zones.text, textTop + textHeight, priceHeight) : null,
      },
    };
  }

  const nameTop = padding + storeHeight;
  const barcodeTop = nameTop + nameHeight + gapAbove;
  const codeTop = barcodeTop + barcodeHeight + GAP_BARCODE_CODE_DOTS;
  return {
    ok: true,
    layout: {
      store: storeHeight ? block(zones.text, padding, storeHeight) : null,
      name: lines > 0 ? { ...block(zones.text, nameTop, nameHeight), ...nameMetrics } : null,
      barcode: { ...block(zones.barcode, barcodeTop, barcodeHeight), heightDots: barcodeHeight },
      code: block(zones.barcode, codeTop, codeHeight),
      price: priceHeight ? block(zones.text, codeTop + codeHeight, priceHeight) : null,
    },
  };
}

// ── Lưới tem trên một trang ───────────────────────────────────────────────

/** Số hàng tem trên một trang: giấy cuộn luôn 1. */
export function gridRows(template: LabelTemplate): number {
  return template.kind === 'roll' ? 1 : Math.max(1, Math.floor(template.rows));
}

export function gridColumns(template: LabelTemplate): number {
  return Math.max(1, Math.floor(template.columns));
}

/** Số tem của một trang in = số hàng × số tem mỗi hàng. */
export function labelsPerPage(template: LabelTemplate): number {
  return gridRows(template) * gridColumns(template);
}

// Giấy cuộn: mọi số đo về lưới điểm in. Giấy tờ: giữ đúng số mm.
const pageUnit = (template: LabelTemplate) => (template.kind === 'roll' ? snapMm : round3);

/** Khổ trang in. Giấy cuộn: khổ cuộn × chiều cao một tem. Giấy tờ: rộng × cao của tờ. */
export function pageSizeMm(template: LabelTemplate): { widthMm: number; heightMm: number } {
  const unit = pageUnit(template);
  return {
    widthMm: unit(template.pageWidthMm),
    heightMm: unit(template.kind === 'roll' ? template.labelHeightMm : template.pageHeightMm),
  };
}

/**
 * Góc trên-trái của từng ô tem trên trang, theo thứ tự in (trái → phải, trên → xuống), đã cộng căn
 * chỉnh: lệch trái / lệch trên dịch cả trang, khe cột / khe hàng thêm cộng dồn theo cột / hàng.
 */
export function labelOrigins(
  template: LabelTemplate,
  calibration: LabelCalibration
): Array<{ leftMm: number; topMm: number }> {
  const unit = pageUnit(template);
  const rows = gridRows(template);
  const columns = gridColumns(template);

  const left = unit(template.marginLeftMm) + unit(calibration.offsetLeftMm);
  const top = unit(template.marginTopMm) + unit(calibration.offsetTopMm);
  const pitchX =
    unit(template.labelWidthMm) + unit(template.columnGapMm) + unit(calibration.extraColumnGapMm);
  const pitchY =
    unit(template.labelHeightMm) + unit(template.rowGapMm) + unit(calibration.extraRowGapMm ?? 0);

  return Array.from({ length: rows * columns }, (_, index) => ({
    leftMm: round3(left + (index % columns) * pitchX),
    topMm: round3(top + Math.floor(index / columns) * pitchY),
  }));
}
