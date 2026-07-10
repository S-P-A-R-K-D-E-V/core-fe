'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import Stack from '@mui/material/Stack';
import LoadingButton from '@mui/lab/LoadingButton';

import Label from 'src/components/label';
import { useBoolean } from 'src/hooks/use-boolean';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import FormProvider, { RHFSelect, RHFSwitch } from 'src/components/hook-form';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { AppDatePicker } from 'src/components/date-time-picker';

import { IShareholder, IRevenueChannel, IKiotVietBankAccount } from 'src/types/corecms-api';
import { fPaymentMethod } from 'src/utils/payment-method-label';
import { getBankAccounts } from 'src/api/bank-accounts';
import {
  getRevenueChannels,
  getKnownPaymentMethods,
  createRevenueChannel,
  updateRevenueChannel,
  deleteRevenueChannel,
} from 'src/api/shareholders';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'method', label: 'Phương thức' },
  { id: 'bank', label: 'Tài khoản ngân hàng' },
  { id: 'shareholder', label: 'Cổ đông nhận' },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: '', width: 88 },
];

// Luôn hiện sẵn 3 phương thức phổ biến (kể cả khi hệ thống chưa có giao dịch nào) —
// khớp với danh sách thực tế lấy từ getKnownPaymentMethods() để không bỏ sót phương thức
// mới (VD: Wallet, MoMo...) mà KiotViet cho phép merchant tự thêm.
const DEFAULT_METHODS = ['Cash', 'Transfer', 'Card'];

const Schema = Yup.object().shape({
  paymentMethod: Yup.string().required('Chọn phương thức'),
  bankAccountId: Yup.string().nullable().default(null),
  shareholderId: Yup.string().required('Chọn cổ đông nhận'),
  effectiveFrom: Yup.string().required('Chọn ngày hiệu lực'),
  isActive: Yup.boolean().default(true),
});

type FormValuesProps = Yup.InferType<typeof Schema>;

type Props = {
  shareholders: IShareholder[];
};

export default function RevenueChannelTab({ shareholders }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const dialog = useBoolean();
  const confirm = useBoolean();

  const [channels, setChannels] = useState<IRevenueChannel[]>([]);
  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [availableMethods, setAvailableMethods] = useState<string[]>(DEFAULT_METHODS);
  const [editing, setEditing] = useState<IRevenueChannel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [channelsResult, banksResult, knownMethods] = await Promise.all([
        getRevenueChannels(),
        getBankAccounts(),
        getKnownPaymentMethods(),
      ]);
      setChannels(channelsResult);
      setBankAccounts(banksResult);
      // Hợp nhất method thực tế đã dùng với danh sách mặc định — không trùng, giữ thứ tự ổn định
      setAvailableMethods(Array.from(new Set([...DEFAULT_METHODS, ...knownMethods])));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải kênh thu tiền', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const defaultValues = useMemo(
    () => ({
      paymentMethod: editing?.paymentMethod || 'Cash',
      bankAccountId: editing?.bankAccountId || null,
      shareholderId: editing?.shareholderId || '',
      effectiveFrom: editing?.effectiveFrom?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      isActive: editing?.isActive ?? true,
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

  const watchedMethod = watch('paymentMethod');

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleOpenCreate = () => {
    setEditing(null);
    dialog.onTrue();
  };

  const handleOpenEdit = (row: IRevenueChannel) => {
    setEditing(row);
    dialog.onTrue();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        paymentMethod: data.paymentMethod,
        bankAccountId: data.paymentMethod === 'Cash' ? null : data.bankAccountId || null,
        shareholderId: data.shareholderId,
        effectiveFrom: data.effectiveFrom,
      };
      if (editing) {
        await updateRevenueChannel(editing.id, { ...payload, isActive: data.isActive });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createRevenueChannel(payload);
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra — kênh có thể đã được gán', { variant: 'error' });
    }
  });

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteRevenueChannel(deleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    } finally {
      setDeleteId(null);
      confirm.onFalse();
    }
  }, [deleteId, enqueueSnackbar, fetchData, confirm]);

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Doanh thu về kênh nào được tính là &quot;đã về túi&quot; cổ đông được gán kênh đó. Ví dụ:
        Chuyển khoản + TK ACB → Chị Uyên; Tiền mặt → Mai. Kênh chưa gán sẽ chặn chốt sổ.
      </Alert>

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={handleOpenCreate}
        >
          Thêm kênh
        </Button>
      </Stack>

      <Card>
        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table sx={{ minWidth: 700 }}>
              <TableHeadCustom headLabel={TABLE_HEAD} rowCount={channels.length} />
              <TableBody>
                {channels.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{fPaymentMethod(row.paymentMethod)}</TableCell>
                    <TableCell>{row.bankAccountName || 'Tất cả'}</TableCell>
                    <TableCell>{row.shareholderName}</TableCell>
                    <TableCell>
                      <Label variant="soft" color={row.isActive ? 'success' : 'error'}>
                        {row.isActive ? 'Hoạt động' : 'Ngưng'}
                      </Label>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      <Tooltip title="Sửa">
                        <IconButton onClick={() => handleOpenEdit(row)}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa">
                        <IconButton
                          color="error"
                          onClick={() => {
                            setDeleteId(row.id);
                            confirm.onTrue();
                          }}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                <TableNoData notFound={!channels.length} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="xs" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Sửa kênh thu tiền' : 'Thêm kênh thu tiền'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFSelect
                name="paymentMethod"
                label="Phương thức thanh toán"
                helperText="Chỉ hiện các phương thức thực tế đã ghi nhận trong giao dịch (hoặc 3 phương thức phổ biến nếu chưa có dữ liệu)"
              >
                {availableMethods.map((m) => (
                  <MenuItem key={m} value={m}>
                    {fPaymentMethod(m)}
                  </MenuItem>
                ))}
              </RHFSelect>

              {watchedMethod !== 'Cash' && (
                <RHFSelect name="bankAccountId" label="Tài khoản ngân hàng (tùy chọn)">
                  <MenuItem value="">Tất cả tài khoản</MenuItem>
                  {bankAccounts.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {[b.bankName || b.shortName, b.accountNumber].filter(Boolean).join(' — ')}
                    </MenuItem>
                  ))}
                </RHFSelect>
              )}

              <RHFSelect name="shareholderId" label="Cổ đông nhận tiền">
                {shareholders
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
              </RHFSelect>

              <Controller
                name="effectiveFrom"
                control={control}
                render={({ field }) => (
                  <AppDatePicker label="Hiệu lực từ ngày" value={field.value} onChange={field.onChange} />
                )}
              />

              {editing && <RHFSwitch name="isActive" label="Đang hoạt động" />}
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
        title="Xóa kênh"
        content="Bạn có chắc muốn xóa kênh thu tiền này?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xóa
          </Button>
        }
      />
    </>
  );
}
