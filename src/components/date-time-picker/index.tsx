import type { SxProps, Theme } from '@mui/material/styles';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import {
  toTimeStr,
  toDateStr,
  parseTimeStr,
  parseDateStr,
  toDatetimeLocalStr,
  parseDatetimeLocalStr,
} from 'src/utils/format-time';

// ----------------------------------------------------------------------
// Standalone MUI-X pickers that keep the SAME string contract as the native
// <input type="date"|"time"|"datetime-local"> they replace:
//   - AppDatePicker:     value/onChange as 'yyyy-MM-dd'
//   - AppTimePicker:     value/onChange as 'HH:mm'
//   - AppDateTimePicker: value/onChange as 'yyyy-MM-ddTHH:mm' (datetime-local)
// This makes them drop-in for the existing useState<string> based filters/forms
// without touching data flow or API payloads. Empty/invalid -> ''.
// ----------------------------------------------------------------------

type BaseProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  sx?: SxProps<Theme>;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  placeholder?: string;
  name?: string;
};

function buildTextFieldSlot({
  sx,
  size = 'small',
  fullWidth,
  error,
  helperText,
  placeholder,
  name,
}: Pick<
  BaseProps,
  'sx' | 'size' | 'fullWidth' | 'error' | 'helperText' | 'placeholder' | 'name'
>) {
  return {
    textField: {
      size,
      fullWidth,
      error,
      helperText,
      name,
      ...(placeholder ? { placeholder } : {}),
      sx,
    },
  } as const;
}

// ----------------------------------------------------------------------

type AppDatePickerProps = BaseProps & {
  minDate?: string;
  maxDate?: string;
};

export function AppDatePicker({
  value,
  onChange,
  label,
  disabled,
  readOnly,
  minDate,
  maxDate,
  sx,
  size,
  fullWidth,
  error,
  helperText,
  placeholder,
  name,
}: AppDatePickerProps) {
  return (
    <DatePicker
      label={label}
      disabled={disabled}
      readOnly={readOnly}
      value={parseDateStr(value)}
      onChange={(d) => onChange(toDateStr(d))}
      format="dd/MM/yyyy"
      minDate={parseDateStr(minDate) ?? undefined}
      maxDate={parseDateStr(maxDate) ?? undefined}
      slotProps={buildTextFieldSlot({ sx, size, fullWidth, error, helperText, placeholder, name })}
    />
  );
}

// ----------------------------------------------------------------------

export function AppTimePicker({
  value,
  onChange,
  label,
  disabled,
  readOnly,
  sx,
  size,
  fullWidth,
  error,
  helperText,
  placeholder,
  name,
}: BaseProps) {
  return (
    <TimePicker
      label={label}
      disabled={disabled}
      readOnly={readOnly}
      value={parseTimeStr(value)}
      onChange={(d) => onChange(toTimeStr(d))}
      ampm={false}
      format="HH:mm"
      slotProps={buildTextFieldSlot({ sx, size, fullWidth, error, helperText, placeholder, name })}
    />
  );
}

// ----------------------------------------------------------------------

type AppDateTimePickerProps = BaseProps & {
  minDateTime?: string;
  maxDateTime?: string;
};

export function AppDateTimePicker({
  value,
  onChange,
  label,
  disabled,
  readOnly,
  minDateTime,
  maxDateTime,
  sx,
  size,
  fullWidth,
  error,
  helperText,
  placeholder,
  name,
}: AppDateTimePickerProps) {
  return (
    <DateTimePicker
      label={label}
      disabled={disabled}
      readOnly={readOnly}
      value={parseDatetimeLocalStr(value)}
      onChange={(d) => onChange(toDatetimeLocalStr(d))}
      ampm={false}
      format="dd/MM/yyyy HH:mm"
      minDateTime={parseDatetimeLocalStr(minDateTime) ?? undefined}
      maxDateTime={parseDatetimeLocalStr(maxDateTime) ?? undefined}
      slotProps={buildTextFieldSlot({ sx, size, fullWidth, error, helperText, placeholder, name })}
    />
  );
}
