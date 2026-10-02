import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IBranchLocation, IShiftAssignment } from 'src/types/corecms-api';

import {
  vnToday,
  hasShiftOn,
  canUseShiftCash,
  shiftCashDenial,
  isShiftCashBypass,
  shiftCashGeoHeaders,
  checkShiftCashGeofence,
  ShiftCashGeoError,
  acquireShiftCashPosition,
  isShiftCashLocationDenial,
} from '../shift-cash-access';

// Chi nhánh mẫu ở Hà Nội; 0.001 độ vĩ ≈ 111 m
const STORE: IBranchLocation = {
  id: 'b1',
  branchName: 'CiCi Cầu Giấy',
  latitude: 21.0362,
  longitude: 105.7906,
  geofenceRadius: 100,
  isActive: true,
};

describe('isShiftCashBypass', () => {
  it('chỉ Admin được bỏ qua — Manager theo luật của Staff', () => {
    expect(isShiftCashBypass({ roles: ['Admin'] })).toBe(true);
    expect(isShiftCashBypass({ role: 'Admin' })).toBe(true);
    expect(isShiftCashBypass({ roles: ['Manager'] })).toBe(false);
    expect(isShiftCashBypass({ roles: ['Staff'], role: 'Staff' })).toBe(false);
    expect(isShiftCashBypass(null)).toBe(false);
  });
});

describe('canUseShiftCash', () => {
  it('chỉ Admin / Manager / Staff — vai trò khác (User tự đăng ký) bị chặn', () => {
    expect(canUseShiftCash({ roles: ['Admin'] })).toBe(true);
    expect(canUseShiftCash({ roles: ['Manager'] })).toBe(true);
    expect(canUseShiftCash({ role: 'Staff' })).toBe(true);
    expect(canUseShiftCash({ roles: ['User'], role: 'User' })).toBe(false);
    expect(canUseShiftCash({ roles: [] })).toBe(false);
    expect(canUseShiftCash(null)).toBe(false);
  });
});

describe('vnToday', () => {
  it('lấy ngày theo UTC+7, không theo múi giờ máy', () => {
    expect(vnToday(new Date('2026-10-01T16:59:59Z'))).toBe('2026-10-01');
    expect(vnToday(new Date('2026-10-01T17:00:00Z'))).toBe('2026-10-02');
  });
});

describe('hasShiftOn', () => {
  const shift = (date: string) => ({ id: date, date }) as IShiftAssignment;

  it('chỉ tính ca đúng ngày', () => {
    expect(hasShiftOn([shift('2026-10-02')], '2026-10-02')).toBe(true);
    expect(hasShiftOn([shift('2026-10-02T00:00:00')], '2026-10-02')).toBe(true);
    expect(hasShiftOn([shift('2026-10-01')], '2026-10-02')).toBe(false);
    expect(hasShiftOn([], '2026-10-02')).toBe(false);
    expect(hasShiftOn(undefined, '2026-10-02')).toBe(false);
  });
});

describe('checkShiftCashGeofence', () => {
  it('bỏ qua khi không chi nhánh hoạt động nào có toạ độ (giống chấm công)', () => {
    const noCoords = { ...STORE, latitude: undefined, longitude: undefined };
    const inactive = { ...STORE, isActive: false };
    expect(
      checkShiftCashGeofence({ latitude: 0, longitude: 0, accuracy: 10 }, [noCoords]).status
    ).toBe('skipped');
    expect(
      checkShiftCashGeofence({ latitude: 0, longitude: 0, accuracy: 10 }, [inactive]).status
    ).toBe('skipped');
    expect(checkShiftCashGeofence({ latitude: 0, longitude: 0 }, []).status).toBe('skipped');
  });

  it('sai số > 200 m thì chặn dù đứng trong cửa hàng', () => {
    const r = checkShiftCashGeofence(
      { latitude: STORE.latitude!, longitude: STORE.longitude!, accuracy: 250 },
      [STORE]
    );
    expect(r).toEqual({ status: 'low_accuracy', accuracy: 250 });
  });

  it('trong bán kính → đạt; sai số đúng 200 m vẫn đạt', () => {
    const r = checkShiftCashGeofence(
      { latitude: STORE.latitude! + 0.0005, longitude: STORE.longitude!, accuracy: 200 },
      [STORE]
    );
    expect(r.status).toBe('inside');
  });

  it('ngoài bán kính → báo chi nhánh gần nhất', () => {
    const r = checkShiftCashGeofence(
      { latitude: STORE.latitude! + 0.002, longitude: STORE.longitude!, accuracy: 20 },
      [STORE]
    );
    expect(r.status).toBe('outside');
    if (r.status === 'outside') {
      expect(r.branchName).toBe(STORE.branchName);
      expect(r.distance).toBeGreaterThan(200);
      expect(r.radius).toBe(100);
    }
  });

  it('bỏ qua chi nhánh ngừng hoạt động khi so geofence', () => {
    const closed = { ...STORE, id: 'b2', branchName: 'Đã đóng', isActive: false };
    const far = { ...STORE, id: 'b3', branchName: 'Xa', latitude: 10.77, longitude: 106.7 };
    const r = checkShiftCashGeofence(
      { latitude: STORE.latitude!, longitude: STORE.longitude!, accuracy: 15 },
      [closed, far]
    );
    expect(r.status).toBe('outside');
  });

  it('đạt nếu nằm trong bán kính của bất kỳ chi nhánh nào', () => {
    const wide = { ...STORE, id: 'b4', branchName: 'Kho', geofenceRadius: 500 };
    const r = checkShiftCashGeofence(
      { latitude: STORE.latitude! + 0.002, longitude: STORE.longitude!, accuracy: 30 },
      [STORE, wide]
    );
    expect(r.status).toBe('inside');
    if (r.status === 'inside') expect(r.branchName).toBe('Kho');
  });
});

describe('shiftCashGeoHeaders', () => {
  it('gửi đủ 3 header khi có vị trí', () => {
    expect(shiftCashGeoHeaders({ latitude: 21.0362, longitude: 105.7906, accuracy: 12.5 })).toEqual(
      {
        'X-Geo-Latitude': '21.0362',
        'X-Geo-Longitude': '105.7906',
        'X-Geo-Accuracy': '12.5',
      }
    );
  });

  it('không gửi gì khi chưa có vị trí; thiếu accuracy thì bỏ header đó', () => {
    expect(shiftCashGeoHeaders(null)).toEqual({});
    expect(shiftCashGeoHeaders({ latitude: 1, longitude: 2 })).toEqual({
      'X-Geo-Latitude': '1',
      'X-Geo-Longitude': '2',
    });
  });
});

describe('shiftCashDenial', () => {
  it('đọc 403 { error, message } của BE', () => {
    expect(
      shiftCashDenial({ error: 'ShiftCash.OutsideStore', message: 'Bạn đang ở ngoài cửa hàng.' })
    ).toEqual({ code: 'ShiftCash.OutsideStore', message: 'Bạn đang ở ngoài cửa hàng.' });
  });

  it('thiếu message thì dùng câu mặc định theo mã', () => {
    const d = shiftCashDenial({ error: 'ShiftCash.NoShiftToday' });
    expect(d?.code).toBe('ShiftCash.NoShiftToday');
    expect(d?.message).toMatch(/không có ca/);
  });

  it('bỏ qua lỗi không phải Kiểm quầy', () => {
    expect(shiftCashDenial({ error: 'Auth.ProviderAlreadyLinked', message: 'x' })).toBeNull();
    expect(shiftCashDenial({ title: 'Server error', status: 500 })).toBeNull();
    expect(shiftCashDenial('Something went wrong')).toBeNull();
    expect(shiftCashDenial(null)).toBeNull();
  });

  it('phân biệt lỗi vị trí với lỗi hết ca / ngày cũ', () => {
    expect(isShiftCashLocationDenial('ShiftCash.LocationRequired')).toBe(true);
    expect(isShiftCashLocationDenial('ShiftCash.OutsideStore')).toBe(true);
    expect(isShiftCashLocationDenial('ShiftCash.NoShiftToday')).toBe(false);
    expect(isShiftCashLocationDenial('ShiftCash.PastDateAdminOnly')).toBe(false);
  });
});

// ----------------------------------------------------------------------
// acquireShiftCashPosition: chờ điểm ≤ 200 m; hết giờ thì trả điểm tốt nhất (để cổng báo "chưa đủ chính
// xác" kèm con số), chưa có điểm nào thì lỗi; từ chối quyền → lỗi 'denied' ngay.

type FakeFix = { latitude: number; longitude: number; accuracy: number };

function fakeGeolocation(events: Array<FakeFix | 'denied' | 'unavailable'>) {
  const geolocation = {
    watchPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
      events.forEach((ev, i) => {
        setTimeout(
          () => {
            if (ev === 'denied' || ev === 'unavailable') {
              error?.({
                code: ev === 'denied' ? 1 : 2,
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              } as GeolocationPositionError);
            } else {
              success({ coords: ev, timestamp: Date.now() } as unknown as GeolocationPosition);
            }
          },
          (i + 1) * 1000
        );
      });
      return 7;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  return geolocation;
}

describe('acquireShiftCashPosition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trả ngay điểm đủ chính xác đầu tiên và dừng theo dõi', async () => {
    vi.useFakeTimers();
    const geo = fakeGeolocation([
      { latitude: 1, longitude: 1, accuracy: 900 },
      { latitude: 2, longitude: 2, accuracy: 30 },
    ]);
    const p = acquireShiftCashPosition(15000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({ latitude: 2, longitude: 2, accuracy: 30 });
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });

  it('hết giờ mà chưa có điểm ≤ 200 m → trả điểm tốt nhất để báo sai số', async () => {
    vi.useFakeTimers();
    fakeGeolocation([
      { latitude: 1, longitude: 1, accuracy: 1500 },
      { latitude: 2, longitude: 2, accuracy: 600 },
    ]);
    const p = acquireShiftCashPosition(5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ latitude: 2, longitude: 2, accuracy: 600 });
  });

  it('từ chối quyền vị trí → lỗi denied ngay', async () => {
    vi.useFakeTimers();
    fakeGeolocation(['denied']);
    const p = acquireShiftCashPosition(15000);
    const assertion = expect(p).rejects.toMatchObject({ reason: 'denied' });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('không có điểm nào tới hết giờ → lỗi (unavailable / timeout)', async () => {
    vi.useFakeTimers();
    fakeGeolocation(['unavailable']);
    const p = acquireShiftCashPosition(5000);
    const assertion = expect(p).rejects.toBeInstanceOf(ShiftCashGeoError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    await expect(p).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
