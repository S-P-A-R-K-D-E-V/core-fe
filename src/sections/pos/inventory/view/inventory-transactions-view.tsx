'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';

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

import { IInventoryTransaction } from 'src/types/corecms-api';
import { getInventoryTransactions } from 'src/api/inventory';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'createdAt', label: 'Thời gian', width: 160 },
  { id: 'product', label: 'Sản phẩm' },
  { id: 'variant', label: 'Biến thể', width: 140 },
  { id: 'warehouse', label: 'Kho', width: 140 },
  { id: 'type', label: 'Loại', width: 130 },
  { id: 'quantity', label: 'Số lượng', width: 110, align: 'center' as const },
  { id: 'note', label: 'Ghi chú' },
  { id: 'createdBy', label: 'Người tạo', width: 140 },
];

const TYPE_LABELS: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  Import: { label: 'Nhập', color: 'success' },
  Export: { label: 'Xuất', color: 'error' },
  Adjustment: { label: 'Điều chỉnh', color: 'warning' },
  Sale: { label: 'Bán hàng', color: 'info' },
  Return: { label: 'Trả hàng', color: 'default' },
  StockCheck: { label: 'Kiểm kho', color: 'default' },
};

// ----------------------------------------------------------------------

export default function InventoryTransactionsView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultOrderBy: 'createdAt' });

  const [tableData, setTableData] = useState<IInventoryTransaction[]>([]);
  const [filterName, setFilterName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const data = await getInventoryTransactions();
      setTableData(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải lịch sử', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataFiltered = filterName
    ? tableData.filter((t) => t.productName.toLowerCase().includes(filterName.toLowerCase()))
    : tableData;

  const notFound = !dataFiltered.length;

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Lịch sử nhập xuất"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.root },
          { name: 'Lịch sử' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Stack sx={{ p: 2.5 }}>
          <TextField
            fullWidth
            value={filterName}
            onChange={(e) => { table.onResetPage(); setFilterName(e.target.value); }}
            placeholder="Tìm theo sản phẩm..."
            InputProps={{ startAdornment: <InputAdornment position="start"><Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} /></InputAdornment> }}
          />
        </Stack>

        <TableContainer sx={{ overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 1080 }}>
              <TableHeadCustom
                order={table.order}
                orderBy={table.orderBy}
                headLabel={TABLE_HEAD}
                onSort={table.onSort}
              />
              <TableBody>
                {dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage).map((row) => {
                  const typeInfo = TYPE_LABELS[row.transactionType] || { label: row.transactionType, color: 'default' as const };
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>{format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{row.productName}</TableCell>
                      <TableCell>{row.productVariantName || '—'}</TableCell>
                      <TableCell>{row.warehouseName}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={typeInfo.color}>{typeInfo.label}</Label>
                      </TableCell>
                      <TableCell align="center">
                        <Label variant="soft" color={row.quantity > 0 ? 'success' : 'error'}>
                          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                        </Label>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{row.note || '—'}</TableCell>
                      <TableCell>{row.createdByName}</TableCell>
                    </TableRow>
                  );
                })}
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
