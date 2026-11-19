import type { IAgentTask, IAgentTaskDetail } from 'src/api/agent-center';

import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trung tâm Agent: bảng việc xếp đúng cột, nút Dừng chỉ trên việc chưa xong; chi tiết việc hiện kế hoạch + dòng thời gian.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const detail: { value: IAgentTaskDetail | undefined } = { value: undefined };
vi.mock('src/api/agent-center', async (orig) => ({
  ...(await orig<typeof import('src/api/agent-center')>()),
  useAgentTaskDetail: () => ({
    detail: detail.value,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  addAgentTaskNote: vi.fn(),
}));

// Imported after the mocks above.
import AgentBoard from '../agent-board';
import AgentTaskDrawer from '../agent-task-drawer';

const theme = createTheme({
  palette: { background: { neutral: '#f4f6f8' } as any },
  customShadows: { z1: 'none', z8: 'none', z20: 'none' },
} as any);

function task(over: Partial<IAgentTask>): IAgentTask {
  return {
    id: 't',
    agentId: 'a1',
    agentName: 'Phân tích',
    title: 'Việc',
    instruction: 'Chỉ dẫn',
    source: 'manual',
    sourceRef: null,
    parentTaskId: null,
    status: 'queued',
    plan: null,
    currentStepIndex: null,
    currentStepLabel: null,
    result: null,
    error: null,
    pendingActionId: null,
    createdByUserId: 'u1',
    createdByName: 'Bình',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    stopRequested: false,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    ...over,
  };
}

afterEach(() => {
  detail.value = undefined;
});

describe('bảng việc', () => {
  it('xếp thẻ vào đúng cột và chỉ việc chưa xong có nút Dừng', async () => {
    const onStop = vi.fn();
    const onOpen = vi.fn();
    const tasks = [
      task({
        id: 'r',
        title: 'Báo cáo sáng',
        status: 'running',
        startedAt: '2026-11-18T00:00:00Z',
        currentStepLabel: 'Bước 2/3 — đang tra tồn kho',
        plan: [
          { title: 'A', status: 'done' },
          { title: 'B', status: 'in_progress' },
          { title: 'C', status: 'pending' },
        ],
        inputTokens: 1000,
        outputTokens: 500,
        source: 'schedule',
      }),
      task({ id: 'f', title: 'Việc lỗi', status: 'failed' }),
      task({ id: 'c', title: 'Việc huỷ', status: 'cancelled' }),
    ];
    render(
      <ThemeProvider theme={theme}>
        <AgentBoard
          tasks={tasks}
          mode="all"
          loading={false}
          selectedTaskId={null}
          onOpen={onOpen}
          onStop={onStop}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
          onShowList={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Bước 2/3 — đang tra tồn kho')).toBeInTheDocument();
    // Thẻ gọn: không in token, nguồn nằm trong chú thích của icon.
    expect(screen.queryByText('1,5k')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nguồn: Lịch')).toBeInTheDocument();
    expect(screen.getByText('Đã huỷ')).toBeInTheDocument();
    expect(screen.getByText('Lỗi')).toBeInTheDocument();

    const stops = screen.getAllByRole('button', { name: 'Dừng' });
    expect(stops).toHaveLength(1);
    await userEvent.click(stops[0]);
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ id: 'r' }));
    expect(onOpen).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Việc lỗi'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'f' }));
  });
});

describe('chi tiết việc', () => {
  it('hiện kế hoạch, dòng thời gian, link phiếu duyệt và nút theo trạng thái', async () => {
    const t = task({
      id: 'w',
      title: 'Đặt hàng NCC',
      status: 'waiting_approval',
      pendingActionId: 'p1',
      startedAt: '2026-11-18T00:00:00Z',
      plan: [
        { title: 'Tra tồn', status: 'done' },
        { title: 'Tạo phiếu nhập', status: 'in_progress', note: 'chờ duyệt' },
      ],
    });
    detail.value = {
      task: t,
      steps: [
        {
          id: 's2',
          taskId: 'w',
          seq: 2,
          kind: 'tool',
          name: 'purchase_create',
          summary: 'Gọi tạo phiếu nhập',
          detail: '{"supplierId":"x"}',
          status: 'error',
          durationMs: 1200,
          inputTokens: null,
          outputTokens: null,
          createdAt: '2026-11-18T00:00:05Z',
          authorName: null,
        },
        {
          id: 's1',
          taskId: 'w',
          seq: 1,
          kind: 'model',
          name: null,
          summary: 'Lập kế hoạch 2 bước',
          detail: null,
          status: 'ok',
          durationMs: 800,
          inputTokens: 300,
          outputTokens: 50,
          createdAt: '2026-11-18T00:00:01Z',
          authorName: null,
        },
      ],
    };
    const onStop = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <AgentTaskDrawer
          taskId="w"
          fallbackTask={null}
          poll={false}
          onClose={vi.fn()}
          onStop={onStop}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
          onNoteSent={vi.fn()}
        />
      </ThemeProvider>
    );

    const drawer = screen.getByRole('presentation');
    expect(within(drawer).getByText('Đặt hàng NCC')).toBeInTheDocument();
    expect(within(drawer).getByText('1. Tra tồn')).toBeInTheDocument();
    expect(within(drawer).getByText('chờ duyệt')).toBeInTheDocument();
    // Link mở thẳng phiếu đang chờ.
    expect(within(drawer).getByRole('link', { name: 'Xem phiếu duyệt' })).toHaveAttribute(
      'href',
      expect.stringContaining('/dashboard/agent/approvals?id=')
    );
    // Dòng thời gian (tab Các bước) theo seq.
    await userEvent.click(within(drawer).getByRole('tab', { name: /Các bước/ }));
    const s1 = within(drawer).getByText('Lập kế hoạch 2 bước');
    const s2 = within(drawer).getByText('Gọi tạo phiếu nhập');
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(drawer).getByText('Lỗi')).toBeInTheDocument();

    await userEvent.click(within(drawer).getByText('Xem chi tiết'));
    expect(within(drawer).getByText('{"supplierId":"x"}')).toBeInTheDocument();

    expect(within(drawer).queryByRole('button', { name: 'Chạy lại' })).toBeNull();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Dừng' }));
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ id: 'w' }));
  });
});

describe('bảng việc — chế độ và cột Xong', () => {
  it('"Đang phải làm" ẩn cột Xong; "Tất cả" chỉ hiện việc xong hôm nay + link xem việc cũ', async () => {
    const onShowList = vi.fn();
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const tasks = [
      task({
        id: 'd1',
        title: 'Xong hôm nay',
        status: 'done',
        finishedAt: new Date().toISOString(),
      }),
      task({
        id: 'd0',
        title: 'Xong hôm kia',
        status: 'done',
        finishedAt: yesterday,
        createdAt: yesterday,
      }),
      task({ id: 'w', title: 'Chờ duyệt bài', status: 'waiting_approval' }),
    ];
    const props = {
      tasks,
      loading: false,
      selectedTaskId: null,
      onOpen: vi.fn(),
      onStop: vi.fn(),
      onRetry: vi.fn(),
      onCancel: vi.fn(),
      onShowList,
    };
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <AgentBoard {...props} mode="active" />
      </ThemeProvider>
    );
    expect(screen.queryByTestId('agent-column-done')).not.toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt bài')).toBeInTheDocument();
    // Cột gộp → thẻ ghi rõ trạng thái.
    expect(
      within(screen.getByTestId('agent-column-waiting')).getByText('Chờ duyệt')
    ).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <AgentBoard {...props} mode="all" />
      </ThemeProvider>
    );
    const done = screen.getByTestId('agent-column-done');
    expect(within(done).getByText('Xong hôm nay')).toBeInTheDocument();
    expect(within(done).queryByText('Xong hôm kia')).not.toBeInTheDocument();
    await userEvent.click(within(done).getByText(/Xem 1 việc xong trước đó/));
    expect(onShowList).toHaveBeenCalledWith('done');
  });
});

describe('A2 — việc chờ việc con', () => {
  const parent = task({
    id: 'p',
    title: 'CEO gom báo cáo tuần',
    status: 'waiting_children',
    source: 'chat',
    startedAt: '2026-11-18T00:00:00Z',
    childrenTotal: 3,
    childrenDone: 1,
  });

  it('thẻ nằm cột Đang chạy, nhãn "Chờ 1/3 việc con", nguồn "Nhóm quản trị", có nút Dừng', async () => {
    const onStop = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <AgentBoard
          tasks={[parent]}
          mode="all"
          loading={false}
          selectedTaskId={null}
          onOpen={vi.fn()}
          onStop={onStop}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
          onShowList={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Chờ 1/3 việc con')).toBeInTheDocument();
    expect(screen.getByLabelText('Nguồn: Nhóm quản trị')).toBeInTheDocument();
    // Cột Đang chạy chứa thẻ.
    const runningColumn = screen
      .getByText('CEO gom báo cáo tuần')
      .closest('[data-rfd-droppable-id]');
    expect(runningColumn?.getAttribute('data-rfd-droppable-id')).toBe('running');
    await userEvent.click(screen.getByRole('button', { name: 'Dừng' }));
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' }));
  });

  it('chi tiết: trạng thái "Chờ việc con", có Dừng, không Chạy lại / Huỷ', () => {
    detail.value = { task: parent, steps: [] };
    render(
      <ThemeProvider theme={theme}>
        <AgentTaskDrawer
          taskId="p"
          fallbackTask={null}
          poll={false}
          onClose={vi.fn()}
          onStop={vi.fn()}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
          onNoteSent={vi.fn()}
        />
      </ThemeProvider>
    );

    const drawer = screen.getByRole('presentation');
    expect(within(drawer).getByText('Chờ việc con')).toBeInTheDocument();
    expect(within(drawer).getByText(/Chờ 1\/3 việc con/)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Dừng' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Chạy lại' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: /Huỷ/ })).toBeNull();
  });
});
