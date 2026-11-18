'use client';

import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useAgentPendingCount } from 'src/api/agent-actions';

import Iconify from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

import type { NavTree } from '../dashboard/nav/nav-types';

// ----------------------------------------------------------------------
// Nút trên header: số việc agent đang chờ duyệt (menu không có huy hiệu nên đặt ở đây). Chỉ hỏi máy chủ khi người dùng
// có quyền agent.approve (không hỏi trên máy quầy), hỏi lại mỗi 60 giây; chỉ hiện khi có phiếu đang chờ.
// ----------------------------------------------------------------------

export default function AgentApprovalsButton({ tree }: { tree: NavTree }) {
  const { user } = useAuthContext();
  const allowed = !!user && !tree.counter && hasPermission(user, PERMISSIONS.agent.approve);
  const { count } = useAgentPendingCount(allowed);

  if (!allowed || count <= 0) return null;

  const title = `${count} việc agent chờ duyệt`;
  return (
    <Tooltip title={title}>
      <IconButton component={RouterLink} href={paths.dashboard.agent.approvals} aria-label={title}>
        <Badge badgeContent={count} color="warning" max={99}>
          <Iconify icon="solar:cpu-bolt-bold-duotone" width={24} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
