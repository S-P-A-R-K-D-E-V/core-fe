'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { fDateTime, fToNow } from 'src/utils/format-time';

import { RoleBasedGuard } from 'src/auth/guard';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';

import { getWorkers, runWorkerNow, setWorkerEnabled } from 'src/api/system-jobs';

import type { IWorkerStatus, WorkerHealth } from 'src/types/worker';

// Auto-refresh — heartbeat cập nhật liên tục, nhưng không cần realtime tuyệt đối cho màn theo dõi
const POLL_INTERVAL_MS = 15_000;

const HEALTH_LABEL: Record<WorkerHealth, string> = {
  NeverRun: 'Chưa chạy lần nào',
  Healthy: 'Bình thường',
  Stale: 'Nghi treo',
  Error: 'Lỗi',
};

const HEALTH_COLOR: Record<WorkerHealth, 'default' | 'success' | 'warning' | 'error'> = {
  NeverRun: 'default',
  Healthy: 'success',
  Stale: 'warning',
  Error: 'error',
};

export default function SystemJobsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [workers, setWorkers] = useState<IWorkerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringName, setTriggeringName] = useState<string | null>(null);
  const [togglingName, setTogglingName] = useState<string | null>(null);

  const fetchWorkers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await getWorkers();
      setWorkers(data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không tải được danh sách worker', { variant: 'error' });
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchWorkers(true);
    const interval = setInterval(() => fetchWorkers(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunNow = useCallback(
    async (worker: IWorkerStatus) => {
      setTriggeringName(worker.name);
      try {
        const result = await runWorkerNow(worker.name);
        enqueueSnackbar(result.message, { variant: 'info' });
        // Worker poll tín hiệu mỗi 5s — đợi 1 nhịp rồi refresh để thấy heartbeat mới
        setTimeout(() => fetchWorkers(false), 6000);
      } catch (error: any) {
        enqueueSnackbar(error?.response?.data?.message || error?.message || 'Không thể gửi yêu cầu chạy ngay', {
          variant: 'error',
        });
      } finally {
        setTriggeringName(null);
      }
    },
    [enqueueSnackbar, fetchWorkers]
  );

  const handleToggleEnabled = useCallback(
    async (worker: IWorkerStatus, nextEnabled: boolean) => {
      setTogglingName(worker.name);
      try {
        const result = await setWorkerEnabled(worker.name, nextEnabled);
        enqueueSnackbar(result.message, { variant: 'info' });
        await fetchWorkers(false);
      } catch (error: any) {
        enqueueSnackbar(error?.response?.data?.message || error?.message || 'Không thể đổi trạng thái worker', {
          variant: 'error',
        });
      } finally {
        setTogglingName(null);
      }
    },
    [enqueueSnackbar, fetchWorkers]
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="System Jobs"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'System Jobs' }]}
        action={
          <Tooltip title="Làm mới">
            <IconButton onClick={() => fetchWorkers(true)}>
              <Iconify icon="solar:refresh-bold" />
            </IconButton>
          </Tooltip>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleBasedGuard hasContent roles={['Admin']}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Trạng thái toàn bộ tiến trình chạy nền (BackgroundService) trong hệ thống — tick lần cuối,
          kết quả/lỗi gần nhất. Tự làm mới mỗi 15 giây. Đồng bộ KiotViet có màn riêng chi tiết hơn
          tại <strong>Đồng bộ KiotViet</strong>.
        </Typography>

        <Card>
          <TableContainer sx={{ overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={130}>Trạng thái</TableCell>
                    <TableCell width={220}>Worker</TableCell>
                    <TableCell width={140}>Process</TableCell>
                    <TableCell width={170}>Lịch chạy</TableCell>
                    <TableCell width={130}>Hoạt động gần nhất</TableCell>
                    <TableCell>Kết quả / lỗi gần nhất</TableCell>
                    <TableCell width={90} align="center">
                      Bật/tắt
                    </TableCell>
                    <TableCell width={130} align="right">
                      Hành động
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {loading &&
                    [1, 2, 3, 4].map((i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Box sx={{ py: 1 }}>
                            <CircularProgress size={16} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}

                  {!loading && workers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                          Chưa có worker nào
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading &&
                    workers.map((worker) => (
                      <TableRow key={worker.name} hover>
                        <TableCell>
                          <Label variant="soft" color={HEALTH_COLOR[worker.health]}>
                            {HEALTH_LABEL[worker.health]}
                          </Label>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {worker.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {worker.description}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {worker.process}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {worker.scheduleDescription}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {/* Ưu tiên lastSuccessAtUtc: worker event-driven/idle (Kafka consumer,
                              queue-driven...) tự ping "còn sống" mỗi 60s qua success mà không tạo
                              tick mới khi không có việc — chỉ nhìn lastTickAtUtc dễ hiểu nhầm
                              "đã lâu không hoạt động" dù thực ra vẫn khoẻ. */}
                          {worker.lastSuccessAtUtc || worker.lastTickAtUtc ? (
                            <Tooltip title={fDateTime(worker.lastSuccessAtUtc || worker.lastTickAtUtc)}>
                              <Typography variant="caption">
                                {fToNow(worker.lastSuccessAtUtc || worker.lastTickAtUtc)}
                                {worker.lastTickWasManual && ' (tay)'}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>
                          {worker.health === 'Error' && worker.lastError ? (
                            <Typography variant="caption" color="error.main">
                              {worker.lastError}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {worker.lastSummary || '—'}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="center">
                          {worker.supportsEnableToggle ? (
                            <Tooltip title={worker.enabled ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}>
                              <span>
                                <Switch
                                  size="small"
                                  checked={worker.enabled}
                                  disabled={togglingName === worker.name}
                                  onChange={(e) => handleToggleEnabled(worker, e.target.checked)}
                                />
                              </span>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="right">
                          {worker.supportsManualTrigger ? (
                            <LoadingButton
                              size="small"
                              variant="outlined"
                              loading={triggeringName === worker.name}
                              onClick={() => handleRunNow(worker)}
                              startIcon={<Iconify icon="mdi:play-circle-outline" />}
                            >
                              Chạy ngay
                            </LoadingButton>
                          ) : (
                            <Button size="small" variant="text" disabled>
                              —
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      </RoleBasedGuard>
    </Container>
  );
}
