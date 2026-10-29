import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IInspectionFault, IInspectionShift, IInspectionTemplate } from 'src/types/inspection';

// ----------------------------------------------------------------------
// Tổng quan (trưởng ca bắt đầu kiểm nhanh ca mình), Lỗi tôi phụ trách (đánh dấu đã sửa cần ảnh), Bảng kiểm (tạo nháp
// từ mẫu, công bố sau khi xác nhận), Bản đồ lỗi (gom ô theo tuần).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// jsdom không có URL.createObjectURL (xem trước ảnh mới chọn).
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();

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
vi.mock('src/components/lightbox', () => ({ default: () => null, useLightBox: () => ({ onOpen: vi.fn() }) }));
vi.mock('src/components/chart', () => ({ default: () => null, useChart: (o: unknown) => o }));

const push = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));

const auth = { user: { id: 'lan', role: 'Staff', permissions: [] as string[] } };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));

const api = vi.hoisted(() => ({
  getInspectionShifts: vi.fn(),
  getInspectionDashboard: vi.fn(),
  startInspection: vi.fn(),
  getOpenInspectionFaults: vi.fn(),
  getMyInspectionFaults: vi.fn(),
  uploadInspectionPhotos: vi.fn(),
  fixInspectionResult: vi.fn(),
  getInspectionTemplates: vi.fn(),
  createInspectionTemplateDraft: vi.fn(),
  saveInspectionTemplateDraft: vi.fn(),
  publishInspectionTemplate: vi.fn(),
  deleteInspectionTemplateDraft: vi.fn(),
}));
vi.mock('src/api/inspection', () =>
  Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)]))
);

// Imported after the mocks above.
import InspectionDashboardView from 'src/sections/inspection/view/inspection-dashboard-view';
import InspectionMyFaultsView from 'src/sections/inspection/view/inspection-my-faults-view';
import InspectionTemplatesView from 'src/sections/inspection/view/inspection-templates-view';
import { toHeatSeries } from 'src/sections/inspection/view/inspection-heatmap-view';

const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={createTheme()}>{node}</ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'lan', role: 'Staff', permissions: [] };
});

const shift = (over: Partial<IInspectionShift>): IInspectionShift => ({
  date: '2026-11-02', shiftScheduleId: 'eve', shiftName: 'Ca Tối', startTime: '18:00', endTime: '22:30', shiftType: 'Main',
  branchId: null, staffCount: 2, shiftLeadId: 'lan', shiftLeadName: 'Lan', iAmOnShift: true, iAmShiftLead: true,
  quickInspectionId: null, quickStatus: null, spotChecks: 0, ...over,
});

describe('InspectionDashboardView', () => {
  it('shift lead without permissions sees their shift and starts the quick check', async () => {
    api.getInspectionShifts.mockResolvedValue([shift({})]);
    api.startInspection.mockResolvedValue({ summary: { id: 'insp-9' } });
    wrap(<InspectionDashboardView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Kiểm nhanh' }));

    expect(api.getInspectionDashboard).not.toHaveBeenCalled();
    expect(api.startInspection).toHaveBeenCalledWith('ShiftQuick', '2026-11-02', 'eve', false);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/inspection/run/insp-9'));
    expect(screen.queryByRole('button', { name: 'Đột xuất' })).toBeNull();
  });

  it('a person on shift who is not the lead cannot start the quick check', async () => {
    api.getInspectionShifts.mockResolvedValue([shift({ iAmShiftLead: false })]);
    wrap(<InspectionDashboardView />);

    await screen.findByText('Ca Tối');
    expect(screen.queryByRole('button', { name: 'Kiểm nhanh' })).toBeNull();
  });
});

const fault = (over: Partial<IInspectionFault>): IInspectionFault => ({
  resultId: 'r1', inspectionId: 'insp-1', inspectionType: 'ShiftQuick', date: '2026-11-02', shiftName: 'Ca Tối',
  itemCode: 'Q07', itemTitle: 'Lối đi, cầu thang', passCriteria: 'Không chắn lối', level: 'Mandatory', requiresPhotoOnFail: true,
  observedStaffId: null, note: 'Thùng hàng ở cầu thang', responsibleStaffId: 'lan', zoneUnassigned: false,
  recordedAt: '2026-11-02T11:10:00Z', fixDeadlineAt: '2026-11-02T11:25:00Z', fixedAt: null, fixNote: null, isOverdue: false,
  photos: [], ...over,
});

describe('InspectionMyFaultsView', () => {
  it('marking a fault fixed needs an after photo, which is uploaded to that inspection', async () => {
    api.getOpenInspectionFaults.mockResolvedValue([fault({})]);
    api.uploadInspectionPhotos.mockResolvedValue(['inspections/insp-1/after.jpg']);
    api.fixInspectionResult.mockResolvedValue(undefined);
    const u = userEvent.setup();
    wrap(<InspectionMyFaultsView />);

    await u.click(await screen.findByRole('button', { name: 'Đánh dấu đã sửa' }));
    const dialog = await screen.findByRole('dialog');
    const save = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Lưu')!;
    expect(save).toBeDisabled();

    const file = new File(['x'], 'after.jpg', { type: 'image/jpeg' });
    await u.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);
    await waitFor(() => expect(save).not.toBeDisabled());
    await u.click(save);

    await waitFor(() => expect(api.fixInspectionResult).toHaveBeenCalledWith('r1', null, ['inspections/insp-1/after.jpg']));
    expect(api.uploadInspectionPhotos).toHaveBeenCalledWith('insp-1', [file]);
    expect(api.getOpenInspectionFaults).toHaveBeenCalledWith('mine');
  });
});

const template = (over: Partial<IInspectionTemplate>): IInspectionTemplate => ({
  id: 't1', type: 'ShiftQuick', version: 1, name: 'Kiểm nhanh mỗi ca', effectiveFrom: '2026-11-01', publishedAt: null,
  inUse: false,
  items: [
    { id: 'i1', code: 'Q01', groupName: null, title: 'Lối vào', passCriteria: 'Xe xếp 2 bên', level: 'Mandatory', zones: ['A'],
      perStaff: false, observationsPerStaff: 1, requiresPhotoOnFail: true, requiresFix: true, sortOrder: 1,
      staffDoes: false, weekdays: null, blocks: null },
  ],
  ...over,
});

describe('InspectionTemplatesView', () => {
  it('with no checklist yet: warns, creates a draft from the default and opens it for editing', async () => {
    auth.user = { id: 'owner', role: 'Admin', permissions: [] };
    api.getInspectionTemplates.mockResolvedValueOnce([]).mockResolvedValue([template({})]);
    api.createInspectionTemplateDraft.mockResolvedValue(template({}));
    wrap(<InspectionTemplatesView />);

    expect(await screen.findByText(/Chưa có hạng mục kiểm nhanh nào đang dùng/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo nháp từ mẫu' }));

    await waitFor(() => expect(api.createInspectionTemplateDraft).toHaveBeenCalledWith('ShiftQuick', true, expect.any(String)));
    expect(await screen.findByDisplayValue('Lối vào')).toBeTruthy();
  });

  it('publishes a draft only after confirming', async () => {
    api.getInspectionTemplates.mockResolvedValue([template({})]);
    api.publishInspectionTemplate.mockResolvedValue(template({ publishedAt: 'x' }));
    const u = userEvent.setup();
    wrap(<InspectionTemplatesView />);

    await u.click(await screen.findByRole('button', { name: 'Công bố' }));
    const dialog = await screen.findByRole('dialog');
    await u.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Công bố')!);

    await waitFor(() => expect(api.publishInspectionTemplate).toHaveBeenCalledWith('t1'));
  });
});

describe('toHeatSeries', () => {
  it('one row per key with a cell per week; item rows without fails are dropped', () => {
    const weeks = ['2026-11-02', '2026-11-09'];
    const cells = [
      { key: 'Q07', label: 'Lối đi', weekStart: '2026-11-02', pass: 1, fail: 2 },
      { key: 'Q01', label: 'Lối vào', weekStart: '2026-11-09', pass: 3, fail: 0 },
    ];

    const series = toHeatSeries(weeks, cells, true);

    expect(series).toHaveLength(1);
    expect(series[0].name).toBe('Lối đi');
    expect(series[0].data.map((d) => d.y)).toEqual([2, 0]);
    expect(toHeatSeries(weeks, cells, false)).toHaveLength(2);
  });
});
