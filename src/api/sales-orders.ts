import axios, { endpoints } from 'src/utils/axios';
import {
  ISalesOrder,
  ICreateSalesOrderRequest,
  IAddPaymentRequest,
  IUpdateSalesOrderRequest,
} from 'src/types/corecms-api';

export interface ISalesOrdersQueryParams {
  keyword?: string;
  customerId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  paymentMethod?: string; // "Cash" | "Transfer" | "Card" | ...
  bankAccountId?: number;
}

export async function getAllSalesOrders(params?: ISalesOrdersQueryParams): Promise<ISalesOrder[]> {
  const response = await axios.get<ISalesOrder[]>(endpoints.salesOrders.list, { params });
  return response.data;
}

/**
 * Tải file Excel báo cáo hóa đơn theo filter. Trigger browser download.
 */
export async function exportSalesOrdersExcel(params?: ISalesOrdersQueryParams): Promise<void> {
  const response = await axios.get(endpoints.salesOrders.exportExcel, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const from = params?.fromDate ?? 'all';
  const to = params?.toDate ?? 'all';
  link.download = `HoaDon_${from}_${to}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getSalesOrderById(id: string): Promise<ISalesOrder> {
  const response = await axios.get<ISalesOrder>(endpoints.salesOrders.details(id));
  return response.data;
}

export async function createSalesOrder(data: ICreateSalesOrderRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.salesOrders.create, data);
  return response.data;
}

export async function updateSalesOrder(
  id: string,
  data: IUpdateSalesOrderRequest
): Promise<void> {
  await axios.put(endpoints.salesOrders.update(id), data);
}

export async function cancelSalesOrder(id: string): Promise<void> {
  await axios.post(endpoints.salesOrders.cancel(id));
}

export async function addPayment(id: string, data: IAddPaymentRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.salesOrders.payment(id), data);
  return response.data;
}
