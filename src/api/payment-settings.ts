import axios, { endpoints } from 'src/utils/axios';

import type {
  IPaymentSettings,
  IPaymentConnection,
  IPaymentProviderInfo,
  IPaymentConnectionSyncResult,
  IPaymentBankAccountsResponse,
  IPaymentConnectionTestResult,
  ICreatePaymentConnectionRequest,
  IUpdatePaymentConnectionRequest,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Cài đặt thanh toán (chỉ Admin): kết nối SePay/Casso/payOS/VNPay/ngân hàng trực tiếp. Máy chủ không bao giờ trả lại
// khoá đã lưu — chỉ generatedSecrets (khoá hệ thống tự sinh) ở lần tạo / tạo lại khoá, hiện MỘT lần.
// ----------------------------------------------------------------------

export async function getPaymentSettings(): Promise<IPaymentSettings> {
  const res = await axios.get<IPaymentSettings>(endpoints.paymentSettings.root);
  return res.data;
}

/** Danh mục nhà cung cấp để dựng form kết nối (nhãn, khoá credentials, hướng dẫn). */
export async function getPaymentProviders(): Promise<IPaymentProviderInfo[]> {
  const res = await axios.get<IPaymentProviderInfo[]>(endpoints.paymentSettings.providers);
  return res.data;
}

export async function getPaymentConnections(): Promise<IPaymentConnection[]> {
  const res = await axios.get<IPaymentConnection[]>(endpoints.paymentSettings.connections);
  return res.data;
}

/** Tạo kết nối → kèm webhookUrls và generatedSecrets (hiện một lần). */
export async function createPaymentConnection(
  data: ICreatePaymentConnectionRequest
): Promise<IPaymentConnection> {
  const res = await axios.post<IPaymentConnection>(endpoints.paymentSettings.connections, data);
  return res.data;
}

/** Cập nhật kết nối: credentials chỉ gồm ô có nhập (ô trống = giữ nguyên), gắn tài khoản nhận, bật lại. */
export async function updatePaymentConnection(
  id: string,
  data: IUpdatePaymentConnectionRequest
): Promise<IPaymentConnection> {
  const res = await axios.put<IPaymentConnection>(endpoints.paymentSettings.connection(id), data);
  return res.data;
}

/** Tắt kết nối. */
export async function deletePaymentConnection(id: string): Promise<void> {
  await axios.delete(endpoints.paymentSettings.connection(id));
}

/** Kéo giao dịch ngay (SePay/Casso). */
export async function syncPaymentConnection(id: string): Promise<IPaymentConnectionSyncResult> {
  const res = await axios.post<IPaymentConnectionSyncResult>(endpoints.paymentSettings.sync(id));
  return res.data;
}

/** Kiểm tra kết nối ngân hàng trực tiếp (lấy token ngân hàng). */
export async function testPaymentConnection(id: string): Promise<IPaymentConnectionTestResult> {
  const res = await axios.post<IPaymentConnectionTestResult>(endpoints.paymentSettings.test(id));
  return res.data;
}

/** Sinh lại khoá webhook (ngân hàng trực tiếp) — khoá cũ hết hiệu lực, khoá mới trả về MỘT lần. */
export async function rotatePaymentWebhookSecret(id: string): Promise<IPaymentConnection> {
  const res = await axios.post<IPaymentConnection>(
    endpoints.paymentSettings.rotateWebhookSecret(id)
  );
  return res.data;
}

/** Tài khoản ngân hàng của cửa hàng kèm kết nối đối soát của từng tài khoản + kết nối chưa gắn tài khoản. */
export async function getPaymentBankAccounts(): Promise<IPaymentBankAccountsResponse> {
  const res = await axios.get<IPaymentBankAccountsResponse>(endpoints.paymentSettings.bankAccounts);
  return res.data;
}
