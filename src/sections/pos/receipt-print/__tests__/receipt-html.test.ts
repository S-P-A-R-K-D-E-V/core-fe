import { describe, expect, it } from 'vitest';

import type { ISalesOrderReceipt } from 'src/types/corecms-api';

import {
  line,
  payment,
  LONG_NAME,
  normalReceipt,
  discountReceipt,
  cancelledReceipt,
  transferQrReceipt,
} from './receipt-fixtures';
import {
  RECEIPT_PAPERS,
  renderReceiptHtml,
  estimateLineCount,
  receiptPageSizeMm,
  formatReceiptMoney,
  estimateTextWidthMm,
  formatReceiptQuantity,
  estimateReceiptHeightMm,
} from '../receipt-html';

// ----------------------------------------------------------------------
// Phiếu thanh toán → tài liệu HTML tự chứa cho máy in nhiệt giấy cuộn: khổ trang = khổ cuộn × chiều cao
// tính từ nội dung, lề 0; các phần của phiếu; tiền Việt; chữ dài tự xuống dòng, không bị cắt.
// ----------------------------------------------------------------------

const NBSP = String.fromCharCode(0xa0);

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').split(NBSP).join(' ');

const texts = (doc: Document, selector: string) =>
  Array.from(doc.querySelectorAll(selector)).map((element) => textOf(element));

/** Các hàng "nhãn — số tiền" của phần tóm tắt, theo thứ tự in. */
const rows = (doc: Document) =>
  Array.from(doc.querySelectorAll('.rw')).map((row) => [
    textOf(row.children[0]),
    textOf(row.children[1]),
  ]);

/** Các dòng hàng: tên, "số lượng × đơn giá", thành tiền, ghi chú giảm giá, ghi chú. */
const items = (doc: Document) =>
  Array.from(doc.querySelectorAll('.it')).map((item) => ({
    name: textOf(item.querySelector('.nm')),
    quantityPrice: textOf(item.querySelector('.qp')),
    total: textOf(item.querySelector('.lt')),
    discount: item.querySelector('.ld') ? textOf(item.querySelector('.ld')) : null,
    note: item.querySelector('.nt') ? textOf(item.querySelector('.nt')) : null,
  }));

function pageRule(html: string) {
  const match = html.match(/@page\{size:([\d.]+)mm ([\d.]+)mm;margin:0\}/);
  if (!match) throw new Error('Không thấy @page');
  return { widthMm: Number(match[1]), heightMm: Number(match[2]) };
}

const css = (html: string) => html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

describe('formatReceiptMoney / formatReceiptQuantity', () => {
  it('tiền Việt: nhóm ba chữ số bằng dấu chấm, chữ "đ" liền sau, không có phần lẻ', () => {
    expect(formatReceiptMoney(0)).toBe('0đ');
    expect(formatReceiptMoney(999)).toBe('999đ');
    expect(formatReceiptMoney(35000)).toBe('35.000đ');
    expect(formatReceiptMoney(1234567)).toBe('1.234.567đ');
    expect(formatReceiptMoney(1234567.5)).toBe('1.234.568đ');
    expect(formatReceiptMoney(-59000)).toBe('-59.000đ');
    expect(formatReceiptMoney(null)).toBe('');
    expect(formatReceiptMoney(Number.NaN)).toBe('');
  });

  it('số lượng: số nguyên giữ nguyên, số lẻ dùng dấu phẩy và tối đa 3 chữ số lẻ', () => {
    expect(formatReceiptQuantity(2)).toBe('2');
    expect(formatReceiptQuantity(1.5)).toBe('1,5');
    expect(formatReceiptQuantity(0.125)).toBe('0,125');
    expect(formatReceiptQuantity(0.33333)).toBe('0,333');
    expect(formatReceiptQuantity(1000)).toBe('1.000');
    expect(formatReceiptQuantity(1250.5)).toBe('1.250,5');
    expect(formatReceiptQuantity(null)).toBe('0');
  });
});

describe('ước lượng bề rộng chữ và số dòng', () => {
  const font = { pt: 10 };
  const bold = { pt: 10, bold: true };
  const emMm = (10 * 25.4) / 72; // 1 em của chữ 10 pt

  it('bề rộng = tổng bề rộng từng ký tự của Arial, cộng 2 % dự phòng', () => {
    // 10 chữ số, mỗi chữ 0,557 em
    expect(estimateTextWidthMm('0123456789', font)).toBeCloseTo(10 * 0.557 * emMm * 1.02, 6);
    expect(estimateTextWidthMm('', font)).toBe(0);
    expect(estimateTextWidthMm('WWW', font)).toBeGreaterThan(estimateTextWidthMm('iii', font) * 4);
    expect(estimateTextWidthMm('Kẹp tóc', bold)).toBeGreaterThan(
      estimateTextWidthMm('Kẹp tóc', font)
    );
  });

  it('chữ có dấu rộng bằng chữ gốc — trừ ơ, ư và chữ i mang dấu; dạng tách dấu (NFD) cho cùng kết quả', () => {
    expect(estimateTextWidthMm('ấ', font)).toBeCloseTo(estimateTextWidthMm('a', font), 6);
    expect(estimateTextWidthMm('Ễ', font)).toBeCloseTo(estimateTextWidthMm('E', font), 6);
    expect(estimateTextWidthMm('đ', font)).toBeCloseTo(estimateTextWidthMm('d', font), 6);
    expect(estimateTextWidthMm('ờ', font)).toBeGreaterThan(estimateTextWidthMm('o', font));
    expect(estimateTextWidthMm('ữ', font)).toBeGreaterThan(estimateTextWidthMm('u', font));
    expect(estimateTextWidthMm('í', font)).toBeGreaterThan(estimateTextWidthMm('i', font));
    expect(estimateTextWidthMm('Nguyễn'.normalize('NFD'), font)).toBeCloseTo(
      estimateTextWidthMm('Nguyễn'.normalize('NFC'), font),
      6
    );
  });

  it('chữ ngoài bảng (chữ Hán, biểu tượng) được tính rộng hơn một em', () => {
    expect(estimateTextWidthMm('漢', font)).toBeGreaterThan(emMm);
    expect(estimateTextWidthMm('€', font)).toBeGreaterThan(emMm);
  });

  it('xuống dòng theo từ: vừa thì một dòng, không vừa thì từ đó xuống dòng dưới', () => {
    const word = estimateTextWidthMm('0000', font);
    const space = estimateTextWidthMm(' ', font);
    expect(estimateLineCount('', 50, font)).toBe(1);
    expect(estimateLineCount('0000 0000 0000', word * 3 + space * 2, font)).toBe(1);
    expect(estimateLineCount('0000 0000 0000', word * 3 + space * 2 - 0.01, font)).toBe(2);
    expect(estimateLineCount('0000 0000 0000', word, font)).toBe(3);
  });

  it('một từ dài hơn cả dòng bị ngắt thành nhiều dòng', () => {
    const digit = estimateTextWidthMm('0', font);
    expect(estimateLineCount('0'.repeat(25), digit * 10, font)).toBe(3);
    // từ dài đứng sau một từ ngắn: xuống dòng rồi mới ngắt
    expect(estimateLineCount(`00 ${'0'.repeat(25)}`, digit * 10, font)).toBe(4);
  });

  it('khoảng trắng không ngắt giữ hai từ trên cùng một dòng', () => {
    // dòng vừa khít "000 0": khoảng trắng thường cho "000 0" | "0 000"
    const width = estimateTextWidthMm('000 0', font) + 0.01;
    expect(estimateLineCount('000 0 0 000', width, font)).toBe(2);
    // "0 0" không tách được: "000" | "0 0" | "000"
    expect(estimateLineCount(`000 0${NBSP}0 000`, width, font)).toBe(3);
    // nhãn "Khách đã trả (Tiền mặt)" xuống dòng trước dấu "(" chứ không tách "(Tiền" khỏi "mặt)"
    const label = estimateTextWidthMm('Khách đã trả (Tiền', font) + 0.01;
    expect(estimateLineCount('Khách đã trả (Tiền mặt)', label, font)).toBe(2);
    expect(estimateLineCount(`Khách đã trả (Tiền${NBSP}mặt)`, label, font)).toBe(2);
  });

  it('dấu câu đứng riêng dính vào từ bên cạnh như trình duyệt (không xuống dòng trước dấu đóng, sau dấu mở)', () => {
    // dòng rộng đúng 5 chữ số; khoảng trắng rộng nửa chữ số
    const width = estimateTextWidthMm('00000', font);
    // "00 00" | "00" — bình thường
    expect(estimateLineCount('00 00 00', width, font)).toBe(2);
    // "!" dính vào "00" đứng trước: "00" | "00 !" | "00" (không phải "00 00" | "! 00")
    expect(estimateLineCount('00 00 ! 00', width, font)).toBe(3);
    // "(" dính vào "00" đứng sau: "00" | "( 00" | "00" (không phải "00 (" | "00 00")
    expect(estimateLineCount('00 ( 00 00', width, font)).toBe(3);
  });

  it('nhiều kiểu chữ trên một đoạn: phần đậm tính theo bề rộng chữ đậm', () => {
    const label = estimateTextWidthMm('Mã:', font);
    const value = estimateTextWidthMm('abcdef', bold);
    const space = estimateTextWidthMm(' ', font);
    const runs = [
      { text: 'Mã:', font },
      { text: 'abcdef', font: bold },
    ];
    expect(estimateLineCount(runs, label + space + value, font)).toBe(1);
    expect(estimateLineCount(runs, label + space + value - 0.01, font)).toBe(2);
    // cùng chữ đó ở kiểu thường thì hẹp hơn nên vẫn vừa
    expect(estimateLineCount('Mã: abcdef', label + space + value - 0.01, font)).toBe(1);
  });
});

describe('renderReceiptHtml — hoá đơn thường', () => {
  const receipt = normalReceipt();
  const html = renderReceiptHtml(receipt);
  const doc = parse(html);

  it('là một tài liệu HTML hoàn chỉnh, tự chứa: không script, không ảnh / font / CSS ngoài', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc.documentElement.getAttribute('lang')).toBe('vi');
    expect(doc.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8');
    expect(doc.title).toBe('Phiếu thanh toán HD-20261006-0001');
    expect(doc.querySelectorAll('script, img, link, iframe, object')).toHaveLength(0);
    expect(html).not.toMatch(/url\(|@import|@font-face|https?:\/\//);
  });

  it('khổ trang mặc định 80 mm × chiều cao tính từ nội dung, lề 0; nội dung nằm trong 72 mm ở giữa', () => {
    const page = pageRule(html);
    expect(page.widthMm).toBe(80);
    expect(page).toEqual(receiptPageSizeMm(receipt));
    expect(Number.isInteger(page.heightMm)).toBe(true);
    expect(css(html)).toContain('.rc{width:72mm;margin:0 auto;');
    // không phần tử nào rộng bằng cả trang: trình duyệt làm tròn khổ trang, tràn ngang là bị thu nhỏ
    expect(css(html)).not.toMatch(/width:80mm/);
    // không dùng chiều cao "auto" — driver giấy cuộn không hiểu
    expect(html).not.toMatch(/@page\{size:[^}]*auto/);
  });

  it('chiều cao trang lớn hơn chiều cao ước lượng của nội dung (dư 3 % + 6 mm) và luôn cao hơn rộng', () => {
    const page = pageRule(html);
    const content = estimateReceiptHeightMm(receipt);
    expect(page.heightMm).toBe(Math.ceil(content * 1.03 + 6));
    expect(page.heightMm).toBeGreaterThan(page.widthMm);
    // Chromium thật dàn phiếu này cao 102,0 mm — ước lượng không được thấp hơn
    expect(content).toBeGreaterThanOrEqual(102);
    expect(content).toBeLessThan(104);
  });

  it('không ngắt trang giữa phiếu / giữa một dòng hàng; chữ xuống dòng theo từ, không bị cắt', () => {
    const style = css(html);
    expect(style).toMatch(/\.rc\{[^}]*break-inside:avoid;page-break-inside:avoid/);
    expect(style).toMatch(/\.it\{[^}]*break-inside:avoid/);
    expect(style).toMatch(/\.rc\{[^}]*overflow-wrap:break-word/);
    expect(style).not.toMatch(/text-overflow|line-clamp|word-break|overflow:hidden|break-all/);
  });

  it('font hệ thống không chân, chữ đen, cỡ chữ đọc được trên máy in 203 dpi', () => {
    const style = css(html);
    expect(style).toContain('font-family:Arial,"Segoe UI",Tahoma,sans-serif');
    expect(style).not.toMatch(/monospace|Courier/i);
    expect(style).toContain('font-size:9.5pt');
    expect(style).toContain('color:#000');
    const sizes = Array.from(style.matchAll(/font-size:([\d.]+)pt/g)).map((match) =>
      Number(match[1])
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(7.5);
  });

  it('đầu phiếu: tên cửa hàng đậm, địa chỉ, điện thoại; không có mã số thuế khi chưa khai', () => {
    expect(texts(doc, '.sn')).toEqual(['CiCi Accessories']);
    expect(css(html)).toMatch(/\.sn\{[^}]*font-weight:700/);
    expect(texts(doc, '.c')).toEqual([
      '12 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
      'ĐT: 0901 234 567',
    ]);
    expect(textOf(doc.body)).not.toContain('MST');
  });

  it('tiêu đề và thông tin hoá đơn: mã, giờ theo múi giờ cửa hàng, thu ngân, khách lẻ', () => {
    expect(texts(doc, '.tl')).toEqual(['PHIẾU THANH TOÁN']);
    const body = textOf(doc.body);
    expect(body).toContain('Mã hoá đơn: HD-20261006-0001');
    expect(body).toContain('Ngày: 06/10/2026 14:30');
    expect(body).toContain('Thu ngân: Nguyễn Thị Lan');
    expect(body).toContain('Khách hàng: Khách lẻ');
    expect(body).not.toContain('Ghi chú');
  });

  it('các dòng hàng: tên, số lượng (kèm đơn vị) × đơn giá, thành tiền', () => {
    expect(items(doc)).toEqual([
      {
        name: 'Áo thun cổ tròn trắng size M',
        quantityPrice: '1 × 185.000đ',
        total: '185.000đ',
        discount: null,
        note: null,
      },
      {
        name: 'Kẹp tóc nơ nhung đỏ',
        quantityPrice: '2 cái × 35.000đ',
        total: '70.000đ',
        discount: null,
        note: null,
      },
    ]);
    // tên dài thì tự chiếm hàng riêng (flex-wrap), số lượng × đơn giá và thành tiền canh phải
    const style = css(html);
    expect(style).toMatch(/\.ln\{[^}]*flex-wrap:wrap/);
    expect(style).toMatch(/\.am\{[^}]*justify-content:flex-end/);
    expect(style).toMatch(/\.lt\{[^}]*white-space:nowrap/);
  });

  it('tóm tắt: tổng tiền hàng, khách cần trả (đậm), đã trả theo phương thức; không có giảm giá / còn phải trả', () => {
    expect(rows(doc)).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
      ['Khách đã trả (Tiền mặt)', '255.000đ'],
    ]);
    expect(doc.querySelector('.rw.tt')?.children[0].textContent).toBe('Khách cần trả');
    expect(css(html)).toMatch(/\.tt\{[^}]*font-weight:700/);
    // "(Tiền mặt)" không bị tách đôi khi nhãn phải xuống dòng
    expect(doc.querySelectorAll('.rw')[2].children[0].textContent).toBe(
      `Khách đã trả (Tiền${NBSP}mặt)`
    );
  });

  it('không có mã QR, không có chữ ĐÃ HUỶ; cuối phiếu có lời chào và giờ in', () => {
    expect(doc.querySelector('svg')).toBeNull();
    expect(doc.querySelector('.cx')).toBeNull();
    expect(textOf(doc.body)).not.toContain('ĐÃ HUỶ');
    expect(texts(doc, '.ft')).toEqual(['Cảm ơn quý khách, hẹn gặp lại!']);
    expect(texts(doc, '.pa')).toEqual(['In lúc 06/10/2026 14:32']);
  });

  it('không có lời chào thì không in dòng trống; lời chào nhiều dòng giữ nguyên chỗ xuống dòng', () => {
    expect(
      parse(renderReceiptHtml(normalReceipt({ footer: null }))).querySelector('.ft')
    ).toBeNull();
    expect(
      parse(renderReceiptHtml(normalReceipt({ footer: '   ' }))).querySelector('.ft')
    ).toBeNull();

    const twoLines = normalReceipt({ footer: 'Cảm ơn quý khách!\nĐổi trả trong 7 ngày.' });
    expect(parse(renderReceiptHtml(twoLines)).querySelector('.ft')?.textContent).toBe(
      'Cảm ơn quý khách!\nĐổi trả trong 7 ngày.'
    );
    expect(css(renderReceiptHtml(twoLines))).toMatch(/\.ft\{[^}]*white-space:pre-line/);
    expect(estimateReceiptHeightMm(twoLines)).toBeGreaterThan(estimateReceiptHeightMm(receipt));
  });

  it('mã số thuế in dưới điện thoại khi cửa hàng đã khai', () => {
    const withTax = normalReceipt();
    withTax.store.taxCode = '0312345678';
    expect(texts(parse(renderReceiptHtml(withTax)), '.c')).toEqual([
      '12 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
      'ĐT: 0901 234 567',
      'MST: 0312345678',
    ]);
  });

  it('hoá đơn có chi nhánh (kéo về từ KiotViet): in tên, địa chỉ, điện thoại của chi nhánh', () => {
    const withBranch = normalReceipt({
      branch: { name: 'Chi nhánh Quận 3', address: '45 Võ Văn Tần, Quận 3', phone: null },
    });
    expect(texts(parse(renderReceiptHtml(withBranch)), '.c')).toEqual([
      'Chi nhánh Quận 3',
      '45 Võ Văn Tần, Quận 3',
      // chi nhánh không có điện thoại → dùng điện thoại cửa hàng
      'ĐT: 0901 234 567',
    ]);
  });

  it('chữ của người dùng được thoát ký tự HTML', () => {
    const nasty = normalReceipt({
      lines: [line(1, '<script>alert(1)</script> & "Áo" \'M\'', 1, 1000)],
      footer: '<b>Cảm ơn</b>',
    });
    const nastyHtml = renderReceiptHtml(nasty);
    const nastyDoc = parse(nastyHtml);
    expect(nastyDoc.querySelectorAll('script')).toHaveLength(0);
    expect(items(nastyDoc)[0].name).toBe('<script>alert(1)</script> & "Áo" \'M\'');
    expect(nastyDoc.querySelector('.ft')?.innerHTML).toBe('&lt;b&gt;Cảm ơn&lt;/b&gt;');
  });
});

describe('renderReceiptHtml — giảm giá và hai lần thanh toán', () => {
  const receipt = discountReceipt();
  const html = renderReceiptHtml(receipt);
  const doc = parse(html);

  it('dòng có giảm giá: thành tiền đã trừ giảm giá, ghi chú "Đã giảm" ngay dưới dòng đó', () => {
    expect(items(doc)).toEqual([
      {
        name: 'Áo thun cổ tròn trắng size M',
        quantityPrice: '2 cái × 185.000đ',
        total: '333.000đ',
        discount: 'Đã giảm 37.000đ',
        note: null,
      },
      {
        name: 'Kẹp tóc nơ nhung đỏ',
        quantityPrice: '3 × 35.000đ',
        total: '105.000đ',
        discount: null,
        note: null,
      },
    ]);
  });

  it('tóm tắt in tổng tiền hàng − TỔNG giảm giá = khách cần trả, rồi từng phương thức đã trả', () => {
    expect(rows(doc)).toEqual([
      ['Tổng tiền hàng', '475.000đ'],
      ['Giảm giá', '-75.000đ'],
      ['Khách cần trả', '400.000đ'],
      ['Khách đã trả', '400.000đ'],
      ['Tiền mặt', '150.000đ'],
      ['Chuyển khoản', '250.000đ'],
    ]);
  });

  it('giảm giá cấp hoá đơn (totals.discount) không được in riêng — đã nằm trong tổng giảm giá', () => {
    expect(textOf(doc.body)).not.toContain('38.000đ');
    expect(rows(doc).filter(([label]) => label.includes('Giảm'))).toHaveLength(1);
  });

  it('khách có tên và số điện thoại', () => {
    expect(textOf(doc.body)).toContain('Khách hàng: Trần Văn Bình - 0912345678');
  });

  it('hoá đơn lưu riêng tiền khách đưa / tiền thối (khoản thu đúng bằng số trả): in khách đưa và tiền thừa', () => {
    const tendered = normalReceipt({ payments: [payment('Cash', 'Tiền mặt', 255000)] });
    tendered.totals = { ...tendered.totals, cashTendered: 300000, changeDue: 45000 };
    expect(rows(parse(renderReceiptHtml(tendered)))).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
      ['Khách đã trả (Tiền mặt)', '255.000đ'],
      ['Tiền khách đưa', '300.000đ'],
      ['Tiền thừa trả khách', '45.000đ'],
    ]);
  });

  it('khách đưa dư tiền mặt: in số khách đưa và tiền thừa trả khách', () => {
    const overTender = normalReceipt({ payments: [payment('Cash', 'Tiền mặt', 300000)] });
    expect(rows(parse(renderReceiptHtml(overTender)))).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
      ['Khách đã trả', '255.000đ'],
      ['Tiền mặt', '300.000đ'],
      ['Tiền thừa trả khách', '45.000đ'],
    ]);
  });

  it('đã trả nhưng không có dòng thanh toán nào: chỉ in "Khách đã trả"', () => {
    const noPayments = normalReceipt({ payments: [] });
    expect(rows(parse(renderReceiptHtml(noPayments)))).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
      ['Khách đã trả', '255.000đ'],
    ]);
  });

  it('chưa trả đồng nào: không in "Khách đã trả", in "Còn phải trả"', () => {
    const unpaid = normalReceipt({ payments: [] });
    unpaid.totals = { ...unpaid.totals, paid: 0, remaining: 255000 };
    expect(rows(parse(renderReceiptHtml(unpaid)))).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
      ['Còn phải trả', '255.000đ'],
    ]);
  });

  it('phương thức lạ in nguyên nhãn của core-be; thiếu nhãn thì in giá trị gốc', () => {
    const odd = normalReceipt({
      payments: [payment('Voucher', 'Voucher', 55000), payment('Point', '', 200000)],
    });
    expect(rows(parse(renderReceiptHtml(odd))).slice(3)).toEqual([
      ['Voucher', '55.000đ'],
      ['Point', '200.000đ'],
    ]);
  });

  it('hoá đơn KiotViet có thu khác (tổng lớn hơn tiền hàng): in dòng "Thu khác"', () => {
    const surcharge = normalReceipt();
    surcharge.totals = { ...surcharge.totals, total: 265000, paid: 265000 };
    surcharge.payments = [payment('Cash', 'Tiền mặt', 265000)];
    expect(rows(parse(renderReceiptHtml(surcharge)))).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Thu khác', '10.000đ'],
      ['Khách cần trả', '265.000đ'],
      ['Khách đã trả (Tiền mặt)', '265.000đ'],
    ]);
  });

  it('số lượng lẻ và ghi chú của dòng (in nghiêng)', () => {
    const fractional = normalReceipt({
      lines: [line(1, 'Vải lụa tơ tằm', 1.5, 240000, { unit: 'm', note: 'Cắt làm hai khúc' })],
    });
    const fractionalHtml = renderReceiptHtml(fractional);
    expect(items(parse(fractionalHtml))).toEqual([
      {
        name: 'Vải lụa tơ tằm',
        quantityPrice: '1,5 m × 240.000đ',
        total: '360.000đ',
        discount: null,
        note: 'Cắt làm hai khúc',
      },
    ]);
    expect(css(fractionalHtml)).toMatch(/\.nt\{[^}]*font-style:italic/);
  });
});

describe('renderReceiptHtml — hoá đơn đã huỷ', () => {
  const receipt = cancelledReceipt();
  const html = renderReceiptHtml(receipt);
  const doc = parse(html);

  it('có khung chữ ĐÃ HUỶ ngay dưới tiêu đề và nhắc lại sau phần tóm tắt', () => {
    expect(texts(doc, '.cx')).toEqual(['ĐÃ HUỶ', 'ĐÃ HUỶ']);
    expect(css(html)).toMatch(/\.cx\{[^}]*border:0\.5mm solid #000/);

    const order = Array.from(doc.querySelectorAll('.rc > *')).map((element) => element.className);
    expect(order.indexOf('cw')).toBe(order.indexOf('tl') + 1);
    expect(order.lastIndexOf('cw')).toBeGreaterThan(order.lastIndexOf('rw tt'));
  });

  it('dựa vào isCancelled chứ không dựa vào chữ trạng thái', () => {
    const active = normalReceipt();
    active.invoice.status = 'Đã hủy';
    expect(parse(renderReceiptHtml(active)).querySelector('.cx')).toBeNull();
  });

  it('không in "Còn phải trả" và không in mã QR dù dữ liệu có', () => {
    expect(rows(doc)).toEqual([
      ['Tổng tiền hàng', '255.000đ'],
      ['Khách cần trả', '255.000đ'],
    ]);

    const withQr = { ...receipt, transferQr: transferQrReceipt().transferQr };
    const withQrDoc = parse(renderReceiptHtml(withQr));
    expect(withQrDoc.querySelector('svg')).toBeNull();
    expect(textOf(withQrDoc.body)).not.toContain('chuyển khoản');
  });

  it('phiếu đã huỷ cao hơn phiếu thường đúng bằng hai khung chữ', () => {
    const active: ISalesOrderReceipt = {
      ...receipt,
      invoice: { ...receipt.invoice, isCancelled: false },
    };
    // phiếu chưa huỷ có thêm hàng "Còn phải trả" (một dòng chữ 9,5 pt)
    const rowMm = (9.5 * 1.3 * 25.4) / 72;
    const bannerMm = (1.5 + 0.5 + 0.8) * 2 + (14 * 1.3 * 25.4) / 72;
    expect(estimateReceiptHeightMm(receipt) - estimateReceiptHeightMm(active)).toBeCloseTo(
      bannerMm * 2 - rowMm,
      6
    );
  });
});

describe('renderReceiptHtml — mã QR chuyển khoản', () => {
  const receipt = transferQrReceipt();
  const html = renderReceiptHtml(receipt);
  const doc = parse(html);

  it('trả một phần: từng phương thức đã trả và số còn phải trả (đậm)', () => {
    expect(rows(doc)).toEqual([
      ['Tổng tiền hàng', '959.000đ'],
      ['Giảm giá', '-59.000đ'],
      ['Khách cần trả', '900.000đ'],
      ['Khách đã trả', '850.000đ'],
      ['Tiền mặt', '500.000đ'],
      ['Chuyển khoản', '350.000đ'],
      ['Còn phải trả', '50.000đ'],
    ]);
    expect(doc.querySelector('.rw.rm')?.children[1].textContent).toBe('50.000đ');
    expect(css(html)).toMatch(/\.rm\{font-weight:700\}/);
  });

  it('vẽ mã QR bằng SVG nằm ngay trong tài liệu, kèm thông tin chuyển khoản bằng chữ', () => {
    const block = doc.querySelector('.qr') as Element;
    expect(block.querySelectorAll('svg.qc')).toHaveLength(1);
    expect(block.querySelector('svg path')?.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    expect(Array.from(block.children).map((child) => textOf(child))).toEqual([
      'Quét mã để chuyển khoản',
      '',
      'Vietcombank',
      'STK: 0123456789',
      'CiCi Accessories',
      'Số tiền: 50.000đ',
      'Nội dung: HD 20261006 0001',
    ]);
    expect(css(html)).toMatch(/\.qr\{[^}]*break-inside:avoid/);
  });

  it('mã QR vừa trong bề rộng in và được tính vào chiều cao trang', () => {
    const svg = doc.querySelector('svg.qc') as Element;
    const sizeMm = Number((svg.getAttribute('width') as string).replace('mm', ''));
    expect(svg.getAttribute('height')).toBe(svg.getAttribute('width'));
    expect(sizeMm).toBeLessThanOrEqual(RECEIPT_PAPERS[80].qrMaxMm);
    expect(sizeMm).toBeGreaterThan(25);

    const withoutQr = { ...receipt, transferQr: null };
    expect(estimateReceiptHeightMm(receipt) - estimateReceiptHeightMm(withoutQr)).toBeGreaterThan(
      sizeMm
    );
  });

  it('ghi chú hoá đơn, dòng tên dài, dòng giảm giá, dòng có ghi chú', () => {
    expect(textOf(doc.body)).toContain('Ghi chú: Khách hẹn chuyển khoản phần còn lại trong ngày');
    expect(items(doc)).toEqual([
      {
        name: LONG_NAME,
        quantityPrice: '1 × 385.000đ',
        total: '385.000đ',
        discount: null,
        note: null,
      },
      {
        name: 'Áo thun cổ tròn trắng size M',
        quantityPrice: '2 cái × 185.000đ',
        total: '333.000đ',
        discount: 'Đã giảm 37.000đ',
        note: null,
      },
      {
        name: 'Kẹp tóc nơ nhung đỏ',
        quantityPrice: '3 × 35.000đ',
        total: '105.000đ',
        discount: null,
        note: 'Gói quà giúp khách',
      },
      {
        name: 'Túi tote vải canvas',
        quantityPrice: '1 × 99.000đ',
        total: '99.000đ',
        discount: null,
        note: null,
      },
    ]);
  });

  it('chuỗi VietQR hỏng / quá dài: không vẽ mã, vẫn in thông tin chuyển khoản bằng chữ', () => {
    const broken = transferQrReceipt();
    (broken.transferQr as NonNullable<ISalesOrderReceipt['transferQr']>).payload = 'x'.repeat(4000);
    const brokenDoc = parse(renderReceiptHtml(broken));
    expect(brokenDoc.querySelector('svg')).toBeNull();
    expect(texts(brokenDoc, '.qr > *')).toEqual([
      'Thông tin chuyển khoản',
      'Vietcombank',
      'STK: 0123456789',
      'CiCi Accessories',
      'Số tiền: 50.000đ',
      'Nội dung: HD 20261006 0001',
    ]);
  });

  it('chiều cao ước lượng khớp với Chromium thật (224,5 mm trên giấy 80 mm) và không thấp hơn', () => {
    const content = estimateReceiptHeightMm(receipt);
    expect(content).toBeGreaterThanOrEqual(224.47);
    expect(content).toBeLessThan(226);
    expect(pageRule(html).heightMm).toBe(Math.ceil(content * 1.03 + 6));
  });
});

describe('renderReceiptHtml — tên hàng dài có dấu tiếng Việt', () => {
  const stacked = 'Ấm ỂN ỖI ẨM ỄNH ỘC ẮNG ỨNG ửng ểnh ỗi ẩm gập ghềnh khúc khuỷu ngoằn ngoèo';
  const receipt = normalReceipt({
    lines: [line(1, LONG_NAME, 1, 385000), line(2, stacked, 2, 15000), line(3, 'Ví', 1, 99000)],
  });
  const html = renderReceiptHtml(receipt);
  const doc = parse(html);

  it('tên in đầy đủ, không bị cắt bớt hay thêm "…"', () => {
    expect(items(doc).map((item) => item.name)).toEqual([LONG_NAME, stacked, 'Ví']);
    expect(html).not.toContain('…');
  });

  it('tên dài chiếm 3 dòng trên giấy 80 mm và trên giấy 58 mm (chữ nhỏ hơn) — đúng như Chromium thật dàn', () => {
    const name80 = { pt: RECEIPT_PAPERS[80].basePt, bold: true };
    const name58 = { pt: RECEIPT_PAPERS[58].basePt, bold: true };
    expect(estimateLineCount(LONG_NAME, 72 - 2 * 2, name80)).toBe(3);
    expect(estimateLineCount(LONG_NAME, 48 - 2 * 1.5, name58)).toBe(3);
    // cùng cỡ chữ mà dòng hẹp hơn thì nhiều dòng hơn
    expect(estimateLineCount(LONG_NAME, 48 - 2 * 1.5, name80)).toBe(4);
  });

  it('mỗi dòng chữ thêm vào làm trang cao thêm đúng một dòng', () => {
    const short = normalReceipt({
      lines: [
        line(1, 'Áo khoác gió nam nữ hai lớp', 1, 385000),
        line(2, stacked, 2, 15000),
        line(3, 'Ví', 1, 99000),
      ],
    });
    const lineMm = (RECEIPT_PAPERS[80].basePt * 1.3 * 25.4) / 72;
    // tên vừa một dòng + hàng số = 2 dòng; tên dài = 3 dòng tên + hàng số = 4 dòng
    expect(estimateReceiptHeightMm(receipt) - estimateReceiptHeightMm(short)).toBeCloseTo(
      lineMm * 2,
      6
    );
  });

  it('tên rất ngắn nằm cùng hàng với số lượng × đơn giá nên chỉ tốn một dòng', () => {
    const lineMm = (RECEIPT_PAPERS[80].basePt * 1.3 * 25.4) / 72;
    const one = normalReceipt({ lines: [line(1, 'Ví', 1, 99000)] });
    const none = normalReceipt({ lines: [] });
    expect(estimateReceiptHeightMm(one) - estimateReceiptHeightMm(none)).toBeCloseTo(
      lineMm + 0.5 * 2,
      6
    );
  });

  it('mã hàng dính liền dài hơn cả dòng vẫn nằm trong phiếu nhờ overflow-wrap (tính thêm dòng)', () => {
    const glued = normalReceipt({ lines: [line(1, `SP${'0123456789'.repeat(8)}`, 1, 1000)] });
    const plain = normalReceipt({ lines: [line(1, 'SP0123456789', 1, 1000)] });
    expect(estimateReceiptHeightMm(glued)).toBeGreaterThan(estimateReceiptHeightMm(plain));
    expect(css(renderReceiptHtml(glued))).toMatch(/\.nm\{[^}]*min-width:0;max-width:100%/);
  });

  it('hoá đơn 60 dòng: một trang duy nhất, chiều cao tăng theo số dòng', () => {
    const many = normalReceipt({
      lines: Array.from({ length: 60 }, (_, index) =>
        line(index + 1, `${LONG_NAME} ${index + 1}`, index + 1, 12000)
      ),
    });
    const page = receiptPageSizeMm(many);
    expect(page.heightMm).toBeGreaterThan(900);
    expect(renderReceiptHtml(many).match(/@page/g)).toHaveLength(1);
    expect(parse(renderReceiptHtml(many)).querySelectorAll('.it')).toHaveLength(60);
  });
});

describe('renderReceiptHtml — giấy 58 mm', () => {
  const receipt = transferQrReceipt();
  const html = renderReceiptHtml(receipt, { paperWidth: 58 });
  const doc = parse(html);

  it('khổ trang 58 mm, nội dung trong 48 mm ở giữa, chữ nhỏ hơn giấy 80 mm nhưng vẫn ≥ 7,5 pt', () => {
    const page = pageRule(html);
    expect(page.widthMm).toBe(58);
    expect(page).toEqual(receiptPageSizeMm(receipt, { paperWidth: 58 }));
    expect(page.heightMm).toBeGreaterThan(page.widthMm);

    const style = css(html);
    expect(style).toContain('.rc{width:48mm;margin:0 auto;');
    expect(style).not.toMatch(/width:58mm/);
    expect(style).toContain('font-size:8.5pt');
    const sizes = Array.from(style.matchAll(/font-size:([\d.]+)pt/g)).map((match) =>
      Number(match[1])
    );
    expect(Math.min(...sizes)).toBe(7.5);
  });

  it('cùng nội dung như giấy 80 mm', () => {
    const wide = parse(renderReceiptHtml(receipt));
    expect(items(doc)).toEqual(items(wide));
    expect(rows(doc)).toEqual(rows(wide));
    expect(texts(doc, '.qr > *')).toEqual(texts(wide, '.qr > *'));
  });

  it('mã QR vẫn vừa bề rộng in 45 mm', () => {
    const svg = doc.querySelector('svg.qc') as Element;
    const sizeMm = Number((svg.getAttribute('width') as string).replace('mm', ''));
    expect(sizeMm).toBeLessThanOrEqual(RECEIPT_PAPERS[58].qrMaxMm);
    expect(sizeMm).toBeLessThanOrEqual(48 - 2 * 1.5);
  });

  it('chiều cao ước lượng không thấp hơn Chromium thật (210,2 mm)', () => {
    const content = estimateReceiptHeightMm(receipt, { paperWidth: 58 });
    expect(content).toBeGreaterThanOrEqual(210.15);
    expect(content).toBeLessThan(216);
  });

  it('trang luôn cao hơn rộng, kể cả phiếu gần như trống (trang "ngang" bị một số driver xoay)', () => {
    const tiny = normalReceipt({ lines: [], payments: [], footer: null });
    tiny.store = { name: 'CiCi', address: null, phone: null, taxCode: null, logoUrl: null };
    tiny.invoice.cashierName = null;
    expect(receiptPageSizeMm(tiny, { paperWidth: 58 }).heightMm).toBeGreaterThanOrEqual(68);
    expect(receiptPageSizeMm(tiny).heightMm).toBeGreaterThanOrEqual(90);
  });

  it('khổ giấy không hợp lệ thì dùng 80 mm', () => {
    const odd = renderReceiptHtml(receipt, { paperWidth: 76 as unknown as 80 });
    expect(pageRule(odd).widthMm).toBe(80);
  });
});
