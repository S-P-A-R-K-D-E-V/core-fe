'use client';

import QRCode from 'qrcode';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { requestKioskPairing, getKioskPairingStatus } from 'src/api/kiosk';

import KioskDeviceSetup from './kiosk-device-setup';

// ----------------------------------------------------------------------
// Ghép nối kiosk mới KHÔNG cần seed tay KioskDevice qua DB: màn hình này tự xin 1 mã 6 số + QR
// từ KioskPairingController, poll trạng thái định kỳ; người có quyền Admin/Manager quét QR (app)
// hoặc nhập mã (web, xem trang quản trị Kiosk Devices) để xác nhận — BE tự tạo KioskDevice + phát
// key, kiosk poll lấy về key đó rồi lưu localStorage, không ai phải copy-paste secret thủ công.

const POLL_INTERVAL_MS = 2000;

type PairingInfo = { pairingId: string; code: string; expiresAt: string };
type Status = 'loading' | 'waiting' | 'expired' | 'error';

type Props = {
  onSubmit: (key: string) => void;
};

export default function KioskPairingSetup({ onSubmit }: Props) {
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [showManual, setShowManual] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPairing = useCallback(async () => {
    setStatus('loading');
    setQrDataUrl(null);
    try {
      const res = await requestKioskPairing();
      setPairing(res);
      setStatus('waiting');
      // QR mã hoá JSON để app đọc trực tiếp — vẫn hiện mã số bên dưới cho người nhập tay/nhìn đọc.
      const payload = JSON.stringify({ type: 'corecms-kiosk-pair', pairingId: res.pairingId, code: res.code });
      const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
      setQrDataUrl(dataUrl);
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    startPairing();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [startPairing]);

  useEffect(() => {
    if (!pairing || status !== 'waiting') return undefined;

    pollRef.current = setInterval(async () => {
      try {
        const res = await getKioskPairingStatus(pairing.pairingId);
        if (res.status === 'claimed' && res.kioskKey) {
          if (pollRef.current) clearInterval(pollRef.current);
          onSubmit(res.kioskKey);
        } else if (res.status === 'expired') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {
        // Lỗi mạng tạm thời — bỏ qua, poll lần sau tự thử lại.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pairing, status, onSubmit]);

  if (showManual) {
    return <KioskDeviceSetup onSubmit={onSubmit} onBack={() => setShowManual(false)} />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.900',
        p: 2,
      }}
    >
      <Card sx={{ p: 4, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Stack spacing={2.5} alignItems="center">
          <Typography variant="h5">Ghép nối thiết bị Kiosk</Typography>

          {status === 'loading' && <CircularProgress />}

          {status === 'error' && (
            <>
              <Typography variant="body2" color="text.secondary">
                Không lấy được mã ghép nối — kiểm tra kết nối mạng.
              </Typography>
              <Button variant="contained" onClick={startPairing}>
                Thử lại
              </Button>
            </>
          )}

          {status === 'expired' && (
            <>
              <Typography variant="body2" color="text.secondary">
                Mã ghép nối đã hết hạn.
              </Typography>
              <Button variant="contained" onClick={startPairing}>
                Lấy mã mới
              </Button>
            </>
          )}

          {status === 'waiting' && pairing && (
            <>
              <Typography variant="body2" color="text.secondary">
                Quét mã QR bằng app (tài khoản Admin/Manager), hoặc nhập mã bên dưới ở trang quản
                trị &quot;Thiết bị Kiosk&quot; trên web.
              </Typography>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR ghép nối kiosk" width={240} height={240} />
              )}
              <Typography variant="h3" sx={{ letterSpacing: 4, fontWeight: 700 }}>
                {pairing.code}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Đang chờ xác nhận…
                </Typography>
              </Stack>
            </>
          )}

          <Button size="small" color="inherit" onClick={() => setShowManual(true)}>
            Nhập khoá thiết bị thủ công
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
