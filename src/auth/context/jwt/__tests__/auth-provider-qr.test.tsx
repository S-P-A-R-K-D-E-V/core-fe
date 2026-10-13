import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

// ----------------------------------------------------------------------
// Phiên đăng nhập bằng mã QR (hợp đồng với core-be): POST /auth/qr/exchange { code, codeVerifier } trả
// IAuthResponse KHÔNG có refreshToken — phiên sống 12 giờ không gia hạn.
//  - refreshToken còn sót của lần đăng nhập trước trong tab phải bị xoá (không thì nó được dùng để xin
//    access token mới vượt hạn phiên);
//  - đăng xuất vẫn phải báo BE đóng phiên dù không có refreshToken.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// setSession thật hẹn giờ hết hạn token + gắn header axios — ở đây chỉ cần biết nó được gọi thế nào.
const session = vi.hoisted(() => ({
  setSession: vi.fn(),
  refreshToken: null as string | null,
}));
vi.mock('src/auth/context/jwt/utils', () => ({
  setSession: session.setSession,
  isValidToken: () => false,
  getRefreshToken: () => session.refreshToken,
}));

// Imported after the mocks above so the provider picks up the mocked modules.
import { AuthContext } from 'src/auth/context/jwt/auth-context';
import { AuthProvider } from 'src/auth/context/jwt/auth-provider';

const QR_AUTH_RESPONSE = {
  id: 'user-1',
  firstName: 'Lan',
  lastName: 'Nguyễn',
  email: 'lan@example.com',
  token: 'access-qr',
  refreshToken: null,
  refreshTokenExpiryTime: null,
  role: 'Staff',
  roles: ['Staff'],
  permissions: [],
  requiresOtpVerification: false,
  emailConfirmed: true,
  sessionToken: 'session-qr',
};

async function renderProvider() {
  const ctx: { current: any } = { current: null };
  function Probe() {
    ctx.current = useContext(AuthContext);
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(ctx.current?.loading).toBe(false));
  return ctx;
}

describe('AuthProvider — đăng nhập bằng mã QR', () => {
  beforeEach(() => {
    session.refreshToken = null;
    session.setSession.mockReset();
    http.get.mockReset().mockResolvedValue({ data: {} });
    http.post.mockReset().mockImplementation(async (url: string) => {
      if (url === '/auth/qr/exchange') return { data: QR_AUTH_RESPONSE };
      return { data: {} };
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('đổi mã + verifier lấy phiên, lưu sessionToken, không giữ refreshToken cũ', async () => {
    const ctx = await renderProvider();

    await act(async () => {
      await ctx.current.loginWithQr('code-1', 'verifier-1');
    });

    expect(http.post).toHaveBeenCalledWith('/auth/qr/exchange', { code: 'code-1', codeVerifier: 'verifier-1' });
    // Xoá phiên cũ trong tab trước, rồi mới đặt access token mới (không có refreshToken).
    expect(session.setSession.mock.calls).toEqual([[null], ['access-qr', null]]);
    expect(localStorage.getItem('sessionToken')).toBe('session-qr');
    expect(ctx.current.user).toMatchObject({ id: 'user-1', role: 'Staff', accessToken: 'access-qr' });
    expect(ctx.current.authenticated).toBe(true);
  });

  it('đổi mã bị BE từ chối → không đăng nhập, không lưu gì', async () => {
    http.post.mockRejectedValue({ status: 400, title: 'Mã đăng nhập đã hết hạn hoặc không hợp lệ.' });
    const ctx = await renderProvider();

    await expect(ctx.current.loginWithQr('code-1', 'verifier-1')).rejects.toMatchObject({ status: 400 });

    expect(session.setSession).not.toHaveBeenCalled();
    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(ctx.current.user).toBeNull();
  });

  it('đăng xuất phiên QR (không có refreshToken) vẫn báo BE đóng đúng phiên đó', async () => {
    const ctx = await renderProvider();
    await act(async () => {
      await ctx.current.loginWithQr('code-1', 'verifier-1');
    });
    http.post.mockClear();

    await act(async () => {
      await ctx.current.logout();
    });

    expect(http.post).toHaveBeenCalledWith('/auth/logout', { userId: 'user-1', sessionToken: 'session-qr' });
    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(ctx.current.user).toBeNull();
  });

  it('không có cả refreshToken lẫn sessionToken → không gọi BE, chỉ xoá phiên cục bộ', async () => {
    const ctx = await renderProvider();
    await act(async () => {
      await ctx.current.loginWithQr('code-1', 'verifier-1');
    });
    localStorage.removeItem('sessionToken');
    http.post.mockClear();

    await act(async () => {
      await ctx.current.logout();
    });

    expect(http.post).not.toHaveBeenCalled();
    expect(ctx.current.user).toBeNull();
  });
});
