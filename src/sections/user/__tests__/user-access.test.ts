import { describe, expect, it } from 'vitest';

import { canActOn, userAccessFor } from '../user-access';

// ----------------------------------------------------------------------
// Trang Nhân viên theo quyền user.* (Core-be UsersController). Tài khoản Admin chỉ Admin đụng được — luật theo vai trò.
// ----------------------------------------------------------------------

const MANAGER_DEFAULTS = ['user.read', 'user.create', 'user.update', 'user.status', 'user.password.reset', 'user.delete'];

describe('userAccessFor', () => {
  it('Manager (quyền mặc định) làm được mọi thao tác trên nhân viên, không phải chủ', () => {
    expect(userAccessFor({ role: 'Manager', permissions: MANAGER_DEFAULTS })).toEqual({
      canCreate: true,
      canUpdate: true,
      canChangeStatus: true,
      canResetPassword: true,
      canDelete: true,
      isOwner: false,
    });
  });

  it('"Nhân sự" chỉ sửa hồ sơ: không khoá, không xoá, không đặt lại mật khẩu', () => {
    expect(userAccessFor({ role: 'Staff', permissions: ['user.read', 'user.update'] })).toMatchObject({
      canUpdate: true,
      canChangeStatus: false,
      canResetPassword: false,
      canDelete: false,
    });
  });

  it('thao tác cần kèm quyền xem', () => {
    expect(userAccessFor({ role: 'Staff', permissions: ['user.delete'] }).canDelete).toBe(false);
  });
});

describe('canActOn', () => {
  it('tài khoản Admin chỉ Admin đụng được, dù người kia có quyền', () => {
    const manager = userAccessFor({ role: 'Manager', permissions: MANAGER_DEFAULTS });
    expect(canActOn(manager, manager.canResetPassword, ['Admin'])).toBe(false);
    expect(canActOn(manager, manager.canResetPassword, ['Staff'])).toBe(true);

    const owner = userAccessFor({ role: 'Admin' });
    expect(canActOn(owner, owner.canResetPassword, ['Admin'])).toBe(true);
  });
});
