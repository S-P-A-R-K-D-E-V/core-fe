'use client';

import type { EventInput, DatesSetArg, EventDropArg, EventContentArg } from '@fullcalendar/core';
import type { SocialPostStatus, SocialCalendarItem } from 'src/lib/social';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useRef, useMemo, useState } from 'react';
import interactionPlugin from '@fullcalendar/interaction';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import { useTheme, type Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { addSlot, toDateParam, normalizeSlot, SOCIAL_WEEKDAYS, SOCIAL_QUEUE_MAX_SLOTS } from 'src/lib/social';
import { useSocialQueue, saveSocialQueue, useSocialCalendar, rescheduleSocialPost } from 'src/api/social';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { StyledCalendar } from 'src/sections/calendar/styles';

// ----------------------------------------------------------------------
// Lịch đăng bài: tuần / tháng. Bài đã hẹn kéo thả để đổi giờ; ô "Trống" là khung giờ hàng đợi chưa có bài — bấm để soạn
// bài cho đúng giờ đó. Hàng đợi tự rải bài: bài "Thêm vào hàng đợi" nhận khung trống kế tiếp.

type View = 'dayGridMonth' | 'timeGridWeek';

const FREE_PREFIX = 'free:';

function statusColor(status: SocialPostStatus, queued: boolean, palette: Theme['palette']) {
  switch (status) {
    case 'published':
      return palette.success.main;
    case 'failed':
      return palette.error.main;
    case 'partial':
      return palette.warning.main;
    case 'publishing':
      return palette.secondary.main;
    default:
      return queued ? palette.primary.main : palette.info.main;
  }
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Đã hẹn',
  publishing: 'Đang đăng',
  published: 'Đã đăng',
  partial: 'Lỗi một phần',
  failed: 'Lỗi',
};

export function SocialCalendarView() {
  const theme = useTheme();
  const settings = useSettingsContext();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const calendarRef = useRef<Calendar>(null);

  const [view, setView] = useState<View>('timeGridWeek');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  const { calendar, error, refresh } = useSocialCalendar(range?.from ?? null, range?.to ?? null);
  const { queue } = useSocialQueue();

  const events = useMemo<EventInput[]>(() => {
    if (!calendar) return [];
    const posts: EventInput[] = calendar.items.map((item) => ({
      id: item.id,
      title: item.text || '(bài chỉ có ảnh)',
      start: item.at,
      allDay: false,
      editable: item.editable,
      color: statusColor(item.status, item.queued, theme.palette),
      extendedProps: { item },
    }));
    const free: EventInput[] = calendar.freeSlots.map((at) => ({
      id: `${FREE_PREFIX}${at}`,
      title: 'Trống',
      start: at,
      allDay: false,
      editable: false,
      classNames: ['social-free-slot'],
      extendedProps: { free: true },
    }));
    return [...posts, ...free];
  }, [calendar, theme.palette]);

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    const end = new Date(arg.end.getTime() - 1);
    setRange({ from: toDateParam(arg.start), to: toDateParam(end) });
  };

  const changeView = (next: View | null) => {
    if (!next) return;
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  };

  const handleDrop = async (arg: EventDropArg) => {
    const start = arg.event.start;
    if (!start) return arg.revert();
    if (start.getTime() < Date.now() + 60 * 1000) {
      enqueueSnackbar('Chỉ dời được sang giờ ở tương lai', { variant: 'warning' });
      return arg.revert();
    }
    try {
      await rescheduleSocialPost(arg.event.id, start.toISOString());
      enqueueSnackbar(`Đã dời sang ${fDateTime(start)}`);
      refresh();
    } catch (err) {
      arg.revert();
      enqueueSnackbar(apiErrorMessage(err, 'Không đổi được giờ'), { variant: 'error' });
    }
    return undefined;
  };

  const renderEvent = (arg: EventContentArg) => {
    if (arg.event.extendedProps.free) {
      return (
        <Box sx={{ px: 0.5, overflow: 'hidden', whiteSpace: 'nowrap', typography: 'caption' }}>
          {arg.timeText} · Trống — thêm bài
        </Box>
      );
    }
    const item = arg.event.extendedProps.item as SocialCalendarItem;
    return (
      <Tooltip
        title={`${STATUS_LABEL[item.status] ?? item.status}${item.queued ? ' · hàng đợi' : ''} · ${item.channels
          .map((c) => `@${c}`)
          .join(', ')}${item.imageCount ? ` · ${item.imageCount} ảnh` : ''}`}
      >
        <Box sx={{ px: 0.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', typography: 'caption' }}>
          <b>{arg.timeText}</b> {item.queued && '⏱ '}
          {arg.event.title}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lịch đăng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: 'Lịch đăng' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Iconify icon="solar:list-check-bold" />} onClick={() => setQueueOpen(true)}>
              Hàng đợi tự rải bài
            </Button>
            <Button
              variant="contained"
              component={RouterLink}
              href={paths.dashboard.social.new}
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Bài mới
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {queue && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Hàng đợi: {queue.slots.join(', ')} · {daysLabel(queue.days)}
          {queue.nextSlots[0] ? ` · bài thêm vào hàng đợi tiếp theo sẽ đăng lúc ${fDateTime(queue.nextSlots[0])}` : ' · hàng đợi đã kín'}
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error, 'Không tải được lịch')}
        </Alert>
      )}

      <Card>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2 }} flexWrap="wrap">
          <IconButton aria-label="Trước" onClick={() => calendarRef.current?.getApi().prev()}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>
          <IconButton aria-label="Sau" onClick={() => calendarRef.current?.getApi().next()}>
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>
          <Button size="small" color="inherit" variant="outlined" onClick={() => calendarRef.current?.getApi().today()}>
            Hôm nay
          </Button>
          <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', minWidth: 160 }}>
            {title}
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => changeView(v)}>
            <ToggleButton value="timeGridWeek">Tuần</ToggleButton>
            <ToggleButton value="dayGridMonth">Tháng</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <StyledCalendar
          sx={{
            '& .social-free-slot': {
              bgcolor: 'transparent !important',
              border: `1px dashed ${theme.palette.divider} !important`,
              color: `${theme.palette.text.disabled} !important`,
              cursor: 'pointer',
            },
            '& .social-free-slot .fc-event-main': { color: 'inherit' },
          }}
        >
          <Calendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            locale="vi"
            firstDay={1}
            height="auto"
            allDaySlot={false}
            slotMinTime="06:00:00"
            slotMaxTime="24:00:00"
            slotDuration="01:00:00"
            eventMinHeight={22}
            dayMaxEventRows={4}
            eventDisplay="block"
            nowIndicator
            events={events}
            datesSet={handleDatesSet}
            eventDrop={handleDrop}
            eventContent={renderEvent}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventClick={(arg) => {
              arg.jsEvent.preventDefault();
              if (arg.event.extendedProps.free) {
                router.push(`${paths.dashboard.social.new}?at=${encodeURIComponent(arg.event.startStr)}`);
              } else {
                router.push(paths.dashboard.social.edit(arg.event.id));
              }
            }}
          />
        </StyledCalendar>
      </Card>

      <Stack direction="row" spacing={2} sx={{ mt: 2, typography: 'caption', color: 'text.secondary' }} flexWrap="wrap">
        <Legend color={theme.palette.info.main} label="Đã hẹn giờ" />
        <Legend color={theme.palette.primary.main} label="Hàng đợi" />
        <Legend color={theme.palette.success.main} label="Đã đăng" />
        <Legend color={theme.palette.error.main} label="Lỗi" />
        <span>Kéo thả bài đã hẹn để đổi giờ · bấm ô &quot;Trống&quot; để soạn bài đúng giờ đó.</span>
      </Stack>

      {queueOpen && queue && (
        <QueueDialog
          slots={queue.slots}
          days={queue.days}
          onClose={() => setQueueOpen(false)}
          onSaved={() => {
            setQueueOpen(false);
            refresh();
          }}
        />
      )}
    </Container>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
      <span>{label}</span>
    </Stack>
  );
}

function daysLabel(days: number[]) {
  if (days.length === 7) return 'mọi ngày';
  return SOCIAL_WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(', ');
}

// ----------------------------------------------------------------------

type QueueDialogProps = { slots: string[]; days: number[]; onClose: () => void; onSaved: () => void };

function QueueDialog({ slots: initialSlots, days: initialDays, onClose, onSaved }: QueueDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { refresh } = useSocialQueue();
  const [slots, setSlots] = useState(initialSlots);
  const [days, setDays] = useState(initialDays);
  const [time, setTime] = useState('12:00');
  const [saving, setSaving] = useState(false);

  const canAdd = !!normalizeSlot(time) && slots.length < SOCIAL_QUEUE_MAX_SLOTS;

  const save = async () => {
    setSaving(true);
    try {
      await saveSocialQueue({ slots, days });
      await refresh();
      enqueueSnackbar('Đã lưu khung giờ hàng đợi');
      onSaved();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
      setSaving(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Hàng đợi tự rải bài</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Bài &quot;Thêm vào hàng đợi&quot; tự nhận khung giờ trống kế tiếp — mỗi khung một bài. Bài đã hẹn giữ nguyên giờ khi
          đổi khung. Gợi ý 1–2 khung mỗi ngày để Threads không giảm hiển thị.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Khung giờ (giờ Việt Nam)
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {slots.map((s) => (
            <Chip key={s} label={s} onDelete={slots.length > 1 ? () => setSlots(slots.filter((x) => x !== s)) : undefined} />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <TextField
            size="small"
            type="time"
            label="Thêm giờ"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            inputProps={{ step: 300 }}
            sx={{ width: 160 }}
          />
          <Button variant="outlined" disabled={!canAdd} onClick={() => setSlots(addSlot(slots, time))}>
            Thêm
          </Button>
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Ngày đăng
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={days}
          onChange={(_, v: number[]) => v.length > 0 && setDays(v)}
          aria-label="Ngày đăng"
        >
          {SOCIAL_WEEKDAYS.map((d) => (
            <ToggleButton key={d.value} value={d.value} sx={{ minWidth: 44 }}>
              {d.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={save}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
