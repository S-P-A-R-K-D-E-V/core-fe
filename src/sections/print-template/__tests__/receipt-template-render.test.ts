import { describe, expect, it } from 'vitest';

import type { ISalesOrderReceipt } from 'src/types/corecms-api';

import { moneyInWords } from '../money-words';
import {
  normalizeReceiptSettings,
  defaultReceiptSettings,
} from '../receipt/receipt-template-settings';
import { sampleReceipt, DEFAULT_RECEIPT_TEMPLATE_HTML } from '../receipt/receipt-template-default';
import {
  renderReceiptTemplate,
  mergeReceiptTemplate,
  sanitizeReceiptTemplateHtml,
} from '../receipt/receipt-template-render';

// ----------------------------------------------------------------------
// Mẫu hoá đơn → tài liệu in: lọc HTML theo danh sách trắng, lặp dòng hàng / khoản thu, ẩn khối rỗng, thoát chữ của
// người dùng, khổ trang giấy cuộn theo chiều cao đo được.
// ----------------------------------------------------------------------

const settings80 = defaultReceiptSettings('80');

const body = (html: string, receipt: ISalesOrderReceipt = sampleReceipt()) => {
  const merged = mergeReceiptTemplate(html, receipt, settings80);
  return new DOMParser().parseFromString(`<body>${merged}</body>`, 'text/html').body;
};

const textOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Chữ của từng phần tử; hàng bảng thì nối chữ các ô bằng một dấu cách. */
const texts = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map((el) =>
    el.tagName === 'TR' ? Array.from(el.children).map(textOf).join(' ') : textOf(el)
  );

describe('mergeReceiptTemplate', () => {
  it('fills scalar fields and hides blocks whose fields are all empty', () => {
    const receipt = sampleReceipt('CiCi');
    receipt.store.taxCode = null;
    const root = body(
      '<p>{{store_name}}</p><p>MST: {{store_tax_code}}</p><p>Cảm ơn</p><p>{{discount_total}}</p>',
      receipt
    );

    expect(texts(root, 'p')).toEqual(['CiCi', 'Cảm ơn', '-20.000đ']);
  });

  it('repeats consecutive item rows for every line and hides empty rows inside each copy', () => {
    const root = body(
      '<table><tbody><tr><th>Hàng</th><th>Tiền</th></tr>' +
        '<tr><td>{{item_no}}. {{item_name}}</td><td>{{item_total}}</td></tr>' +
        '<tr><td colspan="2">Đã giảm {{item_discount}}</td></tr>' +
        '</tbody></table><p>{{item_name}}</p>'
    );

    expect(texts(root, 'tr')).toEqual([
      'Hàng Tiền',
      '1. Kẹp tóc nơ nhung đỏ 70.000đ',
      '2. Bông tai bạc đính đá 100.000đ',
      'Đã giảm 20.000đ',
      '3. Túi giấy quà tặng 5.000đ',
    ]);
    // Đoạn rời chỉ có trường dòng hàng → cũng được lặp.
    expect(texts(root, 'p')).toEqual([
      'Kẹp tóc nơ nhung đỏ',
      'Bông tai bạc đính đá',
      'Túi giấy quà tặng',
    ]);
  });

  it('repeats payment rows and removes a table that ends up empty', () => {
    const receipt = sampleReceipt();
    receipt.payments.push({
      method: 'Transfer',
      methodLabel: 'Chuyển khoản',
      amount: 10000,
      reference: 'FT123',
      paidAtLocal: null,
    });
    const root = body(
      '<table><tbody><tr><td>{{payment_method}}</td><td>{{payment_amount}}</td></tr></tbody></table>' +
        '<table><tbody><tr><td>{{change_due}}</td></tr></tbody></table><p>{{payment_summary}}</p>',
      receipt
    );

    expect(texts(root, 'tr')).toEqual(['Tiền mặt 125.000đ', 'Chuyển khoản 10.000đ']);
    expect(root.querySelectorAll('table')).toHaveLength(1);
    expect(texts(root, 'p')).toEqual(['Tiền mặt, Chuyển khoản']);
  });

  it('escapes user text instead of rendering it as HTML', () => {
    const receipt = sampleReceipt();
    receipt.invoice.customerName = '<img src=x onerror="alert(1)">{{total}}';
    const root = body('<p>{{customer_name}}</p>', receipt);

    expect(root.querySelector('img')).toBeNull();
    expect(texts(root, 'p')).toEqual(['<img src=x onerror="alert(1)">{{total}}']);
  });

  it('drops scripts, event handlers and styles other than alignment and font size', () => {
    const html = sanitizeReceiptTemplateHtml(
      '<p style="text-align: center; color: red" onclick="x()">A<script>alert(1)</script></p>' +
        '<img src=x onerror="y()"><a href="javascript:z()">link</a><span style="font-size: 14pt; position: fixed">B</span>' +
        '<iframe src="//evil"></iframe><td colspan="99">c</td>'
    );

    expect(html).toContain('<p style="text-align:center">A</p>');
    expect(html).toContain('<span style="font-size:14pt">B</span>');
    expect(html).toContain('link');
    expect(html).not.toMatch(/script|onclick|onerror|img|iframe|href|color|position/);
  });

  it('draws the transfer QR only when there is something left to pay', () => {
    const template = '<p>Quét mã<br>{{transfer_qr}}</p>';
    const unpaid = body(template);
    const paid = sampleReceipt();
    paid.transferQr = null;

    expect(unpaid.querySelector('svg.qc')).not.toBeNull();
    expect(body(template, paid).querySelector('p')).toBeNull();
  });

  it('shows the cancelled banner and hides payment QR on a cancelled invoice', () => {
    const receipt = sampleReceipt();
    receipt.invoice.isCancelled = true;
    const root = body(
      '<p>{{cancelled_banner}}</p><p>{{transfer_qr}}</p><p>{{remaining}}</p>',
      receipt
    );

    expect(texts(root, '.cx')).toEqual(['ĐÃ HUỶ']);
    expect(root.querySelector('svg.qc')).toBeNull();
    expect(root.querySelectorAll('p')).toHaveLength(1);
  });

  it('draws the invoice barcode with whole printer dots', () => {
    const root = body('<p>{{invoice_barcode}}</p>');
    const svg = root.querySelector('svg.bc');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('HD-20261029-0001');
    Array.from(svg?.querySelectorAll('rect') ?? []).forEach((rect) => {
      expect(Number.isInteger(Number(rect.getAttribute('x')))).toBe(true);
    });
  });

  it('renders the default template close to the system receipt', () => {
    const root = body(DEFAULT_RECEIPT_TEMPLATE_HTML);
    const all = texts(root, 'p, h2, h3, tr');

    expect(all).toContain('PHIẾU THANH TOÁN');
    expect(all).toContain('Khách cần trả 175.000đ');
    expect(all).toContain('Còn phải trả 50.000đ');
    expect(all).toContain('Đã giảm 20.000đ');
    expect(all.some((text) => text.startsWith('Thu khác'))).toBe(false);
    expect(all.some((text) => text.includes('{{'))).toBe(false);
    // Mẫu chuẩn có logo; phiếu mẫu chưa có logo → không còn ảnh, không còn dòng trống ở đầu.
    expect(root.querySelector('img')).toBeNull();
    expect(root.firstElementChild?.tagName).toBe('H2');
  });
});

describe('renderReceiptTemplate', () => {
  it('sizes roll paper from the measured content height', async () => {
    const { html, page } = await renderReceiptTemplate(
      { content: '<p>{{store_name}}</p>', settings: JSON.stringify({ paper: '58' }) },
      sampleReceipt(),
      { measure: async () => 120.4 }
    );

    expect(page).toEqual({ widthMm: 58, heightMm: 125 });
    expect(html).toContain('@page{size:58mm 125mm;margin:0}');
  });

  it('never makes a roll page shorter than it is wide, and estimates when it cannot measure', async () => {
    const short = await renderReceiptTemplate(
      { content: '<p>x</p>', settings: '{}' },
      sampleReceipt(),
      {
        measure: async () => 12,
      }
    );
    const unmeasured = await renderReceiptTemplate(
      { content: DEFAULT_RECEIPT_TEMPLATE_HTML, settings: '{}' },
      sampleReceipt(),
      { measure: async () => null }
    );

    expect(short.page.heightMm).toBe(90);
    expect(unmeasured.page.heightMm).toBeGreaterThan(90);
  });

  it('uses a fixed page with @page margins for A4', async () => {
    const { html, page } = await renderReceiptTemplate(
      { content: '<p>x</p>', settings: JSON.stringify({ paper: 'A4', marginLeftMm: 20 }) },
      sampleReceipt(),
      { measure: async () => 999 }
    );

    expect(page).toEqual({ widthMm: 210, heightMm: 297 });
    expect(html).toContain('@page{size:210mm 297mm;margin:15mm 15mm 15mm 20mm}');
  });
});

describe('normalizeReceiptSettings', () => {
  it('falls back to the paper defaults and clamps numbers', () => {
    expect(normalizeReceiptSettings('not json')).toEqual(defaultReceiptSettings('80'));
    expect(
      normalizeReceiptSettings({
        paper: 'A5',
        marginTopMm: -3,
        fontSizePt: 99,
        tableBorder: 'weird',
        ruleStyle: 'dotted',
      })
    ).toMatchObject({
      paper: 'A5',
      marginTopMm: 0,
      fontSizePt: 16,
      tableBorder: 'none',
      ruleStyle: 'dotted',
      marginLeftMm: 10,
    });
  });
});

describe('moneyInWords', () => {
  it.each([
    [0, 'Không đồng'],
    [15000, 'Mười lăm nghìn đồng'],
    [21000, 'Hai mươi mốt nghìn đồng'],
    [125000, 'Một trăm hai mươi lăm nghìn đồng'],
    [1005000, 'Một triệu không trăm linh năm nghìn đồng'],
    [2500000000, 'Hai tỷ năm trăm triệu đồng'],
    [1234, 'Một nghìn hai trăm ba mươi tư đồng'],
    [-50000, 'Âm năm mươi nghìn đồng'],
  ])('%d → %s', (amount, words) => {
    expect(moneyInWords(amount)).toBe(words);
  });
});
