'use client';

import { useState, useEffect, useContext, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
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

import KiotVietJobHistoryTab from '../kiotviet-job-history-tab';
import KiotVietWebhookTab from '../kiotviet-webhook-tab';
import KiotVietPendingPushTab from '../kiotviet-pending-push-tab';

import type { ISyncJobStatus } from 'src/types/sync-job';

import axios, { endpoints } from 'src/utils/axios';

// Job types that belong to the "sync" card
const SYNC_TYPES = new Set(['SyncAll', 'SyncInvoices', 'SyncPurchaseOrders', 'SyncAndTransform', 'SyncSelected']);

// Phạm vi đồng bộ chọn được — khớp SyncJobTypes.SelectableEntities ở backend.
const SYNC_ENTITY_OPTIONS = [
  { key: 'Branches', label: 'Chi nhánh' },
  { key: 'Categories', label: 'Danh mục' },
  { key: 'Suppliers', label: 'Nhà cung cấp' },
  { key: 'Customers', label: 'Khách hàng' },
  { key: 'BankAccounts', label: 'Tài khoản NH' },
  { key: 'SaleChannels', label: 'Kênh bán hàng' },
  { key: 'Products', label: 'Sản phẩm' },
  { key: 'PriceBooks', label: 'Bảng giá' },
  { key: 'Orders', label: 'Đơn hàng' },
  { key: 'Returns', label: 'Trả hàng' },
  { key: 'VoucherCampaigns', label: 'Đợt voucher' },
  { key: 'Vouchers', label: 'Voucher' },
  { key: 'Invoices', label: 'Hóa đơn' },
  { key: 'PurchaseOrders', label: 'Đơn nhập hàng' },
];
const ALL_ENTITY_KEYS = SYNC_ENTITY_OPTIONS.map((o) => o.key);

const TABS = [
  { value: 'sync', label: 'Đồng bộ', icon: 'mdi:cloud-sync' },
  { value: 'history', label: 'Lịch sử', icon: 'mdi:history' },
  { value: 'webhook', label: 'Webhook', icon: 'mdi:webhook' },
  { value: 'pending-push', label: 'Đơn chờ đẩy', icon: 'mdi:cloud-upload-outline' },
];

// ----------------------------------------------------------------------

export default function KiotVietSyncView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { startSyncSelected, subscribeToJob, onJobUpdate } = useContext(SyncNotificationContext);

  const [currentTab, setCurrentTab] = useState('sync');
  const [syncLoading, setSyncLoading] = useState(false);

  // Khoảng thời gian lấy dữ liệu giao dịch (Order/Return/SalesOrder). Mặc định 01/01/2026 → hiện tại.
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState('');

  // Phạm vi đồng bộ — mặc định chọn tất cả (giữ hành vi cũ: nút "Đồng bộ KiotViet" = đồng bộ toàn bộ).
  const [selectedEntities, setSelectedEntities] = useState<string[]>(ALL_ENTITY_KEYS);
  const allSelected = selectedEntities.length === ALL_ENTITY_KEYS.length;
  const noneSelected = selectedEntities.length === 0;

  const toggleAll = useCallback(() => {
    setSelectedEntities(allSelected ? [] : ALL_ENTITY_KEYS);
  }, [allSelected]);

  const toggleEntity = useCallback((key: string) => {
    setSelectedEntities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const [syncJob, setSyncJob] = useState<ISyncJobStatus | null>(null);

  // Listen to SignalR real-time updates
  useEffect(() => {
    const unsubscribe = onJobUpdate((status: ISyncJobStatus) => {
      if (SYNC_TYPES.has(status.type)) {
        setSyncJob(status);
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

  // Check running jobs on mount and subscribe via SignalR
  useEffect(() => {
    const checkRunning = async () => {
      try {
        const { data } = await axios.get(endpoints.kiotViet.syncRunning);
        if (data.sync) {
          setSyncJob(data.sync);
          subscribeToJob(data.sync.jobId);
        }
        if (data.syncAndTransform) {
          setSyncJob(data.syncAndTransform);
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
    if (noneSelected) {
      enqueueSnackbar('Chọn ít nhất 1 phạm vi để đồng bộ', { variant: 'warning' });
      return;
    }
    setSyncLoading(true);
    setSyncJob(null);
    try {
      // allSelected → gửi mảng rỗng, BE hiểu là đồng bộ toàn bộ (tương đương SyncAll trước đây).
      const jobId = await startSyncSelected(allSelected ? [] : selectedEntities, {
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
  }, [startSyncSelected, enqueueSnackbar, fromDate, toDate, allSelected, selectedEntities, noneSelected]);

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
        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          sx={{ mb: 3 }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              icon={<Iconify icon={tab.icon} width={20} />}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {currentTab === 'sync' && (
          <Stack spacing={3}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Iconify icon="mdi:cloud-sync" width={32} sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="h6">Đồng bộ dữ liệu KiotViet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tải toàn bộ dữ liệu từ KiotViet API về các bảng KiotViet* — tầng dữ liệu vận hành duy nhất
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Bao gồm: Chi nhánh, Danh mục, Nhóm KH, Nhà cung cấp, Khách hàng, Tài khoản NH,
                Kênh bán hàng, Sản phẩm, Bảng giá, Đơn hàng, Trả hàng, Voucher...
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Hệ thống tự động đồng bộ hóa đơn mỗi 30 phút, đồng bộ toàn bộ hằng đêm, và nhận
                webhook gần thời gian thực (tab <strong>Webhook</strong>). Nút bên dưới dùng khi cần
                đồng bộ ngay hoặc theo khoảng ngày cụ thể.
              </Alert>

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

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Phạm vi đồng bộ
              </Typography>
              <FormControlLabel
                sx={{ mb: 0.5 }}
                control={
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && !noneSelected}
                    onChange={toggleAll}
                    disabled={syncJob?.status === 'Running'}
                  />
                }
                label={<strong>Chọn tất cả</strong>}
              />
              <FormGroup
                row
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: 'repeat(4, 1fr)' },
                  columnGap: 1,
                }}
              >
                {SYNC_ENTITY_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.key}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedEntities.includes(opt.key)}
                        onChange={() => toggleEntity(opt.key)}
                        disabled={syncJob?.status === 'Running'}
                      />
                    }
                    label={opt.label}
                  />
                ))}
              </FormGroup>

              <LoadingButton
                variant="contained"
                color="primary"
                size="large"
                loading={syncLoading}
                disabled={syncJob?.status === 'Running' || noneSelected}
                startIcon={<Iconify icon="mdi:cloud-download" />}
                onClick={handleSync}
                sx={{ minWidth: 200, mt: 2 }}
              >
                {syncJob?.status === 'Running'
                  ? 'Đang đồng bộ...'
                  : allSelected
                    ? 'Đồng bộ toàn bộ'
                    : `Đồng bộ ${selectedEntities.length} mục đã chọn`}
              </LoadingButton>

              {renderJobStatus(syncJob, 'Đồng bộ KiotViet')}
            </Card>
          </Stack>
        )}

        {currentTab === 'history' && <KiotVietJobHistoryTab />}
        {currentTab === 'webhook' && <KiotVietWebhookTab />}
        {currentTab === 'pending-push' && <KiotVietPendingPushTab />}
      </RoleBasedGuard>
    </Container>
  );
}
