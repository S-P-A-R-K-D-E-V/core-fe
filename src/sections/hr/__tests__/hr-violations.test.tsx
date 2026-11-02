import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IViolationEntry, IViolationPolicy, IViolationSummary } from 'src/types/hr';

import HrViolationsView, { money, ruleMoney, bonusLabel, occurrenceLabel } from '../view/hr-violations-view';

// ----------------------------------------------------------------------
// Vi phạm & điểm trừ: nhân viên thấy điểm trừ tháng của mình + khiếu nại trong hạn; quản lý thấy bảng điểm cả cửa hàng.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}));

const auth = { user: { id: 'lan', role: 'Staff', permissions: [] as string[] } };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: vi.fn().mockResolvedValue([]) }));

const api = vi.hoisted(() => ({
  getViolations: vi.fn(),
  syncViolations: vi.fn(),
  getViolationShift: vi.fn(),
  cancelViolation: vi.fn(),
  getMyViolations: vi.fn(),
  createViolations: vi.fn(),
  resolveViolation: vi.fn(),
  complainViolation: vi.fn(),
  saveViolationRule: vi.fn(),
  getViolationCatalog: vi.fn(),
  getViolationSummary: vi.fn(),
  saveViolationPolicy: vi.fn(),
  archiveViolationRule: vi.fn(),
}));
vi.mock('src/api/hr', () =>
  Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)]))
);

const adjustAttendanceTime = vi.hoisted(() => vi.fn());
vi.mock('src/api/attendance', () => ({ adjustAttendanceTime: (...a: any[]) => adjustAttendanceTime(...a) }));

const theme = createTheme();
const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <HrViolationsView />
    </ThemeProvider>
  );

const policy: IViolationPolicy = {
  effectiveFrom: '2026-11-01',
  halfBonusFromPoints: 6,
  halfBonusPct: 50,
  noBonusFromPoints: 10,
  notCompleteFromPoints: 15,
  updatedAt: '2026-10-30T00:00:00Z',
  appliesToBonus: true,
};

const summary = (over: Partial<IViolationSummary> = {}): IViolationSummary => ({
  userId: 'lan',
  fullName: 'Lan',
  points: 7,
  disciplinePoints: 7,
  reconciliationPoints: 0,
  count: 2,
  disputed: 0,
  weeklyBonusPct: 50,
  notComplete: false,
  losesMonthlyBonus: false,
  weeksWithoutBonus: [],
  ...over,
});

const entry = (over: Partial<IViolationEntry> = {}): IViolationEntry => ({
  id: 'e1',
  ruleId: 'r1',
  userId: 'lan',
  fullName: 'Lan',
  occurredOn: '2026-11-02',
  shiftName: 'Ca Tối',
  quantity: 1,
  points: 4,
  ruleName: 'Đi muộn trên 15 phút',
  groupName: 'Giờ giấc',
  component: 'Discipline',
  losesWeeklyBonus: false,
  losesMonthlyBonus: false,
  note: 'Muộn 20 phút.',
  isAuto: true,
  status: 'Active',
  createdAt: '2026-11-03T01:00:00Z',
  complaintDeadline: '2999-01-01',
  ...over,
});

afterEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
});

describe('Vi phạm & điểm trừ', () => {
  it('nhân viên thấy điểm trừ tháng, mức thưởng tuần và khiếu nại được', async () => {
    api.getMyViolations.mockResolvedValue({
      month: '2026-11-01',
      policy,
      summary: summary(),
      entries: [entry(), entry({ id: 'e2', ruleName: 'Quên chấm công vào hoặc ra', points: 3, complaintDeadline: '2000-01-01' })],
    });
    api.complainViolation.mockResolvedValue(entry({ status: 'Disputed' }));
    renderView();

    expect(await screen.findByText('Nhận 50% thưởng tuần')).toBeInTheDocument();
    expect(screen.getByText('Đi muộn trên 15 phút')).toBeInTheDocument();
    expect(screen.queryByText('Điểm cả cửa hàng')).not.toBeInTheDocument();
    // Lần thứ hai đã quá hạn khiếu nại → chỉ một nút.
    const buttons = screen.getAllByRole('button', { name: 'Khiếu nại' });
    expect(buttons).toHaveLength(1);

    await userEvent.click(buttons[0]);
    await userEvent.type(screen.getByLabelText('Lý do khiếu nại'), 'Em đã báo quản lý');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi khiếu nại' }));
    await waitFor(() => expect(api.complainViolation).toHaveBeenCalledWith('e1', 'Em đã báo quản lý'));
  });

  it('quản lý mở thẳng bảng điểm cả cửa hàng', async () => {
    auth.user.permissions = ['hr.violation.manage'];
    api.getViolationSummary.mockResolvedValue({
      month: '2026-11-01',
      policy,
      rows: [summary({ fullName: 'Mai', userId: 'mai', points: 15, weeklyBonusPct: 0, notComplete: true })],
    });
    api.getViolations.mockResolvedValue([entry({ userId: 'mai', fullName: 'Mai', status: 'Disputed', complaintText: 'Sai giờ' })]);
    renderView();

    expect(await screen.findByText('Không nhận thưởng · Không hoàn thành')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi vi phạm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chấp nhận' })).toBeInTheDocument();
    expect(screen.getByText('Khiếu nại: Sai giờ')).toBeInTheDocument();
  });

  it('bonusLabel: không đặt ngưỡng thì không hiện mức thưởng', () => {
    expect(bonusLabel({ weeklyBonusPct: null, notComplete: false, losesMonthlyBonus: false })).toBeNull();
    expect(bonusLabel({ weeklyBonusPct: 100, notComplete: false, losesMonthlyBonus: false })).toBe('Nhận đủ thưởng tuần');
    expect(bonusLabel({ weeklyBonusPct: 0, notComplete: false, losesMonthlyBonus: false })).toBe('Không nhận thưởng tuần');
  });
});

describe('Sửa chấm công từ khiếu nại', () => {
  const disputed = () =>
    entry({ id: 'v1', userId: 'mai', fullName: 'Mai', status: 'Disputed', complaintText: 'Không chấm được', attendanceAssignmentId: 'a1' });

  const setup = (permissions: string[], row = disputed()) => {
    auth.user.permissions = permissions;
    api.getViolationSummary.mockResolvedValue({ month: '2026-11-01', policy, rows: [summary({ fullName: 'Mai', userId: 'mai' })] });
    api.getViolations.mockResolvedValue([row]);
    api.getViolationShift.mockResolvedValue({
      shiftAssignmentId: 'a1',
      staffId: 'mai',
      staffName: 'Mai',
      shiftName: 'Ca Tối',
      date: '2026-11-01',
      startTime: '18:00:00',
      endTime: '22:30:00',
      checkInTime: '2026-11-01T11:00:00Z',
      checkOutTime: null,
    });
    adjustAttendanceTime.mockResolvedValue({});
    renderView();
  };

  it('mở đúng ca, giữ giờ vào hiện có theo giờ VN, lưu rồi trả lời khiếu nại', async () => {
    setup(['hr.violation.manage', 'attendance.adjust']);
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa chấm công' }));

    expect(api.getViolationShift).toHaveBeenCalledWith('v1');
    expect(await screen.findByLabelText('Giờ vào')).toHaveValue('2026-11-01T18:00');
    expect(screen.getByText(/Ca Tối · 01\/11\/2026 · 18:00–22:30/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Giờ ra'), '2026-11-01T22:30');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu chấm công' }));
    await waitFor(() =>
      expect(adjustAttendanceTime).toHaveBeenCalledWith({
        shiftAssignmentId: 'a1',
        checkInTime: '2026-11-01T11:00:00.000Z',
        checkOutTime: '2026-11-01T15:30:00.000Z',
        note: 'Sửa từ khiếu nại vi phạm',
      })
    );

    // Sửa công chưa đóng khiếu nại: quản lý vẫn chọn trả lời.
    expect(api.resolveViolation).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Chấp nhận khiếu nại' }));
    expect(await screen.findByLabelText('Trả lời nhân viên')).toBeInTheDocument();
  });

  it('không có quyền sửa chấm công hoặc lần ghi nhận không gắn ca → không hiện nút', async () => {
    setup(['hr.violation.manage']);
    expect(await screen.findByRole('button', { name: 'Chấp nhận' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa chấm công' })).not.toBeInTheDocument();
  });

  it('khiếu nại lần ghi tay (không gắn ca) → không hiện nút dù có quyền', async () => {
    setup(['hr.violation.manage', 'attendance.adjust'], { ...disputed(), attendanceAssignmentId: null });
    expect(await screen.findByRole('button', { name: 'Chấp nhận' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa chấm công' })).not.toBeInTheDocument();
  });
});

describe('Công tắc tính vào thưởng', () => {
  it('Admin bật / tắt nhanh ngay trên bảng điểm; tắt thì mức thưởng ghi "chưa tính vào thưởng"', async () => {
    auth.user.permissions = ['hr.violation.manage', 'hr.rule.manage'];
    api.getViolationSummary.mockResolvedValue({
      month: '2026-11-01',
      policy: { ...policy, appliesToBonus: false },
      rows: [summary({ fullName: 'Mai', userId: 'mai' })],
    });
    api.getViolations.mockResolvedValue([]);
    api.saveViolationPolicy.mockResolvedValue({ ...policy, appliesToBonus: true });
    renderView();

    expect(await screen.findByText('Nhận 50% thưởng tuần (chưa tính vào thưởng)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Tính điểm trừ vào thưởng doanh số tuần/ }));
    await waitFor(() =>
      expect(api.saveViolationPolicy).toHaveBeenCalledWith(expect.objectContaining({ appliesToBonus: true, halfBonusFromPoints: 6 }))
    );
  });

  it('bật / tắt công tắc giữ nguyên tiền phạt / điểm (PUT thay cả dòng)', async () => {
    auth.user.permissions = ['hr.violation.manage', 'hr.rule.manage'];
    api.getViolationSummary.mockResolvedValue({
      month: '2026-11-01',
      policy: { ...policy, appliesToBonus: false, fineAmountPerPoint: 10000 },
      rows: [summary({ fullName: 'Mai', userId: 'mai', fineAmount: 70000 })],
    });
    api.getViolations.mockResolvedValue([]);
    api.saveViolationPolicy.mockResolvedValue({ ...policy, fineAmountPerPoint: 10000 });
    renderView();

    expect(await screen.findByText('Tiền phạt')).toBeInTheDocument();
    expect(screen.getByText(money(70000))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Tính điểm trừ vào thưởng doanh số tuần/ }));
    await waitFor(() =>
      expect(api.saveViolationPolicy).toHaveBeenCalledWith(expect.objectContaining({ appliesToBonus: true, fineAmountPerPoint: 10000 }))
    );
  });
});

describe('Tiền phạt & tái phạm', () => {
  it('nhân viên thấy tiền phạt của từng lần, tổng tháng và bậc tái phạm', async () => {
    api.getMyViolations.mockResolvedValue({
      month: '2026-11-01',
      policy: { ...policy, fineAmountPerPoint: 10000 },
      summary: summary({ points: 15, fineAmount: 150000 }),
      entries: [
        entry({
          ruleName: 'Bỏ ca không báo',
          points: 15,
          fineAmount: 150000,
          occurrence: 2,
          occurrenceWindowMonths: 12,
          escalationAction: 'Kéo dài thời hạn nâng lương',
        }),
      ],
    });
    renderView();

    expect(await screen.findByText('Tiền phạt (trừ vào lương)')).toBeInTheDocument();
    expect(screen.getByText(money(150000))).toBeInTheDocument();
    expect(screen.getByText(`~${money(150000)}`)).toBeInTheDocument();
    expect(screen.getByText('Lần 2 trong 12 tháng · Kéo dài thời hạn nâng lương')).toBeInTheDocument();
  });

  it('ruleMoney: số tiền riêng của hành vi ghi đè điểm × đơn giá; 0 = không quy ra tiền; không đơn giá = không hiện', () => {
    const p = { ...policy, fineAmountPerPoint: 10000 };
    expect(ruleMoney({ points: 3, fineAmount: null }, p, 2)).toBe(60000);
    expect(ruleMoney({ points: 5, fineAmount: 0 }, p)).toBe(0);
    expect(ruleMoney({ points: 5, fineAmount: 25000 }, p, 2)).toBe(50000);
    expect(ruleMoney({ points: 5, fineAmount: null }, { ...policy, fineAmountPerPoint: null })).toBeNull();
  });

  it('occurrenceLabel: trong tháng / N tháng, chưa tới bậc thì không có việc', () => {
    expect(occurrenceLabel({ occurrence: null })).toBeNull();
    expect(occurrenceLabel({ occurrence: 1, occurrenceWindowMonths: 1, escalationAction: null })).toBe('Lần 1 trong tháng');
    expect(occurrenceLabel({ occurrence: 2, occurrenceWindowMonths: 3, escalationAction: 'Khiển trách' })).toBe(
      'Lần 2 trong 3 tháng · Khiển trách'
    );
  });
});
