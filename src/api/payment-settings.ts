import axios, { endpoints } from 'src/utils/axios';

import type {
  IBankLink,
  IBankLinkBank,
  IRegisterBankLinkRequest,
  IApiPayLinkResult,
  IApiPayLinkRequest,
  IApiPayBanksResponse,
  IApiPayAvailableBank,
  IApiPayConfirmOtpRequest,
  IPaymentSettings,
  IPaymentQuotaUsage,
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

/**
 * Hạn mức gói ApiPay của kết nối trong chu kỳ hiện tại — ước tính từ giao dịch đã ghi nhận, cộng mọi kết nối cùng tài
 * khoản ApiPay. Kết nối không phải ApiPay → 400 no_quota.
 */
export async function getPaymentConnectionUsage(id: string): Promise<IPaymentQuotaUsage> {
  const res = await axios.get<IPaymentQuotaUsage>(endpoints.paymentSettings.usage(id));
  return res.data;
}

/** Tài khoản ngân hàng của cửa hàng kèm kết nối đối soát của từng tài khoản + kết nối chưa gắn tài khoản. */
export async function getPaymentBankAccounts(): Promise<IPaymentBankAccountsResponse> {
  const res = await axios.get<IPaymentBankAccountsResponse>(endpoints.paymentSettings.bankAccounts);
  return res.data;
}

// ---------------------------------------------------------------------- Liên kết ngân hàng qua ApiPay

/** Ngân hàng ApiPay cho liên kết (danh mục sống của ApiPay). */
export async function getApiPayAvailableBanks(
  connectionId: string
): Promise<IApiPayAvailableBank[]> {
  const res = await axios.get<IApiPayAvailableBank[]>(
    endpoints.paymentSettings.apipayAvailableBanks(connectionId)
  );
  return res.data;
}

/** Tài khoản đã liên kết; tài khoản chờ kích hoạt mà đã xong thì máy chủ tự gắn vào kết nối (applied). */
export async function getApiPayLinkedBanks(connectionId: string): Promise<IApiPayBanksResponse> {
  const res = await axios.get<IApiPayBanksResponse>(
    endpoints.paymentSettings.apipayBanks(connectionId)
  );
  return res.data;
}

/** Gửi liên kết → active | otp_required | pending_activation. SĐT / CCCD không được lưu ở máy chủ. */
export async function linkApiPayBank(
  connectionId: string,
  data: IApiPayLinkRequest
): Promise<IApiPayLinkResult> {
  const res = await axios.post<IApiPayLinkResult>(
    endpoints.paymentSettings.apipayBanks(connectionId),
    data
  );
  return res.data;
}

export async function confirmApiPayBankOtp(
  connectionId: string,
  data: IApiPayConfirmOtpRequest
): Promise<IApiPayLinkResult> {
  const res = await axios.post<IApiPayLinkResult>(
    endpoints.paymentSettings.apipayConfirmOtp(connectionId),
    data
  );
  return res.data;
}

// ---- Đăng ký báo có qua S Payment (kiểu KiotViet) ----

export async function getBankLinkBanks(): Promise<IBankLinkBank[]> {
  const res = await axios.get<IBankLinkBank[]>(endpoints.paymentSettings.bankLinkBanks);
  return res.data;
}

export async function getBankLinks(): Promise<IBankLink[]> {
  const res = await axios.get<IBankLink[]>(endpoints.paymentSettings.bankLinks);
  return res.data;
}

/** → otp_required (ngân hàng gửi OTP tới SĐT chủ TK). Gửi lại OTP = gọi lại hàm này. */
export async function registerBankLink(data: IRegisterBankLinkRequest): Promise<IBankLink> {
  const res = await axios.post<IBankLink>(endpoints.paymentSettings.bankLinks, data);
  return res.data;
}

/** OTP cho bước đang chờ: đăng ký → active, huỷ → revoked. */
export async function confirmBankLink(id: string, otp: string): Promise<IBankLink> {
  const res = await axios.post<IBankLink>(endpoints.paymentSettings.bankLinkConfirm(id), { otp });
  return res.data;
}

/** Huỷ đăng ký: ngân hàng đòi lại CCCD/MST + SĐT rồi gửi OTP (→ revoking). */
export async function revokeBankLink(
  id: string,
  data: { identity: string; mobile: string }
): Promise<IBankLink> {
  const res = await axios.post<IBankLink>(endpoints.paymentSettings.bankLinkRevoke(id), data);
  return res.data;
}

export async function cancelBankLinkRevoke(id: string): Promise<IBankLink> {
  const res = await axios.post<IBankLink>(endpoints.paymentSettings.bankLinkCancelRevoke(id));
  return res.data;
}

/** Dùng tài khoản đã liên kết (vd từ my.apipay.vn) làm tài khoản nhận của kết nối. */
export async function selectApiPayBank(
  connectionId: string,
  publicId: string
): Promise<IApiPayLinkResult> {
  const res = await axios.post<IApiPayLinkResult>(
    endpoints.paymentSettings.apipayUseBank(connectionId, publicId)
  );
  return res.data;
}
