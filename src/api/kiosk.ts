import axios, { endpoints } from 'src/utils/axios';

import type { IKioskConfirmResponse } from 'src/types/kiosk';

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
