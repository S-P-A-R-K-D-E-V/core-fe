import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Quầy chọn tài khoản theo danh sách của S Payment (GET payment/qr/pos-accounts): mỗi số tài khoản thật một dòng, nhãn tự xác
// nhận đi kèm; không lấy được danh sách S Payment thì dùng tài khoản của cửa hàng như trước.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  createQrPayment: vi.fn(),
  getQrPaymentStatus: vi.fn(),
  cancelQrPayment: vi.fn(),
  getPosPaymentConnections: vi.fn(),
  getPosBankAccounts: vi.fn(),
  getPosAccountCapabilities: vi.fn(),
  getBankAccounts: vi.fn(),
  getVietQRBanks: vi.fn(),
}));

vi.mock('src/api/payment-qr', () => ({
  createQrPayment: api.createQrPayment,
  getQrPaymentStatus: api.getQrPaymentStatus,
  cancelQrPayment: api.cancelQrPayment,
  getPosPaymentConnections: api.getPosPaymentConnections,
  getPosBankAccounts: api.getPosBankAccounts,
  getPosAccountCapabilities: api.getPosAccountCapabilities,
}));

vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: api.getBankAccounts,
  getVietQRBanks: api.getVietQRBanks,
}));

vi.mock('src/components/iconify', () => ({ default: () => null }));

vi.mock('src/utils/format-number', () => ({
  fCurrency: (value: number) => `${value}đ`,
}));

vi.mock('src/components/payment-qr-info', () => ({
  default: ({ paymentCode }: { paymentCode?: string }) => <span>Nội dung CK: {paymentCode}</span>,
  useQrImageSrc: (url?: string | null) => url ?? undefined,
  useExpirySeconds: () => null,
}));

// Imported after the mocks above so the component picks up the mocked modules.
import PosQrPayment from 'src/sections/pos/sale/pos-qr-payment';

const capability = (bankAccountId: string, confirmation: 'auto' | 'manual') => ({
  bankAccountId,
  confirmation,
  kind: confirmation === 'auto' ? 'gateway_va' : null,
  provider: confirmation === 'auto' ? 'payos' : null,
  quota: null,
  reason: confirmation === 'auto' ? null : 'no_connection',
  sources: [],
});

const mb = { id: 'acc-mb', bankName: 'MB', shortName: 'MBBank', bin: '970422', accountNumber: '2510199966668', isDefault: true };
const vtb = { id: 'acc-vtb', bankName: 'HKD CICI', bin: '970415', accountNumber: '103885549137' };

const qrResponse = {
  id: 'qr-1',
  amount: 150000,
  status: 'INIT',
  createdAt: '2026-11-05T10:00:00Z',
  qrDataUrl: 'https://img.vietqr.io/qr.png',
  bankName: 'MB',
  accountNumber: '2510199966668',
  paymentCode: 'SPAB12CD3',
  connectionId: null,
};

function renderQr() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <PosQrPayment amount={150000} salesOrderId="so-1" orderCode="HD001" />
    </ThemeProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.getVietQRBanks.mockResolvedValue([]);
  api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [] });
  api.createQrPayment.mockResolvedValue(qrResponse);
  api.getQrPaymentStatus.mockResolvedValue(qrResponse);
  api.cancelQrPayment.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PosQrPayment — tài khoản theo S Payment', () => {
  it('chỉ hiện tài khoản S Payment trả về, kèm nhãn tự xác nhận; không đọc danh sách tài khoản của cửa hàng', async () => {
    api.getPosBankAccounts.mockResolvedValue({
      source: 'spay',
      accounts: [
        { ...mb, capability: capability('acc-mb', 'auto') },
        { ...vtb, capability: capability('acc-vtb', 'manual') },
      ],
    });

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith(expect.objectContaining({ bankAccountId: 'acc-mb' }));
    expect(api.getBankAccounts).not.toHaveBeenCalled();
    expect(api.getPosAccountCapabilities).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('combobox', { name: 'Tài khoản ngân hàng' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('MBBank - 2510199966668'),
      expect.stringContaining('HKD CICI - 103885549137'),
    ]);
    expect(within(options[0]).getByText('Tự xác nhận')).toBeInTheDocument();
    expect(within(options[1]).queryByText('Tự xác nhận')).not.toBeInTheDocument();
  });

  it('không lấy được danh sách S Payment → tài khoản của cửa hàng như trước', async () => {
    api.getPosBankAccounts.mockRejectedValue(new Error('404'));
    api.getBankAccounts.mockResolvedValue([vtb]);

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith(expect.objectContaining({ bankAccountId: 'acc-vtb' }));
  });
});
