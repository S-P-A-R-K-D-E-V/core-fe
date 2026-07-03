import { Controller, useFormContext } from 'react-hook-form';

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
// react-hook-form MUI-X pickers that keep the SAME string field value the old
// `RHFTextField type="date"|"time"|"datetime-local"` produced, so they are
// drop-in replacements without changing form schema, validation or submit payload:
//   - RHFDatePicker:     'yyyy-MM-dd'
//   - RHFTimePicker:     'HH:mm'
//   - RHFDateTimePicker: 'yyyy-MM-ddTHH:mm'
// ----------------------------------------------------------------------

type BaseProps = {
  name: string;
  label?: React.ReactNode;
  disabled?: boolean;
  sx?: SxProps<Theme>;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  helperText?: React.ReactNode;
};

function fieldSlot(
  { sx, size = 'small', fullWidth = true, helperText }: Omit<BaseProps, 'name' | 'label' | 'disabled'>,
  errorMessage?: string
) {
  return {
    textField: {
      size,
      fullWidth,
      error: !!errorMessage,
      helperText: errorMessage || helperText,
      sx,
    },
  } as const;
}

// ----------------------------------------------------------------------

type RHFDatePickerProps = BaseProps & { minDate?: string; maxDate?: string };

export function RHFDatePicker({ name, label, disabled, minDate, maxDate, ...rest }: RHFDatePickerProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <DatePicker
          label={label}
          disabled={disabled}
          value={parseDateStr(field.value)}
          onChange={(d) => field.onChange(toDateStr(d))}
          format="dd/MM/yyyy"
          minDate={parseDateStr(minDate) ?? undefined}
          maxDate={parseDateStr(maxDate) ?? undefined}
          slotProps={fieldSlot(rest, error?.message)}
        />
      )}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFTimePicker({ name, label, disabled, ...rest }: BaseProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TimePicker
          label={label}
          disabled={disabled}
          value={parseTimeStr(field.value)}
          onChange={(d) => field.onChange(toTimeStr(d))}
          ampm={false}
          format="HH:mm"
          slotProps={fieldSlot(rest, error?.message)}
        />
      )}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFDateTimePicker({ name, label, disabled, ...rest }: BaseProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <DateTimePicker
          label={label}
          disabled={disabled}
          value={parseDatetimeLocalStr(field.value)}
          onChange={(d) => field.onChange(toDatetimeLocalStr(d))}
          ampm={false}
          format="dd/MM/yyyy HH:mm"
          slotProps={fieldSlot(rest, error?.message)}
        />
      )}
    />
  );
}
