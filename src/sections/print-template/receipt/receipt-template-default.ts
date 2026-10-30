import type { ISalesOrderReceipt } from 'src/types/corecms-api';

import { defaultReceiptSettings } from './receipt-template-settings';

import type { ReceiptTemplatePaper, ReceiptTemplateSettings } from './receipt-template-settings';

// ----------------------------------------------------------------------
// Mẫu hoá đơn khởi đầu (giống phiếu thanh toán hệ thống, thêm logo cửa hàng: đầu phiếu, thông tin hoá đơn, từng món
// hai hàng, tổng tiền, các khoản thu, mã QR chuyển khoản, lời chào) và một phiếu mẫu để xem trước khi chưa chọn hoá đơn
// thật.
// ----------------------------------------------------------------------

const center = (inner: string) => `<p style="text-align: center">${inner}</p>`;
const right = (inner: string) => `<p style="text-align: right">${inner}</p>`;

/** Hàng "nhãn ........ số tiền" của bảng tổng tiền. */
const totalRow = (label: string, value: string) =>
  `<tr><td><p>${label}</p></td><td>${right(value)}</td></tr>`;

export const DEFAULT_RECEIPT_TEMPLATE_HTML = [
  // Logo hiện tại của cửa hàng; chưa có logo thì dòng này tự bỏ khi in.
  center('<img class="store-logo" style="width: 40%" alt="Logo">'),
  '<h2 style="text-align: center">{{store_name}}</h2>',
  center('{{branch_name}}'),
  center('{{store_address}}'),
  center('ĐT: {{store_phone}}'),
  center('MST: {{store_tax_code}}'),
  '<h3 style="text-align: center">{{invoice_title}}</h3>',
  center('{{cancelled_banner}}'),
  '<hr>',
  '<p>Mã hoá đơn: <strong>{{invoice_code}}</strong></p>',
  '<p>Ngày: <strong>{{invoice_date}}</strong></p>',
  '<p>Thu ngân: <strong>{{cashier_name}}</strong></p>',
  '<p>Khách hàng: <strong>{{customer_name}}</strong> {{customer_phone}}</p>',
  '<p><em>Ghi chú: {{invoice_note}}</em></p>',
  '<hr>',
  '<table><tbody>',
  '<tr><td colspan="2"><p><strong>{{item_name}}</strong></p></td></tr>',
  `<tr><td><p>{{item_quantity}} {{item_unit}} × {{item_price}}</p></td><td>${right('{{item_total}}')}</td></tr>`,
  `<tr><td colspan="2">${right('<span style="font-size: 8pt">Đã giảm {{item_discount}}</span>')}</td></tr>`,
  '<tr><td colspan="2"><p><em><span style="font-size: 8pt">{{item_note}}</span></em></p></td></tr>',
  '</tbody></table>',
  '<hr>',
  '<table><tbody>',
  totalRow('Tổng tiền hàng', '{{subtotal}}'),
  totalRow('Giảm giá', '{{discount_total}}'),
  totalRow('Thu khác', '{{other_charges}}'),
  totalRow(
    '<strong><span style="font-size: 12pt">Khách cần trả</span></strong>',
    '<strong><span style="font-size: 12pt">{{total}}</span></strong>'
  ),
  totalRow('Khách đã trả', '{{paid}}'),
  totalRow(
    '<span style="font-size: 8pt">  {{payment_method}}</span>',
    '<span style="font-size: 8pt">{{payment_amount}}</span>'
  ),
  totalRow(
    '<span style="font-size: 8pt">Tiền khách đưa</span>',
    '<span style="font-size: 8pt">{{cash_tendered}}</span>'
  ),
  totalRow(
    '<span style="font-size: 8pt">Tiền thừa trả khách</span>',
    '<span style="font-size: 8pt">{{change_due}}</span>'
  ),
  totalRow('<strong>Còn phải trả</strong>', '<strong>{{remaining}}</strong>'),
  '</tbody></table>',
  center('<strong>Quét mã để chuyển khoản</strong><br>{{transfer_qr}}'),
  center('{{transfer_bank}} - STK: <strong>{{transfer_account_number}}</strong>'),
  center('{{transfer_account_name}}'),
  center('Nội dung: <strong>{{transfer_content}}</strong>'),
  '<hr>',
  center('{{footer}}'),
  center('<span style="font-size: 8pt">In lúc {{printed_at}}</span>'),
].join('');

export function defaultReceiptTemplate(paper: ReceiptTemplatePaper = '80'): {
  content: string;
  settings: ReceiptTemplateSettings;
} {
  return { content: DEFAULT_RECEIPT_TEMPLATE_HTML, settings: defaultReceiptSettings(paper) };
}

/** VietQR hợp lệ (CRC đúng) để xem trước mã QR chuyển khoản. */
const SAMPLE_VIETQR =
  '00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA53037045405500005802VN62200816HD 20261006 00016304CCA9';

/** Phiếu mẫu: 3 món (một món có giảm giá), trả một phần tiền mặt, còn nợ có mã QR. */
export function sampleReceipt(
  storeName = 'Cửa hàng của bạn',
  logoUrl: string | null = null
): ISalesOrderReceipt {
  return {
    title: 'PHIẾU THANH TOÁN',
    store: {
      name: storeName,
      address: '21 Chùa Láng, Đống Đa, Hà Nội',
      phone: '0901 234 567',
      taxCode: '0101234567',
      logoUrl,
    },
    branch: null,
    invoice: {
      id: '00000000-0000-0000-0000-000000000000',
      code: 'HD-20261029-0001',
      createdAtUtc: '2026-10-29T07:30:00Z',
      createdAtLocal: '29/10/2026 14:30',
      timezone: 'Asia/Ho_Chi_Minh',
      cashierName: 'Nguyễn Thị Lan',
      customerName: 'Trần Minh Anh',
      customerPhone: '0912 345 678',
      note: null,
      status: 'Completed',
      isCancelled: false,
    },
    lines: [
      {
        lineNo: 1,
        name: 'Kẹp tóc nơ nhung đỏ',
        code: 'K35',
        unit: 'cái',
        quantity: 2,
        unitPrice: 35000,
        discount: 0,
        lineTotal: 70000,
        note: null,
      },
      {
        lineNo: 2,
        name: 'Bông tai bạc đính đá',
        code: 'BT120',
        unit: 'đôi',
        quantity: 1,
        unitPrice: 120000,
        discount: 20000,
        lineTotal: 100000,
        note: null,
      },
      {
        lineNo: 3,
        name: 'Túi giấy quà tặng',
        code: 'TG01',
        unit: null,
        quantity: 1,
        unitPrice: 5000,
        discount: 0,
        lineTotal: 5000,
        note: 'Gói quà giúp khách',
      },
    ],
    totals: {
      subTotal: 195000,
      discount: 0,
      discountTotal: 20000,
      total: 175000,
      paid: 125000,
      remaining: 50000,
      cashTendered: null,
      changeDue: null,
    },
    payments: [
      {
        method: 'Cash',
        methodLabel: 'Tiền mặt',
        amount: 125000,
        reference: null,
        paidAtLocal: '29/10/2026 14:31',
      },
    ],
    transferQr: {
      payload: SAMPLE_VIETQR,
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountName: 'CUA HANG',
      amount: 50000,
      content: 'HD20261029 0001',
    },
    footer: 'Cảm ơn quý khách — hẹn gặp lại!',
    printedAtLocal: '29/10/2026 14:32',
    channel: 'pos',
    paymentMethod: 'cash',
  };
}
