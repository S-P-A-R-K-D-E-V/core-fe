'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';

import { TITLE_MAX, DESCRIPTION_MAX, storeHomeTitle, storeHomeDescription } from 'src/lib/store-seo';
import { uploadStoreLogo, type IStoreBranding, getStoreBranding, saveStoreBranding } from 'src/api/store-settings';

// Độ dài cột của core-be (TenantBranding.SeoTitleMaxLength / SeoDescriptionMaxLength).
const SEO_TITLE_LIMIT = 70;
const SEO_DESCRIPTION_LIMIT = 300;

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
  phone: null,
  taxCode: null,
  receiptFooter: null,
  seoTitle: null,
  seoDescription: null,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export default function StoreBrandingTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<IStoreBranding>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
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
      .then((data) => {
        setForm({ ...EMPTY, ...data });
        setLoaded(true);
      })
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
      // Ba field của phiếu thanh toán và hai field SEO: không gửi key = core-be giữ nguyên giá trị đang lưu. Chưa
      // tải được dữ liệu thì không biết đang lưu gì → chỉ gửi khi người dùng đã nhập, để không xoá nhầm.
      const { phone, taxCode, receiptFooter, seoTitle, seoDescription, ...olderFields } = form;
      const sendReceiptFields = loaded || !!phone || !!taxCode || !!receiptFooter;
      const sendSeoFields = loaded || !!seoTitle || !!seoDescription;
      await saveStoreBranding({
        ...olderFields,
        ...(sendReceiptFields && { phone, taxCode, receiptFooter }),
        ...(sendSeoFields && { seoTitle, seoDescription }),
      });
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

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Phiếu thanh toán (in hoá đơn)</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            In ở đầu phiếu cùng với tên cửa hàng và địa chỉ ở trên; lời chào in ở cuối phiếu. Số điện thoại cũng hiện
            trên trang chủ.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField label="Số điện thoại" inputProps={{ maxLength: 50 }} {...field('phone')} />
          <TextField label="Mã số thuế" inputProps={{ maxLength: 20 }} {...field('taxCode')} />
        </Stack>
        <TextField
          label="Lời chào cuối hoá đơn"
          placeholder="Cảm ơn quý khách, hẹn gặp lại!"
          multiline
          minRows={2}
          inputProps={{ maxLength: 200 }}
          helperText={`${(form.receiptFooter ?? '').length}/200 ký tự`}
          {...field('receiptFooter')}
        />

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Trang chủ trên Google</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tiêu đề và mô tả hiện trong kết quả tìm kiếm và khi chia sẻ link trang chủ. Để trống thì hệ thống tự viết từ
            tên, giới thiệu, địa chỉ và nhóm hàng đang bán của cửa hàng.
          </Typography>
        </Stack>
        <TextField
          label="Tiêu đề trang chủ"
          placeholder={storeHomeTitle({ ...form, tenantCode: '', seoTitle: null })}
          inputProps={{ maxLength: SEO_TITLE_LIMIT }}
          helperText={`${(form.seoTitle ?? '').length}/${SEO_TITLE_LIMIT} ký tự — nên dưới ${TITLE_MAX}, có tên cửa hàng và điều khách hay tìm (món / mặt hàng, khu vực)`}
          {...field('seoTitle')}
        />
        <TextField
          label="Mô tả trang chủ"
          placeholder={storeHomeDescription({ ...form, tenantCode: '', seoDescription: null })}
          multiline
          minRows={2}
          inputProps={{ maxLength: SEO_DESCRIPTION_LIMIT }}
          helperText={`${(form.seoDescription ?? '').length}/${SEO_DESCRIPTION_LIMIT} ký tự — Google thường hiện khoảng ${DESCRIPTION_MAX} ký tự đầu`}
          {...field('seoDescription')}
        />
        <SearchPreview
          title={storeHomeTitle({ ...form, tenantCode: '' })}
          description={storeHomeDescription({ ...form, tenantCode: '' })}
        />

        <Stack direction="row" justifyContent="flex-end">
          <LoadingButton variant="contained" loading={saving} disabled={loading || colorInvalid} onClick={handleSave}>
            Lưu thay đổi
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

/** Xem trước kết quả tìm kiếm (gần đúng — Google có thể tự viết lại). Chưa tính nhóm hàng: trang thật có thêm. */
function SearchPreview({ title, description }: { title: string; description: string }) {
  const host = typeof window === 'undefined' ? '' : window.location.host;

  return (
    <Box
      aria-label="Xem trước trên Google"
      sx={{ p: 2, borderRadius: 1.5, border: (theme) => `1px dashed ${theme.palette.divider}` }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Xem trước trên Google · {host}
      </Typography>
      <Typography sx={{ color: '#1a0dab', fontSize: 18, lineHeight: 1.3, mt: 0.5 }}>
        {title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {description.length > DESCRIPTION_MAX ? `${description.slice(0, DESCRIPTION_MAX - 1)}…` : description}
      </Typography>
    </Box>
  );
}
