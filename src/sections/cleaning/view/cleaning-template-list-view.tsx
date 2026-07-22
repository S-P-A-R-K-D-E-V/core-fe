'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { ICleaningTaskTemplate } from 'src/types/corecms-api';

import {
  createCleaningTaskTemplate,
  deleteCleaningTaskTemplate,
  getCleaningTaskTemplates,
  updateCleaningTaskTemplate,
} from 'src/api/cleaning';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'dayOfWeek', label: 'Thứ', width: 120 },
  { id: 'cleaningBlock', label: 'Ca', width: 100 },
  { id: 'name', label: 'Đầu việc', width: 260 },
  { id: 'area', label: 'Khu vực', width: 200 },
  { id: 'sortOrder', label: 'Thứ tự', width: 80 },
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

// ----------------------------------------------------------------------

export default function CleaningTemplateListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();
  const isAdminUser = authUser?.role === 'Admin' || (authUser?.roles || []).includes('Admin');

  const [templates, setTemplates] = useState<ICleaningTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ICleaningTaskTemplate | null>(null);

  const [formData, setFormData] = useState({
    dayOfWeek: 'Monday',
    cleaningBlock: 'Morning',
    name: '',
    area: '',
    sortOrder: 0,
    isActive: true,
  });

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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenDialog = (template?: ICleaningTaskTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        dayOfWeek: template.dayOfWeek,
        cleaningBlock: template.cleaningBlock,
        name: template.name,
        area: template.area || '',
        sortOrder: template.sortOrder,
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        dayOfWeek: 'Monday',
        cleaningBlock: 'Morning',
        name: '',
        area: '',
        sortOrder: 0,
        isActive: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      enqueueSnackbar('Tên đầu việc là bắt buộc', { variant: 'error' });
      return;
    }
    try {
      if (editingTemplate) {
        await updateCleaningTaskTemplate(editingTemplate.id, formData);
        enqueueSnackbar('Cập nhật đầu việc thành công');
      } else {
        await createCleaningTaskTemplate({
          dayOfWeek: formData.dayOfWeek,
          cleaningBlock: formData.cleaningBlock,
          name: formData.name,
          area: formData.area || undefined,
          sortOrder: formData.sortOrder,
        });
        enqueueSnackbar('Tạo đầu việc thành công');
      }
      handleCloseDialog();
      fetchTemplates();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

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
        <DialogTitle>{editingTemplate ? 'Cập nhật' : 'Thêm'} đầu việc vệ sinh</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              select
              label="Thứ trong tuần"
              value={formData.dayOfWeek}
              onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
              fullWidth
            >
              {DAYS_OF_WEEK.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Khung ca"
              value={formData.cleaningBlock}
              onChange={(e) => setFormData({ ...formData, cleaningBlock: e.target.value })}
              fullWidth
            >
              {CLEANING_BLOCKS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Tên đầu việc"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />

            <TextField
              label="Khu vực (tuỳ chọn)"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              helperText='Ví dụ: "Tầng 1", "Quầy trưng bày"'
              fullWidth
            />

            <TextField
              label="Thứ tự hiển thị"
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
              fullWidth
            />

            {editingTemplate && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Áp dụng"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingTemplate ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
