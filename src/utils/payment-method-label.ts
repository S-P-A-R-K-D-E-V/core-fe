// ----------------------------------------------------------------------
// KiotViet trả Method dưới dạng chuỗi tự do (merchant có thể thêm phương thức mới trong
// KiotViet POS bất kỳ lúc nào) — đây chỉ là bản dịch cho các giá trị THƯỜNG GẶP, không phải
// enum đầy đủ. Giá trị không có trong map vẫn hiển thị nguyên bản (an toàn, không mất thông tin).
// ----------------------------------------------------------------------

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  Cash: 'Tiền mặt',
  Transfer: 'Chuyển khoản',
  Card: 'Thẻ',
  Wallet: 'Ví điện tử',
  MoMo: 'Ví MoMo',
  ZaloPay: 'Ví ZaloPay',
  VNPay: 'VNPay',
  Points: 'Điểm tích lũy',
};

export function fPaymentMethod(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

export { PAYMENT_METHOD_LABEL };
