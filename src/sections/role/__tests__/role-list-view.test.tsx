import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import type { IRole } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Danh sách vai trò: cửa hàng dùng danh mục chung (tenant SaaS) không có nút tạo/sửa/xoá — Core-be trả 403 nếu bấm;
// vai trò hệ thống (Admin/Manager/Staff/User) không có nút xoá.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
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
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const getAllRoles = vi.fn();
const getRoleCatalogStatus = vi.fn();
vi.mock('src/api/roles', () => ({
  getAllRoles: () => getAllRoles(),
  deleteRole: vi.fn(),
  getRoleCatalogStatus: () => getRoleCatalogStatus(),
}));

// Imported after the mocks above.
import RoleListView from 'src/sections/role/view/role-list-view';

const role = (name: string, isSystem: boolean): IRole => ({
  id: name,
  name,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  userCount: 0,
  permissions: [],
  isSystem,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RoleListView', () => {
  it('danh mục dùng chung: không có nút tạo / menu sửa, hiện lý do', async () => {
    getAllRoles.mockResolvedValue([role('Admin', true), role('Thu ngân', false)]);
    getRoleCatalogStatus.mockResolvedValue({ editable: false, reason: 'Danh mục vai trò dùng chung.' });

    render(<RoleListView />);

    expect(await screen.findByText(/Danh mục vai trò dùng chung\./)).toBeInTheDocument();
    expect(await screen.findByText('Thu ngân')).toBeInTheDocument();
    expect(screen.queryByText('New Role')).not.toBeInTheDocument();
    // Ô chọn từng dòng bị khoá (ô "chọn tất cả" ở tiêu đề không còn dòng nào để chọn).
    const bodyRows = screen.getAllByRole('row').filter((r) => r.closest('tbody'));
    bodyRows
      .map((r) => r.querySelector('input[type="checkbox"]'))
      .filter(Boolean)
      .forEach((box) => expect(box).toBeDisabled());
  });

  it('sửa được: có nút tạo; vai trò hệ thống có nhãn và không chọn để xoá được', async () => {
    getAllRoles.mockResolvedValue([role('Admin', true), role('Thu ngân', false)]);
    getRoleCatalogStatus.mockResolvedValue({ editable: true, reason: null });

    render(<RoleListView />);

    await waitFor(() => expect(screen.getByText('New Role')).toBeInTheDocument());
    expect(await screen.findByText('Hệ thống')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    const adminRow = rows.find((r) => r.textContent?.includes('Admin'))!;
    const customRow = rows.find((r) => r.textContent?.includes('Thu ngân'))!;
    expect(adminRow.querySelector('input[type="checkbox"]')).toBeDisabled();
    expect(customRow.querySelector('input[type="checkbox"]')).not.toBeDisabled();
  });
});
