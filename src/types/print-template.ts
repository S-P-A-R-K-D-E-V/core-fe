// ----------------------------------------------------------------------
// Mẫu in hoá đơn / tem mã (GET /print-templates). Máy chủ chỉ lưu; web trộn dữ liệu và dựng trang in.
//  - Hoá đơn: `content` là HTML (đã lọc) có trường `{{ma}}`; `settings` là JSON khổ giấy, lề, chữ, kẻ bảng.
//  - Tem mã: `content` là JSON bố cục (khổ tem + phần tử đặt theo mm); `settings` để trống ("{}").
// Mẫu đang áp dụng: ô kênh × phương thức thanh toán ("*" = mọi), ô (*, *) là mặc định; tem chỉ có ô (*, *).
// ----------------------------------------------------------------------

export type PrintTemplateKind = 'receipt' | 'label';

/** Kênh in hoá đơn — cùng bộ mã với core-be (PrintTemplateRules.ReceiptChannels). */
export type PrintChannel = 'pos' | 'fnb' | 'online';

/** Phương thức thanh toán để chọn mẫu (PrintTemplateRules.PaymentMethods). */
export type PrintPaymentMethod = 'cash' | 'transfer' | 'card' | 'wallet' | 'voucher';

export const PRINT_ANY = '*';

export type PrintAny = typeof PRINT_ANY;

export interface IPrintTemplate {
  id: string;
  kind: PrintTemplateKind;
  name: string;
  content: string;
  /** Chuỗi JSON. */
  settings: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface IPrintTemplateAssignment {
  kind: PrintTemplateKind;
  channel: PrintChannel | PrintAny;
  paymentMethod: PrintPaymentMethod | PrintAny;
  templateId: string;
}

export interface IPrintTemplateList {
  templates: IPrintTemplate[];
  assignments: IPrintTemplateAssignment[];
}

export interface IPrintTemplatePayload {
  name: string;
  content: string;
  settings: string;
}

export type IPrintTemplateAssignmentInput = Pick<
  IPrintTemplateAssignment,
  'channel' | 'paymentMethod' | 'templateId'
>;
