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
