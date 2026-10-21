import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPaymentConnection } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Cài đặt cửa hàng → Tài khoản ngân hàng (mục 7c): dịch vụ thanh toán bật → GET payment/bank-accounts (kèm kết nối đối
// soát, kết nối chưa gắn tài khoản); tắt → GET /bank-accounts?includeInactive=true, không có phần đối soát. Dòng
// KiotViet chỉ đọc.
// ----------------------------------------------------------------------

const getPaymentSettings = vi.fn();
const getPaymentProviders = vi.fn();
const getPaymentBankAccounts = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  getPaymentSettings: (...args: any[]) => getPaymentSettings(...args),
  getPaymentProviders: (...args: any[]) => getPaymentProviders(...args),
  getPaymentBankAccounts: (...args: any[]) => getPaymentBankAccounts(...args),
  createPaymentConnection: vi.fn(),
  updatePaymentConnection: vi.fn(),
  deletePaymentConnection: vi.fn(),
  syncPaymentConnection: vi.fn(),
  testPaymentConnection: vi.fn(),
  rotatePaymentWebhookSecret: vi.fn(),
  getBankLinkBanks: vi.fn().mockResolvedValue([]),
  registerBankLink: vi.fn(),
  confirmBankLink: vi.fn(),
}));

const getBankAccounts = vi.fn();
vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: (...args: any[]) => getBankAccounts(...args),
  getVietQRBanks: () =>
    Promise.resolve([
      {
        id: 1,
        bin: '970436',
        code: 'VCB',
        shortName: 'Vietcombank',
        name: 'Ngân hàng TMCP Ngoại Thương',
        logo: '',
        transferSupported: 1,
        lookupSupported: 1,
      },
      {
        id: 2,
        bin: '970416',
        code: 'ACB',
        shortName: 'ACB',
        name: 'Ngân hàng TMCP Á Châu',
        logo: '',
        transferSupported: 1,
        lookupSupported: 1,
      },
    ]),
  createBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
  deactivateBankAccount: vi.fn(),
  getBankAccountVietQr: vi.fn(),
}));

vi.mock('src/api/store-settings', () => ({
  getStoreBranding: () => Promise.resolve({ storeName: 'CiCi Accessories' }),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

// Imported after the mocks above.
import BankAccountsTab from '../bank-accounts-tab';

const renderTab = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <BankAccountsTab />
    </ThemeProvider>
  );

/** Thẻ tài khoản chứa số tài khoản này. */
const cardOf = async (accountNumber: string) =>
  (await screen.findByText(accountNumber)).closest('.MuiCard-root') as HTMLElement;

afterEach(() => {
  vi.clearAllMocks();
});

describe('BankAccountsTab — dịch vụ thanh toán tắt', () => {
  it('lấy GET /bank-accounts kèm dòng đã tắt; dòng KiotViet chỉ đọc; không có phần đối soát', async () => {
    getPaymentSettings.mockResolvedValue({
      enabled: false,
      paymentCodePrefix: 'SP',
      webhookBaseUrl: '',
    });
    getBankAccounts.mockResolvedValue([
      {
        id: 'kv',
        kiotVietId: 7,
        bankName: 'Vietcombank',
        bin: '970436',
        accountNumber: '0011223344',
        managedByKiotViet: true,
        isActive: true,
      },
      {
        id: 'own',
        bankName: 'Ngân hàng TMCP Á Châu',
        shortName: 'ACB',
        bin: '970416',
        accountNumber: '5566778899',
        accountHolder: 'NGUYEN VAN A',
        isDefault: false,
        isActive: false,
        managedByKiotViet: false,
      },
    ]);

    renderTab();

    const kiotviet = await cardOf('0011223344');
    expect(getBankAccounts).toHaveBeenCalledWith({ includeInactive: true });
    expect(getPaymentBankAccounts).not.toHaveBeenCalled();
    expect(within(kiotviet).getByText('Đồng bộ KiotViet (chỉ đọc)')).toBeInTheDocument();
    expect(within(kiotviet).queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(within(kiotviet).getByRole('button', { name: 'Mã VietQR' })).toBeInTheDocument();

    const own = await cardOf('5566778899');
    expect(within(own).getByText('Đang tắt')).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Bật lại' })).toBeInTheDocument();

    expect(screen.getByText(/Dịch vụ thanh toán chưa bật/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng ký báo có' })).not.toBeInTheDocument();
    expect(screen.queryByText('VietQR')).not.toBeInTheDocument();
  });
});

describe('BankAccountsTab — dịch vụ thanh toán bật', () => {
  it('lấy GET payment/bank-accounts: chế độ QR, kết nối theo tài khoản, kết nối chưa gắn tài khoản', async () => {
    const acbConnection: IPaymentConnection = {
      id: 'c1',
      provider: 'acb',
      kind: 'bank_direct',
      displayName: 'ACB QR động',
      status: 'active',
      webhookUrl: 'https://pay/webhooks/bank/acb/t/status',
      webhookUrls: { status: 'https://pay/webhooks/bank/acb/t/status' },
      bankAccount: { bin: '970416', accountNumber: '5566778899', accountName: 'NGUYEN VAN A' },
      lastWebhookAt: null,
      createdAt: '2026-10-15T00:00:00Z',
      missingSettings: [],
    };
    const sepayUnassigned: IPaymentConnection = {
      id: 'c2',
      provider: 'sepay',
      kind: 'bank_feed',
      displayName: 'SePay cũ',
      status: 'active',
      webhookUrl: 'https://pay/webhooks/sepay/t2',
      createdAt: '2026-10-15T00:00:00Z',
    };
    // Kết nối tạo từ đăng ký báo có: không có khoá, huỷ ở thẻ Đăng ký báo có.
    const vtbLinked: IPaymentConnection = {
      id: 'c3',
      provider: 'vietinbank',
      kind: 'bank_direct',
      displayName: 'VietinBank 116002680669',
      status: 'active',
      webhookUrl: 'https://pay/webhooks/bank/vietinbank/t3/notify-bill',
      bankAccount: { bin: '970415', accountNumber: '116002680669', accountName: 'CUA HANG A' },
      createdAt: '2026-10-21T00:00:00Z',
      publicSettings: { bankLinkId: 'l-1', accountNumber: '116002680669' },
      missingSettings: [],
    };
    getPaymentSettings.mockResolvedValue({
      enabled: true,
      paymentCodePrefix: 'SP',
      webhookBaseUrl: 'https://pay',
    });
    getPaymentProviders.mockResolvedValue([]);
    getPaymentBankAccounts.mockResolvedValue({
      enabled: true,
      accounts: [
        {
          id: 'own',
          bankName: 'Ngân hàng TMCP Á Châu',
          shortName: 'ACB',
          bin: '970416',
          accountNumber: '5566778899',
          accountHolder: 'NGUYEN VAN A',
          description: 'Quầy 1',
          isDefault: true,
          isActive: true,
          isManagedByKiotViet: false,
          qrMode: 'bank_direct',
          connections: [acbConnection],
        },
        {
          id: 'vcb',
          bankName: 'Vietcombank',
          bin: '970436',
          accountNumber: '0011223344',
          isDefault: false,
          isActive: true,
          isManagedByKiotViet: false,
          qrMode: 'vietqr',
          connections: [],
        },
        {
          id: 'vtb',
          bankName: 'VietinBank',
          bin: '970415',
          accountNumber: '103885549137',
          accountHolder: 'HO KINH DOANH CICI',
          isDefault: false,
          isActive: true,
          isManagedByKiotViet: false,
          qrMode: 'vietqr',
          connections: [],
        },
        {
          id: 'vtb-linked',
          bankName: 'VietinBank',
          bin: '970415',
          accountNumber: '116002680669',
          isDefault: false,
          isActive: true,
          isManagedByKiotViet: false,
          qrMode: 'bank_direct',
          connections: [vtbLinked],
        },
      ],
      unassignedConnections: [sepayUnassigned],
    });

    renderTab();

    const acb = await cardOf('5566778899');
    expect(getBankAccounts).not.toHaveBeenCalled();
    expect(within(acb).getByText('Mặc định')).toBeInTheDocument();
    expect(within(acb).getByText('QR qua ngân hàng')).toBeInTheDocument();
    expect(within(acb).getByText('ACB QR động')).toBeInTheDocument();
    expect(within(acb).getByRole('button', { name: 'Kiểm tra kết nối' })).toBeInTheDocument();
    expect(within(acb).queryByRole('button', { name: 'Đồng bộ' })).not.toBeInTheDocument();
    // Khoá ngân hàng do SPARK giữ ở S Payment: không có form khoá, khoá webhook, webhook URL.
    expect(within(acb).queryByRole('button', { name: 'Cập nhật' })).not.toBeInTheDocument();
    expect(within(acb).queryByRole('button', { name: 'Tạo lại khoá webhook' })).not.toBeInTheDocument();
    expect(within(acb).queryByText('https://pay/webhooks/bank/acb/t/status')).not.toBeInTheDocument();

    const vcb = await cardOf('0011223344');
    expect(within(vcb).getByText('VietQR')).toBeInTheDocument();
    expect(within(vcb).getByText(/hỗ trợ tài khoản VietinBank và MB/)).toBeInTheDocument();
    expect(within(vcb).queryByRole('button', { name: 'Đăng ký báo có' })).not.toBeInTheDocument();

    const vtb = await cardOf('103885549137');
    expect(within(vtb).getByRole('button', { name: 'Đăng ký báo có' })).toBeInTheDocument();

    const linked = await cardOf('116002680669');
    expect(within(linked).getByText('Đăng ký báo có')).toBeInTheDocument();
    // Chỉ còn nút Tắt của chính tài khoản — kết nối báo có không tắt ở đây.
    expect(within(linked).getAllByRole('button', { name: 'Tắt' })).toHaveLength(1);
    expect(within(linked).queryByRole('button', { name: 'Kiểm tra kết nối' })).not.toBeInTheDocument();
    expect(within(linked).queryByRole('button', { name: 'Đăng ký báo có' })).not.toBeInTheDocument();

    const unassigned = (await screen.findByText('Kết nối chưa gắn tài khoản')).closest(
      '.MuiCard-root'
    ) as HTMLElement;
    expect(within(unassigned).getByText('SePay cũ')).toBeInTheDocument();
    expect(within(unassigned).getByText(/Chưa gắn tài khoản nhận/)).toBeInTheDocument();
    expect(within(unassigned).getByRole('button', { name: 'Đồng bộ' })).toBeInTheDocument();
  });
});
