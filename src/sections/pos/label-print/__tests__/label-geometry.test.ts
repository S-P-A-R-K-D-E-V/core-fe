import { describe, expect, it } from 'vitest';

import { encodeEan13, totalModules, encodeCode128 } from '../barcode';
import {
  LABEL_TEMPLATES,
  DEFAULT_CALIBRATION,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_LABEL_OPTIONS,
} from '../label-template';
import {
  cssMm,
  snapMm,
  dotsToMm,
  formatMm,
  gridRows,
  mmToDots,
  fitBarcode,
  pageSizeMm,
  barcodeBars,
  DOTS_PER_MM,
  labelOrigins,
  labelsPerPage,
  moduleWidthText,
  barcodeWidthDots,
  computeLabelLayout,
  printableWidthDots,
  MIN_BARCODE_HEIGHT_MM,
} from '../label-geometry';

import type { LabelBlock } from '../label-geometry';
import type { ModuleDots, LabelTemplate } from '../label-template';

// ----------------------------------------------------------------------
// Hình học theo điểm in 203 dpi (8 điểm / mm): làm tròn về điểm, vạch là bội nguyên của module,
// vùng trắng, vừa / không vừa tem, bố cục trong tem và lưới tem trên trang (giấy cuộn và giấy tờ).
// ----------------------------------------------------------------------

const template = (id: string) => LABEL_TEMPLATES.find((item) => item.id === id) as LabelTemplate;
const TWO_UP = template(DEFAULT_TEMPLATE_ID);
const TOMY_145 = template('tomy-145');
const TOMY_103 = template('tomy-103');
const JEWELRY = template('jewelry-75x10');

const isOnDotGrid = (mm: number) => Number.isInteger(mm * DOTS_PER_MM);

const right = (box: LabelBlock) => box.leftMm + box.widthMm;
const bottom = (box: LabelBlock) => box.topMm + box.heightMm;

describe('điểm in', () => {
  it('8 điểm / mm; làm tròn về điểm gần nhất', () => {
    expect(DOTS_PER_MM).toBe(8);
    expect(mmToDots(35)).toBe(280);
    expect(mmToDots(0.25)).toBe(2);
    expect(mmToDots(0.3)).toBe(2);
    expect(mmToDots(0.2)).toBe(2);
    expect(mmToDots(0.05)).toBe(0);
    expect(dotsToMm(3)).toBe(0.375);
    expect(snapMm(1.3)).toBe(1.25);
    expect(snapMm(21.99)).toBe(22);
  });

  it('định dạng mm cho người đọc và cho CSS', () => {
    expect(formatMm(35.75)).toBe('35,75');
    expect(formatMm(33)).toBe('33');
    expect(cssMm(28.25)).toBe('28.25mm');
    expect(cssMm(0.1 + 0.2)).toBe('0.3mm');
  });

  it('độ rộng vạch: giấy cuộn nói theo điểm in, giấy tờ nói theo mm', () => {
    expect(moduleWidthText(TWO_UP, 2)).toBe('2 điểm');
    expect(moduleWidthText(TOMY_145, 2)).toBe('0,25 mm');
    expect(moduleWidthText(TOMY_145, 1)).toBe('0,125 mm');
    expect(moduleWidthText(TOMY_145, 3)).toBe('0,375 mm');
  });
});

describe('vạch theo điểm in', () => {
  const ean = encodeEan13('8934567890120');

  it.each([1, 2, 3] as ModuleDots[])('module %i điểm: x và độ rộng mọi vạch là bội nguyên của module', (dots) => {
    const bars = barcodeBars(ean, dots);

    bars.forEach((bar) => {
      expect(Number.isInteger(bar.x)).toBe(true);
      expect(bar.x % dots).toBe(0);
      expect(bar.width % dots).toBe(0);
      expect(bar.width).toBeGreaterThanOrEqual(dots);
      expect(bar.width).toBeLessThanOrEqual(4 * dots);
    });
    // EAN-13 có đúng 30 vạch đen: 3 nhóm vạch chặn × 2 vạch + 12 chữ số × 2 vạch
    expect(bars).toHaveLength(30);
    // Tổng độ rộng vạch = số module đen
    const black = ean.modules.split('1').length - 1;
    expect(bars.reduce((sum, bar) => sum + bar.width, 0)).toBe(black * dots);
  });

  it('vùng trắng nằm trong bề rộng: vạch đầu bắt đầu sau vùng trắng trái, vạch cuối kết thúc trước vùng trắng phải', () => {
    const bars = barcodeBars(ean, 2);
    const last = bars[bars.length - 1];

    // EAN-13: 11 module trái, 7 module phải
    expect(bars[0].x).toBe(11 * 2);
    expect(barcodeWidthDots(ean, 2) - (last.x + last.width)).toBe(7 * 2);
    expect(barcodeWidthDots(ean, 2)).toBe(113 * 2);

    // Code 128: 10 module mỗi bên
    const code128 = encodeCode128('SP000123');
    const bars128 = barcodeBars(code128, 3);
    const last128 = bars128[bars128.length - 1];
    expect(bars128[0].x).toBe(10 * 3);
    expect(barcodeWidthDots(code128, 3) - (last128.x + last128.width)).toBe(10 * 3);
    expect(barcodeWidthDots(code128, 3)).toBe(totalModules(code128) * 3);
  });

  it('vẽ lại từ các vạch ra đúng mẫu module ban đầu', () => {
    const barcode = encodeCode128('KT-NO-01');
    const dots = 2;
    const painted = new Array(barcodeWidthDots(barcode, dots)).fill('0');
    barcodeBars(barcode, dots).forEach((bar) => {
      for (let x = bar.x; x < bar.x + bar.width; x += 1) painted[x] = '1';
    });

    const expected =
      '0'.repeat(barcode.quietLeft * dots) +
      barcode.modules
        .split('')
        .map((module) => module.repeat(dots))
        .join('') +
      '0'.repeat(barcode.quietRight * dots);
    expect(painted.join('')).toBe(expected);
  });
});

describe('vừa / không vừa tem', () => {
  it('bề rộng dành cho mã vạch = rộng tem trừ lề trong hai bên', () => {
    expect(printableWidthDots(TWO_UP)).toBe((35 - 2) * 8);
    expect(printableWidthDots(template('1x50x30'))).toBe((50 - 3) * 8);
    expect(printableWidthDots(template('3x33x22-r104'))).toBe((33 - 2) * 8);
    expect(printableWidthDots(TOMY_145)).toBe((38 - 2) * 8);
    // Tem trang sức: nửa trái của 45 mm vùng in, trừ lề trong 0,5 mm hai bên
    expect(printableWidthDots(JEWELRY)).toBe((22.5 - 1) * 8);
  });

  it('EAN-13 ở module 2 điểm vừa tem 35 mm, được căn giữa đúng lưới điểm in', () => {
    const fit = fitBarcode(encodeEan13('8934567890120'), TWO_UP, 2);

    expect(fit.fits).toBe(true);
    expect(fit.widthDots).toBe(226);
    expect(fit.widthMm).toBe(28.25);
    expect(fit.availableMm).toBe(33);
    if (fit.fits) {
      // lề trong 1 mm + (264 − 226) / 2 = 19 điểm
      expect(fit.leftMm).toBe(1 + 19 / 8);
      expect(isOnDotGrid(fit.leftMm)).toBe(true);
    }
  });

  it('phần dư lẻ điểm: căn giữa làm tròn xuống, không ra toạ độ nửa điểm', () => {
    // 77 module × 3 = 231 điểm trong 264 điểm → dư 33 điểm → lệch trái 16 điểm
    const fit = fitBarcode(encodeCode128('1234'), TWO_UP, 3);

    expect(fit.fits).toBe(true);
    if (fit.fits) expect(fit.leftMm).toBe(1 + 16 / 8);
  });

  it('"SP000123" vừa tem 35 mm nhờ chuyển sang bộ C (121 module = 30,25 mm)', () => {
    const fit = fitBarcode(encodeCode128('SP000123'), TWO_UP, 2);

    expect(fit.fits).toBe(true);
    expect(fit.widthMm).toBe(30.25);
  });

  it('không vừa → báo "mã quá dài cho khổ tem này" kèm bề rộng cần, gợi ý mẫu rộng hơn hoặc module 1', () => {
    const fit = fitBarcode(encodeCode128('KT-NO-01'), TWO_UP, 2);

    expect(fit.fits).toBe(false);
    expect(fit.widthDots).toBe(286);
    expect(fit.widthMm).toBe(35.75);
    if (!fit.fits) {
      expect(fit.message).toBe(
        'Mã quá dài cho khổ tem này: cần 35,75 mm, tem chỉ in được 33 mm. Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống 1 điểm.'
      );
    }
  });

  it('không bao giờ thu nhỏ theo tỉ lệ lẻ: bề rộng báo về luôn là số module × số điểm', () => {
    const barcode = encodeCode128('KT-NO-01');

    ([1, 2, 3] as ModuleDots[]).forEach((dots) => {
      expect(fitBarcode(barcode, TWO_UP, dots).widthDots).toBe(143 * dots);
      expect(fitBarcode(barcode, TOMY_145, dots).widthDots).toBe(143 * dots);
    });
    expect(fitBarcode(barcode, TWO_UP, 1).fits).toBe(true);
    expect(fitBarcode(barcode, template('1x50x30'), 2).fits).toBe(true);
    // 143 module × 0,25 mm = 35,75 mm vừa khít 36 mm của tem 38×21
    expect(fitBarcode(barcode, TOMY_145, 2).fits).toBe(true);
  });

  it('module 3 điểm không vừa nhưng 2 điểm vừa → gợi ý 2 điểm; module 1 vẫn không vừa → chỉ gợi ý đổi mẫu', () => {
    const ean = fitBarcode(encodeEan13('8934567890120'), TWO_UP, 3);
    expect(ean.fits).toBe(false);
    if (!ean.fits) expect(ean.message).toContain('giảm độ rộng vạch xuống 2 điểm');

    const long = fitBarcode(encodeCode128('MA-HANG-RAT-DAI-KHONG-THE-VUA-0001'), TWO_UP, 1);
    expect(long.fits).toBe(false);
    if (!long.fits) {
      expect(long.message).toContain('Mã quá dài cho khổ tem này');
      expect(long.message).toContain('Chọn mẫu tem rộng hơn.');
      expect(long.message).not.toContain('giảm độ rộng vạch');
    }
  });

  it('giấy tờ: gợi ý độ rộng vạch theo mm', () => {
    const fit = fitBarcode(encodeEan13('8934567890120'), TOMY_145, 3);

    expect(fit.fits).toBe(false);
    if (!fit.fits) {
      expect(fit.message).toBe(
        'Mã quá dài cho khổ tem này: cần 42,375 mm, tem chỉ in được 36 mm. Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống 0,25 mm.'
      );
    }
  });

  it('tem trang sức: mã vạch nằm gọn trong nửa trái của vùng in, ở vạch 1 điểm', () => {
    const ean = fitBarcode(encodeEan13('8934567890120'), JEWELRY, 1);
    expect(ean.fits).toBe(true);
    if (ean.fits) {
      expect(ean.leftMm).toBeGreaterThanOrEqual(0.5);
      expect(ean.leftMm + ean.widthMm).toBeLessThanOrEqual(22);
    }
    expect(fitBarcode(encodeCode128('KT-NO-01'), JEWELRY, 1).fits).toBe(true);

    const wide = fitBarcode(encodeEan13('8934567890120'), JEWELRY, 2);
    expect(wide.fits).toBe(false);
    if (!wide.fits) {
      expect(wide.message).toContain('cần 28,25 mm, tem chỉ in được 21,5 mm');
      expect(wide.message).toContain('giảm độ rộng vạch xuống 1 điểm');
    }
  });
});

describe('bố cục trong tem', () => {
  it('tem 35×22: tên 2 dòng, mã vạch, mã đọc được, giá — xếp không chồng nhau, gọn trong tem', () => {
    const result = computeLabelLayout(TWO_UP, DEFAULT_LABEL_OPTIONS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { store, name, barcode, code, price } = result.layout;

    expect(store).toBeNull();
    expect(name?.lines).toBe(2);
    expect(name!.topMm).toBe(1);
    expect(barcode.topMm).toBeGreaterThanOrEqual(bottom(name!));
    expect(code.topMm).toBeGreaterThanOrEqual(bottom(barcode));
    expect(price!.topMm).toBeGreaterThanOrEqual(bottom(code));
    expect(bottom(price!)).toBeLessThanOrEqual(22 - 1);
    expect(barcode.heightMm).toBeGreaterThanOrEqual(MIN_BARCODE_HEIGHT_MM);
    [name!, barcode, code, price!].forEach((box) => {
      expect(box.leftMm).toBe(1);
      expect(box.widthMm).toBe(33);
    });
  });

  it('mọi toạ độ và chiều cao nằm trên lưới điểm in; chiều cao mã vạch là số nguyên điểm', () => {
    LABEL_TEMPLATES.forEach((item) => {
      const result = computeLabelLayout(item, { ...DEFAULT_LABEL_OPTIONS, showStoreName: true });
      expect(result.ok, item.name).toBe(true);
      if (!result.ok) return;
      const { store, name, barcode, code, price } = result.layout;

      [store!, name!, barcode, code, price!].forEach((box) => {
        expect(isOnDotGrid(box.leftMm)).toBe(true);
        expect(isOnDotGrid(box.topMm)).toBe(true);
        expect(isOnDotGrid(box.widthMm)).toBe(true);
        expect(isOnDotGrid(box.heightMm)).toBe(true);
        // Không khối nào ra ngoài tem
        expect(box.topMm).toBeGreaterThanOrEqual(0);
        expect(bottom(box)).toBeLessThanOrEqual(item.labelHeightMm);
        expect(right(box)).toBeLessThanOrEqual(item.labelWidthMm);
      });
      expect(Number.isInteger(barcode.heightDots)).toBe(true);
      expect(barcode.heightDots).toBe(barcode.heightMm * 8);
      expect(barcode.heightMm).toBeGreaterThanOrEqual(MIN_BARCODE_HEIGHT_MM);
    });
  });

  it('cỡ chữ đủ đọc ở 203 dpi: mọi mẫu có sẵn từ 6 pt trở lên, dòng tên cao hơn cỡ chữ', () => {
    LABEL_TEMPLATES.forEach((item) => {
      expect(Math.min(item.namePt, item.codePt, item.pricePt)).toBeGreaterThanOrEqual(6);
      const result = computeLabelLayout(item, DEFAULT_LABEL_OPTIONS);
      if (result.ok) expect(result.layout.name!.lineHeightMm).toBeGreaterThan((item.namePt * 25.4) / 72);
    });
  });

  it('tắt tên / giá → không còn khối đó, mã vạch cao lên', () => {
    const full = computeLabelLayout(TWO_UP, DEFAULT_LABEL_OPTIONS);
    const bare = computeLabelLayout(TWO_UP, { ...DEFAULT_LABEL_OPTIONS, showName: false, showPrice: false });

    expect(full.ok && bare.ok).toBe(true);
    if (!full.ok || !bare.ok) return;
    expect(bare.layout.name).toBeNull();
    expect(bare.layout.price).toBeNull();
    expect(bare.layout.barcode.topMm).toBe(1);
    expect(bare.layout.barcode.heightMm).toBeGreaterThan(full.layout.barcode.heightMm);
  });

  it('bật tên cửa hàng → thêm một dòng trên cùng, tên hàng lùi xuống, mã vạch thấp đi nhưng vẫn đủ cao', () => {
    const plain = computeLabelLayout(TWO_UP, DEFAULT_LABEL_OPTIONS);
    const branded = computeLabelLayout(TWO_UP, { ...DEFAULT_LABEL_OPTIONS, showStoreName: true });

    expect(plain.ok && branded.ok).toBe(true);
    if (!plain.ok || !branded.ok) return;
    const { store, name, barcode } = branded.layout;

    expect(store).toMatchObject({ leftMm: 1, topMm: 1, widthMm: 33 });
    expect(name!.topMm).toBe(bottom(store!));
    expect(name!.lines).toBe(2);
    expect(barcode.heightMm).toBe(plain.layout.barcode.heightMm - store!.heightMm);
    expect(barcode.heightMm).toBeGreaterThanOrEqual(MIN_BARCODE_HEIGHT_MM);
  });

  it('tem thấp: tự rút tên còn 1 dòng; thấp quá thì báo lỗi rõ ràng', () => {
    const low = computeLabelLayout({ ...TWO_UP, labelHeightMm: 18 }, DEFAULT_LABEL_OPTIONS);
    expect(low.ok).toBe(true);
    if (low.ok) expect(low.layout.name?.lines).toBe(1);

    const tooLow = computeLabelLayout({ ...TWO_UP, labelHeightMm: 12 }, DEFAULT_LABEL_OPTIONS);
    expect(tooLow.ok).toBe(false);
    if (!tooLow.ok) expect(tooLow.error).toMatch(/^Tem cao 12 mm không đủ chỗ cho mã vạch \(thiếu [\d,]+ mm\)/);
  });

  it('tem trang sức (bố cục chia đôi): mã vạch + mã bên trái, tên + giá bên phải, tất cả trong 45 mm đầu', () => {
    const result = computeLabelLayout(JEWELRY, DEFAULT_LABEL_OPTIONS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { name, barcode, code, price } = result.layout;

    // Nửa trái: 0,5 → 22 mm
    expect(barcode).toMatchObject({ leftMm: 0.5, topMm: 0.5, widthMm: 21.5 });
    expect(code).toMatchObject({ leftMm: 0.5, widthMm: 21.5 });
    expect(code.topMm).toBeGreaterThan(bottom(barcode));
    expect(bottom(code)).toBeLessThanOrEqual(10 - 0.5);
    // Nửa phải: 23 → 44,5 mm
    expect(name).toMatchObject({ leftMm: 23, widthMm: 21.5 });
    expect(price).toMatchObject({ leftMm: 23, widthMm: 21.5 });
    expect(price!.topMm).toBe(bottom(name!));
    expect(name!.topMm).toBeGreaterThanOrEqual(0.5);
    expect(bottom(price!)).toBeLessThanOrEqual(10 - 0.5);
    [name!, barcode, code, price!].forEach((box) => expect(right(box)).toBeLessThanOrEqual(45));
    expect(barcode.heightMm).toBeGreaterThanOrEqual(MIN_BARCODE_HEIGHT_MM);
  });

  it('bố cục chia đôi: chữ không đủ chỗ theo chiều cao → báo lỗi, không tự bỏ bớt', () => {
    const result = computeLabelLayout(
      { ...JEWELRY, namePt: 9, pricePt: 12 },
      { ...DEFAULT_LABEL_OPTIONS, showStoreName: true }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('không đủ chỗ cho tên và giá bên cạnh mã vạch');
  });
});

describe('lưới tem trên một trang', () => {
  it('khổ trang: giấy cuộn = khổ cuộn × chiều cao tem; giấy tờ = cả tờ', () => {
    expect(pageSizeMm(TWO_UP)).toEqual({ widthMm: 74, heightMm: 22 });
    expect(pageSizeMm(template('3x33x22-r104'))).toEqual({ widthMm: 104, heightMm: 22 });
    expect(pageSizeMm(template('2x35x22-r72'))).toEqual({ widthMm: 72, heightMm: 22 });
    expect(pageSizeMm(template('3x35x22-r110'))).toEqual({ widthMm: 110, heightMm: 22 });
    expect(pageSizeMm(template('1x50x30'))).toEqual({ widthMm: 50, heightMm: 30 });
    expect(pageSizeMm(template('1x40x30'))).toEqual({ widthMm: 40, heightMm: 30 });
    expect(pageSizeMm(JEWELRY)).toEqual({ widthMm: 75, heightMm: 10 });
    expect(pageSizeMm(TOMY_103)).toEqual({ widthMm: 202, heightMm: 162 });
    expect(pageSizeMm(TOMY_145)).toEqual({ widthMm: 210, heightMm: 297 });
    // Giấy cuộn: chiều cao trang luôn theo tem, kể cả khi pageHeightMm ghi số khác
    expect(pageSizeMm({ ...TWO_UP, labelHeightMm: 25, pageHeightMm: 297 })).toEqual({ widthMm: 74, heightMm: 25 });
  });

  it('số tem mỗi trang = số hàng × số tem mỗi hàng; giấy cuộn luôn 1 hàng', () => {
    expect(labelsPerPage(TWO_UP)).toBe(2);
    expect(labelsPerPage(template('3x33x22-r104'))).toBe(3);
    expect(labelsPerPage(JEWELRY)).toBe(1);
    expect(labelsPerPage(TOMY_103)).toBe(12);
    expect(labelsPerPage(TOMY_145)).toBe(65);
    expect(gridRows({ ...TWO_UP, rows: 9 })).toBe(1);
    expect(gridRows(TOMY_145)).toBe(13);
  });

  it('cuộn 2 nhãn 74 mm: 1 | 35 | 2 | 35 | 1', () => {
    expect(labelOrigins(TWO_UP, DEFAULT_CALIBRATION)).toEqual([
      { leftMm: 1, topMm: 0 },
      { leftMm: 38, topMm: 0 },
    ]);
  });

  it('cuộn 3 nhãn: nằm gọn trong khổ 104 mm và 110 mm', () => {
    const narrow = labelOrigins(template('3x33x22-r104'), DEFAULT_CALIBRATION);
    expect(narrow.map((origin) => origin.leftMm)).toEqual([0.5, 35.5, 70.5]);
    expect(narrow[2].leftMm + 33).toBeLessThanOrEqual(104);

    const wide = labelOrigins(template('3x35x22-r110'), DEFAULT_CALIBRATION);
    expect(wide.map((origin) => origin.leftMm)).toEqual([0.5, 37.5, 74.5]);
    expect(wide[2].leftMm + 35).toBeLessThanOrEqual(110);
  });

  it('giấy 65 nhãn A4: 13 hàng × 5 cột theo thứ tự trái → phải, trên → xuống', () => {
    const origins = labelOrigins(TOMY_145, DEFAULT_CALIBRATION);

    expect(origins).toHaveLength(65);
    expect(origins.slice(0, 6)).toEqual([
      { leftMm: 5, topMm: 12 },
      { leftMm: 45.5, topMm: 12 },
      { leftMm: 86, topMm: 12 },
      { leftMm: 126.5, topMm: 12 },
      { leftMm: 167, topMm: 12 },
      { leftMm: 5, topMm: 33 },
    ]);
    expect(origins[64]).toEqual({ leftMm: 167, topMm: 264 });
    // Ô cuối vẫn nằm trong tờ A4
    expect(origins[64].leftMm + 38).toBeLessThanOrEqual(210);
    expect(origins[64].topMm + 21).toBeLessThanOrEqual(297);
  });

  it('giấy 12 nhãn Tomy 103: 4 hàng × 3 cột trên tờ 202×162', () => {
    const origins = labelOrigins(TOMY_103, DEFAULT_CALIBRATION);

    expect(origins).toHaveLength(12);
    expect(origins.slice(0, 4)).toEqual([
      { leftMm: 6, topMm: 6 },
      { leftMm: 70, topMm: 6 },
      { leftMm: 134, topMm: 6 },
      { leftMm: 6, topMm: 44 },
    ]);
    expect(origins[11]).toEqual({ leftMm: 134, topMm: 120 });
    expect(origins[11].leftMm + 62).toBeLessThanOrEqual(202);
    expect(origins[11].topMm + 36).toBeLessThanOrEqual(162);
  });

  it('căn chỉnh giấy cuộn: lệch trái / lệch trên dịch cả hàng, khe cột thêm cộng dồn theo cột', () => {
    const origins = labelOrigins(template('3x35x22-r110'), {
      offsetLeftMm: 1.5,
      offsetTopMm: -0.5,
      extraColumnGapMm: 0.5,
      extraRowGapMm: 3,
      moduleDots: 2,
    });

    expect(origins).toEqual([
      { leftMm: 2, topMm: -0.5 },
      { leftMm: 39.5, topMm: -0.5 },
      { leftMm: 77, topMm: -0.5 },
    ]);
  });

  it('căn chỉnh giấy tờ: thêm khe hàng cộng dồn theo hàng', () => {
    const origins = labelOrigins(TOMY_145, {
      offsetLeftMm: -1,
      offsetTopMm: 0.5,
      extraColumnGapMm: 0.5,
      extraRowGapMm: 0.5,
      moduleDots: 2,
    });

    expect(origins[0]).toEqual({ leftMm: 4, topMm: 12.5 });
    expect(origins[4]).toEqual({ leftMm: 4 + 4 * 41, topMm: 12.5 });
    expect(origins[5]).toEqual({ leftMm: 4, topMm: 34 });
    expect(origins[64]).toEqual({ leftMm: 168, topMm: 12.5 + 12 * 21.5 });
  });

  it('giấy cuộn tuỳ chỉnh có số lẻ: mọi toạ độ về đúng lưới điểm in', () => {
    const origins = labelOrigins(
      { ...TWO_UP, marginLeftMm: 1.3, labelWidthMm: 34.9, columnGapMm: 2.2, columns: 4 },
      DEFAULT_CALIBRATION
    );

    origins.forEach((origin) => expect(isOnDotGrid(origin.leftMm)).toBe(true));
  });

  it('giấy tờ tuỳ chỉnh giữ đúng số mm của mẫu (không làm tròn về điểm in, sai số không dồn theo hàng)', () => {
    // Giấy 65 nhãn 38,1 × 21,2: lề 4,75 / 10,7, bước ngang 40,6, bước dọc 21,2
    const origins = labelOrigins(
      {
        ...TOMY_145,
        labelWidthMm: 38.1,
        labelHeightMm: 21.2,
        marginLeftMm: 4.75,
        marginTopMm: 10.7,
        columnGapMm: 2.5,
      },
      DEFAULT_CALIBRATION
    );

    expect(origins[0]).toEqual({ leftMm: 4.75, topMm: 10.7 });
    expect(origins[4].leftMm).toBe(167.15);
    expect(origins[64]).toEqual({ leftMm: 167.15, topMm: 265.1 });
  });
});
