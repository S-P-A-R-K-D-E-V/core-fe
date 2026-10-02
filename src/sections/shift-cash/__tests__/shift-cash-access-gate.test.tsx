import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

// Imported after the mocks above so the gate picks up the mocked modules.
import { vnToday } from 'src/utils/shift-cash-access';
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

beforeEach(() => {
  mockUser = { role: 'Staff', roles: ['Staff'] };
});

afterEach(() => {
  vi.clearAllMocks();
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
});
