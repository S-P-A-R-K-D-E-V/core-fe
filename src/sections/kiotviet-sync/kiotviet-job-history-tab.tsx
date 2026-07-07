'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { fDateTime } from 'src/utils/format-time';

import { getRecentSyncJobs } from 'src/api/kiotviet';

import type { ISyncJobStatus } from 'src/types/sync-job';

const JOB_TYPE_LABEL: Record<string, string> = {
  SyncAll: 'Đồng bộ toàn bộ',
  SyncInvoices: 'Đồng bộ hóa đơn',
  SyncPurchaseOrders: 'Đồng bộ đơn nhập hàng',
  PushSalesOrder: 'Đẩy đơn bán lên KiotViet',
  Transform: 'Chuyển đổi (deprecated)',
  SyncAndTransform: 'Đồng bộ & Chuyển đổi (deprecated)',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Pending: 'default',
  Running: 'info',
  Completed: 'success',
  Failed: 'error',
};

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}p ${seconds % 60}s`;
}

export default function KiotVietJobHistoryTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [jobs, setJobs] = useState<ISyncJobStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecentSyncJobs();
      setJobs(data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không tải được lịch sử đồng bộ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Lịch sử đồng bộ</Typography>
          <Typography variant="body2" color="text.secondary">
            50 job gần nhất (thủ công + tự động theo lịch + webhook)
          </Typography>
        </Box>
        <Tooltip title="Làm mới">
          <IconButton onClick={fetchJobs}>
            <Iconify icon="solar:refresh-bold" />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading && (
        <Stack spacing={1}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Stack>
      )}

      {!loading && jobs.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          Chưa có job đồng bộ nào
        </Typography>
      )}

      {!loading && jobs.length > 0 && (
        <Stack divider={<Divider flexItem />}>
          {jobs.map((job) => (
            <Stack
              key={job.jobId}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ py: 1.25 }}
            >
              <Label variant="soft" color={STATUS_COLOR[job.status] || 'default'} sx={{ minWidth: 90 }}>
                {job.status}
              </Label>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {JOB_TYPE_LABEL[job.type] || job.type}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fDateTime(job.createdAt)}
                  {job.startedAt && ` · ${formatDuration(job.startedAt, job.completedAt)}`}
                </Typography>
                {job.error && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block' }} noWrap>
                    {job.error}
                  </Typography>
                )}
              </Box>
              {job.steps?.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {job.steps.length} bước
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  );
}
