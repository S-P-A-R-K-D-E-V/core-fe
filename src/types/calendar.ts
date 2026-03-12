import {
  IAttendanceLog,
  ShiftType
} from 'src/types/corecms-api';
// ----------------------------------------------------------------------

export type ICalendarFilterValue = string[] | Date | null;

export type ICalendarFilters = {
  colors: string[];
  startDate: Date | null;
  endDate: Date | null;
};

// ----------------------------------------------------------------------

export type ICalendarDate = string | number;

export type ICalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export type ICalendarRange = {
  start: ICalendarDate;
  end: ICalendarDate;
} | null;

export type ICalendarEvent = {
  id: string;
  color: string;
  title: string;
  allDay: boolean;
  description: string;
  end: ICalendarDate;
  start: ICalendarDate;
};

export interface ICalendarScheduleEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  color?: string;
  extendedProps: {
    scheduleId: string;
    date: string;
    color: string;
    type: ShiftType;
    users: {
      staffId: string;
      staffName: string;
      attendance?: IAttendanceLog;
    }[];
  };
}
