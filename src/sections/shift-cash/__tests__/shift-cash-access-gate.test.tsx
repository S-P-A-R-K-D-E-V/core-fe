import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Cổng Kiểm quầy web: Admin vào thẳng; Staff / Manager cần ca hôm nay + GPS trong cửa hàng,
// và vị trí đã kiểm phải được đặt cho src/api/shiftCash (header X-Geo-*).
// ----------------------------------------------------------------------

let mockUser: { role: string; roles: string[] } = { role: 'Staff', roles: ['Staff'] };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

vi.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: any) => <div>{heading}</div>,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/routes/components', async () => {
  const { forwardRef } = await import('react');
  return {
    RouterLink: forwardRef<HTMLAnchorElement, any>(({ href, children, ...rest }, ref) => (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )),
  };
});

const getMySchedule = vi.fn();
const getBranchLocations = vi.fn();
vi.mock('src/api/attendance', () => ({
  getMySchedule: (...args: any[]) => getMySchedule(...args),
  getBranchLocations: (...args: any[]) => getBranchLocations(...args),
}));

const setShiftCashGeo = vi.fn();
vi.mock('src/api/shiftCash', () => ({
  setShiftCashGeo: (...args: any[]) => setShiftCashGeo(...args),
}));

// Lấy vị trí khi kiểm lại (quay lại tab): mặc định chạy thật trên navigator.geolocation giả; test đặt
// `acquire.override` để trả ngay một kết quả (khỏi chờ 15 s hết giờ khi sai số lớn).
const acquire = vi.hoisted(() => ({ override: null as null | (() => Promise<unknown>) }));
vi.mock('src/utils/shift-cash-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/shift-cash-access')>();
  return {
    ...actual,
    acquireShiftCashPosition: (...args: Parameters<typeof actual.acquireShiftCashPosition>) =>
      acquire.override ? acquire.override() : actual.acquireShiftCashPosition(...args),
  };
});

// Imported after the mocks above so the gate picks up the mocked modules.
import { vnToday, ShiftCashGeoError } from 'src/utils/shift-cash-access';
import ShiftCashAccessGate, {
  useShiftCashAccess,
} from 'src/sections/shift-cash/shift-cash-access-gate';

const STORE = {
  id: 'b1',
  branchName: 'CiCi Cầu Giấy',
  latitude: 21.0362,
  longitude: 105.7906,
  geofenceRadius: 100,
  isActive: true,
};

// Giả lập navigator.geolocation: watchPosition trả ngay một điểm cố định
function mockGeolocation(
  coords: { latitude: number; longitude: number; accuracy: number } | 'denied'
) {
  const geolocation = {
    watchPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
      setTimeout(() => {
        if (coords === 'denied') {
          error?.({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        } else {
          success({ coords, timestamp: Date.now() } as unknown as GeolocationPosition);
        }
      }, 0);
      return 1;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  return geolocation;
}

function renderGate(children: React.ReactNode = <div>NỘI DUNG KIỂM QUẦY</div>) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ShiftCashAccessGate>{children}</ShiftCashAccessGate>
    </ThemeProvider>
  );
}

// Trang con gặp 403 ShiftCash.* từ BE → gọi deny(message) của cổng
function DenyingPage() {
  const { deny } = useShiftCashAccess();
  return (
    <div>
      NỘI DUNG KIỂM QUẦY
      <button type="button" onClick={() => deny('Thông điệp từ BE: bạn đã hết ca.')}>
        giả lập 403
      </button>
    </div>
  );
}

// Giả lập chuyển tab đi rồi quay lại (visibilitychange)
function switchTabAwayAndBack() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

// Staff có ca, đứng trong cửa hàng → đã qua cổng
async function renderPassedStaffGate() {
  getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
  getBranchLocations.mockResolvedValue([STORE]);
  const geo = mockGeolocation({
    latitude: STORE.latitude,
    longitude: STORE.longitude,
    accuracy: 25,
  });
  renderGate();
  expect(await screen.findByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
  // Theo dõi vị trí sau khi qua cổng đã bắt đầu
  await waitFor(() => expect(geo.watchPosition).toHaveBeenCalledTimes(2));
  setShiftCashGeo.mockClear();
  return geo;
}

beforeEach(() => {
  mockUser = { role: 'Staff', roles: ['Staff'] };
  acquire.override = null;
});

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('ShiftCashAccessGate', () => {
  it('Admin vào thẳng, không gọi lịch làm / chi nhánh / GPS', async () => {
    mockUser = { role: 'Admin', roles: ['Admin'] };
    const geo = mockGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });

    renderGate();

    expect(await screen.findByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
    expect(getMySchedule).not.toHaveBeenCalled();
    expect(getBranchLocations).not.toHaveBeenCalled();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('Manager không có ca hôm nay → chặn, không hỏi GPS', async () => {
    mockUser = { role: 'Manager', roles: ['Manager'] };
    const geo = mockGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });
    getMySchedule.mockResolvedValue([]);

    renderGate();

    expect(await screen.findByText('Hôm nay bạn không có ca')).toBeInTheDocument();
    expect(getMySchedule).toHaveBeenCalledWith(vnToday(), vnToday());
    expect(screen.queryByText('NỘI DUNG KIỂM QUẦY')).not.toBeInTheDocument();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('có ca + đứng trong cửa hàng → vào trang và đặt vị trí cho header X-Geo-*', async () => {
    const today = vnToday();
    getMySchedule.mockResolvedValue([{ id: 'a1', date: today }]);
    getBranchLocations.mockResolvedValue([STORE]);
    mockGeolocation({ latitude: STORE.latitude, longitude: STORE.longitude, accuracy: 25 });

    renderGate();

    expect(await screen.findByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
    expect(setShiftCashGeo).toHaveBeenCalledWith({
      latitude: STORE.latitude,
      longitude: STORE.longitude,
      accuracy: 25,
    });
  });

  it('có ca nhưng ở ngoài cửa hàng → chặn', async () => {
    getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
    getBranchLocations.mockResolvedValue([STORE]);
    mockGeolocation({ latitude: STORE.latitude + 0.01, longitude: STORE.longitude, accuracy: 20 });

    renderGate();

    expect(await screen.findByText('Bạn đang ở ngoài cửa hàng')).toBeInTheDocument();
    expect(screen.queryByText('NỘI DUNG KIỂM QUẦY')).not.toBeInTheDocument();
  });

  it('từ chối quyền vị trí → chặn với hướng dẫn bật quyền', async () => {
    getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
    getBranchLocations.mockResolvedValue([STORE]);
    mockGeolocation('denied');

    renderGate();

    expect(await screen.findByText('Chưa cho phép truy cập vị trí')).toBeInTheDocument();
  });

  it('không tải được chi nhánh → chặn (không mở cổng khi không kiểm được)', async () => {
    getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
    getBranchLocations.mockRejectedValue(new Error('network'));
    mockGeolocation({ latitude: STORE.latitude, longitude: STORE.longitude, accuracy: 10 });

    renderGate();

    expect(await screen.findByText('Không tải được vị trí cửa hàng')).toBeInTheDocument();
    expect(screen.queryByText('NỘI DUNG KIỂM QUẦY')).not.toBeInTheDocument();
  });

  it('chưa chi nhánh nào có toạ độ → bỏ qua GPS như chấm công', async () => {
    getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
    getBranchLocations.mockResolvedValue([{ ...STORE, latitude: undefined, longitude: undefined }]);
    const geo = mockGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });

    renderGate();

    await waitFor(() => expect(screen.getByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument());
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('vai trò ngoài Admin/Manager/Staff → chặn ngay, không gọi API, không hỏi GPS', async () => {
    mockUser = { role: 'User', roles: ['User'] };
    const geo = mockGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });

    renderGate();

    expect(await screen.findByText('Tài khoản không có quyền kiểm quầy')).toBeInTheDocument();
    expect(getMySchedule).not.toHaveBeenCalled();
    expect(getBranchLocations).not.toHaveBeenCalled();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('cửa hàng chưa bật xếp ca (403 feature_disabled) → báo đúng lý do, không bảo kiểm tra mạng', async () => {
    getMySchedule.mockRejectedValue({ error: 'feature_disabled', message: 'x' });

    renderGate();

    expect(await screen.findByText('Cửa hàng chưa bật xếp ca')).toBeInTheDocument();
    expect(getBranchLocations).not.toHaveBeenCalled();
  });

  it('BE từ chối (deny) → về màn chặn với thông điệp BE, xoá vị trí; Thử lại → kiểm lại từ đầu', async () => {
    getMySchedule.mockResolvedValue([{ id: 'a1', date: vnToday() }]);
    getBranchLocations.mockResolvedValue([STORE]);
    mockGeolocation({ latitude: STORE.latitude, longitude: STORE.longitude, accuracy: 25 });

    renderGate(<DenyingPage />);
    fireEvent.click(await screen.findByText('giả lập 403'));

    expect(await screen.findByText('Thông điệp từ BE: bạn đã hết ca.')).toBeInTheDocument();
    expect(screen.queryByText('giả lập 403')).not.toBeInTheDocument();
    expect(setShiftCashGeo).toHaveBeenLastCalledWith(null);

    getMySchedule.mockClear();
    fireEvent.click(screen.getByText('Thử lại'));

    expect(await screen.findByText('giả lập 403')).toBeInTheDocument();
    expect(getMySchedule).toHaveBeenCalledTimes(1);
  });

  it('quay lại tab, điểm mới đủ chính xác ở ngoài cửa hàng → chặn lại, xoá vị trí (như app về foreground)', async () => {
    await renderPassedStaffGate();
    acquire.override = () =>
      Promise.resolve({
        latitude: STORE.latitude + 0.01,
        longitude: STORE.longitude,
        accuracy: 20,
      });

    act(() => switchTabAwayAndBack());

    expect(await screen.findByText('Bạn đang ở ngoài cửa hàng')).toBeInTheDocument();
    expect(screen.queryByText('NỘI DUNG KIỂM QUẦY')).not.toBeInTheDocument();
    expect(setShiftCashGeo).toHaveBeenLastCalledWith(null);
  });

  it('quay lại tab, vẫn trong cửa hàng → giữ trang, cập nhật vị trí gửi kèm', async () => {
    await renderPassedStaffGate();
    const fix = { latitude: STORE.latitude + 0.0002, longitude: STORE.longitude, accuracy: 15 };
    acquire.override = () => Promise.resolve(fix);

    act(() => switchTabAwayAndBack());

    await waitFor(() => expect(setShiftCashGeo).toHaveBeenCalledWith(fix));
    expect(screen.getByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
  });

  it('quay lại tab, sai số lớn / tạm mất GPS → không khoá trang đang thao tác', async () => {
    await renderPassedStaffGate();
    const inaccurate = {
      latitude: STORE.latitude + 0.05,
      longitude: STORE.longitude,
      accuracy: 900,
    };
    acquire.override = vi.fn(() => Promise.resolve(inaccurate));

    act(() => switchTabAwayAndBack());
    await waitFor(() => expect(acquire.override).toHaveBeenCalledTimes(1));

    acquire.override = vi.fn(() => Promise.reject(new ShiftCashGeoError('timeout')));
    act(() => switchTabAwayAndBack());
    await waitFor(() => expect(acquire.override).toHaveBeenCalledTimes(1));

    expect(screen.getByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
    expect(setShiftCashGeo).not.toHaveBeenCalledWith(inaccurate);
    expect(setShiftCashGeo).not.toHaveBeenCalledWith(null);
  });

  it('quay lại tab mà đã thu hồi quyền vị trí → chặn lại với hướng dẫn bật quyền', async () => {
    await renderPassedStaffGate();
    acquire.override = () => Promise.reject(new ShiftCashGeoError('denied'));

    act(() => switchTabAwayAndBack());

    expect(await screen.findByText('Chưa cho phép truy cập vị trí')).toBeInTheDocument();
    expect(setShiftCashGeo).toHaveBeenLastCalledWith(null);
  });

  it('đang ở trang mà bị thu hồi quyền vị trí (watchPosition báo PERMISSION_DENIED) → chặn lại', async () => {
    const geo = await renderPassedStaffGate();
    const trackError = geo.watchPosition.mock.calls[1][1] as PositionErrorCallback;

    act(() =>
      trackError({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)
    );

    expect(await screen.findByText('Chưa cho phép truy cập vị trí')).toBeInTheDocument();
    expect(setShiftCashGeo).toHaveBeenLastCalledWith(null);
  });

  it('Admin không bị kiểm lại vị trí khi quay lại tab', async () => {
    mockUser = { role: 'Admin', roles: ['Admin'] };
    const geo = mockGeolocation({ latitude: 0, longitude: 0, accuracy: 10 });
    acquire.override = vi.fn(() => Promise.reject(new ShiftCashGeoError('denied')));

    renderGate();
    expect(await screen.findByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
    act(() => switchTabAwayAndBack());

    expect(acquire.override).not.toHaveBeenCalled();
    expect(geo.watchPosition).not.toHaveBeenCalled();
    expect(screen.getByText('NỘI DUNG KIỂM QUẦY')).toBeInTheDocument();
  });
});
