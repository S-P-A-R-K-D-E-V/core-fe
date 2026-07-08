'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { fDateTime } from 'src/utils/format-time';

import {
  registerWebhook,
  getWebhooks,
  deleteWebhook,
  getWebhookLogs,
} from 'src/api/kiotviet';

import type { IKiotVietWebhook, IKiotVietWebhookLog } from 'src/types/corecms-api';

export default function KiotVietWebhookTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [webhooks, setWebhooks] = useState<IKiotVietWebhook[]>([]);
  const [logs, setLogs] = useState<IKiotVietWebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [customEvents, setCustomEvents] = useState('');

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
        <Typography variant="h6" sx={{ mb: 2 }}>Log webhook gần đây</Typography>

        {!loading && logs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chưa nhận webhook nào
          </Typography>
        )}

        <Stack divider={<Divider flexItem />}>
          {logs.map((log) => (
            <Stack key={log.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }}>
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
            </Stack>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
