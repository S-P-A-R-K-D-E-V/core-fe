import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { IExpense } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Danh sách chi phí theo quyền expense.*: chỉ hiện nút người đó dùng được; khoản cổ đông chi hộ khoá sửa / xoá với người
// không phải chủ cửa hàng (Core-be: Expense.ShareholderFundsOwnerOnly).
// ----------------------------------------------------------------------

// hook-form / Label kéo theo theme (next/font) — jsdom không có loader font của Next.
vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

let mockUser: Record<string, any> | null = null;
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: mockUser }) }));
vi.mock('src/assets/illustrations', () => ({ ForbiddenIllustration: () => null }));

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
vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('src/components/date-time-picker', () => ({ AppDatePicker: () => null }));
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const getExpenses = vi.fn();
vi.mock('src/api/expenses', () => ({
  getExpenses: (params: any) => getExpenses(params),
  deleteExpense: vi.fn(),
}));

// Imported after the mocks above.
import ExpenseLayout from 'src/app/dashboard/pos/expense/layout';
import ExpenseListView from 'src/sections/expense/view/expense-list-view';

const row = (id: string, extra: Partial<IExpense> = {}) =>
  ({
    id,
    categoryId: 'c1',
    categoryName: 'Điện',
    amount: 1_000_000,
    expenseDate: '2026-10-01T00:00:00Z',
    note: `ghi chú ${id}`,
    ...extra,
  }) as IExpense;

function renderAs(user: Record<string, any>) {
  mockUser = user;
  getExpenses.mockResolvedValue({
    items: [row('plain'), row('mai', { paidByShareholderId: 's1', paidByShareholderName: 'Mai' })],
    totalCount: 2,
    totalAmount: 2_000_000,
  });
  return render(<ExpenseListView />);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ExpenseListView — theo quyền', () => {
  it('chỉ có quyền xem: thấy danh sách, không có nút thêm / sửa / xoá', async () => {
    renderAs({ role: 'Staff', roles: ['Staff'], permissions: ['expense.read'] });

    expect(await screen.findByText('ghi chú plain')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Thêm chi phí' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('được thêm + sửa: có nút thêm, sửa được khoản thường, khoản cổ đông chi hộ bị khoá', async () => {
    renderAs({
      role: 'Staff',
      roles: ['Staff'],
      permissions: ['expense.read', 'expense.create', 'expense.update'],
    });

    await screen.findByText('ghi chú plain');
    expect(screen.getByRole('link', { name: 'Thêm chi phí' })).toBeInTheDocument();
    const editButtons = screen
      .getAllByRole('button')
      .filter((b) => b.closest('td') && !b.getAttribute('aria-label'));
    expect(editButtons).toHaveLength(2);
    expect(editButtons[0]).toBeEnabled();
    expect(editButtons[1]).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('chủ cửa hàng sửa / xoá được cả khoản cổ đông chi hộ', async () => {
    renderAs({ role: 'Admin', roles: ['Admin'] });

    await screen.findByText('ghi chú mai');
    const rowButtons = screen.getAllByRole('button').filter((b) => b.closest('td'));
    expect(rowButtons).toHaveLength(4);
    rowButtons.forEach((b) => expect(b).toBeEnabled());
  });
});

describe('app/dashboard/pos/expense/layout — chặn trước khi trang gọi API', () => {
  it('không có quyền xem: báo không có quyền, không mount trang (không gọi API)', () => {
    mockUser = { role: 'Manager', roles: ['Manager'], permissions: [] };

    render(
      <ExpenseLayout>
        <ExpenseListView />
      </ExpenseLayout>
    );

    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(getExpenses).not.toHaveBeenCalled();
  });

  it('có quyền xem: vào được', async () => {
    mockUser = { role: 'Staff', roles: ['Staff'], permissions: ['expense.read'] };
    getExpenses.mockResolvedValue({ items: [row('plain')], totalCount: 1, totalAmount: 1_000_000 });

    render(
      <ExpenseLayout>
        <ExpenseListView />
      </ExpenseLayout>
    );

    expect(await screen.findByText('ghi chú plain')).toBeInTheDocument();
  });
});
