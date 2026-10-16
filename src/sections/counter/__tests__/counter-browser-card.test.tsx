import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// "Đặt trình duyệt này làm máy quầy" xác nhận bằng hộp thoại của giao diện — không window.confirm (trình duyệt nhúng
// trả "huỷ" ngay, nút như không phản hồi: lỗi gặp thật 2026-10-16).
// ----------------------------------------------------------------------

const replace = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ replace }) }));
const logout = vi.fn(() => Promise.resolve());
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ logout }) }));
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/api/attendance', () => ({ getBranchLocations: () => Promise.resolve([{ id: 'b1', branchName: 'Cửa hàng mẫu' }]) }));
const provisionCounterDevice = vi.fn();
vi.mock('src/api/counter', () => ({
  provisionCounterDevice: (...a: any[]) => provisionCounterDevice(...a),
  unpairCounter: vi.fn(),
}));
const saveCounterDevice = vi.fn();
vi.mock('../counter-device', () => ({
  saveCounterDevice: (...a: any[]) => saveCounterDevice(...a),
  clearCounterDevice: vi.fn(),
  useCounterDevice: () => null,
}));

import CounterBrowserCard from '../counter-browser-card';

describe('CounterBrowserCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provisionCounterDevice.mockResolvedValue({
      deviceId: 'd1',
      deviceName: 'Web quầy',
      branchId: 'b1',
      branchName: 'Cửa hàng mẫu',
      deviceKey: 'k',
    });
  });

  it('asks in an in-page dialog, then provisions this browser and goes to the name picker', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    render(
      <ThemeProvider theme={createTheme()}>
        <CounterBrowserCard />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Đặt trình duyệt này làm máy quầy' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt trình duyệt này làm máy quầy' }));

    expect(screen.getByText('Đặt trình duyệt này làm máy quầy?')).toBeTruthy();
    expect(provisionCounterDevice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt làm máy quầy' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/counter'));
    expect(provisionCounterDevice).toHaveBeenCalledWith('b1', 'Quầy 1', 'web');
    expect(saveCounterDevice).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
});
