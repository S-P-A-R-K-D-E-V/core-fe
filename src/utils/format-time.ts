import { format, getTime, formatDistanceToNow } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';

// ----------------------------------------------------------------------

type InputValue = Date | string | number | null | undefined;

export function fDate(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'dd/MM/yyyy';

  return date ? format(new Date(date), fm, { locale: viLocale }) : '';
}

export function fTime(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'HH:mm';

  return date ? format(new Date(date), fm, { locale: viLocale }) : '';
}

export function fDateTime(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'dd/MM/yyyy HH:mm';

  return date ? format(new Date(date), fm, { locale: viLocale }) : '';
}

export function fTimestamp(date: InputValue) {
  return date ? getTime(new Date(date)) : '';
}

export function fToNow(date: InputValue) {
  return date
    ? formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: viLocale,
      })
    : '';
}

export function isBetween(inputDate: Date | string | number, startDate: Date, endDate: Date) {
  const date = new Date(inputDate);

  const results =
    new Date(date.toDateString()) >= new Date(startDate.toDateString()) &&
    new Date(date.toDateString()) <= new Date(endDate.toDateString());

  return results;
}

export function isAfter(startDate: Date | null, endDate: Date | null) {
  const results =
    startDate && endDate ? new Date(startDate).getTime() > new Date(endDate).getTime() : false;

  return results;
}

// Helpers for DatePicker ↔ string (yyyy-MM-dd) conversion
export function parseDateStr(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateStr(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

// Helpers for DateTimePicker ↔ datetime-local string (yyyy-MM-dd'T'HH:mm) conversion
export function parseDatetimeLocalStr(str: string | null | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDatetimeLocalStr(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return format(date, "yyyy-MM-dd'T'HH:mm");
}
