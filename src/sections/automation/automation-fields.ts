import { apiErrorMessage } from 'src/utils/api-error';

import type {
  IAutomationRule,
  AutomationSettings,
  AutomationSettingValue,
} from 'src/api/automation';

// ----------------------------------------------------------------------
// Phần "không giao diện" của màn Cảnh báo tự động: nhóm quy tắc, nhãn tiếng Việt của từng thiết lập,
// đổi qua lại giữa giá trị của API và chữ trong ô nhập, tìm phần đã đổi để gửi lên, gắn lỗi của máy chủ
// vào đúng ô.
//
// core-be có thể thêm quy tắc / khoá thiết lập mới bất cứ lúc nào. Khoá chưa có nhãn ở đây vẫn hiện được:
// vẽ theo KIỂU GIÁ TRỊ (số → ô số, true/false → công tắc, chuỗi "HH:mm" → ô giờ, chuỗi khác → ô chữ) với
// nhãn là chính tên khoá — không cần phát hành lại web.
// ----------------------------------------------------------------------

// ── Nhóm theo tiền tố của mã quy tắc ("till.discrepancy" → "till") ─────────

export type AutomationArea = { key: string; title: string };

const AREAS: Array<AutomationArea & { prefixes: string[] }> = [
  { key: 'till', title: 'Quầy tiền', prefixes: ['till'] },
  { key: 'summary', title: 'Tổng hợp', prefixes: ['daily'] },
  { key: 'attendance', title: 'Chấm công', prefixes: ['attendance'] },
  { key: 'sales', title: 'Bán hàng & thu chi', prefixes: ['sales', 'cash'] },
];

/** Quy tắc có tiền tố chưa biết vẫn hiện, ở nhóm cuối. */
const OTHER_AREA: AutomationArea = { key: 'other', title: 'Khác' };

export function areaOfRule(code: string): AutomationArea {
  const prefix = code.split('.')[0];
  const area = AREAS.find((a) => a.prefixes.includes(prefix));
  return area ? { key: area.key, title: area.title } : OTHER_AREA;
}

/** Các nhóm theo thứ tự cố định (nhóm rỗng bị bỏ); trong mỗi nhóm giữ thứ tự của API. */
export function groupRulesByArea(
  rules: IAutomationRule[]
): Array<{ area: AutomationArea; rules: IAutomationRule[] }> {
  const groups = new Map<string, { area: AutomationArea; rules: IAutomationRule[] }>();
  rules.forEach((rule) => {
    const area = areaOfRule(rule.code);
    const group = groups.get(area.key) ?? { area, rules: [] };
    group.rules.push(rule);
    groups.set(area.key, group);
  });

  return [...AREAS.map((a) => a.key), OTHER_AREA.key]
    .filter((key) => groups.has(key))
    .map((key) => groups.get(key)!);
}

// ── Các ô nhập của một quy tắc ─────────────────────────────────────────────

export type AutomationFieldKind =
  | 'money' // số tiền (đồng): số nguyên, hiện có dấu chấm ngăn hàng nghìn
  | 'integer' // số nguyên không âm
  | 'decimal' // số bất kỳ (phần trăm, số lẻ, khoá số chưa biết)
  | 'weekday' // thứ trong tuần 0–6, 0 = Chủ nhật
  | 'time' // giờ "HH:mm"
  | 'text'
  | 'boolean';

export type AutomationField = {
  /** Đường dẫn khoá trong settings; khoá lồng nối bằng dấu chấm: "minDifference", "channels.messenger". */
  path: string;
  kind: AutomationFieldKind;
  label: string;
  helperText?: string;
  /** Đơn vị hiện ở cuối ô nhập: "đ", "%", "phút". */
  unit?: string;
};

type KnownField = Omit<AutomationField, 'path'>;

const VIETNAM_TIME = 'Giờ Việt Nam (24 giờ).';

/** Nhãn riêng của từng quy tắc — cùng một khoá (time, minAmount) mang nghĩa khác nhau ở mỗi quy tắc. */
const RULE_FIELDS: Record<string, Record<string, KnownField>> = {
  'till.discrepancy': {
    minDifference: {
      kind: 'money',
      label: 'Mức chênh lệch tối thiểu',
      unit: 'đ',
      helperText: 'Chỉ kiểm tra và báo khi tiền quầy lệch từ mức này trở lên.',
    },
    toleranceAmount: {
      kind: 'money',
      label: 'Dung sai khi so tiền',
      unit: 'đ',
      helperText: 'Hai số tiền lệch nhau dưới mức này được coi là khớp.',
    },
  },
  'daily.summary': {
    time: {
      kind: 'time',
      label: 'Giờ gửi tóm tắt',
      helperText: `${VIETNAM_TIME} Bản tóm tắt là của ngày hôm trước.`,
    },
    lowStockThreshold: {
      kind: 'integer',
      label: 'Ngưỡng tồn kho thấp',
      helperText: 'Hàng bán chạy 7 ngày qua còn tồn từ mức này trở xuống sẽ được nhắc.',
    },
    skipWhenNoActivity: {
      kind: 'boolean',
      label: 'Bỏ qua ngày không có hoạt động',
      helperText: 'Ngày không có hoá đơn và không ai chấm công thì không gửi tóm tắt.',
    },
  },
  'attendance.missing-checkout': {
    graceMinutes: {
      kind: 'integer',
      label: 'Số phút chờ sau giờ kết thúc ca',
      unit: 'phút',
      helperText: 'Hết ca quá số phút này mà chưa chấm công ra thì báo (0–1440).',
    },
  },
  'attendance.understaffed-tomorrow': {
    time: { kind: 'time', label: 'Giờ kiểm tra ca ngày mai', helperText: VIETNAM_TIME },
  },
  'attendance.no-registration': {
    weekday: {
      kind: 'weekday',
      label: 'Thứ kiểm tra',
      helperText: 'Ngày trong tuần hệ thống kiểm tra ai chưa đăng ký ca tuần tới.',
    },
    time: { kind: 'time', label: 'Giờ kiểm tra đăng ký ca', helperText: VIETNAM_TIME },
  },
  'sales.invoice-cancelled': {
    minAmount: {
      kind: 'money',
      label: 'Giá trị hoá đơn tối thiểu',
      unit: 'đ',
      helperText: 'Đặt 0 để báo mọi hoá đơn bị huỷ.',
    },
  },
  'sales.discount': {
    minPercent: {
      kind: 'decimal',
      label: 'Ngưỡng giảm giá theo phần trăm',
      unit: '%',
      helperText: 'Từ 0 đến 100.',
    },
    minAmount: { kind: 'money', label: 'Ngưỡng giảm giá theo số tiền', unit: 'đ' },
  },
  'cash.large-expense': {
    tillMinAmount: {
      kind: 'money',
      label: 'Khoản chi tại quầy từ',
      unit: 'đ',
      helperText: 'Khoản “Chi” ghi ở màn Kiểm tiền quầy từ mức này trở lên.',
    },
    expenseMinAmount: {
      kind: 'money',
      label: 'Phiếu chi phí từ',
      unit: 'đ',
      helperText: 'Phiếu chi phí từ mức này trở lên.',
    },
  },
};

/** Nhãn chung theo tên khoá: kênh gửi (mọi quy tắc đều có) và các khoá quen khi một quy tắc MỚI dùng lại. */
const COMMON_FIELDS: Record<string, KnownField> = {
  'channels.notification': { kind: 'boolean', label: 'Thông báo trong app' },
  'channels.messenger': { kind: 'boolean', label: 'Messenger nội bộ' },
  time: { kind: 'time', label: 'Giờ chạy', helperText: VIETNAM_TIME },
  weekday: { kind: 'weekday', label: 'Thứ trong tuần' },
  graceMinutes: { kind: 'integer', label: 'Số phút chờ', unit: 'phút' },
  minPercent: { kind: 'decimal', label: 'Ngưỡng phần trăm', unit: '%' },
  minAmount: { kind: 'money', label: 'Số tiền tối thiểu', unit: 'đ' },
};

/** Thứ Hai → Chủ nhật; giá trị theo core-be (DayOfWeek): 0 = Chủ nhật … 6 = Thứ Bảy. */
export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 0, label: 'Chủ nhật' },
];

const CHANNEL_PREFIX = 'channels.';

export function isChannelField(field: AutomationField): boolean {
  return field.path.startsWith(CHANNEL_PREFIX);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Giá trị đang có ở API có hợp với kiểu ô đã khai cho khoá này không (core-be đổi kiểu → vẽ theo kiểu mới). */
function fitsKind(kind: AutomationFieldKind, value: AutomationSettingValue): boolean {
  switch (kind) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'time':
    case 'text':
      return typeof value === 'string';
    case 'money':
    case 'integer':
      return isWholeNumber(value);
    case 'weekday':
      return isWholeNumber(value) && value <= 6;
    default:
      return typeof value === 'number';
  }
}

function kindOfValue(value: AutomationSettingValue): AutomationFieldKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'decimal';
  return TIME_PATTERN.test(value) ? 'time' : 'text';
}

/**
 * Các ô nhập của một quy tắc, theo đúng thứ tự khoá của API. Khoá có nhãn (và giá trị đúng kiểu đã khai) dùng
 * nhãn tiếng Việt; khoá còn lại vẽ theo kiểu giá trị, nhãn là tên khoá.
 */
export function buildRuleFields(
  rule: Pick<IAutomationRule, 'code' | 'settings'>
): AutomationField[] {
  return Object.entries(flattenSettings(rule.settings)).map(([path, value]) => {
    const known = RULE_FIELDS[rule.code]?.[path] ?? COMMON_FIELDS[path];
    if (known && fitsKind(known.kind, value)) return { path, ...known };

    return { path, kind: kindOfValue(value), label: path };
  });
}

// ── settings của API ↔ danh sách phẳng theo đường dẫn ──────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * { minDifference: 10000, channels: { messenger: true } } → { minDifference: 10000, 'channels.messenger': true }.
 * Giá trị không sửa được ở màn này (null, mảng) bị bỏ qua — không hiện và không bao giờ gửi lên.
 */
export function flattenSettings(
  settings: unknown,
  prefix = ''
): Record<string, AutomationSettingValue> {
  const flat: Record<string, AutomationSettingValue> = {};
  if (!isPlainObject(settings)) return flat;

  Object.entries(settings).forEach(([key, value]) => {
    if (UNSAFE_KEYS.has(key)) return;

    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(flat, flattenSettings(value, path));
    } else if (
      typeof value === 'boolean' ||
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      flat[path] = value;
    }
  });

  return flat;
}

/** Ngược lại với flattenSettings — dựng phần `settings` gửi lên từ các đường dẫn đã đổi. */
export function unflattenSettings(
  flat: Record<string, AutomationSettingValue>
): AutomationSettings {
  const settings: Record<string, any> = {};

  Object.entries(flat).forEach(([path, value]) => {
    const keys = path.split('.');
    let node = settings;
    keys.slice(0, -1).forEach((key) => {
      if (!isPlainObject(node[key])) node[key] = {};
      node = node[key];
    });
    node[keys[keys.length - 1]] = value;
  });

  return settings;
}

// ── Giá trị của API ↔ chữ trong ô nhập ─────────────────────────────────────

/** Ô số / giờ / chữ giữ CHUỖI đang gõ (để gõ dở được); công tắc giữ true/false. */
export type AutomationFormValue = string | boolean;
export type AutomationFormValues = Record<string, AutomationFormValue>;

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/** 1500000 → "1.500.000". */
export function formatMoney(value: number): string {
  return String(Math.trunc(value)).replace(THOUSANDS, '.');
}

function toFormValue(
  kind: AutomationFieldKind,
  value: AutomationSettingValue
): AutomationFormValue {
  if (kind === 'boolean') return value === true;
  if (kind === 'money') return formatMoney(Number(value));
  return String(value);
}

/** Giá trị form của các ô có trong `flat` (ô không có giá trị trong `flat` không được đụng tới). */
export function toFormValues(
  fields: AutomationField[],
  flat: Record<string, AutomationSettingValue>
): AutomationFormValues {
  const values: AutomationFormValues = {};
  fields.forEach((field) => {
    const value = flat[field.path];
    if (value !== undefined && fitsKind(field.kind, value)) {
      values[field.path] = toFormValue(field.kind, value);
    }
  });
  return values;
}

/** Lọc chữ người dùng gõ vào ô số: ô tiền tự chèn dấu chấm hàng nghìn, ô số nguyên chỉ nhận chữ số. */
export function sanitizeFieldInput(kind: AutomationFieldKind, raw: string): string {
  switch (kind) {
    case 'money':
      return raw
        .replace(/\D/g, '')
        .replace(/^0+(?=\d)/, '')
        .slice(0, 15)
        .replace(THOUSANDS, '.');
    case 'integer':
      return raw.replace(/\D/g, '').slice(0, 9);
    case 'decimal':
      return raw.replace(/[^\d.,-]/g, '');
    default:
      return raw;
  }
}

type ParsedValue = { ok: true; value: AutomationSettingValue } | { ok: false; error: string };

/** Chữ trong ô nhập → giá trị gửi API. Chỉ kiểm tra "đọc được"; khoảng giá trị do máy chủ kiểm tra. */
export function parseFormValue(
  kind: AutomationFieldKind,
  formValue: AutomationFormValue | undefined
): ParsedValue {
  if (kind === 'boolean') return { ok: true, value: formValue === true };

  const raw = typeof formValue === 'string' ? formValue : '';
  const text = raw.trim();

  switch (kind) {
    case 'money': {
      const digits = text.replace(/\./g, '');
      return /^\d+$/.test(digits)
        ? { ok: true, value: Number(digits) }
        : { ok: false, error: 'Nhập số tiền (đồng).' };
    }
    case 'integer':
      return /^\d+$/.test(text)
        ? { ok: true, value: Number(text) }
        : { ok: false, error: 'Nhập một số nguyên không âm.' };
    case 'weekday':
      return /^[0-6]$/.test(text)
        ? { ok: true, value: Number(text) }
        : { ok: false, error: 'Chọn một thứ trong tuần.' };
    case 'decimal': {
      const normalized = text.replace(',', '.');
      return /^-?\d+(\.\d+)?$/.test(normalized)
        ? { ok: true, value: Number(normalized) }
        : { ok: false, error: 'Nhập một số.' };
    }
    case 'time':
      return TIME_PATTERN.test(text)
        ? { ok: true, value: text }
        : { ok: false, error: 'Chọn giờ hợp lệ (HH:mm).' };
    default:
      return { ok: true, value: raw };
  }
}

/**
 * So form với một bộ giá trị gốc (đang lưu, hoặc mặc định): `changed` = các đường dẫn có giá trị KHÁC gốc
 * (đúng những gì cần gửi lên), `invalid` = các ô đang gõ dở / không đọc được kèm lời nhắc.
 */
export function diffSettings(
  fields: AutomationField[],
  values: AutomationFormValues,
  base: Record<string, AutomationSettingValue>
): { changed: Record<string, AutomationSettingValue>; invalid: Record<string, string> } {
  const changed: Record<string, AutomationSettingValue> = {};
  const invalid: Record<string, string> = {};

  fields.forEach((field) => {
    const parsed = parseFormValue(field.kind, values[field.path]);
    if (!parsed.ok) invalid[field.path] = parsed.error;
    else if (parsed.value !== base[field.path]) changed[field.path] = parsed.value;
  });

  return { changed, invalid };
}

// ── Lỗi của máy chủ ────────────────────────────────────────────────────────

/**
 * Gắn từng câu lỗi của 400 { errors[] } vào ô của nó. core-be luôn nêu khoá trong câu lỗi, dạng
 * `… (minDifference) phải từ 0 đến …` hoặc `Thiết lập "channels.messenger" phải là …`; câu không nêu khoá nào
 * đang hiện trên thẻ (khoá lạ, thiếu enabled/settings…) thuộc phần lỗi chung.
 */
export function splitServerErrors(
  errors: string[],
  paths: string[]
): { byPath: Record<string, string>; general: string[] } {
  const byPath: Record<string, string> = {};
  const general: string[] = [];

  errors.forEach((error) => {
    const path = paths.find((p) => error.includes(`(${p})`) || error.includes(`"${p}"`));
    if (!path) general.push(error);
    else byPath[path] = byPath[path] ? `${byPath[path]} ${error}` : error;
  });

  return { byPath, general };
}

/**
 * Lời báo lỗi cho người dùng. Interceptor của axios trả BODY của response; không có body (mất mạng, 5xx rỗng,
 * trang lỗi HTML) thì chỉ còn một chuỗi vô nghĩa với người dùng → dùng câu tiếng Việt `fallback`.
 */
export function requestErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err === 'string') return fallback;
  return apiErrorMessage(err, fallback);
}
