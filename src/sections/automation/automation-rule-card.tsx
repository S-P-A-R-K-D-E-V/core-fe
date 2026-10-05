'use client';

import { useId, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDateTime } from 'src/utils/format-time';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { AppTimePicker } from 'src/components/date-time-picker';

import {
  updateAutomationRule,
  type IAutomationRule,
  type IUpdateAutomationRulePayload,
} from 'src/api/automation';

import {
  diffSettings,
  toFormValues,
  isChannelField,
  flattenSettings,
  WEEKDAY_OPTIONS,
  buildRuleFields,
  unflattenSettings,
  splitServerErrors,
  sanitizeFieldInput,
  requestErrorMessage,
  type AutomationField,
  type AutomationFormValue,
  type AutomationFormValues,
} from './automation-fields';

// ----------------------------------------------------------------------

type ServerErrors = { byPath: Record<string, string>; general: string[] };

const NO_ERRORS: ServerErrors = { byPath: {}, general: [] };

type Props = {
  rule: IAutomationRule;
  /** Máy chủ đã lưu — nhận lại quy tắc sau khi lưu để danh sách cập nhật theo. */
  onSaved: (rule: IAutomationRule) => void;
};

/**
 * Thẻ của MỘT cảnh báo tự động: bật/tắt, kênh gửi, các ngưỡng. Mỗi thẻ tự lưu — "Lưu" chỉ gửi đúng những gì đã
 * đổi so với giá trị đang lưu ở máy chủ.
 */
export default function AutomationRuleCard({ rule, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const titleId = useId();

  const fields = useMemo(() => buildRuleFields(rule), [rule]);
  const saved = useMemo(() => flattenSettings(rule.settings), [rule]);
  const defaults = useMemo(() => flattenSettings(rule.defaults), [rule]);

  const [enabled, setEnabled] = useState(rule.enabled);
  const [values, setValues] = useState<AutomationFormValues>(() => toFormValues(fields, saved));
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerErrors>(NO_ERRORS);

  const { changed, invalid } = diffSettings(fields, values, saved);
  const enabledChanged = enabled !== rule.enabled;
  const hasInvalid = Object.keys(invalid).length > 0;
  const dirty = enabledChanged || hasInvalid || Object.keys(changed).length > 0;

  // "Đặt lại mặc định" chỉ đụng tới ngưỡng + kênh gửi (rule.defaults); công tắc bật/tắt của cảnh báo giữ nguyên.
  const resettable = fields.filter((field) => field.path in defaults);
  const fromDefaults = diffSettings(resettable, values, defaults);
  const differsFromDefaults =
    Object.keys(fromDefaults.changed).length > 0 || Object.keys(fromDefaults.invalid).length > 0;

  const settingFields = fields.filter((field) => !isChannelField(field));
  const channelFields = fields.filter(isChannelField);
  const allChannelsOff =
    channelFields.length > 0 && channelFields.every((field) => values[field.path] !== true);

  const setValue = (path: string, value: AutomationFormValue) => {
    setValues((prev) => ({ ...prev, [path]: value }));
    // Người dùng đang sửa lại ô này → lỗi cũ của máy chủ cho ô đó không còn đúng.
    setServerErrors((prev) => {
      if (!(path in prev.byPath)) return prev;
      const byPath = { ...prev.byPath };
      delete byPath[path];
      return { ...prev, byPath };
    });
  };

  const handleReset = () => {
    setValues((prev) => ({ ...prev, ...toFormValues(resettable, defaults) }));
    setServerErrors(NO_ERRORS);
  };

  const handleSave = async () => {
    const payload: IUpdateAutomationRulePayload = {};
    if (enabledChanged) payload.enabled = enabled;
    if (Object.keys(changed).length > 0) payload.settings = unflattenSettings(changed);

    setSaving(true);
    setServerErrors(NO_ERRORS);
    try {
      const updated = await updateAutomationRule(rule.code, payload);
      // Nạp lại form từ đúng giá trị máy chủ trả về.
      setEnabled(updated.enabled);
      setValues(toFormValues(buildRuleFields(updated), flattenSettings(updated.settings)));
      onSaved(updated);
      enqueueSnackbar(`Đã lưu cảnh báo “${updated.title}”`);
    } catch (err: any) {
      // 400 { message, errors[] }: từng câu lỗi tiếng Việt của máy chủ, gắn vào đúng ô nếu câu đó nêu khoá.
      const errors: string[] = Array.isArray(err?.errors)
        ? err.errors.filter((e: unknown) => typeof e === 'string' && e)
        : [];
      setServerErrors(
        errors.length > 0
          ? splitServerErrors(
              errors,
              fields.map((field) => field.path)
            )
          : { byPath: {}, general: [requestErrorMessage(err, 'Lưu thất bại, vui lòng thử lại.')] }
      );
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: AutomationField) => (
    <AutomationFieldInput
      key={field.path}
      field={field}
      value={values[field.path]}
      error={invalid[field.path] ?? serverErrors.byPath[field.path]}
      disabled={saving}
      onChange={(value) => setValue(field.path, value)}
    />
  );

  return (
    <Card role="group" aria-labelledby={titleId} sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id={titleId}
              variant="subtitle1"
              component="h3"
              sx={{ wordBreak: 'break-word' }}
            >
              {rule.title}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {rule.description}
            </Typography>
          </Box>

          <Switch
            checked={enabled}
            disabled={saving}
            onChange={(event) => setEnabled(event.target.checked)}
            inputProps={{ 'aria-label': `Bật cảnh báo: ${rule.title}` }}
            sx={{ flexShrink: 0 }}
          />
        </Stack>

        {rule.globallyDisabled && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover', color: 'text.secondary' }}
          >
            <Iconify icon="solar:info-circle-bold" width={18} sx={{ mt: '1px', flexShrink: 0 }} />
            <Typography variant="caption">
              Cảnh báo này đang bị tắt trên toàn hệ thống (cấu hình máy chủ). Thiết lập ở đây vẫn
              được lưu nhưng chỉ có hiệu lực khi hệ thống bật lại.
            </Typography>
          </Stack>
        )}

        {settingFields.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {settingFields.map(renderField)}
          </Box>
        )}

        {channelFields.length > 0 && (
          <Box>
            <Typography variant="subtitle2" component="div" sx={{ mb: 0.5 }}>
              Gửi qua
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 3 }}>
              {channelFields.map(renderField)}
            </Stack>
            {allChannelsOff && (
              <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                Đang tắt mọi kênh gửi — cảnh báo này sẽ không được gửi đi.
              </Typography>
            )}
          </Box>
        )}

        {serverErrors.general.length > 0 && (
          <Alert severity="error">
            {serverErrors.general.map((message) => (
              <Box key={message}>{message}</Box>
            ))}
          </Alert>
        )}

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {rule.updatedAt
              ? `Cập nhật lúc ${fDateTime(rule.updatedAt)}`
              : 'Đang dùng thiết lập mặc định'}
            {dirty && ' · Có thay đổi chưa lưu'}
          </Typography>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexShrink: 0 }}>
            <Button
              color="inherit"
              startIcon={<Iconify icon="solar:restart-bold" />}
              disabled={saving || !differsFromDefaults}
              onClick={handleReset}
            >
              Đặt lại mặc định
            </Button>
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!dirty || hasInvalid}
              onClick={handleSave}
            >
              Lưu
            </LoadingButton>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

type FieldInputProps = {
  field: AutomationField;
  value: AutomationFormValue | undefined;
  /** Lời nhắc của form hoặc câu lỗi của máy chủ cho riêng ô này. */
  error?: string;
  disabled?: boolean;
  onChange: (value: AutomationFormValue) => void;
};

function AutomationFieldInput({ field, value, error, disabled, onChange }: FieldInputProps) {
  const helperText = error ?? field.helperText;

  if (field.kind === 'boolean') {
    return (
      <Box sx={{ minWidth: 0 }}>
        <FormControlLabel
          label={field.label}
          control={
            <Switch
              checked={value === true}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
          sx={{ mr: 0, wordBreak: 'break-word' }}
        />
        {helperText && (
          <FormHelperText error={!!error} sx={{ mt: 0 }}>
            {helperText}
          </FormHelperText>
        )}
      </Box>
    );
  }

  const text = typeof value === 'string' ? value : '';

  if (field.kind === 'time') {
    return (
      <AppTimePicker
        fullWidth
        label={field.label}
        value={text}
        onChange={onChange}
        disabled={disabled}
        error={!!error}
        helperText={helperText}
      />
    );
  }

  if (field.kind === 'weekday') {
    return (
      <TextField
        select
        fullWidth
        size="small"
        label={field.label}
        value={text}
        disabled={disabled}
        error={!!error}
        helperText={helperText}
        onChange={(event) => onChange(event.target.value)}
      >
        {WEEKDAY_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={String(option.value)}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const numeric = field.kind === 'money' || field.kind === 'integer' || field.kind === 'decimal';

  return (
    <TextField
      fullWidth
      size="small"
      label={field.label}
      value={text}
      disabled={disabled}
      error={!!error}
      helperText={helperText}
      autoComplete="off"
      onChange={(event) => onChange(sanitizeFieldInput(field.kind, event.target.value))}
      inputProps={
        numeric ? { inputMode: field.kind === 'decimal' ? 'decimal' : 'numeric' } : undefined
      }
      InputProps={
        field.unit
          ? { endAdornment: <InputAdornment position="end">{field.unit}</InputAdornment> }
          : undefined
      }
    />
  );
}
