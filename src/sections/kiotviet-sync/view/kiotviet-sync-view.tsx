'use client';

import { useState, useEffect, useContext, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import LoadingButton from '@mui/lab/LoadingButton';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';
import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { RoleBasedGuard } from 'src/auth/guard';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';

import { SyncNotificationContext } from 'src/hooks/use-sync-notification';

import type { ISyncJobStatus } from 'src/types/sync-job';

import axios, { endpoints } from 'src/utils/axios';

// Job types that belong to the "sync" card
const SYNC_TYPES = new Set(['SyncAll', 'SyncInvoices', 'SyncPurchaseOrders', 'SyncAndTransform']);
// Job types that belong to the "transform" card
const TRANSFORM_TYPES = new Set(['Transform', 'SyncAndTransform']);

// ----------------------------------------------------------------------

export default function KiotVietSyncView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { startSync, subscribeToJob, onJobUpdate } = useContext(SyncNotificationContext);

  const [syncLoading, setSyncLoading] = useState(false);
  const [transformLoading, setTransformLoading] = useState(false);

  // Khoảng thời gian lấy dữ liệu giao dịch (Order/Return/SalesOrder). Mặc định 01/01/2026 → hiện tại.
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState('');

  const [syncJob, setSyncJob] = useState<ISyncJobStatus | null>(null);
  const [transformJob, setTransformJob] = useState<ISyncJobStatus | null>(null);

  // Listen to SignalR real-time updates
  useEffect(() => {
    const unsubscribe = onJobUpdate((status: ISyncJobStatus) => {
      if (SYNC_TYPES.has(status.type)) {
        setSyncJob(status);
      }
      if (TRANSFORM_TYPES.has(status.type)) {
        setTransformJob(status);
      }
    });
    return unsubscribe;
  }, [onJobUpdate]);

  // Show snackbar when job finishes
  useEffect(() => {
    if (syncJob?.status === 'Completed') {
      enqueueSnackbar('Đồng bộ hoàn thành!', { variant: 'success' });
    } else if (syncJob?.status === 'Failed') {
      enqueueSnackbar(syncJob.error || 'Đồng bộ thất bại', { variant: 'error' });
    }
  }, [syncJob?.status, syncJob?.error, enqueueSnackbar]);

  useEffect(() => {
    if (transformJob?.status === 'Completed') {
      enqueueSnackbar('Chuyển đổi hoàn thành!', { variant: 'success' });
    } else if (transformJob?.status === 'Failed') {
      enqueueSnackbar(transformJob.error || 'Chuyển đổi thất bại', { variant: 'error' });
    }
  }, [transformJob?.status, transformJob?.error, enqueueSnackbar]);

  // Check running jobs on mount and subscribe via SignalR
  useEffect(() => {
    const checkRunning = async () => {
      try {
        const { data } = await axios.get(endpoints.kiotViet.syncRunning);
        if (data.sync) {
          setSyncJob(data.sync);
          subscribeToJob(data.sync.jobId);
        }
        if (data.transform) {
          setTransformJob(data.transform);
          subscribeToJob(data.transform.jobId);
        }
        if (data.syncAndTransform) {
          setSyncJob(data.syncAndTransform);
          setTransformJob(data.syncAndTransform);
          subscribeToJob(data.syncAndTransform.jobId);
        }
      } catch (error) {
        // Ignore — user may not be admin
      }
    };
    checkRunning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      enqueueSnackbar('"Từ ngày" không được lớn hơn "Đến ngày"', { variant: 'warning' });
      return;
    }
    setSyncLoading(true);
    setSyncJob(null);
    try {
      const jobId = await startSync('all', {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      if (jobId) {
        enqueueSnackbar('Đã bắt đầu đồng bộ KiotViet', { variant: 'info' });
      }
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      const msg = error?.response?.data?.message ?? error?.message;
      if (status === 409 || msg?.includes('đang chạy')) {
        enqueueSnackbar('Đang có tiến trình đồng bộ đang chạy', { variant: 'warning' });
      } else {
        enqueueSnackbar(msg || 'Không thể bắt đầu đồng bộ', { variant: 'error' });
      }
    } finally {
      setSyncLoading(false);
    }
  }, [startSync, enqueueSnackbar, fromDate, toDate]);

  const handleTransform = useCallback(async () => {
    setTransformLoading(true);
    setTransformJob(null);
    try {
      const jobId = await startSync('transform');
      if (jobId) {
        enqueueSnackbar('Đã bắt đầu chuyển đổi KiotViet → ERP', { variant: 'info' });
      }
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      const msg = error?.response?.data?.message ?? error?.message;
      if (status === 409 || msg?.includes('đang chạy')) {
        enqueueSnackbar('Đang có tiến trình chuyển đổi đang chạy', { variant: 'warning' });
      } else {
        enqueueSnackbar(msg || 'Không thể bắt đầu chuyển đổi', { variant: 'error' });
      }
    } finally {
      setTransformLoading(false);
    }
  }, [startSync, enqueueSnackbar]);

  const renderJobStatus = (job: ISyncJobStatus | null, label: string) => {
    if (!job) return null;

    const statusColor =
      job.status === 'Completed'
        ? 'success'
        : job.status === 'Failed'
          ? 'error'
          : job.status === 'Running'
            ? 'info'
            : 'warning';

    const completedSteps = job.steps?.filter((s) => !s.isRunning && s.error === null).length || 0;
    const totalSteps = job.steps?.length || 0;
    const runningStep = job.steps?.find((s) => s.isRunning);
    // Tiến trình tổng: số bước xong + % của bước đang chạy (mượt hơn so với chỉ đếm bước).
    const overallProgress =
      totalSteps > 0
        ? ((completedSteps + (runningStep ? (runningStep.percent || 0) / 100 : 0)) / totalSteps) * 100
        : 0;
    const currentMessage = runningStep?.message ?? job.steps?.[totalSteps - 1]?.message ?? null;

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity={statusColor} sx={{ mb: 1 }}>
          <strong>{label}:</strong> {job.status}
          {job.status === 'Running' && totalSteps > 0 && ` (${completedSteps}/${totalSteps} bước)`}
        </Alert>

        {job.status === 'Running' && (
          <>
            <LinearProgress
              variant="determinate"
              value={overallProgress}
              sx={{ mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {currentMessage || 'Đang khởi tạo...'}
            </Typography>
          </>
        )}

        {job.steps && job.steps.length > 0 && (
          <Box sx={{ mt: 1, maxHeight: 340, overflow: 'auto' }}>
            {job.steps.map((step, index) => (
              <Box key={index} sx={{ py: 0.5, px: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ fontSize: 13 }}>
                  {step.isRunning ? (
                    <CircularProgress size={16} color="info" />
                  ) : (
                    <Iconify
                      icon={step.error === null ? 'eva:checkmark-circle-2-fill' : 'eva:close-circle-fill'}
                      sx={{ color: step.error === null ? 'success.main' : 'error.main', width: 18 }}
                    />
                  )}
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {step.entity}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.isRunning
                      ? step.totalKnown > 0
                        ? `${step.processed}/${step.totalKnown} (${step.percent}%)`
                        : '...'
                      : step.error
                        ? 'Lỗi'
                        : `+${step.created} ~${step.updated}${step.skipped > 0 ? ` (bỏ qua ${step.skipped})` : ''}${step.totalKnown > 0 ? ` / ${step.totalKnown}` : ''}`}
                  </Typography>
                </Stack>

                {/* Thanh % + message của bước đang chạy */}
                {step.isRunning && step.totalKnown > 0 && (
                  <LinearProgress
                    variant="determinate"
                    value={step.percent}
                    sx={{ mt: 0.5, ml: 3.25, height: 4, borderRadius: 1 }}
                  />
                )}
                {step.isRunning && step.message && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 3.25 }}>
                    {step.message}
                  </Typography>
                )}
                {!step.isRunning && step.error && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block', ml: 3.25 }}>
                    {step.error}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Đồng bộ KiotViet"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đồng bộ KiotViet' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleBasedGuard hasContent roles={['Admin']}>
        <Stack spacing={3}>
          {/* Sync KiotViet */}
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Iconify icon="mdi:cloud-sync" width={32} sx={{ color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">Đồng bộ dữ liệu KiotViet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Tải toàn bộ dữ liệu từ KiotViet API về các bảng staging (KiotViet*)
                </Typography>
              </Box>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Bao gồm: Chi nhánh, Danh mục, Nhóm KH, Nhà cung cấp, Khách hàng, Tài khoản NH,
              Kênh bán hàng, Sản phẩm, Bảng giá, Đơn hàng, Trả hàng, Voucher...
            </Typography>

            {/* Khoảng thời gian — chỉ áp dụng cho Đơn đặt hàng, Trả hàng, Hóa đơn */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
              sx={{ mb: 1 }}
            >
              <DatePicker
                label="Từ ngày"
                value={parseDateStr(fromDate)}
                onChange={(val) => setFromDate(toDateStr(val))}
                format="dd/MM/yyyy"
                disabled={syncJob?.status === 'Running'}
                slotProps={{ textField: { size: 'small', sx: { width: { xs: 1, sm: 180 } } } }}
              />
              <DatePicker
                label="Đến ngày"
                value={parseDateStr(toDate)}
                onChange={(val) => setToDate(toDateStr(val))}
                format="dd/MM/yyyy"
                disabled={syncJob?.status === 'Running'}
                slotProps={{
                  textField: {
                    size: 'small',
                    placeholder: 'Hiện tại',
                    sx: { width: { xs: 1, sm: 180 } },
                  },
                }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Khoảng thời gian chỉ áp dụng cho <strong>Đơn đặt hàng, Trả hàng, Hóa đơn</strong>. Bỏ
              trống → mặc định từ 01/01/2026 đến hiện tại. Dữ liệu danh mục (sản phẩm, khách hàng, nhà
              cung cấp...) luôn lấy đầy đủ lịch sử.
            </Typography>

            <LoadingButton
              variant="contained"
              color="primary"
              size="large"
              loading={syncLoading}
              disabled={syncJob?.status === 'Running'}
              startIcon={<Iconify icon="mdi:cloud-download" />}
              onClick={handleSync}
              sx={{ minWidth: 200 }}
            >
              {syncJob?.status === 'Running' ? 'Đang đồng bộ...' : 'Đồng bộ KiotViet'}
            </LoadingButton>

            {renderJobStatus(syncJob, 'Đồng bộ KiotViet')}
          </Card>

          {/* Transform KiotViet → ERP */}
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Iconify icon="mdi:swap-horizontal-bold" width={32} sx={{ color: 'warning.main' }} />
              <Box>
                <Typography variant="h6">Chuyển đổi KiotViet → ERP</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chuyển dữ liệu từ bảng staging (KiotViet*) sang bảng ERP chính thức (Erp*)
                </Typography>
              </Box>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Bao gồm: Chi nhánh, Danh mục, Nhóm KH, NCC, KH, TK NH, Kênh bán, Đơn vị tính,
              Thương hiệu, Sản phẩm, Biến thể, Hình ảnh, Thuế, Bảng giá, Đơn bán, Trả hàng,
              Đơn nhập, Voucher, Tồn kho
            </Typography>

            <LoadingButton
              variant="contained"
              color="warning"
              size="large"
              loading={transformLoading}
              disabled={transformJob?.status === 'Running'}
              startIcon={<Iconify icon="mdi:database-arrow-right" />}
              onClick={handleTransform}
              sx={{ minWidth: 200 }}
            >
              {transformJob?.status === 'Running' ? 'Đang chuyển đổi...' : 'Chuyển đổi sang ERP'}
            </LoadingButton>

            {renderJobStatus(transformJob, 'Chuyển đổi ERP')}
          </Card>
        </Stack>
      </RoleBasedGuard>
    </Container>
  );
}
