import type { IOnlineOrder } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Việc làm tiếp được với một đơn online (thuần — test được), khớp quy tắc của Core-be (OnlineOrderShippingHandler):
//   - gói: đơn đã thanh toán, chưa gói
//   - tạo vận đơn: đã thanh toán, giao tận nơi, chưa có vận đơn
//   - khách đã nhận: đã thanh toán, chưa xong (nhận tại cửa hàng, hoặc xác nhận tay khi hãng chưa báo)
//   - huỷ đơn: chờ thanh toán / hết hạn (chủ + quản lý); huỷ vận đơn: có vận đơn chưa xong (chủ + quản lý)
// ----------------------------------------------------------------------

export type OnlineOrderActions = {
  pack: boolean;
  ship: boolean;
  complete: boolean;
  cancel: boolean;
  cancelShipment: boolean;
};

export function onlineOrderActions(order: IOnlineOrder, manager: boolean): OnlineOrderActions {
  const paid = order.status === 'paid';
  const shipment = order.shipping?.shipmentStatus ?? 'to_pack';
  const ship = order.shipping?.method === 'ship';
  const hasShipment = !!order.shipping?.shipmentId;
  return {
    pack: paid && shipment === 'to_pack',
    ship: paid && ship && !hasShipment && shipment !== 'completed',
    complete: paid && shipment !== 'completed' && (!ship || hasShipment),
    cancel: manager && (order.status === 'pending_payment' || order.status === 'expired'),
    cancelShipment: manager && paid && hasShipment && shipment !== 'completed',
  };
}
