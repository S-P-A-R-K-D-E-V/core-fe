'use client';

import * as Yup from 'yup';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LoadingButton from '@mui/lab/LoadingButton';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

import { ISupplier } from 'src/types/corecms-api';
import { createSupplier } from 'src/api/suppliers';

// ----------------------------------------------------------------------

const Schema = Yup.object().shape({
  name: Yup.string().required('Tên nhà cung cấp là bắt buộc'),
  code: Yup.string().default(''),
  contactPerson: Yup.string().default(''),
  phone: Yup.string().default(''),
  email: Yup.string().email('Email không hợp lệ').default(''),
  address: Yup.string().default(''),
  taxCode: Yup.string().default(''),
  note: Yup.string().default(''),
});

type Props = {
  open: boolean;
  onClose: VoidFunction;
  onCreated: (supplier: ISupplier) => void;
};

export default function PurchaseOrderQuickCreateSupplier({ open, onClose, onCreated }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const defaultValues = {
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    note: '',
  };

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const result = await createSupplier({
        name: data.name,
        code: data.code || undefined,
        contactPerson: data.contactPerson || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        taxCode: data.taxCode || undefined,
        note: data.note || undefined,
      });
      const newSupplier: ISupplier = {
        id: result.id,
        name: data.name,
        code: data.code || '',
        contactPerson: data.contactPerson || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        taxCode: data.taxCode || '',
        bankAccount: '',
        bankName: '',
        note: data.note || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        totalOrders: 0,
      };
      enqueueSnackbar('Tạo nhà cung cấp thành công!');
      onCreated(newSupplier);
      reset(defaultValues);
      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleClose = () => {
    reset(defaultValues);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>Tạo nhanh nhà cung cấp</DialogTitle>

        <DialogContent dividers>
          <Box
            rowGap={2.5}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            sx={{ pt: 1 }}
          >
            <RHFTextField name="name" label="Tên nhà cung cấp" />
            <RHFTextField name="code" label="Mã NCC" />
            <RHFTextField name="contactPerson" label="Người liên hệ" />
            <RHFTextField name="phone" label="Số điện thoại" />
            <RHFTextField name="email" label="Email" />
            <RHFTextField name="taxCode" label="Mã số thuế" />
          </Box>
          <RHFTextField name="address" label="Địa chỉ" sx={{ mt: 2.5 }} />
          <RHFTextField name="note" label="Ghi chú" multiline rows={2} sx={{ mt: 2.5 }} />
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={handleClose}>
            Hủy
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            Tạo NCC
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
