import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IKioskDeviceItem } from 'src/types/kiosk';

// ----------------------------------------------------------------------
// Thiết bị cửa hàng: agent camera hiện trạng thái chạy/mất kết nối và camera của nó, kiosk web hiện
// "Đã ghép nối"; đổi tên và thu hồi đều qua hộp thoại xác nhận.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: ({ icon }: any) => <span data-icon={icon} /> }));
// enqueueSnackbar ổn định như notistack thật — hàm mới mỗi render làm fetchData đổi identity và lặp vô hạn.
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const api = {
  getKioskDevices: vi.fn(),
  claimKioskPairing: vi.fn(),
  revokeKioskDevice: vi.fn(),
  renameKioskDevice: vi.fn(),
};
vi.mock('src/api/kiosk', () => ({
  getKioskDevices: (...a: any[]) => api.getKioskDevices(...a),
  claimKioskPairing: (...a: any[]) => api.claimKioskPairing(...a),
  revokeKioskDevice: (...a: any[]) => api.revokeKioskDevice(...a),
  renameKioskDevice: (...a: any[]) => api.renameKioskDevice(...a),
}));
let cameraOn = true;
vi.mock('src/hooks/use-feature-enabled', () => ({
  FEATURE: { storeCamera: 'store.camera', shareholders: 'finance.shareholders', partnerDebt: 'finance.partner-debt' },
  useFeatureEnabled: (key: string) => key === 'store.camera' && cameraOn,
}));
vi.mock('src/api/attendance', () => ({
  getBranchLocations: () => Promise.resolve([{ id: 'b1', branchName: 'CiCi Cầu Giấy' }]),
}));
let roles: string[] = ['Admin'];
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: { roles, role: roles[0] } }) }));
vi.mock('src/store/working-branch-store', () => ({
  useWorkingBranch: (pick: any) => pick({ options: [{ id: 'b1', name: 'CiCi Cầu Giấy', type: 'retail' }] }),
}));
// Ô "Đặt trình duyệt này làm máy quầy" có test riêng — ở đây chỉ cần chỗ của nó.
vi.mock('src/sections/counter/counter-browser-card', () => ({ default: () => <div>counter-browser-card</div> }));

// Imported after the mocks above.
import { KioskDevicesView } from '../view/kiosk-devices-view';

const base = {
  branchId: 'b1',
  branchName: 'CiCi Cầu Giấy',
  isActive: true,
  createdAt: '2026-10-14T01:00:00Z',
  lastSeenAt: '2026-10-14T07:59:00Z',
  lastHeartbeatAt: '2026-10-14T07:59:00Z',
};

const devices: IKioskDeviceItem[] = [
  {
    ...base,
    id: 'd1',
    name: 'Camera cửa chính',
    kind: 'camera-agent',
    agentVersion: '0.1.0',
    online: true,
    cameras: [{ key: 'door1', name: 'Cửa chính', online: true, fps: 5, lastFrameAt: null, inToday: 12, outToday: 9 }],
  },
  { ...base, id: 'd2', name: 'Laptop kho', kind: 'camera-agent', agentVersion: '0.1.0', online: false, cameras: [] },
  { ...base, id: 'd3', name: 'Kiosk lễ tân', kind: 'kiosk', agentVersion: null, lastHeartbeatAt: null, online: null, cameras: [] },
  {
    ...base,
    id: 'd4',
    name: 'Quầy 1',
    kind: 'counter',
    agentVersion: null,
    lastHeartbeatAt: null,
    online: null,
    cameras: [],
    platform: 'android',
    currentUserName: 'Hoàng Giang',
    sessionEndsAt: '2026-10-14T10:30:00Z',
  },
];

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <KioskDevicesView />
    </ThemeProvider>
  );
}

describe('KioskDevicesView', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getKioskDevices.mockResolvedValue(devices);
    api.renameKioskDevice.mockResolvedValue(undefined);
    api.revokeKioskDevice.mockResolvedValue(undefined);
    cameraOn = true;
    roles = ['Admin'];
  });

  it('only offers kiosk pairing when the store has no camera feature', async () => {
    cameraOn = false;
    renderView();

    await waitFor(() => expect(screen.getByText('Camera cửa chính')).toBeTruthy());
    expect(screen.queryByRole('tab', { name: /Camera đếm khách/ })).toBeNull();
    expect(screen.queryByText(/python -m agent pair/)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Kiosk chấm công/ }));
    expect(screen.getByText(/kiosk-checkin/)).toBeTruthy();
  });

  it('defaults to counter pairing and shows who is using each counter', async () => {
    renderView();

    await waitFor(() => expect(screen.getByText('Quầy 1')).toBeTruthy());
    expect(screen.getByText(/trang/).textContent).toBeTruthy();
    expect(screen.getAllByText(/\/counter/).length).toBeGreaterThan(0);
    expect(screen.getByText('Máy quầy · Android')).toBeTruthy();
    expect(screen.getByText(/Đang dùng: Hoàng Giang/)).toBeTruthy();
    expect(screen.getByText('Đang bán hàng')).toBeTruthy();
    expect(screen.getByText('counter-browser-card')).toBeTruthy();
  });

  it('managers never get the camera pairing guide', async () => {
    roles = ['Manager'];
    renderView();

    await waitFor(() => expect(screen.getByText('Quầy 1')).toBeTruthy());
    expect(screen.queryByRole('tab', { name: /Camera đếm khách/ })).toBeNull();
  });

  it('shows camera agents and kiosks with their status', async () => {
    renderView();

    await waitFor(() => expect(screen.getByText('Camera cửa chính')).toBeTruthy());
    expect(screen.getByText('Đang chạy')).toBeTruthy();
    expect(screen.getByText('Mất kết nối')).toBeTruthy();
    expect(screen.getByText('Đã ghép nối')).toBeTruthy();
    expect(screen.getByText('Cửa chính · 12 vào')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Camera đếm khách/ }));
    expect(screen.getByText(/python -m agent pair/)).toBeTruthy();
  });

  it('renames and revokes through confirmation dialogs', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Camera cửa chính')).toBeTruthy());

    fireEvent.click(screen.getAllByText('Đổi tên')[0]);
    fireEvent.change(screen.getByLabelText('Tên thiết bị', { selector: '#rename-device' }), {
      target: { value: 'Camera quầy' },
    });
    fireEvent.click(screen.getByText('Lưu'));
    await waitFor(() => expect(api.renameKioskDevice).toHaveBeenCalledWith('d1', 'Camera quầy'));

    fireEvent.click(screen.getAllByText('Thu hồi')[0]);
    expect(api.revokeKioskDevice).not.toHaveBeenCalled();
    const confirm = screen.getAllByText('Thu hồi').at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(api.revokeKioskDevice).toHaveBeenCalledWith('d1'));
  });
});
