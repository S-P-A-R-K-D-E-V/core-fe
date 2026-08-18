'use client';

import { useCallback, useState } from 'react';

// Core-be chưa có endpoint tạo/lấy KioskDevice key (phải seed tay qua DB) — kiosk lưu
// key nhập tay 1 lần vào localStorage, không có luồng cấp phát tự động.
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
