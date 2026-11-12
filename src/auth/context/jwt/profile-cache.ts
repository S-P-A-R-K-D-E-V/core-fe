// ----------------------------------------------------------------------
// Phần hồ sơ lấy từ /users/me cần để mở trang (tính năng nền tảng, tính năng bị chặn, quyền) — lưu lần gần nhất trên
// máy theo người dùng. Mất mạng lúc mở / tải lại trang thì /users/me lỗi: trước đây `enabledFeatures` không bao giờ có
// và các trang có PlatformFeatureGuard (vd màn bán hàng) trống mãi. Nay dùng bản đã lưu; có mạng lại thì /users/me ghi
// đè. Máy chủ vẫn tự chặn (403) nếu chủ cửa hàng vừa tắt tính năng — bản lưu chỉ để màn hình mở được.
// ----------------------------------------------------------------------

export type CachedProfile = {
  enabledFeatures: string[];
  blockedFeatures: string[];
  permissions: string[];
  savedAt: string;
};

const keyOf = (userId: string) => `core-fe:profile-cache:${userId}`;

export function saveCachedProfile(
  userId: string | undefined,
  profile: { enabledFeatures?: string[]; blockedFeatures?: string[]; permissions?: string[] }
) {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    const value: CachedProfile = {
      enabledFeatures: Array.isArray(profile.enabledFeatures) ? profile.enabledFeatures : [],
      blockedFeatures: Array.isArray(profile.blockedFeatures) ? profile.blockedFeatures : [],
      permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyOf(userId), JSON.stringify(value));
  } catch {
    // hết chỗ / bị chặn — chỉ mất khả năng mở trang khi mất mạng
  }
}

export function loadCachedProfile(userId: string | undefined): CachedProfile | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(keyOf(userId)) ?? 'null');
    if (!parsed || !Array.isArray(parsed.enabledFeatures)) return null;
    return {
      enabledFeatures: parsed.enabledFeatures,
      blockedFeatures: Array.isArray(parsed.blockedFeatures) ? parsed.blockedFeatures : [],
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

/** Bổ sung phần còn thiếu của người dùng (chưa nạp /users/me) bằng bản đã lưu; phần đã có giữ nguyên. */
export function withCachedProfile<T extends { id?: string; enabledFeatures?: string[]; blockedFeatures?: string[]; permissions?: string[] }>(
  user: T
): T {
  const cached = loadCachedProfile(user.id);
  if (!cached) return user;
  return {
    ...user,
    enabledFeatures: user.enabledFeatures ?? cached.enabledFeatures,
    blockedFeatures: user.blockedFeatures ?? cached.blockedFeatures,
    permissions: user.permissions ?? cached.permissions,
  };
}
