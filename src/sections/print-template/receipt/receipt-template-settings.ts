// ----------------------------------------------------------------------
// Thiết lập trang của mẫu hoá đơn (lưu ở `settings` của mẫu, dạng JSON): khổ giấy, lề, chữ, kẻ bảng / kẻ ngang.
//  - Giấy cuộn 80 / 58 mm (máy in nhiệt): trang rộng bằng khổ cuộn, cao theo nội dung (đo khi dựng trang in).
//  - Giấy tờ A5 / A4 (máy in văn phòng): trang cố định, lề đặt bằng @page.
// Mọi số đọc từ JSON đều được kẹp về khoảng hợp lệ — mẫu hỏng vẫn in được.
// ----------------------------------------------------------------------

export type ReceiptTemplatePaper = '80' | '58' | 'A5' | 'A4';

export type ReceiptFontFamily = 'sans' | 'serif' | 'mono';

/** Kẻ bảng: không kẻ, chỉ kẻ ngang giữa các hàng, kẻ đủ ô. */
export type ReceiptTableBorder = 'none' | 'rows' | 'all';

export type ReceiptRuleStyle = 'dashed' | 'solid' | 'dotted';

export type ReceiptTemplateSettings = {
  paper: ReceiptTemplatePaper;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  fontSizePt: number;
  fontFamily: ReceiptFontFamily;
  lineHeight: number;
  tableBorder: ReceiptTableBorder;
  ruleStyle: ReceiptRuleStyle;
};

export type ReceiptPaperInfo = {
  label: string;
  widthMm: number;
  /** Giấy tờ có chiều cao cố định; giấy cuộn = null (cao theo nội dung). */
  heightMm: number | null;
  defaults: Pick<
    ReceiptTemplateSettings,
    'marginTopMm' | 'marginRightMm' | 'marginBottomMm' | 'marginLeftMm' | 'fontSizePt'
  >;
};

// Giấy cuộn: lề trái / phải 4 mm (80) và 5 mm (58) → vùng in 72 / 48 mm như phiếu hệ thống.
export const RECEIPT_TEMPLATE_PAPERS: Record<ReceiptTemplatePaper, ReceiptPaperInfo> = {
  '80': {
    label: 'Giấy cuộn 80 mm',
    widthMm: 80,
    heightMm: null,
    defaults: {
      marginTopMm: 2,
      marginRightMm: 4,
      marginBottomMm: 3,
      marginLeftMm: 4,
      fontSizePt: 9.5,
    },
  },
  '58': {
    label: 'Giấy cuộn 58 mm',
    widthMm: 58,
    heightMm: null,
    defaults: {
      marginTopMm: 2,
      marginRightMm: 5,
      marginBottomMm: 3,
      marginLeftMm: 5,
      fontSizePt: 8.5,
    },
  },
  A5: {
    label: 'Khổ A5 (148 × 210 mm)',
    widthMm: 148,
    heightMm: 210,
    defaults: {
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      fontSizePt: 10,
    },
  },
  A4: {
    label: 'Khổ A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    defaults: {
      marginTopMm: 15,
      marginRightMm: 15,
      marginBottomMm: 15,
      marginLeftMm: 15,
      fontSizePt: 11,
    },
  },
};

export const RECEIPT_TEMPLATE_PAPER_KEYS = Object.keys(
  RECEIPT_TEMPLATE_PAPERS
) as ReceiptTemplatePaper[];

export const RECEIPT_FONT_STACKS: Record<ReceiptFontFamily, { label: string; css: string }> = {
  sans: { label: 'Không chân (Arial)', css: 'Arial,"Segoe UI",Tahoma,sans-serif' },
  serif: { label: 'Có chân (Times)', css: '"Times New Roman",Times,serif' },
  mono: { label: 'Đơn cách (Courier)', css: '"Courier New",Courier,monospace' },
};

export const MARGIN_LIMIT_MM = 40;
export const FONT_SIZE_RANGE = { min: 6, max: 16 };
export const LINE_HEIGHT_RANGE = { min: 1, max: 2 };

export function defaultReceiptSettings(
  paper: ReceiptTemplatePaper = '80'
): ReceiptTemplateSettings {
  return {
    paper,
    ...RECEIPT_TEMPLATE_PAPERS[paper].defaults,
    fontFamily: 'sans',
    lineHeight: 1.3,
    tableBorder: 'none',
    ruleStyle: 'dashed',
  };
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number * 10) / 10));
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** JSON (chuỗi hoặc đối tượng) bất kỳ → thiết lập hợp lệ; thiếu / sai thì dùng mặc định của khổ giấy. */
export function normalizeReceiptSettings(input: unknown): ReceiptTemplateSettings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input || '{}') : input;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      raw = parsed as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const paper = oneOf(raw.paper, RECEIPT_TEMPLATE_PAPER_KEYS, '80');
  const base = defaultReceiptSettings(paper);
  return {
    paper,
    marginTopMm: clamp(raw.marginTopMm, 0, MARGIN_LIMIT_MM, base.marginTopMm),
    marginRightMm: clamp(raw.marginRightMm, 0, MARGIN_LIMIT_MM, base.marginRightMm),
    marginBottomMm: clamp(raw.marginBottomMm, 0, MARGIN_LIMIT_MM, base.marginBottomMm),
    marginLeftMm: clamp(raw.marginLeftMm, 0, MARGIN_LIMIT_MM, base.marginLeftMm),
    fontSizePt: clamp(raw.fontSizePt, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, base.fontSizePt),
    fontFamily: oneOf(raw.fontFamily, ['sans', 'serif', 'mono'] as const, base.fontFamily),
    lineHeight: clamp(
      raw.lineHeight,
      LINE_HEIGHT_RANGE.min,
      LINE_HEIGHT_RANGE.max,
      base.lineHeight
    ),
    tableBorder: oneOf(raw.tableBorder, ['none', 'rows', 'all'] as const, base.tableBorder),
    ruleStyle: oneOf(raw.ruleStyle, ['dashed', 'solid', 'dotted'] as const, base.ruleStyle),
  };
}

/** Bề rộng vùng nội dung (mm) = khổ giấy − lề trái − lề phải; ít nhất 20 mm. */
export function contentWidthMm(settings: ReceiptTemplateSettings): number {
  const paper = RECEIPT_TEMPLATE_PAPERS[settings.paper];
  return Math.max(20, paper.widthMm - settings.marginLeftMm - settings.marginRightMm);
}
