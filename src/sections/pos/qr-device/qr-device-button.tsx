import { useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';

import { useQrDevice } from './use-qr-device';
import { qrDevice } from './qr-device-manager';
import { sampleQrInfo } from './qr-device-sample';
import { usbIdLabel, usbVendorName } from './qr-device-template';

import type { QrDeviceStatus } from './qr-device-manager';

// ----------------------------------------------------------------------
// Nút "Máy QR" trên thanh màn bán hàng: kết nối máy hiện QR cắm USB, gửi thử, vào trang cài đặt.
// ----------------------------------------------------------------------

export const QR_STATUS_LABEL: Record<QrDeviceStatus, string> = {
  unsupported: 'Trình duyệt không hỗ trợ',
  disconnected: 'Chưa kết nối',
  connecting: 'Đang kết nối…',
  connected: 'Đã kết nối',
  error: 'Lỗi kết nối',
};

const DOT_COLOR: Record<QrDeviceStatus, 'success' | 'warning' | 'error' | 'default'> = {
  unsupported: 'default',
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  error: 'error',
};

const item = (icon: string, label: string) => (
  <>
    <ListItemIcon>
      <Iconify icon={icon} width={18} />
    </ListItemIcon>
    <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2' }} />
  </>
);

export function QrDeviceButton({ fg }: { fg: string }) {
  const device = useQrDevice();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const close = () => setAnchorEl(null);

  // Máy tính bảng / điện thoại không có Web Serial: ẩn nút cho gọn (đã nối thì chắc chắn hỗ trợ).
  if (device.status === 'unsupported') return null;

  const { status, settings, port } = device;
  const connected = status === 'connected';
  const usbId = usbIdLabel(port?.usbVendorId, port?.usbProductId);
  const vendor = usbVendorName(port?.usbVendorId);

  return (
    <>
      <Tooltip title={`Máy hiện QR (USB): ${QR_STATUS_LABEL[status]}`}>
        <IconButton
          aria-label="Máy hiện QR"
          sx={{ color: fg, display: { xs: 'none', md: 'inline-flex' } }}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <Badge
            variant="dot"
            color={DOT_COLOR[status]}
            invisible={status === 'disconnected' && !settings.enabled}
            overlap="circular"
            sx={{ '& .MuiBadge-dot': { border: `1.5px solid ${fg}`, minWidth: 10, height: 10, borderRadius: 5 } }}
          >
            <Iconify icon="solar:qr-code-bold" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 300, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
          <Typography variant="subtitle2">Máy hiện QR (USB)</Typography>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: connected ? 'success.main' : status === 'error' ? 'error.main' : 'text.disabled',
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {QR_STATUS_LABEL[status]}
              {connected && usbId ? ` · ${vendor ?? 'USB'} ${usbId}` : ''}
              {connected ? ` · ${settings.baudRate} baud` : ''}
            </Typography>
          </Stack>
          {device.error && (
            <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
              {device.error}
            </Typography>
          )}
        </Box>
        {connected && !settings.verified && (
          <Alert severity="warning" sx={{ mx: 1.5, mb: 1, py: 0, typography: 'caption' }}>
            Chưa thử kiểu lệnh cho máy này — vào &quot;Cài đặt &amp; thử máy QR&quot;.
          </Alert>
        )}
        <Divider />

        {!connected && (
          <MenuItem
            onClick={() => {
              close();
              qrDevice.choosePort().catch(console.error);
            }}
          >
            {item('solar:plug-circle-bold', 'Kết nối máy QR…')}
          </MenuItem>
        )}
        {!connected && settings.enabled && (
          <MenuItem
            onClick={() => {
              close();
              qrDevice.reconnect().catch(console.error);
            }}
          >
            {item('solar:refresh-bold', 'Kết nối lại máy đã chọn')}
          </MenuItem>
        )}
        {connected && (
          <MenuItem
            onClick={async () => {
              close();
              const info = await sampleQrInfo();
              await qrDevice.sendTemplate(settings.templates.show, info, 'Hiện QR thử');
            }}
          >
            {item('solar:qr-code-bold', 'Hiện QR thử (10.000đ)')}
          </MenuItem>
        )}
        {connected && (
          <MenuItem
            disabled={!settings.templates.clear}
            onClick={() => {
              close();
              qrDevice.sendTemplate(settings.templates.clear, null, 'Xoá').catch(console.error);
            }}
          >
            {item('solar:eraser-bold', 'Xoá màn QR')}
          </MenuItem>
        )}
        {connected && (
          <MenuItem
            onClick={() => {
              close();
              qrDevice.disconnect().catch(console.error);
            }}
          >
            {item('solar:link-broken-bold', 'Ngắt kết nối')}
          </MenuItem>
        )}
        <Divider />
        <MenuItem component={RouterLink} href={paths.dashboard.pos.qrDevice} onClick={close}>
          {item('solar:settings-bold', 'Cài đặt & thử máy QR')}
        </MenuItem>
      </Menu>
    </>
  );
}
