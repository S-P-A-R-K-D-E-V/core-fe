'use client';

import { useRef, useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';

import { uploadStoreLogo, type IStoreBranding, getStoreBranding, saveStoreBranding } from 'src/api/store-settings';

// ----------------------------------------------------------------------

const EMPTY: IStoreBranding = {
  storeName: null,
  logoUrl: null,
  primaryColor: null,
  shortDescription: null,
  address: null,
  messengerLink: null,
  zaloLink: null,
  contactInfoJson: null,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export default function StoreBrandingTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<IStoreBranding>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Logo lưu trong bucket của hệ thống (thư mục branding/ của cửa hàng) và dùng ngay.
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      enqueueSnackbar('Logo phải là ảnh PNG, JPEG hoặc WebP', { variant: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      enqueueSnackbar('Logo tối đa 2 MB', { variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const { logoUrl } = await uploadStoreLogo(file);
      setForm((f) => ({ ...f, logoUrl }));
      enqueueSnackbar('Đã tải logo lên');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tải logo thất bại'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    getStoreBranding()
      .then((data) => setForm({ ...EMPTY, ...data }))
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được thông tin cửa hàng'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [enqueueSnackbar]);

  const field = (key: keyof IStoreBranding) => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value || null })),
    disabled: loading,
    fullWidth: true,
  });

  const colorInvalid = !!form.primaryColor && !HEX_COLOR.test(form.primaryColor);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStoreBranding(form);
      enqueueSnackbar('Đã lưu thông tin cửa hàng');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={form.logoUrl ?? undefined}
            variant="rounded"
            sx={{ width: 64, height: 64, bgcolor: form.primaryColor && !colorInvalid ? form.primaryColor : 'grey.300' }}
          >
            {(form.storeName ?? '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <Stack>
            <Typography variant="h6">{form.storeName || 'Chưa đặt tên cửa hàng'}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Hiện trên trang chủ, trang đăng nhập và app.
            </Typography>
          </Stack>
        </Stack>

        <TextField label="Tên cửa hàng" inputProps={{ maxLength: 200 }} {...field('storeName')} />
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <TextField
            label="Link logo"
            helperText="Tải ảnh lên (PNG/JPEG/WebP, tối đa 2 MB) hoặc dán link ảnh có sẵn"
            inputProps={{ maxLength: 500 }}
            {...field('logoUrl')}
          />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogoFile} />
          <LoadingButton
            variant="outlined"
            loading={uploading}
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            sx={{ flexShrink: 0, height: 56 }}
          >
            Tải ảnh lên
          </LoadingButton>
          {!!form.logoUrl && (
            <Button color="inherit" sx={{ flexShrink: 0, height: 56 }} onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}>
              Bỏ logo
            </Button>
          )}
        </Stack>
        <TextField
          label="Màu chủ đạo (#RRGGBB)"
          placeholder="#D81B60"
          error={colorInvalid}
          helperText={colorInvalid ? 'Nhập mã màu dạng #RRGGBB' : ' '}
          {...field('primaryColor')}
        />
        <TextField label="Giới thiệu ngắn" multiline minRows={2} inputProps={{ maxLength: 500 }} {...field('shortDescription')} />
        <TextField label="Địa chỉ" inputProps={{ maxLength: 300 }} {...field('address')} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField label="Link Messenger" {...field('messengerLink')} />
          <TextField label="Link Zalo" {...field('zaloLink')} />
        </Stack>

        <Stack direction="row" justifyContent="flex-end">
          <LoadingButton variant="contained" loading={saving} disabled={loading || colorInvalid} onClick={handleSave}>
            Lưu thay đổi
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );
}
