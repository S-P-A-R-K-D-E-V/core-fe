// Shift Management Constants

// WeekDays Bitmask
export const WEEKDAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 4,
  THURSDAY: 8,
  FRIDAY: 16,
  SATURDAY: 32,
  SUNDAY: 64,
} as const;

// WeekDays Helper
export const WEEKDAYS_LIST = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 4, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 8, label: 'Thursday', shortLabel: 'Thu' },
  { value: 16, label: 'Friday', shortLabel: 'Fri' },
  { value: 32, label: 'Saturday', shortLabel: 'Sat' },
  { value: 64, label: 'Sunday', shortLabel: 'Sun' },
] as const;

// Convert bitmask to day names
export function getWeekDayNames(bitmask: number): string[] {
  const names: string[] = [];
  WEEKDAYS_LIST.forEach((day) => {
    if ((bitmask & day.value) === day.value) {
      names.push(day.label);
    }
  });
  return names;
}

// Convert bitmask to short day names
export function getWeekDayShortNames(bitmask: number): string[] {
  const names: string[] = [];
  WEEKDAYS_LIST.forEach((day) => {
    if ((bitmask & day.value) === day.value) {
      names.push(day.shortLabel);
    }
  });
  return names;
}

// Convert day values array to bitmask
export function daysToBitmask(days: number[]): number {
  return days.reduce((acc, day) => acc | day, 0);
}

// Convert bitmask to day values array
export function bitmaskToDays(bitmask: number): number[] {
  const days: number[] = [];
  WEEKDAYS_LIST.forEach((day) => {
    if ((bitmask & day.value) === day.value) {
      days.push(day.value);
    }
  });
  return days;
}

// Shift Type Colors
export const SHIFT_TYPE_COLORS = {
  Normal: '#1976d2',
  Holiday: '#f57c00',
} as const;

// Default shift colors
export const DEFAULT_SHIFT_COLORS = [
  '#1976d2', // Blue
  '#2e7d32', // Green
  '#ed6c02', // Orange
  '#9c27b0', // Purple
  '#d32f2f', // Red
  '#0288d1', // Light Blue
  '#7b1fa2', // Deep Purple
  '#c2185b', // Pink
] as const;

// Shift Status
export const SHIFT_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const;

// Lock Status
export const LOCK_STATUS = {
  LOCKED: 'Locked',
  UNLOCKED: 'Unlocked',
} as const;
