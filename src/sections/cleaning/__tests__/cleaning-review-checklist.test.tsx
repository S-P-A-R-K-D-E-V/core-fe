import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Chấm vệ sinh theo quyền (Core-be cleaning.*): vào trang cần cleaning.read; nút Đạt / Không đạt cần cleaning.review,
// nút Phạt cần cleaning.penalty.manage — chỉ có quyền xem thì không thấy nút nào (API sẽ trả 403).
// ----------------------------------------------------------------------

let mockUser: Record<string, any> = { roles: ['Admin'] };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));
// Hàm ổn định giữa các lần render — tải checklist phụ thuộc enqueueSnackbar.
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/scrollbar', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('src/components/label', () => ({ default: ({ children }: any) => <span>{children}</span> }));
vi.mock('src/components/lightbox', () => ({ default: () => null, useLightBox: () => ({ onOpen: vi.fn() }) }));
vi.mock('src/components/table', () => ({
  TableHeadCustom: () => null,
  TableNoData: () => null,
}));

const getCleaningChecklist = vi.fn();
vi.mock('src/api/cleaning', () => ({
  getCleaningChecklist: (...args: any[]) => getCleaningChecklist(...args),
  reviewCleaningTask: vi.fn(),
  getShiftStaffForPenalty: vi.fn(),
  createCleaningPenalty: vi.fn(),
}));

// Imported after the mocks above.
import CleaningReviewChecklist from 'src/sections/cleaning/cleaning-review-checklist';

const task = (id: string, status: string) => ({
  id,
  name: `Việc ${id}`,
  area: null,
  status,
  completedByUserName: 'An',
  photoObjectKeys: [],
  penalties: [],
});

function renderWith(permissions: string[]) {
  mockUser = { roles: ['Staff'], permissions };
  getCleaningChecklist.mockResolvedValue([task('done', 'Done'), task('failed', 'Failed')]);
  return render(
    <ThemeProvider theme={createTheme()}>
      <CleaningReviewChecklist date="2026-10-16" block="Morning" />
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('CleaningReviewChecklist — quyền', () => {
  it('chỉ có quyền xem: thấy checklist, không có nút chấm / phạt', async () => {
    renderWith(['cleaning.read']);

    expect(await screen.findByText('Việc done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đạt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phạt' })).not.toBeInTheDocument();
  });

  it('có quyền chấm: nút Đạt / Không đạt, chưa có nút Phạt', async () => {
    renderWith(['cleaning.read', 'cleaning.review']);

    expect(await screen.findByRole('button', { name: 'Đạt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Không đạt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phạt' })).not.toBeInTheDocument();
  });

  it('có quyền phạt: nút Phạt ở việc không đạt', async () => {
    renderWith(['cleaning.read', 'cleaning.penalty.manage']);

    expect(await screen.findByRole('button', { name: 'Phạt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đạt' })).not.toBeInTheDocument();
  });
});
