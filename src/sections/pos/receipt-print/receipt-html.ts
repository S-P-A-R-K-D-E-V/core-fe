import { escapeHtml } from 'src/utils/print-html';

import type { ISalesOrderReceipt, ISalesOrderReceiptLine } from 'src/types/corecms-api';

import { buildReceiptQr } from './receipt-qr';

// ----------------------------------------------------------------------
// Phiếu thanh toán (dữ liệu của GET /sales-orders/{id}/receipt) → MỘT tài liệu HTML tự chứa cho máy in
// hoá đơn nhiệt giấy cuộn, đưa thẳng vào printHtmlDocument().
//
//  - Khổ trang = khổ cuộn (80 hoặc 58 mm) × một chiều cao TÍNH TỪ NỘI DUNG, lề 0. Không dùng
//    `size: 80mm auto` vì driver giấy cuộn không hiểu chiều cao "auto". Chiều cao được ước lượng DƯ
//    (xem estimateLineCount): thà thừa một đoạn giấy trắng còn hơn phiếu bị ngắt sang trang thứ hai.
//  - Nội dung nằm trong vùng máy in được (72 / 48 mm), canh giữa khổ giấy.
//  - Mỗi khối của phiếu được dựng cùng lúc với chiều cao của nó (Block) để CSS và phép ước lượng không
//    lệch nhau: khoảng cách dọc chỉ dùng padding (margin kề nhau sẽ gộp lại, khó tính).
//  - Chữ dùng font hệ thống không chân, tự xuống dòng theo từ — không cắt bớt, không "…".
//  - Không script, không ảnh / font ngoài; mã QR chuyển khoản là SVG vẽ từ chuỗi VietQR của core-be.
//  - Tiền: "1.234.567đ". Phần tóm tắt in subTotal / discountTotal / total của core-be; giảm giá của
//    từng dòng chỉ ghi chú ngay dưới dòng đó ("Đã giảm …") vì đã nằm trong discountTotal.
// ----------------------------------------------------------------------

export type ReceiptPaperWidth = 80 | 58;

export type ReceiptPaper = {
  /** Khổ cuộn giấy = bề rộng trang in. */
  widthMm: ReceiptPaperWidth;
  /** Vùng máy in được, nằm giữa khổ giấy. */
  printableMm: number;
  /** Lề trong ở mỗi bên của vùng in. */
  paddingMm: number;
  /** Cỡ chữ (pt): thường, nhỏ (ghi chú), tên cửa hàng, tiêu đề phiếu, dòng "Khách cần trả". */
  basePt: number;
  smallPt: number;
  storePt: number;
  titlePt: number;
  totalPt: number;
  /** Bề rộng tối thiểu của cột "thành tiền" ở các dòng hàng. */
  amountMinMm: number;
  /** Cạnh tối đa của mã QR chuyển khoản. */
  qrMaxMm: number;
};

// Máy in nhiệt 203 dpi: 1 pt ≈ 2,8 điểm in — chữ 7,5 pt trở lên còn đọc rõ.
export const RECEIPT_PAPERS: Record<ReceiptPaperWidth, ReceiptPaper> = {
  80: {
    widthMm: 80,
    printableMm: 72,
    paddingMm: 2,
    basePt: 9.5,
    smallPt: 8.5,
    storePt: 13,
    titlePt: 12,
    totalPt: 12,
    amountMinMm: 19,
    qrMaxMm: 38,
  },
  58: {
    widthMm: 58,
    printableMm: 48,
    paddingMm: 1.5,
    basePt: 8.5,
    smallPt: 7.5,
    storePt: 11.5,
    titlePt: 11,
    totalPt: 11,
    amountMinMm: 16,
    qrMaxMm: 36,
  },
};

export const RECEIPT_PAPER_WIDTHS: ReceiptPaperWidth[] = [80, 58];

export const DEFAULT_RECEIPT_PAPER_WIDTH: ReceiptPaperWidth = 80;

export const RECEIPT_TITLE = 'PHIẾU THANH TOÁN';

export const RECEIPT_CANCELLED_TEXT = 'ĐÃ HUỶ';

// ── Định dạng ─────────────────────────────────────────────────────────────

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Tiền Việt không có phần lẻ: "1.234.567đ". Không phải số → chuỗi rỗng. */
export function formatReceiptMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  const rounded = Math.round(amount);
  return `${rounded < 0 ? '-' : ''}${groupThousands(String(Math.abs(rounded)))}đ`;
}

/** Số lượng: tối đa 3 chữ số lẻ, dấu phẩy thập phân — "2", "1,5", "0,125", "1.000". */
export function formatReceiptQuantity(quantity: number | null | undefined): string {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) return '0';
  const rounded = Math.round(quantity * 1000) / 1000;
  const [whole, fraction] = String(Math.abs(rounded)).split('.');
  return `${rounded < 0 ? '-' : ''}${groupThousands(whole)}${fraction ? `,${fraction}` : ''}`;
}

const clean = (text: string | null | undefined) => (text ?? '').trim();

const NBSP = String.fromCharCode(0xa0);

// ── Ước lượng chiều cao ───────────────────────────────────────────────────

const MM_PER_PT = 25.4 / 72;

const LINE_HEIGHT = 1.3;

// Bề rộng chữ được tính dư thêm 2 % để số dòng ước lượng không bao giờ ít hơn số dòng thật.
const WIDTH_SAFETY = 1.02;

type Font = { pt: number; bold?: boolean };

const lineMm = (font: Font) => font.pt * LINE_HEIGHT * MM_PER_PT;

// Bề rộng (phần nghìn em) của các ký tự ASCII 32..126 trong Arial thường và Arial đậm — đo bằng
// Chromium, làm tròn lên. Phiếu tắt kerning (font-kerning: none) nên bề rộng một dòng chữ đúng bằng
// tổng bề rộng các ký tự.
// prettier-ignore
const ARIAL_WIDTHS = [
  278, 278, 355, 557, 557, 890, 667, 191, 334, 334, 390, 584, 278, 334, 278, 278,
  557, 557, 557, 557, 557, 557, 557, 557, 557, 557, 278, 278, 584, 584, 584, 557,
  1016, 667, 667, 723, 723, 667, 611, 778, 723, 278, 500, 667, 557, 834, 723, 778,
  667, 778, 723, 667, 611, 723, 667, 944, 667, 667, 611, 278, 278, 278, 470, 557,
  334, 557, 557, 500, 557, 557, 278, 557, 557, 223, 223, 500, 223, 834, 557, 557,
  557, 557, 334, 500, 278, 557, 500, 723, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const ARIAL_BOLD_WIDTHS = [
  278, 334, 475, 557, 557, 890, 723, 238, 334, 334, 390, 584, 278, 334, 278, 278,
  557, 557, 557, 557, 557, 557, 557, 557, 557, 557, 334, 334, 584, 584, 584, 611,
  976, 723, 723, 723, 723, 667, 611, 778, 723, 278, 557, 723, 611, 834, 723, 778,
  667, 778, 723, 667, 611, 723, 667, 944, 667, 667, 611, 334, 278, 334, 584, 557,
  334, 557, 611, 557, 611, 557, 334, 611, 611, 278, 278, 557, 278, 890, 611, 611,
  611, 611, 390, 557, 334, 611, 557, 778, 557, 557, 500, 390, 280, 390, 584,
];

const COMBINING_HORN = 0x31b;

const isCombiningMark = (code: number) => code >= 0x300 && code <= 0x36f;

// Bề rộng (em) của một ký tự sau khi tách dấu (NFD); `base` là chữ gốc đứng ngay trước một dấu rời.
function charWidthEm(char: string, base: string, bold: boolean): number {
  const code = char.codePointAt(0) as number;
  if (isCombiningMark(code)) {
    // Dấu rời không chiếm chỗ, trừ: dấu móc làm ơ / ư rộng hơn o / u; chữ i thường mang dấu (ì, í, ĩ)
    // rộng hơn i không dấu.
    if (code === COMBINING_HORN) return 0.14;
    return base === 'i' && !bold ? 0.06 : 0;
  }
  if (code >= 32 && code <= 126) return (bold ? ARIAL_BOLD_WIDTHS : ARIAL_WIDTHS)[code - 32] / 1000;
  if (char === 'đ') return charWidthEm('d', '', bold);
  if (char === 'Đ') return charWidthEm('D', '', bold);
  if (code === 0xa0) return 0.278;
  if (char === '×') return 0.584;
  // Ngoài bảng: chữ Latin khác, ký hiệu ≤ 1 em; chữ Hán, biểu tượng cảm xúc (font thay thế) rộng hơn.
  return code >= 0x2e80 ? 1.4 : 1.05;
}

/** Bề rộng (mm) của `text` trên một dòng — ước lượng dư. */
export function estimateTextWidthMm(text: string, font: Font): number {
  let em = 0;
  let base = '';
  Array.from(text.normalize('NFD')).forEach((char) => {
    em += charWidthEm(char, base, !!font.bold);
    if (!isCombiningMark(char.codePointAt(0) as number)) base = char;
  });
  return em * font.pt * MM_PER_PT * WIDTH_SAFETY;
}

type Run = { text: string; font: Font };

// Chỗ được phép xuống dòng: khoảng trắng thường (không tính khoảng trắng không ngắt U+00A0). Trình
// duyệt không ngắt dòng ngay sau dấu mở ngoặc hay ngay trước dấu câu / dấu đóng ngoặc dù có khoảng
// trắng ở đó, nên các "từ" như vậy được gộp với từ bên cạnh.
const ENDS_WITH_OPENING = /[([{“‘]$/;
const STARTS_WITH_CLOSING = /^[)\]}!?,.:;%/”’…]/;

function wordWidthsMm(run: Run): number[] {
  const space = estimateTextWidthMm(' ', run.font);
  const widths: number[] = [];
  let glueNext = false;
  run.text
    .split(/[ \t\r\n\f]+/)
    .filter(Boolean)
    .forEach((word) => {
      const width = estimateTextWidthMm(word, run.font);
      if (widths.length > 0 && (glueNext || STARTS_WITH_CLOSING.test(word))) {
        widths[widths.length - 1] += space + width;
      } else {
        widths.push(width);
      }
      glueNext = ENDS_WITH_OPENING.test(word);
    });
  return widths;
}

/**
 * Số dòng của một đoạn chữ (một hay nhiều kiểu chữ nối nhau bằng khoảng trắng) khi tự xuống dòng theo
 * từ trong bề rộng `widthMm`. Từ dài hơn cả dòng bị ngắt giữa chừng (overflow-wrap). Vì bề rộng chữ
 * được tính dư nên kết quả không ít hơn số dòng thật.
 */
export function estimateLineCount(content: string | Run[], widthMm: number, font: Font): number {
  const runs = typeof content === 'string' ? [{ text: content, font }] : content;
  const space = estimateTextWidthMm(' ', font);
  let lines = 1;
  let used = 0;
  runs
    .flatMap((run) => wordWidthsMm(run))
    .forEach((width) => {
      if (used > 0 && used + space + width <= widthMm) {
        used += space + width;
        return;
      }
      if (used > 0) lines += 1;
      if (width <= widthMm) {
        used = width;
        return;
      }
      lines += Math.ceil(width / widthMm) - 1;
      used = widthMm;
    });
  return lines;
}

// Chữ giữ nguyên chỗ xuống dòng của người nhập (white-space: pre-line): mỗi đoạn ít nhất một dòng.
const estimateParagraphLines = (text: string, widthMm: number, font: Font) =>
  text
    .split(/\r?\n/)
    .reduce((count, paragraph) => count + estimateLineCount(paragraph, widthMm, font), 0);

// ── Các khối của phiếu ────────────────────────────────────────────────────

type Block = { html: string; heightMm: number };

const GAP_MM = 2;

// Hàng con (từng phương thức thanh toán) thụt vào so với hàng "Khách đã trả".
const SUB_INDENT_MM = 3;

const RULE_MARGIN_MM = 1.2;
const RULE_LINE_MM = 0.25;
// Trình duyệt làm tròn nét mảnh lên 1 px (0,265 mm) → tính dư một chút cho mỗi đường kẻ.
const RULE_HEIGHT_MM = RULE_MARGIN_MM * 2 + 0.3;

const ITEM_PADDING_MM = 0.5;

const TITLE_PADDING_TOP_MM = 1.5;

const BANNER_PADDING_MM = 1.5;
const BANNER_BORDER_MM = 0.5;
const BANNER_INNER_MM = 0.8;
const BANNER_PT = 14;

const QR_MARGIN_MM = 0.5;

const FOOTER_PADDING_TOP_MM = 1;

const PAGE_PADDING_TOP_MM = 2;
const PAGE_PADDING_BOTTOM_MM = 3;

// Chiều cao trang = chiều cao ước lượng × 1,03 + 6 mm dự phòng (font khác Arial, làm tròn của trình duyệt).
const PAGE_HEIGHT_FACTOR = 1.03;
const PAGE_HEIGHT_SPARE_MM = 6;

// Trang phải CAO hơn rộng: trang thấp hơn bề rộng bị trình duyệt coi là giấy ngang, có driver xoay 90°.
const PAGE_MIN_EXTRA_MM = 10;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const cssMm = (mm: number) => `${round3(mm)}mm`;

/** Một đoạn chữ chiếm trọn bề rộng phiếu. `preLine`: giữ chỗ xuống dòng của người nhập. */
function textBlock(
  className: string,
  text: string,
  font: Font,
  widthMm: number,
  preLine = false
): Block {
  const lines = preLine
    ? estimateParagraphLines(text, widthMm, font)
    : estimateLineCount(text, widthMm, font);
  return {
    html: `<div${className ? ` class="${className}"` : ''}>${escapeHtml(text)}</div>`,
    heightMm: lines * lineMm(font),
  };
}

/** "Nhãn: giá trị" trên cùng một đoạn, giá trị in đậm. */
function fieldBlock(label: string, value: string, font: Font, widthMm: number): Block {
  const lines = estimateLineCount(
    [
      { text: `${label}:`, font },
      { text: value, font: { ...font, bold: true } },
    ],
    widthMm,
    font
  );
  return {
    html: `<div>${escapeHtml(label)}: <b>${escapeHtml(value)}</b></div>`,
    heightMm: lines * lineMm(font),
  };
}

/** Hàng "nhãn ........ số tiền": số tiền không xuống dòng, nhãn tự xuống dòng trong phần còn lại. */
function rowBlock(
  className: string,
  label: string,
  value: string,
  font: Font,
  widthMm: number
): Block {
  const labelWidthMm = Math.max(10, widthMm - GAP_MM - estimateTextWidthMm(value, font));
  return {
    html: `<div class="rw${className ? ` ${className}` : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`,
    heightMm: estimateLineCount(label, labelWidthMm, font) * lineMm(font),
  };
}

const ruleBlock = (): Block => ({ html: '<div class="hr"></div>', heightMm: RULE_HEIGHT_MM });

const bannerBlock = (): Block => ({
  html: `<div class="cw"><div class="cx">${escapeHtml(RECEIPT_CANCELLED_TEXT)}</div></div>`,
  heightMm:
    (BANNER_PADDING_MM + BANNER_BORDER_MM + BANNER_INNER_MM) * 2 + lineMm({ pt: BANNER_PT }),
});

/**
 * Một dòng hàng: tên (đậm), "số lượng × đơn giá" và thành tiền canh phải. Tên ngắn thì cả ba nằm trên
 * một hàng; tên dài thì tên chiếm (các) hàng riêng rồi tới hàng số — trình duyệt tự quyết bằng
 * flex-wrap, ở đây chỉ đoán theo cùng quy tắc để tính chiều cao.
 */
function itemBlock(line: ISalesOrderReceiptLine, paper: ReceiptPaper, widthMm: number): Block {
  const base: Font = { pt: paper.basePt };
  const small: Font = { pt: paper.smallPt };
  const nameFont: Font = { pt: paper.basePt, bold: true };

  const name = clean(line.name) || 'Hàng hoá';
  const unit = clean(line.unit);
  const quantityPrice = `${formatReceiptQuantity(line.quantity)}${unit ? ` ${unit}` : ''} × ${formatReceiptMoney(line.unitPrice)}`;
  const total = formatReceiptMoney(line.lineTotal);
  const discount = Math.round(Number(line.discount) || 0);
  const note = clean(line.note);

  const amountsMm =
    estimateTextWidthMm(quantityPrice, base) +
    GAP_MM +
    Math.max(paper.amountMinMm, estimateTextWidthMm(total, base));
  const sameRow = estimateTextWidthMm(name, nameFont) + GAP_MM + amountsMm <= widthMm;
  // Hàng số không vừa một dòng (số rất lớn trên giấy 58 mm): thành tiền xuống hàng riêng.
  const amountRows = amountsMm <= widthMm ? 1 : estimateLineCount(quantityPrice, widthMm, base) + 1;
  const rows = sameRow ? 1 : estimateLineCount(name, widthMm, nameFont) + amountRows;

  let heightMm = ITEM_PADDING_MM * 2 + rows * lineMm(base);
  const parts = [
    `<div class="ln"><span class="nm">${escapeHtml(name)}</span><span class="am"><span class="qp">${escapeHtml(quantityPrice)}</span><span class="lt">${escapeHtml(total)}</span></span></div>`,
  ];

  if (discount !== 0) {
    const discountBlock = textBlock(
      'ld',
      `Đã giảm ${formatReceiptMoney(discount)}`,
      small,
      widthMm
    );
    parts.push(discountBlock.html);
    heightMm += discountBlock.heightMm;
  }
  if (note) {
    const noteBlock = textBlock('nt', note, small, widthMm, true);
    parts.push(noteBlock.html);
    heightMm += noteBlock.heightMm;
  }

  return { html: `<div class="it">${parts.join('')}</div>`, heightMm };
}

function buildBlocks(receipt: ISalesOrderReceipt, paper: ReceiptPaper): Block[] {
  const widthMm = paper.printableMm - paper.paddingMm * 2;
  const base: Font = { pt: paper.basePt };
  const small: Font = { pt: paper.smallPt };
  const blocks: Block[] = [];

  const { store, branch, invoice, totals } = receipt;
  const lines = receipt.lines ?? [];
  const payments = receipt.payments ?? [];
  const cancelled = !!invoice.isCancelled;

  // Đầu phiếu: cửa hàng (hoá đơn kéo về từ KiotViet có chi nhánh thì in địa chỉ / điện thoại chi nhánh)
  const storeName = clean(store?.name);
  if (storeName) {
    blocks.push(textBlock('sn', storeName, { pt: paper.storePt, bold: true }, widthMm));
  }
  const branchName = clean(branch?.name);
  if (branchName && branchName !== storeName) {
    blocks.push(textBlock('c', branchName, base, widthMm));
  }
  const address = clean(branch?.address) || clean(store?.address);
  if (address) blocks.push(textBlock('c', address, base, widthMm));
  const phone = clean(branch?.phone) || clean(store?.phone);
  if (phone) blocks.push(textBlock('c', `ĐT: ${phone}`, base, widthMm));
  const taxCode = clean(store?.taxCode);
  if (taxCode) blocks.push(textBlock('c', `MST: ${taxCode}`, base, widthMm));

  const title = textBlock(
    'tl',
    clean(receipt.title) || RECEIPT_TITLE,
    { pt: paper.titlePt, bold: true },
    widthMm
  );
  blocks.push({ ...title, heightMm: title.heightMm + TITLE_PADDING_TOP_MM });
  if (cancelled) blocks.push(bannerBlock());

  // Thông tin hoá đơn
  blocks.push(ruleBlock());
  blocks.push(fieldBlock('Mã hoá đơn', clean(invoice.code), base, widthMm));
  const createdAt = clean(invoice.createdAtLocal);
  if (createdAt) blocks.push(fieldBlock('Ngày', createdAt, base, widthMm));
  const cashier = clean(invoice.cashierName);
  if (cashier) blocks.push(fieldBlock('Thu ngân', cashier, base, widthMm));
  const customer = [clean(invoice.customerName), clean(invoice.customerPhone)]
    .filter(Boolean)
    .join(' - ');
  blocks.push(fieldBlock('Khách hàng', customer || 'Khách lẻ', base, widthMm));
  const invoiceNote = clean(invoice.note);
  if (invoiceNote) blocks.push(textBlock('nt', `Ghi chú: ${invoiceNote}`, small, widthMm, true));

  // Hàng hoá
  blocks.push(ruleBlock());
  lines.forEach((line) => blocks.push(itemBlock(line, paper, widthMm)));

  // Tóm tắt: tổng tiền hàng − mọi giảm giá = khách cần trả
  blocks.push(ruleBlock());
  blocks.push(rowBlock('', 'Tổng tiền hàng', formatReceiptMoney(totals.subTotal), base, widthMm));
  if (totals.discountTotal > 0) {
    blocks.push(rowBlock('', 'Giảm giá', formatReceiptMoney(-totals.discountTotal), base, widthMm));
  }
  // Chỉ hoá đơn KiotViet có thu khác mới có tổng lớn hơn tiền hàng
  if (totals.total > totals.subTotal) {
    blocks.push(
      rowBlock('', 'Thu khác', formatReceiptMoney(totals.total - totals.subTotal), base, widthMm)
    );
  }
  blocks.push(
    rowBlock(
      'tt',
      'Khách cần trả',
      formatReceiptMoney(totals.total),
      { pt: paper.totalPt, bold: true },
      widthMm
    )
  );

  // Đã trả: một lần trả đúng bằng số đã trả thì gộp một hàng; còn lại liệt kê từng phương thức.
  const paymentLabel = (index: number) =>
    clean(payments[index].methodLabel) || clean(payments[index].method) || 'Khác';
  const tendered = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  if (payments.length === 1 && Math.round(tendered) === Math.round(totals.paid)) {
    blocks.push(
      rowBlock(
        '',
        // Khoảng trắng không ngắt: nhãn dài quá thì xuống dòng trước dấu "(" chứ không ngắt giữa tên
        `Khách đã trả (${paymentLabel(0).replace(/ /g, NBSP)})`,
        formatReceiptMoney(totals.paid),
        base,
        widthMm
      )
    );
  } else if (payments.length > 0 || totals.paid > 0) {
    blocks.push(rowBlock('', 'Khách đã trả', formatReceiptMoney(totals.paid), base, widthMm));
    payments.forEach((payment, index) => {
      blocks.push(
        rowBlock(
          'sb',
          paymentLabel(index),
          formatReceiptMoney(payment.amount),
          small,
          widthMm - SUB_INDENT_MM
        )
      );
    });
    // Thu ngân nhập số khách đưa (vd. 200.000đ cho hoá đơn 150.000đ) → phần dư là tiền trả lại
    const change = Math.round(tendered - totals.paid);
    if (payments.length > 0 && change > 0 && !(totals.remaining > 0)) {
      blocks.push(
        rowBlock(
          'sb',
          'Tiền thừa trả khách',
          formatReceiptMoney(change),
          small,
          widthMm - SUB_INDENT_MM
        )
      );
    }
  }
  // Hoá đơn mới (F&B, POS tự quản tồn) lưu riêng tiền mặt khách đưa / tiền thối — khoản thu chỉ ghi đúng số đã trả nên
  // cách tính từ khoản thu ở trên không ra tiền thừa. Không in hai lần khi khoản thu đã gồm phần dư (hoá đơn cũ).
  const changeDue = Math.round(totals.changeDue ?? 0);
  if (totals.cashTendered != null && changeDue > 0 && Math.round(tendered - totals.paid) <= 0 && !cancelled) {
    blocks.push(
      rowBlock('sb', 'Tiền khách đưa', formatReceiptMoney(totals.cashTendered), small, widthMm - SUB_INDENT_MM)
    );
    blocks.push(rowBlock('sb', 'Tiền thừa trả khách', formatReceiptMoney(changeDue), small, widthMm - SUB_INDENT_MM));
  }
  // Hoá đơn đã huỷ không còn khoản nào phải trả
  if (totals.remaining > 0 && !cancelled) {
    blocks.push(
      rowBlock(
        'rm',
        'Còn phải trả',
        formatReceiptMoney(totals.remaining),
        { ...base, bold: true },
        widthMm
      )
    );
  }
  if (cancelled) blocks.push(bannerBlock());

  // Mã QR chuyển khoản cho phần còn phải trả (hoá đơn đã huỷ thì không in dù có dữ liệu)
  const transfer = cancelled ? null : receipt.transferQr;
  if (transfer) {
    const qr = buildReceiptQr(transfer.payload, paper.qrMaxMm);
    const parts: Block[] = [
      textBlock(
        'qh',
        qr ? 'Quét mã để chuyển khoản' : 'Thông tin chuyển khoản',
        { ...base, bold: true },
        widthMm
      ),
    ];
    if (qr) parts.push({ html: qr.svg, heightMm: qr.sizeMm + QR_MARGIN_MM * 2 });
    const bankName = clean(transfer.bankName);
    if (bankName) parts.push(textBlock('', bankName, base, widthMm));
    parts.push(fieldBlock('STK', clean(transfer.accountNumber), base, widthMm));
    const accountName = clean(transfer.accountName);
    if (accountName) parts.push(textBlock('', accountName, base, widthMm));
    parts.push(fieldBlock('Số tiền', formatReceiptMoney(transfer.amount), base, widthMm));
    const content = clean(transfer.content);
    if (content) parts.push(fieldBlock('Nội dung', content, base, widthMm));

    blocks.push(ruleBlock());
    blocks.push({
      html: `<div class="qr">${parts.map((part) => part.html).join('')}</div>`,
      heightMm: parts.reduce((sum, part) => sum + part.heightMm, 0),
    });
  }

  // Cuối phiếu
  blocks.push(ruleBlock());
  const footer = clean(receipt.footer);
  if (footer) blocks.push(textBlock('ft', footer, base, widthMm, true));
  const printedAt = clean(receipt.printedAtLocal);
  if (printedAt) {
    const printed = textBlock('pa', `In lúc ${printedAt}`, small, widthMm);
    blocks.push({ ...printed, heightMm: printed.heightMm + FOOTER_PADDING_TOP_MM });
  }

  return blocks;
}

// ── HTML ──────────────────────────────────────────────────────────────────

const FONT_STACK = 'Arial,"Segoe UI",Tahoma,sans-serif';

function receiptCss(paper: ReceiptPaper, pageHeightMm: number): string {
  return [
    `@page{size:${cssMm(paper.widthMm)} ${cssMm(pageHeightMm)};margin:0}`,
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff}',
    // body không đặt bề rộng: trình duyệt làm tròn khổ trang (58 mm → 57,83 mm), body rộng hơn trang
    // một chút là cả trang bị thu nhỏ cho vừa.
    `body{font-family:${FONT_STACK};font-size:${paper.basePt}pt;line-height:${LINE_HEIGHT};font-kerning:none;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    // Xuống dòng theo từ; chỉ một "từ" dài hơn cả dòng (mã dính liền) mới bị ngắt giữa chừng.
    `.rc{width:${cssMm(paper.printableMm)};margin:0 auto;padding:${cssMm(PAGE_PADDING_TOP_MM)} ${cssMm(paper.paddingMm)} ${cssMm(PAGE_PADDING_BOTTOM_MM)};overflow-wrap:break-word;break-inside:avoid;page-break-inside:avoid}`,
    '.c{text-align:center}',
    // Chữ canh giữa nhiều dòng thì chia các dòng dài gần bằng nhau (số dòng không đổi).
    '.c,.sn,.ft{text-wrap:balance}',
    `.sn{text-align:center;font-size:${paper.storePt}pt;font-weight:700}`,
    `.tl{text-align:center;font-size:${paper.titlePt}pt;font-weight:700;padding-top:${cssMm(TITLE_PADDING_TOP_MM)}}`,
    `.cw{padding:${cssMm(BANNER_PADDING_MM)} 0}`,
    `.cx{border:${cssMm(BANNER_BORDER_MM)} solid #000;padding:${cssMm(BANNER_INNER_MM)} 0;text-align:center;font-size:${BANNER_PT}pt;font-weight:700;letter-spacing:0.5mm;white-space:nowrap}`,
    `.hr{border-top:${cssMm(RULE_LINE_MM)} dashed #000;margin:${cssMm(RULE_MARGIN_MM)} 0}`,
    `.it{padding:${cssMm(ITEM_PADDING_MM)} 0;break-inside:avoid;page-break-inside:avoid}`,
    `.ln{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:${cssMm(GAP_MM)}}`,
    '.nm{flex:0 1 auto;min-width:0;max-width:100%;font-weight:700}',
    `.am{flex:1 0 auto;max-width:100%;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:baseline;column-gap:${cssMm(GAP_MM)};text-align:right}`,
    '.qp{flex:0 1 auto;min-width:0;max-width:100%}',
    `.lt{flex:0 0 auto;min-width:${cssMm(paper.amountMinMm)};white-space:nowrap}`,
    `.ld{text-align:right;font-size:${paper.smallPt}pt}`,
    `.nt{font-size:${paper.smallPt}pt;font-style:italic;white-space:pre-line}`,
    `.rw{display:flex;justify-content:space-between;align-items:baseline;column-gap:${cssMm(GAP_MM)}}`,
    '.rw>span:first-child{flex:1 1 0;min-width:0}',
    '.rw>span:last-child{flex:0 0 auto;white-space:nowrap;text-align:right}',
    `.sb{padding-left:${cssMm(SUB_INDENT_MM)};font-size:${paper.smallPt}pt}`,
    `.tt{font-size:${paper.totalPt}pt;font-weight:700}`,
    '.rm{font-weight:700}',
    '.qr{text-align:center;break-inside:avoid;page-break-inside:avoid}',
    '.qh{font-weight:700}',
    `.qc{display:block;margin:${cssMm(QR_MARGIN_MM)} auto}`,
    '.ft{text-align:center;white-space:pre-line}',
    `.pa{text-align:center;font-size:${paper.smallPt}pt;padding-top:${cssMm(FOOTER_PADDING_TOP_MM)}}`,
    // Chỉ khi xem trên màn hình (ô xem trước): nền xám quanh tờ phiếu.
    '@media screen{body{background:#dfe3e8}.rc{background:#fff}}',
  ].join('\n');
}

export type ReceiptRenderOptions = {
  /** Khổ giấy cuộn; mặc định 80 mm. */
  paperWidth?: ReceiptPaperWidth;
};

export type ReceiptPageSize = { widthMm: number; heightMm: number };

const resolvePaper = (options: ReceiptRenderOptions) =>
  RECEIPT_PAPERS[options.paperWidth ?? DEFAULT_RECEIPT_PAPER_WIDTH] ??
  RECEIPT_PAPERS[DEFAULT_RECEIPT_PAPER_WIDTH];

const contentHeightMm = (blocks: Block[]) =>
  PAGE_PADDING_TOP_MM +
  PAGE_PADDING_BOTTOM_MM +
  blocks.reduce((sum, block) => sum + block.heightMm, 0);

const pageHeightMm = (blocks: Block[], paper: ReceiptPaper) =>
  Math.max(
    paper.widthMm + PAGE_MIN_EXTRA_MM,
    Math.ceil(contentHeightMm(blocks) * PAGE_HEIGHT_FACTOR + PAGE_HEIGHT_SPARE_MM)
  );

/** Chiều cao ước lượng (mm) của nội dung phiếu, kể cả lề trên / dưới — chưa cộng phần dự phòng. */
export function estimateReceiptHeightMm(
  receipt: ISalesOrderReceipt,
  options: ReceiptRenderOptions = {}
): number {
  return contentHeightMm(buildBlocks(receipt, resolvePaper(options)));
}

/** Khổ trang in của phiếu: khổ cuộn × chiều cao ước lượng dư từ nội dung (số mm nguyên). */
export function receiptPageSizeMm(
  receipt: ISalesOrderReceipt,
  options: ReceiptRenderOptions = {}
): ReceiptPageSize {
  const paper = resolvePaper(options);
  return { widthMm: paper.widthMm, heightMm: pageHeightMm(buildBlocks(receipt, paper), paper) };
}

/** Tài liệu HTML hoàn chỉnh của một phiếu thanh toán — đưa thẳng vào printHtmlDocument(). */
export function renderReceiptHtml(
  receipt: ISalesOrderReceipt,
  options: ReceiptRenderOptions = {}
): string {
  const paper = resolvePaper(options);
  const blocks = buildBlocks(receipt, paper);
  const code = clean(receipt.invoice.code);

  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(`Phiếu thanh toán${code ? ` ${code}` : ''}`)}</title>`,
    `<style>\n${receiptCss(paper, pageHeightMm(blocks, paper))}\n</style>`,
    '</head>',
    '<body>',
    `<div class="rc">${blocks.map((block) => block.html).join('\n')}</div>`,
    '</body>',
    '</html>',
  ].join('\n');
}
