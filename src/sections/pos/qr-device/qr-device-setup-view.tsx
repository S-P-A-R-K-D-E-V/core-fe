'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useQrDevice } from './use-qr-device';
import { qrDevice } from './qr-device-manager';
import { QR_STATUS_LABEL } from './qr-device-button';
import { sampleQrInfo } from './qr-device-sample';
import {
  findPreset,
  usbIdLabel,
  usbVendorName,
  probeCandidates,
  CUSTOM_PRESET_ID,
  QR_DEVICE_PRESETS,
  QR_DEVICE_BAUD_RATES,
  type QrDeviceInfo,
  type QrDeviceTemplates,
} from './qr-device-template';

import type { QrDeviceSnapshot, QrDeviceLogEntry } from './qr-device-manager';

// ----------------------------------------------------------------------
// Trang cài đặt máy hiện QR cắm USB: kết nối cổng, dò kiểu lệnh (gửi thử lần lượt, người cài bấm "máy đã hiện"),
// sửa mẫu lệnh tay khi có tài liệu của hãng, nhật ký byte gửi / nhận để gửi kỹ thuật.
// ----------------------------------------------------------------------

const DIR_LABEL: Record<QrDeviceLogEntry['dir'], { label: string; color: 'primary' | 'success' | 'default' | 'error' }> = {
  tx: { label: 'Gửi', color: 'primary' },
  rx: { label: 'Máy gửi về', color: 'success' },
  info: { label: 'Tin', color: 'default' },
  error: { label: 'Lỗi', color: 'error' },
};

const time = (at: number) => new Date(at).toLocaleTimeString('vi-VN');

function logReport(device: QrDeviceSnapshot) {
  const { settings, port } = device;
  const head = [
    `Máy QR — ${new Date().toLocaleString('vi-VN')}`,
    `Trình duyệt: ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
    `USB: ${usbIdLabel(port?.usbVendorId, port?.usbProductId) ?? 'chưa rõ'} ${usbVendorName(port?.usbVendorId) ?? ''}`,
    `Tốc độ: ${settings.baudRate} · Kiểu lệnh: ${settings.presetId}${settings.verified ? ' (đã xác nhận)' : ''}`,
    `Mẫu hiện QR: ${settings.templates.show}`,
    `Mẫu xoá: ${settings.templates.clear}`,
    `Mẫu đã nhận: ${settings.templates.paid}`,
    '',
  ];
  const lines = device.log.map((e) => `[${time(e.at)}] ${DIR_LABEL[e.dir].label}: ${e.text}${e.hex ? `\n    ${e.hex}` : ''}`);
  return [...head, ...lines].join('\n');
}

export default function QrDeviceSetupView() {
  const device = useQrDevice();
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();
  const { status, settings, port } = device;
  const connected = status === 'connected';

  const [sample, setSample] = useState<QrDeviceInfo | null>(null);
  useEffect(() => {
    sampleQrInfo().then(setSample).catch(console.error);
  }, []);

  // ---- Mẫu lệnh tự nhập (mục 3)
  const [draft, setDraft] = useState<QrDeviceTemplates>(settings.templates);
  const [draftPreset, setDraftPreset] = useState(settings.presetId);
  // Cài đặt đổi (đọc từ máy sau khi tải trang, lưu, dò được kiểu) → ô nhập theo.
  useEffect(() => {
    setDraft(settings.templates);
    setDraftPreset(settings.presetId);
  }, [settings.templates, settings.presetId]);
  const draftDirty =
    draft.show !== settings.templates.show ||
    draft.clear !== settings.templates.clear ||
    draft.paid !== settings.templates.paid ||
    draftPreset !== settings.presetId;

  // ---- Dò kiểu lệnh (mục 2)
  const candidates = useMemo(() => probeCandidates(), []);
  const [probeIndex, setProbeIndex] = useState<number | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const probeDone = probeIndex !== null && probeIndex >= candidates.length;
  const current = probeIndex !== null && !probeDone ? candidates[probeIndex] : null;

  const runProbe = async (index: number) => {
    setProbeIndex(index);
    const candidate = candidates[index];
    if (!candidate || !sample) return;
    setProbeBusy(true);
    try {
      if (candidate.baudRate !== qrDevice.getSnapshot().settings.baudRate) {
        await qrDevice.setBaudRate(candidate.baudRate);
      }
      await qrDevice.sendTemplate(
        candidate.preset.templates.show,
        sample,
        `Thử kiểu ${index + 1}/${candidates.length}`
      );
    } finally {
      setProbeBusy(false);
    }
  };

  const acceptProbe = () => {
    if (!current) return;
    qrDevice.setTemplates(current.preset.id, current.preset.templates, true);
    setProbeIndex(null);
    enqueueSnackbar(`Đã lưu: ${current.preset.label} · ${current.baudRate} baud`, { variant: 'success' });
  };

  const usbId = usbIdLabel(port?.usbVendorId, port?.usbProductId);
  const vendor = usbVendorName(port?.usbVendorId);

  return (
    <Container maxWidth="md" sx={{ pb: 6 }}>
      <CustomBreadcrumbs
        heading="Máy hiện QR (USB)"
        links={[
          { name: 'Bán hàng', href: paths.dashboard.pos.sale.root },
          { name: 'Máy hiện QR' },
        ]}
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Stack spacing={2.5}>
        {status === 'unsupported' && (
          <Alert severity="error">
            Trình duyệt này không kết nối được thiết bị USB. Mở trang bằng <strong>Chrome</strong> hoặc{' '}
            <strong>Edge</strong> trên máy tính (Windows / macOS).
          </Alert>
        )}

        {/* 1. Kết nối */}
        <Card>
          <CardHeader
            title="1. Kết nối máy"
            subheader="Cắm cáp USB của máy QR vào máy tính quầy, bấm Chọn cổng, chọn cổng có tên máy (vd “USB-SERIAL CH340 (COM3)”)."
          />
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <Chip
                  size="small"
                  label={QR_STATUS_LABEL[status]}
                  color={connected ? 'success' : status === 'error' ? 'error' : 'default'}
                  variant={connected ? 'filled' : 'outlined'}
                />
                {usbId && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {vendor ?? 'USB'} · {usbId}
                  </Typography>
                )}
              </Stack>
              <TextField
                select
                size="small"
                label="Tốc độ (baud)"
                value={settings.baudRate}
                onChange={(e) => qrDevice.setBaudRate(Number(e.target.value)).catch(console.error)}
                sx={{ minWidth: 150 }}
                disabled={status === 'unsupported'}
              >
                {QR_DEVICE_BAUD_RATES.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
              {connected ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<Iconify icon="solar:link-broken-bold" />}
                  onClick={() => qrDevice.disconnect()}
                >
                  Ngắt
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="solar:plug-circle-bold" />}
                  disabled={status === 'unsupported' || status === 'connecting'}
                  onClick={() => qrDevice.choosePort()}
                >
                  Chọn cổng
                </Button>
              )}
            </Stack>
            {device.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {device.error}
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              Không thấy cổng nào: cài driver USB-serial đi kèm máy (thường là CH340 hoặc CP210x) rồi cắm lại. Đã chọn một
              lần thì lần sau mở màn bán hàng máy tự kết nối.
            </Typography>
          </CardContent>
        </Card>

        {/* 2. Dò kiểu lệnh */}
        <Card>
          <CardHeader
            title="2. Tìm kiểu lệnh của máy"
            subheader={`Mỗi loại máy nhận lệnh một kiểu. Bấm Bắt đầu: hệ thống gửi thử QR ${fCurrency(10000)} lần lượt từng kiểu — nhìn máy QR, thấy hiện mã thì bấm “Máy đã hiện QR”.`}
            action={
              settings.verified ? (
                <Chip size="small" color="success" label="Đã có kiểu chạy được" sx={{ mt: 1, mr: 1 }} />
              ) : undefined
            }
          />
          <CardContent>
            {probeIndex === null && (
              <Button
                variant="contained"
                disabled={!connected || !sample}
                startIcon={<Iconify icon="solar:play-bold" />}
                onClick={() => runProbe(0)}
              >
                Bắt đầu thử
              </Button>
            )}
            {!connected && probeIndex === null && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>
                Kết nối máy trước.
              </Typography>
            )}

            {current && probeIndex !== null && (
              <Stack spacing={1.5}>
                <LinearProgress variant="determinate" value={((probeIndex + 1) / candidates.length) * 100} />
                <Typography variant="body2">
                  Kiểu <strong>{probeIndex + 1}</strong>/{candidates.length}: {current.preset.label} ·{' '}
                  {current.baudRate} baud
                </Typography>
                <Typography variant="subtitle1">Máy QR có hiện mã QR không?</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={probeBusy}
                    startIcon={<Iconify icon="solar:check-circle-bold" />}
                    onClick={acceptProbe}
                  >
                    Máy đã hiện QR
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={probeBusy}
                    endIcon={<Iconify icon="solar:arrow-right-bold" />}
                    onClick={() => runProbe(probeIndex + 1)}
                  >
                    Chưa hiện — thử kiểu tiếp
                  </Button>
                  <Button color="inherit" disabled={probeBusy} onClick={() => runProbe(probeIndex)}>
                    Gửi lại
                  </Button>
                  <Button color="inherit" disabled={probeBusy} onClick={() => setProbeIndex(null)}>
                    Dừng
                  </Button>
                </Stack>
              </Stack>
            )}

            {probeDone && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" size="small" onClick={() => setProbeIndex(null)}>
                    Đóng
                  </Button>
                }
              >
                Chưa kiểu nào chạy. Máy dùng bảng lệnh riêng: xin <strong>tài liệu giao thức</strong> từ người bán (vd
                HACOM 1900 1903) rồi nhập ở mục 3, hoặc bấm “Sao chép nhật ký” gửi cho kỹ thuật.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 3. Mẫu lệnh */}
        <Card>
          <CardHeader
            title="3. Mẫu lệnh (nâng cao)"
            subheader="Dùng khi có bảng lệnh của hãng. Chỗ thay: {payload} chuỗi QR · {amount} số tiền · {amountVnd} 10.000 · {bank} {account} {accountName} {content}. Ký tự đặc biệt: \r \n \t \0 \xHH."
          />
          <CardContent>
            <Stack spacing={2}>
              <TextField
                select
                size="small"
                label="Kiểu có sẵn"
                value={findPreset(draftPreset) ? draftPreset : CUSTOM_PRESET_ID}
                onChange={(e) => {
                  const preset = findPreset(e.target.value);
                  setDraftPreset(e.target.value);
                  if (preset) setDraft(preset.templates);
                }}
                sx={{ maxWidth: 360 }}
              >
                {QR_DEVICE_PRESETS.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_PRESET_ID}>Tự nhập</MenuItem>
              </TextField>

              {(
                [
                  ['show', 'Hiện QR + số tiền', 'Hiện QR'],
                  ['clear', 'Xoá màn (để trống = không gửi)', 'Xoá'],
                  ['paid', 'Đã nhận tiền (để trống = gửi lệnh xoá)', 'Đã nhận tiền'],
                ] as const
              ).map(([key, label, testLabel]) => (
                <Stack key={key} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={label}
                    value={draft[key]}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, [key]: e.target.value }));
                      setDraftPreset(CUSTOM_PRESET_ID);
                    }}
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                  <Button
                    variant="outlined"
                    disabled={!connected || !draft[key] || !sample}
                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    onClick={() => qrDevice.sendTemplate(draft[key], sample, `Thử ${testLabel.toLowerCase()}`)}
                  >
                    Gửi thử
                  </Button>
                </Stack>
              ))}

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={!draftDirty}
                  onClick={() => {
                    qrDevice.setTemplates(draftPreset, draft, false);
                    enqueueSnackbar('Đã lưu mẫu lệnh', { variant: 'success' });
                  }}
                >
                  Lưu
                </Button>
                {settings.verified && !draftDirty ? null : (
                  <Button
                    color="success"
                    disabled={draftDirty}
                    onClick={() => {
                      qrDevice.setTemplates(settings.presetId, settings.templates, true);
                      enqueueSnackbar('Đã đánh dấu: máy hiện được QR', { variant: 'success' });
                    }}
                  >
                    Máy đã hiện đúng — xác nhận
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Nhật ký */}
        <Card>
          <CardHeader
            title="Nhật ký gửi / nhận"
            subheader="Byte gửi xuống máy và byte máy gửi về — gửi cho kỹ thuật khi máy chưa chạy."
            action={
              <Stack direction="row" spacing={0.5} sx={{ mt: 1, mr: 1 }}>
                <Button
                  size="small"
                  startIcon={<Iconify icon="solar:copy-bold" />}
                  onClick={() => {
                    copy(logReport(device));
                    enqueueSnackbar('Đã sao chép nhật ký');
                  }}
                >
                  Sao chép nhật ký
                </Button>
                <Button size="small" color="inherit" onClick={() => qrDevice.clearLog()}>
                  Xoá
                </Button>
              </Stack>
            }
          />
          <CardContent>
            {device.log.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có gì.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 360, overflow: 'auto', fontSize: 12 }}>
                {[...device.log].reverse().map((entry) => (
                  <Box key={entry.id} sx={{ py: 0.75, borderBottom: '1px dashed', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {time(entry.at)}
                      </Typography>
                      <Chip
                        size="small"
                        label={DIR_LABEL[entry.dir].label}
                        color={DIR_LABEL[entry.dir].color}
                        variant="outlined"
                        sx={{ height: 20, fontSize: 11 }}
                      />
                      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                        {entry.text}
                      </Typography>
                    </Stack>
                    {entry.hex && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                        sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.25 }}
                      >
                        {entry.hex}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
