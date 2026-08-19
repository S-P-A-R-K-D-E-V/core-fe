'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { useSnackbar } from 'src/components/snackbar';
import { getBranchLocations } from 'src/api/attendance';
import { getKioskDevices, claimKioskPairing, revokeKioskDevice } from 'src/api/kiosk';

import type { IBranchLocation } from 'src/types/corecms-api';
import type { IKioskDeviceItem } from 'src/types/kiosk';

// ----------------------------------------------------------------------
// Quản trị thiết bị Kiosk — ghép nối thiết bị mới đi qua mã 6 số do màn kiosk (/kiosk-checkin)
// hiển thị (KioskPairingController), KHÔNG còn seed tay KioskDevice qua DB.

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

export function KioskDevicesView() {
  const { enqueueSnackbar } = useSnackbar();

  const [devices, setDevices] = useState<IKioskDeviceItem[]>([]);
  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [claiming, setClaiming] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deviceList, branchList] = await Promise.all([getKioskDevices(), getBranchLocations()]);
      setDevices(deviceList);
      setBranches(branchList);
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Không tải được danh sách thiết bị', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleClaim() {
    if (!code.trim() || !name.trim() || !branchId) return;
    setClaiming(true);
    try {
      await claimKioskPairing(code.trim(), name.trim(), branchId);
      enqueueSnackbar('Ghép nối thiết bị thành công!', { variant: 'success' });
      setCode('');
      setName('');
      setBranchId('');
      fetchData();
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Ghép nối thất bại — kiểm tra lại mã.', { variant: 'error' });
    } finally {
      setClaiming(false);
    }
  }

  async function handleRevoke(deviceId: string) {
    setRevokingId(deviceId);
    try {
      await revokeKioskDevice(deviceId);
      enqueueSnackbar('Đã thu hồi thiết bị.', { variant: 'success' });
      fetchData();
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Thu hồi thất bại', { variant: 'error' });
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Container maxWidth="md">
      <Typography variant="h4" sx={{ mb: 3 }}>
        Thiết bị Kiosk
      </Typography>

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Ghép nối thiết bị mới
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mở trang <strong>/kiosk-checkin</strong> trên thiết bị kiosk — màn hình sẽ hiện mã 6 số.
          Nhập mã đó cùng tên và chi nhánh bên dưới để hoàn tất ghép nối.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Mã ghép nối"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 6 }}
            sx={{ width: { sm: 160 } }}
          />
          <TextField
            label="Tên thiết bị"
            placeholder="VD: Quầy lễ tân"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Chi nhánh"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            sx={{ width: { sm: 220 } }}
          >
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.branchName}
              </MenuItem>
            ))}
          </TextField>
          <LoadingButton
            variant="contained"
            loading={claiming}
            disabled={!code.trim() || !name.trim() || !branchId}
            onClick={handleClaim}
            sx={{ minWidth: 120 }}
          >
            Ghép nối
          </LoadingButton>
        </Stack>
      </Card>

      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Danh sách thiết bị</Typography>
        </Stack>
        <Divider />
        {loading ? (
          <Stack alignItems="center" sx={{ p: 4 }}>
            <CircularProgress />
          </Stack>
        ) : devices.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
            Chưa có thiết bị kiosk nào.
          </Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tên thiết bị</TableCell>
                <TableCell>Chi nhánh</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Hoạt động gần nhất</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.branchName}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={d.isActive ? 'Đang hoạt động' : 'Đã thu hồi'}
                      color={d.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(d.lastSeenAt)}</TableCell>
                  <TableCell align="right">
                    {d.isActive && (
                      <Button
                        size="small"
                        color="error"
                        disabled={revokingId === d.id}
                        onClick={() => handleRevoke(d.id)}
                      >
                        Thu hồi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Container>
  );
}
