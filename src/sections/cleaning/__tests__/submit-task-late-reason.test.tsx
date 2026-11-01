import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IWorkTask } from 'src/types/hr';

// ----------------------------------------------------------------------
// Nộp việc giao riêng: quá hạn thì hiện ô "Lý do trễ hạn" (quy chế: trễ không ghi lý do trừ 2 điểm) và gửi kèm lý do.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const api = vi.hoisted(() => ({
  submitWorkTask: vi.fn(),
  uploadWorkTaskPhotos: vi.fn(),
}));
vi.mock('src/api/hr', () => ({
  submitWorkTask: (...a: any[]) => api.submitWorkTask(...a),
  uploadWorkTaskPhotos: (...a: any[]) => api.uploadWorkTaskPhotos(...a),
  reviewWorkTask: vi.fn(),
  getMyWorkTasks: vi.fn(),
}));

// Imported after the mocks above.
import { SubmitTaskDialog } from 'src/sections/cleaning/assigned-tasks';

const task = (over: Partial<IWorkTask> = {}): IWorkTask => ({
  id: 't1',
  group: 'Other',
  title: 'Dán giá kệ mới',
  assigneeId: 'lan',
  assigneeName: 'Lan',
  assignedBy: 'admin',
  status: 'Assigned',
  implemented: false,
  onTime: false,
  createdAt: '2026-11-01T01:00:00Z',
  photos: [{ id: 'p1', url: 'x', uploadedAt: '2026-11-01T01:00:00Z' }],
  ...over,
});

const renderDialog = (t: IWorkTask) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <SubmitTaskDialog task={t} onClose={() => {}} onDone={() => {}} />
    </ThemeProvider>
  );

describe('Nộp việc — lý do trễ hạn', () => {
  it('quá hạn: hiện ô lý do trễ và gửi kèm khi nộp', async () => {
    api.uploadWorkTaskPhotos.mockResolvedValue([]);
    api.submitWorkTask.mockResolvedValue(task({ status: 'Submitted' }));
    renderDialog(task({ dueAt: '2000-01-01T00:00:00Z' }));

    await userEvent.type(screen.getByLabelText('Lý do trễ hạn'), 'Chờ hàng về');
    await userEvent.click(screen.getByRole('button', { name: 'Nộp' }));

    await waitFor(() => expect(api.submitWorkTask).toHaveBeenCalledWith('t1', null, [], 'Chờ hàng về'));
  });

  it('còn hạn: không hỏi lý do trễ', () => {
    renderDialog(task({ dueAt: '2999-01-01T00:00:00Z' }));

    expect(screen.queryByLabelText('Lý do trễ hạn')).not.toBeInTheDocument();
  });
});
