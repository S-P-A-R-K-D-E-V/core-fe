import axios, { endpoints } from 'src/utils/axios';
import {
  ISalesOrder,
  ICreateSalesOrderRequest,
  IAddPaymentRequest,
} from 'src/types/corecms-api';

export async function getAllSalesOrders(params?: {
  keyword?: string;
  customerId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ISalesOrder[]> {
  const response = await axios.get<ISalesOrder[]>(endpoints.salesOrders.list, { params });
  return response.data;
}

export async function getSalesOrderById(id: string): Promise<ISalesOrder> {
  const response = await axios.get<ISalesOrder>(endpoints.salesOrders.details(id));
  return response.data;
}

export async function createSalesOrder(data: ICreateSalesOrderRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.salesOrders.create, data);
  return response.data;
}

export async function cancelSalesOrder(id: string): Promise<void> {
  await axios.post(endpoints.salesOrders.cancel(id));
}

export async function addPayment(id: string, data: IAddPaymentRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.salesOrders.payment(id), data);
  return response.data;
}
