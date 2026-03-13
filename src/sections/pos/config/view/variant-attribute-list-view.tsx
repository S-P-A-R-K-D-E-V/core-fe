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
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { useTable, TableHeadCustom, TableNoData } from 'src/components/table';

import { IVariantAttribute } from 'src/types/corecms-api';
import { getAllVariantAttributes, createVariantAttribute, updateVariantAttribute, deleteVariantAttribute } from 'src/api/variant-attributes';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên thuộc tính' },
  { id: 'values', label: 'Giá trị' },
  { id: 'sortOrder', label: 'Thứ tự', width: 100, align: 'center' as const },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function VariantAttributeListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const dialog = useBoolean();

  const [tableData, setTableData] = useState<IVariantAttribute[]>([]);
  const [editItem, setEditItem] = useState<IVariantAttribute | null>(null);
  const [formName, setFormName] = useState('');
  const [formValues, setFormValues] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setTableData(await getAllVariantAttributes());
    } catch (error) {
      enqueueSnackbar('Không thể tải thuộc tính', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpen = (item?: IVariantAttribute) => {
    setEditItem(item || null);
    setFormName(item?.name || '');
    setFormValues(item?.values?.map((v) => v.value).join(', ') || '');
    setFormSortOrder(item?.sortOrder || 0);
    dialog.onTrue();
  };

  const handleSave = async () => {
    try {
      if (editItem) {
        await updateVariantAttribute(editItem.id, { name: formName, sortOrder: formSortOrder });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        const values = formValues.split(',').map((v) => v.trim()).filter(Boolean);
        await createVariantAttribute({ name: formName, sortOrder: formSortOrder, values });
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
      await deleteVariantAttribute(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Thuộc tính biến thể"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Cấu hình', href: paths.dashboard.pos.variantAttribute.root },
          { name: 'Thuộc tính biến thể' },
        ]}
        action={
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => handleOpen()}>
            Thêm thuộc tính
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
                  <AttrRow key={row.id} row={row} onEdit={() => handleOpen(row)} onDelete={() => handleDelete(row.id)} />
                ))}
                <TableNoData notFound={!tableData.length} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Sửa thuộc tính' : 'Thêm thuộc tính'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tên (vd: Size, Màu)" value={formName} onChange={(e) => setFormName(e.target.value)} fullWidth />
            <TextField label="Thứ tự" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} fullWidth />
            {!editItem && (
              <TextField
                label="Giá trị (phân cách bằng dấu phẩy)"
                value={formValues}
                onChange={(e) => setFormValues(e.target.value)}
                fullWidth
                placeholder="S, M, L, XL"
                helperText="Nhập các giá trị, phân cách bằng dấu phẩy"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={dialog.onFalse}>Hủy</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function AttrRow({ row, onEdit, onDelete }: { row: IVariantAttribute; onEdit: VoidFunction; onDelete: VoidFunction }) {
  const popover = usePopover();
  const confirm = useBoolean();

  return (
    <>
      <TableRow hover>
        <TableCell sx={{ fontWeight: 'bold' }}>{row.name}</TableCell>
        <TableCell>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {row.values.map((v) => <Chip key={v.id} label={v.value} size="small" variant="outlined" />)}
          </Stack>
        </TableCell>
        <TableCell align="center">{row.sortOrder}</TableCell>
        <TableCell align="right">
          <IconButton onClick={popover.onOpen}><Iconify icon="eva:more-vertical-fill" /></IconButton>
        </TableCell>
      </TableRow>
      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 140 }}>
        <MenuItem onClick={() => { onEdit(); popover.onClose(); }}><Iconify icon="solar:pen-bold" /> Sửa</MenuItem>
        <MenuItem onClick={() => { confirm.onTrue(); popover.onClose(); }} sx={{ color: 'error.main' }}><Iconify icon="solar:trash-bin-trash-bold" /> Xóa</MenuItem>
      </CustomPopover>
      <ConfirmDialog open={confirm.value} onClose={confirm.onFalse} title="Xóa" content={`Xóa thuộc tính "${row.name}"?`} action={<Button variant="contained" color="error" onClick={onDelete}>Xóa</Button>} />
    </>
  );
}
