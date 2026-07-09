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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Label from 'src/components/label';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { AppDatePicker } from 'src/components/date-time-picker';
import { fCurrency } from 'src/utils/format-number';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { IExpense } from 'src/types/corecms-api';
import { getExpenses, deleteExpense } from 'src/api/expenses';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'expenseDate', label: 'Ngày chi', width: 120 },
  { id: 'categoryName', label: 'Danh mục' },
  { id: 'amount', label: 'Số tiền', width: 150, align: 'right' as const },
  { id: 'note', label: 'Ghi chú' },
  { id: 'source', label: 'Nguồn', width: 130 },
  { id: '', width: 88 },
];

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function ExpenseListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultRowsPerPage: 25 });
  const router = useRouter();
  const confirm = useBoolean();
  const defaults = getDefaultDates();

  const [tableData, setTableData] = useState<IExpense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getExpenses({
        fromDate,
        toDate,
        pageNumber: table.page + 1,
        pageSize: table.rowsPerPage,
      });
      setTableData(result.items);
      setTotalCount(result.totalCount);
      setTotalAmount(result.totalAmount);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh sách chi phí', { variant: 'error' });
    }
  }, [fromDate, toDate, table.page, table.rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteExpense(deleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    } finally {
      setDeleteId(null);
      confirm.onFalse();
    }
  }, [deleteId, enqueueSnackbar, fetchData, confirm]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Chi phí vận hành"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kho hàng', href: paths.dashboard.pos.root },
            { name: 'Chi phí' },
          ]}
          action={
            <Stack direction="row" spacing={1.5}>
              <Button
                component={RouterLink}
                href={paths.dashboard.pos.expense.recurringTemplates}
                variant="outlined"
                startIcon={<Iconify icon="solar:calendar-mark-bold" />}
              >
                Chi phí định kỳ
              </Button>
              <Button
                component={RouterLink}
                href={paths.dashboard.pos.expense.categories}
                variant="outlined"
                startIcon={<Iconify icon="solar:folder-bold" />}
              >
                Danh mục
              </Button>
              <Button
                component={RouterLink}
                href={paths.dashboard.pos.expense.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Thêm chi phí
              </Button>
            </Stack>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3, p: 2.5 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
            <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
            <Typography variant="subtitle2" sx={{ ml: 'auto' }}>
              Tổng: <Typography component="span" color="error.main" variant="subtitle1">{fCurrency(totalAmount)}</Typography>
            </Typography>
          </Stack>
        </Card>

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={tableData.length}
                  onSort={table.onSort}
                />
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{new Date(row.expenseDate).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell align="right">{fCurrency(row.amount)}</TableCell>
                      <TableCell>{row.note || '—'}</TableCell>
                      <TableCell>
                        {row.sourceTemplateId ? (
                          <Label variant="soft" color="info">Định kỳ</Label>
                        ) : (
                          <Label variant="soft" color="default">Nhập tay</Label>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title="Sửa">
                          <IconButton onClick={() => router.push(paths.dashboard.pos.expense.edit(row.id))}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={row.sourceTemplateId ? 'Không thể xóa khoản chi định kỳ' : 'Xóa'}>
                          <span>
                            <IconButton
                              color="error"
                              disabled={Boolean(row.sourceTemplateId)}
                              onClick={() => {
                                setDeleteId(row.id);
                                confirm.onTrue();
                              }}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableEmptyRows
                    height={table.dense ? 56 : 76}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, tableData.length)}
                  />
                  <TableNoData notFound={!tableData.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
          <TablePaginationCustom
            count={totalCount}
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
        onClose={() => {
          confirm.onFalse();
          setDeleteId(null);
        }}
        title="Xóa"
        content="Bạn có chắc muốn xóa khoản chi phí này?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xóa
          </Button>
        }
      />
    </RoleBasedGuard>
  );
}
