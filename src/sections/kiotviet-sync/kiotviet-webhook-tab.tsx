'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';
import LoadingButton from '@mui/lab/LoadingButton';

import { useBoolean } from 'src/hooks/use-boolean';

import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { fDateTime } from 'src/utils/format-time';

import {
  registerWebhook,
  getWebhooks,
  deleteWebhook,
  getWebhookLogs,
  clearWebhookLogs,
  getWebhookLogDetail,
} from 'src/api/kiotviet';

import type { IKiotVietWebhook, IKiotVietWebhookLog, IKiotVietWebhookLogDetail } from 'src/types/corecms-api';

export default function KiotVietWebhookTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [webhooks, setWebhooks] = useState<IKiotVietWebhook[]>([]);
  const [logs, setLogs] = useState<IKiotVietWebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [customEvents, setCustomEvents] = useState('');
  const clearConfirm = useBoolean();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IKiotVietWebhookLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [webhookList, logPage] = await Promise.all([
        getWebhooks().catch(() => []),
        getWebhookLogs(),
      ]);
      setWebhooks(webhookList);
      setLogs(logPage.data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không tải được dữ liệu webhook', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRegister = useCallback(async () => {
    setRegistering(true);
    try {
      const events = customEvents
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      const result = await registerWebhook(events.length ? events : undefined);
      if (result.registered.length > 0) {
        enqueueSnackbar(`Đã đăng ký ${result.registered.length} webhook KiotViet`, { variant: 'success' });
      }
      if (result.failed.length > 0) {
        enqueueSnackbar(
          `${result.failed.length} loại thất bại: ${result.failed.map((f) => `${f.type} (${f.message})`).join('; ')}`,
          { variant: 'warning' }
        );
      }
      fetchAll();
    } catch (error: any) {
      enqueueSnackbar(
        error?.message || 'Đăng ký thất bại — kiểm tra cấu hình WebhookSecret/WebhookCallbackBaseUrl',
        { variant: 'error' }
      );
    } finally {
      setRegistering(false);
    }
  }, [enqueueSnackbar, fetchAll]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteWebhook(id);
        enqueueSnackbar('Đã xoá webhook', { variant: 'success' });
        fetchAll();
      } catch (error: any) {
        enqueueSnackbar(error?.message || 'Không xoá được webhook', { variant: 'error' });
      }
    },
    [enqueueSnackbar, fetchAll]
  );

  const handleClearLogs = useCallback(async () => {
    setClearing(true);
    try {
      const { deletedCount } = await clearWebhookLogs();
      enqueueSnackbar(`Đã xoá ${deletedCount} log webhook`, { variant: 'success' });
      clearConfirm.onFalse();
      fetchAll();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không xoá được log webhook', { variant: 'error' });
    } finally {
      setClearing(false);
    }
  }, [enqueueSnackbar, fetchAll, clearConfirm]);

  const handleOpenDetail = useCallback(
    async (id: string) => {
      setDetailId(id);
      setDetail(null);
      setDetailLoading(true);
      try {
        const data = await getWebhookLogDetail(id);
        setDetail(data);
      } catch (error: any) {
        enqueueSnackbar(error?.message || 'Không tải được chi tiết webhook', { variant: 'error' });
        setDetailId(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [enqueueSnackbar]
  );

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Webhook KiotViet</Typography>
            <Typography variant="body2" color="text.secondary">
              Nhận thông báo thay đổi từ KiotViet gần như tức thời, bổ sung cho lịch đồng bộ tự động
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }} sx={{ mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            label="Danh sách Type tuỳ chỉnh (phân cách bởi dấu phẩy)"
            placeholder="Bỏ trống → dùng danh sách mặc định (secret KiotViet:WebhookEvents nếu có, hoặc compiled default)"
            value={customEvents}
            onChange={(e) => setCustomEvents(e.target.value)}
            helperText="Dùng để thử nhanh Type mới (vd order.update,invoice.create) mà không cần đổi cấu hình"
          />
          <LoadingButton
            variant="contained"
            loading={registering}
            startIcon={<Iconify icon="mdi:webhook" />}
            onClick={handleRegister}
            sx={{ minWidth: 160, flexShrink: 0 }}
          >
            Đăng ký webhook
          </LoadingButton>
        </Stack>

        {!loading && webhooks.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chưa có webhook nào được đăng ký
          </Typography>
        )}

        <Stack divider={<Divider flexItem />}>
          {webhooks.map((w) => (
            <Stack key={w.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }}>
              <Label variant="soft" color={w.isActive ? 'success' : 'default'} sx={{ minWidth: 80 }}>
                {w.isActive ? 'Hoạt động' : 'Tắt'}
              </Label>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {w.type || 'all'}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {w.url}
                </Typography>
              </Box>
              <Tooltip title="Xoá webhook">
                <IconButton size="small" color="error" onClick={() => handleDelete(w.id)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      </Card>

      <Card sx={{ p: 3 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>Log webhook gần đây</Typography>
            <Typography variant="body2" color="text.secondary">
              Bấm vào 1 dòng để xem đầy đủ header/query/body — dùng để trace lỗi kết nối lúc mới tích hợp
            </Typography>
          </Box>
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={clearConfirm.onTrue}
            disabled={logs.length === 0}
            sx={{ flexShrink: 0 }}
          >
            Xoá log
          </Button>
        </Stack>

        {!loading && logs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chưa nhận webhook nào
          </Typography>
        )}

        <Stack divider={<Divider flexItem />}>
          {logs.map((log) => (
            <Stack
              key={log.id}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ py: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => handleOpenDetail(log.id)}
            >
              <Label variant="soft" color={log.processed ? 'success' : 'error'} sx={{ minWidth: 90 }}>
                {log.processed ? 'Đã xử lý' : 'Lỗi'}
              </Label>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {log.event || '(không xác định action)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fDateTime(log.receivedAt)}
                </Typography>
                {log.error && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block' }} noWrap>
                    {log.error}
                  </Typography>
                )}
              </Box>
              <Iconify icon="eva:arrow-ios-forward-fill" sx={{ color: 'text.disabled' }} />
            </Stack>
          ))}
        </Stack>
      </Card>

      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết webhook</DialogTitle>
        <DialogContent dividers>
          {detailLoading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          )}

          {!detailLoading && detail && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={3} flexWrap="wrap" rowGap={1}>
                <DetailField label="Thời gian" value={fDateTime(detail.receivedAt)} />
                <DetailField label="Method" value={detail.method} />
                <DetailField label="Path" value={detail.path} mono />
                <DetailField label="IP nguồn" value={detail.remoteIp || '—'} />
                <DetailField label="Action" value={detail.event || '—'} />
                <DetailField
                  label="Trạng thái"
                  value={detail.processed ? 'Đã xử lý' : 'Lỗi'}
                  color={detail.processed ? 'success.main' : 'error.main'}
                />
                <DetailField label="Job đồng bộ" value={detail.enqueuedJobId || 'Không có (xử lý trực tiếp)'} mono={!!detail.enqueuedJobId} />
              </Stack>

              {detail.error && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Lỗi</Typography>
                  <Typography variant="body2" color="error.main">{detail.error}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Headers ({Object.keys(detail.headers).length})
                </Typography>
                <RawBox>
                  {Object.entries(detail.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </RawBox>
              </Box>

              {Object.keys(detail.queryParams).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Query params</Typography>
                  <RawBox>
                    {Object.entries(detail.queryParams).map(([k, v]) => `${k}=${v}`).join('\n')}
                  </RawBox>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>Raw body</Typography>
                <RawBox>{detail.rawBody}</RawBox>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearConfirm.value}
        onClose={clearConfirm.onFalse}
        title="Xoá toàn bộ log webhook?"
        content={`Sẽ xoá ${logs.length >= 20 ? 'toàn bộ' : logs.length} log webhook đã lưu trong MongoDB — không thể hoàn tác. Chỉ nên dùng để dọn log rác/nhiễu lúc mới tích hợp.`}
        action={
          <LoadingButton variant="contained" color="error" loading={clearing} onClick={handleClearLogs}>
            Xoá
          </LoadingButton>
        }
      />
    </Stack>
  );
}

function DetailField({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: mono ? 'monospace' : undefined, color: color || 'text.primary' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function RawBox({ children }: { children: string }) {
  return (
    <Scrollbar sx={{ maxHeight: 240 }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100'),
          borderRadius: 1,
          fontSize: 12,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {children || '(rỗng)'}
      </Box>
    </Scrollbar>
  );
}
