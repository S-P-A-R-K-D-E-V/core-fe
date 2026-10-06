import axios, { endpoints } from 'src/utils/axios';
import {
  ISalesOrder,
  ISalesOrderReceipt,
  ISalesOrderPagedResponse,
  ICreateSalesOrderRequest,
  ICreateSalesOrderResponse,
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
  bankAccountId?: string; // Guid của KiotVietBankAccount
  pageNumber?: number;
  pageSize?: number;
}

export async function getAllSalesOrders(
  params?: ISalesOrdersQueryParams
): Promise<ISalesOrderPagedResponse> {
  const response = await axios.get<ISalesOrderPagedResponse>(endpoints.salesOrders.list, {
    params,
  });
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

/** Tạo hoá đơn. kiotVietSyncStatus trả về cho biết hoá đơn có được xếp hàng đẩy sang KiotViet không. */
export async function createSalesOrder(
  data: ICreateSalesOrderRequest
): Promise<ICreateSalesOrderResponse> {
  const response = await axios.post<ICreateSalesOrderResponse>(endpoints.salesOrders.create, data);
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

/** Báo cho người dùng khi core-be chưa có GET /sales-orders/{id}/receipt (bản cũ). */
export const RECEIPT_UNSUPPORTED_MESSAGE = 'Máy chủ chưa hỗ trợ in hoá đơn';

const RECEIPT_NOT_FOUND_MESSAGE =
  'Không tìm thấy hoá đơn này. Nhân viên chỉ in được hoá đơn do chính mình tạo trong ngày.';

// 404 của chính endpoint là Problem có `title` riêng ("Đơn bán hàng không tồn tại.", "Tenant not found.").
// 404 vì core-be cũ chưa có route: body rỗng, trang HTML của proxy, hoặc Problem chung "Not Found".
function receipt404Message(body: unknown): string {
  const title = body && typeof body === 'object' ? (body as { title?: unknown }).title : null;
  const text = typeof title === 'string' ? title.trim() : '';
  if (!text || /^not found\.?$/i.test(text)) return RECEIPT_UNSUPPORTED_MESSAGE;
  return text.startsWith('Đơn bán hàng không tồn tại') ? RECEIPT_NOT_FOUND_MESSAGE : text;
}

const isReceipt = (data: unknown): data is ISalesOrderReceipt => {
  const receipt = data as Partial<ISalesOrderReceipt> | null;
  return (
    !!receipt &&
    typeof receipt === 'object' &&
    !!receipt.invoice &&
    !!receipt.store &&
    !!receipt.totals &&
    Array.isArray(receipt.lines)
  );
};

/**
 * Dữ liệu để in "PHIẾU THANH TOÁN" của một hoá đơn. Chỉ đọc — không tạo lệnh QR hay thanh toán nào.
 * `bankAccountId` (id của GET /bank-accounts): tài khoản nhận cho mã QR chuyển khoản; bỏ trống để
 * core-be tự quyết định (transferQr có thể là null — xem ReceiptPrintDialog).
 *
 * Lỗi 404 được đổi thành Error có câu tiếng Việt: interceptor của axios chỉ giữ lại body, mà 404 của
 * core-be cũ không có body, nên ở đây tự nhận 404 thay vì để interceptor xử lý. Các lỗi khác (400, 403…)
 * vẫn reject bằng body như mọi lời gọi khác — đọc bằng apiErrorMessage().
 */
export async function getSalesOrderReceipt(
  id: string,
  bankAccountId?: string | null
): Promise<ISalesOrderReceipt> {
  const response = await axios.get<ISalesOrderReceipt>(endpoints.salesOrders.receipt(id), {
    params: bankAccountId ? { bankAccountId } : undefined,
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
  });
  if (response.status === 404) throw new Error(receipt404Message(response.data));
  // 2xx nhưng không phải phiếu (vd. proxy trả trang HTML) → coi như máy chủ chưa hỗ trợ
  if (!isReceipt(response.data)) throw new Error(RECEIPT_UNSUPPORTED_MESSAGE);
  return response.data;
}

/**
 * Đẩy lại đơn bán lên KiotViet — chỉ đơn ở trạng thái Failed. Core-be từ chối bằng
 * { message, code, title, errorCodes }: 409 KiotVietSalesOrder.PushDisabled khi cửa hàng không đẩy hoá đơn,
 * 400 với các trạng thái khác (xem kiotVietRetryError ở src/utils/kiotviet-sync-status).
 */
export async function retryPushSalesOrder(id: string): Promise<{ jobId: string }> {
  const response = await axios.post<{ jobId: string }>(endpoints.kiotViet.pushRetry(id));
  return response.data;
}
