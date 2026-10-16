import { describe, expect, it } from 'vitest';

import axiosInstance, { CLIENT_PLATFORM_HEADER } from 'src/utils/axios';

import {
  PLATFORM_FEATURES,
  isPlatformFeatureBlocked,
  isPlatformFeatureDisabledError,
} from 'src/auth/platform-features';

// ----------------------------------------------------------------------
// Bật / tắt tính năng theo nền tảng (Core-be PlatformFeatures): web khai nền tảng qua header, ẩn theo blockedFeatures
// của GET /users/me, nhận ra 403 platform_feature_disabled.
// ----------------------------------------------------------------------

describe('platform features', () => {
  it('mọi request của web khai nền tảng "web"', () => {
    expect(axiosInstance.defaults.headers.common[CLIENT_PLATFORM_HEADER]).toBe('web');
  });

  it('chỉ bị tắt khi blockedFeatures chứa đúng khoá', () => {
    const key = PLATFORM_FEATURES.selfCheckIn;

    expect(isPlatformFeatureBlocked({ blockedFeatures: [key] }, key)).toBe(true);
    expect(isPlatformFeatureBlocked({ blockedFeatures: ['other'] }, key)).toBe(false);
    expect(isPlatformFeatureBlocked({}, key)).toBe(false);
    expect(isPlatformFeatureBlocked(null, key)).toBe(false);
  });

  it('nhận ra lỗi 403 tính năng bị tắt trên nền tảng này', () => {
    expect(isPlatformFeatureDisabledError({ status: 403, error: 'platform_feature_disabled', message: 'x' })).toBe(true);
    expect(isPlatformFeatureDisabledError({ status: 403, error: 'forbidden' })).toBe(false);
    expect(isPlatformFeatureDisabledError('Something went wrong')).toBe(false);
    expect(isPlatformFeatureDisabledError(null)).toBe(false);
  });
});
