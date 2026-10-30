import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IAiBonusRun } from 'src/api/ai-bonus';

import AiBonusTab, { periodRange } from '../ai-bonus-tab';

// ----------------------------------------------------------------------
// Agent AI tính thưởng: chạy theo mô tả → bản nháp kèm công thức; sửa số, bỏ người rồi áp vào kỳ lương.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('src/api/payrollCycle', () => ({
  getAllPayrollCycles: vi.fn().mockResolvedValue([
    { id: 'c1', name: 'Tháng 11 kỳ 2', isLocked: false },
    { id: 'c0', name: 'Tháng 10', isLocked: true },
  ]),
}));

const api = vi.hoisted(() => ({
  getAiBonusRuns: vi.fn(),
  applyAiBonusRun: vi.fn(),
  streamAiBonusRun: vi.fn(),
  discardAiBonusRun: vi.fn(),
}));
vi.mock('src/api/ai-bonus', () => ({
  AiBonusError: class extends Error {},
  ...Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)])),
}));

const run: IAiBonusRun = {
  id: 'r1',
  title: 'Thưởng ca Tối',
  prompt: 'Ca Tối vượt target thưởng 2% phần vượt',
  periodKind: 'Week',
  from: '2026-11-02',
  to: '2026-11-08',
  status: 'Draft',
  summary: 'Tính theo doanh thu ca Tối.',
  lines: [
    { userId: 'lan', fullName: 'Lan', amount: 120000, formula: '0.02 * 6000000', explanation: 'Ca Tối 03/11 vượt target' },
    { userId: 'mai', fullName: 'Mai', amount: 50000, formula: '50000', explanation: 'Trưởng ca' },
  ],
  total: 170000,
  createdAt: '2026-11-09T03:00:00Z',
};

const renderTab = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <AiBonusTab />
    </ThemeProvider>
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe('Agent AI tính thưởng', () => {
  it('periodRange: tuần là thứ Hai → Chủ nhật, tháng là cả tháng', () => {
    expect(periodRange('Week', '2026-11-05', '')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('Month', '2026-11-17', '')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('Day', '2026-11-17', '')).toEqual({ from: '2026-11-17', to: '2026-11-17' });
  });

  it('chạy → bản nháp có công thức; bỏ một người, sửa số rồi áp vào kỳ chưa khoá', async () => {
    api.getAiBonusRuns.mockResolvedValue([]);
    api.streamAiBonusRun.mockImplementation(async (_body: unknown, onStep: (t: string) => void) => {
      onStep('Đang đọc doanh thu…');
      return { run, dropped: ['S9: không phải mã nhân viên trong kỳ.'], staffCount: 2 };
    });
    api.applyAiBonusRun.mockResolvedValue({ ...run, status: 'Applied', appliedTotal: 100000 });
    renderTab();

    await userEvent.type(screen.getByLabelText('Cách tính thưởng'), 'Ca Tối vượt target thưởng 2%');
    await userEvent.click(screen.getByRole('button', { name: 'Chạy Agent tính thưởng' }));

    expect(await screen.findByText('Tính theo doanh thu ca Tối.')).toBeInTheDocument();
    expect(screen.getByText('0.02 * 6000000')).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống bỏ 1 khoản/)).toBeInTheDocument();
    expect(api.streamAiBonusRun.mock.calls[0][0]).toMatchObject({ periodKind: 'Week', staffIds: null });

    // Bỏ Mai, sửa Lan còn 100.000.
    await userEvent.click(screen.getAllByRole('checkbox')[1]);
    const lanAmount = screen.getByDisplayValue('120000');
    await userEvent.clear(lanAmount);
    await userEvent.type(lanAmount, '100000');

    await userEvent.click(screen.getByLabelText('Áp vào kỳ lương'));
    expect(screen.queryByText('Tháng 10')).not.toBeInTheDocument(); // kỳ đã khoá không hiện
    await userEvent.click(await screen.findByText('Tháng 11 kỳ 2'));
    await userEvent.click(screen.getByRole('button', { name: /Áp dụng 1 khoản/ }));

    await waitFor(() => expect(api.applyAiBonusRun).toHaveBeenCalledWith('r1', 'c1', [{ userId: 'lan', amount: 100000 }]));
  });
});
