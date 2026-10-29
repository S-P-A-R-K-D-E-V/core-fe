import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Giao việc & sửa tận gốc: một danh sách cho việc giao riêng và việc sửa tận gốc; hộp "Giao việc" giao cho một người
// (không nhóm) hoặc tạo việc sửa tận gốc.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading, action }: { heading: string; action?: React.ReactNode }) => (
    <div>
      <h1>{heading}</h1>
      {action}
    </div>
  ),
}));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { id: 'u-admin', role: 'Admin', permissions: [] } }),
}));

const api = vi.hoisted(() => ({
  getWorkTasks: vi.fn(),
  assignWorkTask: vi.fn(),
  cancelWorkTask: vi.fn(),
  getCorrectiveActions: vi.fn(),
  createCorrectiveAction: vi.fn(),
  updateCorrectiveAction: vi.fn(),
  getActiveStaffUsers: vi.fn(),
}));
vi.mock('src/api/hr', () => ({
  getWorkTasks: (...a: any[]) => api.getWorkTasks(...a),
  assignWorkTask: (...a: any[]) => api.assignWorkTask(...a),
  cancelWorkTask: (...a: any[]) => api.cancelWorkTask(...a),
  reviewWorkTask: vi.fn(),
  submitWorkTask: vi.fn(),
  getMyWorkTasks: vi.fn(),
  uploadWorkTaskPhotos: vi.fn(),
}));
vi.mock('src/api/inspection', () => ({
  getCorrectiveActions: (...a: any[]) => api.getCorrectiveActions(...a),
  createCorrectiveAction: (...a: any[]) => api.createCorrectiveAction(...a),
  updateCorrectiveAction: (...a: any[]) => api.updateCorrectiveAction(...a),
  getMyCorrectiveActions: vi.fn(),
  markCorrectiveActionDone: vi.fn(),
}));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: () => api.getActiveStaffUsers() }));

// Imported after the mocks above.
import CleaningAssignedView from 'src/sections/cleaning/view/cleaning-assigned-view';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.getWorkTasks.mockResolvedValue([]);
  api.getCorrectiveActions.mockResolvedValue([]);
  api.getActiveStaffUsers.mockResolvedValue([{ id: 'u-lan', fullName: 'Lan' }]);
});

describe('CleaningAssignedView', () => {
  it('một danh sách: việc giao riêng và gợi ý sửa tận gốc cùng bảng', async () => {
    api.getWorkTasks.mockResolvedValue([
      {
        id: 't1', group: 'Other', title: 'Đóng gói đơn online', description: null, assigneeId: 'u-lan', assigneeName: 'Lan',
        assignedBy: 'u-admin', dueAt: null, status: 'Submitted', submittedAt: '2026-10-29T03:00:00Z', submissionNote: null,
        reviewedBy: null, reviewedAt: null, reviewNote: null, implemented: false, onTime: true,
        createdAt: '2026-10-29T01:00:00Z', photos: [],
      },
    ]);
    api.getCorrectiveActions.mockResolvedValue([
      {
        id: 'c1', itemCode: 'Q07', title: 'Lỗi lặp Q07', rootCause: null, action: null, ownerUserId: null, dueDate: null,
        status: 'Suggested', suggestedForWeek: '2026-10-26', failCount: 4, createdAt: '2026-09-01T00:00:00Z',
        completedAt: null, ownerName: null,
      },
    ]);
    wrap(<CleaningAssignedView />);

    expect(await screen.findByText('Đóng gói đơn online')).toBeInTheDocument();
    expect(screen.getByText('Lỗi lặp Q07')).toBeInTheDocument();
    expect(screen.getByText('Gợi ý sửa tận gốc')).toBeInTheDocument();
    expect(screen.getByText('4 lần không đạt')).toBeInTheDocument();
  });

  it('Cho một người: gửi việc không có nhóm', async () => {
    api.assignWorkTask.mockResolvedValue({});
    wrap(<CleaningAssignedView />);

    expect(await screen.findByText('Không có việc nào.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Giao việc' }));
    await userEvent.type(screen.getByLabelText('Việc cần làm'), 'Đóng gói đơn online');
    await userEvent.click(screen.getByLabelText('Người làm'));
    await userEvent.click(await screen.findByRole('option', { name: 'Lan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));

    await waitFor(() =>
      expect(api.assignWorkTask).toHaveBeenCalledWith({
        title: 'Đóng gói đơn online',
        description: null,
        assigneeId: 'u-lan',
        dueAt: null,
      })
    );
    expect(api.createCorrectiveAction).not.toHaveBeenCalled();
  });

  it('Sửa tận gốc: tạo việc với mã hạng mục và nguyên nhân, chưa cần người làm', async () => {
    api.createCorrectiveAction.mockResolvedValue({});
    wrap(<CleaningAssignedView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Giao việc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tận gốc' }));
    await userEvent.type(screen.getByLabelText('Việc cần làm'), 'Thêm kệ để túi');
    await userEvent.type(screen.getByLabelText('Mã hạng mục bị lỗi lặp (nếu có)'), 'Q03');
    await userEvent.type(screen.getByLabelText('Nguyên nhân gốc'), 'Quầy không có chỗ để túi');
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));

    await waitFor(() =>
      expect(api.createCorrectiveAction).toHaveBeenCalledWith({
        title: 'Thêm kệ để túi',
        itemCode: 'Q03',
        rootCause: 'Quầy không có chỗ để túi',
        action: null,
        ownerUserId: null,
        dueDate: null,
      })
    );
    expect(api.assignWorkTask).not.toHaveBeenCalled();
  });
});
