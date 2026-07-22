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
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { ICleaningTaskDefinition } from 'src/types/corecms-api';

import {
  createCleaningTaskDefinition,
  deleteCleaningTaskDefinition,
  getCleaningTaskDefinitions,
  updateCleaningTaskDefinition,
} from 'src/api/cleaning';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên đầu việc', width: 280 },
  { id: 'area', label: 'Khu vực', width: 220 },
  { id: 'status', label: 'Trạng thái', width: 110 },
  { id: 'actions', label: 'Hành động', width: 140 },
];

// ----------------------------------------------------------------------

export default function CleaningTaskLibraryView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [definitions, setDefinitions] = useState<ICleaningTaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<ICleaningTaskDefinition | null>(null);

  const [formData, setFormData] = useState({ name: '', area: '', isActive: true });

  const fetchDefinitions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCleaningTaskDefinitions();
      setDefinitions(data);
    } catch (error) {
      console.error('Error fetching cleaning task definitions:', error);
      enqueueSnackbar('Không thể tải thư viện đầu việc', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleOpenDialog = (definition?: ICleaningTaskDefinition) => {
    if (definition) {
      setEditing(definition);
      setFormData({ name: definition.name, area: definition.area || '', isActive: definition.isActive });
    } else {
      setEditing(null);
      setFormData({ name: '', area: '', isActive: true });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      enqueueSnackbar('Tên đầu việc là bắt buộc', { variant: 'error' });
      return;
    }
    try {
      if (editing) {
        await updateCleaningTaskDefinition(editing.id, {
          name: formData.name,
          area: formData.area || undefined,
          isActive: formData.isActive,
        });
        enqueueSnackbar('Cập nhật thành công');
      } else {
        await createCleaningTaskDefinition({ name: formData.name, area: formData.area || undefined });
        enqueueSnackbar('Thêm vào thư viện thành công');
      }
      handleCloseDialog();
      fetchDefinitions();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xoá đầu việc này khỏi thư viện? Các ca đã gán trước đó không bị ảnh hưởng.')) return;
    try {
      await deleteCleaningTaskDefinition(id);
      enqueueSnackbar('Xoá thành công');
      fetchDefinitions();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Thư viện đầu việc"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Thư viện đầu việc' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => handleOpenDialog()}
          >
            Thêm đầu việc
          </Button>
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
                  {definitions.map((definition) => (
                    <TableRow key={definition.id}>
                      <TableCell>{definition.name}</TableCell>
                      <TableCell>{definition.area || '-'}</TableCell>
                      <TableCell>
                        <Label color={definition.isActive ? 'success' : 'default'}>
                          {definition.isActive ? 'Đang dùng' : 'Ẩn'}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => handleOpenDialog(definition)}>
                            Sửa
                          </Button>
                          <Button size="small" color="error" onClick={() => handleDelete(definition.id)}>
                            Xoá
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {definitions.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Cập nhật' : 'Thêm'} đầu việc vào thư viện</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
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
            {editing && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Hiện trong thư viện"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editing ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
