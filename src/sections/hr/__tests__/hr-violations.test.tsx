import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IViolationEntry, IViolationPolicy, IViolationSummary } from 'src/types/hr';

import HrViolationsView, { bonusLabel } from '../view/hr-violations-view';

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
