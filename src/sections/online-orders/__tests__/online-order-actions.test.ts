import { describe, expect, it } from 'vitest';

import type { IOnlineOrder, OnlineShipmentStatus } from 'src/types/payment-service';

import { onlineOrderActions } from '../online-order-actions';
import { deliveryStatusText } from '../../online-order-public/online-order-status';

// ----------------------------------------------------------------------
// Đơn online: nút thao tác khớp quy tắc máy chủ (gói → vận đơn / khách nhận; huỷ chỉ chủ + quản lý) và câu tình trạng
// hiện cho khách.
// ----------------------------------------------------------------------

const order = (
  status: IOnlineOrder['status'],
  method: 'ship' | 'pickup',
  shipmentStatus: OnlineShipmentStatus,
  shipmentId: string | null = null
): IOnlineOrder =>
  ({
    id: '1',
    code: 'W2345678A',
    customerName: 'A',
    phone: '0912345678',
    total: 262_000,
    status,
    paymentMethod: 'bank_transfer',
    createdAt: '2026-10-23T05:00:00Z',
    shipping: { method, shipmentStatus, shipmentId },
  }) as IOnlineOrder;

describe('onlineOrderActions', () => {
  it('đơn giao tận nơi: gói → tạo vận đơn → khách nhận; huỷ vận đơn chỉ quản lý', () => {
    expect(onlineOrderActions(order('paid', 'ship', 'to_pack'), false)).toMatchObject({ pack: true, ship: true, complete: false });
    expect(onlineOrderActions(order('paid', 'ship', 'packed'), false)).toMatchObject({ pack: false, ship: true });
    const shipped = order('paid', 'ship', 'shipped', 's1');
    expect(onlineOrderActions(shipped, false)).toMatchObject({ ship: false, complete: true, cancelShipment: false });
    expect(onlineOrderActions(shipped, true).cancelShipment).toBe(true);
  });

  it('nhận tại cửa hàng: không có vận đơn, bấm khách đã nhận', () => {
    expect(onlineOrderActions(order('paid', 'pickup', 'packed'), false)).toMatchObject({ ship: false, complete: true });
    expect(onlineOrderActions(order('paid', 'pickup', 'completed'), false).complete).toBe(false);
  });

  it('chưa thanh toán: chỉ quản lý huỷ được', () => {
    expect(onlineOrderActions(order('pending_payment', 'ship', 'to_pack'), false)).toEqual({
      pack: false, ship: false, complete: false, cancel: false, cancelShipment: false,
    });
    expect(onlineOrderActions(order('expired', 'ship', 'to_pack'), true).cancel).toBe(true);
  });

  it('câu tình trạng cho khách theo khâu gói / giao', () => {
    expect(deliveryStatusText({ delivery: { method: 'pickup', shipmentStatus: 'packed' } })).toContain('tới cửa hàng nhận');
    expect(deliveryStatusText({ delivery: { method: 'ship', shipmentStatus: 'to_pack' } })).toContain('đang gói');
    expect(deliveryStatusText({ delivery: { method: 'ship', shipmentStatus: 'shipped', shippingStatus: 'delivering' } })).toContain('đang giao');
    expect(deliveryStatusText({ delivery: { method: 'ship', shipmentStatus: 'completed' } })).toContain('thành công');
  });
});
