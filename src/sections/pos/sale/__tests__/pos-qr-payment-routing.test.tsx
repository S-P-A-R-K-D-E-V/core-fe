import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Tài khoản nhận theo kênh ở quầy: chủ cửa hàng cấu hình → mặc định "Tự chọn theo cài đặt" (máy chủ chọn tài khoản, QR tạo lại
// giữ tài khoản cùng quy tắc); thu ngân đổi tay chỉ trong danh sách cho phép.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  createQrPayment: vi.fn(),
  getQrPaymentStatus: vi.fn(),
  cancelQrPayment: vi.fn(),
  getPosPaymentConnections: vi.fn(),
  getBankAccounts: vi.fn(),
  getVietQRBanks: vi.fn(),
}));

vi.mock('src/api/payment-qr', () => ({
  createQrPayment: api.createQrPayment,
  getQrPaymentStatus: api.getQrPaymentStatus,
  cancelQrPayment: api.cancelQrPayment,
  getPosPaymentConnections: api.getPosPaymentConnections,
  // Nhãn tự xác nhận theo tài khoản (S Payment) — tắt trong các test này.
  getPosAccountCapabilities: () => Promise.resolve({ enabled: false, accounts: [] }),
}));

vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: api.getBankAccounts,
  getVietQRBanks: api.getVietQRBanks,
}));

vi.mock('src/components/iconify', () => ({ default: () => null }));

// fCurrency thật kéo theo src/locales → theme (next/font) không chạy được trong jsdom
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
import { POS_PAYMENT_CONNECTION_STORAGE_KEY } from 'src/utils/payment-connection';

const FIELD = 'Xác nhận chuyển khoản';

const account = {
  id: 'acc-mb',
  bankName: 'MB Bank',
  shortName: 'MB',
  code: 'MB',
  bin: '970422',
  accountNumber: '0123456789',
};

const apiPay = {
  id: 'conn-apipay',
  provider: 'apipay',
  kind: 'bank_feed',
  displayName: 'ApiPay MB',
  bin: '970422',
  accountNumber: '9704229999',
  environment: 'test',
  bankAccountId: null,
  bankName: 'MB',
};

const qrResponse = (over: Record<string, unknown> = {}) => ({
  id: 'qr-1',
  amount: 150000,
  status: 'INIT',
  createdAt: '2026-10-15T10:00:00Z',
  qrDataUrl: 'https://img.vietqr.io/qr.png',
  bankName: 'MB',
  accountNumber: '0123456789',
  paymentCode: 'SPAB12CD3',
  connectionId: null,
  ...over,
});

function renderQr() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <PosQrPayment amount={150000} salesOrderId="so-1" orderCode="HD001" />
    </ThemeProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.getBankAccounts.mockResolvedValue([account]);
  api.getVietQRBanks.mockResolvedValue([]);
  api.getQrPaymentStatus.mockResolvedValue(qrResponse());
  api.cancelQrPayment.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});


const other = { ...account, id: 'acc-other', accountNumber: '9999999999' };
const routed = (cashierOverride: string) => ({
  enabled: true,
  connections: [],
  configured: true,
  methods: ['Cash', 'BankTransfer'],
  allowBankAccount: true,
  transfer: { strategy: 'priority', accounts: [{ id: 'acc-mb' }], fallbackId: 'acc-mb', cashierOverride },
  branches: null,
});

describe('PosQrPayment — tài khoản nhận theo kênh', () => {
  it('có cấu hình: tạo QR tự chọn (auto), hiện lý do, giữ tài khoản khi tạo lại', async () => {
    api.getBankAccounts.mockResolvedValue([account, other]);
    api.getPosPaymentConnections.mockResolvedValue(routed('pool'));
    api.createQrPayment.mockResolvedValue(
      qrResponse({
        bankAccountId: 'acc-mb',
        routing: { accountId: 'acc-mb', ruleId: null, ruleName: null, strategy: 'priority', note: 'Tự chọn MB …6789 · ưu tiên', auto: true },
      })
    );

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith(
      expect.objectContaining({ auto: true, bankAccountId: null, connectionId: null, previousAccountId: null })
    );
    expect(await screen.findByText('Tự chọn MB …6789 · ưu tiên')).toBeInTheDocument();

    // Thu ngân mở ô tài khoản: chỉ "Tự chọn" + tài khoản trong danh sách (acc-other không có).
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Tài khoản ngân hàng' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent ?? '');
    expect(options[0]).toContain('Tự chọn theo cài đặt');
    expect(options.some((o) => o.includes('9999999999'))).toBe(false);
    expect(options.some((o) => o.includes('0123456789'))).toBe(true);
  });

  it('"Không cho đổi": ô tài khoản chỉ còn Tự chọn', async () => {
    api.getPosPaymentConnections.mockResolvedValue(routed('none'));
    api.createQrPayment.mockResolvedValue(qrResponse({ bankAccountId: 'acc-mb' }));

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Tài khoản ngân hàng' }));
    expect(await screen.findAllByRole('option')).toHaveLength(1);
  });

  it('chưa cấu hình: như cũ, theo tài khoản (không gửi auto)', async () => {
    api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [], configured: true, transfer: null });
    api.createQrPayment.mockResolvedValue(qrResponse());

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment.mock.calls[0][0]).not.toHaveProperty('auto');
    expect(api.createQrPayment).toHaveBeenCalledWith(expect.objectContaining({ bankAccountId: 'acc-mb' }));
  });
});
