import { describe, expect, it } from 'vitest';

import { DEFAULT_CALIBRATION } from 'src/sections/pos/label-print/label-template';

import { parseLabelDesign, defaultLabelDesign, serializeLabelDesign } from '../label/label-design';
import {
  fillText,
  parseDiscount,
  planDesignSheet,
  labelFieldValues,
  renderDesignSheetHtml,
} from '../label/label-design-render';

import type { LabelDesign, LabelElement } from '../label/label-design';
import type { DesignLabelSource, DesignPrintContext } from '../label/label-design-render';

// ----------------------------------------------------------------------
// Tem tự thiết kế: giá / giảm giá, phần tử rỗng không in, mã vạch theo điểm in và báo lỗi khi không vừa khung, lưới trang
// dùng chung với in tem hệ thống, bố cục đọc từ JSON hỏng vẫn dùng được.
// ----------------------------------------------------------------------

const source = (extra: Partial<DesignLabelSource> = {}): DesignLabelSource => ({
  key: 'p1',
  name: 'Kẹp tóc nơ nhung đỏ',
  code: 'K35',
  barcode: '8938505974194',
  price: 35000,
  unit: 'cái',
  quantity: 1,
  ...extra,
});

const context: DesignPrintContext = {
  storeName: 'CiCi',
  warehouse: { name: 'Kho Chùa Láng', address: '21 Chùa Láng', phone: null },
  printDate: '29/10/2026',
};

const text = (id: string, value: string, extra: Partial<LabelElement> = {}): LabelElement => ({
  id,
  type: 'text',
  xMm: 1,
  yMm: 1,
  wMm: 30,
  hMm: 4,
  text: value,
  fontPt: 7,
  maxLines: 1,
  ...extra,
});

const design = (elements: LabelElement[]): LabelDesign => ({
  ...defaultLabelDesign('2x35x22-r74'),
  elements,
});

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('labelFieldValues', () => {
  const base = defaultLabelDesign();

  it('computes the discounted price from a percent or an amount', () => {
    const percent = labelFieldValues(source({ discount: { percent: 20 } }), base, context);
    const amount = labelFieldValues(source(), base, { ...context, discount: { amount: 5000 } });

    expect([
      percent.final_price,
      percent.original_price,
      percent.discount_percent,
      percent.discount_amount,
    ]).toEqual(['28.000đ', '35.000đ', '-20%', '-7.000đ']);
    expect([amount.final_price, amount.discount_percent]).toEqual(['30.000đ', '-14%']);
  });

  it('leaves discount fields empty without a discount and follows the price format of the design', () => {
    const values = labelFieldValues(source(), { priceSuffix: 'VND', priceWithUnit: true }, context);

    expect([
      values.price,
      values.final_price,
      values.original_price,
      values.discount_percent,
    ]).toEqual(['35.000 VND/cái', '35.000 VND/cái', '', '']);
    expect(values.warehouse_name).toBe('Kho Chùa Láng');
    expect(values.barcode_value).toBe('8938505974194');
  });

  it.each([
    ['20%', { percent: 20 }],
    ['12,5 %', { percent: 12.5 }],
    ['15.000', { amount: 15000 }],
    ['15k', { amount: 15000 }],
    ['100%', null],
    ['abc', null],
    ['', null],
  ])('parses discount input %s', (input, expected) => {
    expect(parseDiscount(input)).toEqual(expected);
  });

  it('skips elements whose fields are all empty', () => {
    expect(fillText('Giá gốc {{original_price}}', { original_price: '' })).toBeNull();
    expect(fillText('Hotline 1900', {})).toBe('Hotline 1900');
    expect(fillText('{{a}} / {{b}}', { a: 'x', b: '' })).toBe('x / ');
  });
});

describe('planDesignSheet / renderDesignSheetHtml', () => {
  it('escapes names and draws barcodes on whole printer dots', () => {
    const sheet = design([
      text('name', '{{product_name}}'),
      {
        id: 'bc',
        type: 'barcode',
        xMm: 1,
        yMm: 6,
        wMm: 33,
        hMm: 10,
        source: 'barcode-or-code',
        showText: true,
        moduleDots: 0,
      },
    ]);
    const html = renderDesignSheetHtml(
      { items: [source({ name: '<b>Kẹp</b>', quantity: 3 })], context },
      sheet,
      DEFAULT_CALIBRATION
    );
    const doc = parse(html);

    expect(doc.querySelector('.tx b')).toBeNull();
    expect(doc.querySelector('.tx')?.textContent).toBe('<b>Kẹp</b>');
    // 3 tem trên cuộn 2 tem / hàng → 2 trang.
    expect(doc.querySelectorAll('.pg')).toHaveLength(2);
    expect(doc.querySelectorAll('.lb')).toHaveLength(3);
    Array.from(doc.querySelectorAll('svg.bc rect')).forEach((rect) => {
      expect(Number.isInteger(Number(rect.getAttribute('x')))).toBe(true);
      expect(Number.isInteger(Number(rect.getAttribute('width')))).toBe(true);
    });
    expect(doc.querySelector('.bt')?.textContent).toBe('8938505974194');
    expect(html).toContain('@page{size:74mm 22mm;margin:0}');
  });

  it('reports items whose code does not fit the barcode box and still prints the others', () => {
    const sheet = design([
      {
        id: 'bc',
        type: 'barcode',
        xMm: 1,
        yMm: 1,
        wMm: 12,
        hMm: 10,
        source: 'code',
        moduleDots: 0,
      },
    ]);
    const plan = planDesignSheet(
      {
        items: [
          source({ key: 'short', code: 'K35' }),
          source({ key: 'long', code: 'SP-0000000000-ABCDEFGH' }),
        ],
        context,
      },
      sheet
    );

    expect(plan.labels.map((label) => label.source.key)).toEqual(['short']);
    expect(plan.problems.map((problem) => problem.key)).toEqual(['long']);
    expect(plan.problems[0].reason).toMatch(/Mã quá dài cho khung mã vạch/);
  });

  it('rejects a barcode box that is too low for the bars', () => {
    const sheet = design([
      { id: 'bc', type: 'barcode', xMm: 1, yMm: 1, wMm: 30, hMm: 5, showText: true },
    ]);
    const plan = planDesignSheet({ items: [source()], context }, sheet);

    expect(plan.errors.join(' ')).toMatch(/Khung mã vạch cao 5 mm/);
    expect(plan.pageCount).toBe(0);
  });

  it('does not print discount elements when there is no discount', () => {
    const sheet = design([
      text('old', '{{original_price}}', { strike: true }),
      text('price', '{{final_price}}'),
    ]);
    const html = renderDesignSheetHtml({ items: [source()], context }, sheet, DEFAULT_CALIBRATION);
    const discounted = renderDesignSheetHtml(
      { items: [source({ discount: { percent: 10 } })], context },
      sheet,
      DEFAULT_CALIBRATION
    );

    expect(Array.from(parse(html).querySelectorAll('.tx'), (el) => el.textContent)).toEqual([
      '35.000đ',
    ]);
    expect(Array.from(parse(discounted).querySelectorAll('.tx'), (el) => el.textContent)).toEqual([
      '35.000đ',
      '31.500đ',
    ]);
    expect(discounted).toContain('text-decoration:line-through');
  });

  it('draws a QR code from the product code or from custom text with fields', () => {
    const sheet = design([
      {
        id: 'qr',
        type: 'qrcode',
        xMm: 1,
        yMm: 1,
        wMm: 15,
        hMm: 15,
        source: 'custom',
        text: 'https://cici.vn/p/{{product_code}}',
      },
    ]);
    const doc = parse(
      renderDesignSheetHtml({ items: [source()], context }, sheet, DEFAULT_CALIBRATION)
    );

    expect(doc.querySelector('.qw svg.qc')).not.toBeNull();
  });
});

describe('parseLabelDesign', () => {
  it('round-trips and repairs broken JSON', () => {
    const original = defaultLabelDesign('tomy-103');
    expect(parseLabelDesign(serializeLabelDesign(original))).toEqual(original);
    expect(parseLabelDesign('not json').presetId).toBe('2x35x22-r74');

    const repaired = parseLabelDesign({
      presetId: '1x50x30',
      paper: { labelWidthMm: 50, labelHeightMm: 30, pageWidthMm: 50, columns: 1, kind: 'roll' },
      elements: [
        { type: 'text', xMm: 45, yMm: -5, wMm: 20, hMm: 3, text: 'x' },
        { type: 'script' },
        'junk',
      ],
    });
    expect(repaired.elements).toHaveLength(1);
    expect(repaired.elements[0]).toMatchObject({ xMm: 30, yMm: 0, wMm: 20 });
  });
});
