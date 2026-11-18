import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Nút "đội agent đang làm" trên header: chỉ người có quyền agent.approve, không phải máy quầy, và chỉ khi có việc
// đang chạy / chờ chạy / chờ người. Số trên huy hiệu = đang chạy + chờ chạy; chấm cam khi có việc chờ người.
// ----------------------------------------------------------------------

const auth = vi.hoisted(() => ({ user: null as any }));
const summaryState = vi.hoisted(() => ({ summary: undefined as any, calls: [] as any[] }));

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: auth.user }),
}));

vi.mock('src/api/agent-center', () => ({
  useAgentCenterSummary: (poll: boolean, options: any) => {
    summaryState.calls.push({ poll, options });
    return { summary: options?.enabled === false ? undefined : summaryState.summary };
  },
}));

vi.mock('src/routes/components', () => ({
  RouterLink: forwardRef<HTMLAnchorElement, any>(({ href, ...props }, ref) => (
    <a ref={ref} href={href} {...props} />
  )),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mocks above so the button picks up the mocked modules.
import AgentActivityButton, {
  AGENT_ACTIVITY_FAST_MS,
  AGENT_ACTIVITY_SLOW_MS,
  agentActivityRefreshMs,
} from '../agent-activity-button';

const owner = { id: 'u1', roles: ['Admin'] };
const approver = { id: 'u2', roles: ['Staff'], permissions: ['agent.approve'] };
const staff = { id: 'u3', roles: ['Staff'], permissions: ['orders.read'] };

const summary = (counts: Partial<{ running: number; queued: number; waiting_human: number }>) => ({
  paused: false,
  runnerEnabled: true,
  agents: 3,
  counts: {
    running: 0,
    queued: 0,
    waiting_approval: 0,
    waiting_human: 0,
    done_today: 0,
    failed_today: 0,
    ...counts,
  },
});

const show = (counter = false) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <AgentActivityButton tree={{ counter } as any} />
    </ThemeProvider>
  );

const button = () => screen.queryByRole('link', { name: /Agent đang chạy/ });

afterEach(() => {
  auth.user = null;
  summaryState.summary = undefined;
  summaryState.calls = [];
});

describe('AgentActivityButton', () => {
  it('có việc: số = đang chạy + chờ chạy, tooltip ghi rõ, bấm mở Trung tâm Agent', async () => {
    auth.user = approver;
    summaryState.summary = summary({ running: 2, queued: 3, waiting_human: 1 });
    show();

    const link = button();
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', '/dashboard/agent/center');
    expect(link).toHaveAttribute('aria-label', 'Agent đang chạy: 5 · Chờ người: 1');
    expect(screen.getByText('5')).toBeInTheDocument();

    await userEvent.setup().hover(link!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Agent đang chạy: 5 · Chờ người: 1'
    );
  });

  it('có việc chờ người → hiện chấm cam; không có → ẩn chấm', () => {
    auth.user = owner;
    summaryState.summary = summary({ running: 1, waiting_human: 2 });
    const { unmount } = show();
    expect(screen.getByTestId('agent-waiting-human-dot')).not.toHaveClass('MuiBadge-invisible');
    unmount();

    summaryState.summary = summary({ running: 1 });
    show();
    expect(screen.getByTestId('agent-waiting-human-dot')).toHaveClass('MuiBadge-invisible');
  });

  it('chỉ có việc chờ người (không việc nào chạy) → vẫn hiện, huy hiệu số ẩn', () => {
    auth.user = approver;
    summaryState.summary = summary({ waiting_human: 1 });
    show();

    expect(button()).toHaveAttribute('aria-label', 'Agent đang chạy: 0 · Chờ người: 1');
    expect(screen.queryByText('0')).toBeNull();
  });

  it('không có việc nào → không hiện', () => {
    auth.user = owner;
    summaryState.summary = summary({ waiting_approval: 4 } as any);
    show();
    expect(button()).toBeNull();
  });

  it('chưa tải được tóm tắt → không hiện', () => {
    auth.user = owner;
    show();
    expect(button()).toBeNull();
  });

  it('không có quyền agent.approve → không hiện và không hỏi máy chủ', () => {
    auth.user = staff;
    summaryState.summary = summary({ running: 2 });
    show();

    expect(button()).toBeNull();
    expect(summaryState.calls.every((c) => c.options.enabled === false)).toBe(true);
  });

  it('chưa đăng nhập → không hiện và không hỏi máy chủ', () => {
    summaryState.summary = summary({ running: 2 });
    show();

    expect(button()).toBeNull();
    expect(summaryState.calls.every((c) => c.options.enabled === false)).toBe(true);
  });

  it('máy quầy → không hiện và không hỏi máy chủ', () => {
    auth.user = owner;
    summaryState.summary = summary({ running: 2 });
    show(true);

    expect(button()).toBeNull();
    expect(summaryState.calls.every((c) => c.options.enabled === false)).toBe(true);
  });

  it('chu kỳ hỏi lại: 15 giây khi có việc chạy / chờ chạy, không thì 60 giây', () => {
    auth.user = owner;
    summaryState.summary = summary({ running: 1 });
    show();
    expect(summaryState.calls.at(-1).options.refreshInterval).toBe(agentActivityRefreshMs);

    expect(agentActivityRefreshMs(summary({ running: 1 }) as any)).toBe(AGENT_ACTIVITY_FAST_MS);
    expect(agentActivityRefreshMs(summary({ queued: 2 }) as any)).toBe(AGENT_ACTIVITY_FAST_MS);
    expect(agentActivityRefreshMs(summary({ waiting_human: 3 }) as any)).toBe(
      AGENT_ACTIVITY_SLOW_MS
    );
    expect(agentActivityRefreshMs(undefined)).toBe(AGENT_ACTIVITY_SLOW_MS);
  });
});
