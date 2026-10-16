import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// F&B: chuyển khoản chọn được nguồn xác nhận (ApiPay — VA) — QR tạo theo kết nối, "Tài khoản nhận" vẫn là tài khoản ghi
// sổ; kết nối lỗi thì báo đúng lý do máy chủ trả.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  createQrPayment: vi.fn(),
  getQrPaymentStatus: vi.fn(),
  cancelQrPayment: vi.fn(),
  getPosPaymentConnections: vi.fn(),
  getBankAccounts: vi.fn(),
}));

// Màn hình khách: không gọi API quảng cáo trong test.
vi.mock('src/sections/customer-display/use-customer-display-sync', () => ({ useCustomerDisplaySync: () => {} }));
vi.mock('src/api/payment-qr', () => ({
  createQrPayment: api.createQrPayment,
  getQrPaymentStatus: api.getQrPaymentStatus,
  cancelQrPayment: api.cancelQrPayment,
  getPosPaymentConnections: api.getPosPaymentConnections,
}));

vi.mock('src/api/bank-accounts', () => ({ getBankAccounts: api.getBankAccounts }));

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
import FnbCheckoutDialog from 'src/sections/fnb-pos/fnb-checkout-dialog';

const apiPay = {
  id: 'conn-apipay',
  provider: 'apipay',
  kind: 'bank_feed',
  displayName: 'ApiPay MB',
  bin: '970422',
  accountNumber: '9704229999',
  environment: 'live',
  bankAccountId: null,
  bankName: 'MB',
};

function renderDialog() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <FnbCheckoutDialog
        open
        order={{ id: 'oo-1', tableName: 'Bàn 3', displayNo: 12 } as any}
        total={85000}
        hasDrafts={false}
        busy={false}
        onClose={() => {}}
        onPay={() => {}}
      />
    </ThemeProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.getBankAccounts.mockResolvedValue([
    { id: 'acc-mb', bankName: 'MB Bank', shortName: 'MB', accountNumber: '0123456789' },
  ]);
  api.getPosPaymentConnections.mockResolvedValue({ enabled: true, connections: [apiPay] });
  api.getQrPaymentStatus.mockResolvedValue({ id: 'qr-1', status: 'INIT' });
  api.cancelQrPayment.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function chooseTransferWithApiPay(user: ReturnType<typeof userEvent.setup>) {
  renderDialog();
  await user.click(screen.getByRole('button', { name: 'Chuyển khoản' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Xác nhận chuyển khoản' })).toBeInTheDocument()
  );
  await user.click(screen.getByRole('combobox', { name: 'Xác nhận chuyển khoản' }));
  await user.click(await screen.findByRole('option', { name: /ApiPay — MB 9704229999/ }));
}

describe('FnbCheckoutDialog — nguồn xác nhận chuyển khoản', () => {
  it('chọn ApiPay: tạo QR theo kết nối, vẫn gửi tài khoản ghi sổ', async () => {
    const user = userEvent.setup();
    api.createQrPayment.mockResolvedValue({
      id: 'qr-1',
      amount: 85000,
      status: 'INIT',
      createdAt: '2026-10-15T10:00:00Z',
      qrDataUrl: 'https://img.vietqr.io/qr.png',
      bankName: 'MB',
      accountNumber: '9704229999',
      paymentCode: 'SPAB12CD3',
      connectionId: 'conn-apipay',
    });

    await chooseTransferWithApiPay(user);
    await user.click(screen.getByRole('button', { name: 'Hiện mã QR' }));

    await waitFor(() => expect(api.createQrPayment).toHaveBeenCalledTimes(1));
    expect(api.createQrPayment).toHaveBeenCalledWith({
      connectionId: 'conn-apipay',
      bankAccountId: 'acc-mb',
      amount: 85000,
      description: 'Bàn 3 #12',
    });
    expect(
      await screen.findByText(/đang chờ tiền về qua ApiPay; tiền về là tự thanh toán/)
    ).toBeInTheDocument();
    expect(screen.getByText('Nội dung CK: SPAB12CD3')).toBeInTheDocument();
  });

  it('kết nối lỗi: báo lý do máy chủ trả', async () => {
    const user = userEvent.setup();
    api.createQrPayment.mockRejectedValue({
      title: 'Không tạo được mã QR qua ApiPay MB: Không kết nối được dịch vụ thanh toán.',
    });

    await chooseTransferWithApiPay(user);
    await user.click(screen.getByRole('button', { name: 'Hiện mã QR' }));

    expect(
      await screen.findByText(
        'Không tạo được mã QR qua ApiPay MB: Không kết nối được dịch vụ thanh toán. — chọn nguồn khác hoặc thanh toán bằng tay.'
      )
    ).toBeInTheDocument();
  });
});
