import axios, { endpoints } from 'src/utils/axios';
import {
  IPurchaseOrder,
  IPurchaseOrderPagedResponse,
  ICreatePurchaseOrderRequest,
  IUpdatePurchaseOrderRequest,
  IReceivePurchaseOrderRequest,
  IPurchaseOrderCapabilities,
  ICompletePurchaseOrderRequest,
  ICompletePurchaseOrderResponse,
} from 'src/types/corecms-api';
import type { IPurchaseOrderPrint } from 'src/types/purchase-print';

// ----------------------------------------------------------------------

export async function getAllPurchaseOrders(params?: {
  supplierId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
  /** Một trong các trạng thái, cách nhau dấu phẩy ("Completed,Returned"). */
  statuses?: string;
  /** Tìm theo mã phiếu, mã KiotViet, tên NCC, ghi chú (số hoá đơn NCC). */
  keyword?: string;
}): Promise<IPurchaseOrderPagedResponse> {
  const response = await axios.get<IPurchaseOrderPagedResponse>(endpoints.purchaseOrders.list, { params });
  return response.data;
}

/** Phiếu nhập để in (đầu cửa hàng, NCC, dòng hàng, tổng, đã trả / còn nợ) — quyền purchase.read. */
export async function getPurchaseOrderPrint(id: string): Promise<IPurchaseOrderPrint> {
  const response = await axios.get<IPurchaseOrderPrint>(endpoints.purchaseOrders.print(id));
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

/** Màn tạo phiếu hỏi trước: "Hoàn thành" và trả tiền NCC có dùng được không (cửa hàng nối KiotViet, quyền). */
export async function getPurchaseOrderCapabilities(): Promise<IPurchaseOrderCapabilities> {
  const response = await axios.get<IPurchaseOrderCapabilities>(endpoints.purchaseOrders.capabilities);
  return response.data;
}

/** Nút "Hoàn thành": tạo / lấy phiếu tạm → duyệt → nhận đủ hàng → trả NCC (nếu có) trong một lần gọi. */
export async function completePurchaseOrder(
  data: ICompletePurchaseOrderRequest
): Promise<ICompletePurchaseOrderResponse> {
  const response = await axios.post<ICompletePurchaseOrderResponse>(endpoints.purchaseOrders.complete, data);
  return response.data;
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

export async function setPurchaseOrderPaidBy(id: string, paidByShareholderId: string | null): Promise<void> {
  await axios.patch(endpoints.purchaseOrders.paidBy(id), { paidByShareholderId });
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
