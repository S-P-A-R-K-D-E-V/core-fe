import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// ----------------------------------------------------------------------
// Khôi phục phiên thiết bị (POST /auth/restore-session, hạn trượt 30 ngày): mở trang không còn access
// token thì đổi sessionToken lấy token mới. sessionToken chỉ bị xoá khi BE trả lời từ chối (4xx) — mất
// mạng / lỗi máy chủ / cổng lỗi thì giữ lại để lần mở sau tự vào lại, không bắt đăng nhập lại.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// setSession thật hẹn giờ refresh token + gắn header axios — không cần trong test này.
vi.mock('src/auth/context/jwt/utils', () => ({
  setSession: vi.fn(),
  isValidToken: () => true,
  getRefreshToken: () => 'refresh-1',
}));

// Imported after the mocks above so the provider picks up the mocked modules.
import { AuthContext } from 'src/auth/context/jwt/auth-context';
import { AuthProvider } from 'src/auth/context/jwt/auth-provider';

function base64Url(value: object): string {
  return window
    .btoa(JSON.stringify(value))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const ACCESS_TOKEN = [
  base64Url({ alg: 'HS256', typ: 'JWT' }),
  base64Url({ sub: 'user-1', role: 'Staff', exp: 4102444800 }),
  'sig',
].join('.');

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

describe('AuthProvider — khôi phục phiên thiết bị', () => {
  beforeEach(() => {
    http.get.mockReset().mockResolvedValue({ data: {} });
    http.post.mockReset();
    // Tab mới: chưa có access token, chỉ còn sessionToken của thiết bị
    localStorage.setItem('sessionToken', 'session-abc');
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('BE nhận phiên → vào lại, lưu sessionToken BE trả về', async () => {
    http.post.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'nv@cici.vn',
        firstName: 'Nhân',
        lastName: 'Viên',
        roles: ['Staff'],
        token: ACCESS_TOKEN,
        refreshToken: 'refresh-2',
        sessionToken: 'session-rotated',
      },
    });

    const ctx = await renderProvider();

    expect(http.post).toHaveBeenCalledWith('/auth/restore-session', {
      sessionToken: 'session-abc',
    });
    expect(ctx.current.user?.id).toBe('user-1');
    expect(localStorage.getItem('sessionToken')).toBe('session-rotated');
  });

  it('BE từ chối phiên (400 User.InvalidSession) → xoá sessionToken, về đăng nhập', async () => {
    http.post.mockRejectedValue({
      status: 400,
      title: 'Invalid or expired login session.',
      errors: { 'User.InvalidSession': ['Invalid or expired login session.'] },
    });

    const ctx = await renderProvider();

    expect(ctx.current.user).toBeNull();
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });

  it('mất mạng lúc mở trang → chưa vào được nhưng GIỮ sessionToken cho lần sau', async () => {
    // axios interceptor reject bằng chuỗi khi không có response
    http.post.mockRejectedValue('Something went wrong');

    const ctx = await renderProvider();

    expect(ctx.current.user).toBeNull();
    expect(localStorage.getItem('sessionToken')).toBe('session-abc');
  });

  it('lỗi máy chủ (500) → giữ sessionToken', async () => {
    http.post.mockRejectedValue({ status: 500, title: 'An error occurred while processing.' });

    const ctx = await renderProvider();

    expect(ctx.current.user).toBeNull();
    expect(localStorage.getItem('sessionToken')).toBe('session-abc');
  });
});
