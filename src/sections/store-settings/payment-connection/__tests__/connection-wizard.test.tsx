import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPaymentProviderInfo } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Trình hướng dẫn kết nối qua S Payment: dịch vụ gom nhóm → tài khoản nhận (ngân hàng trực tiếp chỉ tài khoản cùng ngân
// hàng, hoặc để trống = mọi tài khoản cùng ngân hàng) → thông tin kết nối; cổng thanh toán bỏ bước tài khoản.
// ----------------------------------------------------------------------

const createPaymentConnection = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  createPaymentConnection: (...args: any[]) => createPaymentConnection(...args),
}));
vi.mock('src/api/bank-accounts', () => ({
  getVietQRBanks: vi.fn().mockResolvedValue([]),
  createBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
}));
vi.mock('src/components/iconify', () => ({ default: () => null }));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));

// Imported after the mocks above.
import ConnectionWizardDialog from '../connection-wizard-dialog';

const field = (key: string, label: string, required = false, secret = false) => ({
  key,
  label,
  required,
  secret,
  type: 'text' as const,
});

const PROVIDERS: IPaymentProviderInfo[] = [
  {
    key: 'mockbank',
    kind: 'bank_direct',
    displayName: 'Ngân hàng giả lập (sandbox nội bộ)',
    summary: 'Giả lập',
    free: true,
    fields: [],
    setupSteps: [],
    hasCertificationSuite: true,
  },
  {
    key: 'vietinbank',
    kind: 'bank_direct',
    displayName: 'VietinBank — VietQR Pay / Thông báo biến động số dư (Open API)',
    summary: 'VietQR Pay qua tài khoản định danh.',
    free: true,
    portalUrl: 'https://openapi.vietinbank.vn/',
    fields: [
      field('clientId', 'Client ID (X-IBM-Client-Id)', true),
      field('vaPrefix', 'Đầu mã tài khoản định danh (VAC)'),
    ],
    setupSteps: ['Đăng ký portal openapi.vietinbank.vn bằng mã số thuế.'],
    hasCertificationSuite: true,
  },
  {
    key: 'apipay',
    kind: 'bank_feed',
    displayName: 'ApiPay — biến động số dư',
    summary: 'Một tài khoản ApiPay gắn được nhiều ngân hàng.',
    free: true,
    fields: [field('accessKey', 'Access key', true, true)],
    setupSteps: [],
    hasCertificationSuite: false,
  },
  {
    key: 'payos',
    kind: 'gateway',
    displayName: 'payOS — cổng thanh toán',
    summary: 'Trang thanh toán.',
    free: false,
    fields: [field('clientId', 'Client ID', true)],
    setupSteps: [],
    hasCertificationSuite: false,
  },
];

const ACCOUNTS = [
  {
    id: 'acc-vtb',
    label: 'VietinBank · 103885549137 · HKD CICI',
    bin: '970415',
    accountNumber: '103885549137',
  },
  { id: 'acc-mb', label: 'MB · 0123456789', bin: '970422', accountNumber: '0123456789' },
];

function renderWizard(props: Partial<React.ComponentProps<typeof ConnectionWizardDialog>> = {}) {
  const onSaved = vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <ConnectionWizardDialog
        open
        providers={PROVIDERS}
        bankAccounts={ACCOUNTS}
        onClose={vi.fn()}
        onSaved={onSaved}
        {...props}
      />
    </ThemeProvider>
  );
  return { onSaved };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConnectionWizardDialog', () => {
  it('gom dịch vụ theo nhóm và ẩn ngân hàng giả lập', () => {
    renderWizard();
    expect(screen.getByText('Ngân hàng trực tiếp')).toBeInTheDocument();
    expect(screen.getByText('Biến động số dư qua bên thứ ba')).toBeInTheDocument();
    expect(screen.getByText('Cổng thanh toán')).toBeInTheDocument();
    expect(screen.queryByText('Ngân hàng giả lập (sandbox nội bộ)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
  });

  it('ngân hàng trực tiếp: chỉ tài khoản cùng ngân hàng, gợi ý tên, gửi tài khoản đã chọn', async () => {
    const user = userEvent.setup();
    createPaymentConnection.mockResolvedValue({ id: 'conn-1', provider: 'vietinbank' });
    const { onSaved } = renderWizard();

    await user.click(screen.getByText(PROVIDERS[1].displayName));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    expect(screen.getByLabelText(ACCOUNTS[0].label)).toBeInTheDocument();
    expect(screen.queryByLabelText(ACCOUNTS[1].label)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Không gắn — mọi tài khoản VietinBank của cửa hàng')
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText(ACCOUNTS[0].label));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    expect(screen.getByLabelText('Tên kết nối')).toHaveValue('VietinBank · 103885549137');
    const save = screen.getByRole('button', { name: 'Lưu kết nối' });
    expect(save).toBeDisabled(); // Client ID bắt buộc
    await user.type(screen.getByLabelText(/Client ID/), 'cid-123');
    await user.click(save);

    await waitFor(() =>
      expect(createPaymentConnection).toHaveBeenCalledWith({
        provider: 'vietinbank',
        displayName: 'VietinBank · 103885549137',
        bankAccountId: 'acc-vtb',
        credentials: { clientId: 'cid-123' },
      })
    );
    expect(onSaved).toHaveBeenCalledWith({ id: 'conn-1', provider: 'vietinbank' });
  });

  it('cổng thanh toán bỏ bước tài khoản và không gửi tài khoản', async () => {
    const user = userEvent.setup();
    createPaymentConnection.mockResolvedValue({ id: 'conn-2', provider: 'payos' });
    renderWizard();

    await user.click(screen.getByText('payOS — cổng thanh toán'));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(
      screen.queryByText('Tài khoản nhận', { selector: '.MuiStepLabel-label' })
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Client ID/), 'payos-1');
    await user.click(screen.getByRole('button', { name: 'Lưu kết nối' }));

    await waitFor(() =>
      expect(createPaymentConnection).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'payos', bankAccountId: undefined })
      )
    );
  });

  it('tạo từ một tài khoản: khoá dịch vụ ngân hàng khác, bỏ bước tài khoản', async () => {
    const user = userEvent.setup();
    renderWizard({ presetBankAccount: ACCOUNTS[1] });

    // Tài khoản MB → VietinBank không chọn được
    expect(
      screen.getByText('Chỉ dùng cho tài khoản mở tại chính ngân hàng này.')
    ).toBeInTheDocument();
    await user.click(screen.getByText('ApiPay — biến động số dư'));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(screen.getByLabelText('Tên kết nối')).toHaveValue('ApiPay · 0123456789');
  });
});
