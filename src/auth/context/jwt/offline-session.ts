import { paths } from 'src/routes/paths';

import { withCachedProfile } from './profile-cache';

// ----------------------------------------------------------------------
// Mở màn bán hàng khi trình duyệt vừa mở lại lúc mất mạng (docs/cici/plans/pos-offline-plan.md, GĐ4).
//
// Phiên đăng nhập nằm trong sessionStorage (mất khi đóng trình duyệt); mở lại thì phải gọi restore-session — mất mạng thì
// không gọi được và trước đây bị đẩy về trang đăng nhập (cũng cần mạng) → không bán được. Nay: restore-session không tới
// được máy chủ (KHÔNG phải bị từ chối) + đang mở màn bán hàng + máy này có người đăng nhập gần đây (≤ 72 giờ) → vào màn
// bán hàng bằng người đó ở "phiên offline": chỉ bán (hoá đơn vào hàng chờ trên máy), có mạng lại tự đăng nhập lại
// (restore-session) rồi mới gửi hoá đơn. Máy chủ vẫn là nơi kiểm quyền thật khi hoá đơn được gửi.
// ----------------------------------------------------------------------

const OFFLINE_USER_KEY = 'core-fe:offline-user';
export const OFFLINE_SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;

const IDENTITY_FIELDS = ['id', 'email', 'displayName', 'firstName', 'lastName', 'role', 'roles', 'photoURL'] as const;

type Identity = Partial<Record<(typeof IDENTITY_FIELDS)[number], any>> & { savedAt: string };

/** Nhớ người vừa đăng nhập có mạng trên máy này (không lưu token). */
export function saveOfflineUser(user: Record<string, any> | null | undefined, now = new Date()) {
  if (!user?.id || typeof localStorage === 'undefined') return;
  try {
    const identity: Identity = { savedAt: now.toISOString() };
    IDENTITY_FIELDS.forEach((field) => {
      if (user[field] !== undefined) identity[field] = user[field];
    });
    localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(identity));
  } catch {
    // hết chỗ / bị chặn — chỉ mất khả năng mở màn bán hàng khi mất mạng
  }
}

export function loadOfflineUser(now = new Date()): Record<string, any> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(OFFLINE_USER_KEY) ?? 'null');
    if (!saved?.id || typeof saved.savedAt !== 'string') return null;
    const age = now.getTime() - Date.parse(saved.savedAt);
    if (!(age >= 0 && age <= OFFLINE_SESSION_MAX_AGE_MS)) return null;
    const { savedAt, ...identity } = saved;
    return identity;
  } catch {
    return null;
  }
}

export function clearOfflineUser() {
  try {
    localStorage.removeItem(OFFLINE_USER_KEY);
  } catch {
    // bỏ qua
  }
}

/** Màn được mở ở phiên offline: chỉ màn bán hàng. */
export function isOfflineCapablePath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === paths.dashboard.pos.sale.root;
}

/**
 * Người dùng cho phiên offline, hoặc null (về trang đăng nhập như trước): chỉ khi restore-session KHÔNG tới được máy chủ,
 * đang ở màn bán hàng, và có người đăng nhập trên máy này trong 72 giờ (kèm tính năng / quyền đã lưu).
 */
export function offlineStartUser(
  { restoreUnreachable, pathname }: { restoreUnreachable: boolean; pathname: string },
  now = new Date()
): Record<string, any> | null {
  if (!restoreUnreachable || !isOfflineCapablePath(pathname)) return null;
  const identity = loadOfflineUser(now);
  if (!identity) return null;
  return { ...withCachedProfile(identity), offlineSession: true };
}
