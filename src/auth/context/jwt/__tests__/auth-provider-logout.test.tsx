import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

// ----------------------------------------------------------------------
// Đăng xuất (hợp đồng với core-be): POST /auth/logout kèm sessionToken của trình duyệt này → BE chỉ đóng
// đúng phiên đăng nhập đó (user lấy từ JWT). Không có sessionToken → giữ cách cũ (đóng mọi phiên).
// Dù gọi API thành công hay lỗi, máy này luôn xoá phiên cục bộ.
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
  await waitFor(() => expect(ctx.current?.user?.id).toBe('user-1'));
  return ctx;
}

describe('AuthProvider.logout', () => {
  beforeEach(() => {
    http.get.mockReset().mockResolvedValue({ data: {} });
    http.post.mockReset().mockResolvedValue({ data: {} });
    sessionStorage.setItem('accessToken', ACCESS_TOKEN);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('gửi sessionToken của trình duyệt này → BE chỉ đóng phiên đó', async () => {
    localStorage.setItem('sessionToken', 'session-abc');
    const ctx = await renderProvider();

    await act(async () => {
      await ctx.current.logout();
    });

    expect(http.post).toHaveBeenCalledWith('/auth/logout', {
      userId: 'user-1',
      sessionToken: 'session-abc',
    });
    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(ctx.current.user).toBeNull();
  });

  it('không có sessionToken → giữ cách cũ (không gửi trường sessionToken)', async () => {
    const ctx = await renderProvider();

    await act(async () => {
      await ctx.current.logout();
    });

    expect(http.post).toHaveBeenCalledWith('/auth/logout', { userId: 'user-1' });
    expect(ctx.current.user).toBeNull();
  });

  it('API đăng xuất lỗi → vẫn xoá phiên cục bộ', async () => {
    localStorage.setItem('sessionToken', 'session-abc');
    http.post.mockRejectedValueOnce(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = await renderProvider();

    await act(async () => {
      await ctx.current.logout();
    });

    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(ctx.current.user).toBeNull();
    errorSpy.mockRestore();
  });
});
