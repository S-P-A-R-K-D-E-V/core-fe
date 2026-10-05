import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { SYSTEM_USER_ID } from 'src/utils/messenger-system';

import { useMessengerStore } from 'src/store/messenger-store';

// ----------------------------------------------------------------------
// Trang "Tin nhắn nội bộ" với kênh "Cảnh báo hệ thống" (hội thoại có systemKey): avatar chuông ở danh sách và
// ở đầu khung chat, tin của "Trợ lý hệ thống" có tên + avatar bot, nhiều dòng; hội thoại thường không đổi.
// Người xem ở đây KHÔNG có mục người gửi hệ thống trong danh bạ (trường hợp người không phải Admin).
// ----------------------------------------------------------------------

const ME = '11111111-1111-1111-1111-111111111111';
const HUNG = '22222222-2222-2222-2222-222222222222';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { id: ME, role: 'Manager', roles: ['Manager'] } }),
}));

vi.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

vi.mock('src/components/iconify', () => ({
  default: ({ icon }: any) => <span data-icon={icon} />,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

const openConversation = vi.fn().mockResolvedValue(undefined);
vi.mock('src/components/messenger/messenger-provider', () => ({
  useMessengerCtx: () => ({ connection: null, openConversation, sendTyping: vi.fn() }),
}));

vi.mock('src/api/messenger', () => ({
  sendMessage: vi.fn(),
  sendAttachment: vi.fn(),
}));

vi.mock('src/sections/messenger/new-conversation-dialog', () => ({
  default: () => null,
}));

// Imported after the mocks above so the view picks up the mocked modules.
import MessengerView from '../messenger-view';

const ALERT_TEXT =
  'Chốt quầy lệch tiền\n\nNgày 05/10: quầy thiếu 150.000đ so với sổ.\nKhoảng phát sinh: 14:00–15:30.';

beforeEach(() => {
  useMessengerStore.setState({
    userCache: {
      [ME]: {
        id: ME,
        fullName: 'Trần Thị Lan',
        email: 'lan@test.vn',
        avatarUrl: null,
        online: true,
        isSystem: false,
      },
      [HUNG]: {
        id: HUNG,
        fullName: 'Nguyễn Văn Hùng',
        email: 'hung@test.vn',
        avatarUrl: null,
        online: false,
        isSystem: false,
      },
    },
    onlineIds: [],
    conversations: [
      {
        id: 'sys-admin-alerts-store',
        type: 'Group',
        name: 'Cảnh báo hệ thống',
        participantIds: [SYSTEM_USER_ID, HUNG, ME],
        lastMessagePreview: ALERT_TEXT,
        lastMessageSenderId: SYSTEM_USER_ID,
        lastMessageAt: '2026-10-05T14:30:00Z',
        unreadCount: 1,
        systemKey: 'admin-alerts',
      },
      {
        id: 'g1',
        type: 'Group',
        name: 'Ca sáng',
        participantIds: [ME, HUNG],
        lastMessagePreview: 'chào cả nhà',
        lastMessageSenderId: HUNG,
        lastMessageAt: '2026-10-05T10:00:00Z',
        unreadCount: 0,
        systemKey: null,
      },
    ],
    messagesByConv: {
      'sys-admin-alerts-store': [
        {
          id: 'm1',
          conversationId: 'sys-admin-alerts-store',
          senderId: SYSTEM_USER_ID,
          content: ALERT_TEXT,
          createdAt: '2026-10-05T14:30:00Z',
        },
        {
          id: 'm2',
          conversationId: 'sys-admin-alerts-store',
          senderId: HUNG,
          content: 'Đã xem, mai kiểm tra lại quầy.',
          createdAt: '2026-10-05T14:35:00Z',
        },
      ],
      g1: [
        {
          id: 'm3',
          conversationId: 'g1',
          senderId: HUNG,
          content: 'chào cả nhà',
          createdAt: '2026-10-05T10:00:00Z',
        },
      ],
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  useMessengerStore.setState({
    userCache: {},
    onlineIds: [],
    conversations: [],
    messagesByConv: {},
  });
});

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MessengerView />
    </ThemeProvider>
  );
}

const CHANNEL_AVATAR = { name: 'Kênh cảnh báo hệ thống' };

describe('MessengerView — kênh "Cảnh báo hệ thống"', () => {
  it('danh sách hội thoại: kênh cảnh báo có avatar chuông, nhóm thường giữ chữ cái đầu', () => {
    renderView();

    const [alerts, group] = screen
      .getAllByRole('button')
      .filter((b) => b.classList.contains('MuiListItemButton-root'));

    expect(within(alerts).getByText('Cảnh báo hệ thống')).toBeInTheDocument();
    const bell = within(alerts).getByRole('img', CHANNEL_AVATAR);
    expect(bell.querySelector('[data-icon="solar:bell-bold"]')).not.toBeNull();
    expect(bell).toHaveTextContent('');

    expect(within(group).getByText('Ca sáng')).toBeInTheDocument();
    expect(within(group).getByText('C')).toBeInTheDocument();
    expect(within(group).queryByRole('img', CHANNEL_AVATAR)).not.toBeInTheDocument();
  });

  it('mở kênh: đầu khung chat có avatar chuông + số người nhận (không tính Trợ lý hệ thống); tin của hệ thống có tên + avatar bot, giữ xuống dòng', async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    await user.click(screen.getByText('Cảnh báo hệ thống'));

    expect(openConversation).toHaveBeenCalledWith('sys-admin-alerts-store');
    // 1 ở danh sách + 1 ở đầu khung chat
    expect(screen.getAllByRole('img', CHANNEL_AVATAR)).toHaveLength(2);
    expect(screen.getByText('Cảnh báo tự động · 2 người nhận')).toBeInTheDocument();
    expect(screen.queryByText('3 thành viên')).not.toBeInTheDocument();

    // Danh bạ không có mục người gửi hệ thống → vẫn ra tên + avatar bot, không có id trần
    expect(screen.getByText('Trợ lý hệ thống')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Trợ lý hệ thống' }).querySelector('[data-icon="mdi:robot"]')
    ).not.toBeNull();
    expect(container).not.toHaveTextContent(SYSTEM_USER_ID);

    const bubbles = Array.from(container.querySelectorAll('.messenger-bubble'));
    expect(bubbles.map((b) => b.textContent)).toEqual([
      ALERT_TEXT,
      'Đã xem, mai kiểm tra lại quầy.',
    ]);
    expect(bubbles[0]).toHaveStyle({ whiteSpace: 'pre-wrap', wordBreak: 'break-word' });

    // Admin / người trong kênh vẫn trả lời được trong kênh
    expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toBeEnabled();
    // Tin của người thường trong kênh vẫn như cũ
    expect(screen.getByText('Nguyễn Văn Hùng')).toBeInTheDocument();
  });

  it('nhóm thường không đổi: "N thành viên", không có avatar chuông ở đầu khung chat', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByText('Ca sáng'));

    expect(screen.getByText('2 thành viên')).toBeInTheDocument();
    // Chỉ còn avatar chuông của kênh cảnh báo ở danh sách
    expect(screen.getAllByRole('img', CHANNEL_AVATAR)).toHaveLength(1);
    expect(screen.queryByText(/người nhận/)).not.toBeInTheDocument();
  });
});
