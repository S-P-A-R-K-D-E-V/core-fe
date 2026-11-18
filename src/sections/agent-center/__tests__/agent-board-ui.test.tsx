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
    createdAt: '2026-11-18T00:00:00Z',
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
          agents={[]}
          loading={false}
          selectedTaskId={null}
          onOpen={onOpen}
          onStop={onStop}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
          onRefresh={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Bước 2/3 — đang tra tồn kho')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('1,5k')).toBeInTheDocument();
    expect(screen.getByText('Lịch')).toBeInTheDocument();
    expect(screen.getByText('Đã huỷ')).toBeInTheDocument();

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
    // Dòng thời gian theo seq.
    const s1 = within(drawer).getByText('Lập kế hoạch 2 bước');
    const s2 = within(drawer).getByText('Gọi tạo phiếu nhập');
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(drawer).getByText('Lỗi')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Xem phiếu duyệt' })).toHaveAttribute(
      'href',
      '/dashboard/agent/approvals'
    );

    await userEvent.click(within(drawer).getByText('Xem chi tiết'));
    expect(within(drawer).getByText('{"supplierId":"x"}')).toBeInTheDocument();

    expect(within(drawer).queryByRole('button', { name: 'Chạy lại' })).toBeNull();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Dừng' }));
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ id: 'w' }));
  });
});
