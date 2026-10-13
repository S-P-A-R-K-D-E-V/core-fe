import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Làm mới access token khi hết hạn (hợp đồng với core-be): POST /auth/refresh-token phải kèm sessionToken của
// trình duyệt này — BE chỉ cấp token mới cho một phiên còn mở và gắn token với phiên đó. Thiếu sessionToken
// thì BE trả 400 và trình duyệt bị đưa về trang đăng nhập.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  post: vi.fn(),
  defaults: { headers: { common: {} as Record<string, string> } },
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// Imported after the mock above.
import { tokenExpired } from 'src/auth/context/jwt/utils';

function base64Url(value: object): string {
  return window.btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Token mới còn hạn 1 giờ (hạn quá xa làm setTimeout tràn số và chạy ngay — không phải tình huống thật).
const FRESH_TOKEN = [
  base64Url({ alg: 'HS256', typ: 'JWT' }),
  base64Url({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }),
  'sig',
].join('.');

const realLocation = window.location;
const reload = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'https://shop.example.test/dashboard/', pathname: '/dashboard/', reload },
  });
  http.post.mockResolvedValue({ data: { token: FRESH_TOKEN, refreshToken: 'refresh-2' } });
});

afterEach(() => {
  // Bỏ các hẹn giờ còn lại (setSession hẹn giờ cho token mới) trước khi trả lại đồng hồ thật.
  vi.clearAllTimers();
  vi.useRealTimers();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('tokenExpired', () => {
  it('hết hạn → làm mới kèm sessionToken của trình duyệt này', async () => {
    sessionStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('sessionToken', 'tok-laptop');

    tokenExpired(Math.floor(Date.now() / 1000) + 5);
    await vi.advanceTimersByTimeAsync(6000);

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith('/auth/refresh-token', {
      refreshToken: 'refresh-1',
      sessionToken: 'tok-laptop',
    });
    expect(sessionStorage.getItem('accessToken')).toBe(FRESH_TOKEN);
    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-2');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('BE từ chối (phiên đã bị đăng xuất từ xa) → xoá token và về trang đăng nhập', async () => {
    sessionStorage.setItem('accessToken', 'old');
    sessionStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('sessionToken', 'tok-laptop');
    http.post.mockRejectedValue({ status: 400, title: 'Invalid or expired login session.' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    tokenExpired(Math.floor(Date.now() / 1000) + 5);
    await vi.advanceTimersByTimeAsync(6000);

    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(window.location.href).toBe('/auth/jwt/login');
    expect(reload).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
