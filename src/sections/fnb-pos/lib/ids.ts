// ----------------------------------------------------------------------
// Mã do máy sinh cho F&B (hợp đồng 1.5): id đơn, id dòng, id phiếu bar, clientRequestId, deviceId — uuid chữ thường.
// deviceId của trình duyệt sinh một lần và giữ trong localStorage (riêng cho từng trình duyệt / máy).
// ----------------------------------------------------------------------

const DEVICE_KEY = 'fnb.deviceId';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fallbackUuid(): string {
  // uuid v4 khi trình duyệt không có crypto.randomUUID (trang không phải https).
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().toLowerCase();
  } catch {
    // rơi xuống cách dự phòng
  }
  return fallbackUuid();
}

/** Thời điểm ISO-8601 UTC có "Z" (hợp đồng 1.2). */
export const isoNow = (now: Date = new Date()) => now.toISOString();

let deviceId: string | null = null;

/** Mã máy của trình duyệt này (sinh lần đầu, giữ trong localStorage). */
export function currentDeviceId(): string {
  if (deviceId) return deviceId;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(DEVICE_KEY);
  } catch {
    // trình duyệt chặn localStorage → mã tạm trong bộ nhớ
  }
  deviceId = stored && UUID_RE.test(stored) ? stored : newId();
  try {
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  } catch {
    // bỏ qua
  }
  return deviceId;
}
