'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFSwitch,
  RHFSelect,
  RHFTextField,
  RHFAutocomplete,
} from 'src/components/hook-form';

import { getAllShiftTemplates } from 'src/api/attendance';
import {
  createShiftReminderRule,
  updateShiftReminderRule,
  sendTestShiftReminderRule,
} from 'src/api/shift-reminder-rules';
import { IShiftTemplate } from 'src/types/corecms-api';
import { IShiftReminderRule, SHIFT_REMINDER_PLACEHOLDERS } from 'src/types/shift-reminder-rule';

// ----------------------------------------------------------------------

// Render y hệt logic BE (ShiftReminderTemplateRenderer.Render) - chỉ dùng cho preview tức thời,
// không gọi API. Giữ đúng cùng danh sách placeholder với SHIFT_REMINDER_PLACEHOLDERS.
function renderSamplePreview(template: string, offsetAbs: number) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('vi-VN');
  return template
    .replaceAll('{ShiftName}', 'Ca Sáng')
    .replaceAll('{StaffName}', 'Nguyễn Văn A')
    .replaceAll('{StartTime}', '08:00')
    .replaceAll('{EndTime}', '17:00')
    .replaceAll('{Date}', dateStr)
    .replaceAll('{OffsetAbs}', String(offsetAbs));
}

type Props = {
  currentRule?: IShiftReminderRule;
};

export default function ShiftReminderRuleNewEditForm({ currentRule }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [shiftTemplates, setShiftTemplates] = useState<IShiftTemplate[]>([]);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    getAllShiftTemplates()
      .then(setShiftTemplates)
      .catch(() => enqueueSnackbar('Không thể tải danh sách ShiftTemplate', { variant: 'error' }));
  }, [enqueueSnackbar]);

  const NewRuleSchema = Yup.object().shape({
    name: Yup.string().required('Bắt buộc nhập tên').max(150),
    anchorEvent: Yup.mixed<'ShiftStart' | 'ShiftEnd'>().oneOf(['ShiftStart', 'ShiftEnd']).required(),
    direction: Yup.mixed<'before' | 'after'>().oneOf(['before', 'after']).required(),
    offsetMagnitude: Yup.number().min(1, 'Phải >= 1').max(240, 'Tối đa 240 phút').required('Bắt buộc'),
    skipIfConsecutive: Yup.boolean().required().default(false),
    titleTemplate: Yup.string().required('Bắt buộc nhập tiêu đề').max(200),
    messageTemplate: Yup.string().required('Bắt buộc nhập nội dung').max(1000),
    appliesToAllShiftTemplates: Yup.boolean().required().default(true),
    selectedShiftTemplates: Yup.array()
      .of(Yup.mixed<IShiftTemplate>().required())
      .required()
      .default([])
      .when('appliesToAllShiftTemplates', {
        is: false,
        then: (schema) => schema.min(1, 'Phải chọn ít nhất 1 ShiftTemplate'),
      }),
    isActive: Yup.boolean().required().default(true),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentRule?.name || '',
      anchorEvent: (currentRule?.anchorEvent || 'ShiftStart') as 'ShiftStart' | 'ShiftEnd',
      direction: (currentRule
        ? currentRule.offsetMinutes < 0
          ? 'before'
          : 'after'
        : 'before') as 'before' | 'after',
      offsetMagnitude: currentRule ? Math.abs(currentRule.offsetMinutes) : 30,
      skipIfConsecutive: currentRule?.skipIfConsecutive ?? false,
      titleTemplate: currentRule?.titleTemplate || '',
      messageTemplate: currentRule?.messageTemplate || '',
      appliesToAllShiftTemplates: currentRule?.appliesToAllShiftTemplates ?? true,
      selectedShiftTemplates: [] as IShiftTemplate[],
      isActive: currentRule?.isActive ?? true,
    }),
    [currentRule]
  );

  const methods = useForm({
    resolver: yupResolver(NewRuleSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = methods;

  // Khớp lại selectedShiftTemplates (đối tượng đầy đủ, để Autocomplete hiển thị tên) sau khi
  // cả currentRule.shiftTemplateScopes và danh sách shiftTemplates đều đã sẵn sàng.
  useEffect(() => {
    if (!currentRule || shiftTemplates.length === 0) return;
    const scopeIds = new Set(currentRule.shiftTemplateScopes.map((s) => s.shiftTemplateId));
    setValue(
      'selectedShiftTemplates',
      shiftTemplates.filter((t) => scopeIds.has(t.id))
    );
  }, [currentRule, shiftTemplates, setValue]);

  const values = watch();

  const onSubmit = handleSubmit(async (data) => {
    try {
      const offsetMinutes =
        data.direction === 'before' ? -Math.abs(data.offsetMagnitude) : Math.abs(data.offsetMagnitude);

      const payload = {
        name: data.name,
        anchorEvent: data.anchorEvent as 'ShiftStart' | 'ShiftEnd',
        offsetMinutes,
        skipIfConsecutive: data.skipIfConsecutive,
        titleTemplate: data.titleTemplate,
        messageTemplate: data.messageTemplate,
        appliesToAllShiftTemplates: data.appliesToAllShiftTemplates,
        shiftTemplateIds: data.appliesToAllShiftTemplates
          ? null
          : data.selectedShiftTemplates.map((t) => t.id),
      };

      if (currentRule) {
        await updateShiftReminderRule(currentRule.id, { ...payload, isActive: data.isActive });
        enqueueSnackbar('Cập nhật thành công');
      } else {
        await createShiftReminderRule(payload);
        enqueueSnackbar('Tạo thành công');
      }
      router.push(paths.dashboard.shift.reminderRules.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar(currentRule ? 'Cập nhật thất bại' : 'Tạo thất bại', { variant: 'error' });
    }
  });

  const handleSendTest = async () => {
    if (!currentRule) return;
    setSendingTest(true);
    try {
      await sendTestShiftReminderRule(currentRule.id);
      enqueueSnackbar('Đã gửi thử tới tài khoản của bạn');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Gửi thử thất bại', { variant: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  const insertPlaceholder = useCallback(
    (field: 'titleTemplate' | 'messageTemplate', token: string) => {
      setValue(field, `${getValues(field) || ''}${token}`, { shouldValidate: true });
    },
    [setValue, getValues]
  );

  const renderPlaceholderChips = (field: 'titleTemplate' | 'messageTemplate') => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ rowGap: 0.5 }}>
      {SHIFT_REMINDER_PLACEHOLDERS.map((token) => (
        <Chip
          key={token}
          label={token}
          size="small"
          variant="outlined"
          onClick={() => insertPlaceholder(field, token)}
          sx={{ cursor: 'pointer' }}
        />
      ))}
    </Stack>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{ xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' }}
            >
              <RHFTextField name="name" label="Tên quy tắc" />

              <Box />

              <RHFSelect name="anchorEvent" label="Mốc thời gian">
                <MenuItem value="ShiftStart">Giờ vào ca</MenuItem>
                <MenuItem value="ShiftEnd">Giờ kết thúc ca</MenuItem>
              </RHFSelect>

              <Stack direction="row" spacing={1}>
                <RHFSelect name="direction" label="Trước/Sau" sx={{ minWidth: 120 }}>
                  <MenuItem value="before">Trước</MenuItem>
                  <MenuItem value="after">Sau</MenuItem>
                </RHFSelect>
                <RHFTextField name="offsetMagnitude" label="Số phút" type="number" />
              </Stack>
            </Box>

            <Stack spacing={1} sx={{ mt: 3 }}>
              <RHFSwitch
                name="skipIfConsecutive"
                label="Bỏ nhắc nếu ca này nằm giữa 1 chuỗi ca liền nhau (chỉ nhắc ở ca đầu/cuối chuỗi)"
              />
              {currentRule && (
                <RHFSwitch name="isActive" label="Đang kích hoạt" />
              )}
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Stack spacing={1}>
              <RHFTextField name="titleTemplate" label="Tiêu đề thông báo" />
              {renderPlaceholderChips('titleTemplate')}
            </Stack>

            <Stack spacing={1} sx={{ mt: 3 }}>
              <RHFTextField name="messageTemplate" label="Nội dung thông báo" multiline rows={3} />
              {renderPlaceholderChips('messageTemplate')}
            </Stack>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Xem trước (dữ liệu mẫu)
              </Typography>
              <Typography variant="subtitle2">
                {renderSamplePreview(values.titleTemplate || '', values.offsetMagnitude || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {renderSamplePreview(values.messageTemplate || '', values.offsetMagnitude || 0)}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Stack spacing={2}>
              <RHFSwitch
                name="appliesToAllShiftTemplates"
                label="Áp dụng cho tất cả ShiftTemplate"
              />
              {!values.appliesToAllShiftTemplates && (
                <RHFAutocomplete
                  name="selectedShiftTemplates"
                  label="Chọn ShiftTemplate áp dụng"
                  multiple
                  disableCloseOnSelect
                  options={shiftTemplates}
                  getOptionLabel={(option) => (option as IShiftTemplate).name}
                  isOptionEqualToValue={(option, value) =>
                    (option as IShiftTemplate).id === (value as IShiftTemplate).id
                  }
                  renderOption={(props, option, { selected }) => (
                    <li {...props} key={(option as IShiftTemplate).id}>
                      <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                      {(option as IShiftTemplate).name}
                    </li>
                  )}
                  renderTags={(selected, getTagProps) =>
                    (selected as IShiftTemplate[]).map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option.id} size="small" label={option.name} />
                    ))
                  }
                />
              )}
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }}>
              {currentRule ? (
                <LoadingButton
                  variant="outlined"
                  loading={sendingTest}
                  onClick={handleSendTest}
                >
                  Gửi thử (tới tài khoản của bạn)
                </LoadingButton>
              ) : (
                <span />
              )}

              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentRule ? 'Tạo quy tắc' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
