import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPerformanceScore } from 'src/types/hr';

import { rankScores } from '../hr-common';
import HrOverviewView from '../view/hr-overview-view';

// ----------------------------------------------------------------------
// Tổng quan nhân sự: quản lý thấy xếp hạng theo điểm tháng; nhân viên chỉ thấy điểm của mình, không gọi bảng cả cửa hàng.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const auth = vi.hoisted(() => ({ user: { id: 'lan', role: 'Staff', permissions: [] as string[] } }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));

const rules = vi.hoisted(() => ({ value: { performanceEnabled: true } }));
vi.mock('src/api/hr-rules', () => ({ useActiveHrRules: () => rules.value }));

const api = vi.hoisted(() => ({
  getMyViolations: vi.fn(),
  getMyPerformance: vi.fn(),
  getPerformanceMonth: vi.fn(),
  getMyProvisionalPerformance: vi.fn(),
}));
vi.mock('src/api/hr', () => api);

const score = (over: Partial<IPerformanceScore>): IPerformanceScore =>
  ({
    id: 's',
    userId: 'u',
    fullName: 'Lan',
    month: '2026-11-01',
    shiftCount: 12,
    total: 70,
    isDefaultScore: false,
    rating: 'Complete',
    targetAchievementPct: 95,
    deductionPoints: 2,
    computedAt: '2026-11-20T02:00:00Z',
    ...over,
  }) as IPerformanceScore;

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <HrOverviewView />
    </ThemeProvider>
  );

afterEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'lan', role: 'Staff', permissions: [] };
  rules.value = { performanceEnabled: true };
});

describe('rankScores', () => {
  it('chỉ người đã xếp loại có hạng, bằng điểm cùng hạng; chưa xếp loại đứng sau, chưa có ca đứng cuối', () => {
    const rows = rankScores([
      score({ id: 'moi', total: 90, isDefaultScore: true }),
      score({ id: 'b', total: 80 }),
      score({ id: 'a', total: 85 }),
      score({ id: 'c', total: 80 }),
      score({ id: 'd', total: 60 }),
      score({ id: 'khongca', total: 100, shiftCount: 0, rating: 'NotRated' }),
      score({ id: 'itca', total: 101, shiftCount: 2, rating: 'NotRated' }),
    ]);

    expect(rows.map((r) => [r.score.id, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
      ['itca', null],
      ['moi', null],
      ['khongca', null],
    ]);
  });
});

describe('Tổng quan nhân sự', () => {
  it('nhân viên thấy điểm tạm tính + điểm trừ của mình, không tải bảng cả cửa hàng', async () => {
    api.getMyProvisionalPerformance.mockResolvedValue({
      month: '2026-11-01',
      computedAt: '2026-11-20T02:00:00Z',
      score: score({ total: 72.5 }),
    });
    api.getMyPerformance.mockResolvedValue([score({ month: '2026-10-01', total: 81, rating: 'Good' })]);
    api.getMyViolations.mockResolvedValue({ summary: { points: 3 } });

    renderView();

    expect(await screen.findByText('72,5')).toBeTruthy();
    expect(screen.getByText(/điểm tạm tính/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/81 điểm/)).toBeTruthy();
    expect(screen.queryByText('Xếp hạng nhân sự')).toBeNull();
    expect(api.getPerformanceMonth).not.toHaveBeenCalled();
  });

  it('quản lý thấy bảng xếp hạng có hạng; không có điểm riêng thì ẩn thẻ của tôi', async () => {
    auth.user = { id: 'admin', role: 'Admin', permissions: ['hr.performance.read'] };
    api.getMyProvisionalPerformance.mockResolvedValue({ month: '2026-11-01', computedAt: null, score: null });
    api.getMyPerformance.mockResolvedValue([]);
    api.getMyViolations.mockRejectedValue(new Error('x'));
    api.getPerformanceMonth.mockResolvedValue({
      month: '2026-11-01',
      computedAt: '2026-11-20T02:00:00Z',
      publishedAt: null,
      scores: [score({ id: 'a', fullName: 'Mai', total: 88 }), score({ id: 'b', fullName: 'Lan', total: 70 })],
    });

    renderView();

    expect(await screen.findByText('Mai')).toBeTruthy();
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('1');
    expect(rows[1].textContent).toContain('Mai');
    expect(rows[2].textContent).toContain('Lan');
    expect(screen.getByText(/Tạm tính tới hôm qua/)).toBeTruthy();
    await waitFor(() => expect(api.getMyProvisionalPerformance).toHaveBeenCalled());
    expect(screen.queryByText(/Điểm của tôi/)).toBeNull();
  });

  it('tháng này chưa có điểm thì mở tháng trước', async () => {
    auth.user = { id: 'admin', role: 'Admin', permissions: ['hr.performance.read'] };
    api.getMyProvisionalPerformance.mockResolvedValue({ month: '2026-11-01', computedAt: null, score: null });
    api.getMyPerformance.mockResolvedValue([]);
    api.getMyViolations.mockRejectedValue(new Error('x'));
    api.getPerformanceMonth
      .mockResolvedValueOnce({ month: '2026-11-01', computedAt: null, publishedAt: null, scores: [] })
      .mockResolvedValue({
        month: '2026-10-01',
        computedAt: '2026-11-01T02:00:00Z',
        publishedAt: null,
        scores: [score({ id: 'a', fullName: 'Mai', month: '2026-10-01' })],
      });

    renderView();

    expect(await screen.findByText('Mai')).toBeTruthy();
    expect(api.getPerformanceMonth).toHaveBeenCalledTimes(2);
  });

  it('cửa hàng tắt chấm điểm: báo và không gọi API', async () => {
    rules.value = { performanceEnabled: false };

    renderView();

    expect(await screen.findByText(/chưa bật chấm điểm/)).toBeTruthy();
    expect(api.getMyProvisionalPerformance).not.toHaveBeenCalled();
  });
});
