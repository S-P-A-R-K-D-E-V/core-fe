import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IInspection, IInspectionTemplateItem } from 'src/types/inspection';

// ----------------------------------------------------------------------
// Chạy checklist: mục theo người tạo một dòng mỗi người × mỗi lượt; chỉ nộp được khi đã chấm hết và lỗi cần ảnh đã có
// ảnh; nộp = lưu kết quả (kèm ảnh vừa tải lên) rồi mới nộp.
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
vi.mock('src/components/custom-breadcrumbs', () => ({ default: ({ heading }: { heading: string }) => <h1>{heading}</h1> }));
vi.mock('src/components/lightbox', () => ({ default: () => null, useLightBox: () => ({ onOpen: vi.fn() }) }));

const user = { id: 'lan', role: 'Staff', permissions: [] as string[] };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user }) }));

const getInspection = vi.fn();
const saveInspectionResults = vi.fn();
const submitInspection = vi.fn();
const uploadInspectionPhotos = vi.fn();
vi.mock('src/api/inspection', () => ({
  getInspection: (...a: any[]) => getInspection(...a),
  saveInspectionResults: (...a: any[]) => saveInspectionResults(...a),
  submitInspection: (...a: any[]) => submitInspection(...a),
  uploadInspectionPhotos: (...a: any[]) => uploadInspectionPhotos(...a),
}));

// Imported after the mocks above.
import InspectionRunView, { buildRows } from 'src/sections/inspection/view/inspection-run-view';

const item = (over: Partial<IInspectionTemplateItem>): IInspectionTemplateItem => ({
  id: 'i', code: 'Q', groupName: null, title: 'Mục', passCriteria: 'tiêu chí', level: 'Mandatory', zones: ['A'],
  perStaff: false, observationsPerStaff: 1, requiresPhotoOnFail: true, requiresFix: true, sortOrder: 1, staffDoes: false,
  weekdays: null, blocks: null, ...over,
});

const inspection = (): IInspection => ({
  summary: {
    id: 'insp-1', type: 'ShiftQuick', status: 'Draft', date: '2026-11-02', shiftScheduleId: 's', shiftName: 'Ca Tối',
    startTime: '18:00', endTime: '22:30', branchId: null, isSpotCheck: false, inspectorId: 'lan', inspectorName: 'Lan',
    startedAt: '2026-11-02T11:00:00Z', submittedAt: null, passCount: 0, failCount: 0, notApplicableCount: 0, passRate: null,
  },
  note: null,
  zoneOwners: {
    zones: { A: 'lan', B: 'mai' },
    shiftLeadId: 'lan',
    staff: [{ staffId: 'lan', name: 'Lan' }, { staffId: 'mai', name: 'Mai' }],
  },
  template: {
    id: 't', type: 'ShiftQuick', version: 1, name: 'Kiểm nhanh', effectiveFrom: '2026-11-01', publishedAt: 'x', inUse: true,
    items: [
      item({ id: 'q03', code: 'Q03', title: 'Mặt quầy', sortOrder: 1 }),
      item({ id: 'q11', code: 'Q11', title: 'Tác phong', perStaff: true, zones: [], requiresPhotoOnFail: false, sortOrder: 2 }),
    ],
  },
  results: [],
  completions: [],
});

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <InspectionRunView id="insp-1" />
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildRows', () => {
  it('one row per plain item, one per person × observation for per-staff items', () => {
    const data = inspection();
    data.template.items[1].observationsPerStaff = 3;
    const rows = buildRows(data);
    expect(rows).toHaveLength(1 + 2 * 3);
    expect(rows.filter((r) => r.staffId === 'mai').map((r) => r.index)).toEqual([0, 1, 2]);
  });
});

describe('InspectionRunView', () => {
  it('shows who did a staff item and their photo, and flags staff items not done yet', async () => {
    const data = inspection();
    data.template.items = [
      item({ id: 'v01', code: 'V01', title: 'Lau kính', staffDoes: true, sortOrder: 1 }),
      item({ id: 'v02', code: 'V02', title: 'Quét sàn', staffDoes: true, sortOrder: 2 }),
    ];
    data.completions = [
      {
        itemId: 'v01',
        completion: {
          id: 'c1', completedByUserId: 'mai', completedByName: 'Mai', completedAt: '2026-11-02T11:30:00Z', note: null,
          photos: [{ id: 'p1', kind: 'Fault', url: 'https://media/x.jpg', uploadedAt: '2026-11-02T11:30:00Z' }],
        },
      },
    ];
    getInspection.mockResolvedValue(data);
    renderView();

    expect(await screen.findByText(/Đã làm: Mai/)).toBeTruthy();
    expect(screen.getByAltText('Ảnh đã làm')).toBeTruthy();
    expect(screen.getAllByText('Chưa làm')).toHaveLength(1);
  });

  it('blocks submit until everything is scored and the fault has a photo, then saves before submitting', async () => {
    getInspection.mockResolvedValue(inspection());
    uploadInspectionPhotos.mockResolvedValue(['inspections/insp-1/1.jpg']);
    saveInspectionResults.mockImplementation(async () => inspection());
    submitInspection.mockResolvedValue({ ...inspection(), summary: { ...inspection().summary, status: 'Submitted' } });
    const u = userEvent.setup();
    renderView();

    await screen.findByText('Q03 · Mặt quầy');
    const submit = screen.getByRole('button', { name: 'Nộp' });
    expect(submit).toBeDisabled();

    const fails = screen.getAllByRole('button', { name: 'Không đạt' });
    const passes = screen.getAllByRole('button', { name: 'Đạt' });
    await u.click(fails[0]); // Q03 không đạt
    await u.click(passes[1]); // Q11 Lan
    await u.click(passes[2]); // Q11 Mai
    expect(screen.getByText(/1 lỗi cần ảnh/)).toBeTruthy();
    expect(submit).toBeDisabled();

    const file = new File(['x'], 'q03.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await u.upload(input, file);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nộp' })).not.toBeDisabled());

    await u.click(screen.getByRole('button', { name: 'Nộp' }));
    const dialog = await screen.findByRole('dialog');
    await u.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Nộp')!);

    await waitFor(() => expect(submitInspection).toHaveBeenCalledWith('insp-1', ''));
    expect(uploadInspectionPhotos).toHaveBeenCalledWith('insp-1', [file]);
    const [, results] = saveInspectionResults.mock.calls[0];
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'q03', outcome: 'Fail', faultPhotoKeys: ['inspections/insp-1/1.jpg'] }),
        expect.objectContaining({ itemId: 'q11', observedStaffId: 'mai', outcome: 'Pass' }),
      ])
    );
  });

  it('is read-only for someone who is neither inspector, shift lead nor manager', async () => {
    const data = inspection();
    data.summary.inspectorId = 'someone';
    data.zoneOwners.shiftLeadId = 'someone';
    getInspection.mockResolvedValue(data);
    renderView();

    await screen.findByText('Q03 · Mặt quầy');
    expect(screen.queryByRole('button', { name: 'Nộp' })).toBeNull();
    screen.getAllByRole('button', { name: 'Đạt' }).forEach((b) => expect(b).toBeDisabled());
  });
});
