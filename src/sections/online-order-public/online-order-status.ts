import type { IStorefrontOrder } from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Câu tình trạng gói / giao cho khách (thuần — test được). Trạng thái chuẩn của spark-shipping: created, picking,
// pickup_failed, in_transit, delivering, delivered, delivery_failed, returning, returned, cancelled, exception.
// ----------------------------------------------------------------------

const SHIPPING_TEXT: Record<string, string> = {
  created: 'Đã giao cho đơn vị vận chuyển, chờ lấy hàng.',
  picking: 'Shipper đang tới lấy hàng.',
  pickup_failed: 'Shipper chưa lấy được hàng — cửa hàng sẽ hẹn lại.',
  in_transit: 'Hàng đang được vận chuyển.',
  delivering: 'Shipper đang giao hàng cho bạn.',
  delivered: 'Đã giao thành công.',
  delivery_failed: 'Giao chưa thành công — shipper sẽ liên hệ lại.',
  returning: 'Đơn đang được hoàn về cửa hàng.',
  returned: 'Đơn đã hoàn về cửa hàng.',
};

export function deliveryStatusText(order: Pick<IStorefrontOrder, 'delivery'>): string {
  const d = order.delivery;
  if (d.method === 'pickup') {
    if (d.shipmentStatus === 'completed') return 'Bạn đã nhận hàng tại cửa hàng.';
    if (d.shipmentStatus === 'packed') return 'Hàng đã gói xong — mời bạn tới cửa hàng nhận.';
    return 'Cửa hàng đang chuẩn bị hàng, sẽ báo khi bạn tới nhận được.';
  }
  if (d.shipmentStatus === 'completed') return SHIPPING_TEXT.delivered;
  if (d.shippingStatus && SHIPPING_TEXT[d.shippingStatus] && d.shipmentStatus === 'shipped') return SHIPPING_TEXT[d.shippingStatus];
  if (d.shipmentStatus === 'packed') return 'Hàng đã gói xong, chờ giao cho đơn vị vận chuyển.';
  if (d.shipmentStatus === 'shipped') return SHIPPING_TEXT.created;
  return 'Cửa hàng đang gói hàng cho bạn.';
}

// ----------------------------------------------------------------------
// Đơn chưa thanh toán: giữ đơn tới hạn (payableUntil, theo cài đặt cửa hàng — mặc định 24 giờ từ lúc đặt), trong hạn tạo lại
// mã được (giá, phí ship tính lại), quá hạn đơn tự huỷ.
// ----------------------------------------------------------------------

/** Còn tạo lại mã / huỷ được: đơn chờ hoặc hết hạn mã, còn trong hạn giữ đơn. */
export function canRepay(order: Pick<IStorefrontOrder, 'status' | 'payableUntil'>, now: number = Date.now()): boolean {
  if (order.status !== 'pending_payment' && order.status !== 'expired') return false;
  if (!order.payableUntil) return true;
  return new Date(order.payableUntil).getTime() > now;
}

const CANCEL_REASON_TEXT: Record<string, string> = {
  'Khách huỷ': 'bạn đã huỷ đơn',
  'Cửa hàng huỷ': 'cửa hàng đã huỷ đơn',
  'Quá hạn thanh toán': 'quá hạn thanh toán',
};

export function cancelledText(reason?: string | null): string {
  const why = reason ? CANCEL_REASON_TEXT[reason] ?? reason.toLowerCase() : null;
  return `Đơn đã huỷ${why ? ` (${why})` : ''}. Muốn mua tiếp, bạn đặt đơn mới. Nếu bạn đã chuyển khoản, cửa hàng sẽ liên hệ lại.`;
}
