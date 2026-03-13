'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';

import type {
  IBatchPayrollResponse,
  IPayrollCycleDetailResponse,
  IPayrollRecord,
  IPayrollShiftDetailResponse,
  IPayrollShiftItem,
} from 'src/types/corecms-api';
import type { IPayrollCycle } from 'src/types/corecms-api';

import {
  finalizePayroll,
  generateBatchPayroll,
  getPayrollByCycle,
  getPayrollShiftDetails,
  recalculatePayrollByCycle,
  removeWaiver,
  waivePenalty,
} from 'src/api/payroll';
import { getAllPayrollCycles } from 'src/api/payrollCycle';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'userName', label: 'Nhân viên', width: 160 },
  { id: 'totalShifts', label: 'Tổng ca', width: 80 },
  { id: 'presentShifts', label: 'Có mặt', width: 80 },
  { id: 'absentShifts', label: 'Nghỉ', width: 80 },
  { id: 'wrongShifts', label: 'Sai ca', width: 80 },
  { id: 'totalLateMinutes', label: 'Đi muộn (phút)', width: 110 },
  { id: 'totalHoursWorked', label: 'Giờ làm', width: 100 },
  { id: 'baseSalary', label: 'Lương CB', width: 140 },
  { id: 'bonus', label: 'Thưởng lễ', width: 120 },
  { id: 'penaltyAmount', label: 'Tiền phạt', width: 120 },
  { id: 'totalSalary', label: 'Tổng lương', width: 150 },
  { id: 'status', label: 'Trạng thái', width: 100 },
];

// ----------------------------------------------------------------------

export default function PayrollBatchView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [cycles, setCycles] = useState<IPayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleDetail, setCycleDetail] = useState<IPayrollCycleDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Track unfinalized record counts per cycle (populated after loading each cycle)
  const [cycleUnfinalizedCounts, setCycleUnfinalizedCounts] = useState<Record<string, number>>({});
  const [showAllCycles, setShowAllCycles] = useState(false);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Shift detail dialog state
  const [openShiftDetail, setOpenShiftDetail] = useState(false);
  const [shiftDetailLoading, setShiftDetailLoading] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<IPayrollShiftDetailResponse | null>(null);
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<IPayrollRecord | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waivingShiftId, setWaivingShiftId] = useState<string | null>(null);
  const [shiftDetailTab, setShiftDetailTab] = useState<'calendar' | 'table'>('calendar');
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);

  const fetchCycles = useCallback(async () => {
    try {
      const data = await getAllPayrollCycles();
      setCycles(data);
    } catch (error) {
      console.error('Failed to fetch cycles:', error);
    }
  }, []);

  const fetchCycleDetail = useCallback(
    async (cycleId: string) => {
      try {
        setLoading(true);
        const data = await getPayrollByCycle(cycleId);
        setCycleDetail(data);
        // Track how many records are unfinalized for this cycle
        const unfinalizedCount = data.records.filter((r) => !r.isFinalized).length;
        setCycleUnfinalizedCounts((prev) => ({ ...prev, [cycleId]: unfinalizedCount }));
      } catch (error) {
        console.error('Failed to fetch cycle detail:', error);
        enqueueSnackbar('Không thể tải dữ liệu bảng lương', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (selectedCycleId) {
      fetchCycleDetail(selectedCycleId);
    }
  }, [selectedCycleId, fetchCycleDetail]);

  const handleRecalculate = async () => {
    if (!selectedCycleId) return;
    try {
      setRecalculating(true);
      const result: IBatchPayrollResponse = await recalculatePayrollByCycle(selectedCycleId);
      enqueueSnackbar(
        `Tính lại thành công! ${result.successCount} nhân viên`,
        { variant: 'success' }
      );
      await fetchCycleDetail(selectedCycleId);
    } catch (error: any) {
      console.error('Failed to recalculate payroll:', error);
      enqueueSnackbar(error?.message || 'Tính lại bảng lương thất bại', { variant: 'error' });
    } finally {
      setRecalculating(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (!periodName || !fromDate || !toDate) {
      enqueueSnackbar('Vui lòng nhập đầy đủ thông tin', { variant: 'warning' });
      return;
    }

    try {
      setGenerating(true);
      const result: IBatchPayrollResponse = await generateBatchPayroll({
        periodName,
        fromDate,
        toDate,
      });

      enqueueSnackbar(
        `Tạo bảng lương thành công! ${result.successCount} nhân viên, ${result.skippedCount} bỏ qua`,
        { variant: 'success' }
      );

      setOpenDialog(false);
      setPeriodName('');
      setFromDate('');
      setToDate('');

      // Refresh cycles and select the new one
      await fetchCycles();
      setSelectedCycleId(result.payrollCycleId);
    } catch (error: any) {
      console.error('Failed to generate batch payroll:', error);
      enqueueSnackbar(error?.message || 'Tạo bảng lương thất bại', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const handleOpenShiftDetail = async (row: IPayrollRecord) => {
    try {
      setSelectedPayrollRecord(row);
      setOpenShiftDetail(true);
      setShiftDetailLoading(true);
      const data = await getPayrollShiftDetails(row.id);
      setShiftDetail(data);
    } catch (error) {
      console.error('Failed to fetch shift details:', error);
      enqueueSnackbar('Không thể tải chi tiết ca', { variant: 'error' });
    } finally {
      setShiftDetailLoading(false);
    }
  };

  const handleCloseShiftDetail = () => {
    setOpenShiftDetail(false);
    setShiftDetail(null);
    setSelectedPayrollRecord(null);
    setWaiveReason('');
    setWaivingShiftId(null);
    setShiftDetailTab('calendar');
    setCalendarWeekOffset(0);
  };

  const handleFinalizeRecord = async (isFinalized: boolean) => {
    if (!selectedPayrollRecord) return;
    try {
      setFinalizing(true);
      const updated = await finalizePayroll(selectedPayrollRecord.id, { isFinalized });
      setSelectedPayrollRecord(updated);
      enqueueSnackbar(
        isFinalized ? 'Đã chốt lương thành công' : 'Đã hủy chốt lương',
        { variant: 'success' }
      );
      // Refresh cycle table + unfinalized count
      if (selectedCycleId) await fetchCycleDetail(selectedCycleId);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Thao tác thất bại', { variant: 'error' });
    } finally {
      setFinalizing(false);
    }
  };

  // Calendar week helpers
  const calendarWeeks = useMemo(() => {
    if (!shiftDetail) return [];
    // Group shifts by ISO week (Mon–Sun)
    const weeks: { weekLabel: string; days: { date: string; dayLabel: string; isWeekend: boolean; shifts: typeof shiftDetail.shifts }[] }[] = [];
    const shiftsByDate = new Map<string, typeof shiftDetail.shifts>();
    for (const s of shiftDetail.shifts) {
      const existing = shiftsByDate.get(s.date) ?? [];
      shiftsByDate.set(s.date, [...existing, s]);
    }
    if (shiftDetail.shifts.length === 0) return [];
    // Determine full date range from fromDate to toDate (or shifts range)
    const parseDate = (d: string) => new Date(d);
    const rangeStart = parseDate(shiftDetail.fromDate);
    const rangeEnd = parseDate(shiftDetail.toDate);
    // Move rangeStart to the Monday of that week
    const startMonday = new Date(rangeStart);
    const dayOfWeek = startMonday.getDay(); // 0=Sun
    startMonday.setDate(startMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    // Build weeks
    const current = new Date(startMonday);
    while (current <= rangeEnd) {
      const weekDays: { date: string; dayLabel: string; isWeekend: boolean; shifts: typeof shiftDetail.shifts }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const dayIdx = d.getDay();
        weekDays.push({
          date: dateStr,
          dayLabel: `${dayNames[dayIdx]} ${d.getDate()}/${d.getMonth() + 1}`,
          isWeekend: dayIdx === 0 || dayIdx === 6,
          shifts: shiftsByDate.get(dateStr) ?? [],
        });
      }
      const monday = weekDays[1]; // index 1 = T2 (Monday in our array starts at Mon)
      // Actually weekDays[0] is Mon because we aligned to Monday above
      const wStart = weekDays[0];
      const wEnd = weekDays[6];
      weeks.push({
        weekLabel: `${wStart.date} → ${wEnd.date}`,
        days: weekDays,
      });
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }, [shiftDetail]);

  const handleWaivePenalty = async (shift: IPayrollShiftItem) => {
    if (!selectedPayrollRecord) return;

    const violationType =
      shift.status === 'Absent' ? 'Absent' : shift.status === 'Wrong' ? 'WrongShift' : 'Late';

    try {
      await waivePenalty({
        shiftAssignmentId: shift.shiftAssignmentId,
        userId: selectedPayrollRecord.userId,
        violationType,
        payrollCycleId: selectedPayrollRecord.payrollCycleId,
        reason: waiveReason || undefined,
      });
      enqueueSnackbar('Đã bỏ qua lỗi vi phạm', { variant: 'success' });
      setWaiveReason('');
      setWaivingShiftId(null);

      // Refresh shift detail
      const data = await getPayrollShiftDetails(selectedPayrollRecord.id);
      setShiftDetail(data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Bỏ qua lỗi thất bại', { variant: 'error' });
    }
  };

  const handleRemoveWaiver = async (shift: IPayrollShiftItem) => {
    if (!shift.waiverId || !selectedPayrollRecord) return;

    try {
      await removeWaiver(shift.waiverId);
      enqueueSnackbar('Đã xóa bỏ qua lỗi', { variant: 'success' });

      // Refresh shift detail
      const data = await getPayrollShiftDetails(selectedPayrollRecord.id);
      setShiftDetail(data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Xóa bỏ qua lỗi thất bại', { variant: 'error' });
    }
  };

  const getShiftStatusLabel = (shift: IPayrollShiftItem) => {
    if (shift.isWaived) return <Label color="info">Đã bỏ qua lỗi</Label>;
    if (shift.status === 'Present' && shift.lateMinutes > 0)
      return <Label color="warning">Đi muộn {shift.lateMinutes}p</Label>;
    if (shift.status === 'Present') return <Label color="success">Có mặt</Label>;
    if (shift.status === 'Wrong') return <Label color="error">Sai ca</Label>;
    return <Label color="error">Vắng</Label>;
  };

  const theme = useTheme();

  const getShiftCardColor = (shift: IPayrollShiftItem) => {
    if (shift.isWaived) return { bg: alpha(theme.palette.info.main, 0.08), border: theme.palette.info.main };
    if (shift.status === 'Absent') return { bg: alpha(theme.palette.error.main, 0.08), border: theme.palette.error.main };
    if (shift.status === 'Wrong') return { bg: alpha(theme.palette.warning.main, 0.1), border: theme.palette.warning.main };
    if (shift.lateMinutes > 0) return { bg: alpha(theme.palette.warning.main, 0.08), border: theme.palette.warning.light };
    return { bg: alpha(theme.palette.success.main, 0.08), border: theme.palette.success.main };
  };

  // Cycles that still have unfinalized employees (or not yet loaded → show by default)
  const visibleCycles = showAllCycles
    ? cycles
    : cycles.filter(
        (c) => !(c.id in cycleUnfinalizedCounts) || cycleUnfinalizedCounts[c.id] > 0
      );

  const records = cycleDetail?.records ?? [];
  const paginatedRecords = records.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bảng lương nhân viên"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Quản lý lương', href: paths.dashboard.salary.root },
          { name: 'Bảng lương nhân viên' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            {selectedCycleId && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={
                  recalculating ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Iconify icon="mingcute:refresh-2-line" />
                  )
                }
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                Tính lại lương
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setOpenDialog(true)}
            >
              Tạo bảng lương
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* Cycle selector */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Chọn chu kỳ lương</Typography>
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<Iconify icon={showAllCycles ? 'mingcute:eye-close-line' : 'mingcute:eye-2-line'} />}
            onClick={() => setShowAllCycles((v) => !v)}
          >
            {showAllCycles ? 'Ẩn chu kỳ đã chốt' : 'Hiện chu kỳ đã chốt'}
          </Button>
        </Stack>
        <Stack direction="row" flexWrap="wrap" spacing={1}>
          {visibleCycles.map((cycle) => {
            const unfinalizedCount = cycleUnfinalizedCounts[cycle.id];
            return (
              <Chip
                key={cycle.id}
                label={
                  <>                    {cycle.name} ({cycle.fromDate} → {cycle.toDate})
                    {unfinalizedCount !== undefined && (
                      <Box
                        component="span"
                        sx={{
                          ml: 0.75,
                          px: 0.6,
                          py: 0.1,
                          borderRadius: '10px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: unfinalizedCount > 0 ? 'warning.main' : 'success.main',
                          color: '#fff',
                        }}
                      >
                        {unfinalizedCount > 0 ? `${unfinalizedCount} chưa chốt` : '✓ Đã chốt'}
                      </Box>
                    )}
                  </>
                }
                color={selectedCycleId === cycle.id ? 'primary' : 'default'}
                variant={selectedCycleId === cycle.id ? 'filled' : 'outlined'}
                onClick={() => setSelectedCycleId(cycle.id)}
                sx={{ height: 'auto', py: 0.5 }}
              />
            );
          })}
          {visibleCycles.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {cycles.length === 0
                ? 'Chưa có chu kỳ lương nào. Hãy tạo bảng lương mới.'
                : 'Tất cả chu kỳ đã được chốt lương. Nhấn "Hiện chu kỳ đã chốt" để xem.'}
            </Typography>
          )}
        </Stack>
      </Card>

      {/* Payroll records table */}
      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            {cycleDetail && (
              <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 3, pb: 0 }}>
                <Typography variant="h6">{cycleDetail.cycleName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {cycleDetail.fromDate} → {cycleDetail.toDate}
                </Typography>
                <Label color={cycleDetail.isLocked ? 'error' : 'success'}>
                  {cycleDetail.isLocked ? 'Đã khóa' : 'Mở'}
                </Label>
                <Typography variant="body2" color="text.secondary">
                  ({records.length} nhân viên)
                </Typography>
              </Stack>
            )}

            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table size={table.dense ? 'small' : 'medium'}>
                  <TableHeadCustom headLabel={TABLE_HEAD} />

                  <TableBody>
                    {paginatedRecords.map((row: IPayrollRecord) => (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleOpenShiftDetail(row)}
                      >
                        <TableCell>
                          <strong>{row.userName}</strong>
                        </TableCell>
                        <TableCell>{row.totalShifts}</TableCell>
                        <TableCell>
                          <Chip label={row.presentShifts} color="success" size="small" />
                        </TableCell>
                        <TableCell>
                          {row.absentShifts > 0 ? (
                            <Chip label={row.absentShifts} color="error" size="small" />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell>
                          {row.wrongShifts > 0 ? (
                            <Chip label={row.wrongShifts} color="warning" size="small" />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell>
                          {row.totalLateMinutes > 0 ? (
                            <Chip
                              label={`${row.totalLateMinutes} phút`}
                              color="warning"
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell>{row.totalHoursWorked.toFixed(1)}h</TableCell>
                        <TableCell>{formatCurrency(row.baseSalary)}</TableCell>
                        <TableCell>
                          {row.bonus > 0 ? formatCurrency(row.bonus) : '-'}
                        </TableCell>
                        <TableCell>
                          {row.penaltyAmount > 0 ? (
                            <Typography color="error.main" variant="body2">
                              -{formatCurrency(row.penaltyAmount)}
                            </Typography>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <strong style={{ color: '#00AB55' }}>
                            {formatCurrency(row.totalSalary)}
                          </strong>
                        </TableCell>
                        <TableCell>
                          <Label color={row.isFinalized ? 'success' : 'warning'}>
                            {row.isFinalized ? 'Đã duyệt' : 'Chưa duyệt'}
                          </Label>
                        </TableCell>
                      </TableRow>
                    ))}

                    {records.length === 0 && (
                      <TableNoData
                        notFound={!!selectedCycleId}
                      />
                    )}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={records.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>

      {/* Generate batch payroll dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo bảng lương mới</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Tên kỳ lương"
              placeholder="VD: Bảng lương tháng 3/2026"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
            />
            <DatePicker
              label="Từ ngày"
              value={parseDateStr(fromDate)}
              onChange={(val) => setFromDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />
            <DatePicker
              label="Đến ngày"
              value={parseDateStr(toDate)}
              onChange={(val) => setToDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Hệ thống sẽ tự động tính lương cho tất cả nhân viên dựa trên:
              </Typography>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.8rem' }}>
                <li>Thời gian checkin - checkout thực tế của mỗi ca</li>
                <li>Đi sớm: chỉ tính từ giờ bắt đầu ca</li>
                <li>Về muộn: chỉ tính đến giờ kết thúc ca</li>
                <li>Ca liền nhau: chỉ cần checkin ca đầu + checkout ca cuối</li>
                <li>Ca thiếu checkin/checkout: không tính lương</li>
                <li>Áp dụng phạt theo chính sách vi phạm</li>
                <li>Cộng thưởng ngày lễ theo cấu hình</li>
              </ul>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="inherit">
            Hủy
          </Button>
          <Button onClick={handleGenerateBatch} variant="contained" disabled={generating}>
            {generating ? <CircularProgress size={20} /> : 'Tạo bảng lương'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shift detail dialog */}
      <Dialog
        open={openShiftDetail}
        onClose={handleCloseShiftDetail}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              Chi tiết ca làm việc — {selectedPayrollRecord?.userName}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              {selectedPayrollRecord?.isFinalized ? (
                <Tooltip title="Hủy chốt lương để có thể chỉnh sửa">
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={
                      finalizing ? (
                        <CircularProgress size={14} />
                      ) : (
                        <Iconify icon="mingcute:lock-unlock-line" />
                      )
                    }
                    onClick={() => handleFinalizeRecord(false)}
                    disabled={finalizing}
                  >
                    Hủy chốt
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="Chốt lương — Sau khi chốt không thể thay đổi">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={
                      finalizing ? (
                        <CircularProgress size={14} />
                      ) : (
                        <Iconify icon="mingcute:lock-line" />
                      )
                    }
                    onClick={() => handleFinalizeRecord(true)}
                    disabled={finalizing}
                  >
                    Chốt lương
                  </Button>
                </Tooltip>
              )}
              <IconButton onClick={handleCloseShiftDetail} size="small">
                <Iconify icon="mingcute:close-line" />
              </IconButton>
            </Stack>
          </Stack>
          {selectedPayrollRecord && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Kỳ lương: {selectedPayrollRecord.fromDate} → {selectedPayrollRecord.toDate}
              </Typography>
              {selectedPayrollRecord.isFinalized && (
                <Label color="success">Đã chốt</Label>
              )}
            </Stack>
          )}
          <Tabs
            value={shiftDetailTab}
            onChange={(_, v) => { setShiftDetailTab(v); setCalendarWeekOffset(0); }}
            sx={{ mt: 1 }}
          >
            <Tab value="calendar" label="Dạng lịch" icon={<Iconify icon="mingcute:calendar-line" />} iconPosition="start" />
            <Tab value="table" label="Dạng bảng" icon={<Iconify icon="mingcute:table-2-line" />} iconPosition="start" />
          </Tabs>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {shiftDetailLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : shiftDetail ? (
            <>
              {/* ── CALENDAR VIEW ── */}
              {shiftDetailTab === 'calendar' && (
                <Box>
                  {calendarWeeks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      Không có ca làm việc nào trong kỳ này
                    </Typography>
                  ) : (
                    <>
                      {/* Week navigation */}
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                        <IconButton
                          onClick={() => setCalendarWeekOffset((o) => Math.max(0, o - 1))}
                          disabled={calendarWeekOffset === 0}
                        >
                          <Iconify icon="mingcute:left-line" />
                        </IconButton>
                        <Typography variant="subtitle2">
                          Tuần {calendarWeekOffset + 1} / {calendarWeeks.length} &nbsp;·&nbsp;
                          {calendarWeeks[calendarWeekOffset]?.weekLabel}
                        </Typography>
                        <IconButton
                          onClick={() => setCalendarWeekOffset((o) => Math.min(calendarWeeks.length - 1, o + 1))}
                          disabled={calendarWeekOffset === calendarWeeks.length - 1}
                        >
                          <Iconify icon="mingcute:right-line" />
                        </IconButton>
                      </Stack>

                      {/* 7-column grid */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          gap: 1,
                        }}
                      >
                        {calendarWeeks[calendarWeekOffset]?.days.map((day) => (
                          <Paper
                            key={day.date}
                            variant="outlined"
                            sx={{
                              minHeight: 120,
                              p: 1,
                              bgcolor: (() => {
                                const hasHoliday = day.shifts.some((s) => s.isHolidayShift);
                                if (hasHoliday) return alpha('#FF9800', 0.1);
                                if (day.isWeekend) return alpha(theme.palette.grey[500], 0.06);
                                return 'background.paper';
                              })(),
                              borderColor: day.shifts.some((s) => s.isHolidayShift)
                                ? '#FF9800'
                                : theme.palette.divider,
                            }}
                          >
                            {/* Day header */}
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color={
                                day.shifts.some((s) => s.isHolidayShift)
                                  ? '#E65100'
                                  : day.isWeekend
                                  ? 'text.secondary'
                                  : 'text.primary'
                              }
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              {day.dayLabel}
                              {day.shifts.some((s) => s.isHolidayShift) && (
                                <Box component="span" sx={{ ml: 0.5, fontSize: '0.65rem', bgcolor: '#FF9800', color: '#fff', px: 0.5, py: 0.1, borderRadius: '4px' }}>
                                  Lễ
                                </Box>
                              )}
                            </Typography>
                            <Divider sx={{ mb: 0.5 }} />

                            {day.shifts.length === 0 ? (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            ) : (
                              <Stack spacing={0.75}>
                                {day.shifts.map((shift) => {
                                  const colors = getShiftCardColor(shift);
                                  const isWaiving = waivingShiftId === shift.shiftAssignmentId;
                                  return (
                                    <Box
                                      key={shift.shiftAssignmentId}
                                      sx={{
                                        bgcolor: colors.bg,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 1,
                                        p: 0.75,
                                      }}
                                    >
                                      <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
                                        {shift.shiftName}
                                        {shift.isHolidayShift && (
                                          <Box component="span" sx={{ ml: 0.5, fontSize: '0.6rem', bgcolor: '#FF9800', color: '#fff', px: 0.4, py: 0.1, borderRadius: '3px', verticalAlign: 'middle' }}>
                                            +Lễ
                                          </Box>
                                        )}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {shift.shiftStartTime}–{shift.shiftEndTime}
                                      </Typography>
                                      {shift.checkInTime && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          In: {shift.checkInTime.split(' ')[1]}
                                        </Typography>
                                      )}
                                      {shift.checkOutTime && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          Out: {shift.checkOutTime.split(' ')[1]}
                                        </Typography>
                                      )}
                                      {shift.paidHours > 0 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          {shift.paidHours.toFixed(1)}h tính lương
                                        </Typography>
                                      )}
                                      {shift.lateMinutes > 0 && (
                                        <Chip
                                          label={`Muộn ${shift.lateMinutes}p`}
                                          color={shift.isWaived ? 'default' : 'warning'}
                                          size="small"
                                          variant="outlined"
                                          sx={{ mt: 0.25, height: 16, fontSize: '0.65rem' }}
                                        />
                                      )}
                                      <Box sx={{ mt: 0.5 }}>{getShiftStatusLabel(shift)}</Box>

                                      {/* Waive actions — disabled when record is finalized */}
                                      {!selectedPayrollRecord?.isFinalized && !shift.isWaived &&
                                        (shift.status === 'Absent' ||
                                          shift.status === 'Wrong' ||
                                          (shift.status === 'Present' && shift.lateMinutes > 0)) && (
                                          <Box sx={{ mt: 0.5 }}>
                                            {isWaiving ? (
                                              <Stack spacing={0.5}>
                                                <TextField
                                                  size="small"
                                                  placeholder="Lý do..."
                                                  value={waiveReason}
                                                  onChange={(e) => setWaiveReason(e.target.value)}
                                                  inputProps={{ style: { fontSize: '0.75rem', padding: '4px 6px' } }}
                                                />
                                                <Stack direction="row" spacing={0.5}>
                                                  <Button size="small" variant="contained" color="info" sx={{ fontSize: '0.65rem', py: 0.25 }} onClick={() => handleWaivePenalty(shift)}>
                                                    OK
                                                  </Button>
                                                  <Button size="small" color="inherit" sx={{ fontSize: '0.65rem', py: 0.25 }} onClick={() => { setWaivingShiftId(null); setWaiveReason(''); }}>
                                                    Hủy
                                                  </Button>
                                                </Stack>
                                              </Stack>
                                            ) : (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="info"
                                                fullWidth
                                                sx={{ fontSize: '0.65rem', py: 0.25 }}
                                                startIcon={<Iconify icon="mingcute:shield-line" width={12} />}
                                                onClick={(e) => { e.stopPropagation(); setWaivingShiftId(shift.shiftAssignmentId); }}
                                              >
                                                Bỏ qua lỗi
                                              </Button>
                                            )}
                                          </Box>
                                        )}
                                      {!selectedPayrollRecord?.isFinalized && shift.isWaived && (
                                        <Box sx={{ mt: 0.5 }}>
                                          {shift.waiverReason && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                                              {shift.waiverReason}
                                            </Typography>
                                          )}
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            fullWidth
                                            sx={{ fontSize: '0.65rem', py: 0.25 }}
                                            startIcon={<Iconify icon="mingcute:close-line" width={12} />}
                                            onClick={(e) => { e.stopPropagation(); handleRemoveWaiver(shift); }}
                                          >
                                            Hủy bỏ qua
                                          </Button>
                                        </Box>
                                      )}
                                    </Box>
                                  );
                                })}
                              </Stack>
                            )}
                          </Paper>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              )}

              {/* ── TABLE VIEW ── */}
              {shiftDetailTab === 'table' && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ngày</TableCell>
                        <TableCell>Ca</TableCell>
                        <TableCell>Giờ ca</TableCell>
                        <TableCell>Check-in</TableCell>
                        <TableCell>Check-out</TableCell>
                        <TableCell>Giờ được tính lương</TableCell>
                        <TableCell>Đi muộn</TableCell>
                        <TableCell>Trạng thái</TableCell>
                        <TableCell align="center">Thao tác</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shiftDetail.shifts.map((shift) => (
                        <TableRow key={shift.shiftAssignmentId} hover>
                          <TableCell>
                            <strong>{shift.date}</strong>
                          </TableCell>
                          <TableCell>{shift.shiftName}</TableCell>
                          <TableCell>
                            {shift.shiftStartTime} - {shift.shiftEndTime}
                          </TableCell>
                          <TableCell>
                            {shift.checkInTime ? (
                              <Typography variant="body2">
                                {shift.checkInTime.split(' ')[1]}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {shift.checkOutTime ? (
                              <Typography variant="body2">
                                {shift.checkOutTime.split(' ')[1]}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {shift.paidHours > 0 ? `${shift.paidHours.toFixed(1)}h` : '—'}
                          </TableCell>
                          <TableCell>
                            {shift.lateMinutes > 0 ? (
                              <Chip
                                label={`${shift.lateMinutes} phút`}
                                color={shift.isWaived ? 'default' : 'warning'}
                                size="small"
                                variant={shift.isWaived ? 'outlined' : 'filled'}
                              />
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{getShiftStatusLabel(shift)}</TableCell>
                          <TableCell align="center">
                            {!selectedPayrollRecord?.isFinalized &&
                              !shift.isWaived &&
                              (shift.status === 'Absent' ||
                                shift.status === 'Wrong' ||
                                (shift.status === 'Present' && shift.lateMinutes > 0)) && (
                                <>
                                  {waivingShiftId === shift.shiftAssignmentId ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <TextField
                                        size="small"
                                        placeholder="Lý do..."
                                        value={waiveReason}
                                        onChange={(e) => setWaiveReason(e.target.value)}
                                        sx={{ width: 160 }}
                                      />
                                      <Button size="small" variant="contained" color="info" onClick={() => handleWaivePenalty(shift)}>
                                        Xác nhận
                                      </Button>
                                      <Button size="small" color="inherit" onClick={() => { setWaivingShiftId(null); setWaiveReason(''); }}>
                                        Hủy
                                      </Button>
                                    </Stack>
                                  ) : (
                                    <Tooltip title="Bỏ qua lỗi vi phạm">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="info"
                                        startIcon={<Iconify icon="mingcute:shield-line" />}
                                        onClick={(e) => { e.stopPropagation(); setWaivingShiftId(shift.shiftAssignmentId); }}
                                      >
                                        Bỏ qua lỗi
                                      </Button>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            {shift.isWaived && !selectedPayrollRecord?.isFinalized && (
                              <Stack spacing={0.5} alignItems="center">
                                {shift.waiverReason && (
                                  <Typography variant="caption" color="text.secondary">
                                    {shift.waiverReason}
                                  </Typography>
                                )}
                                <Tooltip title="Hủy bỏ qua lỗi">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<Iconify icon="mingcute:close-line" />}
                                    onClick={(e) => { e.stopPropagation(); handleRemoveWaiver(shift); }}
                                  >
                                    Hủy bỏ qua
                                  </Button>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {shiftDetail.shifts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                              Không có ca làm việc nào trong kỳ này
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShiftDetail} color="inherit">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
