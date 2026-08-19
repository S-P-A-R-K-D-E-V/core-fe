'use client';

import { useCallback, useState } from 'react';

// Key được cấp qua luồng ghép nối (KioskPairingController — xem kiosk-pairing-setup.tsx),
// lưu vào localStorage của trình duyệt kiosk, chỉ cần ghép nối 1 lần.
const STORAGE_KEY = 'kioskDeviceKey';

export function useKioskDevice() {
  const [deviceKey, setDeviceKeyState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  );

  const setDeviceKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setDeviceKeyState(key);
  }, []);

  const clearDeviceKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDeviceKeyState(null);
  }, []);

  return { deviceKey, setDeviceKey, clearDeviceKey };
}
