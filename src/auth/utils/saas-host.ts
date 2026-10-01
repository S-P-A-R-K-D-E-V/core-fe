// ----------------------------------------------------------------------
// Nhận diện tên miền cửa hàng SaaS (<mã>.store.devbyspark.com; cửa hàng tạo trước đó còn ở
// <mã>.devbyspark.com) và trang đăng nhập tập trung (AUTH_HOST + các tên miền auth phụ). CiCi
// (cici21chualang.vn) và localhost không thuộc vùng nào nên giữ nguyên luồng đăng nhập cũ.
// Phải khớp Tenancy:SaasZones của core-be (vùng đầu = vùng cấp tên miền cho cửa hàng mới).
// ----------------------------------------------------------------------

export const SAAS_ZONES = (process.env.NEXT_PUBLIC_SAAS_ZONES || process.env.NEXT_PUBLIC_SAAS_ZONE || 'store.devbyspark.com,devbyspark.com')
  .split(',')
  .map((z) => z.trim().toLowerCase())
  .filter(Boolean);

/** Vùng cấp tên miền cho cửa hàng mới. */
export const SAAS_ZONE = SAAS_ZONES[0];

// Trang đăng nhập tập trung: tên miền khai báo với Google (Authorized JavaScript origins) và Apple
// (Services ID → Domains/Return URLs). Link MỚI (web cửa hàng, app) luôn trỏ về AUTH_HOST.
// AUTH_HOST_ALIASES: tên miền auth khác vẫn phục vụ đầy đủ trong lúc chuyển tên miền (link cũ, app đã
// cài) — mỗi tên miền ở đây cũng phải còn khai báo với Google/Apple. Đang chuyển
// auth.devbyspark.com → auth.store.devbyspark.com (tách khỏi các app khác dưới devbyspark.com).
export const AUTH_HOST = (process.env.NEXT_PUBLIC_AUTH_HOST || 'auth.devbyspark.com').trim().toLowerCase();

export const AUTH_HOST_ALIASES = (process.env.NEXT_PUBLIC_AUTH_HOST_ALIASES ?? 'auth.store.devbyspark.com')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter((h) => h && h !== AUTH_HOST);

/** Services ID của Sign in with Apple cho web. Rỗng = ẩn nút Apple. */
export const APPLE_SERVICES_ID = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID || '';

const TENANT_CODE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

export function isValidTenantCode(code: string | null | undefined): code is string {
  return !!code && TENANT_CODE.test(code);
}

export function isAuthHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return h === AUTH_HOST || AUTH_HOST_ALIASES.includes(h);
}

/**
 * Mã cửa hàng nếu host là <mã>.<một vùng SaaS> (không tính auth host), ngược lại null. Vùng dài
 * hơn được xét trước: ducna.store.devbyspark.com là "ducna", không phải "ducna.store".
 */
export function tenantCodeFromHost(host: string): string | null {
  const h = host.toLowerCase().split(':')[0];
  if (isAuthHost(host) || isAuthHost(h) || SAAS_ZONES.includes(h)) return null;

  const zones = [...SAAS_ZONES].sort((a, b) => b.length - a.length);
  const zone = zones.find((z) => h.endsWith(`.${z}`));
  if (!zone) return null;

  const code = h.slice(0, -(zone.length + 1));
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
  // Tên miền đang dùng (vùng mới hay cũ) để trang auth hiển thị và quay về đúng chỗ.
  url.searchParams.set('host', window.location.host.toLowerCase());
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
