import type { IBranchLocation, IShiftAssignment } from 'src/types/corecms-api';

import { apiErrorMessage } from './api-error';

// ----------------------------------------------------------------------
// Quy tắc vào Kiểm quầy — khớp bộ lọc ShiftCashAccess ở core-be:
//  - Admin: luôn được vào, chọn được ngày cũ, xem nhật ký / audit.
//  - Còn lại (Staff VÀ Manager): phải có ca trong NGÀY HÔM NAY theo giờ VN, chỉ thao tác ngày hôm nay,
//    và đang ở trong bán kính một chi nhánh đang hoạt động có toạ độ, GPS chính xác ≤ 200 m.
//    Không chi nhánh nào có toạ độ → bỏ qua GPS (giống chấm công SmartCheckIn).
//  - Vị trí đã kiểm gửi kèm header X-Geo-Latitude / X-Geo-Longitude / X-Geo-Accuracy (mét).
//  - BE từ chối → 403 { error: 'ShiftCash.*', message } (NoShiftToday, LocationRequired, OutsideStore,
//    PastDateAdminOnly).
// ----------------------------------------------------------------------

// Vai trò được bỏ qua mọi kiểm tra. Manager theo đúng luật của Staff (chủ đã chốt).
export const SHIFT_CASH_BYPASS_ROLES = ['Admin'];

// Độ chính xác GPS tối đa chấp nhận (mét) — cùng ngưỡng BE.
export const SHIFT_CASH_MAX_ACCURACY_M = 200;

export const SHIFT_CASH_DENIAL = {
  NoShiftToday: 'ShiftCash.NoShiftToday',
  LocationRequired: 'ShiftCash.LocationRequired',
  OutsideStore: 'ShiftCash.OutsideStore',
  PastDateAdminOnly: 'ShiftCash.PastDateAdminOnly',
} as const;

export type ShiftCashGeo = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export function isShiftCashBypass(user: Record<string, any> | null | undefined): boolean {
  const roles: string[] = [...(user?.roles ?? []), user?.role].filter(Boolean);
  return SHIFT_CASH_BYPASS_ROLES.some((r) => roles.includes(r));
}

// Ngày hôm nay theo giờ Việt Nam (UTC+7, không có giờ mùa hè), dạng yyyy-MM-dd.
// BE so "hôm nay" theo múi giờ VN chứ không theo đồng hồ/múi giờ của máy người dùng.
export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Có ca được xếp vào đúng ngày `date` (yyyy-MM-dd). Ca không qua đêm nên chỉ cần so ngày.
export function hasShiftOn(
  assignments: IShiftAssignment[] | null | undefined,
  date: string
): boolean {
  return (assignments ?? []).some((a) => (a.date ?? '').slice(0, 10) === date);
}

// Khoảng cách Haversine (mét) — cùng công thức BE dùng cho geofence chấm công.
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Chi nhánh dùng để kiểm geofence: đang hoạt động và có đủ toạ độ (BE: IsActive && Latitude && Longitude).
export function geofenceBranches(
  branches: IBranchLocation[] | null | undefined
): IBranchLocation[] {
  return (branches ?? []).filter(
    (b) => b.isActive !== false && b.latitude != null && b.longitude != null
  );
}

export type ShiftCashGeofenceResult =
  | { status: 'skipped' }
  | { status: 'inside'; branchName: string; distance: number }
  | { status: 'low_accuracy'; accuracy: number }
  | { status: 'outside'; branchName?: string; distance?: number; radius?: number };

export function checkShiftCashGeofence(
  geo: ShiftCashGeo,
  branches: IBranchLocation[] | null | undefined
): ShiftCashGeofenceResult {
  const usable = geofenceBranches(branches);
  if (usable.length === 0) return { status: 'skipped' };

  if (geo.accuracy != null && geo.accuracy > SHIFT_CASH_MAX_ACCURACY_M) {
    return { status: 'low_accuracy', accuracy: geo.accuracy };
  }

  const measured = usable
    .map((b) => ({
      branchName: b.branchName,
      radius: b.geofenceRadius,
      distance: distanceMeters(geo.latitude, geo.longitude, b.latitude!, b.longitude!),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Trong bán kính của BẤT KỲ chi nhánh nào là đạt (bán kính mỗi chi nhánh có thể khác nhau).
  const inside = measured.find((m) => m.distance <= m.radius);
  if (inside) {
    return {
      status: 'inside',
      branchName: inside.branchName,
      distance: Math.round(inside.distance),
    };
  }

  const nearest = measured[0];
  return {
    status: 'outside',
    branchName: nearest.branchName,
    distance: Math.round(nearest.distance),
    radius: nearest.radius,
  };
}

export function shiftCashGeoHeaders(geo: ShiftCashGeo | null | undefined): Record<string, string> {
  if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) return {};
  const headers: Record<string, string> = {
    'X-Geo-Latitude': String(geo.latitude),
    'X-Geo-Longitude': String(geo.longitude),
  };
  if (geo.accuracy != null && Number.isFinite(geo.accuracy)) {
    headers['X-Geo-Accuracy'] = String(geo.accuracy);
  }
  return headers;
}

// ----------------------------------------------------------------------
// 403 Kiểm quầy từ BE: { error: 'ShiftCash.*', message }. Trả null nếu không phải loại lỗi này.

const DENIAL_FALLBACK: Record<string, string> = {
  [SHIFT_CASH_DENIAL.NoShiftToday]:
    'Hôm nay bạn không có ca — chỉ nhân viên có ca mới được kiểm quầy.',
  [SHIFT_CASH_DENIAL.LocationRequired]: 'Cần bật vị trí (GPS) để kiểm quầy.',
  [SHIFT_CASH_DENIAL.OutsideStore]:
    'Bạn đang ở ngoài cửa hàng — chỉ kiểm quầy được khi có mặt tại cửa hàng.',
  [SHIFT_CASH_DENIAL.PastDateAdminOnly]: 'Chỉ Admin được xem / sửa ngày cũ.',
};

export function shiftCashDenial(err: any): { code: string; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  const candidates: unknown[] = [
    err.error,
    err.code,
    ...(Array.isArray(err.errorCodes) ? err.errorCodes : []),
  ];
  const code = candidates.find(
    (c): c is string => typeof c === 'string' && c.startsWith('ShiftCash.')
  );
  if (!code) return null;
  const fallback = DENIAL_FALLBACK[code] ?? 'Bạn không được kiểm quầy lúc này.';
  return { code, message: apiErrorMessage(err, fallback) };
}

// Bị chặn vì vị trí (chưa gửi / ngoài cửa hàng) — đứng lại đúng chỗ, GPS ổn là làm tiếp được.
export function isShiftCashLocationDenial(code: string): boolean {
  return code === SHIFT_CASH_DENIAL.LocationRequired || code === SHIFT_CASH_DENIAL.OutsideStore;
}

// ----------------------------------------------------------------------
// Lấy vị trí trình duyệt cho cổng Kiểm quầy.
// Dùng watchPosition tới khi có điểm đủ chính xác (≤ 200 m) hoặc hết giờ: getCurrentPosition thường
// trả ngay điểm thô đầu tiên (Wi-Fi/IP) rồi thôi. Hết giờ mà đã có điểm → trả điểm tốt nhất để cổng
// báo "chưa đủ chính xác"; chưa có điểm nào → lỗi.

export type ShiftCashGeoFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class ShiftCashGeoError extends Error {
  reason: ShiftCashGeoFailure;

  constructor(reason: ShiftCashGeoFailure) {
    super(`geolocation:${reason}`);
    this.reason = reason;
  }
}

export function acquireShiftCashPosition(timeoutMs = 15000): Promise<ShiftCashGeo> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new ShiftCashGeoError('unsupported'));
      return;
    }

    const { geolocation } = navigator;
    let best: ShiftCashGeo | null = null;
    let lastFailure: ShiftCashGeoFailure = 'timeout';
    let done = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (settle: () => void) => {
      if (done) return;
      done = true;
      if (watchId !== null) geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      settle();
    };

    timer = setTimeout(() => {
      const found = best;
      finish(() => (found ? resolve(found) : reject(new ShiftCashGeoError(lastFailure))));
    }, timeoutMs);

    watchId = geolocation.watchPosition(
      (pos) => {
        const fix: ShiftCashGeo = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || (fix.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = fix;
        if ((fix.accuracy ?? Infinity) <= SHIFT_CASH_MAX_ACCURACY_M) finish(() => resolve(fix));
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(() => reject(new ShiftCashGeoError('denied')));
          return;
        }
        // POSITION_UNAVAILABLE / TIMEOUT có thể chỉ tạm thời — chờ tiếp tới hết giờ.
        lastFailure = error.code === error.POSITION_UNAVAILABLE ? 'unavailable' : 'timeout';
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );
  });
}
