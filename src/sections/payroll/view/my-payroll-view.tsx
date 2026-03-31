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

import type { IPayrollRecord, IPayrollShiftDetailResponse, IPayrollShiftItem } from 'src/types/corecms-api';

import { getMyPayroll, getPayrollShiftDetails } from 'src/api/payroll';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'periodMonth', label: 'Kỳ lương', width: 160 },
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

export default function MyPayrollView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [payrolls, setPayrolls] = useState<IPayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Only finalized records are visible to staff
  const finalizedPayrolls = useMemo(() => payrolls.filter((p) => p.isFinalized), [payrolls]);
  const paginatedPayrolls = finalizedPayrolls.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  // Shift detail dialog
  const [openShiftDetail, setOpenShiftDetail] = useState(false);
  const [shiftDetailLoading, setShiftDetailLoading] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<IPayrollShiftDetailResponse | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<IPayrollRecord | null>(null);
  const [shiftDetailTab, setShiftDetailTab] = useState<'calendar' | 'table'>('calendar');
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyPayroll();
      setPayrolls(data);
    } catch (error) {
      console.error('Failed to fetch payroll:', error);
      enqueueSnackbar('Không thể tải dữ liệu bảng lương', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const handleOpenShiftDetail = async (row: IPayrollRecord) => {
    try {
      setSelectedPayroll(row);
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
    setSelectedPayroll(null);
    setShiftDetailTab('calendar');
    setCalendarWeekOffset(0);
  };

  // Calendar week helpers
  const calendarWeeks = useMemo(() => {
    if (!shiftDetail) return [];
    const shiftsByDate = new Map<string, typeof shiftDetail.shifts>();
    for (const s of shiftDetail.shifts) {
      const existing = shiftsByDate.get(s.date) ?? [];
      shiftsByDate.set(s.date, [...existing, s]);
    }
    if (shiftDetail.shifts.length === 0) return [];
    const parseDate = (d: string) => new Date(d);
    const rangeStart = parseDate(shiftDetail.fromDate);
    const rangeEnd = parseDate(shiftDetail.toDate);
    const startMonday = new Date(rangeStart);
    const dayOfWeek = startMonday.getDay();
    startMonday.setDate(startMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weeks: { weekLabel: string; days: { date: string; dayLabel: string; isWeekend: boolean; shifts: typeof shiftDetail.shifts }[] }[] = [];
    const current = new Date(startMonday);
    while (current <= rangeEnd) {
      const weekDays: { date: string; dayLabel: string; isWeekend: boolean; shifts: typeof shiftDetail.shifts }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        weekDays.push({
          date: dateStr,
          dayLabel: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          shifts: shiftsByDate.get(dateStr) ?? [],
        });
      }
      weeks.push({ weekLabel: `${weekDays[0].date} → ${weekDays[6].date}`, days: weekDays });
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }, [shiftDetail]);

  const theme = useTheme();

  const getShiftCardColor = (shift: IPayrollShiftItem) => {
    if (shift.isWaived) return { bg: alpha(theme.palette.info.main, 0.08), border: theme.palette.info.main };
    if (shift.status === 'Absent') return { bg: alpha(theme.palette.error.main, 0.08), border: theme.palette.error.main };
    if (shift.status === 'Wrong') return { bg: alpha(theme.palette.warning.main, 0.1), border: theme.palette.warning.main };
    if (shift.lateMinutes > 0) return { bg: alpha(theme.palette.warning.main, 0.08), border: theme.palette.warning.light };
    return { bg: alpha(theme.palette.success.main, 0.08), border: theme.palette.success.main };
  };

  const getShiftStatusLabel = (shift: IPayrollShiftItem) => {
    if (shift.isWaived) return <Label color="info">Đã bỏ qua lỗi</Label>;
    if (shift.status === 'Present' && shift.lateMinutes > 0)
      return <Label color="warning">Đi muộn {shift.lateMinutes}p</Label>;
    if (shift.status === 'Present') return <Label color="success">Có mặt</Label>;
    if (shift.status === 'Wrong') return <Label color="error">Sai ca</Label>;
    return <Label color="error">Vắng</Label>;
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bảng lương của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Lương' },
          { name: 'Bảng lương của tôi' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            {finalizedPayrolls.length === 0 && !loading && (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Chưa có bảng lương nào được duyệt. Vui lòng liên hệ quản lý.
                </Typography>
              </Stack>
            )}

            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table size={table.dense ? 'small' : 'medium'}>
                  <TableHeadCustom headLabel={TABLE_HEAD} />

                  <TableBody>
                    {paginatedPayrolls.map((row) => (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleOpenShiftDetail(row)}
                      >
                        <TableCell>
                          <Stack>
                            <strong>{row.periodMonth}</strong>
                            <Typography variant="caption" color="text.secondary">
                              {row.fromDate} → {row.toDate}
                            </Typography>
                          </Stack>
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
                          <Label color="success">Đã duyệt</Label>
                        </TableCell>
                      </TableRow>
                    ))}

                    {finalizedPayrolls.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={finalizedPayrolls.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>

      {/* Shift detail dialog (read-only for staff) */}
      <Dialog
        open={openShiftDetail}
        onClose={handleCloseShiftDetail}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Chi tiết ca làm việc</Typography>
            <IconButton onClick={handleCloseShiftDetail} size="small">
              <Iconify icon="mingcute:close-line" />
            </IconButton>
          </Stack>
          {selectedPayroll && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Kỳ lương: {selectedPayroll.fromDate} → {selectedPayroll.toDate}
              </Typography>
              <Label color="success">Đã duyệt</Label>
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
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            ) : (
                              <Stack spacing={0.75}>
                                {day.shifts.map((shift) => {
                                  const colors = getShiftCardColor(shift);
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shiftDetail.shifts.map((shift) => (
                        <TableRow key={shift.shiftAssignmentId} hover>
                          <TableCell><strong>{shift.date}</strong></TableCell>
                          <TableCell>{shift.shiftName}</TableCell>
                          <TableCell>{shift.shiftStartTime} - {shift.shiftEndTime}</TableCell>
                          <TableCell>
                            {shift.checkInTime ? (
                              <Typography variant="body2">{shift.checkInTime.split(' ')[1]}</Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {shift.checkOutTime ? (
                              <Typography variant="body2">{shift.checkOutTime.split(' ')[1]}</Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>{shift.paidHours > 0 ? `${shift.paidHours.toFixed(1)}h` : '—'}</TableCell>
                          <TableCell>
                            {shift.lateMinutes > 0 ? (
                              <Chip
                                label={`${shift.lateMinutes} phút`}
                                color={shift.isWaived ? 'default' : 'warning'}
                                size="small"
                                variant={shift.isWaived ? 'outlined' : 'filled'}
                              />
                            ) : '—'}
                          </TableCell>
                          <TableCell>{getShiftStatusLabel(shift)}</TableCell>
                        </TableRow>
                      ))}
                      {shiftDetail.shifts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
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
