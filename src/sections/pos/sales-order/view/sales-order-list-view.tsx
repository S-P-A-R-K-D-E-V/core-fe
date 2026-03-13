'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Label from 'src/components/label';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
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

import { ISalesOrder } from 'src/types/corecms-api';
import { getAllSalesOrders } from 'src/api/sales-orders';

// ----------------------------------------------------------------------

const STATUS_COLOR_MAP: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  Draft: 'default',
  Confirmed: 'info',
  Completed: 'success',
  Cancelled: 'error',
  Returned: 'warning',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  Draft: 'Nháp',
  Confirmed: 'Đã xác nhận',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
  Returned: 'Trả hàng',
};

const PAYMENT_STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  Pending: 'default',
  Paid: 'success',
  PartiallyPaid: 'warning',
  Refunded: 'error',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  Pending: 'Chưa TT',
  Paid: 'Đã TT',
  PartiallyPaid: 'TT một phần',
  Refunded: 'Hoàn tiền',
};

const TABLE_HEAD = [
  { id: 'orderNumber', label: 'Mã đơn', width: 160 },
  { id: 'customerName', label: 'Khách hàng' },
  { id: 'totalAmount', label: 'Tổng tiền', width: 140, align: 'right' as const },
  { id: 'status', label: 'Trạng thái', width: 130 },
  { id: 'paymentStatus', label: 'Thanh toán', width: 130 },
  { id: 'createdByName', label: 'Người tạo', width: 150 },
  { id: 'createdAt', label: 'Ngày tạo', width: 170 },
  { id: '', width: 60 },
];

// ----------------------------------------------------------------------

export default function SalesOrderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();

  const [tableData, setTableData] = useState<ISalesOrder[]>([]);
  const [filterName, setFilterName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const orders = await getAllSalesOrders({ keyword: filterName || undefined });
      setTableData(orders);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải đơn hàng', { variant: 'error' });
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

  const handleViewRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.salesOrder.details(id));
  }, [router]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Đơn bán hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.root },
          { name: 'Bán hàng' },
        ]}
        action={
          <Button component={RouterLink} href={paths.dashboard.pos.salesOrder.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
            Tạo đơn
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
            placeholder="Tìm theo mã đơn, tên khách hàng..."
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
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
              <TableHeadCustom
                order={table.order}
                orderBy={table.orderBy}
                headLabel={TABLE_HEAD}
                rowCount={dataFiltered.length}
                onSort={table.onSort}
              />
              <TableBody>
                {dataInPage.map((row) => (
                  <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleViewRow(row.id)}>
                    <TableCell><strong>{row.orderNumber}</strong></TableCell>
                    <TableCell>{row.customerName || 'Khách lẻ'}</TableCell>
                    <TableCell align="right">{fCurrency(row.totalAmount)}</TableCell>
                    <TableCell>
                      <Label variant="soft" color={STATUS_COLOR_MAP[row.status]}>
                        {STATUS_LABEL_MAP[row.status] || row.status}
                      </Label>
                    </TableCell>
                    <TableCell>
                      <Label variant="soft" color={PAYMENT_STATUS_COLOR[row.paymentStatus]}>
                        {PAYMENT_STATUS_LABEL[row.paymentStatus] || row.paymentStatus}
                      </Label>
                    </TableCell>
                    <TableCell>{row.createdByName}</TableCell>
                    <TableCell>{fDateTime(row.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Chi tiết">
                        <IconButton onClick={(e) => { e.stopPropagation(); handleViewRow(row.id); }}>
                          <Iconify icon="solar:eye-bold" />
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
  );
}
