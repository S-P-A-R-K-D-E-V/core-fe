import axios, { endpoints } from 'src/utils/axios';
import {
  IPurchaseOrder,
  ICreatePurchaseOrderRequest,
  IUpdatePurchaseOrderRequest,
  IReceivePurchaseOrderRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllPurchaseOrders(params?: {
  supplierId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<IPurchaseOrder[]> {
  const response = await axios.get<IPurchaseOrder[]>(endpoints.purchaseOrders.list, { params });
  return response.data;
}

export async function getPurchaseOrderById(id: string): Promise<IPurchaseOrder> {
  const response = await axios.get<IPurchaseOrder>(endpoints.purchaseOrders.details(id));
  return response.data;
}

export async function createPurchaseOrder(data: ICreatePurchaseOrderRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.purchaseOrders.create, data);
  return response.data;
}

export async function updatePurchaseOrder(id: string, data: IUpdatePurchaseOrderRequest): Promise<void> {
  await axios.put(endpoints.purchaseOrders.update(id), data);
}

export async function confirmPurchaseOrder(id: string): Promise<void> {
  await axios.post(endpoints.purchaseOrders.confirm(id));
}

export async function receivePurchaseOrder(id: string, data: IReceivePurchaseOrderRequest): Promise<void> {
  await axios.post(endpoints.purchaseOrders.receive(id), data);
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  await axios.post(endpoints.purchaseOrders.cancel(id));
}
