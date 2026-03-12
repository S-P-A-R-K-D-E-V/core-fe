import * as Yup from 'yup';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { fData } from 'src/utils/format-number';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFTextField,
  RHFUploadAvatar,
} from 'src/components/hook-form';

import { IUser } from 'src/types/corecms-api';
import { getCurrentUser, updateMyProfile } from 'src/api/users';

// ----------------------------------------------------------------------

export default function AccountGeneral() {
  const { enqueueSnackbar } = useSnackbar();

  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const UpdateUserSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    phoneNumber: Yup.string(),
    address: Yup.string(),
    bankCode: Yup.string(),
    bankNo: Yup.string(),
    profileImageUrl: Yup.mixed<any>().nullable(),
  });

  const defaultValues = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    bankCode: '',
    bankNo: '',
    profileImageUrl: null as any,
  };

  const methods = useForm({
    resolver: yupResolver(UpdateUserSchema),
    defaultValues,
  });

  const {
    setValue,
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getCurrentUser();
        setUser(profile);
        reset({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          phoneNumber: profile.phoneNumber || '',
          address: profile.address || '',
          bankCode: profile.bankCode || '',
          bankNo: profile.bankNo || '',
          profileImageUrl: profile.profileImageUrl || null,
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateMyProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || undefined,
        address: data.address || undefined,
        bankCode: data.bankCode || undefined,
        bankNo: data.bankNo || undefined,
        profileImageUrl: typeof data.profileImageUrl === 'string' ? data.profileImageUrl : undefined,
      });
      enqueueSnackbar('Update success!');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12} md={4}>
          <Card sx={{ pt: 10, pb: 5, px: 3, textAlign: 'center' }}>
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

            {user && (
              <Stack spacing={1} sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Status: {user.status}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Roles: {user.roles?.join(', ') || 'None'}
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
