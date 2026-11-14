// ----------------------------------------------------------------------
// Chứng từ để trộn vào mẫu HTML `{{ma}}` (receipt-template-render): giá trị chữ của từng trường, các dòng hàng / khoản thu
// (khối chứa chúng được lặp), cộng vài thứ để dựng hình (mã vạch / QR mã phiếu, QR chuyển khoản, dấu ĐÃ HUỶ).
// Hoá đơn (receiptDocument) và phiếu nhập (purchaseDocument) cùng đổi ra dạng này nên dùng chung bộ in và trình soạn.
// ----------------------------------------------------------------------

export type PrintDocument = {
  /** Tiêu đề cửa sổ in (vd. "Hoá đơn HD0001"). */
  title: string;
  /** Mã chứng từ — dựng mã vạch / QR. */
  code: string;
  cancelled: boolean;
  logoUrl: string | null;
  /** Trường không lặp: mã → chữ (rỗng = không có, đoạn chỉ có trường rỗng tự ẩn). */
  scalars: Record<string, string>;
  /** Mỗi dòng hàng: `item_*` → chữ. */
  items: Record<string, string>[];
  /** Mỗi khoản thu: `payment_*` → chữ. */
  payments: Record<string, string>[];
  /** Chuỗi VietQR số tiền còn phải trả; null = không có mã. */
  transferQrPayload: string | null;
};

export function isPrintDocument(value: unknown): value is PrintDocument {
  return !!value && typeof value === 'object' && 'scalars' in value && 'items' in value;
}
