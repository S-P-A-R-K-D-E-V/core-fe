'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import LoadingButton from '@mui/lab/LoadingButton';

import Label from 'src/components/label';
import { paths } from 'src/routes/paths';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';
import { AppDatePicker } from 'src/components/date-time-picker';
import { useTable, TableHeadCustom, TableNoData, TablePaginationCustom } from 'src/components/table';
import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

import { IShareholder, ICapitalTransaction, CapitalTransactionType } from 'src/types/corecms-api';
import {
  getShareholders,
  getCapitalTransactions,
  createCapitalTransaction,
  updateCapitalTransaction,
  deleteCapitalTransaction,
} from 'src/api/shareholders';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'transactionDate', label: 'Ngày', width: 110 },
  { id: 'shareholder', label: 'Cổ đông' },
  { id: 'type', label: 'Loại giao dịch', width: 170 },
  { id: 'amount', label: 'Số tiền', width: 150, align: 'right' as const },
  { id: 'counterparty', label: 'Bên nhận', width: 140 },
  { id: 'note', label: 'Ghi chú' },
  { id: 'locked', label: 'Chốt sổ', width: 90 },
  { id: '', width: 88 },
];

const TYPE_LABEL: Record<CapitalTransactionType, string> = {
  Contribution: 'Góp vốn',
  ExpensePaidOnBehalf: 'Chi hộ',
  RevenueCollected: 'Thu về túi',
  Withdrawal: 'Rút tiền',
  PeerTransfer: 'Chuyển cho cổ đông',
};

const TYPE_COLOR: Record<CapitalTransactionType, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  Contribution: 'success',
  ExpensePaidOnBehalf: 'info',
  RevenueCollected: 'warning',
  Withdrawal: 'error',
  PeerTransfer: 'default',
};

const Schema = Yup.object().shape({
  shareholderId: Yup.string().required('Chọn cổ đông'),
  type: Yup.string()
    .oneOf(['Contribution', 'ExpensePaidOnBehalf', 'RevenueCollected', 'Withdrawal', 'PeerTransfer'])
    .required(),
  amount: Yup.number().typeError('Số tiền phải là số').positive('Số tiền phải lớn hơn 0').required(),
  transactionDate: Yup.string().required('Chọn ngày'),
  counterpartyShareholderId: Yup.string().nullable().default(null),
  note: Yup.string().nullable().default(null),
});

type FormValuesProps = Yup.InferType<typeof Schema>;

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function CapitalTransactionListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultRowsPerPage: 25 });
  const dialog = useBoolean();
  const confirm = useBoolean();
  const defaults = getDefaultDates();

  const [tableData, setTableData] = useState<ICapitalTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [filterShareholder, setFilterShareholder] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editing, setEditing] = useState<ICapitalTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchShareholders = useCallback(async () => {
    try {
      setShareholders(await getShareholders());
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const result = await getCapitalTransactions({
        fromDate,
        toDate,
        shareholderId: filterShareholder || undefined,
        type: (filterType as CapitalTransactionType) || undefined,
        pageNumber: table.page + 1,
        pageSize: table.rowsPerPage,
      });
      setTableData(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải sổ giao dịch vốn', { variant: 'error' });
    }
  }, [fromDate, toDate, filterShareholder, filterType, table.page, table.rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchShareholders();
  }, [fetchShareholders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const defaultValues = useMemo(
    () => ({
      shareholderId: editing?.shareholderId || '',
      type: editing?.type || ('Contribution' as CapitalTransactionType),
      amount: editing?.amount ?? 0,
      transactionDate: editing?.transactionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      counterpartyShareholderId: editing?.counterpartyShareholderId || null,
      note: editing?.note || null,
    }),
    [editing]
  );

  const methods = useForm<FormValuesProps>({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const watchedType = watch('type');
  const watchedShareholderId = watch('shareholderId');

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleOpenCreate = () => {
    setEditing(null);
    dialog.onTrue();
  };

  const handleOpenEdit = (row: ICapitalTransaction) => {
    if (row.settlementPeriodId) {
      enqueueSnackbar('Giao dịch đã thuộc kỳ chốt sổ, không thể sửa', { variant: 'warning' });
      return;
    }
    setEditing(row);
    dialog.onTrue();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        shareholderId: data.shareholderId,
        type: data.type as CapitalTransactionType,
        amount: data.amount,
        transactionDate: data.transactionDate,
        counterpartyShareholderId:
          data.type === 'PeerTransfer' ? data.counterpartyShareholderId : null,
        note: data.note,
      };
      if (editing) {
        await updateCapitalTransaction(editing.id, payload);
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createCapitalTransaction(payload);
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteCapitalTransaction(deleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Giao dịch đã chốt sổ không thể xóa', { variant: 'error' });
    } finally {
      setDeleteId(null);
      confirm.onFalse();
    }
  }, [deleteId, enqueueSnackbar, fetchData, confirm]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading="Sổ giao dịch vốn"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông', href: paths.dashboard.pos.shareholder.list },
            { name: 'Sổ giao dịch' },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleOpenCreate}
            >
              Thêm giao dịch
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
              <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
              <TextField
                select
                label="Cổ đông"
                value={filterShareholder}
                onChange={(e) => setFilterShareholder(e.target.value)}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {shareholders.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Loại giao dịch"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                sx={{ minWidth: 190 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 960 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} rowCount={tableData.length} />
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{fDate(row.transactionDate)}</TableCell>
                      <TableCell>{row.shareholderName}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={TYPE_COLOR[row.type] ?? 'default'}>
                          {TYPE_LABEL[row.type] ?? row.type}
                        </Label>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="subtitle2"
                          color={
                            ['Contribution', 'ExpensePaidOnBehalf'].includes(row.type)
                              ? 'success.main'
                              : ['RevenueCollected', 'Withdrawal'].includes(row.type)
                                ? 'error.main'
                                : 'text.primary'
                          }
                        >
                          {fCurrency(row.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.counterpartyShareholderName || '—'}</TableCell>
                      <TableCell>{row.note || '—'}</TableCell>
                      <TableCell>
                        {row.settlementPeriodId ? (
                          <Label variant="soft" color="default">
                            Đã chốt
                          </Label>
                        ) : (
                          <Label variant="soft" color="success">
                            Mở
                          </Label>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title={row.settlementPeriodId ? 'Đã chốt sổ' : 'Sửa'}>
                          <span>
                            <IconButton
                              disabled={!!row.settlementPeriodId}
                              onClick={() => handleOpenEdit(row)}
                            >
                              <Iconify icon="solar:pen-bold" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={row.settlementPeriodId ? 'Đã chốt sổ' : 'Xóa'}>
                          <span>
                            <IconButton
                              color="error"
                              disabled={!!row.settlementPeriodId}
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

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="sm" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Sửa giao dịch vốn' : 'Thêm giao dịch vốn'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFSelect name="shareholderId" label="Cổ đông">
                {shareholders
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
              </RHFSelect>

              <RHFSelect
                name="type"
                label="Loại giao dịch"
                helperText="Góp vốn/Chi hộ = đưa tiền vào; Thu về túi/Rút = lấy tiền ra; Chuyển = trả nợ cổ đông khác"
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </RHFSelect>

              {watchedType === 'PeerTransfer' && (
                <RHFSelect name="counterpartyShareholderId" label="Bên nhận tiền">
                  {shareholders
                    .filter((s) => s.isActive && s.id !== watchedShareholderId)
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                </RHFSelect>
              )}

              <RHFTextField name="amount" label="Số tiền (đ)" type="number" />

              <Controller
                name="transactionDate"
                control={control}
                render={({ field }) => (
                  <AppDatePicker label="Ngày giao dịch" value={field.value} onChange={field.onChange} />
                )}
              />

              <RHFTextField name="note" label="Ghi chú" multiline rows={2} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={dialog.onFalse}>Hủy</Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {editing ? 'Lưu' : 'Tạo'}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>

      <ConfirmDialog
        open={confirm.value}
        onClose={() => {
          confirm.onFalse();
          setDeleteId(null);
        }}
        title="Xóa giao dịch"
        content="Bạn có chắc muốn xóa giao dịch này?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xóa
          </Button>
        }
      />
    </RoleBasedGuard>
  );
}
