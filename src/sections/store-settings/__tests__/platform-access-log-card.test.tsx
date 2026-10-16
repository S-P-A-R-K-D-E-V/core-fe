import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { PlatformAccessLog } from 'src/api/platform-features';

// ----------------------------------------------------------------------
// Nhật ký chấm công theo nền tảng: chủ cửa hàng thấy lượt bị chặn, lượt nghi sửa nền tảng (kèm lý do dễ hiểu), lọc chỉ
// lượt nghi sửa.
// ----------------------------------------------------------------------

vi.mock('src/components/label', () => ({ default: ({ children }: any) => <span>{children}</span> }));

const getPlatformAccessLogs = vi.fn();
vi.mock('src/api/platform-features', () => ({
  getPlatformAccessLogs: (...args: any[]) => getPlatformAccessLogs(...args),
}));

// Imported after the mocks above.
import PlatformAccessLogCard, { suspicionReason } from 'src/sections/store-settings/platform-access-log-card';

const log = (over: Partial<PlatformAccessLog>): PlatformAccessLog => ({
  id: Math.random().toString(36),
  createdAt: '2026-10-16T08:00:00Z',
  userId: 'u1',
  userName: 'Lan Nguyễn',
  featureKey: 'attendance.self-checkin',
  action: 'SmartCheckIn',
  platform: 'web',
  declaredPlatform: 'web',
  sessionPlatform: 'web',
  isBrowser: true,
  suspicious: false,
  blocked: false,
  statusCode: 200,
  userAgent: 'Mozilla/5.0',
  ipAddress: '1.2.3.4',
  ...over,
});

function renderCard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <PlatformAccessLogCard />
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('PlatformAccessLogCard', () => {
  it('hiện lượt bị chặn và lượt nghi sửa nền tảng', async () => {
    getPlatformAccessLogs.mockResolvedValue({
      total: 2,
      page: 1,
      pageSize: 20,
      data: [
        log({ declaredPlatform: 'app', suspicious: true, blocked: true, statusCode: 403 }),
        log({ action: 'SmartCheckOut', platform: 'app', isBrowser: false, declaredPlatform: 'app', sessionPlatform: 'app' }),
      ],
    });

    renderCard();

    expect(await screen.findByText('Bị chặn')).toBeInTheDocument();
    expect(screen.getByText('Nghi sửa nền tảng')).toBeInTheDocument();
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Ra ca')).toBeInTheDocument();
  });

  it('bật "chỉ hiện nghi sửa" thì tải lại với bộ lọc', async () => {
    getPlatformAccessLogs.mockResolvedValue({ total: 0, page: 1, pageSize: 20, data: [] });
    renderCard();
    await screen.findByText('Chưa có lượt nào');

    await userEvent.click(screen.getByLabelText('Chỉ hiện nghi sửa nền tảng'));

    await waitFor(() =>
      expect(getPlatformAccessLogs).toHaveBeenLastCalledWith(expect.objectContaining({ suspiciousOnly: true, page: 1 }))
    );
  });

  it('giải thích lý do nghi sửa bằng lời dễ hiểu', () => {
    expect(suspicionReason(log({ declaredPlatform: 'app' }))).toContain('trình duyệt');
    expect(suspicionReason(log({ declaredPlatform: 'web', sessionPlatform: 'app' }))).toContain('app bị dùng trên trình duyệt');
    expect(suspicionReason(log({ isBrowser: false, sessionPlatform: 'web', declaredPlatform: 'app' }))).toContain(
      'ngoài trình duyệt'
    );
  });
});
