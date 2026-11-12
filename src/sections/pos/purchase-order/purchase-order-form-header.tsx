'use client';

import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Tiêu đề gọn của màn tạo / sửa phiếu nhập ("← Nhập hàng" như KiotViet) — nhường chỗ cho bảng hàng.
// ----------------------------------------------------------------------

type Props = {
  title: string;
  subtitle?: string;
  backHref: string;
};

export default function PurchaseOrderFormHeader({ title, subtitle, backHref }: Props) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Tooltip title="Về danh sách phiếu nhập">
        <IconButton component={RouterLink} href={backHref} size="small">
          <Iconify icon="eva:arrow-ios-back-fill" />
        </IconButton>
      </Tooltip>
      <Typography variant="h5">{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ ml: 'auto !important', color: 'text.disabled', typography: 'caption', display: { xs: 'none', md: 'flex' } }}
      >
        <span>F3: tìm hàng</span>
        <span>F8: tiền trả NCC</span>
      </Stack>
    </Stack>
  );
}
