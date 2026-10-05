import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Bấm một thông báo có actionUrl kèm query string (vd thông báo kiểm tra chênh lệch quầy của core-be:
// /dashboard/shift-cash?date=…&investigate=1) phải điều hướng tới ĐÚNG đường dẫn đó, giữ nguyên query —
// router của Next (trailingSlash) tự thêm "/" trước dấu "?" mà không làm mất tham số.
// ----------------------------------------------------------------------

const push = vi.fn();
vi.mock('src/routes/hooks', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('src/hooks/use-sync-notification', async () => {
  const { createContext } = await import('react');
  return { SyncNotificationContext: createContext<any>({}) };
});

vi.mock('src/components/animate', () => ({
  varHover: () => ({}),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

// Imported after the mocks above so the popover picks up the mocked modules.
import { SyncNotificationContext } from 'src/hooks/use-sync-notification';

import NotificationsPopover from '../index';

const ACTION_URL = '/dashboard/shift-cash?date=2026-10-05&investigate=1';

afterEach(() => {
  vi.clearAllMocks();
});

describe('NotificationsPopover', () => {
  it('bấm thông báo → đánh dấu đã đọc và mở đúng actionUrl, giữ nguyên query string', async () => {
    const user = userEvent.setup();
    const markAsRead = vi.fn();
    const context: any = {
      notifications: [],
      totalUnRead: 1,
      markAllAsRead: vi.fn(),
      removeNotification: vi.fn(),
      dbNotifications: [
        {
          id: 'n1',
          title: 'Kiểm tra chênh lệch quầy 05/10',
          message: 'Quầy thiếu 150.000đ',
          category: 'System',
          actionUrl: ACTION_URL,
          isRead: false,
          createdAt: '2026-10-05T14:30:00Z',
        },
      ],
      dbUnreadCount: 1,
      markAsRead,
      markDbAllAsRead: vi.fn(),
      deleteDbNotification: vi.fn(),
      loadNotifications: vi.fn(),
    };

    render(
      <ThemeProvider theme={createTheme()}>
        <SyncNotificationContext.Provider value={context}>
          <NotificationsPopover />
        </SyncNotificationContext.Provider>
      </ThemeProvider>
    );

    await user.click(screen.getAllByRole('button')[0]);
    await user.click(await screen.findByText('Kiểm tra chênh lệch quầy 05/10'));

    expect(markAsRead).toHaveBeenCalledWith('n1');
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(ACTION_URL);
  });
});
