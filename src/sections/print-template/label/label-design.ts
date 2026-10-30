import {
  LABEL_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  normalizeTemplate,
  TEMPLATE_NUMBER_FIELDS,
} from 'src/sections/pos/label-print/label-template';

import type { LabelTemplate } from 'src/sections/pos/label-print/label-template';

import { isSafeImageSrc } from '../print-image';

// ----------------------------------------------------------------------
// Bố cục tem mã tự thiết kế (lưu ở `content` của mẫu tem, dạng JSON):
//  - `paper`: khổ giấy + lưới tem — đúng kiểu LabelTemplate của in tem hệ thống (giấy cuộn / giấy tờ, số cột, khe, lề),
//    chọn từ các khổ có sẵn rồi chỉnh được từng số;
//  - `elements`: các phần tử đặt tự do trên MỘT tem, toạ độ mm tính từ góc trên-trái tem: chữ (có trường {{ma}}), mã vạch,
//    mã QR, đường kẻ, khung viền. Mọi tem của một lần in dùng cùng bố cục, chỉ khác dữ liệu.
// Không React / DOM — kiểu dữ liệu, trường, bố cục gợi ý và chuẩn hoá JSON đọc về.
// ----------------------------------------------------------------------

export type LabelElementType = 'text' | 'barcode' | 'qrcode' | 'line' | 'box' | 'image';

export type LabelTextAlign = 'left' | 'center' | 'right';

/** Giá trị đem mã hoá: mã vạch (không có thì mã hàng), hoặc luôn là mã hàng. */
export type LabelCodeSource = 'barcode-or-code' | 'code';

/** Độ rộng 1 module của mã vạch (điểm in 203 dpi); 0 = tự chọn lớn nhất còn vừa khung. */
export type LabelElementModuleDots = 0 | 1 | 2 | 3;

export type LabelElement = {
  id: string;
  type: LabelElementType;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  /** Chữ: nội dung có trường, vd "{{product_name}}", "Giá: {{final_price}}". QR tự do: nội dung đem mã hoá. */
  text?: string;
  fontPt?: number;
  bold?: boolean;
  italic?: boolean;
  /** Gạch ngang chữ (giá gốc khi có giảm giá). */
  strike?: boolean;
  align?: LabelTextAlign;
  /** Số dòng tối đa, dòng cuối tự thêm "…". */
  maxLines?: number;
  /** Mã vạch / QR: lấy từ mã vạch hay mã hàng; QR thêm 'custom' = mã hoá `text`. */
  source?: LabelCodeSource | 'custom';
  /** Mã vạch: in dãy số / chữ bên dưới vạch. */
  showText?: boolean;
  moduleDots?: LabelElementModuleDots;
  /** Đường kẻ / khung: độ dày nét (mm). */
  strokeMm?: number;
  /** Ảnh tải lên (https://<tên miền>/media/print-templates/…). */
  src?: string;
  /** Ảnh là logo cửa hàng: không lưu src, khi in lấy logo hiện tại. */
  logo?: boolean;
};

export type LabelPriceSuffix = 'đ' | 'VND' | 'none';

export type LabelDesign = {
  version: 1;
  /** Khổ có sẵn đã chọn (LABEL_TEMPLATES.id) hoặc 'custom'. */
  presetId: string;
  paper: LabelTemplate;
  elements: LabelElement[];
  priceSuffix: LabelPriceSuffix;
  /** Thêm đơn vị sau giá ("185.000đ/cái"). */
  priceWithUnit: boolean;
};

// ── Trường ────────────────────────────────────────────────────────────────

export type LabelFieldDef = {
  key: string;
  label: string;
  sample: string;
  hint?: string;
  /** Kiểu chữ mặc định khi kéo trường vào tem. */
  style?: Partial<Pick<LabelElement, 'fontPt' | 'bold' | 'strike' | 'maxLines' | 'align'>>;
};

export const LABEL_FIELD_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Hàng hoá', keys: ['product_name', 'product_code', 'barcode_value', 'unit'] },
  {
    label: 'Giá & giảm giá',
    keys: ['final_price', 'price', 'original_price', 'discount_percent', 'discount_amount'],
  },
  {
    label: 'Cửa hàng & kho',
    keys: ['store_name', 'warehouse_name', 'warehouse_address', 'warehouse_phone'],
  },
  { label: 'Khác', keys: ['print_date'] },
];

export const LABEL_FIELDS: LabelFieldDef[] = [
  {
    key: 'product_name',
    label: 'Tên hàng',
    sample: 'Kẹp tóc nơ nhung đỏ',
    style: { fontPt: 8, bold: true, maxLines: 2 },
  },
  { key: 'product_code', label: 'Mã hàng', sample: 'K35' },
  {
    key: 'barcode_value',
    label: 'Mã in vạch',
    sample: '8938505974194',
    hint: 'Mã vạch, không có thì mã hàng',
  },
  { key: 'unit', label: 'Đơn vị tính', sample: 'cái' },
  {
    key: 'final_price',
    label: 'Giá bán (sau giảm)',
    sample: '28.000đ',
    hint: 'Có giảm giá thì là giá đã giảm',
    style: { fontPt: 10, bold: true },
  },
  { key: 'price', label: 'Giá niêm yết', sample: '35.000đ', style: { fontPt: 9, bold: true } },
  {
    key: 'original_price',
    label: 'Giá gốc (gạch ngang)',
    sample: '35.000đ',
    hint: 'Chỉ hiện khi có giảm giá',
    style: { fontPt: 7, strike: true },
  },
  {
    key: 'discount_percent',
    label: '% giảm',
    sample: '-20%',
    hint: 'Chỉ hiện khi có giảm giá',
    style: { fontPt: 9, bold: true },
  },
  {
    key: 'discount_amount',
    label: 'Số tiền giảm',
    sample: '-7.000đ',
    hint: 'Chỉ hiện khi có giảm giá',
  },
  { key: 'store_name', label: 'Tên cửa hàng', sample: 'CiCi', style: { fontPt: 6 } },
  {
    key: 'warehouse_name',
    label: 'Tên kho / chi nhánh',
    sample: 'Kho Chùa Láng',
    style: { fontPt: 6 },
  },
  {
    key: 'warehouse_address',
    label: 'Địa chỉ kho',
    sample: '21 Chùa Láng, Đống Đa',
    style: { fontPt: 6, maxLines: 2 },
  },
  { key: 'warehouse_phone', label: 'SĐT kho', sample: '0901 234 567', style: { fontPt: 6 } },
  { key: 'print_date', label: 'Ngày in', sample: '29/10/2026', style: { fontPt: 6 } },
];

export const LABEL_FIELD_BY_KEY = new Map(LABEL_FIELDS.map((field) => [field.key, field]));

export const LABEL_SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  LABEL_FIELDS.map((field) => [field.key, field.sample])
);

// ── Mặc định ──────────────────────────────────────────────────────────────

export const GRID_MM = 0.5;
export const MIN_ELEMENT_MM = 1;

let idCounter = 0;

export function newElementId(): string {
  idCounter += 1;
  return `el-${Date.now().toString(36)}-${idCounter}`;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Về lưới điểm in 203 dpi (0,125 mm) — số gọn để sửa và đúng lưới khi in. */
const dot = (value: number) => Math.round(value * 8) / 8;

export function presetPaper(presetId: string): LabelTemplate {
  const preset = LABEL_TEMPLATES.find((template) => template.id === presetId);
  return normalizeTemplate({
    ...(preset ?? LABEL_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!),
  });
}

/**
 * Bố cục gợi ý cho khổ tem: tem dài và thấp (bố cục 'split') → mã vạch nửa trái, tên + giá nửa phải; còn lại xếp dọc:
 * tên (2 dòng) → mã vạch (kèm mã) → giá.
 */
export function suggestedElements(paper: LabelTemplate): LabelElement[] {
  const pad = Math.max(0.5, paper.paddingMm);
  const usableW =
    (paper.printWidthMm > 0
      ? Math.min(paper.printWidthMm, paper.labelWidthMm)
      : paper.labelWidthMm) -
    pad * 2;
  const usableH = paper.labelHeightMm - pad * 2;
  const namePt = paper.namePt;
  const pricePt = paper.pricePt;
  const lineMm = (pt: number) => dot(pt * 0.3528 * 1.25);

  if (paper.layout === 'split') {
    const half = dot(usableW / 2);
    return [
      {
        id: newElementId(),
        type: 'barcode',
        xMm: pad,
        yMm: pad,
        wMm: half - 0.5,
        hMm: usableH,
        source: 'barcode-or-code',
        showText: true,
        moduleDots: 0,
      },
      {
        id: newElementId(),
        type: 'text',
        xMm: dot(pad + half),
        yMm: pad,
        wMm: half,
        hMm: dot(usableH * 0.6),
        text: '{{product_name}}',
        fontPt: namePt,
        bold: true,
        maxLines: 2,
        align: 'center',
      },
      {
        id: newElementId(),
        type: 'text',
        xMm: dot(pad + half),
        yMm: dot(pad + usableH * 0.6),
        wMm: half,
        hMm: dot(usableH * 0.4),
        text: '{{final_price}}',
        fontPt: pricePt,
        bold: true,
        maxLines: 1,
        align: 'center',
      },
    ];
  }

  const nameH = Math.min(dot(lineMm(namePt) * 2), dot(usableH * 0.35));
  const priceH = Math.min(lineMm(pricePt), dot(usableH * 0.25));
  const barcodeH = dot(usableH - nameH - priceH - 0.5);
  return [
    {
      id: newElementId(),
      type: 'text',
      xMm: pad,
      yMm: pad,
      wMm: dot(usableW),
      hMm: nameH,
      text: '{{product_name}}',
      fontPt: namePt,
      bold: true,
      maxLines: 2,
      align: 'center',
    },
    {
      id: newElementId(),
      type: 'barcode',
      xMm: pad,
      yMm: dot(pad + nameH + 0.25),
      wMm: dot(usableW),
      hMm: barcodeH,
      source: 'barcode-or-code',
      showText: true,
      moduleDots: 0,
    },
    {
      id: newElementId(),
      type: 'text',
      xMm: pad,
      yMm: dot(pad + usableH - priceH),
      wMm: dot(usableW),
      hMm: priceH,
      text: '{{final_price}}',
      fontPt: pricePt,
      bold: true,
      maxLines: 1,
      align: 'center',
    },
  ];
}

export function defaultLabelDesign(presetId: string = DEFAULT_TEMPLATE_ID): LabelDesign {
  const paper = presetPaper(presetId);
  return {
    version: 1,
    presetId,
    paper,
    elements: suggestedElements(paper),
    priceSuffix: 'đ',
    priceWithUnit: false,
  };
}

/** Phần tử mới khi kéo / bấm từ bảng phần tử, đặt ở (x, y) — kích thước mặc định theo loại, kẹp trong tem. */
export function createElement(
  type: LabelElementType,
  paper: LabelTemplate,
  at: { xMm: number; yMm: number },
  fieldKey?: string
): LabelElement {
  const field = fieldKey ? LABEL_FIELD_BY_KEY.get(fieldKey) : undefined;
  const fontPt = field?.style?.fontPt ?? 7;
  const sizes: Record<LabelElementType, { w: number; h: number }> = {
    text: {
      w: Math.min(paper.labelWidthMm - 1, 25),
      h: dot(fontPt * 0.3528 * 1.25 * (field?.style?.maxLines ?? 1) + 0.5),
    },
    barcode: { w: Math.min(paper.labelWidthMm - 1, 30), h: Math.min(paper.labelHeightMm - 1, 10) },
    qrcode: { w: Math.min(paper.labelHeightMm - 1, 14), h: Math.min(paper.labelHeightMm - 1, 14) },
    line: { w: Math.min(paper.labelWidthMm - 1, 20), h: 0.3 },
    box: { w: Math.min(paper.labelWidthMm - 1, 20), h: Math.min(paper.labelHeightMm - 1, 8) },
    image: { w: Math.min(paper.labelWidthMm - 1, 12), h: Math.min(paper.labelHeightMm - 1, 8) },
  };
  const size = sizes[type];
  const element: LabelElement = {
    id: newElementId(),
    type,
    xMm: 0,
    yMm: 0,
    wMm: dot(size.w),
    hMm: dot(size.h),
  };
  if (type === 'text') {
    Object.assign(element, {
      text: fieldKey ? `{{${fieldKey}}}` : 'Chữ',
      fontPt,
      bold: field?.style?.bold ?? false,
      strike: field?.style?.strike ?? false,
      maxLines: field?.style?.maxLines ?? 1,
      align: field?.style?.align ?? 'center',
    });
  }
  if (type === 'barcode')
    Object.assign(element, { source: 'barcode-or-code', showText: true, moduleDots: 0 });
  if (type === 'qrcode') Object.assign(element, { source: 'barcode-or-code' });
  if (type === 'line' || type === 'box') Object.assign(element, { strokeMm: 0.3 });
  return clampElement({ ...element, xMm: at.xMm, yMm: at.yMm }, paper);
}

/** Giữ phần tử nằm trong tem và không nhỏ hơn MIN_ELEMENT_MM (đường kẻ được mảnh tới 0,1 mm). */
export function clampElement(
  element: LabelElement,
  paper: Pick<LabelTemplate, 'labelWidthMm' | 'labelHeightMm'>
): LabelElement {
  const min = element.type === 'line' ? 0.1 : MIN_ELEMENT_MM;
  const wMm = round(Math.min(paper.labelWidthMm, Math.max(min, element.wMm)));
  const hMm = round(Math.min(paper.labelHeightMm, Math.max(min, element.hMm)));
  return {
    ...element,
    wMm,
    hMm,
    xMm: round(Math.min(paper.labelWidthMm - wMm, Math.max(0, element.xMm))),
    yMm: round(Math.min(paper.labelHeightMm - hMm, Math.max(0, element.yMm))),
  };
}

// ── Đọc JSON ──────────────────────────────────────────────────────────────

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const TYPES: LabelElementType[] = ['text', 'barcode', 'qrcode', 'line', 'box', 'image'];

function normalizePaper(raw: unknown, presetId: string): LabelTemplate {
  const base = presetPaper(presetId);
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Record<string, unknown>;
  const paper: LabelTemplate = { ...base };
  TEMPLATE_NUMBER_FIELDS.forEach(({ key, min, max }) => {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value))
      paper[key] = Math.min(max, Math.max(min, value));
  });
  if (input.kind === 'roll' || input.kind === 'sheet') paper.kind = input.kind;
  if (input.layout === 'stacked' || input.layout === 'split') paper.layout = input.layout;
  paper.id = presetId;
  return normalizeTemplate(paper);
}

function normalizeElement(raw: unknown, paper: LabelTemplate): LabelElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const type = TYPES.includes(input.type as LabelElementType)
    ? (input.type as LabelElementType)
    : null;
  if (!type) return null;
  const element: LabelElement = {
    id: typeof input.id === 'string' && input.id ? input.id.slice(0, 64) : newElementId(),
    type,
    xMm: num(input.xMm, 0),
    yMm: num(input.yMm, 0),
    wMm: num(input.wMm, 10),
    hMm: num(input.hMm, 5),
  };
  if (typeof input.text === 'string') element.text = input.text.slice(0, 500);
  if (typeof input.fontPt === 'number')
    element.fontPt = Math.min(48, Math.max(4, num(input.fontPt, 7)));
  if (typeof input.bold === 'boolean') element.bold = input.bold;
  if (typeof input.italic === 'boolean') element.italic = input.italic;
  if (typeof input.strike === 'boolean') element.strike = input.strike;
  if (input.align === 'left' || input.align === 'center' || input.align === 'right')
    element.align = input.align;
  if (typeof input.maxLines === 'number')
    element.maxLines = Math.min(5, Math.max(1, Math.round(input.maxLines)));
  if (input.source === 'barcode-or-code' || input.source === 'code' || input.source === 'custom')
    element.source = input.source;
  if (typeof input.showText === 'boolean') element.showText = input.showText;
  if (
    input.moduleDots === 0 ||
    input.moduleDots === 1 ||
    input.moduleDots === 2 ||
    input.moduleDots === 3
  )
    element.moduleDots = input.moduleDots;
  if (typeof input.strokeMm === 'number')
    element.strokeMm = Math.min(3, Math.max(0.1, input.strokeMm));
  if (type === 'image') {
    // Chỉ ảnh của cửa hàng; logo không mang src. Ảnh không hợp lệ thì bỏ phần tử.
    if (input.logo === true) element.logo = true;
    else if (typeof input.src === 'string' && isSafeImageSrc(input.src))
      element.src = input.src.trim();
    else return null;
  }
  return clampElement(element, paper);
}

/** JSON (chuỗi hoặc đối tượng) bất kỳ → bố cục hợp lệ; hỏng thì về bố cục gợi ý của khổ mặc định. */
export function parseLabelDesign(input: unknown): LabelDesign {
  let raw: Record<string, unknown> | null = null;
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input || '{}') : input;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      raw = parsed as Record<string, unknown>;
  } catch {
    raw = null;
  }
  if (!raw || !raw.paper) return defaultLabelDesign();

  const presetId =
    typeof raw.presetId === 'string' && raw.presetId ? raw.presetId : DEFAULT_TEMPLATE_ID;
  const paper = normalizePaper(raw.paper, presetId);
  const elements = (Array.isArray(raw.elements) ? raw.elements : [])
    .slice(0, 60)
    .map((element) => normalizeElement(element, paper))
    .filter((element): element is LabelElement => element !== null);
  return {
    version: 1,
    presetId,
    paper,
    elements,
    priceSuffix: raw.priceSuffix === 'VND' || raw.priceSuffix === 'none' ? raw.priceSuffix : 'đ',
    priceWithUnit: raw.priceWithUnit === true,
  };
}

export function serializeLabelDesign(design: LabelDesign): string {
  return JSON.stringify(design);
}

/** Mô tả khổ ngắn gọn: "Cuộn 2 tem 35×22 mm". */
export function paperSummary(paper: LabelTemplate): string {
  const size = `${String(paper.labelWidthMm).replace('.', ',')}×${String(paper.labelHeightMm).replace('.', ',')} mm`;
  if (paper.kind === 'roll') return `Cuộn ${paper.columns} tem ${size}`;
  return `Tờ ${paper.columns * paper.rows} tem ${size}`;
}
