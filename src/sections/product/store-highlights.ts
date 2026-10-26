// ----------------------------------------------------------------------
// Các ô cam kết dưới ảnh sản phẩm (trang /product/[id]) — dựng theo dữ liệu của chính cửa hàng đang mở (địa chỉ, kênh
// nhắn tin, cách thanh toán online đang bật). Thiếu dữ liệu thì bỏ ô đó, không viết cứng địa chỉ hay ví của cửa hàng nào.
// ----------------------------------------------------------------------

export type StoreHighlight = {
  title: string;
  description: string;
  icon: string;
};

export type StoreHighlightInput = {
  /** Địa chỉ cửa hàng (branding.address). */
  address?: string | null;
  /** Có kênh nhắn tin / gọi (Messenger, Zalo, số điện thoại). */
  canMessage?: boolean;
  /** Phương thức thanh toán online đang bật (checkout-config.payments[].method). */
  paymentMethods?: string[];
};

const PAYMENT_TEXT: Record<string, string> = {
  bank_transfer: 'chuyển khoản ngân hàng (VietQR)',
  payos: 'quét mã / ví qua payOS',
  vnpay: 'thẻ ATM, Visa/Master, ví (VNPay)',
};

/** "a", "a hoặc b", "a, b hoặc c". */
function joinOr(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} hoặc ${parts[parts.length - 1]}`;
}

export function storeHighlights({
  address,
  canMessage,
  paymentMethods,
}: StoreHighlightInput): StoreHighlight[] {
  const items: StoreHighlight[] = [
    {
      title: 'Hàng kiểm định kỹ',
      description: 'Mỗi sản phẩm được kiểm tra chất lượng kỹ lưỡng trước khi đến tay bạn.',
      icon: 'solar:verified-check-bold',
    },
  ];

  const where = address?.trim();
  if (where || canMessage) {
    items.push({
      title: 'Tư vấn miễn phí',
      description: where
        ? `Ghé cửa hàng tại ${where}${canMessage ? ' hoặc nhắn tin' : ''} để được tư vấn trực tiếp.`
        : 'Nhắn tin cho cửa hàng để được tư vấn trực tiếp.',
      icon: 'solar:chat-round-dots-bold',
    });
  }

  const payments = Array.from(new Set(paymentMethods ?? []))
    .map((m) => PAYMENT_TEXT[m])
    .filter(Boolean);
  if (payments.length) {
    items.push({
      title: 'Thanh toán online',
      description: `Đặt hàng ngay trên trang, thanh toán bằng ${joinOr(payments)}.`,
      icon: 'solar:wallet-bold',
    });
  }

  return items;
}
