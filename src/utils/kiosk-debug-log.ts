// ----------------------------------------------------------------------
// Debug log tạm cho màn kiosk — xem trực tiếp trên màn hình qua nút "Xem log debug" (kiosk-
// checkin-view), không cần DevTools. Cần thiết vì kiosk thường chạy trên điện thoại/tablet gắn
// cố định, không có cách mở Console để soi lý do SignalR reconnect liên tục.

export type KioskDebugEntry = { ts: string; msg: string };
export const kioskDebugLog: KioskDebugEntry[] = [];

export function pushKioskDebugLog(msg: string) {
  kioskDebugLog.push({ ts: new Date().toISOString(), msg });
  if (kioskDebugLog.length > 300) kioskDebugLog.shift();
  // eslint-disable-next-line no-console
  console.log(`[kiosk] ${msg}`);
}

export function clearKioskDebugLog() {
  kioskDebugLog.length = 0;
}
