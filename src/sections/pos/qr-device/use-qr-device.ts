import { useEffect, useSyncExternalStore } from 'react';

import { qrDevice, type QrDeviceSnapshot } from './qr-device-manager';
import { DEFAULT_QR_DEVICE_SETTINGS } from './qr-device-settings';

const SERVER_SNAPSHOT: QrDeviceSnapshot = {
  status: 'disconnected',
  error: null,
  settings: DEFAULT_QR_DEVICE_SETTINGS,
  port: null,
  log: [],
};

/** Trạng thái máy QR (cập nhật khi kết nối / gửi lệnh). Tự gắn máy vào màn khách + nối lại cổng đã chọn. */
export function useQrDevice(): QrDeviceSnapshot {
  useEffect(() => {
    qrDevice.attach();
  }, []);
  return useSyncExternalStore(qrDevice.subscribe, qrDevice.getSnapshot, () => SERVER_SNAPSHOT);
}
