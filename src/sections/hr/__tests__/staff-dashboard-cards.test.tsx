import { vi, it, expect, describe, beforeEach } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';

import { StaffDashboardCards } from '../staff-dashboard-cards';

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

const hr = vi.hoisted(() => ({
  getMyWorkTasks: vi.fn(),
  getMyViolations: vi.fn(),
  getMyWeeklyBonus: vi.fn(),
  complainViolation: vi.fn(),
  getMyCurrentEstimate: vi.fn(),
}));
vi.mock('src/api/hr', () => hr);
const attendance = vi.hoisted(() => ({ getMySchedule: vi.fn() }));
vi.mock('src/api/attendance', () => attendance);
const quarter = vi.hoisted(() => ({ getMyQuarterBonus: vi.fn() }));
vi.mock('src/api/quarter-bonus', () => quarter);

const violations = {
  month: '2026-11-01',
  policy: { effectiveFrom: '2026-11-01', updatedAt: '', appliesToBonus: true, halfBonusFromPoints: 6, noBonusFromPoints: 10, notCompleteFromPoints: 15 },
  summary: { points: 7, simulatedAmount: 70000 },
  entries: [{ id: 'e1', ruleName: 'Đi muộn trên 15 phút', occurredOn: '2026-11-02', points: 4, status: 'Active', complainedAt: null, complaintDeadline: '2099-01-01' }],
};

beforeEach(() => {
  attendance.getMySchedule.mockResolvedValue([]);
  hr.getMyWorkTasks.mockResolvedValue([]);
  hr.getMyWeeklyBonus.mockResolvedValue([
    { weekStart: '2026-11-02', achievementPct: 114, fund: 800000, myHours: 24, totalHours: 196, myAmount: 97959, paidInPayroll: true },
  ]);
  hr.getMyViolations.mockResolvedValue(violations);
  hr.getMyCurrentEstimate.mockResolvedValue({
    configured: true, fromDate: '2026-11-01', toDate: '2026-11-30', asOf: '2026-11-02', estimatedSalary: 510000, baseSalary: 510000,
    overtimeSalary: 0, bonus: 0, penaltyAmount: 0, deduction: 0, workedShifts: 4, assignedShifts: 20, hoursWorked: 20, lateMinutes: 0,
  });
  quarter.getMyQuarterBonus.mockResolvedValue({
    quarterStart: '2026-10-01', quarterEnd: '2026-12-31', windowStart: '2026-11-01', runStatus: 'Provisional', status: 'AtRisk', hours: 20,
    minHours: 80, maxMonthlyPoints: 7, monthlyPointsLimit: 10, policyAmount: 400000, expectedAmount: 400000, reasons: ['Tháng 11/2026 có 7 điểm trừ'],
  });
});

describe('StaffDashboardCards', () => {
  it('shows the simulated money only as display, not as a deduction', async () => {
    render(<StaffDashboardCards />);

    expect(await screen.findByText('Quy đổi điểm trừ (mô phỏng – không trừ)')).toBeTruthy();
    expect(screen.queryByText('Khấu trừ')).toBeNull();
  });

  it('shows the deduction points, the complaint button and the quarter status', async () => {
    render(<StaffDashboardCards />);

    expect(await screen.findByText('7 điểm')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Khiếu nại' })).toBeTruthy();
    expect(await screen.findByText('Rủi ro')).toBeTruthy();
    expect(await screen.findByText('Tháng 11/2026 có 7 điểm trừ')).toBeTruthy();
    expect(screen.getByText('114%')).toBeTruthy();
  });

  it('keeps the other cards when one card fails', async () => {
    quarter.getMyQuarterBonus.mockRejectedValue(new Error('x'));

    render(<StaffDashboardCards />);

    await waitFor(() => expect(screen.getByText('114%')).toBeTruthy());
    expect(await screen.findByText('x')).toBeTruthy();
  });

  it('hides the complaint button once the deadline passed', async () => {
    hr.getMyViolations.mockResolvedValue({
      ...violations,
      entries: [{ ...violations.entries[0], complaintDeadline: '2020-01-01' }],
    });

    render(<StaffDashboardCards />);

    await screen.findByText('Đi muộn trên 15 phút');
    expect(screen.queryByRole('button', { name: 'Khiếu nại' })).toBeNull();
  });
});
