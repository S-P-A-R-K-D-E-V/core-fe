// ----------------------------------------------------------------------
// Bật / tắt tính năng theo nền tảng — trùng Core-be (CoreCms.Domain/Common/PlatformFeatures.cs). Chủ cửa hàng giới hạn ai
// được dùng một tính năng trên web / app (vd tắt tự chấm công trên web với nhân viên, buộc dùng app). Server tự nhận ra
// trình duyệt (luôn là web) và gắn nền tảng vào phiên đăng nhập; header X-Client-Platform (src/utils/axios.ts) chỉ còn là
// tín hiệu phụ. GET /users/me trả blockedFeatures cho nền tảng đó. API vẫn tự chặn (403 platform_feature_disabled) — web
// chỉ ẩn cho khớp.
// ----------------------------------------------------------------------

export const PLATFORM_FEATURES = {
  /** Tự chấm công vào / ra ca (GPS, khuôn mặt). Máy chấm công (kiosk) không bị ảnh hưởng. */
  selfCheckIn: 'attendance.self-checkin',
} as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[keyof typeof PLATFORM_FEATURES];

/** Nền tảng cấu hình được ở Core-be (ClientPlatforms). */
export const CLIENT_PLATFORMS = ['web', 'app'] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<ClientPlatform, string> = { web: 'Web', app: 'App điện thoại' };

/** Mã lỗi Core-be trả khi tính năng bị tắt trên nền tảng này với người gọi. */
export const PLATFORM_FEATURE_DISABLED = 'platform_feature_disabled';

type UserWithBlocked = { blockedFeatures?: readonly string[] | null } | null | undefined;

export function isPlatformFeatureBlocked(user: UserWithBlocked, feature: string): boolean {
  return !!user?.blockedFeatures?.includes(feature);
}

export function isPlatformFeatureDisabledError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { error?: unknown }).error === PLATFORM_FEATURE_DISABLED;
}
