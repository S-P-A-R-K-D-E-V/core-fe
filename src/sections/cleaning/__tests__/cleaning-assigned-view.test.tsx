import { format } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Giao việc: "Cho cả ca" tạo đầu việc theo ca chỉ áp dụng đúng ngày đã chọn; "Cho một người" giao việc riêng không có nhóm.
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
  createCleaningTaskTemplate: vi.fn(),
  getAllShiftTemplates: vi.fn(),
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
vi.mock('src/api/cleaning', () => ({
  createCleaningTaskTemplate: (...a: any[]) => api.createCleaningTaskTemplate(...a),
}));
vi.mock('src/api/attendance', () => ({ getAllShiftTemplates: () => api.getAllShiftTemplates() }));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: () => api.getActiveStaffUsers() }));

// Imported after the mocks above.
import CleaningAssignedView from 'src/sections/cleaning/view/cleaning-assigned-view';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('CleaningAssignedView', () => {
  it('Cho cả ca: tạo đầu việc chỉ đúng ngày đã chọn', async () => {
    api.getWorkTasks.mockResolvedValue([]);
    api.getActiveStaffUsers.mockResolvedValue([]);
    api.getAllShiftTemplates.mockResolvedValue([{ id: 's1', isActive: true, cleaningBlock: 'Afternoon' }]);
    api.createCleaningTaskTemplate.mockResolvedValue({});
    wrap(<CleaningAssignedView />);

    expect(await screen.findByText(/Chưa giao việc riêng/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Giao việc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cho cả ca' }));
    await userEvent.type(screen.getByLabelText('Việc cần làm'), 'Kiểm hàng khu B');
    await userEvent.click(screen.getByLabelText('Ca'));
    await userEvent.click(await screen.findByRole('option', { name: 'Chiều' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));

    const today = format(new Date(), 'yyyy-MM-dd');
    await waitFor(() =>
      expect(api.createCleaningTaskTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kiểm hàng khu B',
          cleaningBlock: 'Afternoon',
          fromDate: today,
          toDate: today,
          dayOfWeek: format(new Date(`${today}T00:00:00`), 'EEEE'),
        })
      )
    );
    expect(api.assignWorkTask).not.toHaveBeenCalled();
  });

  it('Cho cả ca: ca chưa gắn khung thì không tạo', async () => {
    api.getWorkTasks.mockResolvedValue([]);
    api.getActiveStaffUsers.mockResolvedValue([]);
    api.getAllShiftTemplates.mockResolvedValue([{ id: 's1', isActive: true, cleaningBlock: 'Evening' }]);
    api.createCleaningTaskTemplate.mockClear();
    wrap(<CleaningAssignedView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Giao việc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cho cả ca' }));
    await userEvent.type(screen.getByLabelText('Việc cần làm'), 'Lau kính');
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/Khung ca giao việc/), { variant: 'error' })
    );
    expect(api.createCleaningTaskTemplate).not.toHaveBeenCalled();
  });

  it('Cho một người: gửi việc không có nhóm', async () => {
    api.getWorkTasks.mockResolvedValue([]);
    api.getActiveStaffUsers.mockResolvedValue([{ id: 'u-lan', fullName: 'Lan' }]);
    api.assignWorkTask.mockResolvedValue({});
    wrap(<CleaningAssignedView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Giao việc' }));
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
  });
});
