import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// "Kết nối S Payment" (chỉ Admin): cửa hàng kết nối với portal S Payment bằng OAuth — chủ cửa hàng quản lý tài khoản
// ngân hàng nhận tiền ngay trên S Payment, POS dùng được luôn. core-be giữ token (mã hoá), trình duyệt không thấy token.
// ----------------------------------------------------------------------

export type SPayConnectStatus = {
  /** SPARK đã bật Kết nối S Payment cho S Store — chưa thì ẩn thẻ. */
  configured: boolean;
  /** connected | disconnected */
  status: string;
  workspaceId: string | null;
  connectedAt: string | null;
  connectedByUserId: string | null;
  accountCount: number | null;
  scopes: string | null;
  portalUrl: string;
  /** Trang Ngân hàng trên portal S Payment (thêm / gỡ tài khoản nhận). */
  banksUrl: string;
  disconnectedAt: string | null;
  /** disconnected_by_store | revoked_in_spay */
  disconnectReason: string | null;
};

export async function getSPayConnectStatus(): Promise<SPayConnectStatus> {
  const res = await axios.get<SPayConnectStatus>(endpoints.spayConnect.status);
  return res.data;
}

/** Bắt đầu kết nối → URL màn đồng ý của S Payment; returnPath = trang quay về sau khi đồng ý (cùng tên miền cửa hàng). */
export async function startSPayConnect(returnPath: string): Promise<string> {
  const res = await axios.post<{ authorizeUrl: string }>(endpoints.spayConnect.connect, { returnPath });
  return res.data.authorizeUrl;
}

export async function disconnectSPay(): Promise<void> {
  await axios.post(endpoints.spayConnect.disconnect);
}

/** Trang Ngân hàng của S Payment — nơi DUY NHẤT thêm / gỡ tài khoản nhận tiền (SPL tự chọn đường kết nối). */
export const SPAY_BANKS_URL = 'https://spay.devbyspark.com/banks';
