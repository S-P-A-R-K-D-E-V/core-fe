'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';

import { type IStoreBranding, getStoreBranding, saveStoreBranding } from 'src/api/store-settings';

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
        <TextField label="Link logo (https://…)" inputProps={{ maxLength: 500 }} {...field('logoUrl')} />
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
