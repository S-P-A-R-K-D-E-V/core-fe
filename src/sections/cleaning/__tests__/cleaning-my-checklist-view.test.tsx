import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IShiftWorkShift } from 'src/types/inspection';

// jsdom không có URL.createObjectURL (xem trước ảnh mới chọn).
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();

// ----------------------------------------------------------------------
// Việc của tôi: hạng mục nhân viên tự làm trong ca — "Đã làm" chụp ảnh, tải lên rồi ghi nhận; đã kiểm thì không làm lại.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({ default: ({ heading }: { heading: string }) => <h1>{heading}</h1> }));
vi.mock('src/components/lightbox', () => ({ default: () => null, useLightBox: () => ({ onOpen: vi.fn() }) }));
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: { label: string }) => <input aria-label={label} readOnly />,
}));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: { id: 'lan', role: 'Staff', permissions: [] } }) }));

const api = vi.hoisted(() => ({
  getMyShiftWork: vi.fn(),
  completeShiftWork: vi.fn(),
  uploadShiftWorkPhotos: vi.fn(),
  getOpenInspectionFaults: vi.fn(),
  getMyCorrectiveActions: vi.fn(),
  getMyCleaningChecklist: vi.fn(),
  getMyWorkTasks: vi.fn(),
}));
vi.mock('src/api/inspection', () => ({
  getMyShiftWork: (...a: any[]) => api.getMyShiftWork(...a),
  completeShiftWork: (...a: any[]) => api.completeShiftWork(...a),
  uploadShiftWorkPhotos: (...a: any[]) => api.uploadShiftWorkPhotos(...a),
  getOpenInspectionFaults: (...a: any[]) => api.getOpenInspectionFaults(...a),
  getMyInspectionFaults: vi.fn(),
  fixInspectionResult: vi.fn(),
  uploadInspectionPhotos: vi.fn(),
  getMyCorrectiveActions: (...a: any[]) => api.getMyCorrectiveActions(...a),
  markCorrectiveActionDone: vi.fn(),
}));
vi.mock('src/api/cleaning', () => ({
  getMyCleaningChecklist: (...a: any[]) => api.getMyCleaningChecklist(...a),
  completeCleaningTask: vi.fn(),
}));
vi.mock('src/api/hr', () => ({
  getMyWorkTasks: (...a: any[]) => api.getMyWorkTasks(...a),
  reviewWorkTask: vi.fn(),
  submitWorkTask: vi.fn(),
  uploadWorkTaskPhotos: vi.fn(),
}));

// Imported after the mocks above.
import CleaningMyChecklistView from 'src/sections/cleaning/view/cleaning-my-checklist-view';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

const shift = (items: IShiftWorkShift['items']): IShiftWorkShift => ({
  date: '2026-11-02',
  shiftScheduleId: 'sch-1',
  shiftName: 'Ca Sáng',
  startTime: '08:00:00',
  endTime: '15:00:00',
  block: 'Morning',
  items,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getOpenInspectionFaults.mockResolvedValue([]);
  api.getMyCorrectiveActions.mockResolvedValue([]);
  api.getMyCleaningChecklist.mockResolvedValue([]);
  api.getMyWorkTasks.mockResolvedValue([]);
});

describe('CleaningMyChecklistView', () => {
  it('Đã làm: tải ảnh lên kho của ca rồi ghi nhận hạng mục', async () => {
    api.getMyShiftWork.mockResolvedValue([
      shift([
        {
          itemId: 'v01', code: 'V01', groupName: 'Việc theo ca', title: 'Lau kính mặt tiền', passCriteria: 'Kính sạch, không vệt',
          zones: [], requiresPhoto: true, completion: null, outcome: null,
        },
      ]),
    ]);
    api.uploadShiftWorkPhotos.mockResolvedValue(['shift-work/sch-1/2026-11-02/a.jpg']);
    api.completeShiftWork.mockResolvedValue({});
    const u = userEvent.setup();
    wrap(<CleaningMyChecklistView />);

    expect(await screen.findByText('Lau kính mặt tiền')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Đã làm' }));

    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Lưu' });
    expect(save).toBeDisabled();
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await u.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);
    await waitFor(() => expect(save).not.toBeDisabled());
    await u.click(save);

    await waitFor(() =>
      expect(api.completeShiftWork).toHaveBeenCalledWith({
        date: expect.any(String),
        shiftScheduleId: 'sch-1',
        itemId: 'v01',
        note: null,
        photoKeys: ['shift-work/sch-1/2026-11-02/a.jpg'],
      })
    );
    expect(api.uploadShiftWorkPhotos).toHaveBeenCalledWith('sch-1', expect.any(String), [file]);
  });

  it('đã kiểm thì hiện kết quả, không còn nút làm', async () => {
    api.getMyShiftWork.mockResolvedValue([
      shift([
        {
          itemId: 'v01', code: 'V01', groupName: null, title: 'Lau kính mặt tiền', passCriteria: 'Kính sạch',
          zones: ['A'], requiresPhoto: true, outcome: 'Pass',
          completion: {
            id: 'c1', completedByUserId: 'mai', completedByName: 'Mai', completedAt: '2026-11-02T02:00:00Z', note: null, photos: [],
          },
        },
      ]),
    ]);
    wrap(<CleaningMyChecklistView />);

    expect(await screen.findByText('Kiểm: Đạt')).toBeInTheDocument();
    expect(screen.getByText(/Đã làm: Mai/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đã làm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Làm lại' })).toBeNull();
  });
});
