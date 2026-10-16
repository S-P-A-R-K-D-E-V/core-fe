import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// RouteRoleGuard: chặn trang quản trị theo ROUTE_ROLE_RULES; người kiêm nhiều vai trò xét đủ danh sách.
// ----------------------------------------------------------------------

let mockPath = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}));

let mockUser: Record<string, any> | null = null;
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

vi.mock('src/assets/illustrations', () => ({
  ForbiddenIllustration: () => null,
}));

// Imported after the mocks above.
import RouteRoleGuard from 'src/auth/guard/route-role-guard';

function renderAt(path: string, user: Record<string, any>) {
  mockPath = path;
  mockUser = user;
  return render(
    <RouteRoleGuard>
      <p>nội dung trang</p>
    </RouteRoleGuard>
  );
}

describe('RouteRoleGuard', () => {
  it('nhân viên mở trang quản lý người dùng → màn chặn, không render trang', () => {
    renderAt(paths.dashboard.user.list, { role: 'Staff', roles: ['Staff'] });

    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.queryByText('nội dung trang')).not.toBeInTheDocument();
  });

  it('nhân viên vẫn mở được tài khoản của mình', () => {
    renderAt(paths.dashboard.user.account, { role: 'Staff', roles: ['Staff'] });

    expect(screen.getByText('nội dung trang')).toBeInTheDocument();
  });

  it('quản lý không vào được trang chỉ Admin', () => {
    renderAt(paths.dashboard.storeSettings.root, { role: 'Manager', roles: ['Manager'] });

    expect(screen.queryByText('nội dung trang')).not.toBeInTheDocument();
  });

  it('Staff kiêm Admin (vai trò chính là Staff) vẫn vào trang Admin', () => {
    renderAt(paths.dashboard.storeSettings.root, { role: 'Staff', roles: ['Staff', 'Admin'] });

    expect(screen.getByText('nội dung trang')).toBeInTheDocument();
  });

  // Trang lương theo quyền payroll.* (Admin, Manager có mặc định — quyền từ /users/me).
  it('trang lương: quản lý có quyền mặc định vào được, nhân viên thường bị chặn', () => {
    renderAt(paths.dashboard.payroll.batch, {
      role: 'Manager',
      roles: ['Manager'],
      permissions: ['payroll.records.read'],
    });
    expect(screen.getByText('nội dung trang')).toBeInTheDocument();
  });

  it('trang lương: nhân viên được cấp quyền qua vai trò tuỳ chỉnh vào được; không có quyền thì chặn', () => {
    renderAt(paths.dashboard.salary.configuration, {
      role: 'Staff',
      roles: ['Staff'],
      permissions: ['payroll.salary-config.read'],
    });
    expect(screen.getByText('nội dung trang')).toBeInTheDocument();
  });

  it('trang lương: nhân viên không có quyền → chặn', () => {
    renderAt(paths.dashboard.payroll.cycles, { role: 'Staff', roles: ['Staff'], permissions: [] });
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });

  it('trang lương: chưa nạp quyền (/users/me) → chờ, chưa hiện gì', () => {
    const { container } = renderAt(paths.dashboard.payroll.cycles, { role: 'Manager', roles: ['Manager'] });
    expect(container).toBeEmptyDOMElement();
  });

  it('trang không có quy tắc → không chặn thêm', () => {
    renderAt(paths.dashboard.shiftCash.root, { role: 'Staff', roles: ['Staff'] });

    expect(screen.getByText('nội dung trang')).toBeInTheDocument();
  });
});
