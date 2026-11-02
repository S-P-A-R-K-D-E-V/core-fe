import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { routeRuleFor } from 'src/auth/route-roles';
import { paths } from 'src/routes/paths';
import { endpoints } from 'src/utils/axios';

import type { IPendingAnnouncement } from 'src/types/announcement';

import AnnouncementBody from '../announcement-body';
import AnnouncementHost from '../announcement-host';
import AnnouncementDialog from '../announcement-dialog';
import { mergeQueue, shouldCheck, isInternalPath, CHECK_INTERVAL_MS } from '../utils';

// ----------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
  push: vi.fn(),
  user: { id: 'u1' } as { id: string } | null,
  getPending: vi.fn(),
  seen: vi.fn(),
  ack: vi.fn(),
  snackbar: vi.fn(),
}));

vi.mock('src/routes/hooks', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mocks.user }),
}));

vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mocks.snackbar }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('src/api/announcements', () => ({
  getPendingAnnouncements: mocks.getPending,
  markAnnouncementSeen: mocks.seen,
  acknowledgeAnnouncement: mocks.ack,
}));

const theme = createTheme();

const item = (over: Partial<IPendingAnnouncement> = {}): IPendingAnnouncement => ({
  id: 'a1',
  title: 'Họp tối nay',
  bodyMarkdown: '21 giờ tại quầy',
  severity: 'Info',
  requireAck: false,
  startAt: '2026-11-02T03:00:00Z',
  ctaLabel: null,
  ctaUrl: null,
  ...over,
});

const withTheme = (node: React.ReactNode) => <ThemeProvider theme={theme}>{node}</ThemeProvider>;

beforeEach(() => {
  mocks.pathname = '/dashboard';
  mocks.user = { id: 'u1' };
  mocks.push.mockReset();
  mocks.snackbar.mockReset();
  mocks.getPending.mockReset().mockResolvedValue([]);
  mocks.seen.mockReset().mockResolvedValue(undefined);
  mocks.ack.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('đường dẫn nội bộ', () => {
  it.each(['/dashboard/hr/policies', '/dashboard?tab=1#x', '/'])('nhận %s', (url) => {
    expect(isInternalPath(url)).toBe(true);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/%2F/evil.example',
    '/a/../..//evil.example',
    '/redirect?to=https://evil.example',
    'javascript:alert(1)',
    '',
    null,
  ])('chặn %s', (url) => {
    expect(isInternalPath(url)).toBe(false);
  });
});

describe('giãn cách và hàng đợi', () => {
  it('lần đầu hỏi ngay, sau đó chờ đủ giãn cách', () => {
    expect(shouldCheck(0, 1000)).toBe(true);
    expect(shouldCheck(1000, 1000 + CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheck(1000, 1000 + CHECK_INTERVAL_MS)).toBe(true);
  });

  it('thêm vào cuối, không trùng, không thêm lại cái đã xử lý', () => {
    const merged = mergeQueue([item({ id: 'a' })], [item({ id: 'b' }), item({ id: 'a' }), item({ id: 'c' })], new Set(['c']));
    expect(merged.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('nội dung Markdown', () => {
  it('không dựng HTML thô, không chạy script', () => {
    const { container } = render(
      withTheme(<AnnouncementBody body={'**đậm** <b id="raw">thô</b>\n\n<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>'} />)
    );
    expect(container.querySelector('strong')?.textContent).toBe('đậm');
    expect(container.querySelector('#raw')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
  });

  it('link ngoài và ảnh không bấm được, link nội bộ bấm được', () => {
    const { container } = render(
      withTheme(
        <AnnouncementBody
          body={
            '[ngoài](https://evil.example) [js](javascript:alert(1)) [hai gạch](//evil.example) https://tu-dong.example ![ảnh](https://evil.example/a.png) [nội quy](/dashboard/hr/policies)'
          }
        />
      )
    );
    const links = Array.from(container.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard/hr/policies']);
    expect(container.textContent).toContain('ngoài');
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('hộp thoại', () => {
  const dialog = (over: Partial<IPendingAnnouncement>, handlers: Record<string, () => void> = {}) =>
    render(
      withTheme(
        <AnnouncementDialog
          announcement={item(over)}
          remaining={0}
          busy={false}
          onDismiss={handlers.onDismiss ?? vi.fn()}
          onAcknowledge={handlers.onAcknowledge ?? vi.fn()}
          onCta={handlers.onCta ?? vi.fn()}
        />
      )
    );

  it('bắt buộc xác nhận: Esc, bấm ngoài không đóng, không có nút X', () => {
    const onDismiss = vi.fn();
    dialog({ requireAck: true }, { onDismiss });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!);

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Đóng')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đã hiểu' })).toBeTruthy();
  });

  it('không bắt buộc: Esc và nút X đóng được', () => {
    const onDismiss = vi.fn();
    dialog({}, { onDismiss });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Đóng'));

    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('nút hành động chỉ hiện với đường dẫn nội bộ', () => {
    const external = dialog({ ctaLabel: 'Bấm', ctaUrl: 'https://evil.example' });
    expect(screen.queryByRole('button', { name: 'Bấm' })).toBeNull();
    external.unmount();

    dialog({ ctaLabel: 'Xem nội quy', ctaUrl: '/dashboard/hr/policies' });
    expect(screen.getByRole('button', { name: 'Xem nội quy' })).toBeTruthy();
  });
});

describe('AnnouncementHost', () => {
  it('kiểm tra khi đăng nhập, chuyển trang trong giãn cách không gọi lại, render lại không gọi lại', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
    const view = render(withTheme(<AnnouncementHost />));
    await waitFor(() => expect(mocks.getPending).toHaveBeenCalledTimes(1));

    view.rerender(withTheme(<AnnouncementHost />));
    mocks.pathname = '/dashboard/hr/leave';
    view.rerender(withTheme(<AnnouncementHost />));
    expect(mocks.getPending).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + CHECK_INTERVAL_MS));
    mocks.pathname = '/dashboard/hr/policies';
    view.rerender(withTheme(<AnnouncementHost />));
    await waitFor(() => expect(mocks.getPending).toHaveBeenCalledTimes(2));
  });

  it('chưa đăng nhập thì không gọi API', () => {
    mocks.user = null;
    render(withTheme(<AnnouncementHost />));
    expect(mocks.getPending).not.toHaveBeenCalled();
  });

  it('hiện lần lượt, báo đã thấy một lần, Đã hiểu thì sang cái tiếp theo', async () => {
    mocks.getPending.mockResolvedValue([
      item({ id: 'a', title: 'Thứ nhất', requireAck: true }),
      item({ id: 'b', title: 'Thứ hai' }),
    ]);
    render(withTheme(<AnnouncementHost />));

    expect(await screen.findByText('Thứ nhất')).toBeTruthy();
    expect(screen.queryByText('Thứ hai')).toBeNull();
    expect(screen.getByText('Còn 1 thông báo nữa')).toBeTruthy();
    expect(mocks.seen).toHaveBeenCalledTimes(1);
    expect(mocks.seen).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByRole('button', { name: 'Đã hiểu' }));

    expect(await screen.findByText('Thứ hai')).toBeTruthy();
    expect(mocks.ack).toHaveBeenCalledWith('a');
    await waitFor(() => expect(mocks.seen).toHaveBeenCalledWith('b'));

    fireEvent.click(screen.getByLabelText('Đóng'));
    await waitFor(() => expect(screen.queryByText('Thứ hai')).toBeNull());
  });

  it('bắt buộc xác nhận mà lỗi mạng: vẫn còn trên màn hình, báo lỗi', async () => {
    mocks.getPending.mockResolvedValue([item({ requireAck: true })]);
    mocks.ack.mockRejectedValue({ message: 'Lỗi mạng', status: 500 });
    render(withTheme(<AnnouncementHost />));

    fireEvent.click(await screen.findByRole('button', { name: 'Đã hiểu' }));

    await waitFor(() => expect(mocks.snackbar).toHaveBeenCalled());
    expect(screen.getByText('Họp tối nay')).toBeTruthy();
  });

  it('thông báo đã bị xoá (404) không kẹt người dùng', async () => {
    mocks.getPending.mockResolvedValue([item({ requireAck: true })]);
    mocks.ack.mockRejectedValue({ status: 404 });
    render(withTheme(<AnnouncementHost />));

    fireEvent.click(await screen.findByRole('button', { name: 'Đã hiểu' }));

    await waitFor(() => expect(screen.queryByText('Họp tối nay')).toBeNull());
  });

  it('nút hành động: xác nhận rồi mở trang nội bộ', async () => {
    mocks.getPending.mockResolvedValue([item({ requireAck: true, ctaLabel: 'Xem', ctaUrl: '/dashboard/hr/policies' })]);
    render(withTheme(<AnnouncementHost />));

    const cta = await screen.findByRole('button', { name: 'Xem' });
    await act(async () => {
      fireEvent.click(cta);
    });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard/hr/policies'));
    expect(mocks.ack).toHaveBeenCalled();
  });

  it('lỗi tải danh sách không hiện gì, không báo lỗi', async () => {
    mocks.getPending.mockRejectedValue({ status: 403 });
    render(withTheme(<AnnouncementHost />));

    await waitFor(() => expect(mocks.getPending).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.snackbar).not.toHaveBeenCalled();
  });
});

describe('cấu hình trang', () => {
  it('trang quản trị theo quyền hr.announcement.manage', () => {
    expect(routeRuleFor(paths.dashboard.hr.announcements)?.permissions).toEqual(['hr.announcement.manage']);
  });

  it('endpoint nằm dưới /announcements', () => {
    expect(endpoints.announcements.pending).toBe('/announcements/pending');
    expect(endpoints.announcements.ack('x')).toBe('/announcements/x/ack');
  });
});
