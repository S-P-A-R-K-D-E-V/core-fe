import * as Yup from 'yup';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFSelect, RHFTextField } from 'src/components/hook-form';

import { IUser, UserStatus } from 'src/types/corecms-api';
import { updateUser, changeUserStatus } from 'src/api/users';

// ----------------------------------------------------------------------

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Banned', label: 'Banned' },
  { value: 'Rejected', label: 'Rejected' },
];

type Props = {
  open: boolean;
  onClose: VoidFunction;
  currentUser?: IUser;
  onRefresh?: VoidFunction;
};

export default function UserQuickEditForm({ currentUser, open, onClose, onRefresh }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const QuickEditSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    phoneNumber: Yup.string(),
    address: Yup.string(),
    bankCode: Yup.string(),
    bankNo: Yup.string(),
    status: Yup.string<UserStatus>().required('Status is required'),
  });

  const defaultValues = useMemo(
    () => ({
      firstName: currentUser?.firstName || '',
      lastName: currentUser?.lastName || '',
      email: currentUser?.email || '',
      phoneNumber: currentUser?.phoneNumber || '',
      address: currentUser?.address || '',
      bankCode: currentUser?.bankCode || '',
      bankNo: currentUser?.bankNo || '',
      status: currentUser?.status || ('Active' as UserStatus),
    }),
    [currentUser]
  );

  const methods = useForm({
    resolver: yupResolver(QuickEditSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    if (!currentUser) return;
    try {
      // Update user info
      await updateUser(currentUser.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || undefined,
        address: data.address || undefined,
        bankCode: data.bankCode || undefined,
        bankNo: data.bankNo || undefined,
      });

      // Update status if changed
      if (data.status && data.status !== currentUser.status) {
        await changeUserStatus(currentUser.id, { status: data.status as UserStatus });
      }

      reset();
      onClose();
      onRefresh?.();
      enqueueSnackbar('Update success!');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Update failed!', { variant: 'error' });
    }
  });

  return (
    <Dialog
      fullWidth
      maxWidth={false}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { maxWidth: 720 },
      }}
    >
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>Quick Update</DialogTitle>

        <DialogContent>
          {currentUser?.status === 'Pending' && (
            <Alert variant="outlined" severity="info" sx={{ mb: 3 }}>
              Account is waiting for confirmation
            </Alert>
          )}

          <Box
            rowGap={3}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
            }}
          >
            <RHFSelect name="status" label="Status">
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </RHFSelect>

            <Box sx={{ display: { xs: 'none', sm: 'block' } }} />

            <RHFTextField name="firstName" label="First Name" />
            <RHFTextField name="lastName" label="Last Name" />
            <RHFTextField name="email" label="Email Address" disabled />
            <RHFTextField name="phoneNumber" label="Phone Number" />
            <RHFTextField name="address" label="Address" />
            <RHFTextField name="bankCode" label="Bank Code" />
            <RHFTextField name="bankNo" label="Bank Account No" />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>

          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            Update
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
