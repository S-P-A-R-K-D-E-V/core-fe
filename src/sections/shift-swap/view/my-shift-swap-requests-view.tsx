'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import { useResponsive } from 'src/hooks/use-responsive';

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

import type { ICalendarView } from 'src/types/calendar';
import type { IShiftAssignment, IShiftSwapRequest } from 'src/types/corecms-api';

import { getMySchedule, getShiftAssignments } from 'src/api/attendance';
import { createShiftSwapRequest, getMyShiftSwapRequests } from 'src/api/shiftSwap';
import { getAllUsers } from 'src/api/users';

import CalendarToolbar from '../../calendar/calendar-toolbar';
import { StyledCalendar } from '../../calendar/styles';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'currentShift', label: 'Ca của tôi', width: 180 },
  { id: 'currentDate', label: 'Ngày', width: 110 },
  { id: 'targetUser', label: 'Đổi với', width: 150 },
  { id: 'targetShift', label: 'Ca đổi', width: 180 },
  { id: 'targetDate', label: 'Ngày', width: 110 },
  { id: 'reason', label: 'Lý do', width: 180 },
  { id: 'status', label: 'Trạng thái', width: 130 },
  { id: 'reviewNote', label: 'Phản hồi', width: 180 },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ----------------------------------------------------------------------

export default function MyShiftSwapRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  // --- List state ---
  const [requests, setRequests] = useState<IShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarView, setCalendarView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarAssignments, setCalendarAssignments] = useState<IShiftAssignment[]>([]);

  // --- Create dialog state ---
  const [openDialog, setOpenDialog] = useState(false);

  // My shift
  const [myDate, setMyDate] = useState(toDateStr(new Date()));
  const [myAssignments, setMyAssignments] = useState<IShiftAssignment[]>([]);
  const [myAssignmentId, setMyAssignmentId] = useState('');
  const [loadingMyAssignments, setLoadingMyAssignments] = useState(false);

  // Target shift
  const [targetDate, setTargetDate] = useState(toDateStr(new Date()));
  const [targetUserId, setTargetUserId] = useState('');
  const [targetAssignments, setTargetAssignments] = useState<IShiftAssignment[]>([]);
  const [targetAssignmentId, setTargetAssignmentId] = useState('');
  const [loadingTargetAssignments, setLoadingTargetAssignments] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [reason, setReason] = useState('');

  // --- Fetch list ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyShiftSwapRequests();
      setRequests(data);
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Calendar assignments ---
  const fetchCalendarAssignments = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const from = toDateStr(new Date(year, month, 1));
      const to = toDateStr(new Date(year, month + 1, 0));
      const data = await getMySchedule(from, to);
      setCalendarAssignments(data);
    } catch {
      // silent
    }
  }, [authUser?.id, calendarDate]);

  useEffect(() => {
    if (viewMode === 'calendar') fetchCalendarAssignments();
  }, [viewMode, fetchCalendarAssignments]);

  // --- Load my assignments when myDate changes ---
  useEffect(() => {
    if (!authUser?.id || !myDate || !openDialog) return;
    setLoadingMyAssignments(true);
    setMyAssignmentId('');
    getShiftAssignments(myDate, myDate, authUser.id)
      .then(setMyAssignments)
      .catch(() => setMyAssignments([]))
      .finally(() => setLoadingMyAssignments(false));
  }, [myDate, authUser?.id, openDialog]);

  // --- Load target assignments when targetDate + targetUserId changes ---
  useEffect(() => {
    if (!targetUserId || !targetDate || !openDialog) return;
    setLoadingTargetAssignments(true);
    setTargetAssignmentId('');
    getShiftAssignments(targetDate, targetDate, targetUserId)
      .then(setTargetAssignments)
      .catch(() => setTargetAssignments([]))
      .finally(() => setLoadingTargetAssignments(false));
  }, [targetDate, targetUserId, openDialog]);

  // --- Open dialog ---
  const handleOpenDialog = async (prefilledAssignmentId?: string) => {
    try {
      const userData = await getAllUsers();
      setUsers(userData);
      if (prefilledAssignmentId && authUser?.id) {
        // Pre-fill from calendar click
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
    } catch {
      enqueueSnackbar('Không thể mở form', { variant: 'error' });
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setMyDate(toDateStr(new Date()));
    setMyAssignments([]);
    setMyAssignmentId('');
    setTargetDate(toDateStr(new Date()));
    setTargetUserId('');
    setTargetAssignments([]);
    setTargetAssignmentId('');
    setReason('');
  };

  const handleSubmit = async () => {
    if (!myAssignmentId || !targetUserId) return;
    try {
      await createShiftSwapRequest({
        currentShiftAssignmentId: myAssignmentId,
        targetUserId,
        targetShiftAssignmentId: targetAssignmentId || undefined,
        reason: reason || undefined,
      } as any);
      enqueueSnackbar('Tạo yêu cầu đổi ca thành công!', { variant: 'success' });
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
      return {
        id,
        title: a.scheduleName || a.shiftName || 'Ca làm việc',
        start: dateStr && a.startTime ? `${dateStr}T${a.startTime}` : dateStr,
        end: dateStr && a.endTime ? `${dateStr}T${a.endTime}` : dateStr,
        backgroundColor: '#1976d2',
        borderColor: '#1565c0',
        extendedProps: { assignmentId: id },
      };
    }),
  [calendarAssignments]);

  const handleEventClick = (arg: EventClickArg) => {
    const assignmentId = arg.event.extendedProps?.assignmentId as string;
    handleOpenDialog(assignmentId);
  };

  // --- Helpers ---
  const getStatusColor = (status: string) => {
    if (status === 'Approved') return 'success';
    if (status === 'Rejected') return 'error';
    if (status === 'Cancelled') return 'default';
    if (status === 'WaitingTargetConfirmation') return 'info';
    return 'warning';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      Pending: 'Chờ admin duyệt',
      WaitingTargetConfirmation: 'Chờ xác nhận',
      Approved: 'Đã duyệt',
      Rejected: 'Từ chối',
      Cancelled: 'Đã huỷ',
    };
    return map[status] ?? status;
  };

  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '-');

  const fmtAssignment = (a: IShiftAssignment) => {
    const name = (a as any).scheduleName || (a as any).shiftName || 'Ca làm việc';
    return `${name} (${a.startTime?.slice(0, 5)} - ${a.endTime?.slice(0, 5)})`;
  };

  const isFormValid = !!myAssignmentId && !!targetUserId;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Yêu cầu đổi ca của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca' },
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
            onNextDate={() => {
              const d = new Date(calendarDate);
              d.setMonth(d.getMonth() + 1);
              setCalendarDate(d);
            }}
            onPrevDate={() => {
              const d = new Date(calendarDate);
              d.setMonth(d.getMonth() - 1);
              setCalendarDate(d);
            }}
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
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Click vào ca làm việc để tạo yêu cầu đổi ca
          </Typography>
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
                          <td style={{ padding: '16px' }}>{row.currentShiftName}</td>
                          <td style={{ padding: '16px' }}>{fmt(row.currentShiftDate)}</td>
                          <td style={{ padding: '16px' }}>{row.targetUserName || '-'}</td>
                          <td style={{ padding: '16px' }}>{row.targetShiftName || '-'}</td>
                          <td style={{ padding: '16px' }}>{fmt(row.targetShiftDate)}</td>
                          <td style={{ padding: '16px' }}>{row.reason || '-'}</td>
                          <td style={{ padding: '16px' }}>
                            <Label color={getStatusColor(row.status)}>
                              {getStatusLabel(row.status)}
                            </Label>
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
        <DialogTitle>Tạo yêu cầu đổi ca</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>

            {/* === CA CỦA TÔI === */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'primary.main' }}>
                Ca của tôi
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="date"
                  label="Chọn ngày"
                  value={myDate}
                  onChange={(e) => setMyDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: toDateStr(new Date()) }}
                />
                <TextField
                  select
                  fullWidth
                  label="Ca làm của tôi hôm đó"
                  value={myAssignmentId}
                  onChange={(e) => setMyAssignmentId(e.target.value)}
                  disabled={loadingMyAssignments}
                  helperText={
                    loadingMyAssignments
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

            {/* === CA MUỐN ĐỔI === */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                Ca muốn đổi (của nhân viên kia)
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày ca muốn đổi"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  select
                  fullWidth
                  label="Chọn nhân viên"
                  value={targetUserId}
                  onChange={(e) => {
                    setTargetUserId(e.target.value);
                    setTargetAssignmentId('');
                  }}
                >
                  {users.filter((u) => u.id !== authUser?.id).map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.fullName}
                    </MenuItem>
                  ))}
                </TextField>
                {targetUserId && (
                  <TextField
                    select
                    fullWidth
                    label="Ca của nhân viên đó"
                    value={targetAssignmentId}
                    onChange={(e) => setTargetAssignmentId(e.target.value)}
                    disabled={loadingTargetAssignments}
                    helperText={
                      loadingTargetAssignments
                        ? 'Đang tải...'
                        : targetAssignments.length === 0
                        ? 'Nhân viên không có ca ngày này'
                        : 'Tuỳ chọn — để trống nếu đổi bất kỳ ca nào'
                    }
                  >
                    <MenuItem value="">— Bất kỳ ca nào —</MenuItem>
                    {targetAssignments.map((a) => (
                      <MenuItem key={a.id || (a as any).assignmentId} value={a.id || (a as any).assignmentId}>
                        {fmtAssignment(a)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>
            </Box>

            {/* === LÝ DO === */}
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Lý do đổi ca"
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
