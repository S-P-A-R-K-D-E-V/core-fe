'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { useTable, TableHeadCustom, TableNoData } from 'src/components/table';

import { IUnitOfMeasure } from 'src/types/corecms-api';
import { getAllUnitOfMeasures, createUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure } from 'src/api/unit-of-measures';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên' },
  { id: 'abbreviation', label: 'Viết tắt', width: 140 },
  { id: 'isActive', label: 'Trạng thái', width: 120 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function UnitOfMeasureListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const dialog = useBoolean();

  const [tableData, setTableData] = useState<IUnitOfMeasure[]>([]);
  const [editItem, setEditItem] = useState<IUnitOfMeasure | null>(null);
  const [formName, setFormName] = useState('');
  const [formAbbr, setFormAbbr] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setTableData(await getAllUnitOfMeasures());
    } catch (error) {
      enqueueSnackbar('Không thể tải đơn vị tính', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpen = (item?: IUnitOfMeasure) => {
    setEditItem(item || null);
    setFormName(item?.name || '');
    setFormAbbr(item?.abbreviation || '');
    dialog.onTrue();
  };

  const handleSave = async () => {
    try {
      if (editItem) {
        await updateUnitOfMeasure(editItem.id, { name: formName, abbreviation: formAbbr });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createUnitOfMeasure({ name: formName, abbreviation: formAbbr });
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUnitOfMeasure(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Đơn vị tính"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Cấu hình', href: paths.dashboard.pos.unitOfMeasure.root },
          { name: 'Đơn vị tính' },
        ]}
        action={
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => handleOpen()}>
            Thêm đơn vị
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'}>
              <TableHeadCustom headLabel={TABLE_HEAD} />
              <TableBody>
                {tableData.map((row) => (
                  <UomRow key={row.id} row={row} onEdit={() => handleOpen(row)} onDelete={() => handleDelete(row.id)} />
                ))}
                <TableNoData notFound={!tableData.length} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>{editItem ? 'Sửa đơn vị tính' : 'Thêm đơn vị tính'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tên" value={formName} onChange={(e) => setFormName(e.target.value)} fullWidth />
            <TextField label="Viết tắt" value={formAbbr} onChange={(e) => setFormAbbr(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={dialog.onFalse}>Hủy</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName || !formAbbr}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function UomRow({ row, onEdit, onDelete }: { row: IUnitOfMeasure; onEdit: VoidFunction; onDelete: VoidFunction }) {
  const popover = usePopover();
  const confirm = useBoolean();

  return (
    <>
      <TableRow hover>
        <TableCell sx={{ fontWeight: 'bold' }}>{row.name}</TableCell>
        <TableCell>{row.abbreviation}</TableCell>
        <TableCell><Label color={row.isActive ? 'success' : 'error'}>{row.isActive ? 'Hoạt động' : 'Ẩn'}</Label></TableCell>
        <TableCell align="right">
          <IconButton onClick={popover.onOpen}><Iconify icon="eva:more-vertical-fill" /></IconButton>
        </TableCell>
      </TableRow>
      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 140 }}>
        <MenuItem onClick={() => { onEdit(); popover.onClose(); }}><Iconify icon="solar:pen-bold" /> Sửa</MenuItem>
        <MenuItem onClick={() => { confirm.onTrue(); popover.onClose(); }} sx={{ color: 'error.main' }}><Iconify icon="solar:trash-bin-trash-bold" /> Xóa</MenuItem>
      </CustomPopover>
      <ConfirmDialog open={confirm.value} onClose={confirm.onFalse} title="Xóa" content={`Xóa "${row.name}"?`} action={<Button variant="contained" color="error" onClick={onDelete}>Xóa</Button>} />
    </>
  );
}
