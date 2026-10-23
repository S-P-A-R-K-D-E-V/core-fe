import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Thu ngân chọn nguồn xác nhận chuyển khoản khi tạo QR (Bán hàng / ngăn thanh toán): mặc định theo tài khoản như cũ;
// chọn kết nối (ApiPay — VA) thì QR tạo theo connectionId, không gửi tài khoản; lỗi thì báo, không hiện mã khác.
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

describe('PosQrPayment — nguồn xác nhận chuyển khoản', () => {
  it('không có kết nối: như cũ, tạo QR theo tài khoản, không hiện ô chọn nguồn', async () => {
    api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [] });
    api.createQrPayment.mockResolvedValue(qrResponse());

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith({
      salesOrderId: 'so-1',
      bankAccountId: 'acc-mb',
      connectionId: null,
      amount: 150000,
      description: 'Thanh toan HD001',
    });
    expect(screen.queryByRole('combobox', { name: FIELD })).not.toBeInTheDocument();
    expect(await screen.findByAltText('QR Code thanh toán')).toBeInTheDocument();
    expect(screen.queryByText(/Tiền về qua/)).not.toBeInTheDocument();
  });

  it('chọn ApiPay: tạo lại QR theo kết nối (không gửi tài khoản), ẩn ô tài khoản, ghi nhớ lựa chọn', async () => {
    const user = userEvent.setup();
    api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [apiPay] });
    api.createQrPayment
      .mockResolvedValueOnce(qrResponse())
      .mockResolvedValueOnce(
        qrResponse({
          id: 'qr-2',
          accountNumber: '9704229999',
          paymentCode: 'SPZZ99XX1',
          connectionId: 'conn-apipay',
        })
      );

    renderQr();
    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenLastCalledWith(
      expect.objectContaining({ bankAccountId: 'acc-mb', connectionId: null })
    );
    expect(screen.getByRole('combobox', { name: 'Tài khoản ngân hàng' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: FIELD }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual([
      'Theo tài khoản ngân hàng',
      'ApiPay — MB 9704229999Thử nghiệm',
    ]);
    await user.click(screen.getByRole('option', { name: /ApiPay — MB 9704229999/ }));

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(2));
    expect(api.createQrPayment).toHaveBeenLastCalledWith({
      salesOrderId: 'so-1',
      bankAccountId: null,
      connectionId: 'conn-apipay',
      amount: 150000,
      description: 'Thanh toan HD001',
    });
    expect(await screen.findByText('MB - 9704229999')).toBeInTheDocument();
    expect(
      screen.getByText(/Tiền về qua ApiPay là đơn tự xác nhận \(thử nghiệm\)/)
    ).toBeInTheDocument();
    expect(screen.getByText('Nội dung CK: SPZZ99XX1')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tài khoản ngân hàng' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(POS_PAYMENT_CONNECTION_STORAGE_KEY)).toBe('conn-apipay');
  });

  it('lần sau mở lại dùng luôn kết nối đã chọn — không tạo mã theo tài khoản trước', async () => {
    window.localStorage.setItem(POS_PAYMENT_CONNECTION_STORAGE_KEY, 'conn-apipay');
    api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [apiPay] });
    api.createQrPayment.mockResolvedValue(
      qrResponse({ connectionId: 'conn-apipay', accountNumber: '9704229999' })
    );

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'conn-apipay', bankAccountId: null })
    );
  });

  it('kết nối đã chọn lỗi: báo lý do của máy chủ, không hiện mã QR nào', async () => {
    window.localStorage.setItem(POS_PAYMENT_CONNECTION_STORAGE_KEY, 'conn-apipay');
    api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [apiPay] });
    api.createQrPayment.mockRejectedValue({
      title:
        'Kết nối xác nhận chuyển khoản đã tắt hoặc chưa gắn tài khoản nhận — chọn lại nguồn xác nhận.',
      status: 409,
    });

    renderQr();

    expect(
      await screen.findByText(
        'Kết nối xác nhận chuyển khoản đã tắt hoặc chưa gắn tài khoản nhận — chọn lại nguồn xác nhận.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByAltText('QR Code thanh toán')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('không lấy được danh sách kết nối: vẫn bán theo tài khoản như cũ', async () => {
    api.getPosPaymentConnections.mockRejectedValue({ title: 'spark-payment lỗi' });
    api.createQrPayment.mockResolvedValue(qrResponse());

    renderQr();

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith(
      expect.objectContaining({ bankAccountId: 'acc-mb', connectionId: null })
    );
    expect(screen.queryByRole('combobox', { name: FIELD })).not.toBeInTheDocument();
  });
});
