import { describe, expect, it } from 'vitest';

import type { IPurchaseOrderPrint } from 'src/types/purchase-print';

import { defaultReceiptSettings } from '../receipt/receipt-template-settings';
import { compileReceiptBlocks } from '../receipt/blocks/receipt-blocks-compile';
import {
  mergeReceiptTemplate,
  sanitizeReceiptTemplateHtml,
} from '../receipt/receipt-template-render';
import { purchaseDocument, samplePurchasePrint } from '../purchase/purchase-template-fields';
import {
  createBlock,
  starterBlocks,
  readReceiptBlocks,
  BLOCK_TYPE_ORDERS,
  PURCHASE_BLOCK_STARTERS,
} from '../receipt/blocks/receipt-blocks';

import type { ReceiptBlock } from '../receipt/blocks/receipt-blocks';
import type { ReceiptTemplatePaper } from '../receipt/receipt-template-settings';

// ----------------------------------------------------------------------
// Mẫu phiếu nhập: khối riêng (thông tin phiếu, tổng tiền, chữ ký) + khối dùng chung dịch ra HTML {{ma}} → trộn với phiếu nhập
// (GET /purchase-orders/{id}/print) bằng đúng bộ in của hoá đơn.
// ----------------------------------------------------------------------

const merged = (blocks: ReceiptBlock[], paper: ReceiptTemplatePaper = 'A4', print?: IPurchaseOrderPrint) => {
  const settings = defaultReceiptSettings(paper);
  const html = compileReceiptBlocks(blocks, settings);
  const out = mergeReceiptTemplate(html, purchaseDocument(print ?? samplePurchasePrint('CiCi')), settings);
  return new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html').body;
};

const compactStyles = (html: string) =>
  html.replace(/style="([^"]*)"/g, (_m, style: string) => `style="${style.replace(/\s*([:;])\s*/g, '$1')}"`);

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('purchaseDocument', () => {
  it('đổi phiếu nhập ra trường: NCC, mã phiếu (cả invoice_code cho mã vạch), tổng tiền, còn nợ', () => {
    const doc = purchaseDocument(samplePurchasePrint('CiCi'));

    expect(doc.title).toBe('Phiếu nhập PN000123');
    expect(doc.code).toBe('PN000123');
    expect(doc.scalars).toMatchObject({
      store_name: 'CiCi',
      invoice_title: 'PHIẾU NHẬP HÀNG',
      invoice_code: 'PN000123',
      purchase_code: 'PN000123',
      supplier_name: 'Xưởng phụ kiện Minh Anh',
      purchase_status: 'Đã nhập hàng',
      item_count: '3',
    });
    expect(doc.scalars.supplier_debt).not.toBe('');
    expect(doc.scalars.vat_total).toBe('');
    expect(doc.items).toHaveLength(3);
    expect(doc.items[1].item_discount).not.toBe('');
    expect(doc.items[0].item_discount).toBe('');
    expect(doc.payments).toEqual([]);
  });

  it('phiếu huỷ: có dấu huỷ, không ghi còn nợ', () => {
    const print = samplePurchasePrint();
    print.purchase.isCancelled = true;

    const doc = purchaseDocument(print);

    expect(doc.cancelled).toBe(true);
    expect(doc.scalars.supplier_debt).toBe('');
  });
});

describe('khối phiếu nhập', () => {
  it('mọi mẫu khởi đầu qua được bộ lọc HTML nguyên vẹn', () => {
    PURCHASE_BLOCK_STARTERS.forEach((starter) => {
      const { paper, items } = starterBlocks(starter.key, 'purchase');
      const html = compileReceiptBlocks(items, defaultReceiptSettings(paper));
      expect(compactStyles(sanitizeReceiptTemplateHtml(html))).toBe(compactStyles(html));
    });
  });

  it('mẫu A4: đầu cửa hàng, NCC, bảng hàng lặp theo dòng, tổng tiền, chữ ký hai cột', () => {
    const { items } = starterBlocks('purchaseA4', 'purchase');
    const body = merged(items);
    const all = text(body);

    expect(all).toContain('CiCi');
    expect(all).toContain('PHIẾU NHẬP HÀNG');
    expect(all).toContain('Nhà cung cấp: Xưởng phụ kiện Minh Anh');
    expect(all).toContain('Mã phiếu: PN000123');
    expect(all).toContain('Kẹp tóc nơ nhung đỏ');
    expect(all).toContain('Túi giấy in logo');
    expect(all).toContain('Cần trả NCC');
    expect(all).toContain('Còn nợ NCC');
    expect(all).toContain('Người giao hàng');
    expect(all).toContain('Người nhận hàng');
    expect(all).toContain('(Ký, ghi rõ họ tên)');
    // Thuế VAT = 0 → dòng tự ẩn.
    expect(all).not.toContain('Thuế VAT');
  });

  it('khối chữ ký luôn in; bỏ trống một cột thì chỉ còn một chữ ký', () => {
    const body = merged([createBlock('signatures', { right: '  ', showNote: false, lines: 2 })]);

    const cells = body.querySelectorAll('td');
    expect(cells).toHaveLength(1);
    expect(text(cells[0])).toBe('Người giao hàng');
    expect(text(body)).not.toContain('Ký, ghi rõ');
  });

  it('đọc lại khối phiếu nhập từ JSON, giá trị lạ bị chuẩn hoá', () => {
    const read = readReceiptBlocks({
      blocks: {
        v: 1,
        items: [
          { id: 'x', type: 'signatures', left: 'A'.repeat(200), right: 'Thủ kho', lines: 99 },
          { id: 'y', type: 'purchaseTotals', rows: { vat: false, bogus: true } },
          { id: 'z', type: 'purchaseInfo', rows: 'hỏng' },
        ],
      },
    });

    const [sig, totals, info] = read!.items as any[];
    expect(sig.left).toHaveLength(60);
    expect(sig.right).toBe('Thủ kho');
    expect(sig.lines).toBe(8);
    expect(totals.rows.vat).toBe(false);
    expect(totals.rows.total).toBe(true);
    expect(totals.rows.bogus).toBeUndefined();
    expect(info.rows.supplier).toBe(true);
  });

  it('cột khối của phiếu nhập không có khối riêng của hoá đơn và ngược lại', () => {
    expect(BLOCK_TYPE_ORDERS.purchase).toContain('purchaseInfo');
    expect(BLOCK_TYPE_ORDERS.purchase).not.toContain('transferQr');
    expect(BLOCK_TYPE_ORDERS.purchase).not.toContain('invoiceInfo');
    expect(BLOCK_TYPE_ORDERS.receipt).not.toContain('signatures');
  });
});
