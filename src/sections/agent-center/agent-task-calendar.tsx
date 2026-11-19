import type { IAgentTask } from 'src/api/agent-center';
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';

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
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useResponsive } from 'src/hooks/use-responsive';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAgentTaskList, useAgentScheduleOccurrences } from 'src/api/agent-center';

import Iconify from 'src/components/iconify';

import { StyledCalendar } from 'src/sections/calendar/styles';

import { filterTasks, columnOfStatus } from './agent-center-utils';

import type { TaskFilterState } from './agent-task-toolbar';

// ----------------------------------------------------------------------
// Chế độ Lịch: việc đã / đang chạy đặt theo giờ bắt đầu (màu theo trạng thái), cộng các lần chạy sắp tới của lịch (viền
// đứt, chưa thành việc). Bấm việc → ngăn chi tiết.
// ----------------------------------------------------------------------

type CalView = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth' | 'listWeek';

const VIEWS: { value: CalView; label: string }[] = [
  { value: 'dayGridMonth', label: 'Tháng' },
  { value: 'timeGridWeek', label: 'Tuần' },
  { value: 'timeGridDay', label: 'Ngày' },
  { value: 'listWeek', label: 'Danh sách' },
];

const MIN_MINUTES = 30;

type Props = {
  filter: TaskFilterState;
  onOpen: (task: IAgentTask) => void;
  poll: boolean;
};

export default function AgentTaskCalendar({ filter, onOpen, poll }: Props) {
  const theme = useTheme();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<Calendar>(null);
  const [view, setView] = useState<CalView>(smUp ? 'timeGridWeek' : 'listWeek');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const list = useAgentTaskList(
    range ? { from: range.from, to: range.to, hideConversation: true, take: 500 } : null,
    poll
  );
  const occ = useAgentScheduleOccurrences(range);

  const tasks = useMemo(
    () => filterTasks(list.tasks, { agentId: filter.agentId, source: filter.source, q: filter.q }),
    [list.tasks, filter.agentId, filter.source, filter.q]
  );

  const events = useMemo(() => {
    const color = (status: string) => {
      switch (columnOfStatus(status)) {
        case 'running':
          return theme.palette.info.main;
        case 'waiting':
          return theme.palette.warning.main;
        case 'done':
          return theme.palette.success.main;
        case 'ended':
          return status === 'failed' ? theme.palette.error.main : theme.palette.grey[500];
        default:
          return theme.palette.grey[600];
      }
    };
    const taskEvents = tasks.map((t) => {
      const start = new Date(t.startedAt || t.createdAt);
      const endMs = t.finishedAt
        ? new Date(t.finishedAt).getTime()
        : t.status === 'running'
          ? Date.now()
          : start.getTime();
      const end = new Date(Math.max(endMs, start.getTime() + MIN_MINUTES * 60_000));
      const c = color(t.status);
      return {
        id: t.id,
        title: `${t.agentName}: ${t.title}`,
        start,
        end,
        // StyledCalendar của template: màu chữ = màu sự kiện, nền là lớp nhạt cùng màu.
        textColor: c,
        extendedProps: { taskId: t.id },
      };
    });
    const nowMs = Date.now();
    const upcoming = occ.occurrences
      .filter((o) => new Date(o.at).getTime() > nowMs)
      .filter((o) => !filter.agentId || o.agentId === filter.agentId)
      .filter((o) => !filter.source || filter.source === 'schedule')
      .map((o) => ({
        id: `occ|${o.scheduleId}|${o.at}`,
        title: `Sắp chạy · ${o.agentName}: ${o.name}`,
        start: o.at,
        textColor: theme.palette.primary.main,
        classNames: ['agent-occurrence'],
      }));
    return [...taskEvents, ...upcoming];
  }, [tasks, occ.occurrences, filter.agentId, filter.source, theme]);

  const api = () => calendarRef.current?.getApi();

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    setRange((prev) => (prev?.from === from && prev?.to === to ? prev : { from, to }));
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const id = arg.event.extendedProps.taskId as string | undefined;
      const task = id ? tasks.find((t) => t.id === id) : undefined;
      if (task) onOpen(task);
    },
    [tasks, onOpen]
  );

  const loading = list.loading || occ.loading;
  const error = list.error || occ.error;

  return (
    <Card>
      <StyledCalendar
        sx={{
          '& .fc .agent-occurrence .fc-event-main': {
            outline: '1px dashed currentColor',
            outlineOffset: -1,
            '&:before': { opacity: 0.06 },
          },
        }}
      >
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
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Khung nét đứt = lần chạy sắp tới theo lịch
          </Typography>
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
          {loading && (
            <LinearProgress
              color="inherit"
              sx={{ height: 2, width: 1, position: 'absolute', bottom: 0, left: 0 }}
            />
          )}
        </Stack>

        {!!error && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {apiErrorMessage(error, 'Không tải được lịch việc')}
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
          nowIndicator
          scrollTime="07:00:00"
          dayMaxEventRows={4}
          eventMinHeight={22}
          eventDisplay="block"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          noEventsText="Không có việc nào"
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height={smUp ? 720 : 'auto'}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        />
      </StyledCalendar>
    </Card>
  );
}
