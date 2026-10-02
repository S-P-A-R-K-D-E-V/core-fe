// ----------------------------------------------------------------------

/**
 * Luồng đăng nhập của app mobile: app mở trang login web với `?mobile=true&redirect_uri=...`,
 * đăng nhập xong web chuyển về `redirect_uri` kèm sessionToken. Chỉ được chuyển về deep link của
 * chính app CiCi — mọi địa chỉ khác (https, javascript:, data:, //host...) đều bị bỏ qua, nếu không
 * một đường link giả là đủ để lấy token phiên của người đang đăng nhập.
 *
 * `corecms:` là scheme của app CiCi, `sparkstore:` của bản app cửa hàng SaaS (core-mobile
 * app.config.ts, STORE_APP_SCHEME). `exp:`/`exp+cms:` của Expo Go chỉ được bật khi
 * đặt NEXT_PUBLIC_ALLOW_EXPO_REDIRECT=true (máy dev), vì app nào cũng mở được link exp://.
 */
const APP_SCHEMES = ['corecms:', 'sparkstore:'];
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

// ----------------------------------------------------------------------
// Trang liên kết Google/Apple (/sso/start/?link=1&app=1) trả kết quả về app:
//   <redirect_uri>?status=<s>&result=<s>[&provider=<p>][&reason=<mã>]
// App cũ đọc `status`; `result` cùng giá trị theo hợp đồng mới. `reason` chỉ là mã cố định — app tự dịch,
// không hiện nguyên văn. Không truyền provider / reason thì xoá luôn tham số cùng tên có sẵn trong
// redirect_uri, để app không đọc nhầm giá trị cũ.

export type AppLinkStatus = 'linked' | 'error' | 'cancelled';

/** Mỗi tài khoản chỉ một Google + một Apple: BE trả 409 Auth.ProviderAlreadyLinked. */
export type AppLinkFailureReason = 'provider_already_linked';

export function buildAppLinkResultUrl(
  redirect: URL,
  status: AppLinkStatus,
  provider?: string,
  reason?: AppLinkFailureReason
): string {
  const back = new URL(redirect.toString());
  back.searchParams.set('status', status);
  back.searchParams.set('result', status);
  if (provider) back.searchParams.set('provider', provider);
  else back.searchParams.delete('provider');
  if (reason) back.searchParams.set('reason', reason);
  else back.searchParams.delete('reason');
  return back.toString();
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
