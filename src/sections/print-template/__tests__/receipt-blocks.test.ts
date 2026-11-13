import { describe, expect, it } from 'vitest';

import type { ISalesOrderReceipt } from 'src/types/corecms-api';

import { sampleReceipt } from '../receipt/receipt-template-default';
import { defaultReceiptSettings } from '../receipt/receipt-template-settings';
import { compileReceiptBlocks } from '../receipt/blocks/receipt-blocks-compile';
import {
  mergeReceiptTemplate,
  sanitizeReceiptTemplateHtml,
} from '../receipt/receipt-template-render';
import {
  createBlock,
  starterBlocks,
  readReceiptBlocks,
  RECEIPT_BLOCK_STARTERS,
} from '../receipt/blocks/receipt-blocks';

import type { ReceiptBlock } from '../receipt/blocks/receipt-blocks';
import type { ReceiptTemplatePaper } from '../receipt/receipt-template-settings';

// ----------------------------------------------------------------------
// Soạn theo khối: khối → HTML {{ma}} của mẫu soạn tự do → bộ in hiện có. Kiểm: HTML qua được bộ lọc (không mất gì), dữ liệu
// được trộn đúng (lặp món / khoản thu, ẩn khi rỗng, "luôn in"), đọc lại JSON hỏng không vỡ.
// ----------------------------------------------------------------------

const merged = (blocks: ReceiptBlock[], paper: ReceiptTemplatePaper = '80', receipt?: ISalesOrderReceipt) => {
  const settings = defaultReceiptSettings(paper);
  const html = compileReceiptBlocks(blocks, settings);
  const out = mergeReceiptTemplate(html, receipt ?? sampleReceipt('CiCi'), settings);
  return new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html').body;
};

/** Bộ lọc viết lại style không khoảng trắng ("text-align:center;font-size:9pt") — so sau khi chuẩn hoá. */
const compactStyles = (html: string) =>
  html.replace(/style="([^"]*)"/g, (_m, style: string) => `style="${style.replace(/\s*([:;])\s*/g, '$1')}"`);

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('compileReceiptBlocks', () => {
  it.each(RECEIPT_BLOCK_STARTERS.map((s) => [s.key]))(
    'starter %s compiles to HTML the print sanitizer keeps unchanged',
    (key) => {
      const { paper, items } = starterBlocks(key);
      const html = compileReceiptBlocks(items, defaultReceiptSettings(paper));
      expect(html.length).toBeGreaterThan(100);
      expect(sanitizeReceiptTemplateHtml(html)).toBe(compactStyles(html));
    }
  );

  it('repeats item rows for every line and payments for every payment', () => {
    const receipt = sampleReceipt('CiCi');
    receipt.payments.push({ method: 'Transfer', methodLabel: 'Chuyển khoản', amount: 1000, reference: null, paidAtLocal: null });
    const body = merged([createBlock('items'), createBlock('payments')], '80', receipt);
    const all = text(body);
    expect(all).toContain('Kẹp tóc nơ nhung đỏ');
    expect(all).toContain('Bông tai bạc đính đá');
    expect(all).toContain('Túi giấy quà tặng');
    expect(all).toContain('Tiền mặt');
    expect(all).toContain('Chuyển khoản');
    expect(all).not.toContain('{{');
  });

  it('auto layout is two lines on roll paper and a table with headers on A4', () => {
    const roll = merged([createBlock('items')], '80');
    expect(roll.querySelector('th')).toBeNull();
    const a4 = merged([createBlock('items', { cols: { no: true, code: true, unit: true, discount: true, note: true } })], 'A4');
    const headers = Array.from(a4.querySelectorAll('th')).map(text);
    expect(headers).toEqual(['STT', 'Mã', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Giảm', 'T.Tiền']);
    // Header + 3 món (mỗi món 2 hàng: số liệu + ghi chú — ghi chú trống thì ẩn).
    expect(a4.querySelectorAll('tr').length).toBe(1 + 3 + 1);
  });

  it('hides empty rows unless the block is set to always print', () => {
    const receipt = sampleReceipt('CiCi');
    receipt.invoice.note = null;
    const info = createBlock('invoiceInfo');
    expect(text(merged([info], '80', receipt))).not.toContain('Ghi chú');
    const kept = merged([{ ...info, hideEmpty: false }], '80', receipt);
    expect(text(kept)).toContain('Ghi chú:');
    expect(kept.querySelector('p.keep')).not.toBeNull();
  });

  it('turns header lines off, escapes free text and drops hidden blocks', () => {
    const body = merged([
      createBlock('storeHeader', { lines: { name: true, branch: false, address: false, phone: false, taxCode: false } }),
      createBlock('text', { text: '<script>x</script> Cảm ơn {{customer_name}}\nDòng 2' }),
      createBlock('footer', { hidden: true }),
    ]);
    expect(text(body)).toContain('CiCi');
    expect(text(body)).not.toContain('ĐT:');
    expect(body.querySelector('script')).toBeNull();
    expect(text(body)).toContain('<script>x</script> Cảm ơn Trần Minh Anh');
    expect(body.querySelector('br')).not.toBeNull();
    expect(text(body)).not.toContain('Cảm ơn quý khách');
  });

  it('QR caption disappears together with the QR when nothing is left to pay', () => {
    const paid = sampleReceipt('CiCi');
    paid.transferQr = null;
    const body = merged([createBlock('transferQr')], '80', paid);
    expect(text(body)).not.toContain('Quét mã');
    expect(text(merged([createBlock('transferQr')]))).toContain('Quét mã để chuyển khoản');
  });

  it('dividers keep their own style class and images must be store media', () => {
    const settings = defaultReceiptSettings('80');
    expect(compileReceiptBlocks([createBlock('divider', { style: 'dotted' })], settings)).toBe('<hr class="hr-dotted">');
    expect(compileReceiptBlocks([createBlock('image', { src: 'https://evil.example/x.png' })], settings)).toBe('');
    expect(compileReceiptBlocks([createBlock('image', { src: '/media/print-templates/a.png' })], settings)).toContain(
      'src="/media/print-templates/a.png"'
    );
  });

  it('font size of a block is relative to the template base size', () => {
    const settings = defaultReceiptSettings('80'); // 9.5 pt
    const html = compileReceiptBlocks([createBlock('text', { text: 'A', size: 2, align: 'right' })], settings);
    expect(html).toBe('<p style="text-align: right; font-size: 11.5pt">A</p>');
  });
});

describe('readReceiptBlocks', () => {
  it('returns null for templates written in free mode', () => {
    expect(readReceiptBlocks('{"paper":"80"}')).toBeNull();
    expect(readReceiptBlocks('not json')).toBeNull();
    expect(readReceiptBlocks(null)).toBeNull();
  });

  it('keeps known blocks, clamps values, drops unknown types and fixes duplicate ids', () => {
    const read = readReceiptBlocks(
      JSON.stringify({
        paper: '80',
        blocks: {
          v: 1,
          items: [
            { id: 'a', type: 'logo', widthPct: 500, align: 'weird' },
            { id: 'a', type: 'spacer', lines: 99 },
            { id: 'c', type: 'script' },
            'garbage',
            { type: 'items', layout: 'nope', cols: { no: true } },
          ],
        },
      })
    );
    expect(read?.items.map((b) => b.type)).toEqual(['logo', 'spacer', 'items']);
    const [logo, spacer, items] = read!.items;
    expect(logo.type === 'logo' && logo.widthPct).toBe(100);
    expect(logo.align).toBe('center');
    expect(spacer.id).not.toBe('a');
    expect(spacer.type === 'spacer' && spacer.lines).toBe(4);
    expect(items.type === 'items' && items.layout).toBe('auto');
    expect(items.type === 'items' && items.cols.no).toBe(true);
  });

  it('round-trips a starter through JSON', () => {
    const { items } = starterBlocks('a5');
    const read = readReceiptBlocks(JSON.stringify({ blocks: { v: 1, items } }));
    expect(read?.items).toEqual(items);
  });
});
