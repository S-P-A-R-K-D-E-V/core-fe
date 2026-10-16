import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ICustomRole, IPermissionCatalog } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Vai trò & phân quyền: vai trò tuỳ chỉnh của cửa hàng (sửa / xoá — không xoá được khi còn người mang) và vai trò hệ thống
// (quyền cố định, chỉ xem).
// ----------------------------------------------------------------------

// enqueueSnackbar ổn định như thật (effect của màn hình phụ thuộc vào nó).
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading, action }: any) => (
    <div>
      <h1>{heading}</h1>
      {action}
    </div>
  ),
}));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/scrollbar', () => ({ default: ({ children }: any) => <div>{children}</div> }));
const push = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const getCustomRoles = vi.fn();
const getPermissionCatalog = vi.fn();
const deleteCustomRole = vi.fn();
vi.mock('src/api/custom-roles', async () => ({
  SYSTEM_ROLE_LABELS: (await vi.importActual<any>('src/api/custom-roles')).SYSTEM_ROLE_LABELS,
  getCustomRoles: () => getCustomRoles(),
  getPermissionCatalog: () => getPermissionCatalog(),
  deleteCustomRole: (id: string) => deleteCustomRole(id),
}));

// Imported after the mocks above.
import RoleListView from 'src/sections/role/view/role-list-view';

const catalog: IPermissionCatalog = {
  groups: [
    {
      key: 'analytics',
      label: 'Báo cáo kinh doanh',
      permissions: [
        { code: 'analytics.revenue.read', label: 'Báo cáo doanh thu' },
        { code: 'analytics.export', label: 'Xuất báo cáo ra Excel' },
      ],
    },
  ],
  systemRoles: [
    { name: 'Admin', permissions: ['analytics.export', 'analytics.revenue.read'] },
    { name: 'Staff', permissions: [] },
  ],
  baseRoles: ['Manager', 'Staff'],
};

const role = (name: string, userCount: number): ICustomRole => ({
  id: name,
  name,
  baseRole: 'Staff',
  permissions: ['analytics.revenue.read'],
  userCount,
  createdAt: '2026-10-16T00:00:00Z',
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RoleListView', () => {
  it('liệt kê vai trò tuỳ chỉnh và vai trò hệ thống kèm số quyền', async () => {
    getPermissionCatalog.mockResolvedValue(catalog);
    getCustomRoles.mockResolvedValue([role('Kế toán', 2)]);

    render(<RoleListView />);

    expect(await screen.findByText('Kế toán')).toBeInTheDocument();
    expect(screen.getByText('1/2 quyền')).toBeInTheDocument();
    expect(screen.getByText('Toàn quyền')).toBeInTheDocument(); // Admin
    expect(screen.getByText('0/2 quyền')).toBeInTheDocument(); // Staff
  });

  it('vai trò còn người mang thì không xoá được; vai trò trống xoá sau khi xác nhận', async () => {
    getPermissionCatalog.mockResolvedValue(catalog);
    getCustomRoles.mockResolvedValue([role('Kế toán', 2), role('Kho', 0)]);
    deleteCustomRole.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<RoleListView />);

    expect(await screen.findByRole('button', { name: 'Xoá Kế toán' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Xoá Kho' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá' }));

    expect(deleteCustomRole).toHaveBeenCalledWith('Kho');
  });

  it('xem quyền của vai trò hệ thống: chỉ xem, không sửa được', async () => {
    getPermissionCatalog.mockResolvedValue(catalog);
    getCustomRoles.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<RoleListView />);

    expect(await screen.findByText('Chưa có vai trò tuỳ chỉnh.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Xem quyền' })[0]);
    const dialog = await screen.findByRole('dialog');
    const boxes = within(dialog).getAllByRole('checkbox');
    boxes.forEach((b) => expect(b).toBeDisabled());
    expect(within(dialog).getByRole('checkbox', { name: /Báo cáo doanh thu/ })).toBeChecked();
  });
});
