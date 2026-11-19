import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { SYSTEM_USER_ID } from 'src/utils/messenger-system';

import type { MessageCard, DirectMessage, InternalUser } from 'src/api/messenger';

// ----------------------------------------------------------------------
// Bong bóng tin nhắn (dùng chung cho trang Tin nhắn nội bộ và cửa sổ chat nhanh — compact):
//  - tin của người gửi hệ thống hiện tên "Trợ lý hệ thống" + avatar bot (icon, không phải chữ cái đầu), kể cả khi
//    danh bạ không có mục của nó;
//  - tin cảnh báo là chữ thuần nhiều dòng: giữ xuống dòng, dòng dài tự ngắt;
//  - tin của người thường không đổi.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({
  default: ({ icon }: any) => <span data-icon={icon} />,
}));

// Thẻ hành động (message-card) dùng snackbar + phiên đăng nhập — tin trong file này không có thẻ.
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
const authUser: { current: any } = { current: null };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: authUser.current }) }));
const routerPush = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push: routerPush }) }));
// Thẻ confirm (A2) gọi API nhóm quản trị; 409 thì tải lại tin.
const confirmApi = { confirm: vi.fn(), cancel: vi.fn() };
vi.mock('src/api/agent-center', async (orig) => ({
  ...(await orig<typeof import('src/api/agent-center')>()),
  confirmAdminGroupProposal: (id: string) => confirmApi.confirm(id),
  cancelAdminGroupProposal: (id: string) => confirmApi.cancel(id),
}));
vi.mock('src/api/messenger', async (orig) => ({
  ...(await orig<typeof import('src/api/messenger')>()),
  fetchMessages: vi.fn().mockResolvedValue([]),
}));

// Imported after the mock above so the component picks up the mocked module.
import MessageBubble from '../message-bubble';

const ALERT_TEXT = [
  'Chốt quầy lệch tiền',
  '',
  'Ngày 05/10: quầy thiếu 150.000đ so với sổ.',
  `Ghi chú dài không có khoảng trắng: ${'x'.repeat(300)}`,
].join('\n');

function message(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: 'm1',
    conversationId: 'sys-admin-alerts-store',
    senderId: SYSTEM_USER_ID,
    content: ALERT_TEXT,
    createdAt: '2026-10-05T14:30:00Z',
    ...overrides,
  };
}

const systemEntry: InternalUser = {
  id: SYSTEM_USER_ID,
  fullName: 'Trợ lý hệ thống',
  email: '',
  avatarUrl: null,
  online: false,
  isSystem: true,
};

const lan: InternalUser = {
  id: '11111111-1111-1111-1111-111111111111',
  fullName: 'Trần Thị Lan',
  email: 'lan@test.vn',
  avatarUrl: null,
  online: true,
  isSystem: false,
};

function renderBubble(props: Partial<React.ComponentProps<typeof MessageBubble>>) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MessageBubble message={message()} mine={false} showName {...props} />
    </ThemeProvider>
  );
}

describe('MessageBubble — người gửi hệ thống', () => {
  it.each([
    ['có mục isSystem trong danh bạ', systemEntry],
    ['danh bạ không có mục của nó (người không phải Admin, hoặc danh bạ chưa tải xong)', undefined],
  ])('%s → tên "Trợ lý hệ thống" + avatar bot, không hiện id trần', (_case, senderUser) => {
    const { container } = renderBubble({ senderUser });

    expect(screen.getByText('Trợ lý hệ thống')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(SYSTEM_USER_ID);

    const avatar = screen.getByRole('img', { name: 'Trợ lý hệ thống' });
    expect(avatar.querySelector('[data-icon="mdi:robot"]')).not.toBeNull();
    // Icon chứ không phải chữ cái đầu của tên ("T") hay của id ("0")
    expect(avatar).toHaveTextContent('');
  });

  it('cửa sổ chat nhanh (compact) cũng hiện như vậy', () => {
    renderBubble({ compact: true, senderUser: undefined });

    expect(screen.getByText('Trợ lý hệ thống')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Trợ lý hệ thống' })).toBeInTheDocument();
  });
});

describe('MessageBubble — tin nhiều dòng', () => {
  it.each([
    ['trang Tin nhắn nội bộ', false],
    ['cửa sổ chat nhanh', true],
  ])('%s: giữ nguyên xuống dòng và cho ngắt dòng dài trong bong bóng', (_case, compact) => {
    const { container } = renderBubble({ compact });

    const bubble = container.querySelector('.messenger-bubble') as HTMLElement;
    // Nội dung giữ nguyên từng ký tự xuống dòng (không gộp thành một dòng, không đổi thành HTML)
    expect(bubble.textContent).toBe(ALERT_TEXT);
    expect(bubble.querySelector('br')).toBeNull();
    expect(bubble).toHaveStyle({ whiteSpace: 'pre-wrap', wordBreak: 'break-word' });
  });
});

describe('MessageBubble — người thường không đổi', () => {
  it('hiện họ tên + chữ cái đầu, không có avatar bot', () => {
    renderBubble({
      message: message({ senderId: lan.id, content: 'Đã xem, mai kiểm tra lại quầy.' }),
      senderUser: lan,
    });

    expect(screen.getByText('Trần Thị Lan')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('Đã xem, mai kiểm tra lại quầy.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Trợ lý hệ thống' })).not.toBeInTheDocument();
  });

  it('người chưa có trong danh bạ vẫn hiện id như trước', () => {
    renderBubble({
      message: message({ senderId: 'abc-123', content: 'chào' }),
      senderUser: undefined,
    });

    expect(screen.getByText('abc-123')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Trợ lý hệ thống' })).not.toBeInTheDocument();
  });
});

describe('MessageBubble — thẻ hành động (nhóm "Quản trị – Đội agent")', () => {
  const card = {
    kind: 'approval',
    refId: 'a1',
    title: 'Marketing Threads xin duyệt: Tạo bài đăng mạng xã hội',
    lines: ['Kênh: Threads CiCi'],
    link: '/dashboard/agent/approvals?id=a1',
    status: 'open',
    statusText: null,
    expiresAt: '2999-01-01T00:00:00Z',
    actions: [
      { key: 'approve', label: 'Duyệt', style: 'primary' },
      { key: 'reject', label: 'Từ chối', style: 'danger' },
      { key: 'open', label: 'Mở phiếu', style: 'default' },
    ],
  } as const;

  it('thẻ thay bong bóng chữ; người có agent.approve thấy nút duyệt + xem trước', () => {
    authUser.current = { id: 'me', roles: ['Manager'], permissions: ['agent.approve'] };
    const { container } = renderBubble({
      message: message({ card: { ...card, lines: [...card.lines], actions: [...card.actions] } }),
    });

    expect(container.querySelector('.messenger-bubble')).toBeNull();
    expect(screen.getByText(card.title)).toBeInTheDocument();
    expect(screen.getByText('Kênh: Threads CiCi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeInTheDocument();
  });

  it('không có agent.approve → chỉ còn nút Mở phiếu', () => {
    authUser.current = { id: 'me', roles: ['Staff'], permissions: [] };
    renderBubble({
      message: message({ card: { ...card, lines: [...card.lines], actions: [...card.actions] } }),
    });

    expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem trước' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở phiếu' })).toBeInTheDocument();
  });

  it('thẻ done hiện statusText, ẩn nút quyết định', () => {
    authUser.current = { id: 'me', roles: ['Admin'] };
    renderBubble({
      message: message({
        card: {
          ...card,
          lines: [...card.lines],
          actions: [...card.actions],
          status: 'done',
          statusText: 'Đã duyệt bởi Xuân Bình · 10:42',
        },
      }),
    });

    expect(screen.getByText('Đã duyệt bởi Xuân Bình · 10:42')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument();
  });
});

describe('MessageBubble — thẻ confirm của CEO (A2)', () => {
  const confirmCard: MessageCard = {
    kind: 'confirm',
    refId: 'p1',
    title: 'CEO đề xuất: duyệt 2 phiếu Marketing',
    lines: [
      '1. Duyệt phiếu 702eb2ee — Tạo bài đăng',
      '2. Duyệt phiếu 9a1b2c3d — Hẹn giờ',
      'Lý do: đúng lịch',
    ],
    link: '/dashboard/agent/approvals',
    status: 'open',
    statusText: null,
    actions: [
      { key: 'confirm', label: 'Xác nhận', style: 'primary' },
      { key: 'cancel', label: 'Huỷ', style: 'default' },
      { key: 'open', label: 'Xem phiếu', style: 'default' },
    ],
    ops: [
      { type: 'approve_action', refId: 'a1', label: 'Duyệt phiếu 702eb2ee' },
      { type: 'approve_action', refId: 'a2', label: 'Duyệt phiếu 9a1b2c3d' },
    ],
  };
  const cardMessage = () =>
    message({
      id: 'm-confirm',
      conversationId: 'admin-group',
      card: { ...confirmCard },
    });

  beforeEach(() => {
    authUser.current = { id: 'me', roles: ['Manager'], permissions: ['agent.approve'] };
    enqueueSnackbar.mockClear();
    confirmApi.confirm.mockReset();
    confirmApi.cancel.mockReset();
    routerPush.mockClear();
  });

  it('Xác nhận → hỏi lại "Chạy 2 thao tác này?" rồi gọi API, snackbar theo statusText', async () => {
    confirmApi.confirm.mockResolvedValue({
      status: 'done',
      statusText: 'Đã xác nhận bởi Xuân Bình · 10:42 19/11 — 2/2 thao tác chạy',
      results: [
        { label: 'Duyệt phiếu 702eb2ee', ok: true, message: null },
        { label: 'Duyệt phiếu 9a1b2c3d', ok: true, message: null },
      ],
    });
    renderBubble({ message: cardMessage() });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(confirmApi.confirm).not.toHaveBeenCalled();
    expect(screen.getByText('Chạy 2 thao tác này?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận và chạy' }));
    expect(confirmApi.confirm).toHaveBeenCalledWith('p1');
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        'Đã xác nhận bởi Xuân Bình · 10:42 19/11 — 2/2 thao tác chạy',
        { variant: 'success' }
      )
    );
  });

  it('Huỷ → gọi thẳng API huỷ, không hỏi lại', async () => {
    confirmApi.cancel.mockResolvedValue({ status: 'done', statusText: 'Đã huỷ bởi Xuân Bình' });
    renderBubble({ message: cardMessage() });

    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(confirmApi.cancel).toHaveBeenCalledWith('p1');
    expect(confirmApi.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Đã huỷ bởi Xuân Bình', { variant: 'success' })
    );
  });

  it('409 → snackbar câu { message } của máy chủ', async () => {
    confirmApi.cancel.mockRejectedValue({ status: 409, message: 'Đề xuất đã được xử lý' });
    renderBubble({ message: cardMessage() });

    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Đề xuất đã được xử lý', { variant: 'warning' })
    );
  });

  it('Xem phiếu → điều hướng tới link; không có agent.approve → chỉ còn Xem phiếu', async () => {
    authUser.current = { id: 'me', roles: ['Staff'], permissions: [] };
    renderBubble({ message: cardMessage() });

    expect(screen.queryByRole('button', { name: 'Xác nhận' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Huỷ' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xem phiếu' }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard/agent/approvals');
  });
});
