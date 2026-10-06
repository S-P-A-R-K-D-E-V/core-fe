// ----------------------------------------------------------------------
// Mẫu giấy in tem, tuỳ chọn nội dung và căn chỉnh máy in — kiểu dữ liệu, mẫu có sẵn, kiểm tra hợp lệ và
// lưu theo trình duyệt (localStorage). Không có React / DOM ngoài việc đọc-ghi storage (truyền
// storage khác vào để test).
//
// Mọi kích thước tính bằng mm. Một TRANG in là một LƯỚI tem: số hàng × số tem mỗi hàng, có lề trên /
// lề trái và khe ngang / khe dọc giữa các tem.
//  - Giấy cuộn ('roll', máy in tem nhiệt): mỗi trang là MỘT hàng tem — rộng = khổ cuộn, cao = cao tem.
//  - Giấy tờ ('sheet', A4 / A5… in bằng máy laser hoặc in phun): nhiều hàng trên một tờ.
// Kích thước giấy thật mỗi nơi bán một khác: mẫu nào cũng chỉnh lại được bằng căn chỉnh hoặc "Tuỳ chỉnh".
// ----------------------------------------------------------------------

export type LabelPaperKind = 'roll' | 'sheet';

/**
 * Bố cục bên trong một tem:
 *  - 'stacked': tên cửa hàng, tên hàng, mã vạch, mã đọc bằng mắt, giá — xếp từ trên xuống;
 *  - 'split'  : tem dài và thấp — mã vạch + mã ở nửa trái, tên + giá ở nửa phải của vùng in.
 */
export type LabelContentLayout = 'stacked' | 'split';

/** Độ rộng 1 module của mã vạch, tính bằng điểm in 203 dpi (1 điểm = 0,125 mm → 0,125 / 0,25 / 0,375 mm). */
export type ModuleDots = 1 | 2 | 3;

export type LabelTemplate = {
  id: string;
  name: string;
  kind: LabelPaperKind;
  /** Khổ cuộn, hoặc chiều rộng tờ giấy. */
  pageWidthMm: number;
  /** Chiều cao tờ giấy. Giấy cuộn không dùng số này: trang luôn cao bằng một tem. */
  pageHeightMm: number;
  /** Số tem trên một hàng. */
  columns: number;
  /** Số hàng trên một trang. Giấy cuộn luôn là 1. */
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  /** Khe ngang giữa hai tem cạnh nhau. */
  columnGapMm: number;
  /** Khe dọc giữa hai hàng (chỉ giấy tờ). */
  rowGapMm: number;
  /** Từ mép trái giấy tới tem đầu tiên. */
  marginLeftMm: number;
  /** Từ mép trên trang tới hàng tem đầu tiên. */
  marginTopMm: number;
  /** Lề trắng bên trong mỗi tem. */
  paddingMm: number;
  /** Chỉ in trong đoạn đầu (tính từ mép trái) của mỗi tem, vd. tem trang sức có đuôi gập; 0 = in cả tem. */
  printWidthMm: number;
  layout: LabelContentLayout;
  /** Cỡ chữ (pt) — từ 6 pt trở lên còn đọc được ở 203 dpi. Tên cửa hàng nhỏ hơn mã 1 pt (ít nhất 6 pt). */
  namePt: number;
  codePt: number;
  pricePt: number;
  /** Độ rộng vạch khi chưa căn chỉnh; không ghi = 2 (0,25 mm). */
  defaultModuleDots?: ModuleDots;
};

export type LabelValueSource = 'barcode-or-code' | 'code';

/** Chữ sau số tiền: "185.000đ", "185.000 VND" hoặc chỉ "185.000". */
export type LabelPriceSuffix = 'đ' | 'VND' | 'none';

export type LabelOptions = {
  showName: boolean;
  showStoreName: boolean;
  showPrice: boolean;
  priceSuffix: LabelPriceSuffix;
  /** Thêm đơn vị tính sau giá ("185.000đ/cái") — chỉ với hàng có đơn vị. */
  showUnit: boolean;
  /** Giá trị đem mã hoá: mã vạch (không có thì mã hàng), hoặc luôn là mã hàng. */
  valueSource: LabelValueSource;
};

export type LabelCalibration = {
  offsetLeftMm: number;
  offsetTopMm: number;
  extraColumnGapMm: number;
  /** Chỉ có tác dụng với giấy tờ (nhiều hàng). */
  extraRowGapMm: number;
  moduleDots: ModuleDots;
};

export type LabelPrintSettings = {
  templateId: string;
  customTemplate: LabelTemplate;
  options: LabelOptions;
};

// ── Mẫu có sẵn ────────────────────────────────────────────────────────────
// Tên theo danh sách "Chọn loại giấy in tem mã" của KiotViet. Số nào CHƯA đối chiếu được với giấy thật
// thì ghi rõ ở từng mẫu — in thử căn chỉnh trước khi in hàng loạt.

export const DEFAULT_TEMPLATE_ID = '2x35x22-r74';
export const CUSTOM_TEMPLATE_ID = 'custom';

const ROLL = {
  kind: 'roll',
  rows: 1,
  rowGapMm: 0,
  marginTopMm: 0,
  printWidthMm: 0,
  layout: 'stacked',
} as const;

const SHEET = { kind: 'sheet', printWidthMm: 0, layout: 'stacked' } as const;

const SMALL_TEXT = { paddingMm: 1, namePt: 7, codePt: 7, pricePt: 9 };

export const LABEL_TEMPLATES: LabelTemplate[] = [
  {
    // 0,5 + 33 + 2 + 33 + 2 + 33 + 0,5 = 104. Chưa đối chiếu được cách chia thật của cuộn 104 mm.
    ...ROLL,
    ...SMALL_TEXT,
    id: '3x33x22-r104',
    name: 'Cuộn 3 nhãn - khổ 104×22 mm',
    pageWidthMm: 104,
    pageHeightMm: 22,
    labelWidthMm: 33,
    labelHeightMm: 22,
    columns: 3,
    columnGapMm: 2,
    marginLeftMm: 0.5,
  },
  {
    // 35 + 2 + 35 = 72, không có lề hai bên. Chưa đối chiếu được với cuộn thật.
    ...ROLL,
    ...SMALL_TEXT,
    id: '2x35x22-r72',
    name: 'Cuộn 2 nhãn - khổ 72×22 mm',
    pageWidthMm: 72,
    pageHeightMm: 22,
    labelWidthMm: 35,
    labelHeightMm: 22,
    columns: 2,
    columnGapMm: 2,
    marginLeftMm: 0,
  },
  {
    // 1 + 35 + 2 + 35 + 1 = 74
    ...ROLL,
    ...SMALL_TEXT,
    id: DEFAULT_TEMPLATE_ID,
    name: 'Cuộn 2 nhãn - khổ 74×22 mm',
    pageWidthMm: 74,
    pageHeightMm: 22,
    labelWidthMm: 35,
    labelHeightMm: 22,
    columns: 2,
    columnGapMm: 2,
    marginLeftMm: 1,
  },
  {
    // 0,5 + 35 + 2 + 35 + 2 + 35 + 0,5 = 110 — cuộn 3 tem 35×22 thông dụng
    ...ROLL,
    ...SMALL_TEXT,
    id: '3x35x22-r110',
    name: 'Cuộn 3 nhãn - khổ 110×22 mm',
    pageWidthMm: 110,
    pageHeightMm: 22,
    labelWidthMm: 35,
    labelHeightMm: 22,
    columns: 3,
    columnGapMm: 2,
    marginLeftMm: 0.5,
  },
  {
    ...ROLL,
    id: '1x50x30',
    name: 'Cuộn 1 nhãn - 50×30 mm',
    pageWidthMm: 50,
    pageHeightMm: 30,
    labelWidthMm: 50,
    labelHeightMm: 30,
    columns: 1,
    columnGapMm: 0,
    marginLeftMm: 0,
    paddingMm: 1.5,
    namePt: 9,
    codePt: 8,
    pricePt: 12,
  },
  {
    ...ROLL,
    id: '1x40x30',
    name: 'Cuộn 1 nhãn - 40×30 mm',
    pageWidthMm: 40,
    pageHeightMm: 30,
    labelWidthMm: 40,
    labelHeightMm: 30,
    columns: 1,
    columnGapMm: 0,
    marginLeftMm: 0,
    paddingMm: 1.5,
    namePt: 8,
    codePt: 8,
    pricePt: 11,
  },
  {
    // Tomy 103: 12 nhãn 62×36 mm (đã đối chiếu). Tờ 202×162 theo KiotViet → 3 cột × 4 hàng.
    // Lề và khe CHƯA đối chiếu được, chia đều: ngang 6 + 3×62 + 2×2 + 6 = 202; dọc 6 + 4×36 + 3×2 + 6 = 162.
    ...SHEET,
    id: 'tomy-103',
    name: 'Giấy 12 nhãn - Tomy 103 (tờ 202×162 mm)',
    pageWidthMm: 202,
    pageHeightMm: 162,
    labelWidthMm: 62,
    labelHeightMm: 36,
    columns: 3,
    rows: 4,
    columnGapMm: 2,
    rowGapMm: 2,
    marginLeftMm: 6,
    marginTopMm: 6,
    paddingMm: 2,
    namePt: 10,
    codePt: 9,
    pricePt: 13,
  },
  {
    // Tomy 145: 65 nhãn 38×21 mm trên A4 (đã đối chiếu) → 5 cột × 13 hàng.
    // Lề và khe CHƯA đối chiếu được, lấy theo giấy 65 nhãn A4 thông dụng (khe ngang 2,5, không khe dọc):
    // ngang 5 + 5×38 + 4×2,5 + 5 = 210; dọc 12 + 13×21 + 12 = 297.
    ...SHEET,
    ...SMALL_TEXT,
    id: 'tomy-145',
    name: 'Giấy 65 nhãn - A4 Tomy 145',
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 38,
    labelHeightMm: 21,
    columns: 5,
    rows: 13,
    columnGapMm: 2.5,
    rowGapMm: 0,
    marginLeftMm: 5,
    marginTopMm: 12,
  },
  {
    // Tem trang sức có đuôi gập: GIẢ ĐỊNH chỉ 45 mm đầu là phần dán / đọc được (hai mặt ~22,5 mm), 30 mm
    // còn lại là đuôi quấn quanh món hàng nên để trống. Nửa trái: mã vạch + mã; nửa phải: tên + giá.
    // Mã vạch chỉ có ~21,5 mm nên mặc định vạch 1 điểm (0,125 mm).
    ...ROLL,
    id: 'jewelry-75x10',
    name: 'Tem trang sức - 75×10 mm',
    pageWidthMm: 75,
    pageHeightMm: 10,
    labelWidthMm: 75,
    labelHeightMm: 10,
    columns: 1,
    columnGapMm: 0,
    marginLeftMm: 0,
    paddingMm: 0.5,
    printWidthMm: 45,
    layout: 'split',
    namePt: 6,
    codePt: 6,
    pricePt: 7,
    defaultModuleDots: 1,
  },
];

const DEFAULT_TEMPLATE = LABEL_TEMPLATES.find((template) => template.id === DEFAULT_TEMPLATE_ID)!;

export const DEFAULT_CUSTOM_TEMPLATE: LabelTemplate = {
  ...DEFAULT_TEMPLATE,
  id: CUSTOM_TEMPLATE_ID,
  name: 'Tuỳ chỉnh',
};

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  showName: true,
  showStoreName: false,
  showPrice: true,
  priceSuffix: 'đ',
  showUnit: false,
  valueSource: 'barcode-or-code',
};

export const DEFAULT_LABEL_SETTINGS: LabelPrintSettings = {
  templateId: DEFAULT_TEMPLATE_ID,
  customTemplate: DEFAULT_CUSTOM_TEMPLATE,
  options: DEFAULT_LABEL_OPTIONS,
};

type TemplateNumberKey = Exclude<
  keyof LabelTemplate,
  'id' | 'name' | 'kind' | 'layout' | 'defaultModuleDots'
>;

/** Các ô số của mẫu tuỳ chỉnh (thứ tự hiện trong hộp thoại) kèm khoảng giá trị cho phép. */
export const TEMPLATE_NUMBER_FIELDS: Array<{
  key: TemplateNumberKey;
  label: string;
  /** Nhãn khi là giấy tờ, nếu khác giấy cuộn. */
  sheetLabel?: string;
  /** Ô chỉ có ở giấy tờ. */
  sheetOnly?: boolean;
  unit: 'mm' | 'tem' | 'hàng' | 'pt';
  step: number;
  min: number;
  max: number;
}> = [
  { key: 'pageWidthMm', label: 'Khổ cuộn', sheetLabel: 'Rộng tờ giấy', unit: 'mm', step: 0.5, min: 10, max: 330 },
  { key: 'pageHeightMm', label: 'Cao tờ giấy', sheetOnly: true, unit: 'mm', step: 0.5, min: 10, max: 500 },
  { key: 'labelWidthMm', label: 'Rộng tem', unit: 'mm', step: 0.5, min: 10, max: 220 },
  { key: 'labelHeightMm', label: 'Cao tem', unit: 'mm', step: 0.5, min: 8, max: 300 },
  { key: 'columns', label: 'Số tem mỗi hàng', unit: 'tem', step: 1, min: 1, max: 10 },
  { key: 'rows', label: 'Số hàng mỗi tờ', sheetOnly: true, unit: 'hàng', step: 1, min: 1, max: 40 },
  { key: 'columnGapMm', label: 'Khe ngang giữa hai tem', unit: 'mm', step: 0.5, min: 0, max: 20 },
  { key: 'rowGapMm', label: 'Khe dọc giữa hai hàng', sheetOnly: true, unit: 'mm', step: 0.5, min: 0, max: 20 },
  { key: 'marginLeftMm', label: 'Lề trái', unit: 'mm', step: 0.5, min: 0, max: 50 },
  { key: 'marginTopMm', label: 'Lề trên', unit: 'mm', step: 0.5, min: 0, max: 50 },
  { key: 'paddingMm', label: 'Lề trong tem', unit: 'mm', step: 0.5, min: 0, max: 5 },
  { key: 'printWidthMm', label: 'Vùng in từ mép trái (0 = cả tem)', unit: 'mm', step: 0.5, min: 0, max: 220 },
  { key: 'namePt', label: 'Cỡ chữ tên', unit: 'pt', step: 0.5, min: 5, max: 24 },
  { key: 'codePt', label: 'Cỡ chữ mã', unit: 'pt', step: 0.5, min: 5, max: 24 },
  { key: 'pricePt', label: 'Cỡ chữ giá', unit: 'pt', step: 0.5, min: 5, max: 24 },
];

/** Giấy cuộn: luôn 1 hàng, không khe dọc, trang cao bằng một tem. Giấy tờ giữ nguyên. */
export function normalizeTemplate(template: LabelTemplate): LabelTemplate {
  if (template.kind !== 'roll') return template;
  return { ...template, rows: 1, rowGapMm: 0, pageHeightMm: template.labelHeightMm };
}

export function resolveTemplate(settings: LabelPrintSettings): LabelTemplate {
  if (settings.templateId === CUSTOM_TEMPLATE_ID) return normalizeTemplate(settings.customTemplate);
  return LABEL_TEMPLATES.find((template) => template.id === settings.templateId) ?? DEFAULT_TEMPLATE;
}

// "35,75" — số thập phân kiểu Việt Nam, bỏ số 0 thừa.
function vnNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace('.', ',');
}

/** Danh sách lỗi (tiếng Việt) của một mẫu; rỗng = dùng được. */
export function validateLabelTemplate(input: LabelTemplate): string[] {
  const template = normalizeTemplate(input);
  const isSheet = template.kind === 'sheet';
  const errors: string[] = [];

  TEMPLATE_NUMBER_FIELDS.forEach(({ key, label, sheetLabel, sheetOnly, unit, min, max }) => {
    if (sheetOnly && !isSheet) return;
    const value = template[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      const shown = (isSheet && sheetLabel) || label.replace(' (0 = cả tem)', '');
      errors.push(`${shown} phải từ ${vnNumber(min)} đến ${vnNumber(max)} ${unit}.`);
    }
  });
  if (Number.isFinite(template.columns) && !Number.isInteger(template.columns)) {
    errors.push('Số tem mỗi hàng phải là số nguyên.');
  }
  if (isSheet && Number.isFinite(template.rows) && !Number.isInteger(template.rows)) {
    errors.push('Số hàng mỗi tờ phải là số nguyên.');
  }
  if (errors.length > 0) return errors;

  const usedWidth =
    template.marginLeftMm +
    template.columns * template.labelWidthMm +
    (template.columns - 1) * template.columnGapMm;
  if (usedWidth > template.pageWidthMm + 1e-9) {
    errors.push(
      `${isSheet ? 'Tờ giấy rộng' : 'Khổ cuộn'} ${vnNumber(template.pageWidthMm)} mm hẹp hơn tổng lề trái, các tem và khe (${vnNumber(usedWidth)} mm).`
    );
  }

  const usedHeight =
    template.marginTopMm + template.rows * template.labelHeightMm + (template.rows - 1) * template.rowGapMm;
  if (isSheet && usedHeight > template.pageHeightMm + 1e-9) {
    errors.push(
      `Tờ giấy cao ${vnNumber(template.pageHeightMm)} mm thấp hơn tổng lề trên, các hàng tem và khe (${vnNumber(usedHeight)} mm).`
    );
  }

  if (template.printWidthMm > 0 && template.printWidthMm < 10) {
    errors.push('Vùng in từ mép trái phải bằng 0 (in cả tem) hoặc từ 10 mm trở lên.');
  }
  if (template.printWidthMm > template.labelWidthMm + 1e-9) {
    errors.push(
      `Vùng in ${vnNumber(template.printWidthMm)} mm rộng hơn tem (${vnNumber(template.labelWidthMm)} mm).`
    );
  }
  return errors;
}

// ── Căn chỉnh ─────────────────────────────────────────────────────────────

/** Bước chỉnh và giới hạn (mm) của lệch trái / lệch trên / khe thêm. */
export const CALIBRATION_STEP_MM = 0.5;
export const CALIBRATION_LIMIT_MM = 10;

export const DEFAULT_CALIBRATION: LabelCalibration = {
  offsetLeftMm: 0,
  offsetTopMm: 0,
  extraColumnGapMm: 0,
  extraRowGapMm: 0,
  moduleDots: 2,
};

const isModuleDots = (value: unknown): value is ModuleDots => value === 1 || value === 2 || value === 3;

/** Căn chỉnh khi chưa chỉnh gì của một mẫu (mẫu tem trang sức mặc định vạch 1 điểm). */
export function defaultCalibration(templateId: string): LabelCalibration {
  const template = LABEL_TEMPLATES.find((item) => item.id === templateId);
  return { ...DEFAULT_CALIBRATION, moduleDots: template?.defaultModuleDots ?? DEFAULT_CALIBRATION.moduleDots };
}

function snapToStep(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  const snapped = Math.round(number / CALIBRATION_STEP_MM) * CALIBRATION_STEP_MM;
  // + 0 để không bao giờ trả về -0
  return Math.min(CALIBRATION_LIMIT_MM, Math.max(-CALIBRATION_LIMIT_MM, snapped)) + 0;
}

/** Đưa dữ liệu bất kỳ (đọc từ storage, người dùng gõ) về căn chỉnh hợp lệ: bội của 0,5 mm, ±10 mm. */
export function normalizeCalibration(
  input: unknown,
  fallback: LabelCalibration = DEFAULT_CALIBRATION
): LabelCalibration {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<LabelCalibration>;
  const dots = Number(raw.moduleDots);
  return {
    offsetLeftMm: snapToStep(raw.offsetLeftMm),
    offsetTopMm: snapToStep(raw.offsetTopMm),
    extraColumnGapMm: snapToStep(raw.extraColumnGapMm),
    extraRowGapMm: snapToStep(raw.extraRowGapMm),
    moduleDots: isModuleDots(dots) ? dots : fallback.moduleDots,
  };
}

/** Nhích một trường căn chỉnh thêm `steps` bước 0,5 mm (âm = lùi). */
export function stepCalibration(
  calibration: LabelCalibration,
  field: 'offsetLeftMm' | 'offsetTopMm' | 'extraColumnGapMm' | 'extraRowGapMm',
  steps: number
): LabelCalibration {
  return normalizeCalibration(
    { ...calibration, [field]: calibration[field] + steps * CALIBRATION_STEP_MM },
    calibration
  );
}

// ── Lưu theo trình duyệt ──────────────────────────────────────────────────

export const LABEL_SETTINGS_STORAGE_KEY = 'pos-label-print-settings';
export const LABEL_CALIBRATION_STORAGE_KEY = 'pos-label-print-calibration';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readJson(key: string, storage: KeyValueStorage | null): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, storage: KeyValueStorage | null) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage đầy hoặc bị chặn — bỏ qua, lần sau dùng mặc định */
  }
}

function normalizeCustomTemplate(input: unknown): LabelTemplate {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const template: LabelTemplate = { ...DEFAULT_CUSTOM_TEMPLATE };
  TEMPLATE_NUMBER_FIELDS.forEach(({ key }) => {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) template[key] = value;
  });
  if (raw.kind === 'roll' || raw.kind === 'sheet') template.kind = raw.kind;
  if (raw.layout === 'stacked' || raw.layout === 'split') template.layout = raw.layout;
  return template;
}

const PRICE_SUFFIXES: LabelPriceSuffix[] = ['đ', 'VND', 'none'];

export function normalizeLabelSettings(input: unknown): LabelPrintSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<LabelPrintSettings>;
  const options = (raw.options && typeof raw.options === 'object' ? raw.options : {}) as Partial<LabelOptions>;
  const knownTemplate =
    raw.templateId === CUSTOM_TEMPLATE_ID ||
    LABEL_TEMPLATES.some((template) => template.id === raw.templateId);
  const flag = (key: 'showName' | 'showStoreName' | 'showPrice' | 'showUnit') =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : DEFAULT_LABEL_OPTIONS[key];

  return {
    templateId: knownTemplate ? (raw.templateId as string) : DEFAULT_TEMPLATE_ID,
    customTemplate: normalizeCustomTemplate(raw.customTemplate),
    options: {
      showName: flag('showName'),
      showStoreName: flag('showStoreName'),
      showPrice: flag('showPrice'),
      priceSuffix: PRICE_SUFFIXES.includes(options.priceSuffix as LabelPriceSuffix)
        ? (options.priceSuffix as LabelPriceSuffix)
        : DEFAULT_LABEL_OPTIONS.priceSuffix,
      showUnit: flag('showUnit'),
      valueSource: options.valueSource === 'code' ? 'code' : 'barcode-or-code',
    },
  };
}

/** Mẫu đang chọn (nhớ lần chọn gần nhất), mẫu tuỳ chỉnh và tuỳ chọn nội dung. */
export function loadLabelSettings(storage: KeyValueStorage | null = browserStorage()): LabelPrintSettings {
  return normalizeLabelSettings(readJson(LABEL_SETTINGS_STORAGE_KEY, storage));
}

export function saveLabelSettings(
  settings: LabelPrintSettings,
  storage: KeyValueStorage | null = browserStorage()
) {
  writeJson(LABEL_SETTINGS_STORAGE_KEY, settings, storage);
}

/** Căn chỉnh lưu riêng cho từng mẫu: { [templateId]: LabelCalibration } dưới một khoá. */
export function loadCalibration(
  templateId: string,
  storage: KeyValueStorage | null = browserStorage()
): LabelCalibration {
  const all = readJson(LABEL_CALIBRATION_STORAGE_KEY, storage);
  const entry = all && typeof all === 'object' ? (all as Record<string, unknown>)[templateId] : null;
  return normalizeCalibration(entry, defaultCalibration(templateId));
}

export function saveCalibration(
  templateId: string,
  calibration: LabelCalibration,
  storage: KeyValueStorage | null = browserStorage()
) {
  const all = readJson(LABEL_CALIBRATION_STORAGE_KEY, storage);
  const next = { ...(all && typeof all === 'object' ? (all as Record<string, unknown>) : {}) };
  next[templateId] = normalizeCalibration(calibration, defaultCalibration(templateId));
  writeJson(LABEL_CALIBRATION_STORAGE_KEY, next, storage);
}
