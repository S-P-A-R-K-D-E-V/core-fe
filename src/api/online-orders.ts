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
