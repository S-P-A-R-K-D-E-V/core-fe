import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { ITodayBoard, IStoreMonitor } from 'src/types/store-monitor';

// ----------------------------------------------------------------------
// Trang Giám sát cửa hàng: hiện đúng số khách vào / đang trong / hoá đơn / chuyển đổi từ API, bảng chi
// nhánh, nhân sự hôm nay và trạng thái agent camera; chưa có camera thì hiện hướng dẫn cài agent.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: ({ icon }: any) => <span data-icon={icon} /> }));
vi.mock('src/components/chart', () => ({
  default: ({ series }: any) => <div data-testid="chart">{JSON.stringify(series)}</div>,
  useChart: (o: any) => o,
}));
vi.mock('src/routes/components', async () => {
  const { forwardRef } = await import('react');
  return { RouterLink: forwardRef<HTMLAnchorElement, any>((props, ref) => <a ref={ref} {...props} />) };
});

const getStoreMonitor = vi.fn();
const getTodayBoard = vi.fn();
vi.mock('src/api/store-monitor', () => ({
  getStoreMonitor: (...args: any[]) => getStoreMonitor(...args),
  getTodayBoard: (...args: any[]) => getTodayBoard(...args),
}));

// Imported after the mocks above.
import { StoreMonitorView } from '../view/store-monitor-view';

const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, in: 0, out: 0, orders: 0 }));

function monitor(overrides: Partial<IStoreMonitor> = {}): IStoreMonitor {
  return {
    date: '2026-10-14',
    isToday: true,
    generatedAt: '2026-10-14T08:00:00Z',
    totals: { in: 42, out: 37, occupancy: 5, orders: 21, revenue: 4_250_000, conversionRate: 50 },
    branches: [
      {
        branchId: 'b1',
        branchName: 'CiCi Cầu Giấy',
        businessType: 'retail',
        in: 42,
        out: 37,
        occupancy: 5,
        orders: 21,
        revenue: 4_250_000,
        conversionRate: 50,
        hasCamera: true,
        lastEventAt: '2026-10-14T07:55:00Z',
      },
    ],
    hourly: hourly.map((h) => (h.hour === 9 ? { ...h, in: 12, out: 9, orders: 6 } : h)),
    devices: [
      {
        id: 'd1',
        name: 'Laptop quầy',
        branchId: 'b1',
        branchName: 'CiCi Cầu Giấy',
        kind: 'camera-agent',
        agentVersion: '0.1.0',
        lastSeenAt: '2026-10-14T07:59:00Z',
        online: true,
        cameras: [
          { key: 'door1', name: 'Cửa chính', online: true, fps: 4.8, lastFrameAt: null, inToday: 42, outToday: 37 },
        ],
      },
    ],
    ...overrides,
  };
}

const board: ITodayBoard = {
  date: '2026-10-14',
  counts: { working: 2, done: 0, notIn: 1, absent: 0, upcoming: 0, late: 1 },
  items: [
    {
      assignmentId: 'a1',
      staffId: 's1',
      staffName: 'Trần Thị Lan',
      avatarUrl: null,
      shiftName: 'Ca sáng',
      startTime: '08:00',
      endTime: '16:00',
      status: 'working',
      lateMinutes: 7,
      checkInTime: '2026-10-14T01:07:00Z',
      checkOutTime: null,
    },
  ],
};

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <StoreMonitorView />
    </ThemeProvider>
  );
}

describe('StoreMonitorView', () => {
  beforeEach(() => {
    getStoreMonitor.mockReset();
    getTodayBoard.mockReset();
  });

  it('shows footfall, orders, conversion, staff and camera status', async () => {
    getStoreMonitor.mockResolvedValue(monitor());
    getTodayBoard.mockResolvedValue(board);

    renderView();

    await waitFor(() => expect(screen.getAllByText('CiCi Cầu Giấy').length).toBeGreaterThan(0));
    const visitorsCard = screen.getByText('Khách vào').parentElement!;
    expect(within(visitorsCard).getByText('42')).toBeTruthy();
    expect(within(visitorsCard).getByText('37 lượt ra')).toBeTruthy();
    expect(within(screen.getByText('Đang trong cửa hàng').parentElement!).getByText('5')).toBeTruthy();
    expect(within(screen.getByText('Tỉ lệ chuyển đổi').parentElement!).getByText('50%')).toBeTruthy();
    expect(within(screen.getByText('Nhân viên đang làm').parentElement!).getByText('2')).toBeTruthy();
    expect(screen.getByText('Trần Thị Lan')).toBeTruthy();
    expect(screen.getByText('Muộn 7′')).toBeTruthy();
    expect(screen.getByText('Đang chạy')).toBeTruthy();
    expect(screen.getByText(/Cửa chính · 4\.8 fps/)).toBeTruthy();
    expect(screen.getByTestId('chart').textContent).toContain('"name":"Khách vào"');
    expect(screen.queryByText(/Chưa có camera đếm khách/)).toBeNull();
  });

  it('explains how to install the agent when no camera has reported yet', async () => {
    getStoreMonitor.mockResolvedValue(
      monitor({
        totals: { in: 0, out: 0, occupancy: 0, orders: 3, revenue: 300_000, conversionRate: null },
        branches: [{ ...monitor().branches[0], in: 0, out: 0, occupancy: 0, hasCamera: false, conversionRate: null }],
        devices: [],
      })
    );
    getTodayBoard.mockResolvedValue(board);

    renderView();

    await waitFor(() => expect(screen.getByText(/Chưa có camera đếm khách/)).toBeTruthy());
    expect(screen.getByText('Thiết bị cửa hàng').getAttribute('href')).toContain('/store-settings/devices');
    expect(within(screen.getByText('Tỉ lệ chuyển đổi').parentElement!).getByText('—')).toBeTruthy();
    expect(screen.getByText('Chưa lắp')).toBeTruthy();
  });
});
