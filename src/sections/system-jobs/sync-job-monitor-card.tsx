'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime, fToNow } from 'src/utils/format-time';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

import {
  retrySyncJob,
  cancelSyncJob,
  getSyncJobMonitor,
  forceCancelSyncJob,
  type SyncJobScope,
} from 'src/api/system-jobs';

import type { ISyncJobControlEvent, ISyncJobMonitorItem } from 'src/types/sync-job';

// ----------------------------------------------------------------------
// Tiến trình KiotViet đang chạy và gần đây: huỷ, buộc dừng, chạy lại. Được làm gì và có tác dụng thế nào do core-be quyết
// (item.control) — màn này chỉ hiện đúng các nút và câu giải thích đó, không tự suy luận.
//   scope = 'allStores': Admin CiCi, mọi cửa hàng (hàng đợi dùng chung, job treo của 1 cửa hàng chặn tất cả).
//   scope = 'ownStore' : Admin từng cửa hàng, chỉ job của cửa hàng mình.
// ----------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;

const JOB_TYPE_LABEL: Record<string, string> = {
  SyncAll: 'Đồng bộ toàn bộ',
  SyncSelected: 'Đồng bộ theo phạm vi chọn',
  SyncInvoices: 'Đồng bộ hóa đơn',
  SyncPurchaseOrders: 'Đồng bộ đơn nhập hàng',
  SyncBranchesOnly: 'Đồng bộ chi nhánh',
  SyncCategoriesOnly: 'Đồng bộ nhóm hàng',
  SyncCustomersOnly: 'Đồng bộ khách hàng',
  SyncProductsOnly: 'Đồng bộ sản phẩm + tồn kho',
  SyncPriceBooksOnly: 'Đồng bộ bảng giá',
  SyncOrdersOnly: 'Đồng bộ đặt hàng',
  PushSalesOrder: 'Đẩy đơn bán lên KiotViet',
  PushStockAdjustment: 'Đẩy chỉnh tồn lên KiotViet',
  Transform: 'Chuyển đổi (cũ)',
  SyncAndTransform: 'Đồng bộ & chuyển đổi (cũ)',
};

const STATUS_LABEL: Record<string, string> = {
  Pending: 'Chờ trong hàng',
  Running: 'Đang chạy',
  Completed: 'Hoàn thành',
  Failed: 'Lỗi',
  Cancelled: 'Đã huỷ',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  Pending: 'default',
  Running: 'info',
  Completed: 'success',
  Failed: 'error',
  Cancelled: 'warning',
};

const EVENT_LABEL: Record<string, string> = {
  Cancel: 'Yêu cầu huỷ',
  ForceCancel: 'Buộc dừng',
  Retry: 'Chạy lại',
  RetryStep: 'Thử lại bước',
  StoppedAtCheckpoint: 'Job dừng ở điểm an toàn',
  Detached: 'Worker bỏ đợi job',
  DetachedTaskEnded: 'Tác vụ cũ đã thoát',
};

const jobLabel = (job: ISyncJobMonitorItem) => JOB_TYPE_LABEL[job.type] || job.type;

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const seconds = Math.max(0, Math.round(((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} phút ${seconds % 60} giây` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

function describeEvent(event: ISyncJobControlEvent) {
  const who = event.actorName ? ` · ${event.actorName}` : '';
  return `${EVENT_LABEL[event.action] || event.action}${who} · ${fDateTime(event.at)}`;
}

type Props = {
  scope: SyncJobScope;
};

export default function SyncJobMonitorCard({ scope }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();

  const [jobs, setJobs] = useState<ISyncJobMonitorItem[]>([]);
  const [failedStores, setFailedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await getSyncJobMonitor(scope);
        setJobs(data.jobs);
        setFailedStores(data.failedStores);
      } catch (error: any) {
        enqueueSnackbar(error?.response?.data?.message || error?.message || 'Không tải được danh sách tiến trình', {
          variant: 'error',
        });
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [enqueueSnackbar, scope]
  );

  useEffect(() => {
    fetchJobs(true);
    const interval = setInterval(() => fetchJobs(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const runAction = useCallback(
    async (job: ISyncJobMonitorItem, action: () => Promise<{ message: string }>) => {
      setBusyJobId(job.jobId);
      try {
        const result = await action();
        enqueueSnackbar(result.message, { variant: 'info' });
      } catch (error: any) {
        enqueueSnackbar(error?.response?.data?.message || error?.message || 'Không thực hiện được thao tác', {
          variant: 'error',
        });
      } finally {
        setBusyJobId(null);
        await fetchJobs(false);
      }
    },
    [enqueueSnackbar, fetchJobs]
  );

  const describeTarget = useCallback(
    (job: ISyncJobMonitorItem) =>
      scope === 'allStores' ? `${jobLabel(job)} (cửa hàng ${job.tenantCode || job.tenantId})` : jobLabel(job),
    [scope]
  );

  const handleCancel = useCallback(
    async (job: ISyncJobMonitorItem) => {
      const ok = await confirm({
        title: 'Huỷ tiến trình?',
        content: `${describeTarget(job)}\n\n${job.control.cancelNote}`,
        confirmText: 'Huỷ tiến trình',
        cancelText: 'Không',
      });
      if (ok) await runAction(job, () => cancelSyncJob(scope, job));
    },
    [confirm, describeTarget, runAction, scope]
  );

  const handleForce = useCallback(
    async (job: ISyncJobMonitorItem) => {
      const ok = await confirm({
        title: 'Buộc dừng tiến trình?',
        content: `${describeTarget(job)}\n\n${job.control.forceNote}\n\nThao tác được ghi lại kèm tên người thực hiện.`,
        confirmText: 'Buộc dừng',
        cancelText: 'Không',
        destructive: true,
      });
      if (ok) await runAction(job, () => forceCancelSyncJob(scope, job));
    },
    [confirm, describeTarget, runAction, scope]
  );

  const handleRetry = useCallback(
    async (job: ISyncJobMonitorItem) => {
      const ok = await confirm({
        title: 'Chạy lại tiến trình?',
        content: `${describeTarget(job)}\n\n${job.control.retryNote}`,
        confirmText: 'Chạy lại',
        cancelText: 'Không',
      });
      if (ok) await runAction(job, () => retrySyncJob(scope, job));
    },
    [confirm, describeTarget, runAction, scope]
  );

  const showStore = scope === 'allStores';
  const colSpan = showStore ? 6 : 5;

  return (
    <Card sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ p: 2.5, pb: 1 }}>
        <Box>
          <Typography variant="h6">Tiến trình đồng bộ KiotViet</Typography>
          <Typography variant="body2" color="text.secondary">
            Đang chạy và gần đây{showStore ? ' của mọi cửa hàng (hàng đợi dùng chung)' : ' của cửa hàng này'}. Tự làm mới
            mỗi 10 giây.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            <strong>Huỷ</strong>: job chưa chạy thì huỷ ngay; đang chạy thì dừng ở điểm an toàn kế tiếp.{' '}
            <strong>Buộc dừng</strong>: cho job treo, chờ tối đa 60 giây rồi worker bỏ đợi và chạy job kế tiếp, không ảnh
            hưởng job khác. <strong>Chạy lại</strong>: tạo job mới cùng tham số.
          </Typography>
        </Box>
        <Tooltip title="Làm mới">
          <IconButton onClick={() => fetchJobs(true)} aria-label="Làm mới tiến trình">
            <Iconify icon="solar:refresh-bold" />
          </IconButton>
        </Tooltip>
      </Stack>

      {failedStores.length > 0 && (
        <Alert severity="warning" sx={{ mx: 2.5, mb: 1 }}>
          Không đọc được job của: {failedStores.join(', ')}
        </Alert>
      )}

      <TableContainer sx={{ overflow: 'unset' }}>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell width={150}>Trạng thái</TableCell>
                {showStore && <TableCell width={110}>Cửa hàng</TableCell>}
                <TableCell>Tiến trình</TableCell>
                <TableCell width={180}>Thời gian</TableCell>
                <TableCell width={230}>Ai đã thao tác</TableCell>
                <TableCell width={210} align="right">
                  Hành động
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={colSpan}>
                    <Box sx={{ py: 1 }}>
                      <CircularProgress size={16} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {!loading && jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      Chưa có tiến trình nào
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                jobs.map((job) => (
                  <JobRow
                    key={job.jobId}
                    job={job}
                    showStore={showStore}
                    busy={busyJobId === job.jobId}
                    onCancel={handleCancel}
                    onForce={handleForce}
                    onRetry={handleRetry}
                  />
                ))}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      {confirmDialog}
    </Card>
  );
}

// ----------------------------------------------------------------------

type JobRowProps = {
  job: ISyncJobMonitorItem;
  showStore: boolean;
  busy: boolean;
  onCancel: (job: ISyncJobMonitorItem) => void;
  onForce: (job: ISyncJobMonitorItem) => void;
  onRetry: (job: ISyncJobMonitorItem) => void;
};

function JobRow({ job, showStore, busy, onCancel, onForce, onRetry }: JobRowProps) {
  const { control } = job;
  const finished = job.status === 'Completed' || job.status === 'Failed' || job.status === 'Cancelled';
  const stopping = !finished && (job.cancelRequested || job.forceRequested);
  const hasAction = control.canCancel || control.canForce || control.canRetry;
  const duration = formatDuration(job.startedAt, job.completedAt);

  // Không có nút nào: nói rõ vì sao (job đẩy KiotViet, thiếu tham số...). Job đã xong thì không cần.
  let actionNote: string | null = null;
  if (!hasAction && job.status !== 'Completed') {
    actionNote = finished ? control.retryNote : control.cancelNote;
  }

  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.5} alignItems="flex-start">
          <Label variant="soft" color={STATUS_COLOR[job.status] || 'default'}>
            {job.forceStoppedAt ? 'Đã buộc dừng' : STATUS_LABEL[job.status] || job.status}
          </Label>
          {control.suspected && (
            <Tooltip title={control.suspectNote ?? ''}>
              <span>
                <Label variant="soft" color="error">
                  Nghi treo
                </Label>
              </span>
            </Tooltip>
          )}
          {stopping && (
            <Label variant="soft" color="warning">
              {job.forceRequested ? 'Đang buộc dừng' : 'Đang chờ dừng'}
            </Label>
          )}
        </Stack>
      </TableCell>

      {showStore && (
        <TableCell>
          <Typography variant="caption">{job.tenantCode || job.tenantId}</Typography>
        </TableCell>
      )}

      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {jobLabel(job)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {job.stepsTotal > 0 && `${job.stepsDone}/${job.stepsTotal} bước`}
          {job.stepsFailed > 0 && ` · ${job.stepsFailed} bước lỗi`}
          {job.currentStep && ` · ${job.currentStep}`}
        </Typography>
        {control.suspected && control.suspectNote && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
            {control.suspectNote}
          </Typography>
        )}
        {job.error && (
          <Typography variant="caption" color={job.status === 'Failed' ? 'error.main' : 'text.secondary'} sx={{ display: 'block' }}>
            {job.error}
          </Typography>
        )}
        {job.detachedTaskAlive && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
            Tác vụ cũ của job chưa thoát hẳn trong worker (không còn ghi được vào job này). Nếu kéo dài, cần khởi động lại
            worker lúc rảnh.
          </Typography>
        )}
      </TableCell>

      <TableCell>
        <Tooltip title={fDateTime(job.createdAt)}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Tạo {fToNow(job.createdAt)}
          </Typography>
        </Tooltip>
        {duration && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {finished ? `Chạy ${duration}` : `Đã chạy ${duration}`}
          </Typography>
        )}
        {!finished && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Tiến độ mới nhất {fToNow(job.lastProgressAt)}
          </Typography>
        )}
      </TableCell>

      <TableCell>
        {job.controlEvents.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            —
          </Typography>
        ) : (
          job.controlEvents.slice(-3).map((event, index) => (
            <Tooltip key={`${event.action}-${event.at}-${index}`} title={event.note ?? ''}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                {describeEvent(event)}
              </Typography>
            </Tooltip>
          ))
        )}
      </TableCell>

      <TableCell align="right">
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          {control.canCancel && (
            <Tooltip title={control.cancelNote}>
              <span>
                <LoadingButton size="small" variant="outlined" loading={busy} onClick={() => onCancel(job)}>
                  Huỷ
                </LoadingButton>
              </span>
            </Tooltip>
          )}
          {control.canForce && (
            <Tooltip title={control.forceNote}>
              <span>
                <LoadingButton size="small" variant="outlined" color="error" loading={busy} onClick={() => onForce(job)}>
                  Buộc dừng
                </LoadingButton>
              </span>
            </Tooltip>
          )}
          {control.canRetry && (
            <Tooltip title={control.retryNote}>
              <span>
                <LoadingButton size="small" variant="outlined" loading={busy} onClick={() => onRetry(job)}>
                  Chạy lại
                </LoadingButton>
              </span>
            </Tooltip>
          )}
        </Stack>
        {actionNote && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
            {actionNote}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
