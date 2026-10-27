'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { startInspection, getInspectionShifts, getInspectionDashboard } from 'src/api/inspection';

import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { InspectionType, IInspectionShift, IInspectionDashboard } from 'src/types/inspection';
import { CORRECTIVE_ACTION_STATUS_LABEL } from 'src/types/inspection';

import { StatusChip, toDateInput } from '../inspection-common';

// ----------------------------------------------------------------------
// Tổng quan kiểm tra cửa hàng. Quản lý (inspection.read): lỗi đang mở / quá hạn, độ phủ tuần, 3 lỗi lặp, việc sửa tận gốc
// sắp đến hạn. Mọi người: ca hôm nay + nút bắt đầu kiểm (trưởng ca kiểm nhanh ca mình; quản lý kiểm đột xuất / kiểm tuần).
// ----------------------------------------------------------------------

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card sx={{ p: 2, height: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color }}>
        {value}
      </Typography>
    </Card>
  );
}

export default function InspectionDashboardView() {
  const settings = useSettingsContext();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canRead = hasPermission(user, PERMISSIONS.inspection.read);
  const canSpot = hasPermission(user, PERMISSIONS.inspection.spot);
  const canConduct = hasPermission(user, PERMISSIONS.inspection.conduct);

  const [dashboard, setDashboard] = useState<IInspectionDashboard | null>(null);
  const [shifts, setShifts] = useState<IInspectionShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (canRead) {
        const data = await getInspectionDashboard();
        setDashboard(data);
        setShifts(data.todayShifts);
      } else {
        setShifts(await getInspectionShifts(toDateInput(new Date())));
      }
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được tổng quan kiểm tra'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [canRead, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async (shift: IInspectionShift, type: InspectionType, isSpotCheck: boolean) => {
    const key = `${shift.shiftScheduleId}-${type}-${isSpotCheck}`;
    setStarting(key);
    try {
      const inspection = await startInspection(type, shift.date, shift.shiftScheduleId, isSpotCheck);
      router.push(paths.dashboard.inspection.run(inspection.summary.id));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không bắt đầu được lượt kiểm'), { variant: 'error' });
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const coverage = dashboard?.coverage;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Kiểm tra cửa hàng"
        links={[{ name: 'Tổng quan' }]}
        action={
          <Button variant="outlined" component={RouterLink} href={paths.dashboard.inspection.myFaults}>
            Lỗi tôi phụ trách
          </Button>
        }
        sx={{ mb: 3 }}
      />

      {dashboard && coverage && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Lỗi đang mở" value={dashboard.openFaults} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Lỗi bắt buộc (B) đang mở" value={dashboard.openMandatoryFaults} color="error.main" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Quá hạn sửa" value={dashboard.overdueFaults} color={dashboard.overdueFaults ? 'error.main' : undefined} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat
              label={`Tỉ lệ đạt tuần từ ${fDate(dashboard.weekStart)}`}
              value={dashboard.weekPassRate == null ? '—' : `${Math.round(dashboard.weekPassRate * 100)}%`}
            />
          </Grid>
          {dashboard.unassignedFaults > 0 && (
            <Grid size={12}>
              <Alert severity="warning">
                {dashboard.unassignedFaults} lỗi thuộc khu không có ai phụ trách trong ca — đã giao trưởng ca (hoặc chưa xác
                định nếu ca chưa có trưởng ca). Đặt khu cho từng người trong lịch phân ca.
              </Alert>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: 1 }}>
              <CardHeader title="Độ phủ tuần" />
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Kiểm nhanh: {coverage.shiftsQuickChecked}/{coverage.shiftsExpected} ca chính
                  </Typography>
                  <Typography variant="body2" color={coverage.spotChecks >= coverage.requiredSpotChecks ? undefined : 'warning.main'}>
                    Kiểm đột xuất của quản lý: {coverage.spotChecks}/{coverage.requiredSpotChecks}
                  </Typography>
                  <Typography variant="body2" color={coverage.weeklyFullDone ? undefined : 'warning.main'}>
                    Kiểm tuần: {coverage.weeklyFullDone ? 'đã làm' : 'chưa làm'}
                    {coverage.weeklyFullDone && !coverage.weeklyFullOnDifferentShift ? ' (trùng ca với tuần trước)' : ''}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: 1 }}>
              <CardHeader title="3 lỗi lặp nhiều nhất tuần" />
              <CardContent>
                {dashboard.topRepeatFaults.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có lỗi lặp (từ 2 lần).
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {dashboard.topRepeatFaults.map((f) => (
                      <Stack key={f.itemCode} direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                          {f.itemCode} · {f.title}
                        </Typography>
                        <Chip size="small" color="error" label={`${f.failCount} lần`} />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: 1 }}>
              <CardHeader
                title="Sửa tận gốc sắp đến hạn"
                action={
                  <Button size="small" component={RouterLink} href={paths.dashboard.inspection.correctiveActions}>
                    Xem hết
                  </Button>
                }
              />
              <CardContent>
                {dashboard.dueCorrectiveActions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Không có việc nào.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {dashboard.dueCorrectiveActions.map((a) => (
                      <Stack key={a.id} direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" noWrap>
                          {a.title}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={a.dueDate ? fDate(a.dueDate) : CORRECTIVE_ACTION_STATUS_LABEL[a.status]}
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card>
        <CardHeader title={`Ca hôm nay${canRead ? '' : ' của tôi'}`} />
        {shifts.length === 0 ? (
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Hôm nay không có ca nào{canRead ? '' : ' của bạn'}.
            </Typography>
          </CardContent>
        ) : (
          <TableContainer>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Ca</TableCell>
                    <TableCell>Trưởng ca</TableCell>
                    <TableCell>Người</TableCell>
                    <TableCell>Kiểm nhanh</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shifts.map((s) => {
                    const mayQuick = s.iAmOnShift && (s.iAmShiftLead || canConduct);
                    const key = (type: string, spot: boolean) => `${s.shiftScheduleId}-${type}-${spot}`;
                    return (
                      <TableRow key={`${s.shiftScheduleId}-${s.branchId ?? ''}`}>
                        <TableCell>
                          <Typography variant="subtitle2">{s.shiftName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {s.startTime}–{s.endTime}
                            {s.shiftType === 'Extra' ? ' · ca phụ' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>{s.shiftLeadName ?? <Chip size="small" color="warning" label="chưa đặt" />}</TableCell>
                        <TableCell>{s.staffCount}</TableCell>
                        <TableCell>
                          {s.quickStatus ? <StatusChip status={s.quickStatus} /> : <Chip size="small" variant="outlined" label="Chưa kiểm" />}
                          {s.spotChecks > 0 && <Chip size="small" variant="outlined" sx={{ ml: 0.5 }} label={`${s.spotChecks} đột xuất`} />}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {s.quickInspectionId && (canRead || mayQuick) && (
                              <Button size="small" component={RouterLink} href={paths.dashboard.inspection.run(s.quickInspectionId)}>
                                Mở
                              </Button>
                            )}
                            {mayQuick && s.quickStatus !== 'Submitted' && s.shiftType === 'Main' && (
                              <LoadingButton
                                size="small"
                                variant="contained"
                                loading={starting === key('ShiftQuick', false)}
                                onClick={() => start(s, 'ShiftQuick', false)}
                              >
                                {s.quickInspectionId ? 'Kiểm tiếp' : 'Kiểm nhanh'}
                              </LoadingButton>
                            )}
                            {canSpot && (
                              <>
                                <LoadingButton
                                  size="small"
                                  variant="outlined"
                                  loading={starting === key('ShiftQuick', true)}
                                  onClick={() => start(s, 'ShiftQuick', true)}
                                >
                                  Đột xuất
                                </LoadingButton>
                                <LoadingButton
                                  size="small"
                                  variant="outlined"
                                  loading={starting === key('WeeklyFull', false)}
                                  onClick={() => start(s, 'WeeklyFull', false)}
                                >
                                  Kiểm tuần
                                </LoadingButton>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>
    </Container>
  );
}
