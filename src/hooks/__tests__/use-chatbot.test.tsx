import { StrictMode } from 'react';
import { act, waitFor, renderHook } from '@testing-library/react';
import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';

// ----------------------------------------------------------------------
// Hook useChatbot với REST (src/api/chatbot) và SignalR (@microsoft/signalr) giả:
//   - "Trò chuyện mới" gửi newSession: true và thay phiên + tin nhắn;
//   - bootstrap kết thúc (ready = true) cả khi effect chạy hai lần / đổi tham số giữa chừng;
//   - sự kiện tới trước phản hồi REST không tạo bong bóng trùng;
//   - completed lưu blocks / steps; error không để lại bong bóng rỗng;
//   - JoinSession bị từ chối và im lặng quá lâu đều báo lỗi thay vì quay mãi.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  startChatbotSession: vi.fn(),
  getChatbotMessages: vi.fn(),
  sendChatbotMessage: vi.fn(),
}));

vi.mock('src/api/chatbot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/api/chatbot')>()),
  startChatbotSession: api.startChatbotSession,
  getChatbotMessages: api.getChatbotMessages,
  sendChatbotMessage: api.sendChatbotMessage,
}));

const hub = vi.hoisted(() => {
  type Handler = (payload: any) => void;

  const state = {
    connections: [] as any[],
    /** Giá trị JoinSession trả về (false = bị từ chối; Error = ném lỗi). */
    joinResult: true as any,
  };

  class FakeConnection {
    handlers = new Map<string, Handler>();

    state = 'Disconnected';

    invoked: any[][] = [];

    stopped = false;

    reconnected: (() => void) | null = null;

    closed: (() => void) | null = null;

    on(event: string, handler: Handler) {
      this.handlers.set(event, handler);
    }

    onreconnecting() {}

    onreconnected(callback: () => void) {
      this.reconnected = callback;
    }

    onclose(callback: () => void) {
      this.closed = callback;
    }

    async start() {
      this.state = 'Connected';
    }

    async stop() {
      this.stopped = true;
      this.state = 'Disconnected';
    }

    async invoke(method: string, ...args: any[]) {
      this.invoked.push([method, ...args]);
      if (method !== 'JoinSession') return undefined;
      if (state.joinResult instanceof Error) throw state.joinResult;
      return state.joinResult;
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

// Imported after the mocks above so the hook picks up the mocked modules.
import { useChatbot, REPLY_SILENCE_MS } from 'src/hooks/use-chatbot';

// ----------------------------------------------------------------------

const makeSession = (over: Record<string, unknown> = {}) => ({
  sessionId: 's1',
  ownerType: 'User',
  agent: 'InternalAdmin',
  tier: 'cici_admin',
  displayName: 'Bình',
  createdAt: '2026-10-05T00:00:00Z',
  ...over,
});

const ADMIN = { userId: 'u1', phone: '0900000001', displayName: 'Bình' };

const lastConnection = () => hub.state.connections[hub.state.connections.length - 1];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Mount hook và chờ tới khi có phiên + đã vào nhóm SignalR. */
async function mountReady(opts: Parameters<typeof useChatbot>[0] = ADMIN) {
  const view = renderHook((props: Parameters<typeof useChatbot>[0]) => useChatbot(props), {
    initialProps: opts,
  });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  await waitFor(() => expect(view.result.current.connection).toBe('ready'));
  return view;
}

/** Gửi một câu hỏi và chờ REST trả về chỗ giữ chỗ `a1`. */
async function ask(view: Awaited<ReturnType<typeof mountReady>>, text = 'Doanh thu hôm nay?') {
  api.sendChatbotMessage.mockResolvedValueOnce({
    messageId: 'm1',
    assistantMessageId: 'a1',
    fromCache: false,
    cachedAnswer: null,
  });
  let accepted = false;
  await act(async () => {
    accepted = await view.result.current.sendMessage(text);
  });
  expect(accepted).toBe(true);
}

const assistantMessages = (view: Awaited<ReturnType<typeof mountReady>>) =>
  view.result.current.messages.filter((m) => m.role === 'assistant');

// Các nhánh lỗi cố ý của hook đều console.error — tắt tiếng trong test.
let restoreConsoleError: () => void = () => {};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  hub.state.connections = [];
  hub.state.joinResult = true;
  api.startChatbotSession.mockResolvedValue(makeSession());
  api.getChatbotMessages.mockResolvedValue([]);
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  restoreConsoleError = () => spy.mockRestore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  restoreConsoleError();
});

// ----------------------------------------------------------------------

describe('useChatbot — bootstrap', () => {
  it('người đăng nhập: nối lại phiên của server (không gửi id máy), nạp lịch sử, join nhóm SignalR', async () => {
    api.getChatbotMessages.mockResolvedValue([
      { id: 'm0', role: 'user', content: 'Chào', createdAt: '2026-10-05T01:00:00Z' },
      { id: 'a0', role: 'assistant', content: 'Xin chào!', createdAt: '2026-10-05T01:00:01Z' },
      // Chỗ giữ chỗ rỗng mồ côi → không hiện.
      {
        id: 'a9',
        role: 'assistant',
        content: '',
        createdAt: '2026-10-05T01:00:02Z',
        status: 'pending',
      },
    ]);

    const view = await mountReady();

    expect(api.startChatbotSession).toHaveBeenCalledWith({
      sessionId: null,
      phone: '0900000001',
      displayName: 'Bình',
    });
    expect(api.getChatbotMessages).toHaveBeenCalledWith('s1', 50);
    expect(view.result.current.session?.sessionId).toBe('s1');
    expect(view.result.current.agent).toBe('InternalAdmin');
    expect(view.result.current.tier).toBe('cici_admin');
    expect(view.result.current.messages.map((m) => m.id)).toEqual(['m0', 'a0']);
    expect(view.result.current.lastUserText).toBe('Chào');
    expect(lastConnection().invoked).toContainEqual(['JoinSession', 's1']);
  });

  it('khách: gửi id phiên lưu ở máy và ghi lại id server trả về', async () => {
    localStorage.setItem('chatbot.sessionId', 'stored-guest');
    localStorage.setItem('chatbot.sessionCreatedAt', String(Date.now()));
    api.startChatbotSession.mockResolvedValue(
      makeSession({
        sessionId: 'g1',
        ownerType: 'Guest',
        agent: 'CustomerSupport',
        tier: 'cici_customer',
      })
    );

    await mountReady({ phone: '0911', displayName: 'Lan' });

    expect(api.startChatbotSession).toHaveBeenCalledWith({
      sessionId: 'stored-guest',
      phone: '0911',
      displayName: 'Lan',
    });
    expect(localStorage.getItem('chatbot.sessionId')).toBe('g1');
  });

  it('effect chạy hai lần (StrictMode) vẫn kết thúc với ready = true', async () => {
    const view = renderHook(() => useChatbot(ADMIN), { wrapper: StrictMode });

    await waitFor(() => expect(view.result.current.ready).toBe(true));

    expect(api.startChatbotSession.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(view.result.current.session?.sessionId).toBe('s1');
    expect(view.result.current.error).toBeNull();
    await waitFor(() => expect(view.result.current.connection).toBe('ready'));
  });

  it('tham số đổi giữa chừng: lượt mới nhất thắng, lượt cũ về sau bị bỏ, ready không kẹt', async () => {
    const first = deferred<ReturnType<typeof makeSession>>();
    api.startChatbotSession.mockReset();
    api.startChatbotSession
      .mockReturnValueOnce(first.promise) // lượt 1: khách cũ, chưa có SĐT
      .mockResolvedValueOnce(makeSession({ sessionId: 's-second', ownerType: 'Customer' }));

    const view = renderHook((props: Parameters<typeof useChatbot>[0]) => useChatbot(props), {
      initialProps: { phone: null, displayName: null } as Parameters<typeof useChatbot>[0],
    });
    expect(view.result.current.ready).toBe(false);

    // Thông tin khách (localStorage) về sau lượt đầu → bootstrap lại trong khi lượt 1 còn treo.
    view.rerender({ phone: '0911', displayName: 'Lan' });

    await waitFor(() => expect(view.result.current.ready).toBe(true));
    expect(view.result.current.session?.sessionId).toBe('s-second');

    // Lượt 1 trả về muộn → không được ghi đè phiên của lượt mới.
    await act(async () => {
      first.resolve(makeSession({ sessionId: 's-first', ownerType: 'Guest' }));
      await Promise.resolve();
    });
    expect(view.result.current.session?.sessionId).toBe('s-second');
    expect(view.result.current.ready).toBe(true);
    expect(api.getChatbotMessages).not.toHaveBeenCalledWith('s-first', 50);
  });

  it('enabled = false (chưa biết danh tính): chưa mở phiên; bật lên mới mở, đúng một lần', async () => {
    const view = renderHook((props: Parameters<typeof useChatbot>[0]) => useChatbot(props), {
      initialProps: { enabled: false } as Parameters<typeof useChatbot>[0],
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.startChatbotSession).not.toHaveBeenCalled();
    expect(view.result.current.ready).toBe(false);
    expect(hub.state.connections).toHaveLength(0);

    view.rerender({ ...ADMIN, enabled: true });

    await waitFor(() => expect(view.result.current.ready).toBe(true));
    expect(api.startChatbotSession).toHaveBeenCalledTimes(1);
    expect(api.startChatbotSession).toHaveBeenCalledWith({
      sessionId: null,
      phone: '0900000001',
      displayName: 'Bình',
    });
  });

  it('không mở được phiên → báo lỗi, ready vẫn về true (không quay mãi)', async () => {
    api.startChatbotSession.mockRejectedValue(new Error('network'));

    const view = renderHook(() => useChatbot(ADMIN));

    await waitFor(() => expect(view.result.current.ready).toBe(true));
    expect(view.result.current.session).toBeNull();
    expect(view.result.current.error).toMatch(/Không kết nối được trợ lý/);
    expect(hub.state.connections).toHaveLength(0);
  });
});

describe('useChatbot — trò chuyện mới', () => {
  it('người đăng nhập: gửi newSession: true (sessionId null), thay phiên + tin nhắn, đổi nhóm SignalR', async () => {
    api.getChatbotMessages.mockResolvedValue([
      { id: 'm0', role: 'user', content: 'Chào', createdAt: '2026-10-05T01:00:00Z' },
      { id: 'a0', role: 'assistant', content: 'Xin chào!', createdAt: '2026-10-05T01:00:01Z' },
    ]);
    const view = await mountReady();
    expect(view.result.current.messages).toHaveLength(2);
    const oldConnection = lastConnection();

    api.startChatbotSession.mockResolvedValueOnce(makeSession({ sessionId: 's2' }));
    api.getChatbotMessages.mockResolvedValueOnce([]);

    let ok = false;
    await act(async () => {
      ok = await view.result.current.startNewSession();
    });

    expect(ok).toBe(true);
    expect(api.startChatbotSession).toHaveBeenLastCalledWith({
      sessionId: null,
      phone: '0900000001',
      displayName: 'Bình',
      newSession: true,
    });
    expect(api.getChatbotMessages).toHaveBeenLastCalledWith('s2', 50);
    expect(view.result.current.session?.sessionId).toBe('s2');
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.ready).toBe(true);
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.error).toBeNull();

    // Rời nhóm phiên cũ + đóng kết nối cũ; kết nối mới join nhóm phiên mới.
    expect(oldConnection.invoked).toContainEqual(['LeaveSession', 's1']);
    expect(oldConnection.stopped).toBe(true);
    await waitFor(() => expect(lastConnection().invoked).toContainEqual(['JoinSession', 's2']));
    expect(lastConnection()).not.toBe(oldConnection);
  });

  it('resetSession (tên cũ, trang Chatbot nội bộ dùng) cũng tạo phiên mới thật', async () => {
    // Trang nội bộ không truyền userId → hook đi nhánh "khách": id mới tinh + newSession: true.
    localStorage.setItem('chatbot.sessionId', 'stored-guest');
    localStorage.setItem('chatbot.sessionCreatedAt', String(Date.now()));
    const view = await mountReady({ phone: '0900000001', displayName: 'Bình' });

    api.startChatbotSession.mockResolvedValueOnce(makeSession({ sessionId: 's2' }));

    let ok = false;
    await act(async () => {
      ok = await view.result.current.resetSession();
    });

    expect(ok).toBe(true);
    const body =
      api.startChatbotSession.mock.calls[api.startChatbotSession.mock.calls.length - 1][0];
    expect(body.newSession).toBe(true);
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId).not.toBe('stored-guest');
    expect(body.sessionId).not.toBe('s1');
    // Server nối lại phiên khách theo SĐT nên lời gọi tạo phiên mới không kèm SĐT.
    expect(body.phone).toBeNull();
    expect(body.displayName).toBe('Bình');
    expect(view.result.current.session?.sessionId).toBe('s2');
    expect(localStorage.getItem('chatbot.sessionId')).toBe('s2');
  });

  it('tạo phiên mới lỗi → trả false, giữ nguyên phiên + tin nhắn đang có', async () => {
    api.getChatbotMessages.mockResolvedValue([
      { id: 'm0', role: 'user', content: 'Chào', createdAt: '2026-10-05T01:00:00Z' },
    ]);
    const view = await mountReady();
    api.startChatbotSession.mockRejectedValueOnce(new Error('boom'));

    let ok = true;
    await act(async () => {
      ok = await view.result.current.startNewSession();
    });

    expect(ok).toBe(false);
    expect(view.result.current.session?.sessionId).toBe('s1');
    expect(view.result.current.messages).toHaveLength(1);
    expect(view.result.current.ready).toBe(true);
    expect(view.result.current.error).toMatch(/Không tạo được cuộc trò chuyện mới/);
  });

  it('đổi phiên giữa lúc đang trả lời: bỏ trạng thái phiên cũ, sự kiện phiên cũ bị bỏ qua', async () => {
    const view = await mountReady();
    await ask(view);
    const oldConnection = lastConnection();
    expect(view.result.current.typing).toBe(true);

    api.startChatbotSession.mockResolvedValueOnce(makeSession({ sessionId: 's2' }));
    await act(async () => {
      await view.result.current.startNewSession();
    });

    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.streamingMessageId).toBeNull();

    act(() => {
      oldConnection.emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'muộn' });
    });
    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.typing).toBe(false);
  });
});

describe('useChatbot — gửi + stream', () => {
  it('gửi câu hỏi: hiện ngay tin của người dùng + chỗ giữ chỗ đang chờ', async () => {
    const view = await mountReady();
    await ask(view, '  Doanh thu hôm nay?  ');

    expect(api.sendChatbotMessage).toHaveBeenCalledWith({
      sessionId: 's1',
      content: 'Doanh thu hôm nay?',
      phone: '0900000001',
    });
    const { messages } = view.result.current;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Doanh thu hôm nay?' });
    expect(messages[1]).toMatchObject({
      id: 'a1',
      role: 'assistant',
      content: '',
      status: 'pending',
    });
    expect(view.result.current.typing).toBe(true);
    expect(view.result.current.busy).toBe(true);
    expect(view.result.current.streamingMessageId).toBe('a1');
    expect(view.result.current.lastUserText).toBe('Doanh thu hôm nay?');
  });

  it('chunk / streamingStarted tới TRƯỚC phản hồi REST không tạo bong bóng trùng', async () => {
    const view = await mountReady();
    const rest = deferred<any>();
    api.sendChatbotMessage.mockReturnValueOnce(rest.promise);

    let sending!: Promise<boolean>;
    act(() => {
      sending = view.result.current.sendMessage('Doanh thu hôm nay?');
    });
    await waitFor(() => expect(api.sendChatbotMessage).toHaveBeenCalled());

    act(() => {
      lastConnection().emit('streamingStarted', { sessionId: 's1', messageId: 'a1' });
      lastConnection().emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'Doanh ' });
    });
    expect(assistantMessages(view)).toHaveLength(1);

    await act(async () => {
      rest.resolve({ messageId: 'm1', assistantMessageId: 'a1', fromCache: false });
      await sending;
    });

    act(() => {
      lastConnection().emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'thu 5 triệu' });
    });

    expect(assistantMessages(view)).toHaveLength(1);
    expect(assistantMessages(view)[0]).toMatchObject({
      id: 'a1',
      content: 'Doanh thu 5 triệu',
      status: 'pending',
    });
    expect(view.result.current.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(view.result.current.typing).toBe(true);
  });

  it('step: giữ danh sách bước theo từng tin trong lúc stream; status: nhãn hoạt động', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().emit('status', {
        sessionId: 's1',
        messageId: 'a1',
        kind: 'tool',
        phase: 'start',
        name: 'analytics_revenue_read',
        label: 'analytics_revenue_read',
        detail: null,
      });
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: {
          id: 's1',
          kind: 'tool',
          name: 'analytics_revenue_read',
          label: 'x',
          state: 'running',
        },
      });
    });
    expect(view.result.current.activity).toMatchObject({
      kind: 'tool',
      name: 'analytics_revenue_read',
    });
    expect(assistantMessages(view)[0].steps).toEqual([
      { id: 's1', kind: 'tool', name: 'analytics_revenue_read', label: 'x', state: 'running' },
    ]);

    act(() => {
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: { id: 's1', kind: 'tool', name: 'analytics_revenue_read', label: 'x', state: 'done' },
      });
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: {
          id: 's2',
          kind: 'tool',
          name: 'attendance_logs_read',
          label: 'y',
          state: 'running',
        },
      });
    });
    expect(assistantMessages(view)[0].steps?.map((s) => `${s.id}:${s.state}`)).toEqual([
      's1:done',
      's2:running',
    ]);
    expect(assistantMessages(view)).toHaveLength(1);
  });

  it('completed: lưu content chính thức + blocks + steps + status, tắt trạng thái đang trả lời', async () => {
    const view = await mountReady();
    await ask(view);
    expect(view.result.current.lastReplyAt).toBeNull();

    const blocks = [
      { type: 'suggestions', items: [{ label: 'So với hôm qua?', prompt: 'So với hôm qua?' }] },
      {
        type: 'action',
        id: 'a1',
        kind: 'navigate',
        label: 'Báo cáo doanh thu',
        route: 'revenue-report',
      },
    ];
    act(() => {
      lastConnection().emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'Doanh thu…' });
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: {
          id: 's1',
          kind: 'tool',
          name: 'analytics_revenue_read',
          label: 'x',
          state: 'running',
        },
      });
      lastConnection().emit('completed', {
        sessionId: 's1',
        messageId: 'a1',
        content: 'Doanh thu hôm nay là 5 triệu.',
        fromCache: false,
        v: 1,
        status: 'complete',
        blocks,
        steps: [
          { id: 's1', kind: 'tool', name: 'analytics_revenue_read', label: 'x', state: 'done' },
        ],
      });
    });

    const [reply] = assistantMessages(view);
    expect(reply).toMatchObject({
      id: 'a1',
      content: 'Doanh thu hôm nay là 5 triệu.',
      status: 'complete',
      v: 1,
      blocks,
    });
    expect(reply.steps).toEqual([
      { id: 's1', kind: 'tool', name: 'analytics_revenue_read', label: 'x', state: 'done' },
    ]);
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.streamingMessageId).toBeNull();
    expect(view.result.current.activity).toBeNull();
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.turnFailed).toBe(false);
    expect(view.result.current.lastReplyAt).not.toBeNull();
  });

  it('completed không kèm steps: bước đang chạy được chốt thành done', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: { id: 's1', kind: 'tool', name: 'orders_read_list', label: 'x', state: 'running' },
      });
      lastConnection().emit('completed', { sessionId: 's1', messageId: 'a1', content: 'Xong.' });
    });

    expect(assistantMessages(view)[0].steps?.[0].state).toBe('done');
  });

  it('câu trả lời từ cache (REST) hiện ngay, không chờ SignalR', async () => {
    const view = await mountReady();
    api.sendChatbotMessage.mockResolvedValueOnce({
      messageId: 'm1',
      assistantMessageId: 'a1',
      fromCache: true,
      cachedAnswer: 'Cửa hàng mở cửa 8h–22h.',
    });

    await act(async () => {
      await view.result.current.sendMessage('Giờ mở cửa?');
    });

    expect(assistantMessages(view)[0]).toMatchObject({
      id: 'a1',
      content: 'Cửa hàng mở cửa 8h–22h.',
      fromCache: true,
      status: 'complete',
    });
    expect(view.result.current.typing).toBe(false);
  });

  it('câu trả lời xong trước cả phản hồi REST → không bật lại trạng thái đang trả lời', async () => {
    const view = await mountReady();
    const rest = deferred<any>();
    api.sendChatbotMessage.mockReturnValueOnce(rest.promise);

    let sending!: Promise<boolean>;
    act(() => {
      sending = view.result.current.sendMessage('Xin chào');
    });
    await waitFor(() => expect(api.sendChatbotMessage).toHaveBeenCalled());

    act(() => {
      lastConnection().emit('streamingStarted', { sessionId: 's1', messageId: 'a1' });
      lastConnection().emit('completed', {
        sessionId: 's1',
        messageId: 'a1',
        content: 'Chào bạn!',
      });
    });
    await act(async () => {
      rest.resolve({ messageId: 'm1', assistantMessageId: 'a1', fromCache: false });
      await sending;
    });

    expect(assistantMessages(view)).toHaveLength(1);
    expect(assistantMessages(view)[0]).toMatchObject({ content: 'Chào bạn!', status: 'complete' });
    expect(view.result.current.typing).toBe(false);
  });

  it('sự kiện của phiên khác bị bỏ qua', async () => {
    const view = await mountReady();

    act(() => {
      lastConnection().emit('chunk', { sessionId: 'khac', messageId: 'x1', content: 'lạc' });
    });

    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.typing).toBe(false);
  });
});

describe('useChatbot — lỗi', () => {
  it('error không có phần đã trả lời: bỏ chỗ giữ chỗ rỗng, báo lỗi, cho gửi lại', async () => {
    const view = await mountReady();
    await ask(view, 'Doanh thu hôm nay?');
    expect(assistantMessages(view)).toHaveLength(1);

    act(() => {
      lastConnection().emit('error', {
        sessionId: 's1',
        messageId: 'a1',
        error: 'Xin lỗi, chatbot đang bận. Vui lòng thử lại.',
        code: 'gateway_error',
        retryable: true,
        partial: null,
      });
    });

    expect(assistantMessages(view)).toHaveLength(0);
    expect(view.result.current.messages.map((m) => m.role)).toEqual(['user']);
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.streamingMessageId).toBeNull();
    expect(view.result.current.error).toBe('Xin lỗi, chatbot đang bận. Vui lòng thử lại.');
    expect(view.result.current.turnFailed).toBe(true);
    expect(view.result.current.lastUserText).toBe('Doanh thu hôm nay?');
  });

  it('error có partial: giữ phần đã trả lời, đánh dấu lỗi (không còn đang chạy)', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().emit('chunk', {
        sessionId: 's1',
        messageId: 'a1',
        content: 'Doanh thu hôm',
      });
      lastConnection().emit('step', {
        sessionId: 's1',
        messageId: 'a1',
        step: {
          id: 's1',
          kind: 'tool',
          name: 'analytics_revenue_read',
          label: 'x',
          state: 'running',
        },
      });
      lastConnection().emit('error', {
        sessionId: 's1',
        messageId: 'a1',
        error: 'Xin lỗi, chatbot đang bận. Vui lòng thử lại.',
        code: 'timeout',
        partial: 'Doanh thu hôm nay',
      });
    });

    expect(assistantMessages(view)).toHaveLength(1);
    expect(assistantMessages(view)[0]).toMatchObject({
      content: 'Doanh thu hôm nay',
      status: 'error',
      errorCode: 'timeout',
    });
    expect(assistantMessages(view)[0].steps?.[0].state).toBe('error');
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.turnFailed).toBe(true);
  });

  it('chunk tới sau error không dựng lại bong bóng', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().emit('error', { sessionId: 's1', messageId: 'a1', error: 'Lỗi' });
      lastConnection().emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'muộn' });
    });

    expect(assistantMessages(view)).toHaveLength(0);
    expect(view.result.current.typing).toBe(false);
  });

  it('completed rỗng (model không viết gì) không để lại bong bóng rỗng', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().emit('completed', { sessionId: 's1', messageId: 'a1', content: '' });
    });

    expect(assistantMessages(view)).toHaveLength(0);
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.error).toMatch(/chưa trả lời được/);
    expect(view.result.current.turnFailed).toBe(true);
  });

  it('POST lỗi: đánh dấu tin chưa gửi được, lần gửi sau bỏ tin lỗi cũ', async () => {
    const view = await mountReady();
    api.sendChatbotMessage.mockRejectedValueOnce(new Error('500'));

    let ok = true;
    await act(async () => {
      ok = await view.result.current.sendMessage('Doanh thu hôm nay?');
    });

    expect(ok).toBe(false);
    expect(view.result.current.messages).toHaveLength(1);
    expect(view.result.current.messages[0]).toMatchObject({ role: 'user', status: 'error' });
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.error).toMatch(/Không gửi được tin nhắn/);
    expect(view.result.current.turnFailed).toBe(true);
    expect(view.result.current.lastUserText).toBe('Doanh thu hôm nay?');

    await ask(view, 'Doanh thu hôm nay?');
    expect(view.result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(view.result.current.messages[0].status).toBeUndefined();
    expect(view.result.current.error).toBeNull();
  });

  it('JoinSession trả false → báo lỗi kết nối, gửi câu hỏi bị chặn (không quay mãi)', async () => {
    hub.state.joinResult = false;
    const view = renderHook(() => useChatbot(ADMIN));

    await waitFor(() => expect(view.result.current.ready).toBe(true));
    await waitFor(() => expect(view.result.current.connection).toBe('error'));
    expect(view.result.current.error).toMatch(/Mất kết nối/);

    let ok = true;
    await act(async () => {
      ok = await view.result.current.sendMessage('Doanh thu hôm nay?');
    });

    expect(ok).toBe(false);
    expect(api.sendChatbotMessage).not.toHaveBeenCalled();
    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.turnFailed).toBe(true);
    expect(view.result.current.messages[0]).toMatchObject({ role: 'user', status: 'error' });
  });

  it('JoinSession ném lỗi → cũng báo lỗi; lần gửi sau thử join lại và gửi được', async () => {
    hub.state.joinResult = new Error('hub down');
    const view = renderHook(() => useChatbot(ADMIN));
    await waitFor(() => expect(view.result.current.connection).toBe('error'));
    expect(view.result.current.error).toMatch(/Mất kết nối/);

    hub.state.joinResult = true;
    await ask(view);

    expect(view.result.current.connection).toBe('ready');
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.typing).toBe(true);
  });

  it('kết nối SignalR đóng hẳn khi đang chờ trả lời → dừng quay, báo lỗi', async () => {
    const view = await mountReady();
    await ask(view);

    act(() => {
      lastConnection().state = 'Disconnected';
      lastConnection().closed?.();
    });

    expect(view.result.current.connection).toBe('error');
    expect(view.result.current.typing).toBe(false);
    expect(assistantMessages(view)).toHaveLength(0);
    expect(view.result.current.error).toMatch(/Mất kết nối/);
    expect(view.result.current.turnFailed).toBe(true);
  });
});

describe('useChatbot — im lặng quá lâu', () => {
  it('không có sự kiện nào trong 120 giây → hỏi lại REST, vẫn chưa xong thì dừng quay + báo lỗi', async () => {
    const view = await mountReady();
    vi.useFakeTimers();
    await ask(view);
    expect(view.result.current.typing).toBe(true);

    api.getChatbotMessages.mockClear();
    api.getChatbotMessages.mockResolvedValueOnce([
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        createdAt: '2026-10-05T01:00:00Z',
        status: 'pending',
      },
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPLY_SILENCE_MS - 1000);
    });
    expect(view.result.current.typing).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(api.getChatbotMessages).toHaveBeenCalledWith('s1', 20);
    expect(view.result.current.typing).toBe(false);
    expect(assistantMessages(view)).toHaveLength(0);
    expect(view.result.current.error).toMatch(/phản hồi quá lâu/);
    expect(view.result.current.turnFailed).toBe(true);
  });

  it('mỗi sự kiện đặt lại đồng hồ', async () => {
    const view = await mountReady();
    vi.useFakeTimers();
    await ask(view);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPLY_SILENCE_MS - 1000);
    });
    act(() => {
      lastConnection().emit('chunk', { sessionId: 's1', messageId: 'a1', content: 'Đang ' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPLY_SILENCE_MS - 1000);
    });

    expect(view.result.current.typing).toBe(true);
    expect(view.result.current.error).toBeNull();
  });

  it('lỡ sự kiện completed nhưng server đã trả lời xong → lấy từ REST, không báo lỗi', async () => {
    const view = await mountReady();
    vi.useFakeTimers();
    await ask(view);

    api.getChatbotMessages.mockResolvedValueOnce([
      {
        id: 'a1',
        role: 'assistant',
        content: 'Doanh thu hôm nay là 5 triệu.',
        createdAt: '2026-10-05T01:00:00Z',
        status: 'complete',
        blocks: [{ type: 'link', url: 'https://example.com', title: 'Xem' }],
      },
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REPLY_SILENCE_MS + 1000);
    });

    expect(view.result.current.typing).toBe(false);
    expect(view.result.current.error).toBeNull();
    expect(assistantMessages(view)[0]).toMatchObject({
      content: 'Doanh thu hôm nay là 5 triệu.',
      status: 'complete',
      blocks: [{ type: 'link', url: 'https://example.com', title: 'Xem' }],
    });
  });
});
