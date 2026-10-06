import { describe, expect, it } from 'vitest';

import {
  loadCalibration,
  saveCalibration,
  LABEL_TEMPLATES,
  resolveTemplate,
  stepCalibration,
  loadLabelSettings,
  normalizeTemplate,
  saveLabelSettings,
  CUSTOM_TEMPLATE_ID,
  defaultCalibration,
  DEFAULT_CALIBRATION,
  DEFAULT_TEMPLATE_ID,
  normalizeCalibration,
  DEFAULT_LABEL_OPTIONS,
  validateLabelTemplate,
  DEFAULT_LABEL_SETTINGS,
  DEFAULT_CUSTOM_TEMPLATE,
  LABEL_SETTINGS_STORAGE_KEY,
  LABEL_CALIBRATION_STORAGE_KEY,
} from '../label-template';

import type { LabelTemplate, LabelCalibration } from '../label-template';

// ----------------------------------------------------------------------
// Mẫu giấy có sẵn (cuộn / tờ), kiểm tra mẫu tuỳ chỉnh, căn chỉnh theo bước 0,5 mm và việc nhớ theo
// trình duyệt.
// ----------------------------------------------------------------------

const template = (id: string) => LABEL_TEMPLATES.find((item) => item.id === id) as LabelTemplate;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('mẫu có sẵn', () => {
  it('danh sách loại giấy theo đúng tên; mặc định là cuộn 2 nhãn khổ 74×22 mm', () => {
    expect(LABEL_TEMPLATES.map((item) => item.name)).toEqual([
      'Cuộn 3 nhãn - khổ 104×22 mm',
      'Cuộn 2 nhãn - khổ 72×22 mm',
      'Cuộn 2 nhãn - khổ 74×22 mm',
      'Cuộn 3 nhãn - khổ 110×22 mm',
      'Cuộn 1 nhãn - 50×30 mm',
      'Cuộn 1 nhãn - 40×30 mm',
      'Giấy 12 nhãn - Tomy 103 (tờ 202×162 mm)',
      'Giấy 65 nhãn - A4 Tomy 145',
      'Tem trang sức - 75×10 mm',
    ]);
    expect(template(DEFAULT_TEMPLATE_ID).name).toBe('Cuộn 2 nhãn - khổ 74×22 mm');
    expect(DEFAULT_LABEL_SETTINGS.templateId).toBe(DEFAULT_TEMPLATE_ID);
    expect(new Set(LABEL_TEMPLATES.map((item) => item.id)).size).toBe(LABEL_TEMPLATES.length);
  });

  it('số đo của từng mẫu (mm): khổ giấy, lưới, kích thước tem, lề, khe', () => {
    const grid = (item: LabelTemplate) => [
      item.kind,
      `${item.pageWidthMm}×${item.pageHeightMm}`,
      `${item.columns}×${item.rows}`,
      `${item.labelWidthMm}×${item.labelHeightMm}`,
      `lề ${item.marginLeftMm}/${item.marginTopMm}`,
      `khe ${item.columnGapMm}/${item.rowGapMm}`,
    ];

    expect(Object.fromEntries(LABEL_TEMPLATES.map((item) => [item.id, grid(item)]))).toEqual({
      '3x33x22-r104': ['roll', '104×22', '3×1', '33×22', 'lề 0.5/0', 'khe 2/0'],
      '2x35x22-r72': ['roll', '72×22', '2×1', '35×22', 'lề 0/0', 'khe 2/0'],
      '2x35x22-r74': ['roll', '74×22', '2×1', '35×22', 'lề 1/0', 'khe 2/0'],
      '3x35x22-r110': ['roll', '110×22', '3×1', '35×22', 'lề 0.5/0', 'khe 2/0'],
      '1x50x30': ['roll', '50×30', '1×1', '50×30', 'lề 0/0', 'khe 0/0'],
      '1x40x30': ['roll', '40×30', '1×1', '40×30', 'lề 0/0', 'khe 0/0'],
      'tomy-103': ['sheet', '202×162', '3×4', '62×36', 'lề 6/6', 'khe 2/2'],
      'tomy-145': ['sheet', '210×297', '5×13', '38×21', 'lề 5/12', 'khe 2.5/0'],
      'jewelry-75x10': ['roll', '75×10', '1×1', '75×10', 'lề 0/0', 'khe 0/0'],
    });
  });

  it('lưới tem nằm vừa khít khổ giấy, lề hai bên đối xứng', () => {
    LABEL_TEMPLATES.forEach((item) => {
      const usedWidth = item.columns * item.labelWidthMm + (item.columns - 1) * item.columnGapMm;
      const usedHeight = item.rows * item.labelHeightMm + (item.rows - 1) * item.rowGapMm;

      expect(item.pageWidthMm - usedWidth, item.name).toBeCloseTo(2 * item.marginLeftMm, 6);
      expect(item.pageHeightMm - usedHeight, item.name).toBeCloseTo(2 * item.marginTopMm, 6);
    });
  });

  it('giấy cuộn luôn 1 hàng, trang cao bằng một tem; giấy tờ có nhiều hàng', () => {
    LABEL_TEMPLATES.filter((item) => item.kind === 'roll').forEach((item) => {
      expect(item.rows).toBe(1);
      expect(item.pageHeightMm).toBe(item.labelHeightMm);
    });
    expect(template('tomy-103').columns * template('tomy-103').rows).toBe(12);
    expect(template('tomy-145').columns * template('tomy-145').rows).toBe(65);
  });

  it('tem trang sức: bố cục chia đôi, chỉ in trong 45 mm đầu, mặc định vạch 1 điểm', () => {
    expect(template('jewelry-75x10')).toMatchObject({
      layout: 'split',
      printWidthMm: 45,
      defaultModuleDots: 1,
    });
    LABEL_TEMPLATES.filter((item) => item.id !== 'jewelry-75x10').forEach((item) => {
      expect(item.layout).toBe('stacked');
      expect(item.printWidthMm).toBe(0);
    });
  });

  it('mọi mẫu hợp lệ', () => {
    LABEL_TEMPLATES.forEach((item) => {
      expect(validateLabelTemplate(item), item.name).toEqual([]);
    });
    expect(validateLabelTemplate(DEFAULT_CUSTOM_TEMPLATE)).toEqual([]);
  });

  it('resolveTemplate: mẫu có sẵn theo id, mẫu tuỳ chỉnh của người dùng, id lạ → mặc định', () => {
    const custom = { ...DEFAULT_CUSTOM_TEMPLATE, labelWidthMm: 60, pageWidthMm: 130 };

    expect(resolveTemplate({ ...DEFAULT_LABEL_SETTINGS, templateId: '1x50x30' }).name).toBe('Cuộn 1 nhãn - 50×30 mm');
    expect(
      resolveTemplate({ ...DEFAULT_LABEL_SETTINGS, templateId: CUSTOM_TEMPLATE_ID, customTemplate: custom })
    ).toEqual(custom);
    expect(resolveTemplate({ ...DEFAULT_LABEL_SETTINGS, templateId: 'khong-co' }).id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it('mẫu tuỳ chỉnh kiểu cuộn luôn được đưa về 1 hàng, trang cao bằng tem; kiểu tờ giữ nguyên', () => {
    const roll = { ...DEFAULT_CUSTOM_TEMPLATE, labelHeightMm: 25, rows: 6, rowGapMm: 3, pageHeightMm: 297 };

    expect(normalizeTemplate(roll)).toMatchObject({ rows: 1, rowGapMm: 0, pageHeightMm: 25 });
    expect(
      resolveTemplate({ ...DEFAULT_LABEL_SETTINGS, templateId: CUSTOM_TEMPLATE_ID, customTemplate: roll })
    ).toMatchObject({ rows: 1, pageHeightMm: 25 });

    const sheet: LabelTemplate = { ...roll, kind: 'sheet' };
    expect(normalizeTemplate(sheet)).toBe(sheet);
  });
});

describe('kiểm tra mẫu tuỳ chỉnh', () => {
  it('khổ cuộn hẹp hơn tổng các tem → báo rõ con số', () => {
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, columns: 3 })).toEqual([
      'Khổ cuộn 74 mm hẹp hơn tổng lề trái, các tem và khe (110 mm).',
    ]);
  });

  it('giấy tờ: kiểm tra cả chiều ngang lẫn chiều dọc của lưới', () => {
    const sheet = template('tomy-145');

    expect(validateLabelTemplate({ ...sheet, rows: 14 })).toEqual([
      'Tờ giấy cao 297 mm thấp hơn tổng lề trên, các hàng tem và khe (306 mm).',
    ]);
    expect(validateLabelTemplate({ ...sheet, columns: 6 })).toEqual([
      'Tờ giấy rộng 210 mm hẹp hơn tổng lề trái, các tem và khe (245,5 mm).',
    ]);
    expect(validateLabelTemplate({ ...sheet, rows: 2.5 })).toEqual(['Số hàng mỗi tờ phải là số nguyên.']);
    expect(validateLabelTemplate({ ...sheet, pageHeightMm: Number.NaN })).toEqual([
      'Cao tờ giấy phải từ 10 đến 500 mm.',
    ]);
  });

  it('giấy cuộn bỏ qua số hàng / chiều cao tờ (không dùng tới)', () => {
    expect(
      validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, rows: Number.NaN, pageHeightMm: Number.NaN })
    ).toEqual([]);
  });

  it('số ngoài khoảng, số tem lẻ, ô bỏ trống', () => {
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, labelHeightMm: 3 })).toEqual([
      'Cao tem phải từ 8 đến 300 mm.',
    ]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, columns: 1.5 })).toEqual([
      'Số tem mỗi hàng phải là số nguyên.',
    ]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, columns: 0 })).toEqual([
      'Số tem mỗi hàng phải từ 1 đến 10 tem.',
    ]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, pageWidthMm: Number.NaN })).toEqual([
      'Khổ cuộn phải từ 10 đến 330 mm.',
    ]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, namePt: 3 })).toEqual([
      'Cỡ chữ tên phải từ 5 đến 24 pt.',
    ]);
  });

  it('vùng in: 0 (cả tem) hoặc từ 10 mm tới bề rộng tem', () => {
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, printWidthMm: 20 })).toEqual([]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, printWidthMm: 4 })).toEqual([
      'Vùng in từ mép trái phải bằng 0 (in cả tem) hoặc từ 10 mm trở lên.',
    ]);
    expect(validateLabelTemplate({ ...DEFAULT_CUSTOM_TEMPLATE, printWidthMm: 40 })).toEqual([
      'Vùng in 40 mm rộng hơn tem (35 mm).',
    ]);
  });
});

describe('căn chỉnh', () => {
  it('mặc định: không lệch, module 2 điểm; mẫu tem trang sức mặc định 1 điểm', () => {
    expect(DEFAULT_CALIBRATION).toEqual({
      offsetLeftMm: 0,
      offsetTopMm: 0,
      extraColumnGapMm: 0,
      extraRowGapMm: 0,
      moduleDots: 2,
    });
    expect(normalizeCalibration(null)).toEqual(DEFAULT_CALIBRATION);
    expect(normalizeCalibration('rác')).toEqual(DEFAULT_CALIBRATION);
    expect(defaultCalibration(DEFAULT_TEMPLATE_ID)).toEqual(DEFAULT_CALIBRATION);
    expect(defaultCalibration(CUSTOM_TEMPLATE_ID)).toEqual(DEFAULT_CALIBRATION);
    expect(defaultCalibration('jewelry-75x10')).toEqual({ ...DEFAULT_CALIBRATION, moduleDots: 1 });
  });

  it('đưa về bội của 0,5 mm, giới hạn ±10 mm; module chỉ nhận 1, 2, 3', () => {
    expect(
      normalizeCalibration({
        offsetLeftMm: 1.3,
        offsetTopMm: -0.7,
        extraColumnGapMm: 0.2,
        extraRowGapMm: 0.8,
        moduleDots: 3,
      })
    ).toEqual({ offsetLeftMm: 1.5, offsetTopMm: -0.5, extraColumnGapMm: 0, extraRowGapMm: 1, moduleDots: 3 });
    expect(normalizeCalibration({ offsetLeftMm: 99, offsetTopMm: -99, moduleDots: 1 })).toMatchObject({
      offsetLeftMm: 10,
      offsetTopMm: -10,
      moduleDots: 1,
    });
    expect(normalizeCalibration({ moduleDots: 4 }).moduleDots).toBe(2);
    expect(normalizeCalibration({ moduleDots: 1.5 }).moduleDots).toBe(2);
    expect(normalizeCalibration({ offsetLeftMm: 'abc' }).offsetLeftMm).toBe(0);
    // Không để lọt -0 (hiện "-0 mm")
    expect(Object.is(normalizeCalibration({ offsetLeftMm: -0.2 }).offsetLeftMm, 0)).toBe(true);
  });

  it('nhích từng bước 0,5 mm, chặn ở giới hạn', () => {
    let calibration = DEFAULT_CALIBRATION;
    calibration = stepCalibration(calibration, 'offsetLeftMm', 1);
    calibration = stepCalibration(calibration, 'offsetLeftMm', 1);
    calibration = stepCalibration(calibration, 'offsetTopMm', -1);
    calibration = stepCalibration(calibration, 'extraColumnGapMm', 3);
    calibration = stepCalibration(calibration, 'extraRowGapMm', -2);

    expect(calibration).toEqual({
      offsetLeftMm: 1,
      offsetTopMm: -0.5,
      extraColumnGapMm: 1.5,
      extraRowGapMm: -1,
      moduleDots: 2,
    });
    expect(stepCalibration({ ...calibration, offsetLeftMm: 10 }, 'offsetLeftMm', 1).offsetLeftMm).toBe(10);
    expect(stepCalibration({ ...calibration, moduleDots: 1 }, 'offsetTopMm', 1).moduleDots).toBe(1);
  });
});

describe('nhớ theo trình duyệt', () => {
  it('căn chỉnh lưu riêng cho từng mẫu dưới một khoá localStorage', () => {
    const storage = memoryStorage();
    const twoUp: LabelCalibration = {
      offsetLeftMm: 1.5,
      offsetTopMm: -0.5,
      extraColumnGapMm: 0.5,
      extraRowGapMm: 0,
      moduleDots: 2,
    };
    const sheet: LabelCalibration = {
      offsetLeftMm: -2,
      offsetTopMm: 0,
      extraColumnGapMm: 0,
      extraRowGapMm: 0.5,
      moduleDots: 3,
    };

    saveCalibration(DEFAULT_TEMPLATE_ID, twoUp, storage);
    saveCalibration('tomy-145', sheet, storage);

    expect(loadCalibration(DEFAULT_TEMPLATE_ID, storage)).toEqual(twoUp);
    expect(loadCalibration('tomy-145', storage)).toEqual(sheet);
    expect(loadCalibration('1x40x30', storage)).toEqual(DEFAULT_CALIBRATION);
    expect(loadCalibration('jewelry-75x10', storage).moduleDots).toBe(1);
    expect([...storage.data.keys()]).toEqual([LABEL_CALIBRATION_STORAGE_KEY]);
    expect(JSON.parse(storage.data.get(LABEL_CALIBRATION_STORAGE_KEY) as string)).toEqual({
      [DEFAULT_TEMPLATE_ID]: twoUp,
      'tomy-145': sheet,
    });
  });

  it('loại giấy chọn lần trước, tuỳ chọn và mẫu tuỳ chỉnh lưu rồi đọc lại y nguyên', () => {
    const storage = memoryStorage();
    const settings = {
      templateId: CUSTOM_TEMPLATE_ID,
      customTemplate: {
        ...DEFAULT_CUSTOM_TEMPLATE,
        kind: 'sheet' as const,
        layout: 'split' as const,
        labelWidthMm: 60,
        pageWidthMm: 62,
        pageHeightMm: 100,
        rows: 4,
        columns: 1,
      },
      options: {
        showName: false,
        showStoreName: true,
        showPrice: true,
        priceSuffix: 'VND' as const,
        showUnit: true,
        valueSource: 'code' as const,
      },
    };

    saveLabelSettings(settings, storage);

    expect([...storage.data.keys()]).toEqual([LABEL_SETTINGS_STORAGE_KEY]);
    expect(loadLabelSettings(storage)).toEqual(settings);

    saveLabelSettings({ ...settings, templateId: 'tomy-103' }, storage);
    expect(loadLabelSettings(storage).templateId).toBe('tomy-103');
  });

  it('chưa lưu gì, dữ liệu hỏng hoặc không có storage → mặc định, không ném lỗi', () => {
    expect(loadLabelSettings(memoryStorage())).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(loadLabelSettings(memoryStorage({ [LABEL_SETTINGS_STORAGE_KEY]: '{hỏng' }))).toEqual(
      DEFAULT_LABEL_SETTINGS
    );
    expect(loadLabelSettings(null)).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(loadCalibration(DEFAULT_TEMPLATE_ID, memoryStorage({ [LABEL_CALIBRATION_STORAGE_KEY]: '[1,2' }))).toEqual(
      DEFAULT_CALIBRATION
    );
    expect(loadCalibration(DEFAULT_TEMPLATE_ID, null)).toEqual(DEFAULT_CALIBRATION);

    const broken = {
      getItem: () => {
        throw new Error('bị chặn');
      },
      setItem: () => {
        throw new Error('đầy');
      },
    };
    expect(loadLabelSettings(broken)).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(() => saveLabelSettings(DEFAULT_LABEL_SETTINGS, broken)).not.toThrow();
    expect(() => saveCalibration(DEFAULT_TEMPLATE_ID, DEFAULT_CALIBRATION, broken)).not.toThrow();
  });

  it('dữ liệu cũ thiếu trường / sai kiểu được bù bằng mặc định', () => {
    const storage = memoryStorage({
      [LABEL_SETTINGS_STORAGE_KEY]: JSON.stringify({
        templateId: 'mau-da-xoa',
        customTemplate: { labelWidthMm: 45, columns: null, namePt: 'to', kind: 'giấy gì đó' },
        options: { showPrice: false, valueSource: 'gì đó', priceSuffix: '$' },
      }),
    });

    expect(loadLabelSettings(storage)).toEqual({
      templateId: DEFAULT_TEMPLATE_ID,
      customTemplate: { ...DEFAULT_CUSTOM_TEMPLATE, labelWidthMm: 45 },
      options: { ...DEFAULT_LABEL_OPTIONS, showPrice: false },
    });
  });

  it('mặc định dùng localStorage của trình duyệt', () => {
    window.localStorage.clear();
    saveCalibration('1x40x30', { ...DEFAULT_CALIBRATION, offsetTopMm: 2 });

    expect(window.localStorage.getItem(LABEL_CALIBRATION_STORAGE_KEY)).toContain('"1x40x30"');
    expect(loadCalibration('1x40x30').offsetTopMm).toBe(2);
    window.localStorage.clear();
  });
});
