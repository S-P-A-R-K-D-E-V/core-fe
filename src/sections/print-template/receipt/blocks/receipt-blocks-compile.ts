import { escapeHtml } from 'src/utils/print-html';

import { isSafeImageSrc } from '../../print-image';
import { KEEP_CLASS, RULE_CLASSES, STORE_LOGO_CLASS } from '../receipt-template-render';

import type { ReceiptTemplateSettings } from '../receipt-template-settings';
import type {
  BlockOf,
  InfoRow,
  StoreLine,
  TotalRow,
  ItemsLayout,
  ReceiptBlock,
  TransferLine,
  PurchaseInfoRow,
  PurchaseTotalRow,
} from './receipt-blocks';

// ----------------------------------------------------------------------
// Khối → HTML `{{ma}}` đúng dialect của mẫu soạn tự do (receipt-template-render.ts): chỉ đoạn, <strong>/<em>, bảng, <hr>,
// <img>; CSS chỉ text-align / font-size / width; lớp chỉ store-logo, keep, hr-*. Nhờ vậy:
//  - bộ in POS (kể cả bản cũ đang chạy, đang mất mạng) in được mà không cần biết đến khối;
//  - core-be lọc HTML như mọi mẫu khác.
// Quy ước của bộ in được dùng lại: hàng / đoạn chứa `item_*` được lặp theo món (các hàng liền nhau lặp cùng nhau), chứa
// `payment_*` lặp theo khoản thu; đoạn / hàng mà mọi trường đều rỗng tự ẩn (trừ khi có lớp `keep`).
// ----------------------------------------------------------------------

type Ctx = { base: number; paper: ReceiptTemplateSettings['paper'] };

const NARROW: ReceiptTemplateSettings['paper'][] = ['80', '58'];

const round1 = (value: number) => Math.round(value * 10) / 10;

function styleOf(align: string | null, sizePt: number | null): string {
  const parts: string[] = [];
  if (align && align !== 'left') parts.push(`text-align: ${align}`);
  if (sizePt !== null) parts.push(`font-size: ${round1(sizePt)}pt`);
  return parts.length ? ` style="${parts.join('; ')}"` : '';
}

/** Cỡ chữ của khối (pt) — null khi bằng cỡ của mẫu. */
const sizeOf = (block: ReceiptBlock, ctx: Ctx, extra = 0) =>
  block.size + extra === 0 ? null : Math.max(5, ctx.base + block.size + extra);

const keepAttr = (block: ReceiptBlock) => (block.hideEmpty ? '' : ` class="${KEEP_CLASS}"`);

const strong = (html: string, on: boolean) => (on ? `<strong>${html}</strong>` : html);

/** Một đoạn của khối: căn lề, cỡ chữ, đậm, "luôn in" theo khối. */
function para(block: ReceiptBlock, ctx: Ctx, inner: string, opts: { extraSize?: number; bold?: boolean } = {}) {
  const size = sizeOf(block, ctx, opts.extraSize ?? 0);
  return `<p${keepAttr(block)}${styleOf(block.align, size)}>${strong(inner, opts.bold ?? block.bold)}</p>`;
}

/** Ô bảng: <td><p …>…</p></td> (ô của trình soạn luôn bọc đoạn). */
function cell(
  block: ReceiptBlock,
  ctx: Ctx,
  inner: string,
  opts: { align?: 'left' | 'right' | 'center'; colspan?: number; th?: boolean; extraSize?: number; bold?: boolean } = {}
) {
  const tag = opts.th ? 'th' : 'td';
  const span = opts.colspan && opts.colspan > 1 ? ` colspan="${opts.colspan}"` : '';
  const size = sizeOf(block, ctx, opts.extraSize ?? 0);
  const content = strong(inner, opts.bold ?? block.bold);
  return `<${tag}${span}><p${styleOf(opts.align ?? 'left', size)}>${content}</p></${tag}>`;
}

const row = (block: ReceiptBlock, cells: string) => `<tr${keepAttr(block)}>${cells}</tr>`;

const table = (rows: string[]) => (rows.length ? `<table><tbody>${rows.join('')}</tbody></table>` : '');

/** Chữ người soạn gõ: thoát HTML, giữ `{{ma}}`, xuống dòng → <br>. */
export function blockText(value: string): string {
  return escapeHtml(value ?? '')
    .split(/\r?\n/)
    .join('<br>');
}

// ── Từng loại khối ───────────────────────────────────────────────────────

const STORE_FIELDS: Record<StoreLine, string> = {
  name: '{{store_name}}',
  branch: '{{branch_name}}',
  address: '{{store_address}}',
  phone: 'ĐT: {{store_phone}}',
  taxCode: 'MST: {{store_tax_code}}',
};

const INFO_FIELDS: Record<InfoRow, string> = {
  code: 'Mã hoá đơn: <strong>{{invoice_code}}</strong>',
  date: 'Ngày: <strong>{{invoice_date}}</strong>',
  cashier: 'Thu ngân: <strong>{{cashier_name}}</strong>',
  customer: 'Khách hàng: <strong>{{customer_name}}</strong>',
  customerPhone: 'SĐT: {{customer_phone}}',
  channel: 'Kênh bán: {{channel_name}}',
  note: '<em>Ghi chú: {{invoice_note}}</em>',
};

const TOTAL_FIELDS: Record<Exclude<TotalRow, 'inWords' | 'payments'>, [string, string]> = {
  subtotal: ['Tổng tiền hàng', '{{subtotal}}'],
  discount: ['Giảm giá', '{{discount_total}}'],
  otherCharges: ['Thu khác', '{{other_charges}}'],
  total: ['Khách cần trả', '{{total}}'],
  paid: ['Khách đã trả', '{{paid}}'],
  cashTendered: ['Tiền khách đưa', '{{cash_tendered}}'],
  changeDue: ['Tiền thừa trả khách', '{{change_due}}'],
  remaining: ['Còn phải trả', '{{remaining}}'],
  itemCount: ['Số mặt hàng', '{{item_count}}'],
  totalQuantity: ['Tổng số lượng', '{{total_quantity}}'],
};

const PURCHASE_INFO_FIELDS: Record<PurchaseInfoRow, string> = {
  code: 'Mã phiếu: <strong>{{purchase_code}}</strong>',
  date: 'Ngày nhập: <strong>{{purchase_date}}</strong>',
  supplier: 'Nhà cung cấp: <strong>{{supplier_name}}</strong>',
  supplierCode: 'Mã NCC: {{supplier_code}}',
  supplierPhone: 'SĐT NCC: {{supplier_phone}}',
  supplierAddress: 'Địa chỉ NCC: {{supplier_address}}',
  warehouse: 'Kho nhập: {{warehouse_name}}',
  createdBy: 'Người nhập: {{created_by}}',
  status: 'Trạng thái: {{purchase_status}}',
  note: '<em>Ghi chú: {{purchase_note}}</em>',
};

const PURCHASE_TOTAL_FIELDS: Record<Exclude<PurchaseTotalRow, 'inWords'>, [string, string]> = {
  subtotal: ['Tổng tiền hàng', '{{subtotal}}'],
  discount: ['Giảm giá', '{{discount_total}}'],
  vat: ['Thuế VAT', '{{vat_total}}'],
  total: ['Cần trả NCC', '{{total}}'],
  paid: ['Đã trả NCC', '{{paid_to_supplier}}'],
  debt: ['Còn nợ NCC', '{{supplier_debt}}'],
  itemCount: ['Số mặt hàng', '{{item_count}}'],
  totalQuantity: ['Tổng số lượng', '{{total_quantity}}'],
};

const TRANSFER_FIELDS: Record<TransferLine, string> = {
  bank: '{{transfer_bank}}',
  accountNumber: 'STK: <strong>{{transfer_account_number}}</strong>',
  accountName: '{{transfer_account_name}}',
  content: 'Nội dung: <strong>{{transfer_content}}</strong>',
};

function compileStoreHeader(block: BlockOf<'storeHeader'>, ctx: Ctx): string {
  return (Object.keys(STORE_FIELDS) as StoreLine[])
    .filter((line) => block.lines[line])
    .map((line) =>
      line === 'name'
        ? para(block, ctx, STORE_FIELDS.name, { extraSize: 3, bold: true })
        : para(block, ctx, STORE_FIELDS[line])
    )
    .join('');
}

function compileTitle(block: BlockOf<'title'>, ctx: Ctx): string {
  const title = block.text.trim() ? para(block, ctx, blockText(block.text)) : '';
  // Dấu đã huỷ tự ẩn khi hoá đơn không huỷ (trường rỗng) — không theo "luôn in".
  const cancelled = block.showCancelled ? '<p style="text-align: center">{{cancelled_banner}}</p>' : '';
  return title + cancelled;
}

function compileItems(block: BlockOf<'items'>, ctx: Ctx): string {
  const layout: Exclude<ItemsLayout, 'auto'> =
    block.layout === 'auto' ? (NARROW.includes(ctx.paper) ? 'twoLine' : 'table5') : block.layout;
  const { cols } = block;
  const small = -1.5;
  const extraRows: string[] = [];
  const name = `${cols.no ? '{{item_no}}. ' : ''}{{item_name}}${cols.code ? ' ({{item_code}})' : ''}`;
  const qty = `{{item_quantity}}${cols.unit ? ' {{item_unit}}' : ''}`;

  if (layout === 'twoLine') {
    const rows = [
      row(block, cell(block, ctx, name, { colspan: 2, bold: true })),
      row(block, cell(block, ctx, `${qty} × {{item_price}}`) + cell(block, ctx, '{{item_total}}', { align: 'right' })),
    ];
    if (cols.discount)
      rows.push(row(block, cell(block, ctx, 'Đã giảm {{item_discount}}', { colspan: 2, align: 'right', extraSize: small })));
    if (cols.note)
      rows.push(row(block, cell(block, ctx, '<em>{{item_note}}</em>', { colspan: 2, extraSize: small })));
    return table(rows);
  }

  const wide = layout === 'table5';
  const head: string[] = [];
  const body: string[] = [];
  const add = (title: string, value: string, align: 'left' | 'right' = 'left') => {
    head.push(cell(block, ctx, title, { th: true, align, bold: true }));
    body.push(cell(block, ctx, value, { align }));
  };
  if (cols.no && wide) add('STT', '{{item_no}}');
  if (cols.code && wide) add('Mã', '{{item_code}}');
  add('Tên hàng', wide ? '{{item_name}}' : name);
  if (cols.unit && wide) add('ĐVT', '{{item_unit}}');
  add('SL', wide ? '{{item_quantity}}' : qty, 'right');
  add('Đơn giá', '{{item_price}}', 'right');
  if (cols.discount && wide) add('Giảm', '{{item_discount}}', 'right');
  add('T.Tiền', '{{item_total}}', 'right');

  if (cols.discount && !wide)
    extraRows.push(row(block, cell(block, ctx, 'Đã giảm {{item_discount}}', { colspan: head.length, align: 'right', extraSize: small })));
  if (cols.note)
    extraRows.push(row(block, cell(block, ctx, '<em>{{item_note}}</em>', { colspan: head.length, extraSize: small })));

  const rows = [...(block.header ? [`<tr>${head.join('')}</tr>`] : []), row(block, body.join('')), ...extraRows];
  return table(rows);
}

function compileTotals(block: BlockOf<'totals'>, ctx: Ctx): string {
  const rows: string[] = [];
  (Object.keys(block.rows) as TotalRow[]).forEach((key) => {
    if (!block.rows[key]) return;
    if (key === 'inWords') {
      rows.push(row(block, cell(block, ctx, '<em>Bằng chữ: {{total_in_words}}</em>', { colspan: 2 })));
      return;
    }
    if (key === 'payments') {
      rows.push(
        `<tr>${cell(block, ctx, '{{payment_method}}', { extraSize: -1 })}${cell(block, ctx, '{{payment_amount}}', { align: 'right', extraSize: -1 })}</tr>`
      );
      return;
    }
    const [label, value] = TOTAL_FIELDS[key];
    const emphasis = key === 'total' && block.emphasizeTotal;
    const bold = emphasis || key === 'remaining' ? true : undefined;
    const extraSize = emphasis ? 2 : 0;
    rows.push(
      row(
        block,
        cell(block, ctx, label, { bold, extraSize }) + cell(block, ctx, value, { align: 'right', bold, extraSize })
      )
    );
  });
  return table(rows);
}

function compilePurchaseTotals(block: BlockOf<'purchaseTotals'>, ctx: Ctx): string {
  const rows: string[] = [];
  (Object.keys(block.rows) as PurchaseTotalRow[]).forEach((key) => {
    if (!block.rows[key]) return;
    if (key === 'inWords') {
      rows.push(row(block, cell(block, ctx, '<em>Bằng chữ: {{total_in_words}}</em>', { colspan: 2 })));
      return;
    }
    const [label, value] = PURCHASE_TOTAL_FIELDS[key];
    const emphasis = key === 'total' && block.emphasizeTotal;
    const bold = emphasis || key === 'debt' ? true : undefined;
    const extraSize = emphasis ? 2 : 0;
    rows.push(
      row(
        block,
        cell(block, ctx, label, { bold, extraSize }) + cell(block, ctx, value, { align: 'right', bold, extraSize })
      )
    );
  });
  return table(rows);
}

/** Hai cột chữ ký: tên vai trò, "(Ký, ghi rõ họ tên)", rồi vài dòng trống để ký. Luôn in (không có trường). */
function compileSignatures(block: BlockOf<'signatures'>, ctx: Ctx): string {
  const sides = [block.left, block.right].map((value) => value.trim()).filter(Boolean);
  if (!sides.length) return '';
  const center = (inner: string, extraSize = 0, bold?: boolean) =>
    cell(block, ctx, inner, { align: 'center', extraSize, bold });
  const rows = [`<tr class="${KEEP_CLASS}">${sides.map((side) => center(blockText(side), 0, true)).join('')}</tr>`];
  if (block.showNote)
    rows.push(`<tr class="${KEEP_CLASS}">${sides.map(() => center('<em>(Ký, ghi rõ họ tên)</em>', -1.5, false)).join('')}</tr>`);
  return table(rows) + '<p></p>'.repeat(Math.min(8, Math.max(1, block.lines)));
}

function compilePayments(block: BlockOf<'payments'>, ctx: Ctx): string {
  const rows = [
    `<tr>${cell(block, ctx, '{{payment_method}}')}${cell(block, ctx, '{{payment_amount}}', { align: 'right' })}</tr>`,
  ];
  const extra = [block.showReference ? 'Mã GD: {{payment_reference}}' : '', block.showTime ? '{{payment_time}}' : '']
    .filter(Boolean)
    .join(' · ');
  if (extra) rows.push(`<tr>${cell(block, ctx, extra, { colspan: 2, extraSize: -1.5 })}</tr>`);
  return table(rows);
}

function compileTransferQr(block: BlockOf<'transferQr'>, ctx: Ctx): string {
  // Chú thích đi cùng đoạn mã QR: không có QR (đã trả đủ / huỷ) thì cả đoạn tự ẩn.
  const caption = block.caption.trim() ? `<strong>${blockText(block.caption)}</strong><br>` : '';
  const out = [`<p${styleOf(block.align, sizeOf(block, ctx))}>${caption}{{transfer_qr}}</p>`];
  const bankLine = [block.lines.bank ? TRANSFER_FIELDS.bank : '', block.lines.accountNumber ? TRANSFER_FIELDS.accountNumber : '']
    .filter(Boolean)
    .join(' - ');
  if (bankLine) out.push(`<p${styleOf(block.align, sizeOf(block, ctx))}>${bankLine}</p>`);
  if (block.lines.accountName) out.push(`<p${styleOf(block.align, sizeOf(block, ctx))}>${TRANSFER_FIELDS.accountName}</p>`);
  if (block.lines.content) out.push(`<p${styleOf(block.align, sizeOf(block, ctx))}>${TRANSFER_FIELDS.content}</p>`);
  return out.join('');
}

export function compileBlock(block: ReceiptBlock, ctx: Ctx): string {
  switch (block.type) {
    case 'logo':
      return `<p${styleOf(block.align, null)}><img class="${STORE_LOGO_CLASS}" style="width: ${block.widthPct}%" alt="Logo"></p>`;
    case 'storeHeader':
      return compileStoreHeader(block, ctx);
    case 'title':
      return compileTitle(block, ctx);
    case 'invoiceInfo':
      return (Object.keys(INFO_FIELDS) as InfoRow[])
        .filter((key) => block.rows[key])
        .map((key) => para(block, ctx, INFO_FIELDS[key]))
        .join('');
    case 'items':
      return compileItems(block, ctx);
    case 'totals':
      return compileTotals(block, ctx);
    case 'payments':
      return compilePayments(block, ctx);
    case 'transferQr':
      return compileTransferQr(block, ctx);
    case 'code':
      return (
        `<p${styleOf(block.align, null)}>${block.kind === 'qr' ? '{{invoice_qr}}' : '{{invoice_barcode}}'}</p>` +
        (block.showCode ? para(block, ctx, '{{invoice_code}}', { extraSize: -1 }) : '')
      );
    case 'text':
      return block.text.trim() ? para(block, ctx, blockText(block.text)) : '';
    case 'divider':
      return `<hr class="${RULE_CLASSES[block.style]}">`;
    case 'spacer':
      return '<p></p>'.repeat(Math.min(4, Math.max(1, block.lines)));
    case 'image':
      return isSafeImageSrc(block.src)
        ? `<p${styleOf(block.align, null)}><img src="${escapeHtml(block.src)}" style="width: ${block.widthPct}%" alt=""></p>`
        : '';
    case 'footer':
      return (
        (block.showFooter ? para(block, ctx, '{{footer}}') : '') +
        (block.showPrintedAt ? para(block, ctx, 'In lúc {{printed_at}}', { extraSize: -1.5, bold: false }) : '')
      );
    case 'purchaseInfo':
      return (Object.keys(PURCHASE_INFO_FIELDS) as PurchaseInfoRow[])
        .filter((key) => block.rows[key])
        .map((key) => para(block, ctx, PURCHASE_INFO_FIELDS[key]))
        .join('');
    case 'purchaseTotals':
      return compilePurchaseTotals(block, ctx);
    case 'signatures':
      return compileSignatures(block, ctx);
    default:
      return '';
  }
}

/** Cả bố cục → HTML lưu vào `content` của mẫu (khối tạm ẩn bị bỏ). */
export function compileReceiptBlocks(blocks: ReceiptBlock[], settings: ReceiptTemplateSettings): string {
  const ctx: Ctx = { base: settings.fontSizePt, paper: settings.paper };
  return blocks
    .filter((block) => !block.hidden)
    .map((block) => compileBlock(block, ctx))
    .join('');
}
