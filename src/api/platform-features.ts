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
