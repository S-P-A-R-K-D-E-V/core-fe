import * as Yup from 'yup';
import { useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fData } from 'src/utils/format-number';

import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFSelect,
  RHFTextField,
  RHFUploadAvatar,
} from 'src/components/hook-form';

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
  currentUser?: IUser;
};

export default function UserNewEditForm({ currentUser }: Props) {
  const router = useRouter();

  const { enqueueSnackbar } = useSnackbar();

  const EditUserSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    phoneNumber: Yup.string(),
    address: Yup.string(),
    bankCode: Yup.string(),
    bankNo: Yup.string(),
    status: Yup.string<UserStatus>().required('Status is required'),
    profileImageUrl: Yup.mixed<any>().nullable(),
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
      profileImageUrl: currentUser?.profileImageUrl || null,
    }),
    [currentUser]
  );

  const methods = useForm({
    resolver: yupResolver(EditUserSchema),
    defaultValues,
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

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
        profileImageUrl: typeof data.profileImageUrl === 'string' ? data.profileImageUrl : undefined,
      });

      // Update status if changed
      if (data.status && data.status !== currentUser.status) {
        await changeUserStatus(currentUser.id, { status: data.status as UserStatus });
      }

      reset();
      enqueueSnackbar('Update success!');
      router.push(paths.dashboard.user.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Update failed!', { variant: 'error' });
    }
  });

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      const newFile = Object.assign(file, {
        preview: URL.createObjectURL(file),
      });

      if (file) {
        setValue('profileImageUrl', newFile, { shouldValidate: true });
      }
    },
    [setValue]
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12} md={4}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {currentUser && (
              <Label
                color={
                  (values.status === 'Active' && 'success') ||
                  (values.status === 'Banned' && 'error') ||
                  (values.status === 'Rejected' && 'error') ||
                  'warning'
                }
                sx={{ position: 'absolute', top: 24, right: 24 }}
              >
                {values.status}
              </Label>
            )}

            <Box sx={{ mb: 5 }}>
              <RHFUploadAvatar
                name="profileImageUrl"
                maxSize={3145728}
                onDrop={handleDrop}
                helperText={
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 3,
                      mx: 'auto',
                      display: 'block',
                      textAlign: 'center',
                      color: 'text.disabled',
                    }}
                  >
                    Allowed *.jpeg, *.jpg, *.png, *.gif
                    <br /> max size of {fData(3145728)}
                  </Typography>
                }
              />
            </Box>

            {currentUser && (
              <Stack spacing={2}>
                <Typography variant="subtitle2">
                  Email: {currentUser.email}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Roles: {currentUser.roles?.join(', ') || 'None'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Email Confirmed: {currentUser.emailConfirmed ? 'Yes' : 'No'}
                </Typography>
              </Stack>
            )}
          </Card>
        </Grid>

        <Grid xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{
                xs: 'repeat(1, 1fr)',
                sm: 'repeat(2, 1fr)',
              }}
            >
              <RHFTextField name="firstName" label="First Name" />
              <RHFTextField name="lastName" label="Last Name" />
              <RHFTextField name="email" label="Email Address" disabled />
              <RHFTextField name="phoneNumber" label="Phone Number" />
              <RHFTextField name="address" label="Address" />
              <RHFTextField name="bankCode" label="Bank Code" />
              <RHFTextField name="bankNo" label="Bank Account No" />

              <RHFSelect name="status" label="Status">
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </RHFSelect>
            </Box>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                Save Changes
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
