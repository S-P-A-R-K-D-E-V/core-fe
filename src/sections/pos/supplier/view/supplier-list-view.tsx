'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Label from 'src/components/label';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
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

import { ISupplier } from 'src/types/corecms-api';
import { getAllSuppliers, deleteSupplier } from 'src/api/suppliers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên NCC' },
  { id: 'code', label: 'Mã', width: 120 },
  { id: 'contactPerson', label: 'Người liên hệ', width: 160 },
  { id: 'phone', label: 'SĐT', width: 130 },
  { id: 'email', label: 'Email', width: 180 },
  { id: 'totalOrders', label: 'Số đơn', width: 100, align: 'center' as const },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function SupplierListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<ISupplier[]>([]);
  const [filterName, setFilterName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const suppliers = await getAllSuppliers({ keyword: filterName || undefined });
      setTableData(suppliers);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải nhà cung cấp', { variant: 'error' });
    }
  }, [enqueueSnackbar, filterName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataFiltered = tableData;
  const dataInPage = dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage);
  const notFound = !dataFiltered.length;

  const handleFilterName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    table.onResetPage();
    setFilterName(event.target.value);
  }, [table]);

  const handleDeleteRow = useCallback(async (id: string) => {
    try {
      await deleteSupplier(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRow(dataInPage.length);
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteSupplier(id)));
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRows({ totalRowsInPage: dataInPage.length, totalRowsFiltered: dataFiltered.length });
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataFiltered.length, dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleEditRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.supplier.edit(id));
  }, [router]);

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Nhà cung cấp"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kho hàng', href: paths.dashboard.pos.root },
            { name: 'Nhà cung cấp' },
          ]}
          action={
            <Button component={RouterLink} href={paths.dashboard.pos.supplier.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
              Thêm NCC
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Stack spacing={2} direction="row" alignItems="center" sx={{ p: 2.5 }}>
            <TextField
              fullWidth
              value={filterName}
              onChange={handleFilterName}
              placeholder="Tìm theo tên, mã, SĐT, email..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={dataFiltered.length}
              onSelectAllRows={(checked) => table.onSelectAllRows(checked, dataFiltered.map((row) => row.id))}
              action={<Button color="error" onClick={confirm.onTrue}>Xóa</Button>}
            />
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={dataFiltered.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                  onSelectAllRows={(checked) => table.onSelectAllRows(checked, dataFiltered.map((row) => row.id))}
                />
                <TableBody>
                  {dataInPage.map((row) => (
                    <TableRow key={row.id} hover selected={table.selected.includes(row.id)}>
                      <TableCell padding="checkbox">
                        <input type="checkbox" checked={table.selected.includes(row.id)} onChange={() => table.onSelectRow(row.id)} />
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.code || '—'}</TableCell>
                      <TableCell>{row.contactPerson || '—'}</TableCell>
                      <TableCell>{row.phone || '—'}</TableCell>
                      <TableCell>{row.email || '—'}</TableCell>
                      <TableCell align="center">{row.totalOrders}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.isActive ? 'success' : 'error'}>
                          {row.isActive ? 'Hoạt động' : 'Ngưng'}
                        </Label>
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title="Sửa">
                          <IconButton onClick={() => handleEditRow(row.id)}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton color="error" onClick={() => handleDeleteRow(row.id)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableEmptyRows height={table.dense ? 56 : 76} emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)} />
                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
          <TablePaginationCustom
            count={dataFiltered.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      </Container>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Xóa"
        content={<>Bạn có chắc muốn xóa <strong>{table.selected.length}</strong> nhà cung cấp?</>}
        action={<Button variant="contained" color="error" onClick={() => { handleDeleteRows(); confirm.onFalse(); }}>Xóa</Button>}
      />
    </>
  );
}
