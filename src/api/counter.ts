import axios from 'axios';

import axiosInstance from 'src/utils/axios';
import { HOST_API } from 'src/config-global';

import { getCounterDevice } from 'src/sections/counter/counter-device';

import type { IAuthResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Máy quầy trên web (core-be CounterController / CounterDevicesController).
//   - Đặt máy quầy: JWT của chủ cửa hàng / quản lý đang đăng nhập (POST /counter-devices, qua rewrite của Next).
//   - Còn lại: key thiết bị (header X-Kiosk-Key), không JWT. Gọi thẳng /api/counter/* (ingress chuyển tới core-api) —
//     tiền tố "counter" không đưa vào rewrite vì trùng trang /counter của Next.
// Lỗi problem+json: { type: "Counter.InvalidCode", title: "<câu hiển thị>" }.
// ----------------------------------------------------------------------

export type CounterProvisionResult = {
  deviceId: string;
  deviceName: string;
  branchId: string;
  branchName: string;
  deviceKey: string;
};

export type CounterPerson = {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  role: string;
  shiftName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** working | upcoming | ended | manager */
  status: string;
  canSignIn: boolean;
  hasApp: boolean;
  sessionEndsAt?: string | null;
  /** false: ca hôm nay chưa gắn chi nhánh này (cửa hàng nhiều chi nhánh). */
  atThisBranch?: boolean;
};

export type CounterRoster = {
  deviceId: string;
  deviceName: string;
  branchId: string;
  branchName: string;
  people: CounterPerson[];
};

export type CounterLoginRequested = { requestId: string; expiresInSeconds: number; sentToDevices: number };

export type CounterError = { code: string; message: string; status?: number };

export async function provisionCounterDevice(
  branchId: string,
  deviceName: string,
  platform: 'web' | 'android' | 'ios' = 'web'
): Promise<CounterProvisionResult> {
  const res = await axiosInstance.post<CounterProvisionResult>('/counter-devices', { branchId, deviceName, platform });
  return res.data;
}

const counterAxios = axios.create({ baseURL: HOST_API || '/api', timeout: 20_000 });

counterAxios.interceptors.request.use((config) => {
  const device = getCounterDevice();
  if (device) config.headers.set('X-Kiosk-Key', device.deviceKey);
  return config;
});

function fallbackMessage(status: number | undefined): string {
  if (status === 401) return 'Máy quầy đã bị thu hồi — chủ cửa hàng / quản lý đăng nhập lại để đặt máy quầy.';
  if (status === 429) return 'Thao tác quá nhanh — đợi ít phút rồi thử lại.';
  return 'Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.';
}

counterAxios.interceptors.response.use(
  (res) => res,
  (error) => {
    const data = error?.response?.data ?? {};
    const status: number | undefined = error?.response?.status;
    let code = 'Network';
    if (typeof data.type === 'string' && data.type.includes('.')) code = data.type;
    else if (status === 401) code = 'Counter.Unauthorized';
    const err: CounterError = {
      code,
      message: (typeof data.title === 'string' && data.title) || fallbackMessage(status),
      status,
    };
    return Promise.reject(err);
  }
);

export async function getCounterRoster(): Promise<CounterRoster> {
  return (await counterAxios.get<CounterRoster>('/counter/roster')).data;
}

export async function requestCounterLogin(userId: string): Promise<CounterLoginRequested> {
  return (await counterAxios.post<CounterLoginRequested>('/counter/login-requests', { userId })).data;
}

export async function verifyCounterLogin(requestId: string, code: string): Promise<IAuthResponse> {
  const url = `/counter/login-requests/${encodeURIComponent(requestId)}/verify`;
  return (await counterAxios.post<IAuthResponse>(url, { code })).data;
}

export async function counterPasswordLogin(userId: string, password: string): Promise<IAuthResponse> {
  return (await counterAxios.post<IAuthResponse>('/counter/password-login', { userId, password })).data;
}

/** Đổi mã QR đã được duyệt — kèm key máy quầy nên phiên gắn máy, hết ca thì hết. */
export async function exchangeCounterQr(code: string, codeVerifier: string): Promise<IAuthResponse> {
  return (await counterAxios.post<IAuthResponse>('/auth/qr/exchange', { code, codeVerifier })).data;
}

export async function unpairCounter(): Promise<void> {
  await counterAxios.post('/counter/unpair');
}
