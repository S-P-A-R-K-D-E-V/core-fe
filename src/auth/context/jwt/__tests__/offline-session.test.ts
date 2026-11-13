import { afterEach, describe, expect, it } from 'vitest';

import { saveCachedProfile } from '../profile-cache';
import {
  loadOfflineUser,
  saveOfflineUser,
  clearOfflineUser,
  offlineStartUser,
  isOfflineCapablePath,
  OFFLINE_SESSION_MAX_AGE_MS,
} from '../offline-session';

afterEach(() => localStorage.clear());

const NOW = new Date('2026-11-12T10:00:00Z');
const USER = {
  id: 'u1',
  email: 'lan@example.com',
  displayName: 'Nguyễn Lan',
  role: 'Staff',
  roles: ['Staff'],
  accessToken: 'jwt-secret',
  refreshToken: 'refresh-secret',
};

describe('offline-session', () => {
  it('chỉ lưu danh tính, không lưu token', () => {
    saveOfflineUser(USER, NOW);
    const raw = localStorage.getItem('core-fe:offline-user') ?? '';
    expect(raw).not.toContain('jwt-secret');
    expect(raw).not.toContain('refresh-secret');
    expect(loadOfflineUser(NOW)).toEqual({
      id: 'u1',
      email: 'lan@example.com',
      displayName: 'Nguyễn Lan',
      role: 'Staff',
      roles: ['Staff'],
    });
  });

  it('quá 72 giờ (hoặc đồng hồ lùi) thì không dùng được', () => {
    saveOfflineUser(USER, NOW);
    expect(loadOfflineUser(new Date(NOW.getTime() + OFFLINE_SESSION_MAX_AGE_MS + 1))).toBeNull();
    expect(loadOfflineUser(new Date(NOW.getTime() - 60_000))).toBeNull();
    clearOfflineUser();
    expect(loadOfflineUser(NOW)).toBeNull();
  });

  it('chỉ màn bán hàng', () => {
    expect(isOfflineCapablePath('/dashboard/pos/sale/')).toBe(true);
    expect(isOfflineCapablePath('/dashboard/pos/sale')).toBe(true);
    expect(isOfflineCapablePath('/dashboard/pos/sales-order/list/')).toBe(false);
    expect(isOfflineCapablePath('/dashboard/')).toBe(false);
  });

  it('phiên offline: chỉ khi restore-session không tới được máy chủ + ở màn bán hàng + có người đăng nhập gần đây', () => {
    saveOfflineUser(USER, NOW);
    saveCachedProfile('u1', { enabledFeatures: ['pos.sale'], permissions: ['sales.order.read'] });

    expect(offlineStartUser({ restoreUnreachable: true, pathname: '/dashboard/pos/sale/' }, NOW)).toMatchObject({
      id: 'u1',
      offlineSession: true,
      enabledFeatures: ['pos.sale'],
      permissions: ['sales.order.read'],
    });
    // bị từ chối (phiên hết hạn) → về trang đăng nhập như trước
    expect(offlineStartUser({ restoreUnreachable: false, pathname: '/dashboard/pos/sale/' }, NOW)).toBeNull();
    // trang khác
    expect(offlineStartUser({ restoreUnreachable: true, pathname: '/dashboard/' }, NOW)).toBeNull();
    // chưa từng đăng nhập trên máy này
    clearOfflineUser();
    expect(offlineStartUser({ restoreUnreachable: true, pathname: '/dashboard/pos/sale/' }, NOW)).toBeNull();
  });
});
