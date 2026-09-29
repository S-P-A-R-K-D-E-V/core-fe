'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';

import {
  disconnectKiotViet,
  type IKiotVietConnection,
  getKiotVietConnection,
  saveKiotVietConnection,
} from 'src/api/store-settings';

// ----------------------------------------------------------------------

export default function KiotVietConnectionTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<IKiotVietConnection | null>(null);
  const [form, setForm] = useState({ retailer: '', clientId: '', clientSecret: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(() => {
    getKiotVietConnection()
      .then((data) => {
        setStatus(data);
        setForm((f) => ({ ...f, retailer: data.retailer ?? '', clientId: data.clientId ?? '' }));
      })
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được trạng thái KiotViet'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const isSystem = status?.source === 'system';

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveKiotVietConnection(form);
      setStatus(res.connection);
      setForm((f) => ({ ...f, clientSecret: '' }));
      enqueueSnackbar(`Đã kết nối KiotViet (${res.branchCount} chi nhánh)`);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Kết nối KiotViet thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setConfirmDisconnect(false);
    try {
      await disconnectKiotViet();
      enqueueSnackbar('Đã ngắt kết nối KiotViet');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Ngắt kết nối thất bại'), { variant: 'error' });
    }
  };

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Trạng thái</Typography>
            {status && (
              <Label color={status.connected ? 'success' : 'default'}>
                {status.connected ? 'Đã kết nối' : 'Chưa kết nối'}
              </Label>
            )}
            {status?.connected && (
              <Label color={status.webhookReady ? 'info' : 'warning'}>
                {status.webhookReady ? 'Webhook sẵn sàng' : 'Chưa có webhook'}
              </Label>
            )}
          </Stack>

          {status?.connected && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Cửa hàng KiotViet: <b>{status.retailer}</b>
              {status.lastVerifiedAt && ` · kiểm tra lần cuối ${fDateTime(status.lastVerifiedAt)}`}
            </Typography>
          )}

          {!!status?.lastError && <Alert severity="warning">{status.lastError}</Alert>}

          {isSystem && (
            <Alert severity="info">
              Cửa hàng này dùng tài khoản KiotViet cấu hình trong hệ thống. Liên hệ quản trị hệ thống để thay đổi.
            </Alert>
          )}
        </Stack>
      </Card>

      {!isSystem && (
        <Card sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6">{status?.connected ? 'Đổi tài khoản KiotViet' : 'Kết nối KiotViet'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Lấy Client ID và Client Secret trong KiotViet: Thiết lập → Thiết lập cửa hàng → Thiết lập kết
                nối API. Hệ thống thử đăng nhập trước, chỉ lưu khi thành công; Client Secret được mã hoá và không
                hiển thị lại.
              </Typography>
            </Stack>

            <TextField
              label="Tên đăng nhập cửa hàng (retailer)"
              placeholder="vd: tiemtocabc"
              value={form.retailer}
              onChange={(e) => setForm((f) => ({ ...f, retailer: e.target.value.trim() }))}
            />
            <TextField
              label="Client ID"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value.trim() }))}
            />
            <TextField
              label="Client Secret"
              type="password"
              autoComplete="new-password"
              value={form.clientSecret}
              onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
            />

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              {status?.connected && (
                <Button color="error" onClick={() => setConfirmDisconnect(true)}>
                  Ngắt kết nối
                </Button>
              )}
              <LoadingButton
                variant="contained"
                loading={saving}
                disabled={!form.retailer || !form.clientId || !form.clientSecret}
                onClick={handleSave}
              >
                Kiểm tra &amp; lưu
              </LoadingButton>
            </Stack>
          </Stack>
        </Card>
      )}

      <Dialog open={confirmDisconnect} onClose={() => setConfirmDisconnect(false)}>
        <DialogTitle>Ngắt kết nối KiotViet?</DialogTitle>
        <DialogContent>
          Đồng bộ đơn hàng, hàng hoá và khách hàng từ KiotViet sẽ dừng. Dữ liệu đã đồng bộ vẫn được giữ.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisconnect(false)}>Huỷ</Button>
          <Button color="error" variant="contained" onClick={handleDisconnect}>
            Ngắt kết nối
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
