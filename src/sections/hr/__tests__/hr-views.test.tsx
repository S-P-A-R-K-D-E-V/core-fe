import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IHrRecord, IShiftLeave, IPolicyDocument, IPerformanceScore } from 'src/types/hr';

// ----------------------------------------------------------------------
// Nhân sự 1b: cảnh báo giờ, xin nghỉ ca (luật 24 giờ), ký xác nhận văn bản, biên bản (ngưỡng 20.000đ, ký / không ký),
// điểm của tôi (đề nghị xem xét lại trong hạn).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

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

const auth = { user: { id: 'lan', role: 'Staff', permissions: [] as string[] } };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));

const api = vi.hoisted(() => ({
  createShiftLeave: vi.fn(),
  cancelShiftLeave: vi.fn(),
  reviewShiftLeave: vi.fn(),
  getMyShiftLeaves: vi.fn(),
  getPendingShiftLeaves: vi.fn(),
  getShiftLeaves: vi.fn(),
  getPolicyDocuments: vi.fn(),
  publishPolicyDocument: vi.fn(),
  deactivatePolicyDocument: vi.fn(),
  acknowledgePolicyDocument: vi.fn(),
  getPolicyAcknowledgements: vi.fn(),
  getHrRecords: vi.fn(),
  getMyHrRecords: vi.fn(),
  createHrRecord: vi.fn(),
  voidHrRecord: vi.fn(),
  markHrRecordRefused: vi.fn(),
  signHrRecord: vi.fn(),
  refuseHrRecord: vi.fn(),
  getMyPerformance: vi.fn(),
  getPerformanceMonth: vi.fn(),
  getExcludedShifts: vi.fn(),
  computePerformance: vi.fn(),
  publishPerformance: vi.fn(),
  addExcludedShift: vi.fn(),
  removeExcludedShift: vi.fn(),
  requestPerformanceReview: vi.fn(),
  respondPerformanceReview: vi.fn(),
}));
vi.mock('src/api/hr', () =>
  Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)]))
);

const schedule = vi.hoisted(() => ({ getMySchedule: vi.fn(), getShiftSchedulesByDateRange: vi.fn() }));
vi.mock('src/api/attendance', () => ({
  getMySchedule: (...a: any[]) => schedule.getMySchedule(...a),
  getShiftSchedulesByDateRange: (...a: any[]) => schedule.getShiftSchedulesByDateRange(...a),
}));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: vi.fn().mockResolvedValue([]) }));
// Luật của cửa hàng: báo trước 24 giờ khi xin nghỉ, ngưỡng biên bản 20.000đ (như CiCi).
vi.mock('src/api/hr-rules', () => ({
  useActiveHrRules: () => ({ leaveMinNoticeHours: 24, recordCashThreshold: 20_000, performanceEnabled: true }),
  shortTime: (v: string | null) => (v ? v.slice(0, 5) : ''),
}));

// Imported after the mocks above.
import HrLeaveView, { hoursUntil } from 'src/sections/hr/view/hr-leave-view';
import HrPoliciesView from 'src/sections/hr/view/hr-policies-view';
import HrRecordsView, { parseAmount } from 'src/sections/hr/view/hr-records-view';
import HrPerformanceView from 'src/sections/hr/view/hr-performance-view';
import { fVnd, monthEnd, previousMonth, HourWarningsAlert } from 'src/sections/hr/hr-common';

const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={createTheme()}>{node}</ThemeProvider>);

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

afterEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
});

describe('hr-common', () => {
  it('formats money and months', () => {
    expect(fVnd(1250000)).toBe('1.250.000đ');
    expect(fVnd(null)).toBe('—');
    expect(monthEnd('2026-02-01')).toBe('2026-02-28');
    expect(previousMonth('2026-01-01')).toBe('2025-12-01');
  });

  it('shows hour warnings per person, red when over 12h a day', () => {
    wrap(
      <HourWarningsAlert
        people={[
          {
            staffId: 'y',
            role: 'Người nhận',
            warnings: [{ code: 'OverDailyMax', message: 'Quá 12 giờ trong ngày (14,25 giờ).' }],
          },
        ]}
      />
    );
    expect(screen.getByText('Người nhận')).toBeInTheDocument();
    expect(screen.getByText(/Quá 12 giờ/)).toBeInTheDocument();
    expect(screen.getByRole('alert').className).toMatch(/Error/i);
  });

  it('renders nothing without warnings', () => {
    const { container } = wrap(<HourWarningsAlert people={[{ staffId: 'y', role: 'Người nhận', warnings: [] }]} />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('HrLeaveView', () => {
  it('counts hours to the shift start', () => {
    expect(hoursUntil('2026-11-02', '18:00', new Date('2026-11-01T18:00:00'))).toBe(24);
  });

  it('needs "Khẩn cấp" for a shift starting in under 24 hours', async () => {
    api.getMyShiftLeaves.mockResolvedValue([]);
    const soon = new Date(Date.now() + 5 * 3_600_000);
    schedule.getMySchedule.mockResolvedValue([
      {
        id: 'a1',
        assignmentId: 'a1',
        scheduleName: 'Ca Tối',
        date: isoDate(soon),
        startTime: `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`,
        endTime: '23:59',
        hasCheckedIn: false,
      },
    ]);
    api.createShiftLeave.mockResolvedValue({});
    const user = userEvent.setup();

    wrap(<HrLeaveView />);
    await user.click(screen.getByRole('button', { name: 'Xin nghỉ ca' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Ca Tối/ }));
    await user.type(screen.getByLabelText('Lý do'), 'Sốt cao');

    expect(screen.getByText(/Còn dưới 24 giờ/)).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Gửi đơn' });
    expect(send).toBeDisabled();

    await user.click(screen.getByLabelText(/Khẩn cấp/));
    expect(send).toBeEnabled();
    await user.click(send);
    await waitFor(() =>
      expect(api.createShiftLeave).toHaveBeenCalledWith({ shiftAssignmentId: 'a1', reason: 'Sốt cao', isEmergency: true })
    );
  });

  it('lets reviewers approve pending leave', async () => {
    auth.user.permissions = ['shift.leave.review'];
    const leave: IShiftLeave = {
      id: 'l1',
      staffId: 'mai',
      staffName: 'Mai Lê',
      shiftAssignmentId: 'a2',
      shiftDate: '2026-11-02',
      shiftScheduleId: 's',
      shiftName: 'Ca Tối',
      startTime: '18:00:00',
      endTime: '22:30:00',
      reason: 'Ốm',
      isEmergency: true,
      isLateNotice: true,
      status: 'Pending',
      createdAt: '2026-11-02T01:00:00Z',
    };
    api.getPendingShiftLeaves.mockResolvedValue([leave]);
    api.reviewShiftLeave.mockResolvedValue({ ...leave, status: 'Approved' });
    const user = userEvent.setup();

    wrap(<HrLeaveView />);
    expect(await screen.findByText('Mai Lê')).toBeInTheDocument();
    expect(screen.getByText('Báo dưới 24 giờ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Duyệt' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(api.reviewShiftLeave).toHaveBeenCalledWith('l1', true, ''));
  });
});

describe('HrPoliciesView', () => {
  it('acknowledges after confirming', async () => {
    const doc: IPolicyDocument = {
      id: 'd1',
      code: 'noi-quy',
      title: 'Nội quy CiCi',
      version: 2,
      summary: 'Đi làm đúng giờ',
      isActive: true,
      publishedAt: '2026-10-27T00:00:00Z',
      acknowledgedAt: null,
    };
    api.getPolicyDocuments.mockResolvedValue([doc]);
    api.acknowledgePolicyDocument.mockResolvedValue({ ...doc, acknowledgedAt: '2026-10-27T03:00:00Z' });
    const user = userEvent.setup();

    wrap(<HrPoliciesView />);
    await user.click(await screen.findByRole('button', { name: 'Tôi đã đọc và hiểu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tôi đã đọc và hiểu' }));
    await waitFor(() => expect(api.acknowledgePolicyDocument).toHaveBeenCalledWith('d1'));
  });
});

describe('HrRecordsView', () => {
  it('parses signed amounts', () => {
    expect(parseAmount('-50.000')).toBe(-50000);
    expect(parseAmount('')).toBeNull();
  });

  it('staff signs with a statement or refuses with a reason', async () => {
    const record: IHrRecord = {
      id: 'r1',
      type: 'CashDiscrepancy',
      staffId: 'lan',
      staffName: 'Lan',
      occurredOn: '2026-11-02',
      amount: -50000,
      description: 'Thiếu tiền khi bàn giao ca',
      personalFault: true,
      status: 'AwaitingSignature',
      createdBy: 'admin',
      createdAt: '2026-11-02T15:00:00Z',
    };
    api.getMyHrRecords.mockResolvedValue([record]);
    api.refuseHrRecord.mockResolvedValue({});
    const user = userEvent.setup();

    wrap(<HrRecordsView />);
    await user.click(await screen.findByRole('button', { name: 'Không ký' }));
    const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận' });
    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText('Lý do tôi không ký'), 'Không phải ca tôi');
    await user.click(confirmButton);
    await waitFor(() => expect(api.refuseHrRecord).toHaveBeenCalledWith('r1', 'Không phải ca tôi'));
  });
});

describe('HrPerformanceView', () => {
  it('offers a review request only before the deadline', async () => {
    const base: IPerformanceScore = {
      id: 's1',
      userId: 'lan',
      fullName: 'Lan',
      month: '2026-10-01',
      shiftCount: 12,
      hoursWorked: 54,
      targetAchievementPct: 95,
      lateCount: 0,
      missedCheckoutCount: 0,
      inspectionFaults: 0,
      discrepancyFaults: 0,
      salesPoints: 38,
      qualityPoints: 15,
      taskPoints: 20,
      disciplinePoints: 15,
      reconciliationPoints: 10,
      initiativePoints: 0,
      total: 98,
      isDefaultScore: false,
      rating: 'Good',
      ratingReason: 'Đạt 95% target, kỷ luật 15/15.',
      consecutiveNotComplete: false,
      details: {},
      computedAt: '2026-11-01T00:00:00Z',
      reviewDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    };
    api.getMyPerformance.mockResolvedValue([base, { ...base, id: 's0', month: '2026-09-01', reviewDeadline: '2026-10-05T17:00:00Z' }]);
    api.requestPerformanceReview.mockResolvedValue({});
    const user = userEvent.setup();

    wrap(<HrPerformanceView />);
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Đề nghị xem xét lại' });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    await user.type(screen.getByLabelText(/Điểm nào cần xem lại/), 'Ca 05/10 mất điện');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));
    await waitFor(() => expect(api.requestPerformanceReview).toHaveBeenCalledWith('s1', 'Ca 05/10 mất điện'));
  });
});
