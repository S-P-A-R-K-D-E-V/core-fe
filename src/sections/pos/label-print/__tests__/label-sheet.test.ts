import { describe, expect, it } from 'vitest';

import {
  LABEL_TEMPLATES,
  DEFAULT_CALIBRATION,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_LABEL_OPTIONS,
} from '../label-template';
import {
  labelValue,
  planLabelSheet,
  labelPriceText,
  formatLabelPrice,
  buildLabelListCsv,
  normalizeQuantity,
  MAX_LABELS_PER_JOB,
  renderLabelSheetHtml,
  renderCalibrationSheetHtml,
} from '../label-sheet';

import type { LabelSource, LabelPrintJob } from '../label-sheet';
import type { LabelOptions, LabelTemplate, LabelCalibration } from '../label-template';

// ----------------------------------------------------------------------
// Lệnh in → trang → HTML: giấy cuộn mỗi trang một hàng tem (khổ cuộn × chiều cao tem), giấy tờ mỗi trang
// một lưới tem; mã không in được bị loại kèm lý do, căn chỉnh dịch đúng vị trí tem, tuỳ chọn nội dung
// (giá, đơn vị, tên cửa hàng), giới hạn 5.000 tem và tài liệu tự chứa (không tải gì từ ngoài).
// ----------------------------------------------------------------------

const template = (id: string) => LABEL_TEMPLATES.find((item) => item.id === id) as LabelTemplate;
const TWO_UP = template(DEFAULT_TEMPLATE_ID);
const TOMY_145 = template('tomy-145');
const JEWELRY = template('jewelry-75x10');

const shirt: LabelSource = {
  key: 'p1',
  name: 'Áo thun cổ tròn trắng size M',
  code: 'SP000123',
  barcode: '8934567890120',
  price: 185000,
  unit: 'cái',
  quantity: 3,
};
const clip: LabelSource = { key: 'p2', name: 'Kẹp tóc nơ nhung đỏ', code: 'KT-NO-01', price: 35000, quantity: 2 };
const tote: LabelSource = {
  key: 'p3',
  name: 'Túi tote vải canvas in hình mèo',
  code: '2000000000015',
  price: 99000,
  quantity: 2,
};

const job = (
  items: LabelSource[],
  options: Partial<LabelOptions> = {},
  storeName?: string | null
): LabelPrintJob => ({ items, options: { ...DEFAULT_LABEL_OPTIONS, ...options }, storeName });

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const styleOf = (element: Element) => element.getAttribute('style') ?? '';

const mm = (text: string | null | undefined) => Number((text ?? '').replace('mm', ''));

/** Giá trị mm của một thuộc tính trong luật CSS của `.class`. */
function cssValue(html: string, selector: string, property: string): number {
  const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(html)?.[1] ?? '';
  return mm(new RegExp(`(?:^|;)${property}:([\\d.]+mm)`).exec(rule)?.[1]);
}

describe('các hàm nhỏ', () => {
  it('giá: tiền Việt không phần lẻ, dấu chấm ngăn nghìn, chữ "đ" liền sau', () => {
    expect(formatLabelPrice(185000)).toBe('185.000đ');
    expect(formatLabelPrice(1234567)).toBe('1.234.567đ');
    expect(formatLabelPrice(35000.4)).toBe('35.000đ');
    expect(formatLabelPrice(500)).toBe('500đ');
    expect(formatLabelPrice(0)).toBe('0đ');
    expect(formatLabelPrice(null)).toBe('');
    expect(formatLabelPrice(undefined)).toBe('');
    expect(formatLabelPrice(Number.NaN)).toBe('');
  });

  it('giá: có / không chữ "đ", "VND"; có / không đơn vị tính', () => {
    expect(formatLabelPrice(185000, { suffix: 'đ' })).toBe('185.000đ');
    expect(formatLabelPrice(185000, { suffix: 'VND' })).toBe('185.000 VND');
    expect(formatLabelPrice(185000, { suffix: 'none' })).toBe('185.000');
    expect(formatLabelPrice(185000, { unit: 'cái' })).toBe('185.000đ/cái');
    expect(formatLabelPrice(185000, { suffix: 'VND', unit: 'hộp' })).toBe('185.000 VND/hộp');
    expect(formatLabelPrice(185000, { suffix: 'none', unit: 'cái' })).toBe('185.000/cái');
    expect(formatLabelPrice(185000, { unit: '  ' })).toBe('185.000đ');
    expect(formatLabelPrice(null, { unit: 'cái' })).toBe('');

    // Đơn vị chỉ in khi bật tuỳ chọn VÀ sản phẩm có đơn vị
    expect(labelPriceText(shirt, DEFAULT_LABEL_OPTIONS)).toBe('185.000đ');
    expect(labelPriceText(shirt, { ...DEFAULT_LABEL_OPTIONS, showUnit: true })).toBe('185.000đ/cái');
    expect(labelPriceText(clip, { ...DEFAULT_LABEL_OPTIONS, showUnit: true })).toBe('35.000đ');
    expect(labelPriceText(shirt, { ...DEFAULT_LABEL_OPTIONS, showUnit: true, priceSuffix: 'VND' })).toBe(
      '185.000 VND/cái'
    );
  });

  it('số tem: số nguyên không âm', () => {
    expect(normalizeQuantity(3)).toBe(3);
    expect(normalizeQuantity('12')).toBe(12);
    expect(normalizeQuantity(2.9)).toBe(2);
    expect(normalizeQuantity(-1)).toBe(0);
    expect(normalizeQuantity('')).toBe(0);
    expect(normalizeQuantity('abc')).toBe(0);
    expect(normalizeQuantity(5000)).toBe(5000);
    expect(normalizeQuantity(1e12)).toBe(99999);
  });

  it('giá trị đem mã hoá: "Mã vạch" (không có thì mã hàng) hoặc "Mã hàng"', () => {
    expect(labelValue(shirt, DEFAULT_LABEL_OPTIONS)).toBe('8934567890120');
    expect(labelValue(clip, DEFAULT_LABEL_OPTIONS)).toBe('KT-NO-01');
    expect(labelValue({ ...shirt, barcode: '   ' }, DEFAULT_LABEL_OPTIONS)).toBe('SP000123');
    expect(labelValue(shirt, { valueSource: 'code' })).toBe('SP000123');
    expect(labelValue({ ...shirt, code: ' SP000123 ' }, { valueSource: 'code' })).toBe('SP000123');
  });
});

describe('chia trang — giấy cuộn', () => {
  it('7 tem trên mẫu 2 tem → 4 trang, trang cuối 1 tem; N tem của một mã nằm liền nhau', () => {
    const plan = planLabelSheet(job([shirt, { ...tote, quantity: 4 }]), TWO_UP, DEFAULT_CALIBRATION);

    expect(plan.labelsPerPage).toBe(2);
    expect(plan.labelCount).toBe(7);
    expect(plan.pageCount).toBe(4);
    expect(plan.pages.map((page) => page.map((label) => label.source.key))).toEqual([
      ['p1', 'p1'],
      ['p1', 'p3'],
      ['p3', 'p3'],
      ['p3'],
    ]);
    expect(plan.problems).toEqual([]);
    expect(plan.layoutError).toBeNull();
    expect(plan.limitError).toBeNull();
  });

  it('7 tem → HTML có 4 trang, khổ trang 74 mm × 22 mm, lề 0', () => {
    const html = renderLabelSheetHtml(job([shirt, { ...tote, quantity: 4 }]), TWO_UP, DEFAULT_CALIBRATION);
    const doc = parse(html);

    expect(html).toContain('@page{size:74mm 22mm;margin:0}');
    expect(html.match(/@page/g)).toHaveLength(1);

    const pages = Array.from(doc.querySelectorAll('.pg'));
    expect(pages).toHaveLength(4);
    expect(pages.map((page) => page.querySelectorAll('.lb').length)).toEqual([2, 2, 2, 1]);
    // Mọi trang là con trực tiếp của body, không có gì khác chen giữa
    expect(Array.from(doc.body.children).every((child) => child.classList.contains('pg'))).toBe(true);
    // Mỗi trang ngắt sang trang in mới; khung trang không vượt khổ 74 × 22
    expect(html).toMatch(/\.pg\{[^}]*width:73\.75mm;height:21\.75mm;overflow:hidden;break-after:page/);
    expect(html).toContain('.pg:last-child{break-after:auto');
    expect(html).toMatch(/\.lb\{[^}]*width:35mm;height:22mm/);
  });

  it('mỗi mẫu cuộn: số trang và khổ trang theo mẫu', () => {
    const cases: Array<[string, number, string, number]> = [
      ['3x33x22-r104', 7, '104mm 22mm', 3],
      ['3x35x22-r110', 7, '110mm 22mm', 3],
      ['2x35x22-r72', 5, '72mm 22mm', 3],
      ['1x50x30', 3, '50mm 30mm', 3],
      ['1x40x30', 1, '40mm 30mm', 1],
    ];

    cases.forEach(([id, quantity, size, pages]) => {
      const html = renderLabelSheetHtml(job([{ ...shirt, quantity }]), template(id), DEFAULT_CALIBRATION);
      expect(html, id).toContain(`@page{size:${size};margin:0}`);
      expect(parse(html).querySelectorAll('.pg'), id).toHaveLength(pages);
    });
  });

  it('cuộn 3 nhãn khổ 104 mm: một hàng 3 tem tại 0,5 / 35,5 / 70,5 mm', () => {
    const doc = parse(renderLabelSheetHtml(job([shirt]), template('3x33x22-r104'), DEFAULT_CALIBRATION));

    expect(Array.from(doc.querySelectorAll('.lb')).map(styleOf)).toEqual([
      'left:0.5mm;top:0mm',
      'left:35.5mm;top:0mm',
      'left:70.5mm;top:0mm',
    ]);
  });

  it('số tem 0 → bỏ qua dòng đó; maxPages chỉ dựng các trang đầu', () => {
    const items = [{ ...shirt, quantity: 0 }, { ...tote, quantity: 5 }];
    const plan = planLabelSheet(job(items), TWO_UP, DEFAULT_CALIBRATION);
    expect(plan.labelCount).toBe(5);
    expect(plan.pageCount).toBe(3);

    const first = parse(renderLabelSheetHtml(job(items), TWO_UP, DEFAULT_CALIBRATION, { maxPages: 1 }));
    expect(first.querySelectorAll('.pg')).toHaveLength(1);
    expect(first.querySelectorAll('.lb')).toHaveLength(2);
  });
});

describe('chia trang — giấy tờ (lưới hàng × cột)', () => {
  it('70 tem trên giấy 65 nhãn → 2 tờ, tờ thứ hai 5 tem', () => {
    const plan = planLabelSheet(job([{ ...shirt, quantity: 70 }]), TOMY_145, DEFAULT_CALIBRATION);

    expect(plan.labelsPerPage).toBe(65);
    expect(plan.labelCount).toBe(70);
    expect(plan.pageCount).toBe(2);
    expect(plan.pages.map((page) => page.length)).toEqual([65, 5]);
  });

  it('khổ trang trong HTML: giấy tờ là cả tờ A4, giấy cuộn là một hàng tem', () => {
    const sheet = renderLabelSheetHtml(job([{ ...shirt, quantity: 70 }]), TOMY_145, DEFAULT_CALIBRATION);
    const roll = renderLabelSheetHtml(job([{ ...shirt, quantity: 70 }]), TWO_UP, DEFAULT_CALIBRATION);

    expect(sheet).toContain('@page{size:210mm 297mm;margin:0}');
    expect(sheet).toMatch(/\.pg\{[^}]*width:209\.75mm;height:296\.75mm;overflow:hidden;break-after:page/);
    expect(sheet).toMatch(/\.lb\{[^}]*width:38mm;height:21mm/);
    expect(roll).toContain('@page{size:74mm 22mm;margin:0}');
    expect(parse(roll).querySelectorAll('.pg')).toHaveLength(35);
  });

  it('các ô lấp theo hàng: trái → phải rồi xuống hàng; tờ cuối chỉ có 5 ô đầu của hàng 1', () => {
    const doc = parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 70 }]), TOMY_145, DEFAULT_CALIBRATION));
    const pages = Array.from(doc.querySelectorAll('.pg'));
    const cells = (page: Element) => Array.from(page.querySelectorAll('.lb')).map(styleOf);

    expect(pages).toHaveLength(2);
    expect(cells(pages[0])).toHaveLength(65);
    expect(cells(pages[0]).slice(0, 6)).toEqual([
      'left:5mm;top:12mm',
      'left:45.5mm;top:12mm',
      'left:86mm;top:12mm',
      'left:126.5mm;top:12mm',
      'left:167mm;top:12mm',
      'left:5mm;top:33mm',
    ]);
    expect(cells(pages[0])[64]).toBe('left:167mm;top:264mm');
    expect(cells(pages[1])).toEqual(cells(pages[0]).slice(0, 5));
  });

  it('nhiều mã trên một tờ: N tem của mỗi mã lấp các ô liên tiếp', () => {
    const plan = planLabelSheet(
      job([{ ...shirt, quantity: 7 }, { ...tote, quantity: 8 }]),
      template('tomy-103'),
      DEFAULT_CALIBRATION
    );

    expect(plan.labelsPerPage).toBe(12);
    expect(plan.pages.map((page) => page.map((label) => label.source.key).join(''))).toEqual([
      'p1p1p1p1p1p1p1p3p3p3p3p3',
      'p3p3p3',
    ]);
    const html = renderLabelSheetHtml(
      job([{ ...shirt, quantity: 7 }, { ...tote, quantity: 8 }]),
      template('tomy-103'),
      DEFAULT_CALIBRATION
    );
    expect(html).toContain('@page{size:202mm 162mm;margin:0}');
  });

  it('giấy tờ: mã vạch vẫn ở độ rộng module cố định (0,25 mm), không co giãn theo tem', () => {
    const svgOn = (target: LabelTemplate) =>
      parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 1 }]), target, DEFAULT_CALIBRATION)).querySelector(
        'svg.bc'
      ) as Element;

    // EAN-13: 113 module × 0,25 mm = 28,25 mm trên mọi khổ tem
    [TOMY_145, template('tomy-103'), TWO_UP, template('1x50x30')].forEach((target) => {
      expect(svgOn(target).getAttribute('width'), target.name).toBe('28.25mm');
      expect(svgOn(target).getAttribute('viewBox'), target.name).toMatch(/^0 0 226 /);
    });
  });
});

describe('nội dung một tem', () => {
  const doc = parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 1 }]), TWO_UP, DEFAULT_CALIBRATION));
  const label = doc.querySelector('.lb') as Element;

  it('tên (giữ nguyên dấu tiếng Việt), mã vạch, mã đọc được bên dưới, giá', () => {
    expect(label.querySelector('.nm')?.textContent).toBe('Áo thun cổ tròn trắng size M');
    expect(label.querySelector('.cd')?.textContent).toBe('8934567890120');
    expect(label.querySelector('.pr')?.textContent).toBe('185.000đ');
    expect(label.querySelector('svg.bc')).not.toBeNull();
    expect(Array.from(label.children).map((child) => child.getAttribute('class'))).toEqual(['nm', 'bc', 'cd', 'pr']);
  });

  it('tên tối đa 2 dòng, dòng cuối tự thêm dấu ba chấm; đáy khối tên được cắt để dấu của dòng bị ẩn không ló ra', () => {
    const html = doc.documentElement.outerHTML;
    expect(html).toMatch(/\.nm span\{[^}]*-webkit-line-clamp:2;overflow:hidden/);
    // 7 pt: chừa 0,25 mm trên dòng đầu, đệm ngang cho dấu "…", cắt 0,09 em = 0,222 mm ở đáy
    expect(html).toMatch(
      /\.nm span\{[^}]*padding:0\.25mm 0\.5em 0;margin:0 -0\.5em;[^}]*clip-path:inset\(0 0 0\.222mm 0\)/
    );
  });

  it('mã vạch là SVG theo điểm in: viewBox bằng số điểm, mỗi vạch một <rect> có x / width nguyên, bội của module', () => {
    const svg = label.querySelector('svg.bc') as Element;
    const rects = Array.from(svg.querySelectorAll('rect'));

    // EAN-13 ở module 2 điểm: 113 module = 226 điểm = 28,25 mm; cao 51 điểm = 6,375 mm
    expect(svg.getAttribute('viewBox')).toBe('0 0 226 51');
    expect(svg.getAttribute('width')).toBe('28.25mm');
    expect(svg.getAttribute('height')).toBe('6.375mm');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(rects).toHaveLength(30);
    rects.forEach((rect) => {
      const x = Number(rect.getAttribute('x'));
      const width = Number(rect.getAttribute('width'));
      expect(Number.isInteger(x) && Number.isInteger(width)).toBe(true);
      expect(x % 2).toBe(0);
      expect(width % 2).toBe(0);
      expect(rect.getAttribute('height')).toBe('51');
    });
    // Vùng trắng: vạch đầu sau 11 module, vạch cuối trước 7 module
    expect(rects[0].getAttribute('x')).toBe('22');
    const last = rects[rects.length - 1];
    expect(Number(last.getAttribute('x')) + Number(last.getAttribute('width'))).toBe(226 - 14);
    // Căn giữa trong tem, đúng lưới điểm in: 1 + 19/8 mm
    expect(styleOf(svg)).toBe('left:3.375mm;top:8.25mm');
  });

  it('module 1 và 3 điểm: bề rộng SVG đổi theo đúng bội số, không co giãn', () => {
    const at = (moduleDots: 1 | 3) => {
      const html = renderLabelSheetHtml(job([{ ...clip, code: '1234', quantity: 1 }]), TWO_UP, {
        ...DEFAULT_CALIBRATION,
        moduleDots,
      });
      return parse(html).querySelector('svg.bc') as Element;
    };

    // "1234" bộ C = 77 module kể cả vùng trắng
    expect(at(1).getAttribute('viewBox')).toMatch(/^0 0 77 /);
    expect(at(1).getAttribute('width')).toBe('9.625mm');
    expect(at(3).getAttribute('viewBox')).toMatch(/^0 0 231 /);
    expect(at(3).getAttribute('width')).toBe('28.875mm');
    Array.from(at(3).querySelectorAll('rect')).forEach((rect) => {
      expect(Number(rect.getAttribute('x')) % 3).toBe(0);
      expect(Number(rect.getAttribute('width')) % 3).toBe(0);
    });
  });

  it('tên có ký tự HTML được thoát, không thành thẻ', () => {
    const html = renderLabelSheetHtml(
      job([{ ...shirt, name: 'Áo <b>"M&M"</b> <script>alert(1)</script>', quantity: 1 }]),
      TWO_UP,
      DEFAULT_CALIBRATION
    );
    const parsed = parse(html);

    expect(parsed.querySelector('.nm')?.textContent).toBe('Áo <b>"M&M"</b> <script>alert(1)</script>');
    expect(parsed.querySelector('script')).toBeNull();
    expect(parsed.querySelector('.nm b')).toBeNull();
  });
});

describe('tuỳ chọn in', () => {
  const firstLabel = (options: Partial<LabelOptions>, storeName?: string | null, item: LabelSource = shirt) =>
    parse(
      renderLabelSheetHtml(job([{ ...item, quantity: 1 }], options, storeName), TWO_UP, DEFAULT_CALIBRATION)
    ).querySelector('.lb') as Element;

  it('tắt tên / giá → không còn dòng đó', () => {
    const bare = firstLabel({ showName: false, showPrice: false });

    expect(bare.querySelector('.nm')).toBeNull();
    expect(bare.querySelector('.pr')).toBeNull();
    expect(bare.querySelector('.cd')?.textContent).toBe('8934567890120');
  });

  it('"Mã hàng" → mã hoá mã hàng thay cho mã vạch', () => {
    expect(firstLabel({ valueSource: 'code' }).querySelector('.cd')?.textContent).toBe('SP000123');
    expect(firstLabel({ valueSource: 'barcode-or-code' }).querySelector('.cd')?.textContent).toBe('8934567890120');
  });

  it('giá: chữ "đ", "VND" hoặc không ghi', () => {
    expect(firstLabel({ priceSuffix: 'đ' }).querySelector('.pr')?.textContent).toBe('185.000đ');
    expect(firstLabel({ priceSuffix: 'VND' }).querySelector('.pr')?.textContent).toBe('185.000 VND');
    expect(firstLabel({ priceSuffix: 'none' }).querySelector('.pr')?.textContent).toBe('185.000');
  });

  it('kèm đơn vị tính khi sản phẩm có đơn vị; hàng không có đơn vị chỉ in giá', () => {
    expect(firstLabel({ showUnit: true }).querySelector('.pr')?.textContent).toBe('185.000đ/cái');
    expect(firstLabel({ showUnit: false }).querySelector('.pr')?.textContent).toBe('185.000đ');
    expect(firstLabel({ showUnit: true }, null, tote).querySelector('.pr')?.textContent).toBe('99.000đ');
  });

  it('tên cửa hàng: in ở dòng trên cùng khi bật và có tên', () => {
    const branded = firstLabel({ showStoreName: true }, 'CiCi Accessories');

    expect(branded.querySelector('.st')?.textContent).toBe('CiCi Accessories');
    expect(Array.from(branded.children).map((child) => child.getAttribute('class'))).toEqual([
      'st',
      'nm',
      'bc',
      'cd',
      'pr',
    ]);
    // Tắt tuỳ chọn → không in, dù có tên
    expect(firstLabel({ showStoreName: false }, 'CiCi Accessories').querySelector('.st')).toBeNull();
  });

  it('bật tên cửa hàng nhưng chưa có tên → không chừa dòng trống, bố cục y như khi tắt', () => {
    const off = firstLabel({ showStoreName: false });

    expect(firstLabel({ showStoreName: true }, null).innerHTML).toBe(off.innerHTML);
    expect(firstLabel({ showStoreName: true }, '   ').innerHTML).toBe(off.innerHTML);
  });

  it('tên cửa hàng có ký tự HTML được thoát', () => {
    const branded = firstLabel({ showStoreName: true }, 'M&M <Shop>');

    expect(branded.querySelector('.st')?.textContent).toBe('M&M <Shop>');
    expect(branded.querySelector('.st')?.children).toHaveLength(0);
  });
});

describe('tem trang sức 75×10 mm', () => {
  const calibration: LabelCalibration = { ...DEFAULT_CALIBRATION, moduleDots: 1 };
  const html = renderLabelSheetHtml(job([{ ...shirt, quantity: 2 }]), JEWELRY, calibration);
  const doc = parse(html);

  it('mỗi tem một trang 75 mm × 10 mm', () => {
    expect(html).toContain('@page{size:75mm 10mm;margin:0}');
    expect(doc.querySelectorAll('.pg')).toHaveLength(2);
    expect(Array.from(doc.querySelectorAll('.lb')).map(styleOf)).toEqual(['left:0mm;top:0mm', 'left:0mm;top:0mm']);
  });

  it('mã vạch + mã ở nửa trái, tên + giá ở nửa phải, tất cả trong 45 mm đầu (đuôi tem để trống)', () => {
    const svg = doc.querySelector('svg.bc') as Element;
    const barcodeRight = mm(/left:([\d.]+mm)/.exec(styleOf(svg))?.[1]) + mm(svg.getAttribute('width'));

    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 113 /);
    expect(barcodeRight).toBeLessThanOrEqual(22);
    expect(cssValue(html, '.cd', 'left') + cssValue(html, '.cd', 'width')).toBe(22);
    expect(cssValue(html, '.nm', 'left')).toBe(23);
    expect(cssValue(html, '.pr', 'left')).toBe(23);
    ['.nm', '.pr', '.cd'].forEach((selector) => {
      expect(cssValue(html, selector, 'left') + cssValue(html, selector, 'width'), selector).toBeLessThanOrEqual(45);
    });
    expect(doc.querySelector('.nm')?.textContent).toBe('Áo thun cổ tròn trắng size M');
    expect(doc.querySelector('.pr')?.textContent).toBe('185.000đ');
  });

  it('vạch 2 điểm không vừa nửa tem → báo mã quá dài, gợi ý 1 điểm', () => {
    const plan = planLabelSheet(job([shirt]), JEWELRY, DEFAULT_CALIBRATION);

    expect(plan.labelCount).toBe(0);
    expect(plan.problems[0].reason).toBe(
      'Mã quá dài cho khổ tem này: cần 28,25 mm, tem chỉ in được 21,5 mm. Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống 1 điểm.'
    );
  });
});

describe('mã không in được', () => {
  it('bị loại khỏi lệnh in kèm lý do; các mã khác vẫn in', () => {
    const items: LabelSource[] = [
      shirt,
      clip,
      { key: 'p4', name: 'Nón lá', code: 'NÓN-01', quantity: 1 },
      { key: 'p5', name: 'Hàng chưa có mã', code: '', quantity: 1 },
    ];
    const plan = planLabelSheet(job(items), TWO_UP, DEFAULT_CALIBRATION);

    expect(plan.labels.map((label) => label.source.key)).toEqual(['p1']);
    expect(plan.labelCount).toBe(3);
    expect(plan.problems).toEqual([
      {
        key: 'p2',
        name: 'Kẹp tóc nơ nhung đỏ',
        value: 'KT-NO-01',
        reason:
          'Mã quá dài cho khổ tem này: cần 35,75 mm, tem chỉ in được 33 mm. Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống 1 điểm.',
      },
      {
        key: 'p4',
        name: 'Nón lá',
        value: 'NÓN-01',
        reason:
          'Mã "NÓN-01" có "Ó" không in được thành mã vạch — Code 128 chỉ nhận chữ không dấu, số và ký hiệu thông thường.',
      },
      { key: 'p5', name: 'Hàng chưa có mã', value: '', reason: 'Chưa có mã vạch hoặc mã hàng để in vạch.' },
    ]);

    const html = renderLabelSheetHtml(job(items), TWO_UP, DEFAULT_CALIBRATION);
    expect(html).not.toContain('Kẹp tóc');
    expect(html).not.toContain('Nón lá');
    expect(parse(html).querySelectorAll('.lb')).toHaveLength(3);
  });

  it('mã dài in được khi giảm module xuống 1 điểm hoặc đổi sang tem rộng hơn', () => {
    const narrow = planLabelSheet(job([clip]), TWO_UP, { ...DEFAULT_CALIBRATION, moduleDots: 1 });
    expect(narrow.problems).toEqual([]);
    expect(narrow.labelCount).toBe(2);

    const wide = planLabelSheet(job([clip]), template('1x50x30'), DEFAULT_CALIBRATION);
    expect(wide.problems).toEqual([]);
    expect(wide.pageCount).toBe(2);
  });

  it('13 số sai số kiểm tra: vẫn in đúng 13 số đó bằng Code 128, kèm lưu ý', () => {
    const plan = planLabelSheet(
      job([{ ...shirt, barcode: '8934567890126', quantity: 1 }]),
      template('1x50x30'),
      DEFAULT_CALIBRATION
    );

    expect(plan.problems).toEqual([]);
    expect(plan.labels[0].barcode.symbology).toBe('CODE128B');
    expect(plan.labels[0].barcode.value).toBe('8934567890126');
    expect(plan.labels[0].note).toBe('Mã 13 số nhưng sai số kiểm tra EAN-13 nên in bằng Code 128.');
  });

  it('tem quá thấp → lỗi bố cục, không có trang nào', () => {
    const plan = planLabelSheet(job([shirt]), { ...TWO_UP, labelHeightMm: 12 }, DEFAULT_CALIBRATION);

    expect(plan.layoutError).toContain('không đủ chỗ cho mã vạch');
    expect(plan.pageCount).toBe(0);
    expect(plan.labelCount).toBe(0);
    expect(plan.requestedCount).toBe(3);
  });
});

describe('giới hạn 5.000 tem mỗi lần in', () => {
  it('đúng 5.000 tem thì in được', () => {
    const plan = planLabelSheet(job([{ ...shirt, quantity: 5000 }]), TWO_UP, DEFAULT_CALIBRATION);

    expect(MAX_LABELS_PER_JOB).toBe(5000);
    expect(plan.limitError).toBeNull();
    expect(plan.labelCount).toBe(5000);
    expect(plan.pageCount).toBe(2500);
  });

  it('quá 5.000 tem → từ chối cả lệnh in với thông báo rõ ràng, không dựng trang nào', () => {
    const items = [{ ...shirt, quantity: 3000 }, { ...tote, quantity: 2001 }];
    const plan = planLabelSheet(job(items), TOMY_145, DEFAULT_CALIBRATION);

    expect(plan.limitError).toBe(
      'Mỗi lần in tối đa 5.000 tem — đang chọn 5.001 tem. Giảm số tem hoặc chia thành nhiều lần in.'
    );
    expect(plan.requestedCount).toBe(5001);
    expect(plan.labelCount).toBe(0);
    expect(plan.pageCount).toBe(0);
    expect(parse(renderLabelSheetHtml(job(items), TOMY_145, DEFAULT_CALIBRATION)).querySelectorAll('.pg')).toHaveLength(0);
  });

  it('mã không in được không tính vào giới hạn', () => {
    const plan = planLabelSheet(
      job([{ ...shirt, quantity: 5000 }, { ...clip, quantity: 4000 }]),
      TWO_UP,
      DEFAULT_CALIBRATION
    );

    expect(plan.problems.map((problem) => problem.key)).toEqual(['p2']);
    expect(plan.limitError).toBeNull();
    expect(plan.labelCount).toBe(5000);
  });
});

describe('căn chỉnh', () => {
  const origins = (calibration: LabelCalibration, target = TWO_UP) =>
    Array.from(
      parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 3 }]), target, calibration)).querySelectorAll('.lb')
    ).map(styleOf);

  it('mặc định: tem ở đúng vị trí của mẫu', () => {
    expect(origins(DEFAULT_CALIBRATION)).toEqual(['left:1mm;top:0mm', 'left:38mm;top:0mm', 'left:1mm;top:0mm']);
  });

  it('lệch trái / lệch trên / khe cột thêm dịch vị trí tem theo bước 0,5 mm', () => {
    const calibration: LabelCalibration = {
      offsetLeftMm: 1.5,
      offsetTopMm: -0.5,
      extraColumnGapMm: 1,
      extraRowGapMm: 0,
      moduleDots: 2,
    };

    expect(origins(calibration)).toEqual([
      'left:2.5mm;top:-0.5mm',
      'left:40.5mm;top:-0.5mm',
      'left:2.5mm;top:-0.5mm',
    ]);
    // Khổ trang không đổi theo căn chỉnh
    expect(renderLabelSheetHtml(job([shirt]), TWO_UP, calibration)).toContain('@page{size:74mm 22mm;margin:0}');
  });

  it('giấy tờ: lệch và khe hàng thêm áp cho cả lưới', () => {
    const calibration: LabelCalibration = {
      offsetLeftMm: -1,
      offsetTopMm: 0.5,
      extraColumnGapMm: 0,
      extraRowGapMm: 0.5,
      moduleDots: 2,
    };
    const cells = Array.from(
      parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 11 }]), TOMY_145, calibration)).querySelectorAll('.lb')
    ).map(styleOf);

    expect(cells[0]).toBe('left:4mm;top:12.5mm');
    expect(cells[5]).toBe('left:4mm;top:34mm');
    expect(cells[10]).toBe('left:4mm;top:55.5mm');
  });

  it('căn chỉnh không đổi nội dung bên trong tem', () => {
    const inner = (calibration: LabelCalibration) =>
      parse(renderLabelSheetHtml(job([{ ...shirt, quantity: 1 }]), TWO_UP, calibration)).querySelector('.lb')
        ?.innerHTML;

    expect(inner({ ...DEFAULT_CALIBRATION, offsetLeftMm: 3, offsetTopMm: 1 })).toBe(inner(DEFAULT_CALIBRATION));
  });
});

describe('tài liệu tự chứa', () => {
  const html = renderLabelSheetHtml(job([shirt, tote], { showStoreName: true }, 'CiCi'), TWO_UP, DEFAULT_CALIBRATION);

  it('là một tài liệu HTML đầy đủ, tiếng Việt, UTF-8, có tiêu đề', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(parse(html).title).toBe('In tem mã (5 tem)');
  });

  it('không tải gì từ ngoài: không script, link, ảnh, @import, url(), địa chỉ mạng', () => {
    const doc = parse(html);

    expect(doc.querySelectorAll('script, link, img, iframe, object, embed, video, audio')).toHaveLength(0);
    expect(doc.querySelectorAll('[src], [href]')).toHaveLength(0);
    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(html).not.toMatch(/@import|url\(|https?:|\/\//i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it('font hệ thống không chân, chữ đen trên nền trắng', () => {
    expect(html).toContain('font-family:Arial,"Segoe UI",Tahoma,sans-serif');
    expect(html).not.toContain('@font-face');
    expect(html).toMatch(/body\{[^}]*color:#000/);
  });

  it('không có tem nào in được → tài liệu rỗng nhưng vẫn hợp lệ', () => {
    const empty = renderLabelSheetHtml(job([{ ...clip, quantity: 1 }]), TWO_UP, DEFAULT_CALIBRATION);

    expect(parse(empty).querySelectorAll('.pg')).toHaveLength(0);
    expect(empty).toContain('@page{size:74mm 22mm;margin:0}');
  });
});

describe('in thử căn chỉnh', () => {
  it('giấy cuộn: một hàng, mỗi ô có khung cách đều mép tem 0,5 mm, số thứ tự và các độ lệch đang đặt', () => {
    const calibration: LabelCalibration = {
      offsetLeftMm: 0.5,
      offsetTopMm: -1,
      extraColumnGapMm: 0,
      extraRowGapMm: 0,
      moduleDots: 2,
    };
    const html = renderCalibrationSheetHtml(TWO_UP, calibration);
    const doc = parse(html);

    expect(html).toContain('@page{size:74mm 22mm;margin:0}');
    expect(doc.querySelectorAll('.pg')).toHaveLength(1);

    const cells = Array.from(doc.querySelectorAll('.lb'));
    expect(cells).toHaveLength(2);
    expect(cells.map(styleOf)).toEqual(['left:1.5mm;top:-1mm', 'left:38.5mm;top:-1mm']);
    cells.forEach((cell) => expect(cell.querySelectorAll('.mk')).toHaveLength(1));
    expect(cells[0].querySelector('.nm')?.textContent).toBe(
      'Tem 1/2 · trái +0,5 · trên -1 · khe 0 · vạch 2 điểm'
    );
    expect(cells[1].querySelector('.nm')?.textContent).toContain('Tem 2/2');
    // Khung lùi vào trong mép tem nên cả 4 cạnh đều nằm trong trang in (không bị mép trang cắt)
    expect(html).toContain('.mk{position:absolute;left:0.5mm;top:0.5mm;right:0.5mm;bottom:0.5mm;border:0.25mm solid #000}');
    expect(doc.querySelector('.pz')).toBeNull();
  });

  it('giấy tờ: cả tờ, đủ 65 ô có viền; ghi khe cột, khe hàng và độ rộng vạch theo mm', () => {
    const html = renderCalibrationSheetHtml(TOMY_145, { ...DEFAULT_CALIBRATION, extraRowGapMm: 0.5 });
    const doc = parse(html);

    expect(html).toContain('@page{size:210mm 297mm;margin:0}');
    expect(doc.querySelectorAll('.pg')).toHaveLength(1);
    expect(doc.querySelectorAll('.lb')).toHaveLength(65);
    expect(doc.querySelectorAll('.lb .mk')).toHaveLength(65);
    expect(doc.querySelector('.nm')?.textContent).toBe(
      'Tem 1/65 · trái 0 · trên 0 · khe cột 0 · khe hàng +0,5 · vạch 0,25 mm'
    );
    expect(styleOf(doc.querySelectorAll('.lb')[64])).toBe('left:167mm;top:270mm');
  });

  it('tem trang sức: thêm vạch nét đứt ở mép vùng in 45 mm', () => {
    const doc = parse(renderCalibrationSheetHtml(JEWELRY, { ...DEFAULT_CALIBRATION, moduleDots: 1 }));

    expect(doc.querySelectorAll('.lb')).toHaveLength(1);
    expect(styleOf(doc.querySelector('.pz') as Element)).toBe('left:45mm');
    expect(doc.querySelector('.cd')?.textContent).toBe('12345678');
    expect(doc.querySelector('.nm')?.textContent).toContain('vạch 1 điểm');
  });

  it('có mã vạch thử ở đúng độ rộng vạch đang chọn; tem hẹp quá thì chỉ in viền và chữ', () => {
    const wide = parse(renderCalibrationSheetHtml(TWO_UP, { ...DEFAULT_CALIBRATION, moduleDots: 3 }));
    // 12345678 (99 module × 3 = 297 điểm) không vừa 264 điểm → dùng 1234 (231 điểm)
    expect(wide.querySelector('.cd')?.textContent).toBe('1234');
    expect(wide.querySelector('svg.bc')?.getAttribute('viewBox')).toMatch(/^0 0 231 /);

    const normal = parse(renderCalibrationSheetHtml(TWO_UP, DEFAULT_CALIBRATION));
    expect(normal.querySelector('.cd')?.textContent).toBe('12345678');

    const narrow = parse(
      renderCalibrationSheetHtml(
        { ...TWO_UP, labelWidthMm: 15, pageWidthMm: 40 },
        { ...DEFAULT_CALIBRATION, moduleDots: 3 }
      )
    );
    expect(narrow.querySelector('svg.bc')).toBeNull();
    expect(narrow.querySelectorAll('.mk')).toHaveLength(2);
    expect(narrow.querySelector('.ct')?.textContent).toContain('Tem 1/2');
  });
});

describe('xuất danh sách tem (CSV)', () => {
  it('UTF-8 có BOM, tiêu đề tiếng Việt, mỗi mã một dòng, bỏ dòng 0 tem', () => {
    const csv = buildLabelListCsv([shirt, { ...clip, quantity: 0 }, tote]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Mã hàng,Mã vạch,Tên hàng,Giá bán,Số tem',
      'SP000123,8934567890120,Áo thun cổ tròn trắng size M,185000,3',
      '2000000000015,,Túi tote vải canvas in hình mèo,99000,2',
      '',
    ]);
  });

  it('ô có dấu phẩy / nháy kép được bọc lại; ô bắt đầu bằng = + - @ không thành công thức', () => {
    const csv = buildLabelListCsv([
      { key: 'a', name: 'Kẹp tóc "nơ", đỏ', code: 'KT,01', price: null, quantity: 1 },
      { key: 'b', name: '=HYPERLINK("x")', code: '+84', price: 1500.6, quantity: 2 },
    ]);

    expect(csv.slice(1).split('\r\n').slice(1, 3)).toEqual([
      '"KT,01",,"Kẹp tóc ""nơ"", đỏ",,1',
      `'+84,,"'=HYPERLINK(""x"")",1501,2`,
    ]);
  });
});
