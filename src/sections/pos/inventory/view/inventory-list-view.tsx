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
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { IInventoryItem, IWarehouse } from 'src/types/corecms-api';
import { getInventoryItems } from 'src/api/inventory';
import { getAllWarehouses } from 'src/api/warehouses';
import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'product', label: 'Sản phẩm' },
  { id: 'sku', label: 'SKU', width: 140 },
  { id: 'variant', label: 'Biến thể', width: 140 },
  { id: 'category', label: 'Danh mục', width: 140 },
  { id: 'warehouse', label: 'Kho', width: 140 },
  { id: 'quantity', label: 'Số lượng', width: 110, align: 'center' as const },
  { id: 'threshold', label: 'Ngưỡng', width: 100, align: 'center' as const },
  { id: 'status', label: 'Trạng thái', width: 130 },
];

// ----------------------------------------------------------------------

type Props = { lowStockOnly?: boolean };

export default function InventoryListView({ lowStockOnly = false }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();

  const [tableData, setTableData] = useState<IInventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterName, setFilterName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [items, whs] = await Promise.all([
        getInventoryItems({ warehouseId: filterWarehouse || undefined, lowStockOnly }),
        getAllWarehouses(),
      ]);
      setTableData(items);
      setWarehouses(whs);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải dữ liệu tồn kho', { variant: 'error' });
    }
  }, [enqueueSnackbar, filterWarehouse, lowStockOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataFiltered = filterName
    ? tableData.filter((item) => item.productName.toLowerCase().includes(filterName.toLowerCase()) || item.productSku.toLowerCase().includes(filterName.toLowerCase()))
    : tableData;

  const notFound = !dataFiltered.length;

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading={lowStockOnly ? 'Sắp hết hàng' : 'Tồn kho'}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.root },
          { name: lowStockOnly ? 'Sắp hết hàng' : 'Tồn kho' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} sx={{ p: 2.5 }}>
          <TextField
            select
            label="Kho hàng"
            value={filterWarehouse}
            onChange={(e) => { table.onResetPage(); setFilterWarehouse(e.target.value); }}
            sx={{ width: { xs: 1, md: 240 } }}
          >
            <MenuItem value="">Tất cả kho</MenuItem>
            {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth
            value={filterName}
            onChange={(e) => { table.onResetPage(); setFilterName(e.target.value); }}
            placeholder="Tìm theo sản phẩm hoặc SKU..."
            InputProps={{ startAdornment: <InputAdornment position="start"><Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} /></InputAdornment> }}
          />
        </Stack>

        <TableContainer sx={{ overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
              <TableHeadCustom
                order={table.order}
                orderBy={table.orderBy}
                headLabel={TABLE_HEAD}
                onSort={table.onSort}
              />
              <TableBody>
                {dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{row.productName}</TableCell>
                    <TableCell>{row.productSku}</TableCell>
                    <TableCell>{row.productVariantName || '—'}</TableCell>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell>{row.warehouseName}</TableCell>
                    <TableCell align="center">
                      <Label variant="soft" color={row.quantity <= 0 ? 'error' : row.isLowStock ? 'warning' : 'success'}>
                        {row.quantity}
                      </Label>
                    </TableCell>
                    <TableCell align="center">{row.lowStockThreshold}</TableCell>
                    <TableCell>
                      {row.isLowStock ? (
                        <Chip label="Sắp hết" color="warning" size="small" />
                      ) : (
                        <Chip label="Đủ hàng" color="success" size="small" variant="outlined" />
                      )}
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
  );
}
