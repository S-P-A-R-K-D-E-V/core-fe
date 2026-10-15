'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { getBranchLocations } from 'src/api/attendance';
import { FEATURE, useFeatureEnabled } from 'src/hooks/use-feature-enabled';
import { getKioskDevices, claimKioskPairing, revokeKioskDevice, renameKioskDevice } from 'src/api/kiosk';

import type { IBranchLocation } from 'src/types/corecms-api';
import type { IKioskDeviceItem, IKioskAgentCamera } from 'src/types/kiosk';

// ----------------------------------------------------------------------
// Thiết bị cửa hàng — mọi thiết bị đăng nhập bằng key thiết bị (không có tài khoản người dùng):
//  - Kiosk chấm công: trang /kiosk-checkin trên tablet/laptop có webcam.
//  - Camera đếm khách: Spark Camera Agent chạy trên máy tính ở quầy, đọc camera Wi-Fi trong mạng nội bộ.
// Cả hai ghép nối bằng cùng một luồng mã 6 số (KioskPairingController); không seed tay qua DB.

const REFRESH_MS = 30_000;

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

type StatusChip = { label: string; color: 'success' | 'error' | 'default' | 'info' };

function statusOf(d: IKioskDeviceItem): StatusChip {
  if (!d.isActive) return { label: 'Đã thu hồi', color: 'default' };
  if (d.kind === 'camera-agent') return d.online ? { label: 'Đang chạy', color: 'success' } : { label: 'Mất kết nối', color: 'error' };
  return { label: 'Đã ghép nối', color: 'info' };
}

/**
 * Loại agent theo vai trò camera nó báo: quầy chấm công (counter_face), cửa đếm khách (customer_door) hoặc cả hai.
 * Agent cũ chưa báo vai trò → "Camera".
 */
export function agentCaption(d: Pick<IKioskDeviceItem, 'agentVersion' | 'cameras'>): string {
  const roles = new Set(d.cameras.map((c) => c.role).filter(Boolean));
  let label = 'Camera';
  if (roles.has('counter_face') && roles.has('customer_door')) label = 'Camera chấm công + đếm khách';
  else if (roles.has('counter_face')) label = 'Camera chấm công';
  else if (roles.has('customer_door')) label = 'Camera đếm khách';
  return d.agentVersion ? `${label} · agent ${d.agentVersion}` : label;
}

function cameraChipLabel(c: IKioskAgentCamera): string {
  const name = c.name || c.key;
  if (c.role === 'counter_face') return `${name} · chấm công`;
  return `${name}${c.inToday !== null && c.inToday !== undefined ? ` · ${c.inToday} vào` : ''}`;
}

// ----------------------------------------------------------------------

function PairingGuide({ kind }: { kind: 'kiosk' | 'camera' }) {
  if (kind === 'kiosk') {
    return (
      <Box component="ol" sx={{ pl: 2.5, m: 0, typography: 'body2', color: 'text.secondary', '& li': { mb: 0.5 } }}>
        <li>
          Trên tablet hoặc laptop có camera trước, mở trang <strong>/kiosk-checkin</strong> của cửa hàng.
        </li>
        <li>Màn hình hiện mã 6 số (hoặc quét mã QR bằng app cửa hàng).</li>
        <li>Nhập mã, đặt tên và chọn chi nhánh bên dưới.</li>
      </Box>
    );
  }
  return (
    <Box component="ol" sx={{ pl: 2.5, m: 0, typography: 'body2', color: 'text.secondary', '& li': { mb: 0.5 } }}>
      <li>
        Bật luồng RTSP trên camera: Tapo — <em>Cài đặt nâng cao → Tài khoản camera</em>; EZVIZ —{' '}
        <em>LAN Live View → bật RTSP</em> (mật khẩu là mã xác minh trên tem); Imou — bật RTSP/ONVIF trong app.
      </li>
      <li>
        Cài <strong>Spark Camera Agent</strong> trên máy tính ở quầy, cùng mạng Wi-Fi với camera, khai báo camera trong{' '}
        <code>cameras.json</code>.
      </li>
      <li>
        Chạy <code>python -m agent pair</code>: agent hiện mã 6 số. Nhập mã, đặt tên (vd &quot;Camera cửa chính&quot;) và
        chọn chi nhánh bên dưới.
      </li>
      <li>
        Chạy <code>python -m agent setline door1</code> để vẽ vạch đếm ngang cửa, rồi <code>python -m agent run</code>.
        Thiết bị chuyển sang &quot;Đang chạy&quot; sau khoảng 1 phút.
      </li>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function KioskDevicesView() {
  const { enqueueSnackbar } = useSnackbar();
  const cameraOn = useFeatureEnabled(FEATURE.storeCamera);

  const [devices, setDevices] = useState<IKioskDeviceItem[]>([]);
  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [guide, setGuide] = useState<'kiosk' | 'camera'>(cameraOn ? 'camera' : 'kiosk');
  const pairingGuide = cameraOn ? guide : 'kiosk';
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [claiming, setClaiming] = useState(false);

  const [renaming, setRenaming] = useState<IKioskDeviceItem | null>(null);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [revoking, setRevoking] = useState<IKioskDeviceItem | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [deviceList, branchList] = await Promise.all([getKioskDevices(), getBranchLocations()]);
        setDevices(deviceList);
        setBranches(branchList);
      } catch (err: any) {
        if (!silent) enqueueSnackbar(err?.title || err?.message || 'Không tải được danh sách thiết bị', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), REFRESH_MS);
    return () => clearInterval(timer);
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

  async function handleRename() {
    if (!renaming || !newName.trim()) return;
    setSavingName(true);
    try {
      await renameKioskDevice(renaming.id, newName.trim());
      enqueueSnackbar('Đã đổi tên thiết bị.', { variant: 'success' });
      setRenaming(null);
      fetchData(true);
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Đổi tên thất bại', { variant: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  async function handleRevoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await revokeKioskDevice(revoking.id);
      enqueueSnackbar('Đã thu hồi thiết bị.', { variant: 'success' });
      setRevoking(null);
      fetchData(true);
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Thu hồi thất bại', { variant: 'error' });
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4">Thiết bị cửa hàng</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Kiosk chấm công bằng khuôn mặt và camera đếm khách. Thiết bị đăng nhập bằng key riêng, thu hồi là mất quyền ngay.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography variant="subtitle1">Ghép nối thiết bị mới</Typography>
          <Tabs value={pairingGuide} onChange={(_, v) => setGuide(v)} sx={{ mt: 1 }}>
            {cameraOn && (
              <Tab value="camera" label="Camera đếm khách" icon={<Iconify icon="solar:videocamera-record-bold" width={20} />} iconPosition="start" />
            )}
            <Tab value="kiosk" label="Kiosk chấm công" icon={<Iconify icon="solar:monitor-smartphone-bold" width={20} />} iconPosition="start" />
          </Tabs>
        </Box>
        <Divider />
        <Stack spacing={2.5} sx={{ p: 3 }}>
          <PairingGuide kind={pairingGuide} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              id="pair-code"
              label="Mã ghép nối"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputProps={{ maxLength: 6, inputMode: 'numeric' }}
              sx={{ width: { sm: 160 } }}
            />
            <TextField
              id="pair-name"
              label="Tên thiết bị"
              placeholder={pairingGuide === 'camera' ? 'VD: Camera cửa chính' : 'VD: Kiosk quầy lễ tân'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
            <TextField
              id="pair-branch"
              select
              label="Chi nhánh"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              sx={{ width: { sm: 240 } }}
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
              disabled={code.trim().length !== 6 || !name.trim() || !branchId}
              onClick={handleClaim}
              sx={{ minWidth: 120 }}
            >
              Ghép nối
            </LoadingButton>
          </Stack>
        </Stack>
      </Card>

      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Danh sách thiết bị</Typography>
          <Button size="small" startIcon={<Iconify icon="solar:refresh-bold" />} onClick={() => fetchData()}>
            Làm mới
          </Button>
        </Stack>
        <Divider />
        {loading && devices.length === 0 ? (
          <Stack alignItems="center" sx={{ p: 4 }}>
            <CircularProgress />
          </Stack>
        ) : devices.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
            Chưa có thiết bị nào. Làm theo hướng dẫn ở trên để ghép nối thiết bị đầu tiên.
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Thiết bị</TableCell>
                  <TableCell>Chi nhánh</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Camera</TableCell>
                  <TableCell>Hoạt động gần nhất</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((d) => {
                  const status = statusOf(d);
                  const isAgent = d.kind === 'camera-agent';
                  return (
                    <TableRow key={d.id} sx={{ opacity: d.isActive ? 1 : 0.6 }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Iconify
                            icon={isAgent ? 'solar:videocamera-record-bold' : 'solar:monitor-smartphone-bold'}
                            width={22}
                            sx={{ color: 'text.secondary', flexShrink: 0 }}
                          />
                          <Box>
                            <Typography variant="subtitle2">{d.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {isAgent ? agentCaption(d) : 'Kiosk chấm công'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{d.branchName}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="soft" color={status.color} label={status.label} />
                      </TableCell>
                      <TableCell>
                        {d.cameras.length === 0 ? (
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        ) : (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {d.cameras.map((c) => (
                              <Chip
                                key={c.key}
                                size="small"
                                variant="outlined"
                                color={c.online && d.online ? 'success' : 'error'}
                                label={cameraChipLabel(c)}
                              />
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(isAgent ? d.lastHeartbeatAt : d.lastSeenAt)}</TableCell>
                      <TableCell align="right">
                        {d.isActive && (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button
                              size="small"
                              color="inherit"
                              onClick={() => {
                                setRenaming(d);
                                setNewName(d.name);
                              }}
                            >
                              Đổi tên
                            </Button>
                            <Button size="small" color="error" onClick={() => setRevoking(d)}>
                              Thu hồi
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={!!renaming} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
        <DialogTitle>Đổi tên thiết bị</DialogTitle>
        <DialogContent>
          <TextField
            id="rename-device"
            autoFocus
            fullWidth
            label="Tên thiết bị"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRenaming(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={savingName} disabled={!newName.trim()} onClick={handleRename}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revoking} onClose={() => setRevoking(null)} fullWidth maxWidth="xs">
        <DialogTitle>Thu hồi &quot;{revoking?.name}&quot;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Thiết bị mất quyền gửi dữ liệu ngay lập tức. Muốn dùng lại phải ghép nối lại bằng mã mới. Số liệu đã ghi vẫn được
            giữ.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRevoking(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" color="error" loading={revokeBusy} onClick={handleRevoke}>
            Thu hồi
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
