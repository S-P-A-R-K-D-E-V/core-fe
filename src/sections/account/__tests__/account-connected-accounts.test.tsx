import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Mỗi tài khoản liên kết MỘT Google / Apple / Facebook: đã có loại nào thì ẩn nút loại đó; dữ liệu cũ
// >1 cùng loại vẫn hiện đủ để gỡ; BE trả 409 Auth.ProviderAlreadyLinked → báo lỗi + tải lại danh sách.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

vi.mock('src/config-global', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/config-global')>()),
  FACEBOOK_APP_ID: 'fb-app',
}));

vi.mock('src/auth/utils/saas-host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/auth/utils/saas-host')>()),
  AUTH_HOST: 'auth.example.test',
  APPLE_SERVICES_ID: 'apple-services-id',
  // CiCi (không phải tên miền cửa hàng SaaS) → có Facebook
  tenantCodeFromHost: () => null,
}));

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { email: 'nv@cici.vn' } }),
}));

vi.mock('react-facebook-login/dist/facebook-login-render-props', () => ({
  default: ({ render: renderButton }: any) =>
    renderButton({ onClick: () => {}, isDisabled: false }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/custom-dialog', () => ({
  ConfirmDialog: () => null,
}));

// Imported after the mocks above so the component picks up the mocked modules.
import AccountConnectedAccounts from 'src/sections/account/account-connected-accounts';

const conn = (id: string, provider: string, email: string) => ({
  id,
  provider,
  email,
  connectedAt: '2026-10-01T00:00:00Z',
});

function renderPage() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <AccountConnectedAccounts />
    </ThemeProvider>
  );
}

beforeEach(() => {
  http.get.mockResolvedValue({ data: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AccountConnectedAccounts — một liên kết mỗi loại', () => {
  it('chưa liên kết gì → có đủ nút Google / Apple / Facebook', async () => {
    renderPage();

    expect(await screen.findByText('Liên kết Google')).toBeInTheDocument();
    expect(screen.getByText('Liên kết Apple')).toBeInTheDocument();
    expect(screen.getByText('Liên kết Facebook')).toBeInTheDocument();
  });

  it('đã có Google → ẩn nút Google, vẫn liên kết được Apple / Facebook', async () => {
    http.get.mockResolvedValue({ data: [conn('c1', 'google', 'a@gmail.com')] });

    renderPage();

    expect(await screen.findByText('Liên kết Apple')).toBeInTheDocument();
    expect(screen.getByText('Liên kết Facebook')).toBeInTheDocument();
    expect(screen.queryByText('Liên kết Google')).not.toBeInTheDocument();
    expect(screen.getByText(/Gỡ liên kết hiện tại rồi liên kết lại/)).toBeInTheDocument();
  });

  it('dữ liệu cũ có 2 Google + đủ loại → không còn nút liên kết, vẫn gỡ được từng cái', async () => {
    http.get.mockResolvedValue({
      data: [
        conn('c1', 'google', 'a@gmail.com'),
        conn('c2', 'google', 'b@gmail.com'),
        conn('c3', 'apple', 'x@icloud.com'),
        conn('c4', 'facebook', 'f@fb.com'),
      ],
    });

    renderPage();

    expect(await screen.findByText('Google · b@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Google · a@gmail.com')).toBeInTheDocument();
    expect(screen.getAllByText('Gỡ')).toHaveLength(4);
    expect(screen.queryByText(/^Liên kết (Google|Apple|Facebook)$/)).not.toBeInTheDocument();
  });

  it('409 Auth.ProviderAlreadyLinked khi bắt đầu liên kết → báo lỗi BE và tải lại danh sách', async () => {
    http.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [conn('c3', 'apple', 'x@icloud.com')] });
    http.post.mockRejectedValue({
      title: 'Tài khoản đã liên kết một tài khoản Apple khác.',
      status: 409,
      errorCodes: ['Auth.ProviderAlreadyLinked'],
    });

    renderPage();
    fireEvent.click(await screen.findByText('Liên kết Apple'));

    expect(
      await screen.findByText('Tài khoản đã liên kết một tài khoản Apple khác.')
    ).toBeInTheDocument();
    await waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Liên kết Apple')).not.toBeInTheDocument());
    expect(screen.getByText('Liên kết Google')).toBeInTheDocument();
  });
});
