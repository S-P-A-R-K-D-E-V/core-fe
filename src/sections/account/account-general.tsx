'use client';

import * as Yup from 'yup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import Switch from '@mui/material/Switch';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fData } from 'src/utils/format-number';
import { getStorageUrl } from 'src/utils/storage';
import { getProfileCompletion } from 'src/utils/profile-completion';
import axiosInstance, { endpoints } from 'src/utils/axios';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, {
  RHFTextField,
  RHFUploadAvatar,
} from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

import { IUser } from 'src/types/corecms-api';
import { getCurrentUser, updateMyProfile, uploadMyAvatar, uploadMyIdCard } from 'src/api/users';

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
  const { updateUser } = useAuthContext();

  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [googleConnection, setGoogleConnection] = useState<OAuthConnection | null>(null);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>('upload');

  // CCCD state
  const [idCardFrontFile, setIdCardFrontFile] = useState<File | null>(null);
  const [idCardBackFile,  setIdCardBackFile]  = useState<File | null>(null);
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string | null>(null);
  const [idCardBackPreview,  setIdCardBackPreview]  = useState<string | null>(null);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef  = useRef<HTMLInputElement>(null);

  // Profile completion popup (show once per session when CCCD missing)
  const [cccdPopupOpen, setCccdPopupOpen] = useState(false);
  const cccdSectionRef = useRef<HTMLDivElement>(null);

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
          profileImageUrl: getStorageUrl(profile.profileImageUrl) || null,
        });

        const google = connections.find((c) => c.provider.toLowerCase() === 'google') ?? null;
        setGoogleConnection(google);

        // Show CCCD popup once per session for non-admin staff with missing CCCD
        const isAdmin = profile.roles?.some((r) => ['Admin', 'Manager'].includes(r));
        const { cccdMissing } = getProfileCompletion(profile);
        const popupShown = sessionStorage.getItem('cccd_popup_shown');
        if (!isAdmin && cccdMissing && !popupShown) {
          setCccdPopupOpen(true);
          sessionStorage.setItem('cccd_popup_shown', '1');
        }
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
        const { objectKey } = await uploadMyAvatar(data.profileImageUrl);
        finalImageUrl = objectKey; // raw objectKey → DB; getStorageUrl only at display time
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

      // Sync header/nav avatar immediately — convert objectKey/Google URL to display URL
      if (finalImageUrl) {
        updateUser({ photoURL: getStorageUrl(finalImageUrl) });
      }

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

  const handleIdCardFileChange = (side: 'front' | 'back') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === 'front') { setIdCardFrontFile(file); setIdCardFrontPreview(preview); }
    else                  { setIdCardBackFile(file);  setIdCardBackPreview(preview);  }
  };

  const handleIdCardUpload = async () => {
    if (!idCardFrontFile && !idCardBackFile) return;
    try {
      setUploadingIdCard(true);
      await uploadMyIdCard(idCardFrontFile ?? undefined, idCardBackFile ?? undefined);
      // Refresh user to get updated CCCD URLs
      const updated = await getCurrentUser();
      setUser(updated);
      setIdCardFrontFile(null);
      setIdCardBackFile(null);
      setIdCardFrontPreview(null);
      setIdCardBackPreview(null);
      enqueueSnackbar('Đã cập nhật CCCD!');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Tải lên CCCD thất bại!', { variant: 'error' });
    } finally {
      setUploadingIdCard(false);
    }
  };

  const handleScrollToCccd = () => {
    setCccdPopupOpen(false);
    setTimeout(() => cccdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
  const { percent: completionPercent, steps: completionSteps, cccdMissing } = getProfileCompletion(user);

  return (
    <>
      {/* CCCD popup — shown once per session for staff missing CCCD */}
      <Dialog open={cccdPopupOpen} onClose={() => setCccdPopupOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Bổ sung thông tin CCCD</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Hồ sơ của bạn chưa có ảnh căn cước công dân. Vui lòng tải lên ảnh CCCD 2 mặt để hoàn thiện
            hồ sơ nhân viên.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCccdPopupOpen(false)} color="inherit">
            Để sau
          </Button>
          <Button onClick={handleScrollToCccd} variant="contained">
            Bổ sung ngay
          </Button>
        </DialogActions>
      </Dialog>

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

        {/* Profile completion card */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1">Mức độ hoàn thiện hồ sơ</Typography>
              <Typography variant="subtitle1" color={completionPercent === 100 ? 'success.main' : 'warning.main'}>
                {completionPercent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={completionPercent}
              color={completionPercent === 100 ? 'success' : 'warning'}
              sx={{ height: 8, borderRadius: 4, mb: 2 }}
            />
            <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }} gap={1}>
              {completionSteps.map((step) => (
                <Stack key={step.key} direction="row" alignItems="center" spacing={0.5}>
                  <Box
                    sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: step.done ? 'success.main' : 'error.main',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" color={step.done ? 'text.secondary' : 'error'}>
                    {step.label}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Card>
        </Grid>

        {/* CCCD Section */}
        <Grid size={{ xs: 12 }}>
          <div ref={cccdSectionRef} />
          <Card sx={{ p: 3, border: cccdMissing ? '1px solid' : 'none', borderColor: 'warning.light' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Căn cước công dân (CCCD)
            </Typography>
            {cccdMissing && (
              <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                ⚠ Chưa có ảnh CCCD — vui lòng tải lên để hoàn thiện hồ sơ
              </Typography>
            )}
            <Divider sx={{ mb: 3 }} />

            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={3}>
              {/* Mặt trước */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Mặt trước</Typography>
                <Box
                  onClick={() => frontInputRef.current?.click()}
                  sx={{
                    border: '1px dashed', borderColor: 'divider', borderRadius: 1,
                    aspectRatio: '16/10', bgcolor: 'background.neutral',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden',
                  }}
                >
                  {(idCardFrontPreview || user?.idCardFrontUrl) ? (
                    <Box
                      component="img"
                      src={idCardFrontPreview ?? getStorageUrl(user?.idCardFrontUrl)}
                      alt="CCCD mặt trước"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.disabled">Nhấn để chọn ảnh</Typography>
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
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Mặt sau</Typography>
                <Box
                  onClick={() => backInputRef.current?.click()}
                  sx={{
                    border: '1px dashed', borderColor: 'divider', borderRadius: 1,
                    aspectRatio: '16/10', bgcolor: 'background.neutral',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden',
                  }}
                >
                  {(idCardBackPreview || user?.idCardBackUrl) ? (
                    <Box
                      component="img"
                      src={idCardBackPreview ?? getStorageUrl(user?.idCardBackUrl)}
                      alt="CCCD mặt sau"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.disabled">Nhấn để chọn ảnh</Typography>
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
      </Grid>
    </FormProvider>
    </>
  );
}
