'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

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
import Checkbox from '@mui/material/Checkbox';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { IWarehouse } from 'src/types/corecms-api';
import { getAllWarehouses, deleteWarehouse } from 'src/api/warehouses';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên kho' },
  { id: 'address', label: 'Địa chỉ' },
  { id: 'phone', label: 'Điện thoại', width: 140 },
  { id: 'isDefault', label: 'Mặc định', width: 100 },
  { id: 'isActive', label: 'Trạng thái', width: 120 },
  { id: 'createdAt', label: 'Ngày tạo', width: 140 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function WarehouseListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IWarehouse[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setTableData(await getAllWarehouses());
    } catch (error) {
      enqueueSnackbar('Không thể tải kho hàng', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteRow = useCallback(async (id: string) => {
    try {
      await deleteWarehouse(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchData]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Kho hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng' },
        ]}
        action={
          <Button component={RouterLink} href={paths.dashboard.pos.warehouse.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
            Thêm kho
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
              <TableHeadCustom headLabel={TABLE_HEAD} />
              <TableBody>
                {tableData.map((row) => (
                  <WarehouseRow key={row.id} row={row} onDelete={() => handleDeleteRow(row.id)} onEdit={() => router.push(paths.dashboard.pos.warehouse.edit(row.id))} />
                ))}
                <TableNoData notFound={!tableData.length} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>
    </Container>
  );
}

// ----------------------------------------------------------------------

function WarehouseRow({ row, onDelete, onEdit }: { row: IWarehouse; onDelete: VoidFunction; onEdit: VoidFunction }) {
  const popover = usePopover();
  const confirm = useBoolean();

  return (
    <>
      <TableRow hover>
        <TableCell sx={{ fontWeight: 'bold' }}>{row.name}</TableCell>
        <TableCell>{row.address || '—'}</TableCell>
        <TableCell>{row.phone || '—'}</TableCell>
        <TableCell>{row.isDefault ? <Label color="primary">Mặc định</Label> : '—'}</TableCell>
        <TableCell><Label color={row.isActive ? 'success' : 'error'}>{row.isActive ? 'Hoạt động' : 'Ẩn'}</Label></TableCell>
        <TableCell>{format(new Date(row.createdAt), 'dd/MM/yyyy')}</TableCell>
        <TableCell align="right">
          <IconButton onClick={popover.onOpen}><Iconify icon="eva:more-vertical-fill" /></IconButton>
        </TableCell>
      </TableRow>
      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 140 }}>
        <MenuItem onClick={() => { onEdit(); popover.onClose(); }}><Iconify icon="solar:pen-bold" /> Sửa</MenuItem>
        <MenuItem onClick={() => { confirm.onTrue(); popover.onClose(); }} sx={{ color: 'error.main' }}><Iconify icon="solar:trash-bin-trash-bold" /> Xóa</MenuItem>
      </CustomPopover>
      <ConfirmDialog open={confirm.value} onClose={confirm.onFalse} title="Xóa" content={`Xóa kho "${row.name}"?`} action={<Button variant="contained" color="error" onClick={onDelete}>Xóa</Button>} />
    </>
  );
}
