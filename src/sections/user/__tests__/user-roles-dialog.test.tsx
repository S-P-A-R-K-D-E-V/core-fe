import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ----------------------------------------------------------------------
// Gán vai trò: đọc vai trò ĐƯỢC GÁN (/custom-roles/users/{id}) — không lấy vai trò gốc trong token làm vai trò hệ thống;
// chỉ gửi phần đã đổi (mỗi lệnh có thể buộc người đó đăng nhập lại).
// ----------------------------------------------------------------------

// enqueueSnackbar ổn định như thật (effect của màn hình phụ thuộc vào nó).
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
const authUser = { id: 'admin-1', roles: ['Admin'] };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: authUser }) }));

const getAllRoles = vi.fn();
const assignRoles = vi.fn();
vi.mock('src/api/roles', () => ({
  getAllRoles: () => getAllRoles(),
  assignRoles: (data: any) => assignRoles(data),
}));

const getCustomRoles = vi.fn();
const getUserRoleAssignment = vi.fn();
const setUserCustomRoles = vi.fn();
vi.mock('src/api/custom-roles', async () => ({
  SYSTEM_ROLE_LABELS: (await vi.importActual<any>('src/api/custom-roles')).SYSTEM_ROLE_LABELS,
  getCustomRoles: () => getCustomRoles(),
  getUserRoleAssignment: (id: string) => getUserRoleAssignment(id),
  setUserCustomRoles: (id: string, ids: string[]) => setUserCustomRoles(id, ids),
}));

// Imported after the mocks above.
import UserRolesDialog from 'src/sections/user/user-roles-dialog';

const systemRoles = [
  { id: 'r-admin', name: 'Admin', isActive: true, createdAt: '', userCount: 1, permissions: [] },
  { id: 'r-staff', name: 'Staff', isActive: true, createdAt: '', userCount: 3, permissions: [] },
];
const customRoles = [
  { id: 'c-cashier', name: 'Thu ngân', baseRole: 'Staff', permissions: [], userCount: 1, createdAt: '' },
  { id: 'c-acc', name: 'Kế toán', baseRole: 'Staff', permissions: ['analytics.revenue.read'], userCount: 0, createdAt: '' },
];

afterEach(() => {
  vi.clearAllMocks();
});

function setup(assignment: { systemRoles: string[]; customRoleIds: string[] }) {
  getAllRoles.mockResolvedValue(systemRoles);
  getCustomRoles.mockResolvedValue(customRoles);
  getUserRoleAssignment.mockResolvedValue(assignment);
  assignRoles.mockResolvedValue(undefined);
  setUserCustomRoles.mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<UserRolesDialog open onClose={onClose} userId="u-1" userName="Lan" />);
  return onClose;
}

describe('UserRolesDialog', () => {
  it('người chỉ mang "Thu ngân" (gốc Staff): ô Staff hệ thống KHÔNG được tích', async () => {
    setup({ systemRoles: [], customRoleIds: ['c-cashier'] });

    expect(await screen.findByRole('checkbox', { name: /Thu ngân/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Nhân viên \(Staff\)$/ })).not.toBeChecked();
  });

  it('chỉ đổi vai trò tuỳ chỉnh → chỉ gọi API vai trò tuỳ chỉnh', async () => {
    const onClose = setup({ systemRoles: [], customRoleIds: ['c-cashier'] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: /Kế toán/ }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(setUserCustomRoles).toHaveBeenCalledWith('u-1', ['c-cashier', 'c-acc']);
    expect(assignRoles).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('chỉ đổi vai trò hệ thống → chỉ gọi /roles/assign', async () => {
    setup({ systemRoles: ['Staff'], customRoleIds: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: /^Nhân viên \(Staff\)$/ }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(assignRoles).toHaveBeenCalledWith({ userId: 'u-1', roleIds: [] });
    expect(setUserCustomRoles).not.toHaveBeenCalled();
  });
});
