import axios, { endpoints } from 'src/utils/axios';

import type {
  IKioskConfirmResponse,
  IKioskPairingRequest,
  IKioskPairingStatusResponse,
  IKioskClaimResponse,
  IKioskDeviceItem,
} from 'src/types/kiosk';

// Auth qua header X-Kiosk-Key (KioskAuthenticationHandler.HeaderName phía Core-be) —
// KHÔNG dùng JWT, nên gắn header trực tiếp vào request thay vì Authorization mặc định.

export async function confirmKioskCheckIn(
  staffId: string,
  deviceKey: string
): Promise<IKioskConfirmResponse> {
  const res = await axios.post<IKioskConfirmResponse>(
    endpoints.kiosk.confirmCheckIn,
    { staffId },
    { headers: { 'X-Kiosk-Key': deviceKey } }
  );
  return res.data;
}

export async function confirmKioskCheckOut(
  staffId: string,
  deviceKey: string
): Promise<IKioskConfirmResponse> {
  const res = await axios.post<IKioskConfirmResponse>(
    endpoints.kiosk.confirmCheckOut,
    { staffId },
    { headers: { 'X-Kiosk-Key': deviceKey } }
  );
  return res.data;
}

// ── Ghép nối thiết bị — thay cho seed tay KioskDevice qua DB (KioskPairingController) ──

/** Anonymous — màn kiosk (chưa có key) xin 1 mã ghép nối mới. */
export async function requestKioskPairing(): Promise<IKioskPairingRequest> {
  const res = await axios.post<IKioskPairingRequest>(endpoints.kiosk.pairingRequest);
  return res.data;
}

/** Anonymous — màn kiosk poll trạng thái ghép nối định kỳ, PairingId (GUID) đóng vai trò bí mật tạm thời. */
export async function getKioskPairingStatus(pairingId: string): Promise<IKioskPairingStatusResponse> {
  const res = await axios.get<IKioskPairingStatusResponse>(endpoints.kiosk.pairingStatus(pairingId));
  return res.data;
}

/** Yêu cầu JWT Admin/Manager — xác nhận mã 6 số hiển thị trên màn kiosk (gõ tay hoặc app đọc
 *  từ QR) để tạo KioskDevice thật. */
export async function claimKioskPairing(
  code: string,
  deviceName: string,
  branchId: string
): Promise<IKioskClaimResponse> {
  const res = await axios.post<IKioskClaimResponse>(endpoints.kiosk.pairingClaim, {
    code,
    deviceName,
    branchId,
  });
  return res.data;
}

/** Yêu cầu JWT Admin/Manager — danh sách thiết bị kiosk (kể cả đã thu hồi) cho trang quản trị. */
export async function getKioskDevices(): Promise<IKioskDeviceItem[]> {
  const res = await axios.get<IKioskDeviceItem[]>(endpoints.kiosk.devices);
  return res.data;
}

/** Yêu cầu JWT Admin/Manager — vô hiệu hoá 1 thiết bị (mất quyền xác thực X-Kiosk-Key ngay). */
export async function revokeKioskDevice(deviceId: string): Promise<void> {
  await axios.post(endpoints.kiosk.deviceRevoke(deviceId));
}
