import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PERMISSIONS } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// RoleBasedGuard theo quyền: chưa nạp quyền thì chờ (không báo chặn rồi lại mở), Admin luôn qua.
// ----------------------------------------------------------------------

let mockUser: Record<string, any> | null = null;
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));
vi.mock('src/assets/illustrations', () => ({ ForbiddenIllustration: () => null }));

// Imported after the mocks above.
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

const A = PERMISSIONS.analytics;

function renderWith(user: Record<string, any>, props: Record<string, any>) {
  mockUser = user;
  return render(
    <RoleBasedGuard hasContent {...props}>
      <p>trang báo cáo</p>
    </RoleBasedGuard>
  );
}

describe('RoleBasedGuard — quyền', () => {
  it('chưa nạp quyền (token không mang quyền) → chưa hiện gì', () => {
    const { container } = renderWith({ role: 'Staff', roles: ['Staff'] }, { permissions: [A.revenue] });
    expect(container).toBeEmptyDOMElement();
  });

  it('có một trong các quyền → vào được', () => {
    renderWith({ roles: ['Staff'], permissions: [A.revenue] }, { permissions: [A.tax, A.revenue] });
    expect(screen.getByText('trang báo cáo')).toBeInTheDocument();
  });

  it('thiếu một trong các quyền bắt buộc → màn chặn', () => {
    renderWith({ roles: ['Staff'], permissions: [A.revenue] }, { allPermissions: [A.revenue, A.expense] });
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
  });

  it('Admin luôn qua, kể cả trước khi nạp /users/me', () => {
    renderWith({ roles: ['Admin'] }, { allPermissions: [A.revenue, A.expense, A.breakEven] });
    expect(screen.getByText('trang báo cáo')).toBeInTheDocument();
  });
});
