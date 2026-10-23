import axios, { endpoints } from 'src/utils/axios';

import type { IPagedItems, IOnlineOrder, IOnlineOrderQuery } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Đơn online từ storefront (Admin, Manager). Đơn chỉ sinh hoá đơn (và trừ kho) khi đã thanh toán.
// ----------------------------------------------------------------------

export async function getOnlineOrders(params: IOnlineOrderQuery): Promise<IPagedItems<IOnlineOrder>> {
  const res = await axios.get<IPagedItems<IOnlineOrder>>(endpoints.onlineOrders.list, { params });
  return res.data;
}

export async function getOnlineOrder(id: string): Promise<IOnlineOrder> {
  const res = await axios.get<IOnlineOrder>(endpoints.onlineOrders.details(id));
  return res.data;
}

export async function cancelOnlineOrder(id: string): Promise<IOnlineOrder> {
  const res = await axios.post<IOnlineOrder>(endpoints.onlineOrders.cancel(id));
  return res.data;
}

/** Đã gói xong (ghi người gói). Mọi nhân viên. */
export async function packOnlineOrder(id: string): Promise<IOnlineOrder> {
  const res = await axios.post<IOnlineOrder>(endpoints.onlineOrders.pack(id));
  return res.data;
}

/** Tạo vận đơn ở hãng theo báo giá lúc khách đặt — phát sinh cước thật (trừ vào tài khoản hãng của cửa hàng). */
export async function shipOnlineOrder(id: string, data?: { connectionId?: string | null; note?: string | null }): Promise<IOnlineOrder> {
  const res = await axios.post<IOnlineOrder>(endpoints.onlineOrders.ship(id), data ?? {});
  return res.data;
}

/** Khách đã nhận (nhận tại cửa hàng / xác nhận tay). */
export async function completeOnlineOrder(id: string): Promise<IOnlineOrder> {
  const res = await axios.post<IOnlineOrder>(endpoints.onlineOrders.complete(id));
  return res.data;
}

/** Huỷ vận đơn (chủ + quản lý) — chỉ khi hãng chưa lấy hàng. */
export async function cancelOnlineOrderShipment(id: string): Promise<IOnlineOrder> {
  const res = await axios.post<IOnlineOrder>(endpoints.onlineOrders.cancelShipment(id));
  return res.data;
}
