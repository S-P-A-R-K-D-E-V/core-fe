// ----------------------------------------------------------------------
// Nhận diện tên miền cửa hàng SaaS (<mã>.devbyspark.com) và trang đăng nhập tập trung
// (auth.devbyspark.com). CiCi (cici21chualang.vn) và localhost không thuộc vùng này nên giữ
// nguyên luồng đăng nhập cũ.
// ----------------------------------------------------------------------

export const SAAS_ZONE = process.env.NEXT_PUBLIC_SAAS_ZONE || 'devbyspark.com';

export const AUTH_HOST = process.env.NEXT_PUBLIC_AUTH_HOST || `auth.${SAAS_ZONE}`;

/** Services ID của Sign in with Apple cho web. Rỗng = ẩn nút Apple. */
export const APPLE_SERVICES_ID = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID || '';

const TENANT_CODE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

export function isValidTenantCode(code: string | null | undefined): code is string {
  return !!code && TENANT_CODE.test(code);
}

export function isAuthHost(host: string): boolean {
  return host.toLowerCase() === AUTH_HOST;
}

/** Mã cửa hàng nếu host là <mã>.devbyspark.com (không tính auth.devbyspark.com), ngược lại null. */
export function tenantCodeFromHost(host: string): string | null {
  const h = host.toLowerCase().split(':')[0];
  if (isAuthHost(h) || !h.endsWith(`.${SAAS_ZONE}`)) return null;
  const code = h.slice(0, -(SAAS_ZONE.length + 1));
  return isValidTenantCode(code) ? code : null;
}

/** Chỉ nhận đường dẫn nội bộ ("/dashboard"), không nhận "//host", "/\host" hay URL tuyệt đối. */
export function safeReturnPath(path: string | null | undefined, fallback: string): string {
  if (!path || path.length > 512) return fallback;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return fallback;
  return path;
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// state chống login CSRF: trang cửa hàng sinh ra, giữ trong sessionStorage của CHÍNH tên miền cửa
// hàng; /sso/callback chỉ đổi mã khi state trên URL khớp.
const SSO_STATE_KEY = 'ssoState';
// App mobile mở trang đăng nhập với ?mobile=true&redirect_uri=<deep link>; phải nhớ deep link đó qua
// chuyến đi sang auth.devbyspark.com để /sso/callback trả phiên về app thay vì vào dashboard web.
const SSO_MOBILE_REDIRECT_KEY = 'ssoMobileRedirect';

export function beginCentralLogin(
  provider: 'google' | 'apple' | null,
  returnTo: string | null,
  mobileRedirectUri?: string | null
) {
  const code = tenantCodeFromHost(window.location.host);
  if (!code) return;

  const state = randomToken();
  sessionStorage.setItem(SSO_STATE_KEY, state);
  if (mobileRedirectUri) {
    sessionStorage.setItem(SSO_MOBILE_REDIRECT_KEY, mobileRedirectUri);
  } else {
    sessionStorage.removeItem(SSO_MOBILE_REDIRECT_KEY);
  }

  const url = new URL(`https://${AUTH_HOST}/sso/start/`);
  url.searchParams.set('tenant', code);
  url.searchParams.set('state', state);
  if (provider) url.searchParams.set('provider', provider);
  if (returnTo) url.searchParams.set('returnTo', returnTo);
  window.location.assign(url.toString());
}

export function takeCentralLoginState(): string | null {
  const state = sessionStorage.getItem(SSO_STATE_KEY);
  sessionStorage.removeItem(SSO_STATE_KEY);
  return state;
}

/** Deep link của app đã nhớ lúc bắt đầu đăng nhập (chưa kiểm tra — dùng buildMobileRedirectUrl). */
export function takeCentralLoginMobileRedirect(): string | null {
  const uri = sessionStorage.getItem(SSO_MOBILE_REDIRECT_KEY);
  sessionStorage.removeItem(SSO_MOBILE_REDIRECT_KEY);
  return uri;
}
