import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Bật / tắt tính năng theo nền tảng (Core-be /platform-features, chỉ Admin) — xem src/auth/platform-features.ts.
// ----------------------------------------------------------------------

export type PlatformFeatureDefinition = { key: string; label: string; description: string };

/** Giới hạn một (tính năng, nền tảng): chỉ vai trò / người liệt kê dùng được. Không có = mọi người dùng được. */
export type PlatformFeaturePolicy = {
  featureKey: string;
  platform: string;
  /** Admin / Manager / Staff hoặc vai trò tuỳ chỉnh dạng "custom:{id}". */
  allowedRoles: string[];
  allowedUserIds: string[];
  updatedAt: string;
};

export type PlatformFeaturesResponse = {
  features: PlatformFeatureDefinition[];
  platforms: string[];
  policies: PlatformFeaturePolicy[];
};

export type SetPlatformFeaturePolicyRequest = {
  /** false = bỏ giới hạn (mọi người dùng được). */
  restricted: boolean;
  allowedRoles?: string[];
  allowedUserIds?: string[];
};

export const CUSTOM_ROLE_PREFIX = 'custom:';

export const customRoleCode = (customRoleId: string) => `${CUSTOM_ROLE_PREFIX}${customRoleId}`;

export async function getPlatformFeatures(): Promise<PlatformFeaturesResponse> {
  const response = await axios.get<PlatformFeaturesResponse>(endpoints.platformFeatures.list);
  return response.data;
}

/** Trả giới hạn sau khi lưu, null khi đã bỏ giới hạn (204). */
export async function setPlatformFeaturePolicy(
  featureKey: string,
  platform: string,
  data: SetPlatformFeaturePolicyRequest
): Promise<PlatformFeaturePolicy | null> {
  const response = await axios.put<PlatformFeaturePolicy | ''>(endpoints.platformFeatures.policy(featureKey, platform), data);
  return response.status === 204 || !response.data ? null : response.data;
}

/** Một lần gọi tính năng theo nền tảng (GET /platform-features/access-logs). */
export type PlatformAccessLog = {
  id: string;
  createdAt: string;
  userId: string;
  userName?: string | null;
  featureKey: string;
  /** Action được gọi (vd "SmartCheckIn"). */
  action: string;
  /** Nền tảng server dùng để quyết định ("web" / "app"; null = không rõ). */
  platform?: string | null;
  /** Header X-Client-Platform client gửi (đã chuẩn hoá). */
  declaredPlatform?: string | null;
  /** Nền tảng ghi trong phiên đăng nhập. */
  sessionPlatform?: string | null;
  isBrowser: boolean;
  /** Các tín hiệu mâu thuẫn — dấu hiệu sửa nền tảng. */
  suspicious: boolean;
  blocked: boolean;
  statusCode: number;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type PlatformAccessLogPage = { total: number; page: number; pageSize: number; data: PlatformAccessLog[] };

export async function getPlatformAccessLogs(params: {
  suspiciousOnly?: boolean;
  blockedOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PlatformAccessLogPage> {
  const response = await axios.get<PlatformAccessLogPage>(endpoints.platformFeatures.accessLogs, { params });
  return response.data;
}
