import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trang link mời /invite/[token]:
//  - link hết hạn / đã dùng → báo lý do, không có nút đăng nhập;
//  - tài khoản khách đang đăng nhập → "Nhận lời mời" gọi /staff-invites/accept, nhận phiên mới rồi sang /invite/done;
//  - chưa đăng nhập (CiCi) → Google kèm mã mời;
//  - chưa đăng nhập (cửa hàng SaaS) → đăng nhập tập trung mang theo mã mời.
// ----------------------------------------------------------------------

const TOKEN = 'a'.repeat(43);

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('src/routes/hooks', () => ({ useRouter: () => router }));

const auth = vi.hoisted(() => ({ value: {} as any }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth.value }));

const saas = vi.hoisted(() => ({ tenant: null as string | null, begin: vi.fn() }));
vi.mock('src/auth/utils/saas-host', () => ({
  APPLE_SERVICES_ID: '',
  tenantCodeFromHost: () => saas.tenant,
  beginCentralLogin: saas.begin,
}));

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: any) => (
    <button type="button" onClick={() => onSuccess({ credential: 'google-id-token' })}>
      Google
    </button>
  ),
}));

vi.mock('src/components/iconify', () => ({ default: () => null }));

// Imported after the mocks above so the view picks up the mocked modules.
import StaffInviteView from 'src/sections/invite/staff-invite-view';

const PREVIEW = {
  storeName: 'CiCi Accessories',
  role: 'Staff',
  status: 'Pending',
  expiresAt: '2026-11-09T04:00:00Z',
  emailHint: null,
  branchNames: [],
};

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <StaffInviteView token={TOKEN} />
    </ThemeProvider>
  );
}

describe('StaffInviteView', () => {
  beforeEach(() => {
    http.post.mockReset();
    router.replace.mockReset();
    saas.begin.mockReset();
    saas.tenant = null;
    auth.value = { authenticated: false, loading: false, user: null, loginWithOAuth: vi.fn(), loginWithAuthResponse: vi.fn() };
  });

  it('explains a used link and offers no sign-in', async () => {
    http.post.mockResolvedValueOnce({ data: { ...PREVIEW, status: 'Accepted' } });

    renderView();

    expect(await screen.findByText(/đã được dùng/)).toBeTruthy();
    expect(screen.queryByText('Google')).toBeNull();
    expect(http.post).toHaveBeenCalledWith('/staff-invites/preview', { token: TOKEN });
  });

  it('lets a signed-in guest accept and swaps to the new session', async () => {
    const session = { token: 'jwt-staff', roles: ['Staff'] };
    auth.value = {
      ...auth.value,
      authenticated: true,
      user: { email: 'lan@gmail.com', role: 'User', roles: ['User'] },
    };
    http.post.mockResolvedValueOnce({ data: PREVIEW }).mockResolvedValueOnce({ data: session });

    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Nhận lời mời' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/invite/done'));
    expect(http.post).toHaveBeenLastCalledWith('/staff-invites/accept', { token: TOKEN });
    expect(auth.value.loginWithAuthResponse).toHaveBeenCalledWith(session);
  });

  it('tells existing staff they are already in instead of offering to accept', async () => {
    auth.value = { ...auth.value, authenticated: true, user: { email: 'nv@cici.vn', role: 'Staff', roles: ['Staff'] } };
    http.post.mockResolvedValueOnce({ data: PREVIEW });

    renderView();

    expect(await screen.findByText(/đã là nhân viên/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nhận lời mời' })).toBeNull();
  });

  it('signs in with Google carrying the invite token on a store domain', async () => {
    http.post.mockResolvedValueOnce({ data: PREVIEW });

    renderView();
    fireEvent.click(await screen.findByText('Google'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/invite/done'));
    expect(auth.value.loginWithOAuth).toHaveBeenCalledWith('google', 'google-id-token', undefined, TOKEN);
  });

  it('sends SaaS stores through central sign-in with the invite token', async () => {
    saas.tenant = 'huang';
    http.post.mockResolvedValueOnce({ data: PREVIEW });

    renderView();
    fireEvent.click(await screen.findByRole('button', { name: /Tiếp tục với Google/ }));

    expect(saas.begin).toHaveBeenCalledWith('google', '/invite/done', null, TOKEN);
  });
});
