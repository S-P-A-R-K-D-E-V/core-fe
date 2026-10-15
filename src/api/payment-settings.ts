import axios, { endpoints } from 'src/utils/axios';

import type {
  IPaymentSettings,
  IPaymentConnection,
  IPaymentConnectionSyncResult,
  ICreatePaymentConnectionRequest,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Cài đặt thanh toán (chỉ Admin): kết nối SePay/Casso/payOS/VNPay. Máy chủ không bao giờ trả lại khoá đã lưu.
// ----------------------------------------------------------------------

export async function getPaymentSettings(): Promise<IPaymentSettings> {
  const res = await axios.get<IPaymentSettings>(endpoints.paymentSettings.root);
  return res.data;
}

export async function getPaymentConnections(): Promise<IPaymentConnection[]> {
  const res = await axios.get<IPaymentConnection[]>(endpoints.paymentSettings.connections);
  return res.data;
}

export async function createPaymentConnection(data: ICreatePaymentConnectionRequest): Promise<IPaymentConnection> {
  const res = await axios.post<IPaymentConnection>(endpoints.paymentSettings.connections, data);
  return res.data;
}

export async function deletePaymentConnection(id: string): Promise<void> {
  await axios.delete(endpoints.paymentSettings.connection(id));
}

/** Kéo giao dịch ngay (SePay/Casso). */
export async function syncPaymentConnection(id: string): Promise<IPaymentConnectionSyncResult> {
  const res = await axios.post<IPaymentConnectionSyncResult>(endpoints.paymentSettings.sync(id));
  return res.data;
}
