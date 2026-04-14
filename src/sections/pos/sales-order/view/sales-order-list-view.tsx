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
import MenuItem from '@mui/material/MenuItem';
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

import { ISalesOrder, IKiotVietBankAccount } from 'src/types/corecms-api';
import { getAllSalesOrders, exportSalesOrdersExcel } from 'src/api/sales-orders';
import { getBankAccounts } from 'src/api/bank-accounts';

// Dữ liệu bank account trả về có cả `id` (Guid) và `kiotVietId` (int) — dùng kiotVietId
// làm giá trị filter để khớp với KiotVietPayment.AccountId trong DB.
type BankAccountOption = IKiotVietBankAccount & { kiotVietId?: number };

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
  { id: '', width: 100 },
];

// ----------------------------------------------------------------------

export default function SalesOrderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();

  const [tableData, setTableData] = useState<ISalesOrder[]>([]);
  const [filterName, setFilterName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bankAccountId, setBankAccountId] = useState<number | ''>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(() => ({
    keyword: filterName || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    paymentMethod: paymentMethod || undefined,
    bankAccountId: bankAccountId === '' ? undefined : bankAccountId,
  }), [filterName, fromDate, toDate, paymentMethod, bankAccountId]);

  const fetchData = useCallback(async () => {
    try {
      const orders = await getAllSalesOrders(buildParams());
      setTableData(orders);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải đơn hàng', { variant: 'error' });
    }
  }, [enqueueSnackbar, buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const accs = (await getBankAccounts()) as BankAccountOption[];
        setBankAccounts(accs);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      await exportSalesOrdersExcel(buildParams());
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Không thể xuất Excel', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  }, [buildParams, enqueueSnackbar]);

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

  const handleEditRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.salesOrder.edit(id));
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
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems="center">
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
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Iconify icon="solar:export-bold" />}
              onClick={handleExport}
              disabled={exporting}
              sx={{ minWidth: 160, whiteSpace: 'nowrap' }}
            >
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
          </Stack>
          <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
            <TextField
              type="date"
              label="Từ ngày"
              InputLabelProps={{ shrink: true }}
              value={fromDate}
              onChange={(e) => { table.onResetPage(); setFromDate(e.target.value); }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              type="date"
              label="Đến ngày"
              InputLabelProps={{ shrink: true }}
              value={toDate}
              onChange={(e) => { table.onResetPage(); setToDate(e.target.value); }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              select
              label="Phương thức"
              value={paymentMethod}
              onChange={(e) => { table.onResetPage(); setPaymentMethod(e.target.value); }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="Cash">Tiền mặt</MenuItem>
              <MenuItem value="Transfer">Chuyển khoản</MenuItem>
              <MenuItem value="Card">Thẻ</MenuItem>
            </TextField>
            <TextField
              select
              label="Tài khoản nhận"
              value={bankAccountId === '' ? '' : String(bankAccountId)}
              onChange={(e) => {
                table.onResetPage();
                setBankAccountId(e.target.value === '' ? '' : Number(e.target.value));
              }}
              sx={{ minWidth: 240, flex: 1 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {bankAccounts
                .filter((a) => a.kiotVietId != null)
                .map((a) => (
                  <MenuItem key={a.kiotVietId} value={String(a.kiotVietId)}>
                    {a.bankName} {a.accountNumber ? `- ${a.accountNumber}` : ''}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
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
                      <Tooltip title="Chỉnh sửa">
                        <IconButton onClick={(e) => { e.stopPropagation(); handleEditRow(row.id); }}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      </Tooltip>
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
