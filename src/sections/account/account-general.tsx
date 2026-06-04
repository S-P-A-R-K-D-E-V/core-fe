'use client';

import * as Yup from 'yup';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import Switch from '@mui/material/Switch';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fData } from 'src/utils/format-number';
import axiosInstance, { endpoints } from 'src/utils/axios';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFTextField,
  RHFUploadAvatar,
} from 'src/components/hook-form';

import { IUser } from 'src/types/corecms-api';
import { getCurrentUser, updateMyProfile, uploadMyAvatar } from 'src/api/users';

// ----------------------------------------------------------------------

interface OAuthConnection {
  provider: string;
  connectedAt: string;
  pictureUrl?: string;
}

type AvatarSource = 'upload' | 'google';

// ----------------------------------------------------------------------

export default function AccountGeneral() {
  const { enqueueSnackbar } = useSnackbar();

  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [googleConnection, setGoogleConnection] = useState<OAuthConnection | null>(null);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>('upload');

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
    const fetchData = async () => {
      try {
        const [profile, connections] = await Promise.all([
          getCurrentUser(),
          axiosInstance
            .get<OAuthConnection[]>(endpoints.auth.oauthConnections)
            .then((r) => r.data)
            .catch(() => [] as OAuthConnection[]),
        ]);

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

        const google = connections.find((c) => c.provider.toLowerCase() === 'google') ?? null;
        setGoogleConnection(google);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      let finalImageUrl: string | undefined =
        typeof data.profileImageUrl === 'string' ? data.profileImageUrl : undefined;

      // If user selected Google photo, use it directly
      if (avatarSource === 'google' && googleConnection?.pictureUrl) {
        finalImageUrl = googleConnection.pictureUrl;
      }
      // If user dropped a new file, upload it to R2 first
      else if (avatarSource === 'upload' && data.profileImageUrl instanceof File) {
        const { avatarUrl } = await uploadMyAvatar(data.profileImageUrl);
        finalImageUrl = avatarUrl;
      }

      await updateMyProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || undefined,
        address: data.address || undefined,
        bankCode: data.bankCode || undefined,
        bankNo: data.bankNo || undefined,
        profileImageUrl: finalImageUrl,
      });

      enqueueSnackbar('Cập nhật thành công!');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Cập nhật thất bại!', { variant: 'error' });
    }
  });

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const newFile = Object.assign(file, {
        preview: URL.createObjectURL(file),
      });

      setValue('profileImageUrl', newFile, { shouldValidate: true });
      setAvatarSource('upload');
    },
    [setValue]
  );

  const handleAvatarSourceToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setAvatarSource(checked ? 'google' : 'upload');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isGoogleConnected = !!googleConnection;
  const googleHasPicture = !!googleConnection?.pictureUrl;

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3, textAlign: 'center' }}>
            {/* Avatar source toggle — only shown when Google is connected */}
            {isGoogleConnected && (
              <Box sx={{ mb: 2 }}>
                <Tooltip
                  title={
                    !googleHasPicture
                      ? 'Ngắt kết nối và kết nối lại Google để lấy ảnh'
                      : ''
                  }
                >
                  <span>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={avatarSource === 'google'}
                          onChange={handleAvatarSourceToggle}
                          disabled={!googleHasPicture}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="caption" color="text.secondary">
                          {avatarSource === 'google' ? 'Đang dùng ảnh Google' : 'Dùng ảnh Google'}
                        </Typography>
                      }
                      labelPlacement="end"
                    />
                  </span>
                </Tooltip>
              </Box>
            )}

            {/* Avatar preview */}
            {avatarSource === 'google' && googleConnection?.pictureUrl ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Avatar
                  src={googleConnection.pictureUrl}
                  alt="Google profile"
                  sx={{ width: 144, height: 144, mx: 'auto', border: '2px solid', borderColor: 'primary.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  Ảnh từ tài khoản Google
                </Typography>
              </Box>
            ) : (
              <RHFUploadAvatar
                name="profileImageUrl"
                maxSize={5242880}
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
                    Allowed *.jpeg, *.jpg, *.png, *.gif, *.webp
                    <br /> max size of {fData(5242880)}
                  </Typography>
                }
              />
            )}

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

        <Grid size={{ xs: 12, md: 8 }}>
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
                Lưu thay đổi
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
