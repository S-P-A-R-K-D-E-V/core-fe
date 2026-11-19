'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';

import { useAgentAdminGroup } from 'src/api/agent-center';

import { agentAdminAppLink, agentAdminWebLink, agentAdminLinkState } from './links';

// ----------------------------------------------------------------------
// /m/agent-admin — link trong tin Zalo Bot (A3) mở trang này: nút mở nhóm "Quản trị – Đội agent" trong app hoặc trên web.
// ----------------------------------------------------------------------

export default function AgentAdminLinkView() {
  const router = useRouter();
  const { info, loading, error, refresh } = useAgentAdminGroup(true);
  const state = agentAdminLinkState({ loading, error, info });
  const conversationId = info?.conversationId ?? null;

  const renderBody = () => {
    if (state === 'loading') {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      );
    }

    if (state === 'forbidden') {
      return (
        <Typography variant="body2" color="text.secondary">
          Tài khoản này không có quyền xem nhóm quản trị. Đăng nhập bằng tài khoản chủ cửa hàng /
          người duyệt việc agent.
        </Typography>
      );
    }

    if (state === 'error') {
      return (
        <Stack spacing={2}>
          <Typography variant="body2" color="error">
            Không tải được nhóm quản trị. Thử lại sau giây lát.
          </Typography>
          <Button variant="outlined" size="large" onClick={() => refresh()}>
            Thử lại
          </Button>
        </Stack>
      );
    }

    if (state === 'missing' || !conversationId) {
      return (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Nhóm chưa được tạo.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push(paths.dashboard.agent.center)}
            startIcon={<Iconify icon="solar:widget-5-bold" />}
          >
            Mở Trung tâm Agent
          </Button>
        </Stack>
      );
    }

    return (
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            window.location.href = agentAdminAppLink(conversationId);
          }}
          startIcon={<Iconify icon="solar:smartphone-bold" />}
        >
          Mở trong app
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => router.push(agentAdminWebLink(conversationId))}
          startIcon={<Iconify icon="solar:monitor-bold" />}
        >
          Mở trên web
        </Button>
        <Typography variant="caption" color="text.secondary">
          Mở từ Zalo mà nút &quot;Mở trong app&quot; không chạy: bấm ⋯ → Mở bằng trình duyệt.
        </Typography>
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        bgcolor: 'background.neutral',
      }}
    >
      <Card sx={{ width: 1, maxWidth: 420, p: 3 }}>
        <Stack spacing={2.5}>
          <Stack spacing={1} alignItems="center" textAlign="center">
            <Iconify
              icon="solar:bell-bing-bold-duotone"
              width={44}
              sx={{ color: 'primary.main' }}
            />
            <Typography variant="h5">Nhóm Quản trị – Đội agent</Typography>
            <Typography variant="body2" color="text.secondary">
              Có việc cần anh/chị quyết
            </Typography>
          </Stack>
          {renderBody()}
        </Stack>
      </Card>
    </Box>
  );
}
