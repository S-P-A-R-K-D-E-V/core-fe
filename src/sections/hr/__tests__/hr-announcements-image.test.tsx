import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import HrAnnouncementsView from '../view/hr-announcements-view';

// ----------------------------------------------------------------------
// Form thông báo: tải ảnh thẳng lên kho (không gửi file qua API lưu), đổi, gỡ, chưa đổi thì giữ nguyên.
// ----------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  staff: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  snackbar: vi.fn(),
}));

vi.mock('src/routes/hooks', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('src/routes/components', () => ({ RouterLink: ({ children }: any) => <a href="/x">{children}</a> }));
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.snackbar }) }));
vi.mock('src/components/iconify', () => ({ default: () => <span /> }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({ default: ({ action }: any) => <div>{action}</div> }));
vi.mock('src/hooks/use-confirm-dialog', () => ({ useConfirmDialog: () => [vi.fn(), null] }));
vi.mock('src/api/announcements', () => ({
  getAnnouncements: mocks.list,
  getAnnouncementStaff: mocks.staff,
  saveAnnouncement: mocks.save,
  uploadAnnouncementImage: mocks.upload,
  deleteAnnouncement: vi.fn(),
  getAnnouncementReceipts: vi.fn(),
  getAnnouncementImageUrl: vi.fn(),
  getPendingAnnouncements: vi.fn(),
  markAnnouncementSeen: vi.fn(),
  acknowledgeAnnouncement: vi.fn(),
}));

const theme = createTheme();

const existing = {
  id: 'a1',
  title: 'Lương thưởng',
  bodyMarkdown: 'Xem ảnh',
  severity: 'Info',
  audience: 'All',
  roles: [],
  userIds: [],
  requireAck: false,
  startAt: '2026-11-02T03:00:00Z',
  endAt: null,
  ctaLabel: null,
  ctaUrl: null,
  createdAt: '2026-11-02T03:00:00Z',
  createdByName: null,
  isActive: true,
  recipients: 3,
  seenCount: 0,
  ackCount: 0,
  imageKey: 'announcements/x/a.png',
  imageUrl: 'announcements/x/a.png?exp=1&sig=s',
};

const png = () => new File(['x'], 'luong.png', { type: 'image/png' });
const pick = (file: File) => fireEvent.change(screen.getByLabelText('Ảnh đính kèm'), { target: { files: [file] } });

async function openEdit() {
  render(
    <ThemeProvider theme={theme}>
      <HrAnnouncementsView />
    </ThemeProvider>
  );
  fireEvent.click(await screen.findByLabelText('Sửa'));
  return screen.findByRole('dialog');
}

async function openCreate() {
  render(
    <ThemeProvider theme={theme}>
      <HrAnnouncementsView />
    </ThemeProvider>
  );
  await waitFor(() => expect(mocks.list).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Tạo thông báo' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Tiêu đề'), { target: { value: 'Họp' } });
  fireEvent.change(within(dialog).getByLabelText('Nội dung'), { target: { value: 'Tối nay' } });
  return dialog;
}

const submit = (dialog: HTMLElement, name: string) => fireEvent.click(within(dialog).getByRole('button', { name }));

beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue([]);
  mocks.staff.mockReset().mockResolvedValue([]);
  mocks.save.mockReset().mockResolvedValue({ announcement: existing, recipients: 3, devices: 0, pushed: false });
  mocks.upload.mockReset().mockResolvedValue('announcements/y/b.png');
  mocks.snackbar.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:local');
  URL.revokeObjectURL = vi.fn();
});

describe('form thông báo: ảnh đính kèm', () => {
  it('tạo không ảnh: không tải gì, gửi imageKey null', async () => {
    const dialog = await openCreate();

    submit(dialog, 'Tạo thông báo');

    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][1].imageKey).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('tạo có ảnh: tải trước, xem trước được cả ở tab Xem trước, lưu kèm key', async () => {
    const dialog = await openCreate();

    pick(png());
    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    expect(within(dialog).getByAltText('Ảnh đã chọn').getAttribute('src')).toBe('blob:local');

    fireEvent.click(within(dialog).getByRole('tab', { name: 'Xem trước' }));
    expect(within(dialog).getByAltText('Ảnh đính kèm: Họp')).toBeTruthy();

    await waitFor(() => expect(within(dialog).queryByText('Đang tải ảnh lên...')).toBeNull());
    submit(dialog, 'Tạo thông báo');
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][1].imageKey).toBe('announcements/y/b.png');
  });

  it('đang tải ảnh thì chưa lưu được', async () => {
    mocks.upload.mockReturnValue(new Promise(() => {}));
    const dialog = await openCreate();

    pick(png());

    expect(await within(dialog).findByText('Đang tải ảnh lên...')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Tạo thông báo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sai định dạng: báo lỗi, không tải lên', async () => {
    await openCreate();

    pick(new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(mocks.snackbar).toHaveBeenCalledWith('Chỉ nhận ảnh JPEG, PNG hoặc WebP.', { variant: 'error' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('tải lỗi: báo lỗi, quay về không có ảnh', async () => {
    mocks.upload.mockRejectedValue(new Error('mất mạng'));
    const dialog = await openCreate();

    pick(png());

    await waitFor(() => expect(mocks.snackbar).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).queryByAltText('Ảnh đã chọn')).toBeNull());
    submit(dialog, 'Tạo thông báo');
    await waitFor(() => expect(mocks.save.mock.calls[0][1].imageKey).toBeNull());
  });

  it('sửa, không đụng ảnh: hiện ảnh cũ, gửi null để giữ nguyên', async () => {
    mocks.list.mockResolvedValue([existing]);
    const dialog = await openEdit();

    expect(within(dialog).getByAltText('Ảnh đã chọn').getAttribute('src')).toBe('/media/announcements/x/a.png?exp=1&sig=s');

    submit(dialog, 'Lưu');
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0]).toBe('a1');
    expect(mocks.save.mock.calls[0][1].imageKey).toBeNull();
  });

  it('sửa, gỡ ảnh: gửi chuỗi rỗng', async () => {
    mocks.list.mockResolvedValue([existing]);
    const dialog = await openEdit();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ ảnh' }));
    expect(within(dialog).queryByAltText('Ảnh đã chọn')).toBeNull();

    submit(dialog, 'Lưu');
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][1].imageKey).toBe('');
  });

  it('sửa, đổi ảnh: gửi key mới', async () => {
    mocks.list.mockResolvedValue([existing]);
    const dialog = await openEdit();

    pick(png());
    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).queryByText('Đang tải ảnh lên...')).toBeNull());

    submit(dialog, 'Lưu');
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][1].imageKey).toBe('announcements/y/b.png');
  });
});
