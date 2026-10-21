import { locationPing } from 'src/api/attendance';

// ----------------------------------------------------------------------
// Vị trí cho MỘT lần gửi check-in / check-out (sau khi chụp ảnh / quét mặt xong): ping máy chủ
// (POST /attendance/location-ping) rồi mới lấy điểm GPS — không gửi vị trí theo dõi từ lúc mở trang. Điểm GPS có trước
// lần ping (bộ đệm của trình duyệt) bị bỏ, lấy lại; thử ~5 giây không được thì vẫn chấm công, máy chủ ghi "không có vị
// trí". Gửi kèm mã ping + tuổi điểm GPS; máy chủ kiểm lại, vị trí cũ thì trả Attendance.LocationStale → ping + lấy vị trí
// lại, gửi lại một lần. Giống app (corecms-mobile src/features/checkin/location.ts).
// ----------------------------------------------------------------------

/** Thử lại GPS tối đa chừng này trước khi cho chấm công không vị trí. */
export const GPS_RETRY_WINDOW_MS = 5000;
/** Điểm GPS có trước lần ping quá chừng này → điểm cũ trong bộ đệm, lấy lại. */
export const FIX_CLOCK_SKEW_MS = 2000;
const RETRY_PAUSE_MS = 700;

export type FixCoords = { latitude: number; longitude: number; accuracy?: number };

/** Một điểm GPS trình duyệt trả về. */
export type RawFix = { coords: FixCoords; timestamp: number };

export type LocationFix = {
  coords: FixCoords | null;
  /** GPS lỗi sau ~5 giây — vẫn chấm công, máy chủ ghi "không có vị trí". */
  unavailable: boolean;
  /** Mã ping máy chủ (null: ping lỗi — gửi không mã, máy chủ quyết). */
  token: string | null;
  /** Thời điểm của điểm GPS (ms) — tuổi điểm GPS tính lúc gửi. */
  fixAt: number | null;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/**
 * Ping máy chủ rồi lấy điểm GPS MỚI: điểm có trước lần ping bị bỏ, thử lại trong `windowMs`. Không có điểm mới → coi
 * như GPS lỗi.
 */
export async function acquireFreshFix(
  ping: () => Promise<string | null>,
  getPosition: (remainingMs: number) => Promise<RawFix>,
  windowMs = GPS_RETRY_WINDOW_MS,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<LocationFix> {
  const token = await ping();
  const pingAt = now();
  const deadline = pingAt + windowMs;
  for (;;) {
    const remaining = deadline - now();
    if (remaining <= 0) break;
    try {
      // eslint-disable-next-line no-await-in-loop
      const fix = await getPosition(remaining);
      if (fix.timestamp >= pingAt - FIX_CLOCK_SKEW_MS) {
        return { coords: fix.coords, unavailable: false, token, fixAt: fix.timestamp };
      }
    } catch {
      // Lỗi / quá giờ một lần → thử lại nếu còn thời gian.
    }
    const left = deadline - now();
    if (left <= 0) break;
    // eslint-disable-next-line no-await-in-loop
    await sleep(Math.min(RETRY_PAUSE_MS, left));
  }
  return { coords: null, unavailable: true, token, fixAt: null };
}

function browserPosition(timeoutMs: number): Promise<RawFix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy },
          timestamp: p.timestamp,
        }),
      reject,
      { enableHighAccuracy: true, maximumAge: 0, timeout: Math.max(1000, timeoutMs) }
    );
  });
}

/** Ping máy chủ + điểm GPS mới của trình duyệt cho một lần gửi chấm công. */
export async function locateForAttendance(): Promise<LocationFix> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { coords: null, unavailable: true, token: null, fixAt: null };
  }
  return acquireFreshFix(
    () =>
      locationPing()
        .then((r) => r.token)
        .catch(() => null),
    browserPosition
  );
}

/** Trường vị trí gửi kèm request chấm công — tuổi điểm GPS tính NGAY lúc gửi. */
export function locationFields(fix: LocationFix, now: number = Date.now()) {
  return {
    latitude: fix.coords?.latitude,
    longitude: fix.coords?.longitude,
    accuracy: fix.coords?.accuracy,
    locationUnavailable: !fix.coords && fix.unavailable,
    locationToken: fix.token ?? undefined,
    locationAgeMs: fix.coords && fix.fixAt != null ? Math.max(0, Math.round(now - fix.fixAt)) : undefined,
  };
}

/** Máy chủ báo vị trí đã cũ (mã ping hết hạn / điểm GPS cũ). */
export function isLocationStaleError(err: unknown): boolean {
  const e = err as { errorCodes?: unknown; errors?: unknown } | null;
  if (!e || typeof e !== 'object') return false;
  if (Array.isArray(e.errorCodes) && e.errorCodes.includes('Attendance.LocationStale')) return true;
  return !!e.errors && typeof e.errors === 'object' && 'Attendance.LocationStale' in (e.errors as object);
}

/** Lấy vị trí mới rồi gửi; máy chủ báo vị trí cũ thì lấy lại và gửi lại đúng một lần. */
export async function sendWithFreshLocation<T>(
  locate: () => Promise<LocationFix>,
  send: (fix: LocationFix) => Promise<T>
): Promise<{ result: T; fix: LocationFix }> {
  const fix = await locate();
  try {
    return { result: await send(fix), fix };
  } catch (err) {
    if (!isLocationStaleError(err)) throw err;
    const again = await locate();
    return { result: await send(again), fix: again };
  }
}
