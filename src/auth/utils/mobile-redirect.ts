// ----------------------------------------------------------------------

/**
 * Luồng đăng nhập của app mobile: app mở trang login web với `?mobile=true&redirect_uri=...`,
 * đăng nhập xong web chuyển về `redirect_uri` kèm sessionToken. Chỉ được chuyển về deep link của
 * chính app CiCi — mọi địa chỉ khác (https, javascript:, data:, //host...) đều bị bỏ qua, nếu không
 * một đường link giả là đủ để lấy token phiên của người đang đăng nhập.
 *
 * `corecms:` là scheme của core-mobile (app.json). `exp:`/`exp+cms:` của Expo Go chỉ được bật khi
 * đặt NEXT_PUBLIC_ALLOW_EXPO_REDIRECT=true (máy dev), vì app nào cũng mở được link exp://.
 */
const APP_SCHEMES = ['corecms:'];
const EXPO_SCHEMES = ['exp:', 'exp+cms:'];

function allowedSchemes(): string[] {
  return process.env.NEXT_PUBLIC_ALLOW_EXPO_REDIRECT === 'true'
    ? [...APP_SCHEMES, ...EXPO_SCHEMES]
    : APP_SCHEMES;
}

/** Trả về URL nếu là deep link hợp lệ của app, ngược lại null. */
export function parseMobileRedirectUri(raw: string | null | undefined): URL | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  return allowedSchemes().includes(url.protocol) ? url : null;
}

/** Dựng URL quay về app kèm sessionToken, hoặc null nếu redirect_uri không hợp lệ. */
export function buildMobileRedirectUrl(
  raw: string | null | undefined,
  sessionToken: string
): string | null {
  const url = parseMobileRedirectUri(raw);
  if (!url) return null;

  url.searchParams.set('sessionToken', sessionToken);
  return url.toString();
}
