import type {
  ISalesOrderReceipt,
  ISalesOrderReceiptLine,
  ISalesOrderReceiptPayment,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Phiếu mẫu dùng chung cho các test của in hoá đơn (đúng dạng GET /sales-orders/{id}/receipt).
// ----------------------------------------------------------------------

export const ORDER_ID = '3f0c1c1e-6c0d-4a53-9d0e-2a5b8a1f4c11';

/** VietQR hợp lệ (CRC đúng): BIN 970436, STK 0123456789, 50.000đ, nội dung "HD 20261006 0001". */
export const SAMPLE_VIETQR_PAYLOAD =
  '00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA53037045405500005802VN62200816HD 20261006 00016304CCA9';

export const LONG_NAME =
  'Áo khoác gió nam nữ hai lớp chống nước có mũ trùm đầu tháo rời màu xanh rêu size XL';

export function line(
  lineNo: number,
  name: string,
  quantity: number,
  unitPrice: number,
  extra: Partial<ISalesOrderReceiptLine> = {}
): ISalesOrderReceiptLine {
  const discount = extra.discount ?? 0;
  return {
    lineNo,
    name,
    code: null,
    unit: null,
    quantity,
    unitPrice,
    discount,
    lineTotal: quantity * unitPrice - discount,
    note: null,
    ...extra,
  };
}

export function payment(
  method: string,
  methodLabel: string,
  amount: number
): ISalesOrderReceiptPayment {
  return { method, methodLabel, amount, reference: null, paidAtLocal: '06/10/2026 14:31' };
}

/** Hoá đơn thường: 2 dòng, không giảm giá, trả đủ bằng tiền mặt, không có mã QR. */
export function normalReceipt(overrides: Partial<ISalesOrderReceipt> = {}): ISalesOrderReceipt {
  return {
    title: 'PHIẾU THANH TOÁN',
    store: {
      name: 'CiCi Accessories',
      address: '12 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
      phone: '0901 234 567',
      taxCode: null,
      logoUrl: null,
    },
    branch: null,
    invoice: {
      id: ORDER_ID,
      code: 'HD-20261006-0001',
      createdAtUtc: '2026-10-06T07:30:00Z',
      createdAtLocal: '06/10/2026 14:30',
      timezone: 'Asia/Ho_Chi_Minh',
      cashierName: 'Nguyễn Thị Lan',
      customerName: null,
      customerPhone: null,
      note: null,
      status: 'Completed',
      isCancelled: false,
    },
    lines: [
      line(1, 'Áo thun cổ tròn trắng size M', 1, 185000),
      line(2, 'Kẹp tóc nơ nhung đỏ', 2, 35000, { unit: 'cái' }),
    ],
    totals: {
      subTotal: 255000,
      discount: 0,
      discountTotal: 0,
      total: 255000,
      paid: 255000,
      remaining: 0,
    },
    payments: [payment('Cash', 'Tiền mặt', 255000)],
    transferQr: null,
    footer: 'Cảm ơn quý khách, hẹn gặp lại!',
    printedAtLocal: '06/10/2026 14:32',
    ...overrides,
  };
}

/** Giảm giá ở một dòng + giảm giá hoá đơn, trả đủ bằng hai phương thức. */
export function discountReceipt(): ISalesOrderReceipt {
  const base = normalReceipt();
  return {
    ...base,
    invoice: {
      ...base.invoice,
      code: 'HD-20261006-0002',
      customerName: 'Trần Văn Bình',
      customerPhone: '0912345678',
    },
    lines: [
      line(1, 'Áo thun cổ tròn trắng size M', 2, 185000, { unit: 'cái', discount: 37000 }),
      line(2, 'Kẹp tóc nơ nhung đỏ', 3, 35000),
    ],
    // 475.000 − (37.000 giảm dòng + 38.000 giảm hoá đơn) = 400.000
    totals: {
      subTotal: 475000,
      discount: 38000,
      discountTotal: 75000,
      total: 400000,
      paid: 400000,
      remaining: 0,
    },
    payments: [payment('Cash', 'Tiền mặt', 150000), payment('Transfer', 'Chuyển khoản', 250000)],
  };
}

/** Hoá đơn đã huỷ. */
export function cancelledReceipt(): ISalesOrderReceipt {
  const base = normalReceipt();
  return {
    ...base,
    invoice: { ...base.invoice, code: 'HD-20261006-0003', status: 'Đã hủy', isCancelled: true },
    totals: { ...base.totals, paid: 0, remaining: 255000 },
    payments: [],
  };
}

/**
 * Phiếu mẫu đầy đủ: 4 dòng (một tên rất dài, một dòng có giảm giá, một dòng có ghi chú), giảm giá hoá
 * đơn, trả một phần bằng tiền mặt + chuyển khoản, còn 50.000đ và có mã QR chuyển khoản.
 */
export function transferQrReceipt(): ISalesOrderReceipt {
  const base = normalReceipt();
  return {
    ...base,
    store: { ...base.store, taxCode: '0312345678' },
    invoice: {
      ...base.invoice,
      customerName: 'Trần Văn Bình',
      customerPhone: '0912345678',
      note: 'Khách hẹn chuyển khoản phần còn lại trong ngày',
    },
    lines: [
      line(1, LONG_NAME, 1, 385000),
      line(2, 'Áo thun cổ tròn trắng size M', 2, 185000, { unit: 'cái', discount: 37000 }),
      line(3, 'Kẹp tóc nơ nhung đỏ', 3, 35000, { note: 'Gói quà giúp khách' }),
      line(4, 'Túi tote vải canvas', 1, 99000),
    ],
    // 959.000 − (37.000 giảm dòng + 22.000 giảm hoá đơn) = 900.000; đã trả 850.000
    totals: {
      subTotal: 959000,
      discount: 22000,
      discountTotal: 59000,
      total: 900000,
      paid: 850000,
      remaining: 50000,
    },
    payments: [payment('Cash', 'Tiền mặt', 500000), payment('Transfer', 'Chuyển khoản', 350000)],
    transferQr: {
      payload: SAMPLE_VIETQR_PAYLOAD,
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountName: 'CiCi Accessories',
      amount: 50000,
      content: 'HD 20261006 0001',
    },
  };
}
