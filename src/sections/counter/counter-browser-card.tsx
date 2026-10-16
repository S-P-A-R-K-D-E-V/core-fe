'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { getBranchLocations } from 'src/api/attendance';
import { unpairCounter, provisionCounterDevice } from 'src/api/counter';

import { useSnackbar } from 'src/components/snackbar';

import { saveCounterDevice, useCounterDevice, clearCounterDevice } from 'src/sections/counter/counter-device';

// ----------------------------------------------------------------------
// Thiết bị cửa hàng → "Đặt trình duyệt này làm máy quầy" (lối nhanh — người đang đăng nhập là chủ cửa hàng / quản lý): đặt CHÍNH trình duyệt này (PC ở quầy, có thể kèm màn hình khách) làm máy quầy của một
// chi nhánh. Sau đó mở trang là màn chọn nhân viên có ca; ai đăng nhập ở đây cũng chỉ có bán hàng, hoá đơn, hàng hoá,
// khách hàng, kiểm tiền ca. Người đang đăng nhập được đăng xuất (máy quầy dùng chung).
// ----------------------------------------------------------------------

type Branch = { id: string; branchName: string };

export default function CounterBrowserCard({ onProvisioned }: { onProvisioned?: () => void }) {
  const router = useRouter();
  const { logout } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const device = useCounterDevice();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('Quầy 1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBranchLocations()
      .then((list: Branch[]) => {
        setBranches(list);
        if (list.length === 1) setBranchId(list[0].id);
      })
      .catch(() => setBranches([]));
  }, []);

  async function provision() {
    if (!branchId || !name.trim()) return;
    const branchName = branches.find((b) => b.id === branchId)?.branchName ?? '';
    if (
      !window.confirm(
        `Đặt trình duyệt này làm máy quầy của ${branchName}? Bạn sẽ được đăng xuất; nhân viên có ca chọn tên và nhập mã gửi về app điện thoại (hoặc mật khẩu) để đăng nhập.`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await provisionCounterDevice(branchId, name.trim(), 'web');
      saveCounterDevice({
        deviceId: res.deviceId,
        deviceName: res.deviceName,
        branchId: res.branchId,
        branchName: res.branchName,
        deviceKey: res.deviceKey,
      });
      await logout?.();
      router.replace('/counter');
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Không đặt được máy quầy', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    if (!window.confirm('Thoát chế độ máy quầy trên trình duyệt này?')) return;
    try {
      await unpairCounter();
    } catch {
      // Đã bị gỡ ở nơi khác / mất mạng: vẫn thoát ở trình duyệt này.
    }
    clearCounterDevice();
    enqueueSnackbar('Trình duyệt này không còn là máy quầy', { variant: 'success' });
    onProvisioned?.();
  }

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle1">Đặt trình duyệt này làm máy quầy</Typography>
          <Typography variant="body2" color="text.secondary">
            Dùng cho máy tính đặt cố định ở quầy. Mở trang là danh sách nhân viên có ca hôm nay; bấm tên → mã 6 số gửi về
            app điện thoại (người chưa có app dùng mật khẩu, hoặc quét QR). Ai đăng nhập ở máy quầy — kể cả chủ cửa hàng —
            cũng chỉ có bán hàng, hoá đơn / trả hàng, hàng hoá, khách hàng và kiểm tiền ca; tự đăng xuất khi hết ca (thêm
            30 phút). Máy chưa có ai đăng nhập: mở trang /counter trên máy đó, nhập mã hiện ra vào ô Ghép nối ở trên.
          </Typography>
        </Box>

        {device ? (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={leave}>
                Thoát chế độ máy quầy
              </Button>
            }
          >
            Trình duyệt này đang là máy quầy “{device.deviceName}” · {device.branchName}.
          </Alert>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              size="small"
              label="Chi nhánh"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              sx={{ minWidth: 240 }}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branchName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Tên máy quầy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 100 }}
            />
            <LoadingButton variant="contained" loading={saving} disabled={!branchId || !name.trim()} onClick={provision}>
              Đặt trình duyệt này làm máy quầy
            </LoadingButton>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
