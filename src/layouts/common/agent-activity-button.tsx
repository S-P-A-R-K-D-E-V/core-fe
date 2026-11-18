'use client';

import { useMemo } from 'react';

import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useAgentCenterSummary, type IAgentCenterSummary } from 'src/api/agent-center';

import Iconify from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

import type { NavTree } from '../dashboard/nav/nav-types';

// ----------------------------------------------------------------------
// Nút trên header: đội agent đang làm gì (số việc đang chạy + chờ chạy; chấm cam khi có việc chờ người trả lời).
// Cùng khuôn với AgentApprovalsButton: chỉ hỏi máy chủ khi có quyền agent.approve và không phải máy quầy; chỉ hiện khi
// có việc. Hỏi lại `GET agent-center/summary` mỗi 15 giây khi có việc đang chạy / chờ chạy, không thì 60 giây; tab ẩn
// thì SWR tự dừng. Không mở thêm kết nối hub — trang Trung tâm Agent có hub thì ghi thẳng vào cùng khoá SWR này.
// ----------------------------------------------------------------------

export const AGENT_ACTIVITY_FAST_MS = 15_000;
export const AGENT_ACTIVITY_SLOW_MS = 60_000;

export function agentActivityCounts(summary: IAgentCenterSummary | undefined) {
  const c = summary?.counts;
  const running = c?.running ?? 0;
  const queued = c?.queued ?? 0;
  const waitingHuman = c?.waiting_human ?? 0;
  return { running, queued, waitingHuman, active: running + queued };
}

/** 15 giây khi còn việc đang chạy / chờ chạy, không thì 60 giây. */
export function agentActivityRefreshMs(summary: IAgentCenterSummary | undefined): number {
  return agentActivityCounts(summary).active > 0 ? AGENT_ACTIVITY_FAST_MS : AGENT_ACTIVITY_SLOW_MS;
}

export function agentActivityTooltip(active: number, waitingHuman: number): string {
  return `Agent đang chạy: ${active} · Chờ người: ${waitingHuman}`;
}

export default function AgentActivityButton({ tree }: { tree: NavTree }) {
  const { user } = useAuthContext();
  const allowed = !!user && !tree.counter && hasPermission(user, PERMISSIONS.agent.approve);
  const { summary } = useAgentCenterSummary(false, {
    enabled: allowed,
    refreshInterval: agentActivityRefreshMs,
    quiet: true,
  });
  const { active, waitingHuman } = useMemo(() => agentActivityCounts(summary), [summary]);

  if (!allowed || (active <= 0 && waitingHuman <= 0)) return null;

  const title = agentActivityTooltip(active, waitingHuman);
  return (
    <Tooltip title={title}>
      <IconButton component={RouterLink} href={paths.dashboard.agent.center} aria-label={title}>
        <Badge badgeContent={active} color="info" max={99}>
          <Badge
            variant="dot"
            color="warning"
            invisible={waitingHuman <= 0}
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            slotProps={{ badge: { 'data-testid': 'agent-waiting-human-dot' } as any }}
          >
            <Iconify icon="mdi:robot" width={24} />
          </Badge>
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
