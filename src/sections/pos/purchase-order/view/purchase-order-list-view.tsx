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
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Label from 'src/components/label';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

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
  TablePaginationCustom,
} from 'src/components/table';

import { IPurchaseOrder, ISupplier } from 'src/types/corecms-api';
import { getAllPurchaseOrders, cancelPurchaseOrder, confirmPurchaseOrder } from 'src/api/purchase-orders';
import { getAllSuppliers } from 'src/api/suppliers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'orderNumber', label: 'Mã đơn' },
  { id: 'supplier', label: 'Nhà cung cấp', width: 180 },
  { id: 'warehouse', label: 'Kho', width: 140 },
  { id: 'totalAmount', label: 'Tổng tiền', width: 140, align: 'right' as const },
  { id: 'status', label: 'Trạng thái', width: 150 },
  { id: 'createdAt', label: 'Ngày tạo', width: 120 },
  { id: 'createdBy', label: 'Người tạo', width: 130 },
  { id: '', width: 120 },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'Draft', label: 'Nháp' },
  { value: 'Confirmed', label: 'Đã duyệt' },
  { value: 'PartiallyReceived', label: 'Nhận một phần' },
  { value: 'Completed', label: 'Hoàn thành' },
  { value: 'Cancelled', label: 'Đã hủy' },
];

const STATUS_COLOR_MAP: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  Confirmed: 'info',
  PartiallyReceived: 'warning',
  Completed: 'success',
  Cancelled: 'error',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  Draft: 'Nháp',
  Confirmed: 'Đã duyệt',
  PartiallyReceived: 'Nhận một phần',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
};

// ----------------------------------------------------------------------

export default function PurchaseOrderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();
  const cancelConfirm = useConfirmDialog();

  const [tableData, setTableData] = useState<IPurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async () => {
    try {
      const [pagedResult, sups] = await Promise.all([
        getAllPurchaseOrders({
          supplierId: filterSupplier || undefined,
          status: filterStatus || undefined,
          pageNumber,
          pageSize,
        }),
        getAllSuppliers(),
      ]);
      setTableData(pagedResult.items);
      setTotalCount(pagedResult.totalCount);
      setSuppliers(sups);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải đơn nhập hàng', { variant: 'error' });
    }
  }, [enqueueSnackbar, filterSupplier, filterStatus, pageNumber, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const notFound = !tableData.length;

  const handleConfirmOrder = useCallback(async (id: string) => {
    try {
      await confirmPurchaseOrder(id);
      enqueueSnackbar('Duyệt đơn thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Duyệt thất bại', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchData]);

  const handleCancelOrder = useCallback(async (id: string) => {
    try {
      await cancelPurchaseOrder(id);
      enqueueSnackbar('Hủy đơn thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Hủy thất bại', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchData]);

  const handleViewRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.purchaseOrder.details(id));
  }, [router]);

  const handleEditRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.purchaseOrder.edit(id));
  }, [router]);

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Đơn nhập hàng"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kho hàng', href: paths.dashboard.pos.root },
            { name: 'Đơn nhập hàng' },
          ]}
          action={
            <Button component={RouterLink} href={paths.dashboard.pos.purchaseOrder.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
              Tạo đơn nhập
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="center" sx={{ p: 2.5 }}>
            <TextField
              select
              fullWidth
              label="Nhà cung cấp"
              value={filterSupplier}
              onChange={(e) => { setPageNumber(1); setFilterSupplier(e.target.value); }}
              sx={{ maxWidth: 240 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>

            <TextField
              select
              fullWidth
              label="Trạng thái"
              value={filterStatus}
              onChange={(e) => { setPageNumber(1); setFilterStatus(e.target.value); }}
              sx={{ maxWidth: 200 }}
            >
              {STATUS_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
          </Stack>

          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 1080 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={totalCount}
                  onSort={table.onSort}
                />
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleViewRow(row.id)}>
                      <TableCell><strong>{row.orderNumber}</strong></TableCell>
                      <TableCell>{row.supplierName}</TableCell>
                      <TableCell>{row.warehouseName}</TableCell>
                      <TableCell align="right">{fCurrency(row.totalAmount)}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={STATUS_COLOR_MAP[row.status] || 'default'}>
                          {STATUS_LABEL_MAP[row.status] || row.status}
                        </Label>
                      </TableCell>
                      <TableCell>{fDate(row.createdAt)}</TableCell>
                      <TableCell>{row.createdByName}</TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {row.status === 'Draft' && (
                          <>
                            <Tooltip title="Sửa đơn">
                              <IconButton color="primary" onClick={() => handleEditRow(row.id)}>
                                <Iconify icon="solar:pen-bold" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Duyệt">
                              <IconButton color="info" onClick={() => handleConfirmOrder(row.id)}>
                                <Iconify icon="solar:check-circle-bold" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Hủy">
                              <IconButton color="error" onClick={() => handleCancelOrder(row.id)}>
                                <Iconify icon="solar:close-circle-bold" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {(row.status === 'Confirmed' || row.status === 'PartiallyReceived') && (
                          <Tooltip title="Nhận hàng">
                            <IconButton color="success" onClick={() => handleViewRow(row.id)}>
                              <Iconify icon="solar:box-bold" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableEmptyRows height={table.dense ? 56 : 76} emptyRows={emptyRows(0, pageSize, tableData.length)} />
                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
          <TablePaginationCustom
            count={totalCount}
            page={pageNumber - 1}
            rowsPerPage={pageSize}
            onPageChange={(_, newPage) => setPageNumber(newPage + 1)}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPageNumber(1); }}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      </Container>
    </>
  );
}

// Simple confirm dialog hook (inline)
function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  return { value: open, onTrue: () => setOpen(true), onFalse: () => setOpen(false) };
}
