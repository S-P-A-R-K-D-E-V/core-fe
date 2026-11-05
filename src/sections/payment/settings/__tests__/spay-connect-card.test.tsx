import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { SPayConnectStatus } from 'src/api/spay-connect';

// ----------------------------------------------------------------------
// Thẻ "Kết nối S Payment": ẩn khi SPARK chưa bật; chưa kết nối → nút Kết nối chuyển sang màn đồng ý của S Payment (gửi
// đường quay về là trang hiện tại); đã kết nối → link trang Ngân hàng S Payment + ngắt kết nối có hộp xác nhận; quay về
// với ?spay= → báo kết quả.
// ----------------------------------------------------------------------

const getSPayConnectStatus = vi.fn();
const startSPayConnect = vi.fn();
const disconnectSPay = vi.fn();
vi.mock('src/api/spay-connect', () => ({
  getSPayConnectStatus: (...args: any[]) => getSPayConnectStatus(...args),
  startSPayConnect: (...args: any[]) => startSPayConnect(...args),
  disconnectSPay: (...args: any[]) => disconnectSPay(...args),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

let search = 'tab=connections';
vi.mock('src/routes/hooks', () => ({
  usePathname: () => '/dashboard/payment/settings',
  useSearchParams: () => new URLSearchParams(search),
}));

// Imported after the mocks above.
import SPayConnectCard from '../spay-connect-card';

const BASE: SPayConnectStatus = {
  configured: true,
  status: 'disconnected',
  workspaceId: null,
  connectedAt: null,
  connectedByUserId: null,
  accountCount: null,
  scopes: null,
  portalUrl: 'https://spay.devbyspark.com',
  banksUrl: 'https://spay.devbyspark.com/banks',
  disconnectedAt: null,
  disconnectReason: null,
  mode: 'oauth',
  accessKey: null,
  livemode: true,
  workspaceMatchesStore: true,
};

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
  search = 'tab=connections';
});

describe('SPayConnectCard', () => {
  it('stays hidden until SPARK enables S Payment Connect', async () => {
    getSPayConnectStatus.mockResolvedValue({ ...BASE, configured: false });
    const { container } = wrap(<SPayConnectCard />);
    await waitFor(() => expect(getSPayConnectStatus).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('connect sends the current page as return path and opens the consent screen', async () => {
    getSPayConnectStatus.mockResolvedValue(BASE);
    startSPayConnect.mockResolvedValue('https://spay.devbyspark.com/oauth/authorize?client_id=spc&request_uri=urn');
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, set href(v: string) { assign(v); }, get href() { return original.href; } },
    });

    wrap(<SPayConnectCard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Kết nối S Payment' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://spay.devbyspark.com/oauth/authorize?client_id=spc&request_uri=urn'));
    expect(startSPayConnect).toHaveBeenCalledWith('/dashboard/payment/settings?tab=connections');
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('connected store links to S Payment banks and disconnects after confirming', async () => {
    getSPayConnectStatus.mockResolvedValue({ ...BASE, status: 'connected', connectedAt: '2026-11-05T10:00:00Z', accountCount: 2 });
    disconnectSPay.mockResolvedValue(undefined);
    wrap(<SPayConnectCard />);

    const manage = await screen.findByRole('link', { name: 'Quản lý tài khoản ngân hàng' });
    expect(manage).toHaveAttribute('href', 'https://spay.devbyspark.com/banks');
    expect(screen.getByText(/2 tài khoản nhận tiền/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ngắt kết nối' }));
    expect(disconnectSPay).not.toHaveBeenCalled();
    const dialogButtons = await screen.findAllByRole('button', { name: 'Ngắt kết nối' });
    await userEvent.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(disconnectSPay).toHaveBeenCalledTimes(1));
  });

  it('reports the outcome when coming back from S Payment', async () => {
    search = 'tab=connections&spay=denied';
    getSPayConnectStatus.mockResolvedValue(BASE);
    wrap(<SPayConnectCard />);
    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Bạn đã không đồng ý kết nối S Payment', { variant: 'warning' })
    );
  });
});
