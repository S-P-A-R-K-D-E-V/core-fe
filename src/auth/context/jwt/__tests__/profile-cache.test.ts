import { afterEach, describe, expect, it } from 'vitest';

import { loadCachedProfile, saveCachedProfile, withCachedProfile } from '../profile-cache';

afterEach(() => localStorage.clear());

describe('profile-cache', () => {
  it('lưu theo người dùng, đọc lại đúng người', () => {
    saveCachedProfile('u1', { enabledFeatures: ['pos.sale'], blockedFeatures: ['attendance.self'], permissions: ['sales.order.read'] });

    expect(loadCachedProfile('u1')).toMatchObject({
      enabledFeatures: ['pos.sale'],
      blockedFeatures: ['attendance.self'],
      permissions: ['sales.order.read'],
    });
    expect(loadCachedProfile('u2')).toBeNull();
    expect(loadCachedProfile(undefined)).toBeNull();
  });

  it('chỉ bổ sung phần chưa nạp; phần đã có từ máy chủ giữ nguyên', () => {
    saveCachedProfile('u1', { enabledFeatures: ['cached'], permissions: ['cached.perm'] });

    expect(withCachedProfile({ id: 'u1' })).toMatchObject({ enabledFeatures: ['cached'], permissions: ['cached.perm'] });
    expect(withCachedProfile({ id: 'u1', enabledFeatures: ['fresh'] }).enabledFeatures).toEqual(['fresh']);
    expect(withCachedProfile({ id: 'nobody' })).toEqual({ id: 'nobody' });
  });

  it('dữ liệu hỏng thì coi như chưa lưu', () => {
    localStorage.setItem('core-fe:profile-cache:u1', '{bad json');
    expect(loadCachedProfile('u1')).toBeNull();
  });
});
