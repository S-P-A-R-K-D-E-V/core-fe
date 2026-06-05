'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import { useMemo, useRef, useState } from 'react';

import Card from '@mui/material/Card';

import { useResponsive } from 'src/hooks/use-responsive';

import type { ICalendarView } from 'src/types/calendar';
import type { IShiftPoolPost } from 'src/types/corecms-api';

import CalendarToolbar from '../../calendar/calendar-toolbar';
import { StyledCalendar } from '../../calendar/styles';

// ----------------------------------------------------------------------

type Props = {
  posts: IShiftPoolPost[];
  getColor: (p: IShiftPoolPost) => string;
  getTitle: (p: IShiftPoolPost) => string;
  onClickPost: (p: IShiftPoolPost) => void;
};

export default function PoolCalendar({ posts, getColor, getTitle, onClickPost }: Props) {
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());

  const events = useMemo(
    () =>
      posts.map((p) => {
        const dateStr = (p.shiftDate ?? '').split('T')[0];
        const start =
          p.needType === 'PartialCover' && p.partialStartTime ? p.partialStartTime : p.shiftStartTime;
        const end =
          p.needType === 'PartialCover' && p.partialEndTime ? p.partialEndTime : p.shiftEndTime;
        const color = getColor(p);
        return {
          id: p.id,
          title: getTitle(p),
          start: dateStr && start ? `${dateStr}T${start}` : dateStr,
          end: dateStr && end ? `${dateStr}T${end}` : dateStr,
          backgroundColor: color,
          borderColor: color,
        };
      }),
    [posts, getColor, getTitle]
  );

  const handleChangeView = (newView: ICalendarView) => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(newView);
      setView(newView);
    }
  };

  const handlePrev = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.prev();
      setDate(api.getDate());
    }
  };

  const handleNext = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.next();
      setDate(api.getDate());
    }
  };

  const handleToday = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.today();
      setDate(api.getDate());
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    const post = posts.find((p) => p.id === arg.event.id);
    if (post) onClickPost(post);
  };

  return (
    <Card sx={{ p: 2 }}>
      <StyledCalendar>
        <CalendarToolbar
          date={date}
          view={view}
          loading={false}
          onNextDate={handleNext}
          onPrevDate={handlePrev}
          onToday={handleToday}
          onChangeView={handleChangeView}
          onOpenFilters={() => {}}
        />
        <Calendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          initialDate={date}
          headerToolbar={false}
          events={events}
          eventClick={handleEventClick}
          height={smUp ? 720 : 'auto'}
          locale="vi"
          firstDay={1}
          eventDisplay="block"
          buttonText={{ today: 'Hôm nay', month: 'Tháng', week: 'Tuần', day: 'Ngày', list: 'Danh sách' }}
        />
      </StyledCalendar>
    </Card>
  );
}
