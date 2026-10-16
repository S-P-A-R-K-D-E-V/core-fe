import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ----------------------------------------------------------------------
// Tạo vai trò tuỳ chỉnh: tên không trùng vai trò hệ thống, chọn vai trò gốc + quyền trong danh mục, gửi đúng mã quyền.
// ----------------------------------------------------------------------

// hook-form kéo theo theme (next/font) — jsdom không có loader font của Next.
vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
const push = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));

const createCustomRole = vi.fn();
const updateCustomRole = vi.fn();
const getPermissionCatalog = vi.fn();
vi.mock('src/api/custom-roles', async () => ({
  SYSTEM_ROLE_LABELS: (await vi.importActual<any>('src/api/custom-roles')).SYSTEM_ROLE_LABELS,
  createCustomRole: (data: any) => createCustomRole(data),
  updateCustomRole: (id: string, data: any) => updateCustomRole(id, data),
  getPermissionCatalog: () => getPermissionCatalog(),
}));

// Imported after the mocks above.
import CustomRoleForm from 'src/sections/role/custom-role-form';

const catalog = {
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
  systemRoles: [],
  baseRoles: ['Manager', 'Staff'],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('CustomRoleForm', () => {
  it('tạo "Kế toán" gốc Staff với quyền doanh thu', async () => {
    getPermissionCatalog.mockResolvedValue(catalog);
    createCustomRole.mockResolvedValue({ id: 'r1' });
    const user = userEvent.setup();

    render(<CustomRoleForm />);

    await user.type(screen.getByLabelText('Tên vai trò'), 'Kế toán');
    await user.click(await screen.findByRole('checkbox', { name: /Báo cáo doanh thu/ }));
    await user.click(screen.getByRole('button', { name: 'Tạo vai trò' }));

    await waitFor(() =>
      expect(createCustomRole).toHaveBeenCalledWith({
        name: 'Kế toán',
        description: undefined,
        baseRole: 'Staff',
        permissions: ['analytics.revenue.read'],
      })
    );
    expect(push).toHaveBeenCalled();
  });

  it('chặn tên trùng vai trò hệ thống ngay trên form', async () => {
    getPermissionCatalog.mockResolvedValue(catalog);
    const user = userEvent.setup();

    render(<CustomRoleForm />);

    await user.type(screen.getByLabelText('Tên vai trò'), 'staff');
    await screen.findByRole('checkbox', { name: /Báo cáo doanh thu/ });
    await user.click(screen.getByRole('button', { name: 'Tạo vai trò' }));

    expect(await screen.findByText('Trùng tên vai trò hệ thống — chọn tên khác')).toBeInTheDocument();
    expect(createCustomRole).not.toHaveBeenCalled();
  });
});
