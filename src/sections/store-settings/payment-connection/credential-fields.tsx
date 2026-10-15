'use client';

import type { IPaymentProviderField } from 'src/types/payment-service';

import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import Iconify from 'src/components/iconify';

import { isSecretField, selectOptionLabel } from './utils';

import type { CredentialValues, ConnectionFormMode } from './utils';

// ----------------------------------------------------------------------
// Ô nhập credentials dựng từ `fields` của nhà cung cấp: bí mật → ô mật khẩu có nút hiện/ẩn; select; boolean → công
// tắc; textarea (vd chứng thư .pfx base64). Cập nhật: ô bí mật để trống = giữ nguyên khoá đang lưu.
// ----------------------------------------------------------------------

type Props = {
  fields: IPaymentProviderField[];
  values: CredentialValues;
  mode: ConnectionFormMode;
  disabled?: boolean;
  /** Khoá còn thiếu (missingSettings) — tô viền cảnh báo */
  highlightKeys?: string[];
  onChange: (key: string, value: string | boolean) => void;
};

export default function CredentialFields({
  fields,
  values,
  mode,
  disabled,
  highlightKeys,
  onChange,
}: Props) {
  if (fields.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Nhà cung cấp này không cần khai khoá.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {fields.map((field) => (
        <CredentialField
          key={field.key}
          field={field}
          value={values[field.key]}
          mode={mode}
          disabled={disabled}
          highlighted={!!highlightKeys?.includes(field.key)}
          onChange={(v) => onChange(field.key, v)}
        />
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------

type FieldProps = {
  field: IPaymentProviderField;
  value: string | boolean | undefined;
  mode: ConnectionFormMode;
  disabled?: boolean;
  highlighted: boolean;
  onChange: (value: string | boolean) => void;
};

function CredentialField({ field, value, mode, disabled, highlighted, onChange }: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const required = mode === 'create' && field.required;
  const help = field.help || undefined;
  const missingHelp = highlighted ? 'Còn thiếu — cần bổ sung để chạy đủ nghiệp vụ.' : undefined;

  if (field.type === 'boolean') {
    return (
      <Stack spacing={0.25}>
        <FormControlLabel
          label={field.label}
          disabled={disabled}
          control={<Switch checked={!!value} onChange={(e) => onChange(e.target.checked)} />}
        />
        {help && (
          <Typography variant="caption" sx={{ color: 'text.secondary', pl: 6 }}>
            {help}
          </Typography>
        )}
      </Stack>
    );
  }

  if (field.type === 'select') {
    const options = field.options ?? [];
    // Không bắt buộc (hoặc đang cập nhật) → cho để trống: máy chủ dùng mặc định / giữ nguyên.
    const allowEmpty = mode === 'update' || !field.required;
    return (
      <TextField
        select
        fullWidth
        required={required}
        disabled={disabled}
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        helperText={missingHelp ?? help}
        FormHelperTextProps={highlighted ? { sx: { color: 'warning.main' } } : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && (
          <MenuItem value="">
            <em>{mode === 'update' ? '— Giữ nguyên —' : '— Mặc định —'}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {selectOptionLabel(option)}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const secret = isSecretField(field);
  const multiline = field.type === 'textarea';
  const keepHint =
    mode === 'update' && field.secret ? 'Để trống = giữ nguyên khoá đang lưu' : undefined;

  return (
    <TextField
      fullWidth
      required={required}
      disabled={disabled}
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      placeholder={keepHint ?? field.placeholder ?? undefined}
      helperText={missingHelp ?? help}
      FormHelperTextProps={highlighted ? { sx: { color: 'warning.main' } } : undefined}
      type={secret && !multiline && !revealed ? 'password' : 'text'}
      autoComplete={secret ? 'new-password' : 'off'}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      maxRows={multiline ? 8 : undefined}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{
        spellCheck: false,
        // textarea không có type=password: che chữ bằng CSS (Chrome / Edge / Safari).
        style:
          secret && multiline && !revealed
            ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)
            : undefined,
      }}
      InputLabelProps={keepHint ? { shrink: true } : undefined}
      InputProps={
        secret
          ? {
              sx: { fontFamily: revealed ? 'monospace' : undefined },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={revealed ? 'Ẩn' : 'Hiện'}>
                    <IconButton
                      edge="end"
                      aria-label={revealed ? `Ẩn ${field.label}` : `Hiện ${field.label}`}
                      onClick={() => setRevealed((r) => !r)}
                    >
                      <Iconify
                        icon={revealed ? 'solar:eye-closed-bold' : 'solar:eye-bold'}
                        width={20}
                      />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }
          : undefined
      }
    />
  );
}
