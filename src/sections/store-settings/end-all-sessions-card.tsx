'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { endAllStoreSessions, type IEndAllSessionsResult } from 'src/api/store-settings';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Đăng xuất mọi người của cửa hàng (POST /admin/security/end-all-sessions): đóng mọi phiên đăng nhập và xoá refresh
// token của mọi thành viên, trừ người bấm. Dùng sau sự cố lộ dữ liệu tài khoản — mọi app, web, máy quầy phải đăng nhập lại.

export function EndAllSessionsCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IEndAllSessionsResult | null>(null);

  const handleClick = async () => {
    const ok = await confirm({
      title: 'Đăng xuất mọi người?',
      content:
        'Mọi nhân viên và quản lý của cửa hàng bị đăng xuất khỏi app, web và máy quầy, phải đăng nhập lại.\n' +
        'Bạn vẫn giữ phiên đăng nhập này.',
      confirmText: 'Đăng xuất mọi người',
      cancelText: 'Huỷ',
      destructive: true,
    });
    if (!ok) return;

    setRunning(true);
    try {
      const ended = await endAllStoreSessions();
      setResult(ended);
      enqueueSnackbar(`Đã đăng xuất ${ended.members} người, đóng ${ended.sessionsEnded} phiên`, {
        variant: 'success',
      });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đăng xuất được'), { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Đăng xuất mọi người"
        subheader="Dùng khi nghi lộ mật khẩu hoặc phiên đăng nhập: mọi thiết bị của nhân viên phải đăng nhập lại."
        action={
          <LoadingButton
            color="error"
            variant="outlined"
            loading={running}
            onClick={handleClick}
            startIcon={<Iconify icon="solar:logout-2-bold" />}
          >
            Đăng xuất mọi người
          </LoadingButton>
        }
      />
      {result && (
        <CardContent>
          <Alert severity="success">
            Đã đăng xuất {result.members} người: đóng {result.sessionsEnded} phiên, xoá{' '}
            {result.refreshTokensCleared} mã làm mới đăng nhập.
          </Alert>
        </CardContent>
      )}
      {confirmDialog}
    </Card>
  );
}
