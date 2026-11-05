import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { SPayConnectStatus } from 'src/api/spay-connect';

// ----------------------------------------------------------------------
// Tab "Kết nối S Payment": chưa kết nối → dán Access key + Secret tạo trên S Payment; đã kết nối → khoá đang dùng, tài
// khoản nhận tiền trên S Payment, link quản lý ngân hàng, ngắt kết nối có hộp xác nhận.
// ----------------------------------------------------------------------

const getSPayConnectStatus = vi.fn();
const connectSPayApiKey = vi.fn();
const getSPayAccounts = vi.fn();
const disconnectSPay = vi.fn();
const setSPayPaymentsViaV2 = vi.fn();
vi.mock('src/api/spay-connect', () => ({
  getSPayConnectStatus: (...a: any[]) => getSPayConnectStatus(...a),
  connectSPayApiKey: (...a: any[]) => connectSPayApiKey(...a),
  getSPayAccounts: (...a: any[]) => getSPayAccounts(...a),
  disconnectSPay: (...a: any[]) => disconnectSPay(...a),
  setSPayPaymentsViaV2: (...a: any[]) => setSPayPaymentsViaV2(...a),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));
vi.mock('src/components/iconify', () => ({ default: () => null }));

// Imported after the mocks above.
import SPayKeyCard from '../spay-key-card';

const BASE: SPayConnectStatus = {
  configured: false,
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
  paymentsViaV2: false,
};
const CONNECTED: SPayConnectStatus = {
  ...BASE,
  status: 'connected',
  mode: 'api_key',
  accessKey: 'sp_live_abc',
  connectedAt: '2026-11-05T10:00:00Z',
  accountCount: 1,
};

const wrap = () => render(<ThemeProvider theme={createTheme()}><SPayKeyCard /></ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
});

describe('SPayKeyCard', () => {
  it('connects with the access key and secret created on S Payment', async () => {
    getSPayConnectStatus.mockResolvedValue(BASE);
    connectSPayApiKey.mockResolvedValue(CONNECTED);
    getSPayAccounts.mockResolvedValue([
      { id: 'c1', bankName: 'MB', accountNumber: '2510199966668', accountName: 'VU XUAN BINH', autoConfirm: true },
    ]);
    wrap();

    expect(await screen.findByRole('link', { name: 'Tạo khoá trên S Payment' })).toHaveAttribute(
      'href',
      'https://spay.devbyspark.com/developer'
    );
    const connect = screen.getByRole('button', { name: 'Kết nối' });
    expect(connect).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Access key'), ' sp_live_abc ');
    await userEvent.type(screen.getByLabelText('Secret'), 'secret-xyz');
    await userEvent.click(connect);

    await waitFor(() => expect(connectSPayApiKey).toHaveBeenCalledWith('sp_live_abc', 'secret-xyz'));
    expect(await screen.findByText('2510199966668')).toBeInTheDocument();
    expect(screen.getByText('Tự xác nhận')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quản lý tài khoản ngân hàng' })).toHaveAttribute('href', 'https://spay.devbyspark.com/banks');
  });

  it('disconnects only after confirming', async () => {
    getSPayConnectStatus.mockResolvedValue(CONNECTED);
    getSPayAccounts.mockResolvedValue([]);
    disconnectSPay.mockResolvedValue(undefined);
    wrap();

    await userEvent.click(await screen.findByRole('button', { name: 'Ngắt kết nối' }));
    expect(disconnectSPay).not.toHaveBeenCalled();
    const buttons = await screen.findAllByRole('button', { name: 'Ngắt kết nối' });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(disconnectSPay).toHaveBeenCalledTimes(1));
  });
  it('switches payments to S Payment only after confirming', async () => {
    getSPayConnectStatus.mockResolvedValue(CONNECTED);
    getSPayAccounts.mockResolvedValue([]);
    setSPayPaymentsViaV2.mockResolvedValue({ ...CONNECTED, paymentsViaV2: true });
    wrap();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Thanh toán qua S Payment' }));
    expect(setSPayPaymentsViaV2).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển' }));
    await waitFor(() => expect(setSPayPaymentsViaV2).toHaveBeenCalledWith(true));
    expect(await screen.findByText(/Đang bật/)).toBeInTheDocument();
  });
});
