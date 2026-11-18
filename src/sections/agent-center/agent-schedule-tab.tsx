import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';
import type { IAgentSchedule, IAgentDefinition } from 'src/api/agent-center';

import Calendar from '@fullcalendar/react'; // => request placed at the top
import listPlugin from '@fullcalendar/list';
import viLocale from '@fullcalendar/core/locales/vi';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useResponsive } from 'src/hooks/use-responsive';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import {
  useAgentSchedules,
  updateAgentSchedule,
  useAgentScheduleOccurrences,
} from 'src/api/agent-center';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';

import { StyledCalendar } from 'src/sections/calendar/styles';

import { describeCron } from './agent-center-utils';
import AgentScheduleDialog from './agent-schedule-dialog';

// ----------------------------------------------------------------------
// Lịch chạy: các lần chạy sắp tới của mọi lịch (GET schedules/occurrences theo khoảng đang xem) trên bộ lịch của template;
// bấm một lần chạy → hộp lịch. Bên dưới: danh sách lịch, công tắc bật / tắt (agent.manage).
// ----------------------------------------------------------------------

type CalView = 'dayGridMonth' | 'timeGridWeek' | 'listWeek';

const VIEWS: { value: CalView; label: string }[] = [
  { value: 'dayGridMonth', label: 'Tháng' },
  { value: 'timeGridWeek', label: 'Tuần' },
  { value: 'listWeek', label: 'Danh sách' },
];

const AGENT_COLORS = [
  '#00A76F',
  '#8E33FF',
  '#00B8D9',
  '#FFAB00',
  '#FF5630',
  '#3366FF',
  '#7A4100',
  '#637381',
];

function colorFor(agentId: string, order: string[]): string {
  const i = order.indexOf(agentId);
  return AGENT_COLORS[(i >= 0 ? i : 0) % AGENT_COLORS.length];
}

type Props = {
  agents: IAgentDefinition[];
  canManage: boolean;
  onOpenTask: (taskId: string) => void;
};

export default function AgentScheduleTab({ agents, canManage, onOpenTask }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<Calendar>(null);

  const { schedules, loading, error, refresh } = useAgentSchedules();
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const occ = useAgentScheduleOccurrences(range);

  const [view, setView] = useState<CalView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [title, setTitle] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; schedule: IAgentSchedule | null }>({
    open: false,
    schedule: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const agentOrder = useMemo(() => agents.map((a) => a.id), [agents]);

  const events = useMemo(
    () =>
      occ.occurrences.map((o) => {
        const color = colorFor(o.agentId, agentOrder);
        return {
          id: `${o.scheduleId}|${o.at}`,
          title: `${o.agentName} – ${o.name}`,
          start: o.at,
          allDay: false,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          extendedProps: { scheduleId: o.scheduleId },
        };
      }),
    [occ.occurrences, agentOrder]
  );

  const api = () => calendarRef.current?.getApi();

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    setRange((prev) => (prev?.from === from && prev?.to === to ? prev : { from, to }));
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const id = arg.event.extendedProps.scheduleId as string;
      const schedule = schedules.find((s) => s.id === id);
      if (schedule) setDialog({ open: true, schedule });
    },
    [schedules]
  );

  const handleToggle = async (s: IAgentSchedule) => {
    setBusyId(s.id);
    try {
      await updateAgentSchedule(s.id, {
        agentId: s.agentId,
        name: s.name,
        cron: s.cron,
        instruction: s.instruction,
        enabled: !s.enabled,
      });
      enqueueSnackbar(s.enabled ? `Đã tắt lịch "${s.name}"` : `Đã bật lịch "${s.name}"`);
      refresh();
      occ.refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Đổi trạng thái lịch thất bại'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const onSaved = () => {
    refresh();
    occ.refresh();
  };

  return (
    <Stack spacing={3}>
      <Card>
        <StyledCalendar>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ p: 2, position: 'relative' }}
          >
            <IconButton onClick={() => api()?.prev()}>
              <Iconify icon="eva:arrow-ios-back-fill" />
            </IconButton>
            <Typography variant="h6" sx={{ minWidth: 160, textAlign: 'center' }}>
              {title}
            </Typography>
            <IconButton onClick={() => api()?.next()}>
              <Iconify icon="eva:arrow-ios-forward-fill" />
            </IconButton>
            <Button size="small" variant="outlined" color="inherit" onClick={() => api()?.today()}>
              Hôm nay
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_, v: CalView | null) => {
                if (!v) return;
                setView(v);
                api()?.changeView(v);
              }}
            >
              {VIEWS.map((v) => (
                <ToggleButton key={v.value} value={v.value}>
                  {v.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {canManage && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setDialog({ open: true, schedule: null })}
                disabled={agents.length === 0}
              >
                Thêm lịch
              </Button>
            )}
            {occ.loading && (
              <LinearProgress
                color="inherit"
                sx={{ height: 2, width: 1, position: 'absolute', bottom: 0, left: 0 }}
              />
            )}
          </Stack>

          {!!occ.error && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              {apiErrorMessage(occ.error, 'Không tải được các lần chạy sắp tới')}
            </Alert>
          )}

          <Calendar
            ref={calendarRef}
            weekends
            locale={viLocale}
            firstDay={1}
            editable={false}
            selectable={false}
            headerToolbar={false}
            initialView={view}
            dayMaxEventRows={3}
            eventDisplay="block"
            defaultTimedEventDuration="00:30"
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            noEventsText="Không có lần chạy nào"
            events={events}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height={smUp ? 640 : 'auto'}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          />
        </StyledCalendar>
      </Card>

      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Các lịch chạy
        </Typography>

        {!!error && (
          <Alert severity="error">{apiErrorMessage(error, 'Không tải được lịch chạy')}</Alert>
        )}
        {loading && <Skeleton variant="rounded" height={120} />}
        {!loading && !error && schedules.length === 0 && (
          <EmptyContent
            filled
            title="Chưa có lịch chạy"
            description={
              canManage
                ? 'Thêm lịch để agent tự chạy theo giờ (vd báo cáo sáng 7:30).'
                : 'Chủ cửa hàng chưa đặt lịch chạy cho agent.'
            }
            sx={{ py: 6 }}
          />
        )}

        <Stack spacing={1.5}>
          {schedules.map((s) => {
            const cron = describeCron(s.cron);
            return (
              <Card
                key={s.id}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': { boxShadow: (t) => t.customShadows.z8 },
                }}
                onClick={() => setDialog({ open: true, schedule: s })}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: colorFor(s.agentId, agentOrder),
                    }}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="subtitle2">{s.name}</Typography>
                      <Label variant="soft">{s.agentName}</Label>
                      {!s.enabled && (
                        <Label color="default" variant="outlined">
                          Đang tắt
                        </Label>
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {cron.ok ? cron.text : s.cron}{' '}
                      <Box
                        component="span"
                        sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.disabled' }}
                      >
                        ({s.cron})
                      </Box>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Lần tới: {s.enabled && s.nextRunAt ? fDateTime(s.nextRunAt) : '—'} · Lần
                      trước: {s.lastRunAt ? fDateTime(s.lastRunAt) : '—'}
                    </Typography>
                  </Box>
                  {s.lastTaskId && (
                    <Tooltip title="Xem việc của lần chạy trước">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTask(s.lastTaskId as string);
                        }}
                      >
                        <Iconify icon="solar:eye-bold" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canManage && (
                    <Switch
                      checked={s.enabled}
                      disabled={busyId === s.id}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleToggle(s)}
                      inputProps={{ 'aria-label': `Bật / tắt lịch ${s.name}` }}
                    />
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Box>

      <AgentScheduleDialog
        open={dialog.open}
        schedule={dialog.schedule}
        agents={agents}
        canManage={canManage}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={onSaved}
        onOpenTask={(id) => {
          setDialog((d) => ({ ...d, open: false }));
          onOpenTask(id);
        }}
      />
    </Stack>
  );
}
