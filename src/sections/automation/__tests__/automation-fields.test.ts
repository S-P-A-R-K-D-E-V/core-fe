import { describe, expect, it } from 'vitest';

import type { IAutomationRule } from 'src/api/automation';

import {
  areaOfRule,
  formatMoney,
  diffSettings,
  toFormValues,
  flattenSettings,
  parseFormValue,
  buildRuleFields,
  groupRulesByArea,
  unflattenSettings,
  splitServerErrors,
  sanitizeFieldInput,
  requestErrorMessage,
} from '../automation-fields';

// ----------------------------------------------------------------------
// Phần "không giao diện" của màn Cảnh báo tự động. Dữ liệu mẫu đúng dạng GET automation/rules của core-be
// (AutomationControllerTests / AutomationSettingsServiceTests).
// ----------------------------------------------------------------------

const CHANNELS = { notification: true, messenger: true };

function rule(code: string, settings: Record<string, unknown>): IAutomationRule {
  return {
    code,
    title: code,
    description: '',
    enabled: true,
    defaultEnabled: true,
    settings,
    defaults: settings,
    globallyDisabled: false,
    updatedAt: null,
    updatedByUserId: null,
  };
}

describe('nhóm quy tắc theo tiền tố của mã', () => {
  it('xếp 8 quy tắc hiện có vào 4 nhóm, đúng thứ tự', () => {
    const codes = [
      'cash.large-expense',
      'sales.discount',
      'attendance.no-registration',
      'daily.summary',
      'till.discrepancy',
      'attendance.missing-checkout',
      'sales.invoice-cancelled',
      'attendance.understaffed-tomorrow',
    ];

    const groups = groupRulesByArea(codes.map((code) => rule(code, {})));

    expect(groups.map((g) => [g.area.title, g.rules.map((r) => r.code)])).toEqual([
      ['Quầy tiền', ['till.discrepancy']],
      ['Tổng hợp', ['daily.summary']],
      [
        'Chấm công',
        [
          'attendance.no-registration',
          'attendance.missing-checkout',
          'attendance.understaffed-tomorrow',
        ],
      ],
      ['Bán hàng & thu chi', ['cash.large-expense', 'sales.discount', 'sales.invoice-cancelled']],
    ]);
  });

  it('quy tắc có tiền tố chưa biết vẫn hiện, ở nhóm "Khác" cuối cùng', () => {
    expect(areaOfRule('inventory.low-stock').title).toBe('Khác');

    const groups = groupRulesByArea([
      rule('inventory.low-stock', {}),
      rule('till.discrepancy', {}),
    ]);
    expect(groups.map((g) => g.area.title)).toEqual(['Quầy tiền', 'Khác']);
  });
});

describe('flattenSettings / unflattenSettings', () => {
  it('trải khoá lồng thành đường dẫn và dựng lại được', () => {
    const settings = { minDifference: 10000, channels: { notification: true, messenger: false } };

    const flat = flattenSettings(settings);

    expect(flat).toEqual({
      minDifference: 10000,
      'channels.notification': true,
      'channels.messenger': false,
    });
    expect(unflattenSettings(flat)).toEqual(settings);
  });

  it('bỏ qua giá trị không sửa được ở màn này (null, mảng) và dữ liệu không phải object', () => {
    expect(flattenSettings({ a: null, b: [1, 2], c: 'x', d: { e: null, f: 1 } })).toEqual({
      c: 'x',
      'd.f': 1,
    });
    expect(flattenSettings(null)).toEqual({});
    expect(flattenSettings('abc')).toEqual({});
    expect(flattenSettings([1])).toEqual({});
  });

  it('chỉ dựng phần settings của những đường dẫn đã đổi', () => {
    expect(unflattenSettings({ 'channels.messenger': false })).toEqual({
      channels: { messenger: false },
    });
    expect(unflattenSettings({})).toEqual({});
  });
});

describe('buildRuleFields — nhãn tiếng Việt cho khoá đã biết', () => {
  it('till.discrepancy: hai ô tiền + hai kênh gửi, đúng thứ tự của API', () => {
    const fields = buildRuleFields(
      rule('till.discrepancy', { minDifference: 10000, toleranceAmount: 1000, channels: CHANNELS })
    );

    expect(fields.map((f) => [f.path, f.kind, f.label, f.unit])).toEqual([
      ['minDifference', 'money', 'Mức chênh lệch tối thiểu', 'đ'],
      ['toleranceAmount', 'money', 'Dung sai khi so tiền', 'đ'],
      ['channels.notification', 'boolean', 'Thông báo trong app', undefined],
      ['channels.messenger', 'boolean', 'Messenger nội bộ', undefined],
    ]);
  });

  it('cùng một khoá mang nhãn riêng theo từng quy tắc', () => {
    const label = (code: string, settings: Record<string, unknown>, path: string) =>
      buildRuleFields(rule(code, settings)).find((f) => f.path === path)?.label;

    expect(label('daily.summary', { time: '08:00' }, 'time')).toBe('Giờ gửi tóm tắt');
    expect(label('attendance.understaffed-tomorrow', { time: '18:00' }, 'time')).toBe(
      'Giờ kiểm tra ca ngày mai'
    );
    expect(label('attendance.no-registration', { weekday: 5, time: '18:00' }, 'time')).toBe(
      'Giờ kiểm tra đăng ký ca'
    );
    expect(label('sales.invoice-cancelled', { minAmount: 0 }, 'minAmount')).toBe(
      'Giá trị hoá đơn tối thiểu'
    );
    expect(label('sales.discount', { minPercent: 20, minAmount: 100000 }, 'minAmount')).toBe(
      'Ngưỡng giảm giá theo số tiền'
    );
  });

  it('kiểu ô của các khoá còn lại', () => {
    const kinds = (code: string, settings: Record<string, unknown>) =>
      Object.fromEntries(buildRuleFields(rule(code, settings)).map((f) => [f.path, f.kind]));

    expect(kinds('attendance.missing-checkout', { graceMinutes: 60 })).toEqual({
      graceMinutes: 'integer',
    });
    expect(kinds('attendance.no-registration', { weekday: 5, time: '18:00' })).toEqual({
      weekday: 'weekday',
      time: 'time',
    });
    expect(kinds('sales.discount', { minPercent: 20, minAmount: 100000 })).toEqual({
      minPercent: 'decimal',
      minAmount: 'money',
    });
    expect(
      kinds('cash.large-expense', { tillMinAmount: 500000, expenseMinAmount: 1000000 })
    ).toEqual({ tillMinAmount: 'money', expenseMinAmount: 'money' });
  });
});

describe('buildRuleFields — khoá chưa biết vẽ theo kiểu giá trị, nhãn là tên khoá', () => {
  it('số → ô số, true/false → công tắc, "HH:mm" → ô giờ, chuỗi khác → ô chữ', () => {
    const fields = buildRuleFields(
      rule('daily.summary', {
        lowStockThreshold: 5,
        skipWhenNoActivity: true,
        quietFrom: '22:30',
        note: 'ghi chú',
        notATime: '25:99',
        channels: { ...CHANNELS, zalo: false },
      })
    );

    expect(fields.map((f) => [f.path, f.kind, f.label])).toEqual([
      ['lowStockThreshold', 'decimal', 'lowStockThreshold'],
      ['skipWhenNoActivity', 'boolean', 'skipWhenNoActivity'],
      ['quietFrom', 'time', 'quietFrom'],
      ['note', 'text', 'note'],
      ['notATime', 'text', 'notATime'],
      ['channels.notification', 'boolean', 'Thông báo trong app'],
      ['channels.messenger', 'boolean', 'Messenger nội bộ'],
      ['channels.zalo', 'boolean', 'channels.zalo'],
    ]);
    expect(fields.find((f) => f.path === 'lowStockThreshold')?.unit).toBeUndefined();
  });

  it('quy tắc mới dùng lại khoá quen (time, weekday, minAmount) vẫn có nhãn và kiểu ô đúng', () => {
    const fields = buildRuleFields(
      rule('inventory.low-stock', {
        time: '07:00',
        weekday: 1,
        minAmount: 50000,
        lowStockThreshold: 3,
      })
    );

    expect(fields.map((f) => [f.path, f.kind, f.label])).toEqual([
      ['time', 'time', 'Giờ chạy'],
      ['weekday', 'weekday', 'Thứ trong tuần'],
      ['minAmount', 'money', 'Số tiền tối thiểu'],
      ['lowStockThreshold', 'decimal', 'lowStockThreshold'],
    ]);
  });

  it('khoá đã biết nhưng giá trị không còn đúng kiểu đã khai → vẽ theo kiểu thật của giá trị', () => {
    const fields = buildRuleFields(
      rule('till.discrepancy', { minDifference: '10k', toleranceAmount: 1000.5, weekday: 9 })
    );

    expect(fields.map((f) => [f.path, f.kind, f.label, f.unit])).toEqual([
      ['minDifference', 'text', 'minDifference', undefined],
      // Số tiền lẻ không qua được ô tiền (chỉ nhận số nguyên) → ô số thường để không làm tròn mất giá trị.
      ['toleranceAmount', 'decimal', 'toleranceAmount', undefined],
      ['weekday', 'decimal', 'weekday', undefined],
    ]);
  });
});

describe('giá trị của API ↔ chữ trong ô nhập', () => {
  it('ô tiền hiện dấu chấm hàng nghìn', () => {
    expect(formatMoney(0)).toBe('0');
    expect(formatMoney(999)).toBe('999');
    expect(formatMoney(10000)).toBe('10.000');
    expect(formatMoney(1500000)).toBe('1.500.000');
    expect(formatMoney(1_000_000_000_000)).toBe('1.000.000.000.000');
  });

  it('toFormValues: tiền có dấu chấm, số/giờ thành chuỗi, công tắc giữ true/false', () => {
    const r = rule('attendance.no-registration', {
      weekday: 5,
      time: '18:00',
      minAmount: 100000,
      channels: { notification: true, messenger: false },
    });

    expect(toFormValues(buildRuleFields(r), flattenSettings(r.settings))).toEqual({
      weekday: '5',
      time: '18:00',
      minAmount: '100.000',
      'channels.notification': true,
      'channels.messenger': false,
    });
  });

  it('lọc chữ gõ vào ô số', () => {
    expect(sanitizeFieldInput('money', '20000')).toBe('20.000');
    expect(sanitizeFieldInput('money', '1.500.0000')).toBe('15.000.000');
    expect(sanitizeFieldInput('money', '12a,5đ')).toBe('125');
    expect(sanitizeFieldInput('money', '007')).toBe('7');
    expect(sanitizeFieldInput('money', '0')).toBe('0');
    expect(sanitizeFieldInput('money', '')).toBe('');
    expect(sanitizeFieldInput('integer', '9 0 phút')).toBe('90');
    expect(sanitizeFieldInput('decimal', '35,5%')).toBe('35,5');
    expect(sanitizeFieldInput('text', ' a b ')).toBe(' a b ');
  });

  it('đọc lại giá trị gửi API', () => {
    expect(parseFormValue('money', '1.500.000')).toEqual({ ok: true, value: 1500000 });
    expect(parseFormValue('money', '0')).toEqual({ ok: true, value: 0 });
    expect(parseFormValue('integer', '90')).toEqual({ ok: true, value: 90 });
    expect(parseFormValue('decimal', '35,5')).toEqual({ ok: true, value: 35.5 });
    expect(parseFormValue('decimal', '35.5')).toEqual({ ok: true, value: 35.5 });
    expect(parseFormValue('decimal', '-3')).toEqual({ ok: true, value: -3 });
    expect(parseFormValue('weekday', '0')).toEqual({ ok: true, value: 0 });
    expect(parseFormValue('time', '06:15')).toEqual({ ok: true, value: '06:15' });
    expect(parseFormValue('text', ' ghi chú ')).toEqual({ ok: true, value: ' ghi chú ' });
    expect(parseFormValue('boolean', true)).toEqual({ ok: true, value: true });
    expect(parseFormValue('boolean', undefined)).toEqual({ ok: true, value: false });
  });

  it('ô bỏ trống / gõ dở không đọc được → có lời nhắc, không thành số 0', () => {
    expect(parseFormValue('money', '')).toEqual({ ok: false, error: 'Nhập số tiền (đồng).' });
    expect(parseFormValue('integer', '')).toMatchObject({ ok: false });
    expect(parseFormValue('decimal', '')).toMatchObject({ ok: false });
    expect(parseFormValue('decimal', '3.')).toMatchObject({ ok: false });
    expect(parseFormValue('decimal', '1.000,5')).toMatchObject({ ok: false });
    expect(parseFormValue('weekday', '7')).toMatchObject({ ok: false });
    expect(parseFormValue('time', '')).toMatchObject({ ok: false });
    expect(parseFormValue('time', '8h')).toMatchObject({ ok: false });
    expect(parseFormValue('time', '25:00')).toMatchObject({ ok: false });
  });
});

describe('diffSettings — chỉ những gì đã đổi', () => {
  const r = rule('sales.discount', { minPercent: 20, minAmount: 100000, channels: CHANNELS });
  const fields = buildRuleFields(r);
  const saved = flattenSettings(r.settings);

  it('form chưa sửa → không có gì để gửi', () => {
    expect(diffSettings(fields, toFormValues(fields, saved), saved)).toEqual({
      changed: {},
      invalid: {},
    });
  });

  it('chỉ trả các đường dẫn có giá trị khác giá trị đang lưu', () => {
    const values = {
      ...toFormValues(fields, saved),
      minPercent: '35,5',
      minAmount: '100.000', // gõ lại đúng giá trị cũ → không tính là đổi
      'channels.messenger': false,
    };

    expect(diffSettings(fields, values, saved)).toEqual({
      changed: { minPercent: 35.5, 'channels.messenger': false },
      invalid: {},
    });
  });

  it('ô không đọc được nằm ở invalid, không lẫn vào phần gửi lên', () => {
    const values = { ...toFormValues(fields, saved), minAmount: '', minPercent: '30' };

    expect(diffSettings(fields, values, saved)).toEqual({
      changed: { minPercent: 30 },
      invalid: { minAmount: 'Nhập số tiền (đồng).' },
    });
  });
});

describe('splitServerErrors — gắn câu lỗi của máy chủ vào đúng ô', () => {
  const paths = [
    'minDifference',
    'toleranceAmount',
    'time',
    'weekday',
    'channels.notification',
    'channels.messenger',
  ];

  it('câu lỗi nêu khoá trong ngoặc đơn hoặc ngoặc kép → lỗi của ô đó', () => {
    const { byPath, general } = splitServerErrors(
      [
        'Mức chênh lệch tối thiểu (minDifference) phải từ 0 đến 1.000.000.000.000 đồng.',
        'Thiết lập "toleranceAmount" phải là số.',
        'Giờ gửi tóm tắt (time) phải là giờ dạng HH:mm theo giờ Việt Nam, ví dụ "08:00".',
        'Thứ trong tuần (weekday) phải từ 0 (Chủ nhật) đến 6 (Thứ Bảy); 5 là Thứ Sáu.',
        'Thiết lập "channels.messenger" phải là true hoặc false.',
      ],
      paths
    );

    expect(general).toEqual([]);
    expect(Object.keys(byPath)).toEqual([
      'minDifference',
      'toleranceAmount',
      'time',
      'weekday',
      'channels.messenger',
    ]);
    expect(byPath.minDifference).toContain('phải từ 0 đến');
  });

  it('khoá lạ / lỗi không thuộc ô nào → lỗi chung (kể cả khi câu lỗi liệt kê tên các khoá hợp lệ)', () => {
    const errors = [
      'Quy tắc "till.discrepancy" không có thiết lập "minDiference". Thiết lập hợp lệ: minDifference, toleranceAmount, channels.',
      'Quy tắc "till.discrepancy" không có thiết lập "channels.sms". Thiết lập hợp lệ: channels.notification, channels.messenger.',
      'Thiết lập "channels" phải là một nhóm thiết lập dạng { … }.',
      'Cần gửi ít nhất một trong hai: enabled (bật/tắt) hoặc settings (thiết lập).',
    ];

    expect(splitServerErrors(errors, paths)).toEqual({ byPath: {}, general: errors });
  });

  it('hai câu lỗi của cùng một ô được gộp lại', () => {
    const { byPath } = splitServerErrors(
      ['Lỗi một (minDifference).', 'Thiết lập "minDifference" lỗi hai.'],
      paths
    );

    expect(byPath.minDifference).toBe(
      'Lỗi một (minDifference). Thiết lập "minDifference" lỗi hai.'
    );
  });
});

describe('requestErrorMessage', () => {
  it('dùng lời báo của máy chủ khi có, câu tiếng Việt dự phòng khi không có body đọc được', () => {
    expect(requestErrorMessage({ message: 'Không có quy tắc tự động "x".' }, 'dự phòng')).toBe(
      'Không có quy tắc tự động "x".'
    );
    // Interceptor của axios trả chuỗi này khi response không có body; trang lỗi HTML cũng là chuỗi.
    expect(requestErrorMessage('Something went wrong', 'dự phòng')).toBe('dự phòng');
    expect(requestErrorMessage('<html>404</html>', 'dự phòng')).toBe('dự phòng');
    expect(requestErrorMessage(undefined, 'dự phòng')).toBe('dự phòng');
    expect(requestErrorMessage({}, 'dự phòng')).toBe('dự phòng');
  });
});
