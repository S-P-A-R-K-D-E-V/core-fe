import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Smoke test của khung chat (hook thật, REST + SignalR giả):
//   - mở khung → thấy thẻ câu hỏi nhanh đúng đối tượng của PHIÊN server trả về;
//   - gõ "/" hiện danh sách lệnh, "/moi" tạo phiên mới thật (newSession: true);
//   - nút Mở rộng / Thu nhỏ đổi trạng thái và được nhớ;
//   - lệnh câu hỏi gửi đi câu đã đổi; nút thao tác phải qua hộp xác nhận; nút mở màn đi đúng trang;
//   - trả lời lỗi → "Sửa và gửi lại" đưa câu hỏi về ô nhập, không tự gửi.
// ----------------------------------------------------------------------

type MockUser = Record<string, any> | null;

const ADMIN_USER: MockUser = {
  id: 'u1',
  role: 'Admin',
  roles: ['Admin'],
  firstName: 'Bình',
  lastName: 'Vũ',
  phoneNumber: '0900000001',
  enabledFeatures: ['payroll.core', 'workforce.attendance', 'workforce.shift-scheduling'],
};

let mockUser: MockUser = ADMIN_USER;
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser, loading: false }),
}));

vi.mock('src/components/branding', () => ({
  useStoreBrand: () => ({ brandName: 'CiCi', isCiCi: true }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

const routerPush = vi.fn();
vi.mock('src/routes/hooks', () => ({
  useRouter: () => ({ push: routerPush }),
}));

const api = vi.hoisted(() => ({
  startChatbotSession: vi.fn(),
  getChatbotMessages: vi.fn(),
  sendChatbotMessage: vi.fn(),
  chatbotCallbackOrder: vi.fn(),
}));

vi.mock('src/api/chatbot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/api/chatbot')>()),
  startChatbotSession: api.startChatbotSession,
  getChatbotMessages: api.getChatbotMessages,
  sendChatbotMessage: api.sendChatbotMessage,
  chatbotCallbackOrder: api.chatbotCallbackOrder,
}));

const hub = vi.hoisted(() => {
  const state = { connections: [] as any[] };

  class FakeConnection {
    handlers = new Map<string, (payload: any) => void>();

    state = 'Disconnected';

    on(event: string, handler: (payload: any) => void) {
      this.handlers.set(event, handler);
    }

    onreconnecting() {}

    onreconnected() {}

    onclose() {}

    async start() {
      this.state = 'Connected';
    }

    async stop() {
      this.state = 'Disconnected';
    }

    async invoke(method: string) {
      return method === 'JoinSession' ? true : undefined;
    }

    emit(event: string, payload: any) {
      this.handlers.get(event)?.(payload);
    }
  }

  return { state, FakeConnection };
});

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() {
      return this;
    }

    withAutomaticReconnect() {
      return this;
    }

    configureLogging() {
      return this;
    }

    build() {
      const connection = new hub.FakeConnection();
      hub.state.connections.push(connection);
      return connection;
    }
  }

  return {
    HubConnectionBuilder,
    LogLevel: { Warning: 3 },
    HubConnectionState: {
      Disconnected: 'Disconnected',
      Connecting: 'Connecting',
      Connected: 'Connected',
      Disconnecting: 'Disconnecting',
      Reconnecting: 'Reconnecting',
    },
  };
});

// Imported after the mocks above so the widget picks up the mocked modules.
import ChatbotWidget, { OPEN_CHATBOT_EVENT } from 'src/components/chatbot/chatbot-widget';

// ----------------------------------------------------------------------

const adminSession = (sessionId = 's-admin') => ({
  sessionId,
  ownerType: 'User',
  agent: 'InternalAdmin',
  tier: 'cici_admin',
  displayName: 'Bình Vũ',
  createdAt: '2026-10-05T00:00:00Z',
});

const lastConnection = () => hub.state.connections[hub.state.connections.length - 1];

function renderWidget() {
  // A fresh theme per render avoids MUI/emotion's shared default-theme singleton getting frozen.
  return render(
    <ThemeProvider theme={createTheme()}>
      <ChatbotWidget />
    </ThemeProvider>
  );
}

/** Mở khung và chờ tới khi sẵn sàng (đã có phiên + đã vào nhóm SignalR). */
async function openWidget(user: ReturnType<typeof userEvent.setup>) {
  renderWidget();
  await user.click(screen.getByRole('button', { name: 'Mở trợ lý' }));
  const panel = await screen.findByRole('dialog');
  await within(panel).findByText('Sẵn sàng');
  return panel;
}

const composer = () => screen.getByRole('textbox', { name: 'Nhập tin nhắn' });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  hub.state.connections = [];
  mockUser = ADMIN_USER;
  api.startChatbotSession.mockResolvedValue(adminSession());
  api.getChatbotMessages.mockResolvedValue([]);
  api.sendChatbotMessage.mockResolvedValue({
    messageId: 'm1',
    assistantMessageId: 'a1',
    fromCache: false,
    cachedAnswer: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ----------------------------------------------------------------------

describe('ChatbotWidget', () => {
  it('mở khung: header + thẻ câu hỏi nhanh theo phiên quản trị', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    expect(within(panel).getByRole('heading', { name: 'Trợ lý quản trị' })).toBeInTheDocument();
    expect(within(panel).getByText('Xin chào Bình Vũ!')).toBeInTheDocument();

    [
      'Doanh thu hôm nay',
      'Ai đang trong ca',
      'Kiểm quầy',
      'Bán chạy tuần này',
      'Đi trễ tháng này',
      'Kỳ lương',
      'Đăng ký ca tuần tới',
    ].forEach((label) => {
      expect(within(panel).getByRole('button', { name: label })).toBeInTheDocument();
    });

    // Header có đủ 3 nút, đều có nhãn.
    expect(within(panel).getByRole('button', { name: 'Trò chuyện mới' })).toBeEnabled();
    expect(within(panel).getByRole('button', { name: 'Mở rộng' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    expect(composer()).toHaveAttribute('placeholder', 'Nhập tin nhắn… gõ / để xem lệnh');
  });

  it('đối tượng lấy theo PHIÊN của server, không theo vai trò đăng nhập', async () => {
    api.startChatbotSession.mockResolvedValue({
      ...adminSession('s-staff'),
      agent: 'Staff',
      tier: 'cici_staff',
    });
    const user = userEvent.setup();
    const panel = await openWidget(user);

    expect(within(panel).getByRole('heading', { name: 'Trợ lý nhân viên' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Lịch làm của tôi' })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Doanh thu hôm nay' })).toBeNull();
  });

  it('bấm thẻ câu hỏi nhanh gửi đúng câu hỏi; trả lời xong hiện gợi ý tiếp theo ở hàng chip', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.click(within(panel).getByRole('button', { name: 'Ai đang trong ca' }));

    await waitFor(() =>
      expect(api.sendChatbotMessage).toHaveBeenCalledWith({
        sessionId: 's-admin',
        content: 'Hôm nay những ai làm ca nào?',
        phone: '0900000001',
      })
    );
    expect(await within(panel).findByText('Hôm nay những ai làm ca nào?')).toBeInTheDocument();
    // Một chỉ báo "đang trả lời" duy nhất, nằm trong bong bóng đang chờ.
    await waitFor(() => expect(within(panel).getAllByRole('status')).toHaveLength(2)); // header + bong bóng
    expect(within(panel).getAllByRole('status')[0]).toHaveTextContent('Đang trả lời…');
    expect(within(panel).getAllByRole('status')[1]).toHaveTextContent('Đang trả lời…');

    act(() => {
      lastConnection().emit('step', {
        sessionId: 's-admin',
        messageId: 'a1',
        step: {
          id: 's1',
          kind: 'tool',
          name: 'shift_assignments_read',
          label: 'shift_assignments_read',
          state: 'running',
        },
      });
    });
    // Không lộ tên tool nội bộ.
    expect(await within(panel).findByText('Đang tra cứu ca làm…')).toBeInTheDocument();
    expect(within(panel).queryByText(/shift_assignments_read/)).toBeNull();

    act(() => {
      lastConnection().emit('completed', {
        sessionId: 's-admin',
        messageId: 'a1',
        content: 'Hôm nay có **Lan** (ca sáng) và **Minh** (ca chiều).',
        fromCache: false,
        steps: [
          { id: 's1', kind: 'tool', name: 'shift_assignments_read', label: 'x', state: 'done' },
        ],
        blocks: [
          {
            type: 'suggestions',
            items: [{ label: 'Ngày mai thì sao?', prompt: 'Ngày mai thì sao?' }],
          },
        ],
      });
    });

    expect(await within(panel).findByText('Lan')).toBeInTheDocument();
    expect(within(panel).getByText('Đã tra cứu ca làm')).toBeInTheDocument();
    const followUps = within(panel).getByRole('group', { name: 'Gợi ý câu hỏi tiếp theo' });
    expect(within(followUps).getByText('Ngày mai thì sao?')).toBeInTheDocument();
    expect(within(panel).getByText('Sẵn sàng')).toBeInTheDocument();
  });

  it('gõ "/" hiện danh sách lệnh; lọc theo chữ gõ; "/moi" tạo phiên mới thật', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.type(composer(), '/');
    const list = await within(panel).findByRole('listbox', { name: 'Danh sách lệnh' });
    expect(within(list).getAllByRole('option')).toHaveLength(14);
    expect(composer()).toHaveAttribute('aria-activedescendant');

    await user.type(composer(), 'moi');
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Trò chuyện mới');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    api.startChatbotSession.mockResolvedValueOnce(adminSession('s-new'));
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(api.startChatbotSession).toHaveBeenLastCalledWith({
        sessionId: null,
        phone: '0900000001',
        displayName: 'Bình Vũ',
        newSession: true,
      })
    );
    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('Đã bắt đầu trò chuyện mới'));
    expect(composer()).toHaveValue('');
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();
    expect(within(panel).queryByRole('listbox')).toBeNull();
  });

  it('danh sách lệnh: ↑/↓ chọn, Tab lấy lệnh, Esc đóng; nút "/" mở danh sách đầy đủ', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.type(composer(), '/');
    const list = await within(panel).findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    expect(within(list).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    // Vòng lên mục cuối cùng (/trogiup).
    expect(within(list).getAllByRole('option')[13]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Escape}');
    expect(within(panel).queryByRole('listbox')).toBeNull();
    expect(composer()).toHaveValue('/');

    // Lệnh câu hỏi: Tab điền "/tên " và hiện gợi ý tham số + câu sẽ gửi — chưa gửi gì.
    await user.clear(composer());
    await user.type(composer(), '/doanh');
    await user.keyboard('{Tab}');
    expect(composer()).toHaveValue('/doanhthu ');
    expect(within(panel).getByText('/doanhthu [khoảng thời gian]')).toBeInTheDocument();
    expect(
      within(panel).getByText('Sẽ gửi: “Doanh thu hôm nay của cửa hàng là bao nhiêu?”')
    ).toBeInTheDocument();
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();

    await user.clear(composer());
    await user.click(within(panel).getByRole('button', { name: 'Mở danh sách lệnh' }));
    expect(within(await within(panel).findByRole('listbox')).getAllByRole('option')).toHaveLength(
      14
    );
  });

  it('lệnh câu hỏi: Enter gửi câu ĐÃ ĐỔI, bong bóng hiện câu đã đổi chứ không phải "/…"', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.type(composer(), '/doanhthu tuần trước{Enter}');

    await waitFor(() =>
      expect(api.sendChatbotMessage).toHaveBeenCalledWith({
        sessionId: 's-admin',
        content: 'Doanh thu tuần trước của cửa hàng là bao nhiêu?',
        phone: '0900000001',
      })
    );
    expect(
      await within(panel).findByText('Doanh thu tuần trước của cửa hàng là bao nhiêu?')
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/\/doanhthu tuần trước/)).toBeNull();
    expect(composer()).toHaveValue('');
  });

  it('"/…" không khớp lệnh nào được gửi như tin nhắn thường; Shift+Enter xuống dòng', async () => {
    const user = userEvent.setup();
    await openWidget(user);

    await user.type(composer(), 'dòng 1{Shift>}{Enter}{/Shift}dòng 2');
    expect(composer()).toHaveValue('dòng 1\ndòng 2');
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();

    await user.clear(composer());
    await user.type(composer(), '/khongco abc{Enter}');
    await waitFor(() =>
      expect(api.sendChatbotMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: '/khongco abc' })
      )
    );
  });

  it('đang trả lời thì khoá gửi nhưng vẫn gõ được', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.type(composer(), 'Câu 1{Enter}');
    await waitFor(() => expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(panel).getAllByRole('status')).toHaveLength(2));

    await user.type(composer(), 'Câu 2');
    expect(composer()).toHaveValue('Câu 2');
    expect(within(panel).getByRole('button', { name: 'Gửi tin nhắn' })).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1);
    expect(composer()).toHaveValue('Câu 2');
  });

  it('nút Mở rộng / Thu nhỏ đổi trạng thái và được nhớ; /morong cũng đổi', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.click(within(panel).getByRole('button', { name: 'Mở rộng' }));
    expect(within(panel).getByRole('button', { name: 'Thu nhỏ' })).toBeInTheDocument();
    expect(localStorage.getItem('chatbot.expanded')).toBe('1');
    // Mở rộng: khung phủ luôn chỗ nút tròn nên nút tròn ẩn đi.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đóng trợ lý' })).toBeNull());

    await user.click(within(panel).getByRole('button', { name: 'Thu nhỏ' }));
    expect(within(panel).getByRole('button', { name: 'Mở rộng' })).toBeInTheDocument();
    expect(localStorage.getItem('chatbot.expanded')).toBe('0');

    await user.type(composer(), '/morong{Enter}');
    expect(await within(panel).findByRole('button', { name: 'Thu nhỏ' })).toBeInTheDocument();
    expect(composer()).toHaveValue('');
  });

  it('nhớ lựa chọn mở rộng từ lần trước', async () => {
    localStorage.setItem('chatbot.expanded', '1');
    const user = userEvent.setup();
    const panel = await openWidget(user);

    expect(within(panel).getByRole('button', { name: 'Thu nhỏ' })).toBeInTheDocument();
  });

  it('/phien chép đủ mã phiên', async () => {
    const user = userEvent.setup();
    await openWidget(user);

    await user.type(composer(), '/phien{Enter}');

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Đã sao chép mã phiên', { variant: 'success' })
    );
    expect(await navigator.clipboard.readText()).toBe('s-admin');
  });

  it('khối của câu trả lời: nút mở màn đi đúng trang web; nút thao tác phải xác nhận rồi mới gửi', async () => {
    api.getChatbotMessages.mockResolvedValue([
      { id: 'm0', role: 'user', content: 'Kỳ lương tháng 9?', createdAt: '2026-10-05T01:00:00Z' },
      {
        id: 'a0',
        role: 'assistant',
        content: 'Kỳ lương tháng 9 chưa chốt. [Hướng dẫn](https://example.com/huong-dan)',
        createdAt: '2026-10-05T01:00:05Z',
        status: 'complete',
        blocks: [
          {
            type: 'action',
            id: 'a1',
            kind: 'navigate',
            label: 'Mở kỳ lương',
            route: 'payroll-cycle',
          },
          {
            type: 'action',
            id: 'a2',
            kind: 'navigate',
            label: 'Thông báo',
            route: 'notifications',
          },
          {
            type: 'action',
            id: 'a3',
            kind: 'tool',
            label: 'Chốt kỳ lương',
            prompt: 'Chốt kỳ lương tháng 9',
            confirm: { title: 'Chốt kỳ lương tháng 9?', message: 'Chốt kỳ lương tháng 9' },
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    const panel = await openWidget(user);

    // Link trong câu trả lời mở tab mới.
    const link = within(panel).getByRole('link', { name: 'Hướng dẫn' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // Khoá không có trang web → không có nút.
    expect(within(panel).queryByRole('button', { name: 'Thông báo' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Mở kỳ lương' }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard/payroll/cycles');

    // Nút thao tác: bấm KHÔNG gửi gì — chỉ mở hộp xác nhận.
    await user.click(within(panel).getByRole('button', { name: 'Chốt kỳ lương' }));
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('dialog', { name: 'Chốt kỳ lương tháng 9?' });

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Chốt kỳ lương tháng 9?' })).toBeNull()
    );
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole('button', { name: 'Chốt kỳ lương' }));
    const again = await screen.findByRole('dialog', { name: 'Chốt kỳ lương tháng 9?' });
    await user.click(within(again).getByRole('button', { name: 'Gửi yêu cầu' }));

    await waitFor(() =>
      expect(api.sendChatbotMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Chốt kỳ lương tháng 9' })
      )
    );
  });

  it('trả lời lỗi: không còn bong bóng "…", "Sửa và gửi lại" đưa câu hỏi về ô nhập (không tự gửi)', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    await user.type(composer(), 'Doanh thu hôm nay?{Enter}');
    await waitFor(() => expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(panel).getAllByRole('status')).toHaveLength(2));

    act(() => {
      lastConnection().emit('error', {
        sessionId: 's-admin',
        messageId: 'a1',
        error: 'Xin lỗi, chatbot đang bận. Vui lòng thử lại.',
        code: 'gateway_error',
        partial: null,
      });
    });

    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('Xin lỗi, chatbot đang bận. Vui lòng thử lại.');
    expect(within(panel).getAllByRole('status')).toHaveLength(1); // chỉ còn dòng trạng thái của header
    expect(within(panel).queryByText('…')).toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Sửa và gửi lại' }));
    await waitFor(() => expect(composer()).toHaveValue('Doanh thu hôm nay?'));
    expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1);
  });

  it('nút "Trò chuyện mới" ở header tạo phiên mới và báo kết quả', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);

    api.startChatbotSession.mockResolvedValueOnce(adminSession('s-new'));
    await user.click(within(panel).getByRole('button', { name: 'Trò chuyện mới' }));

    await waitFor(() =>
      expect(api.startChatbotSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ sessionId: null, newSession: true })
      )
    );
    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('Đã bắt đầu trò chuyện mới'));

    api.startChatbotSession.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await user.click(within(panel).getByRole('button', { name: 'Trò chuyện mới' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        'Không tạo được cuộc trò chuyện mới. Vui lòng thử lại.',
        { variant: 'error' }
      )
    );
    consoleError.mockRestore();
  });

  it('chấm chưa đọc: trả lời xong khi khung đang đóng thì hiện, mở khung thì mất', async () => {
    const user = userEvent.setup();
    const panel = await openWidget(user);
    const dot = () => document.querySelector('.MuiBadge-badge');

    await user.type(composer(), 'Doanh thu hôm nay?{Enter}');
    await waitFor(() => expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(panel).getAllByRole('status')).toHaveLength(2));
    await user.click(within(panel).getByRole('button', { name: 'Đóng' }));
    expect(dot()).toHaveClass('MuiBadge-invisible');

    act(() => {
      lastConnection().emit('completed', {
        sessionId: 's-admin',
        messageId: 'a1',
        content: '5 triệu.',
      });
    });
    await waitFor(() => expect(dot()).not.toHaveClass('MuiBadge-invisible'));

    await user.click(screen.getByRole('button', { name: 'Mở trợ lý' }));
    await waitFor(() => expect(dot()).toHaveClass('MuiBadge-invisible'));
  });

  it('mở từ xa bằng OPEN_CHATBOT_EVENT', async () => {
    renderWidget();
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_CHATBOT_EVENT));
    });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('Esc đóng khung, focus về nút tròn; bản nháp đang gõ vẫn còn khi mở lại', async () => {
    const user = userEvent.setup();
    await openWidget(user);

    await user.type(composer(), 'đang gõ dở');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const fab = screen.getByRole('button', { name: 'Mở trợ lý' });
    expect(fab).toHaveFocus();

    await user.click(fab);
    await screen.findByRole('dialog');
    expect(composer()).toHaveValue('đang gõ dở');
  });

  it('không mở được phiên: báo lỗi + "Thử lại" mở lại phiên (không tạo phiên mới)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.startChatbotSession.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();

    renderWidget();
    await user.click(screen.getByRole('button', { name: 'Mở trợ lý' }));
    const panel = await screen.findByRole('dialog');

    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('Không kết nối được trợ lý');
    expect(within(panel).getByText('Mất kết nối')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Doanh thu hôm nay' })).toBeNull();

    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    await within(panel).findByText('Sẵn sàng');
    expect(api.startChatbotSession).toHaveBeenLastCalledWith({
      sessionId: null,
      phone: '0900000001',
      displayName: 'Bình Vũ',
    });
    expect(within(panel).getByRole('button', { name: 'Doanh thu hôm nay' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('khách chưa đăng nhập: nhập Tên + SĐT rồi mới chat, có "Gọi lại đặt hàng"', async () => {
    mockUser = null;
    api.startChatbotSession.mockResolvedValue({
      sessionId: 'g1',
      ownerType: 'Guest',
      agent: 'CustomerSupport',
      tier: 'cici_customer',
      createdAt: '2026-10-05T00:00:00Z',
    });
    api.chatbotCallbackOrder.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    renderWidget();
    await user.click(screen.getByRole('button', { name: 'Mở trợ lý' }));
    const panel = await screen.findByRole('dialog');

    expect(
      within(panel).getByRole('heading', { name: 'CiCi — Hỗ trợ khách hàng' })
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Nhập tin nhắn' })).toBeNull();

    await user.type(within(panel).getByLabelText('Tên của bạn'), 'Lan');
    await user.type(within(panel).getByLabelText('Số điện thoại'), '0911222333');
    await user.click(within(panel).getByRole('button', { name: 'Bắt đầu trò chuyện' }));

    expect(JSON.parse(localStorage.getItem('chatbot.guestInfo') ?? '{}')).toEqual({
      name: 'Lan',
      phone: '0911222333',
    });
    await within(panel).findByText('Sẵn sàng');
    await waitFor(() =>
      expect(api.startChatbotSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ phone: '0911222333', displayName: 'Lan' })
      )
    );

    ['Sản phẩm nổi bật', 'Kiểm tra còn hàng', 'Địa chỉ & giờ mở cửa', 'Gọi lại đặt hàng'].forEach(
      (label) => expect(within(panel).getByRole('button', { name: label })).toBeInTheDocument()
    );

    await user.click(within(panel).getByRole('button', { name: 'Gọi lại đặt hàng' }));
    await waitFor(() =>
      expect(api.chatbotCallbackOrder).toHaveBeenCalledWith({
        sessionId: 'g1',
        phone: '0911222333',
        content: undefined,
      })
    );
    await waitFor(() =>
      expect(api.sendChatbotMessage).toHaveBeenCalledWith({
        sessionId: 'g1',
        content: 'Tôi muốn được gọi lại để đặt hàng',
        phone: '0911222333',
      })
    );
  });

  it('khách cũ quay lại (đã lưu Tên + SĐT): mở phiên đúng MỘT lần với đủ thông tin, không qua cổng nhập', async () => {
    mockUser = null;
    localStorage.setItem('chatbot.guestInfo', JSON.stringify({ name: 'Lan', phone: '0911222333' }));
    localStorage.setItem('chatbot.sessionId', 'stored-guest');
    localStorage.setItem('chatbot.sessionCreatedAt', String(Date.now()));
    api.startChatbotSession.mockResolvedValue({
      sessionId: 'stored-guest',
      ownerType: 'Guest',
      agent: 'CustomerSupport',
      tier: 'cici_customer',
      createdAt: '2026-10-05T00:00:00Z',
    });
    const user = userEvent.setup();

    const panel = await openWidget(user);

    expect(api.startChatbotSession).toHaveBeenCalledTimes(1);
    expect(api.startChatbotSession).toHaveBeenCalledWith({
      sessionId: 'stored-guest',
      phone: '0911222333',
      displayName: 'Lan',
    });
    expect(within(panel).queryByLabelText('Tên của bạn')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Gọi lại đặt hàng' })).toBeInTheDocument();
  });
});
