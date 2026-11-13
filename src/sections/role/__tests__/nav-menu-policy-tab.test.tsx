import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { IPermissionCatalog } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Menu hiển thị": chủ cửa hàng ẩn / ghim mục menu cho từng vai trò. Ô của vai trò không có quyền thì không bấm được;
// bấm ô đổi Hiện → Ẩn → Ghim; Lưu gửi đúng vai trò đã đổi.
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/branding', () => ({ useStoreBrand: () => ({ isCiCi: true }) }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { enabledFeatures: ['workforce.shift-scheduling', 'commerce.retail.pos'] } }),
}));

const getNavMenuPolicies = vi.fn();
const saveNavMenuPolicy = vi.fn();
const resetNavMenuPolicy = vi.fn();
vi.mock('src/api/nav-menu', () => ({
  customRoleCode: (id: string) => `custom:${id}`,
  getNavMenuPolicies: () => getNavMenuPolicies(),
  saveNavMenuPolicy: (code: string, body: unknown) => saveNavMenuPolicy(code, body),
  resetNavMenuPolicy: (code: string) => resetNavMenuPolicy(code),
}));

// Imported after the mocks above.
import NavMenuPolicyTab from 'src/sections/role/nav-menu-policy-tab';

const catalog: IPermissionCatalog = {
  groups: [],
  systemRoles: [
    { name: 'Admin', permissions: [] },
    { name: 'Manager', permissions: ['user.read'] },
    { name: 'Staff', permissions: [] },
  ],
  baseRoles: ['Manager', 'Staff'],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('NavMenuPolicyTab', () => {
  it('vai trò không có quyền: ô "Không quyền"; bấm ô của Quản lý rồi Lưu gửi đúng vai trò', async () => {
    getNavMenuPolicies.mockResolvedValue([]);
    saveNavMenuPolicy.mockResolvedValue({});
    render(<NavMenuPolicyTab catalog={catalog} customRoles={[]} />);

    const row = (await screen.findByText('Danh sách nhân viên')).closest('tr')!;
    expect(within(row).getByText('Không quyền')).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Danh sách nhân viên — Quản lý: Hiện' }));
    expect(within(row).getByRole('button', { name: 'Danh sách nhân viên — Quản lý: Ẩn' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Lưu (1 vai trò)' }));
    expect(saveNavMenuPolicy).toHaveBeenCalledWith('Manager', {
      hiddenKeys: ['staff.users'],
      pinnedKeys: [],
      homeKey: null,
      hideFromSearch: false,
    });
  });

  it('không ẩn được "Vai trò & quyền" với chủ cửa hàng', async () => {
    getNavMenuPolicies.mockResolvedValue([]);
    render(<NavMenuPolicyTab catalog={catalog} customRoles={[]} />);

    const row = (await screen.findByText('Vai trò & quyền')).closest('tr')!;
    expect(within(row).queryByRole('button', { name: /Chủ cửa hàng/ })).not.toBeInTheDocument();
  });

  it('bỏ hết tuỳ chỉnh thì xoá cấu hình của vai trò thay vì lưu rỗng', async () => {
    getNavMenuPolicies.mockResolvedValue([
      { roleCode: 'Staff', hiddenKeys: ['me.guide'], pinnedKeys: [], homeKey: null, hideFromSearch: false },
    ]);
    resetNavMenuPolicy.mockResolvedValue(undefined);
    render(<NavMenuPolicyTab catalog={catalog} customRoles={[]} />);

    const row = (await screen.findByText('Hướng dẫn sử dụng app')).closest('tr')!;
    // Ẩn → Ghim → Hiện
    await userEvent.click(within(row).getByRole('button', { name: /Nhân viên: Ẩn/ }));
    await userEvent.click(within(row).getByRole('button', { name: /Nhân viên: ★ Ghim/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu (1 vai trò)' }));
    expect(resetNavMenuPolicy).toHaveBeenCalledWith('Staff');
    expect(saveNavMenuPolicy).not.toHaveBeenCalled();
  });

  it('Core-be chưa hỗ trợ: báo lỗi, có nút thử lại', async () => {
    getNavMenuPolicies.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<NavMenuPolicyTab catalog={catalog} customRoles={[]} />);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
