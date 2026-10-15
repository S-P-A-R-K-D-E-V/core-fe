import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPaymentConnection, IPaymentProviderInfo } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Hộp thoại kết nối đối soát (mục 7c): form dựng từ danh mục nhà cung cấp; cập nhật chỉ gửi phần đã đổi; khoá tự sinh
// hiện một lần và phải tick "Tôi đã lưu" mới đóng được.
// ----------------------------------------------------------------------

const createPaymentConnection = vi.fn();
const updatePaymentConnection = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  createPaymentConnection: (...args: any[]) => createPaymentConnection(...args),
  updatePaymentConnection: (...args: any[]) => updatePaymentConnection(...args),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

// Imported after the mocks above.
import ConnectionFormDialog from '../connection-form-dialog';
import ConnectionResultDialog from '../connection-result-dialog';

const PROVIDERS: IPaymentProviderInfo[] = [
  {
    key: 'mockbank',
    kind: 'bank_direct',
    displayName: 'Ngân hàng giả lập (sandbox nội bộ)',
    summary: 'Giả lập',
    free: true,
    portalUrl: null,
    fields: [],
    setupSteps: [],
    hasCertificationSuite: true,
  },
  {
    key: 'acb',
    kind: 'bank_direct',
    displayName: 'ACB — QR động (Open API)',
    summary: 'QR động gắn tài khoản định danh.',
    free: true,
    portalUrl: 'https://developer.acb.com.vn/',
    fields: [
      { key: 'clientId', label: 'Client ID', required: true, secret: false, type: 'text' },
      { key: 'clientSecret', label: 'Client secret', required: false, secret: true, type: 'text' },
      {
        key: 'merchantId',
        label: 'Merchant ID (MID)',
        required: false,
        secret: false,
        type: 'text',
      },
      {
        key: 'webhookApiKey',
        label: 'Webhook API key',
        required: false,
        secret: true,
        type: 'text',
      },
    ],
    setupSteps: ['Đăng ký tài khoản tổ chức tại developer.acb.com.vn.'],
    hasCertificationSuite: true,
  },
  {
    key: 'sepay',
    kind: 'bank_feed',
    displayName: 'SePay — biến động số dư',
    summary: 'Webhook + API giao dịch.',
    free: true,
    portalUrl: 'https://my.sepay.vn',
    fields: [
      {
        key: 'webhookAuth',
        label: 'Xác thực webhook',
        required: true,
        secret: false,
        type: 'select',
        options: ['hmac', 'apikey'],
      },
      {
        key: 'webhookSecret',
        label: 'Secret / API key webhook',
        required: true,
        secret: true,
        type: 'text',
      },
      {
        key: 'apiToken',
        label: 'API token (kéo giao dịch đối soát)',
        required: false,
        secret: true,
        type: 'text',
      },
    ],
    setupSteps: ['my.sepay.vn → Webhooks → Thêm webhook.'],
    hasCertificationSuite: false,
  },
];

const ACB_CONNECTION: IPaymentConnection = {
  id: 'c-acb',
  provider: 'acb',
  kind: 'bank_direct',
  displayName: 'ACB quầy',
  status: 'active',
  webhookUrl: 'https://pay/webhooks/bank/acb/tok/status',
  webhookUrls: {
    status: 'https://pay/webhooks/bank/acb/tok/status',
    'qr-transaction': 'https://pay/webhooks/bank/acb/tok/qr-transaction',
  },
  createdAt: '2026-10-15T00:00:00Z',
  publicSettings: { clientId: 'abcd…wxyz', merchantId: 'MID01' },
  missingSettings: ['terminalId'],
};

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConnectionFormDialog — tạo', () => {
  it('ẩn ngân hàng giả lập, khoá nhà ngân hàng trực tiếp khác ngân hàng, gửi credentials của nhà đã chọn kèm tài khoản', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    createPaymentConnection.mockResolvedValue({ ...ACB_CONNECTION, id: 'new' });

    wrap(
      <ConnectionFormDialog
        open
        mode="create"
        providers={PROVIDERS}
        presetBankAccount={{ id: 'acc-vcb', label: 'VCB · 0123 · NGUYEN A', bin: '970436' }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    expect(screen.queryByRole('radio', { name: /giả lập/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ACB/ })).toBeDisabled();

    const save = screen.getByRole('button', { name: 'Lưu kết nối' });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /SePay/ }));
    await user.type(
      screen.getByLabelText(/Secret \/ API key webhook/, { selector: 'input' }),
      '  s3cret '
    );
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createPaymentConnection).toHaveBeenCalledWith({
      provider: 'sepay',
      displayName: 'SePay — biến động số dư',
      bankAccountId: 'acc-vcb',
      credentials: { webhookAuth: 'hmac', webhookSecret: 's3cret' },
    });
  });
});

describe('ConnectionFormDialog — cập nhật', () => {
  it('điền sẵn ô không bí mật, ô bí mật trống = giữ nguyên, chỉ gửi phần đã đổi', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    updatePaymentConnection.mockResolvedValue(ACB_CONNECTION);

    wrap(
      <ConnectionFormDialog
        open
        mode="update"
        providers={PROVIDERS}
        connection={ACB_CONNECTION}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    expect(screen.getByLabelText(/Client ID/, { selector: 'input' })).toHaveValue('abcd…wxyz');
    expect(screen.getByLabelText(/Merchant ID/, { selector: 'input' })).toHaveValue('MID01');
    expect(screen.getByLabelText(/Client secret/, { selector: 'input' })).toHaveValue('');
    expect(screen.getByText(/Còn thiếu: terminalId/)).toBeInTheDocument();

    const save = screen.getByRole('button', { name: 'Lưu thay đổi' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/Client secret/, { selector: 'input' }), 'new-secret');
    await user.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updatePaymentConnection).toHaveBeenCalledWith('c-acb', {
      credentials: { clientSecret: 'new-secret' },
    });
  });
});

describe('ConnectionResultDialog', () => {
  it('khoá tự sinh: phải tick "Tôi đã lưu" mới đóng được; hiện mọi webhook URL', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    wrap(
      <ConnectionResultDialog
        connection={{ ...ACB_CONNECTION, generatedSecrets: { webhookApiKey: 'gen-key-123' } }}
        providers={PROVIDERS}
        reason="created"
        onClose={onClose}
      />
    );

    expect(screen.getByLabelText('Webhook API key')).toHaveValue('gen-key-123');
    expect(screen.getByLabelText('Webhook URL · status')).toHaveValue(
      'https://pay/webhooks/bank/acb/tok/status'
    );
    expect(screen.getByLabelText('Webhook URL · qr-transaction')).toHaveValue(
      'https://pay/webhooks/bank/acb/tok/qr-transaction'
    );

    const close = screen.getByRole('button', { name: 'Tôi đã lưu, đóng' });
    expect(close).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Tôi đã lưu các khoá/ }));
    expect(close).toBeEnabled();
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('không có khoá tự sinh → đóng được ngay', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    wrap(
      <ConnectionResultDialog
        connection={{ ...ACB_CONNECTION, generatedSecrets: null }}
        providers={PROVIDERS}
        reason="created"
        onClose={onClose}
      />
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xong' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
