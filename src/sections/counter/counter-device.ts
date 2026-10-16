'use client';

import { useSyncExternalStore } from 'react';

// ----------------------------------------------------------------------
// Trình duyệt này là máy quầy (POST /counter-devices, chủ cửa hàng / quản lý đặt ở Cài đặt cửa hàng). Key thiết bị
// giữ trong localStorage — đóng trình duyệt vẫn còn; mở trang là màn chọn nhân viên có ca (/counter). Ai đăng nhập ở
// đây cũng chỉ có bán hàng (server chặn phần còn lại — CounterScopeMiddleware).
// ----------------------------------------------------------------------

const STORAGE_KEY = 'counterDevice';
const EVENT = 'counter-device-changed';

export type CounterDevice = {
  deviceId: string;
  deviceName: string;
  branchId: string;
  branchName: string;
  /** Key thiết bị (header X-Kiosk-Key) — chỉ dùng cho /counter/*. */
  deviceKey: string;
  /** Máy quầy thuộc cửa hàng (host) nào — mở trang ở cửa hàng khác thì không dùng. */
  host: string;
};

function read(raw: string | null): CounterDevice | null {
  if (!raw) return null;
  try {
    const device = JSON.parse(raw) as CounterDevice;
    return device.deviceKey && device.host === window.location.host ? device : null;
  } catch {
    return null;
  }
}

let cachedRaw: string | null | undefined;
let cached: CounterDevice | null = null;

export function getCounterDevice(): CounterDevice | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = read(raw);
  }
  return cached;
}

export function saveCounterDevice(device: Omit<CounterDevice, 'host'>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...device, host: window.location.host }));
  window.dispatchEvent(new Event(EVENT));
}

export function clearCounterDevice(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Máy quầy đã đặt trên trình duyệt này (null = trình duyệt thường). */
export function useCounterDevice(): CounterDevice | null {
  return useSyncExternalStore(subscribe, getCounterDevice, () => null);
}

// ── Phiên đang đăng nhập có phải phiên máy quầy (token mang claim counter_device) ──

export const COUNTER_DEVICE_CLAIM = 'counter_device';

function payloadOf(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(window.atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function counterDeviceOfToken(token: string | null | undefined): string | null {
  const value = payloadOf(token)?.[COUNTER_DEVICE_CLAIM];
  return typeof value === 'string' ? value : null;
}

export function tokenExpiresAt(token: string | null | undefined): number | null {
  const exp = payloadOf(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}
