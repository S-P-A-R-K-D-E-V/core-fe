import axios, { endpoints } from 'src/utils/axios';
import {
  IPurchaseOrder,
  IPurchaseOrderPagedResponse,
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
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPurchaseOrderPagedResponse> {
  const response = await axios.get<IPurchaseOrderPagedResponse>(endpoints.purchaseOrders.list, { params });
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

// ---- Draft (Redis cache) ----

export async function savePurchaseOrderDraft(data: unknown): Promise<void> {
  await axios.post(endpoints.purchaseOrders.draft, data);
}

export async function getPurchaseOrderDraft(): Promise<unknown | null> {
  const response = await axios.get(endpoints.purchaseOrders.draft, {
    validateStatus: (status) => status === 200 || status === 204,
  });
  if (response.status === 204) return null;
  return response.data;
}

export async function deletePurchaseOrderDraft(): Promise<void> {
  await axios.delete(endpoints.purchaseOrders.draft);
}
