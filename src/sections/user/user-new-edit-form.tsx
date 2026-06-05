import * as Yup from 'yup';
import { useMemo, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fData } from 'src/utils/format-number';
import { getStorageUrl } from 'src/utils/storage';

import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFSelect,
  RHFTextField,
  RHFUploadAvatar,
} from 'src/components/hook-form';

import { IUser, UserStatus } from 'src/types/corecms-api';
import { updateUser, changeUserStatus, uploadUserIdCard } from 'src/api/users';

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

  // CCCD state
  const [idCardFrontFile, setIdCardFrontFile] = useState<File | null>(null);
  const [idCardBackFile,  setIdCardBackFile]  = useState<File | null>(null);
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string | null>(null);
  const [idCardBackPreview,  setIdCardBackPreview]  = useState<string | null>(null);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef  = useRef<HTMLInputElement>(null);

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

  const handleIdCardFileChange = (side: 'front' | 'back') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === 'front') { setIdCardFrontFile(file); setIdCardFrontPreview(preview); }
    else                  { setIdCardBackFile(file);  setIdCardBackPreview(preview);  }
  };

  const handleIdCardUpload = async () => {
    if (!currentUser || (!idCardFrontFile && !idCardBackFile)) return;
    try {
      setUploadingIdCard(true);
      await uploadUserIdCard(
        currentUser.id,
        idCardFrontFile ?? undefined,
        idCardBackFile  ?? undefined
      );
      setIdCardFrontFile(null);
      setIdCardBackFile(null);
      enqueueSnackbar('Đã cập nhật CCCD và gửi thông báo Telegram!');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Tải lên CCCD thất bại!', { variant: 'error' });
    } finally {
      setUploadingIdCard(false);
    }
  };

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
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

        {/* CCCD Section */}
        {currentUser && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Căn cước công dân (CCCD)
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={3}>
                {/* Mặt trước */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Mặt trước
                  </Typography>
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      aspectRatio: '16/10',
                      bgcolor: 'background.neutral',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onClick={() => frontInputRef.current?.click()}
                  >
                    {(idCardFrontPreview || currentUser.idCardFrontUrl) ? (
                      <Box
                        component="img"
                        src={idCardFrontPreview ?? getStorageUrl(currentUser.idCardFrontUrl)}
                        alt="CCCD mặt trước"
                        sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Nhấn để chọn ảnh
                      </Typography>
                    )}
                  </Box>
                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleIdCardFileChange('front')}
                  />
                  {idCardFrontFile && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {idCardFrontFile.name}
                    </Typography>
                  )}
                </Box>

                {/* Mặt sau */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Mặt sau
                  </Typography>
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      aspectRatio: '16/10',
                      bgcolor: 'background.neutral',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => backInputRef.current?.click()}
                  >
                    {(idCardBackPreview || currentUser.idCardBackUrl) ? (
                      <Box
                        component="img"
                        src={idCardBackPreview ?? getStorageUrl(currentUser.idCardBackUrl)}
                        alt="CCCD mặt sau"
                        sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Nhấn để chọn ảnh
                      </Typography>
                    )}
                  </Box>
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleIdCardFileChange('back')}
                  />
                  {idCardBackFile && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {idCardBackFile.name}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Stack alignItems="flex-end" sx={{ mt: 3 }}>
                <LoadingButton
                  variant="contained"
                  loading={uploadingIdCard}
                  disabled={!idCardFrontFile && !idCardBackFile}
                  onClick={handleIdCardUpload}
                >
                  Tải lên CCCD
                </LoadingButton>
              </Stack>
            </Card>
          </Grid>
        )}
      </Grid>
    </FormProvider>
  );
}
