import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Thiết bị đang đăng nhập (hợp đồng với core-be):
//  - GET /auth/sessions kèm header X-Session-Token (sessionToken của trình duyệt) để BE biết "thiết bị này";
//  - thiết bị đang xem không có nút đăng xuất ở đây; thiết bị khác: DELETE /auth/sessions/{id} sau khi xác nhận;
//  - "Đăng xuất các thiết bị khác": POST /auth/sessions/revoke-others, chỉ hiện khi biết thiết bị này là phiên nào;
//  - phiên vừa tự đóng (404 Auth.LoginSessionNotFound) không phải lỗi — chỉ tải lại danh sách.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Hộp xác nhận tối giản: mở thì hiện tiêu đề, nội dung và nút hành động.
vi.mock('src/components/custom-dialog', () => ({
  ConfirmDialog: ({ open, title, content, action }: any) =>
    open ? (
      <div role="dialog">
        <div>{title}</div>
        <div>{content}</div>
        {action}
      </div>
    ) : null,
}));

// Imported after the mocks above so the component picks up the mocked modules.
import AccountLoginSessions from 'src/sections/account/account-login-sessions';

const LAPTOP = {
  id: 'laptop',
  device: 'Chrome · Windows',
  ipAddress: '203.0.113.7',
  signedInAt: '2026-10-13T01:00:00Z',
  lastActiveAt: '2026-10-13T06:00:00Z',
  expiresAt: '2026-11-12T06:00:00Z',
  isCurrent: true,
  signedInWithQr: false,
};

const PHONE = {
  id: 'phone',
  device: 'App · Android',
  ipAddress: null,
  signedInAt: '2026-10-10T02:00:00Z',
  lastActiveAt: null,
  expiresAt: '2026-11-09T02:00:00Z',
  isCurrent: false,
  signedInWithQr: false,
};

const COUNTER_PC = {
  id: 'counter',
  device: null,
  ipAddress: '198.51.100.9',
  signedInAt: '2026-10-13T05:00:00Z',
  lastActiveAt: '2026-10-13T05:00:00Z',
  expiresAt: '2026-10-13T17:00:00Z',
  isCurrent: false,
  signedInWithQr: true,
};

function renderPage() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <AccountLoginSessions />
    </ThemeProvider>
  );
}

/** Nút "Đăng xuất" của từng dòng theo thứ tự hiển thị (không tính nút trong hộp xác nhận). */
function rowButtons() {
  return screen.getAllByRole('button', { name: 'Đăng xuất' });
}

function confirmInDialog() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Đăng xuất')!);
}

beforeEach(() => {
  localStorage.setItem('sessionToken', 'tok-laptop');
  http.get.mockResolvedValue({ data: [LAPTOP, PHONE, COUNTER_PC] });
  http.delete.mockResolvedValue({ data: null });
  http.post.mockResolvedValue({ data: { revoked: 2 } });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AccountLoginSessions', () => {
  it('liệt kê thiết bị, đánh dấu thiết bị này và phiên mã QR; gửi sessionToken qua header', async () => {
    renderPage();

    expect(await screen.findByText('Chrome · Windows')).toBeInTheDocument();
    expect(screen.getByText('App · Android')).toBeInTheDocument();
    expect(screen.getByText('Thiết bị không rõ')).toBeInTheDocument();
    expect(screen.getAllByText('Thiết bị này')).toHaveLength(1);
    expect(screen.getAllByText('Mã QR')).toHaveLength(1);
    expect(screen.getByText(/^Tự hết lúc /)).toBeInTheDocument();
    expect(screen.getByText(/IP 203\.0\.113\.7/)).toBeInTheDocument();

    expect(http.get).toHaveBeenCalledWith('/auth/sessions', { headers: { 'X-Session-Token': 'tok-laptop' } });
    // Thiết bị đang xem không có nút đăng xuất: chỉ 2 thiết bị kia.
    expect(rowButtons()).toHaveLength(2);
  });

  it('đăng xuất một thiết bị: hỏi xác nhận rồi mới gọi DELETE đúng phiên, sau đó tải lại', async () => {
    renderPage();
    await screen.findByText('App · Android');

    fireEvent.click(rowButtons()[0]);
    expect(http.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('App · Android sẽ bị đăng xuất ngay');

    http.get.mockResolvedValue({ data: [LAPTOP, COUNTER_PC] });
    confirmInDialog();

    await waitFor(() => expect(http.delete).toHaveBeenCalledWith('/auth/sessions/phone'));
    expect(await screen.findByText('Đã đăng xuất App · Android.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('App · Android')).not.toBeInTheDocument());
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('đăng xuất các thiết bị khác: xác nhận kèm số thiết bị, gọi revoke-others kèm header', async () => {
    renderPage();
    await screen.findByText('App · Android');

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất các thiết bị khác' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('2 thiết bị khác sẽ bị đăng xuất ngay');
    expect(http.post).not.toHaveBeenCalled();

    http.get.mockResolvedValue({ data: [LAPTOP] });
    confirmInDialog();

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/auth/sessions/revoke-others', undefined, {
        headers: { 'X-Session-Token': 'tok-laptop' },
      })
    );
    expect(await screen.findByText('Đã đăng xuất 2 thiết bị khác.')).toBeInTheDocument();
    // Chỉ còn thiết bị này: không còn nút nào.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Đăng xuất các thiết bị khác' })).not.toBeInTheDocument();
  });

  it('không biết thiết bị này là phiên nào → không đưa nút "các thiết bị khác" (sẽ tự đăng xuất chính mình)', async () => {
    localStorage.clear();
    http.get.mockResolvedValue({ data: [{ ...LAPTOP, isCurrent: false }, PHONE] });

    renderPage();
    await screen.findByText('App · Android');

    expect(http.get).toHaveBeenCalledWith('/auth/sessions', undefined);
    expect(screen.queryByRole('button', { name: 'Đăng xuất các thiết bị khác' })).not.toBeInTheDocument();
    expect(screen.queryByText('Thiết bị này')).not.toBeInTheDocument();
    expect(rowButtons()).toHaveLength(2);
  });

  it('thiết bị vừa tự đăng xuất (404) → không báo lỗi, chỉ tải lại danh sách', async () => {
    http.delete.mockRejectedValue({ status: 404, title: 'Không tìm thấy phiên', errorCodes: ['Auth.LoginSessionNotFound'] });
    renderPage();
    await screen.findByText('App · Android');

    fireEvent.click(rowButtons()[0]);
    http.get.mockResolvedValue({ data: [LAPTOP, COUNTER_PC] });
    confirmInDialog();

    await waitFor(() => expect(screen.queryByText('App · Android')).not.toBeInTheDocument());
    expect(screen.queryByText('Không tìm thấy phiên')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Đã đăng xuất/)).not.toBeInTheDocument();
  });

  it('lỗi khác khi đăng xuất → hiện thông điệp của BE, thiết bị vẫn trong danh sách', async () => {
    http.delete.mockRejectedValue({ status: 500, title: 'Máy chủ đang bận.' });
    renderPage();
    await screen.findByText('App · Android');

    fireEvent.click(rowButtons()[0]);
    confirmInDialog();

    expect(await screen.findByText('Máy chủ đang bận.')).toBeInTheDocument();
    expect(screen.getByText('App · Android')).toBeInTheDocument();
  });

  it('không tải được danh sách → báo lỗi', async () => {
    http.get.mockRejectedValue('Something went wrong');

    renderPage();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
  });
});
