'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import FormProvider, {
  RHFSelect,
  RHFSwitch,
  RHFTextField,
  RHFDatePicker,
  RHFMultiSelect,
} from 'src/components/hook-form';

import { parseDateStr } from 'src/utils/format-time';

import type { ICleaningTaskTemplate, IShiftTemplate } from 'src/types/corecms-api';

import { getAllShiftTemplates } from 'src/api/attendance';
import {
  createCleaningTaskTemplate,
  deleteCleaningTaskTemplate,
  getCleaningTaskTemplates,
  updateCleaningTaskTemplate,
} from 'src/api/cleaning';

import {
  CleaningTemplateSchema,
  DEFAULT_CLEANING_TEMPLATE_VALUES,
  templateToFormValues,
  type CleaningTemplateSchemaType,
} from '../cleaning-template-schema';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'dayOfWeek', label: 'Thứ', width: 100 },
  { id: 'cleaningBlock', label: 'Ca', width: 90 },
  { id: 'name', label: 'Đầu việc', width: 220 },
  { id: 'area', label: 'Khu vực', width: 160 },
  { id: 'sortOrder', label: 'Thứ tự', width: 70 },
  { id: 'appliedRange', label: 'Áp dụng', width: 180 },
  { id: 'shiftTemplates', label: 'Áp dụng cho ca', width: 200 },
  { id: 'status', label: 'Trạng thái', width: 110 },
  { id: 'actions', label: 'Hành động', width: 140 },
];

const DAYS_OF_WEEK = [
  { value: 'Monday', label: 'Thứ 2' },
  { value: 'Tuesday', label: 'Thứ 3' },
  { value: 'Wednesday', label: 'Thứ 4' },
  { value: 'Thursday', label: 'Thứ 5' },
  { value: 'Friday', label: 'Thứ 6' },
  { value: 'Saturday', label: 'Thứ 7' },
  { value: 'Sunday', label: 'Chủ nhật' },
];

const CLEANING_BLOCKS = [
  { value: 'Morning', label: 'Sáng' },
  { value: 'Afternoon', label: 'Chiều' },
  { value: 'Evening', label: 'Tối' },
];

const dayLabel = (value: string) => DAYS_OF_WEEK.find((d) => d.value === value)?.label ?? value;
const blockLabel = (value: string) => CLEANING_BLOCKS.find((b) => b.value === value)?.label ?? value;

function formatDateVi(value: string) {
  const d = parseDateStr(value);
  return d ? d.toLocaleDateString('vi-VN') : value;
}

// ----------------------------------------------------------------------

export default function CleaningTemplateListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();
  const isAdminUser = authUser?.role === 'Admin' || (authUser?.roles || []).includes('Admin');

  const [templates, setTemplates] = useState<ICleaningTaskTemplate[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<IShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ICleaningTaskTemplate | null>(null);

  const methods = useForm<CleaningTemplateSchemaType>({
    resolver: zodResolver(CleaningTemplateSchema),
    defaultValues: DEFAULT_CLEANING_TEMPLATE_VALUES,
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = methods;

  const fromDateValue = watch('fromDate');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCleaningTaskTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching cleaning templates:', error);
      enqueueSnackbar('Không thể tải checklist vệ sinh', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const fetchShiftTemplates = useCallback(async () => {
    try {
      const data = await getAllShiftTemplates();
      setShiftTemplates(data);
    } catch (error) {
      console.error('Error fetching shift templates:', error);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchShiftTemplates();
  }, [fetchTemplates, fetchShiftTemplates]);

  const shiftTemplateOptions = shiftTemplates.map((s) => ({ label: s.name, value: s.id }));

  const shiftTemplateNames = (ids: string[]) =>
    ids
      .map((id) => shiftTemplates.find((s) => s.id === id)?.name || id)
      .join(', ') || '-';

  const handleOpenDialog = (template?: ICleaningTaskTemplate) => {
    if (template) {
      setEditingTemplate(template);
      reset(templateToFormValues(template));
    } else {
      setEditingTemplate(null);
      reset(DEFAULT_CLEANING_TEMPLATE_VALUES);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        dayOfWeek: data.dayOfWeek,
        cleaningBlock: data.cleaningBlock,
        name: data.name,
        area: data.area || undefined,
        sortOrder: data.sortOrder,
        fromDate: data.fromDate,
        toDate: data.toDate || undefined,
        shiftTemplateIds: data.shiftTemplateIds,
      };

      if (editingTemplate) {
        await updateCleaningTaskTemplate(editingTemplate.id, {
          ...payload,
          isActive: data.isActive,
        });
        enqueueSnackbar('Cập nhật đầu việc thành công');
      } else {
        await createCleaningTaskTemplate(payload);
        enqueueSnackbar('Tạo đầu việc thành công');
      }
      handleCloseDialog();
      fetchTemplates();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xoá đầu việc này? Không thể xoá nếu đã có lịch sử phát sinh.')) return;
    try {
      await deleteCleaningTaskTemplate(id);
      enqueueSnackbar('Xoá thành công');
      fetchTemplates();
    } catch (error: any) {
      enqueueSnackbar(
        error?.title || 'Không thể xoá — đầu việc đã có lịch sử, hãy chuyển sang Ngưng áp dụng',
        { variant: 'error' }
      );
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Checklist vệ sinh"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Checklist' },
        ]}
        action={
          isAdminUser && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => handleOpenDialog()}
            >
              Thêm đầu việc
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size="medium">
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>{dayLabel(template.dayOfWeek)}</TableCell>
                      <TableCell>{blockLabel(template.cleaningBlock)}</TableCell>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>{template.area || '-'}</TableCell>
                      <TableCell>{template.sortOrder}</TableCell>
                      <TableCell>
                        Từ {formatDateVi(template.fromDate)}
                        {template.toDate ? ` đến ${formatDateVi(template.toDate)}` : ''}
                      </TableCell>
                      <TableCell>{shiftTemplateNames(template.shiftTemplateIds || [])}</TableCell>
                      <TableCell>
                        <Label color={template.isActive ? 'success' : 'default'}>
                          {template.isActive ? 'Áp dụng' : 'Ngưng áp dụng'}
                        </Label>
                      </TableCell>
                      <TableCell>
                        {isAdminUser && (
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => handleOpenDialog(template)}>
                              Sửa
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete(template.id)}>
                              Xoá
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editingTemplate ? 'Cập nhật' : 'Thêm'} đầu việc vệ sinh</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <RHFSelect name="dayOfWeek" label="Thứ trong tuần">
                {DAYS_OF_WEEK.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </RHFSelect>

              <RHFSelect name="cleaningBlock" label="Khung ca">
                {CLEANING_BLOCKS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </RHFSelect>

              <RHFTextField name="name" label="Tên đầu việc" />

              <RHFTextField name="area" label="Khu vực (tuỳ chọn)" helperText='Ví dụ: "Tầng 1", "Quầy trưng bày"' />

              <RHFTextField name="sortOrder" label="Thứ tự hiển thị" type="number" />

              <RHFMultiSelect
                name="shiftTemplateIds"
                label="Áp dụng cho ca"
                options={shiftTemplateOptions}
                checkbox
                chip
                fullWidth
                placeholder="Chọn các ca làm việc áp dụng đầu việc này"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <RHFDatePicker name="fromDate" label="Áp dụng từ ngày" sx={{ flex: 1 }} />
                <RHFDatePicker
                  name="toDate"
                  label="Đến ngày (để trống = vô thời hạn)"
                  minDate={fromDateValue}
                  sx={{ flex: 1 }}
                />
              </Stack>

              {editingTemplate && <RHFSwitch name="isActive" label="Áp dụng" />}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Huỷ</Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {editingTemplate ? 'Cập nhật' : 'Tạo mới'}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>
    </Container>
  );
}
