'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import { useResponsive } from 'src/hooks/use-responsive';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import { AppDatePicker } from 'src/components/date-time-picker';
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

import type { ICalendarView } from 'src/types/calendar';
import type { ILateCoverRequest, IShiftAssignment } from 'src/types/corecms-api';

import { getMySchedule, getShiftAssignments } from 'src/api/attendance';
import { createLateCoverRequest, getMyLateCoverRequests } from 'src/api/lateCover';

import CalendarToolbar from '../../calendar/calendar-toolbar';
import { StyledCalendar } from '../../calendar/styles';

// ----------------------------------------------------------------------

type CoverMode = 'need-cover' | 'covering';

const TABLE_HEAD = [
  { id: 'lateStaff', label: 'Người đi muộn', width: 140 },
  { id: 'lateShift', label: 'Ca đi muộn', width: 155 },
  { id: 'coveringStaff', label: 'Người làm hộ', width: 140 },
  { id: 'coveringShift', label: 'Ca làm hộ', width: 155 },
  { id: 'coveringHours', label: 'Số giờ', width: 90 },
  { id: 'extraPay', label: 'Phụ cấp', width: 120 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 180 },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ----------------------------------------------------------------------

export default function MyLateCoverRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  // --- List ---
  const [requests, setRequests] = useState<ILateCoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarView, setCalendarView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarAssignments, setCalendarAssignments] = useState<IShiftAssignment[]>([]);

  // --- Create dialog ---
  const [openDialog, setOpenDialog] = useState(false);
  const [coverMode, setCoverMode] = useState<CoverMode>('need-cover');

  // My shift (role depends on mode)
  const [myDate, setMyDate] = useState(toDateStr(new Date()));
  const [myAssignments, setMyAssignments] = useState<IShiftAssignment[]>([]);
  const [myAssignmentId, setMyAssignmentId] = useState('');
  const [loadingMyShifts, setLoadingMyShifts] = useState(false);

  // Adjacent shift (from all shifts that day)
  const [allDayAssignments, setAllDayAssignments] = useState<IShiftAssignment[]>([]);
  const [adjacentAssignmentId, setAdjacentAssignmentId] = useState('');
  const [loadingDayShifts, setLoadingDayShifts] = useState(false);
  const [reason, setReason] = useState('');

  // --- Fetch list ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyLateCoverRequests();
      setRequests(data);
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Calendar ---
  const fetchCalendarAssignments = useCallback(async () => {
    if (!authUser?.id) return;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const from = toDateStr(new Date(year, month, 1));
    const to = toDateStr(new Date(year, month + 1, 0));
    try {
      const data = await getMySchedule(from, to);
      setCalendarAssignments(data);
    } catch { /* silent */ }
  }, [authUser?.id, calendarDate]);

  useEffect(() => {
    if (viewMode === 'calendar') fetchCalendarAssignments();
  }, [viewMode, fetchCalendarAssignments]);

  // --- Load MY shifts when myDate changes ---
  useEffect(() => {
    if (!authUser?.id || !myDate || !openDialog) return;
    setLoadingMyShifts(true);
    setMyAssignmentId('');
    setAdjacentAssignmentId('');
    getShiftAssignments(myDate, myDate, authUser.id)
      .then(setMyAssignments)
      .catch(() => setMyAssignments([]))
      .finally(() => setLoadingMyShifts(false));
  }, [myDate, authUser?.id, openDialog]);

  // --- Load ALL shifts that day when myAssignmentId changes ---
  useEffect(() => {
    if (!myAssignmentId || !myDate) return;
    setLoadingDayShifts(true);
    setAdjacentAssignmentId('');
    // Load all assignments for that day (no staffId filter)
    getShiftAssignments(myDate, myDate)
      .then(setAllDayAssignments)
      .catch(() => setAllDayAssignments([]))
      .finally(() => setLoadingDayShifts(false));
  }, [myAssignmentId, myDate]);

  // --- Find my assignment object ---
  const myAssignmentObj = useMemo(
    () => myAssignments.find((a) => (a.id || (a as any).assignmentId) === myAssignmentId),
    [myAssignments, myAssignmentId]
  );

  // --- Filter adjacent shifts ---
  const adjacentShifts = useMemo(() => {
    if (!myAssignmentObj) return [];
    const myStart = timeToMinutes(myAssignmentObj.startTime);
    const myEnd = timeToMinutes(myAssignmentObj.endTime);
    return allDayAssignments.filter((a) => {
      if ((a.staffId || (a as any).staffId) === authUser?.id) return false; // exclude myself
      const aEnd = timeToMinutes(a.endTime);
      const aStart = timeToMinutes(a.startTime);
      if (coverMode === 'need-cover') {
        // ca trước: kết thúc <= giờ bắt đầu của tôi (trong vòng 2h)
        return aEnd <= myStart && myStart - aEnd <= 120;
      } else {
        // ca sau: bắt đầu >= giờ kết thúc của tôi (trong vòng 2h)
        return aStart >= myEnd && aStart - myEnd <= 120;
      }
    });
  }, [allDayAssignments, myAssignmentObj, coverMode, authUser?.id]);

  // --- Open dialog ---
  const handleOpenDialog = async (prefilledAssignmentId?: string) => {
    if (prefilledAssignmentId && authUser?.id) {
      const a = calendarAssignments.find(
        (x: any) => (x.id || x.assignmentId) === prefilledAssignmentId
      );
      if (a) {
        const dateStr = a.date?.split('T')[0] ?? toDateStr(new Date());
        setMyDate(dateStr);
        setMyAssignmentId(prefilledAssignmentId);
        const fresh = await getShiftAssignments(dateStr, dateStr, authUser.id);
        setMyAssignments(fresh);
      }
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setMyDate(toDateStr(new Date()));
    setMyAssignments([]);
    setMyAssignmentId('');
    setAllDayAssignments([]);
    setAdjacentAssignmentId('');
    setReason('');
  };

  const handleModeChange = (_: any, newMode: CoverMode) => {
    if (!newMode) return;
    setCoverMode(newMode);
    setAdjacentAssignmentId('');
  };

  const handleSubmit = async () => {
    if (!myAssignmentId || !adjacentAssignmentId) return;

    const adjacentObj = allDayAssignments.find(
      (a) => (a.id || (a as any).assignmentId) === adjacentAssignmentId
    );
    if (!adjacentObj || !authUser?.id) return;

    const adjacentStaffId = (adjacentObj as any).staffId;

    const payload = coverMode === 'need-cover'
      ? {
          lateStaffId: authUser.id,
          coveringStaffId: adjacentStaffId,
          lateStaffAssignmentId: myAssignmentId,
          coveringStaffAssignmentId: adjacentAssignmentId,
          reason: reason || undefined,
        }
      : {
          lateStaffId: adjacentStaffId,
          coveringStaffId: authUser.id,
          lateStaffAssignmentId: adjacentAssignmentId,
          coveringStaffAssignmentId: myAssignmentId,
          reason: reason || undefined,
        };

    try {
      await createLateCoverRequest(payload);
      enqueueSnackbar('Tạo yêu cầu làm hộ thành công!', { variant: 'success' });
      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Tạo yêu cầu thất bại!', { variant: 'error' });
    }
  };

  // --- Calendar events ---
  const calendarEvents = useMemo(() =>
    calendarAssignments.map((a: any) => {
      const dateStr = (a.date ?? '').split('T')[0];
      const id = a.id || a.assignmentId;
      const req = requests.find((r) =>
        r.lateStaffAssignmentId === id || r.coveringStaffAssignmentId === id
      );
      const color = req
        ? req.status === 'Approved' ? '#388e3c' : req.status === 'Rejected' ? '#d32f2f' : '#f57c00'
        : '#1976d2';
      return {
        id,
        title: a.scheduleName || a.shiftName || 'Ca làm việc',
        start: dateStr && a.startTime ? `${dateStr}T${a.startTime}` : dateStr,
        end: dateStr && a.endTime ? `${dateStr}T${a.endTime}` : dateStr,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { assignmentId: id, hasRequest: !!req },
      };
    }),
  [calendarAssignments, requests]);

  const handleEventClick = (arg: EventClickArg) => {
    const assignmentId = arg.event.extendedProps?.assignmentId as string;
    handleOpenDialog(assignmentId);
  };

  // --- Helpers ---
  const getStatusColor = (s: string) =>
    s === 'Approved' ? 'success' : s === 'Rejected' ? 'error' : 'warning';
  const getStatusLabel = (s: string) =>
    s === 'Approved' ? 'Đã duyệt' : s === 'Rejected' ? 'Từ chối' : 'Chờ duyệt';
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '-');
  const fmtCurrency = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  const fmtAssignment = (a: IShiftAssignment) => {
    const name = (a as any).scheduleName || (a as any).shiftName || 'Ca làm việc';
    const staff = (a as any).staffName ? ` — ${(a as any).staffName}` : '';
    return `${name} (${a.startTime?.slice(0, 5)} - ${a.endTime?.slice(0, 5)})${staff}`;
  };

  const adjacentLabel = coverMode === 'need-cover'
    ? 'Ca trước (người sẽ làm hộ tôi)'
    : 'Ca sau (người tôi làm hộ)';

  const modeDescription = coverMode === 'need-cover'
    ? 'Tôi sẽ đi muộn và cần người ca trước ở lại làm hộ'
    : 'Tôi ở lại sau ca để làm hộ người ca tiếp theo';

  const isFormValid = !!myAssignmentId && !!adjacentAssignmentId;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Yêu cầu làm hộ của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Làm hộ' },
          { name: 'Yêu cầu của tôi' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
            >
              <ToggleButton value="table"><Iconify icon="eva:list-fill" /></ToggleButton>
              <ToggleButton value="calendar"><Iconify icon="eva:calendar-fill" /></ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => handleOpenDialog()}
            >
              Tạo yêu cầu
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* ===== CALENDAR VIEW ===== */}
      {viewMode === 'calendar' && (
        <Card sx={{ p: 2 }}>
          <CalendarToolbar
            date={calendarDate}
            view={calendarView}
            loading={false}
            onNextDate={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); }}
            onPrevDate={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); }}
            onToday={() => setCalendarDate(new Date())}
            onChangeView={setCalendarView}
            onOpenFilters={() => {}}
          />
          <StyledCalendar>
            <Calendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={calendarView}
              headerToolbar={false}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="auto"
              locale="vi"
              buttonText={{ today: 'Hôm nay', month: 'Tháng', week: 'Tuần', day: 'Ngày', list: 'Danh sách' }}
            />
          </StyledCalendar>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            {[
              { color: '#1976d2', label: 'Chưa có yêu cầu' },
              { color: '#f57c00', label: 'Đang chờ duyệt' },
              { color: '#388e3c', label: 'Đã duyệt' },
              { color: '#d32f2f', label: 'Bị từ chối' },
            ].map((item) => (
              <Stack key={item.label} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: item.color }} />
                <Typography variant="caption">{item.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      {/* ===== TABLE VIEW ===== */}
      {viewMode === 'table' && (
        <Card>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <>
              <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                <Scrollbar>
                  <Table size={table.dense ? 'small' : 'medium'}>
                    <TableHeadCustom headLabel={TABLE_HEAD} />
                    <TableBody>
                      {requests.map((row) => (
                        <tr key={row.id}>
                          <td style={{ padding: '16px' }}>{row.lateStaffName}</td>
                          <td style={{ padding: '16px' }}>
                            {row.lateShiftName}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {fmt(row.lateShiftDate)}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px' }}>{row.coveringStaffName}</td>
                          <td style={{ padding: '16px' }}>
                            {row.coveringShiftName}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {fmt(row.coveringShiftDate)}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <Tooltip title={`Lương giờ: ${fmtCurrency(row.lateStaffHourlyRate)}/h`}>
                              <span>{row.coveringHours.toFixed(2)}h</span>
                            </Tooltip>
                          </td>
                          <td style={{ padding: '16px', fontWeight: 600, color: '#1976d2' }}>
                            {fmtCurrency(row.extraPayAmount)}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <Label color={getStatusColor(row.status)}>{getStatusLabel(row.status)}</Label>
                          </td>
                          <td style={{ padding: '16px' }}>{row.reviewNote || '-'}</td>
                        </tr>
                      ))}
                      {requests.length === 0 && <TableNoData notFound />}
                    </TableBody>
                  </Table>
                </Scrollbar>
              </TableContainer>
              <TablePaginationCustom
                count={requests.length}
                page={table.page}
                rowsPerPage={table.rowsPerPage}
                onPageChange={table.onChangePage}
                onRowsPerPageChange={table.onChangeRowsPerPage}
              />
            </>
          )}
        </Card>
      )}

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo yêu cầu làm hộ</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>

            {/* Mode selector */}
            <Tabs
              value={coverMode}
              onChange={handleModeChange as any}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                value="need-cover"
                label={
                  <Stack alignItems="center">
                    <Iconify icon="eva:person-add-outline" />
                    <Typography variant="caption">Tôi cần người làm hộ</Typography>
                  </Stack>
                }
              />
              <Tab
                value="covering"
                label={
                  <Stack alignItems="center">
                    <Iconify icon="eva:shield-outline" />
                    <Typography variant="caption">Tôi đang làm hộ người khác</Typography>
                  </Stack>
                }
              />
            </Tabs>

            <Alert severity="info" sx={{ py: 0.5 }}>{modeDescription}</Alert>

            {/* My shift */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'primary.main' }}>
                {coverMode === 'need-cover' ? 'Ca của tôi (ca bị đi muộn)' : 'Ca của tôi (ca đang làm)'}
              </Typography>
              <Stack spacing={2}>
                <AppDatePicker
                  fullWidth
                  label="Chọn ngày"
                  value={myDate}
                  onChange={setMyDate}
                />
                <TextField
                  select
                  fullWidth
                  label="Ca của tôi"
                  value={myAssignmentId}
                  onChange={(e) => setMyAssignmentId(e.target.value)}
                  disabled={loadingMyShifts}
                  helperText={
                    loadingMyShifts
                      ? 'Đang tải...'
                      : myAssignments.length === 0
                      ? 'Không có ca nào trong ngày này'
                      : ''
                  }
                >
                  {myAssignments.map((a) => (
                    <MenuItem key={a.id || (a as any).assignmentId} value={a.id || (a as any).assignmentId}>
                      {fmtAssignment(a)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>

            {/* Adjacent shift */}
            {myAssignmentId && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  {adjacentLabel}
                </Typography>
                {loadingDayShifts ? (
                  <CircularProgress size={20} />
                ) : adjacentShifts.length === 0 ? (
                  <Alert severity="warning">
                    Không tìm thấy ca {coverMode === 'need-cover' ? 'trước' : 'sau'} liền kề trong ngày này
                  </Alert>
                ) : (
                  <TextField
                    select
                    fullWidth
                    label={adjacentLabel}
                    value={adjacentAssignmentId}
                    onChange={(e) => setAdjacentAssignmentId(e.target.value)}
                  >
                    {adjacentShifts.map((a) => (
                      <MenuItem key={a.id || (a as any).assignmentId} value={a.id || (a as any).assignmentId}>
                        {fmtAssignment(a)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Hệ thống tự tính thời gian và phụ cấp từ dữ liệu chấm công sau khi duyệt
                </Typography>
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Lý do (tuỳ chọn)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid}>
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
