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

import { saveCounterDevice } from './counter-device';

// ----------------------------------------------------------------------
// Trình duyệt chưa là máy quầy (chưa ai đăng nhập): xin mã ghép nối loại "máy quầy", hiện mã 6 số + QR. Chủ cửa hàng /
// quản lý nhập mã ở Thiết bị cửa hàng (web) hoặc quét QR bằng app → máy nhận key (đúng một lần) và thành máy quầy.
// QR chỉ chứa mã — PairingId (để hỏi trạng thái / lấy key) chỉ trình duyệt này giữ.
// ----------------------------------------------------------------------

const POLL_MS = 2500;
const MAX_RENEWALS = 6;

type Pairing = { pairingId: string; code: string; expiresAt: string };
type Phase = 'loading' | 'waiting' | 'expired' | 'error' | 'missed';

export default function CounterPairPanel({ onLogin }: { onLogin: () => void }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const renewals = useRef(0);

  const start = useCallback(async (auto = false) => {
    renewals.current = auto ? renewals.current + 1 : 0;
    setPhase('loading');
    setQr(null);
    try {
      const res = await requestKioskPairing({ deviceType: 'counter', platform: 'web' });
      setPairing(res);
      setQr(await QRCode.toDataURL(JSON.stringify({ type: 'corecms-kiosk-pair', code: res.code }), { margin: 1, width: 220 }));
      setPhase('waiting');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!pairing || phase !== 'waiting') return undefined;
    let busy = false;
    const id = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await getKioskPairingStatus(pairing.pairingId);
        if (res.status === 'claimed') {
          clearInterval(id);
          if (res.kioskKey && res.deviceId && res.branchId) {
            saveCounterDevice({
              deviceId: res.deviceId,
              deviceName: res.deviceName ?? 'Máy quầy',
              branchId: res.branchId,
              branchName: res.branchName ?? '',
              deviceKey: res.kioskKey,
            });
          } else {
            // Đã duyệt nhưng key đã giao cho lần hỏi khác (mất mạng giữa chừng) — xin mã mới, thu hồi máy cũ trên web.
            setPhase('missed');
          }
        } else if (res.status === 'expired') {
          clearInterval(id);
          if (renewals.current < MAX_RENEWALS) start(true);
          else setPhase('expired');
        }
      } catch {
        // Lỗi mạng tạm thời — lần sau hỏi lại.
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pairing, phase, start]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ p: 4, maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <Stack spacing={2.5} alignItems="center">
          <Typography variant="h5">Đặt máy này làm máy quầy</Typography>

          {phase === 'loading' && <CircularProgress />}

          {phase === 'waiting' && pairing && (
            <>
              <Typography variant="body2" color="text.secondary">
                Chủ cửa hàng / quản lý nhập mã này ở <strong>Cài đặt cửa hàng → Thiết bị cửa hàng → Ghép nối</strong> trên
                web, hoặc quét QR bằng app (Hồ sơ → Ghép nối thiết bị).
              </Typography>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR ghép nối máy quầy" width={220} height={220} />
              )}
              <Typography variant="h2" sx={{ letterSpacing: 6, fontWeight: 700 }}>
                {pairing.code}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Đang chờ duyệt… (mã tự đổi sau 5 phút)
                </Typography>
              </Stack>
            </>
          )}

          {(phase === 'expired' || phase === 'error' || phase === 'missed') && (
            <>
              <Typography variant="body2" color="text.secondary">
                {phase === 'error' && 'Không lấy được mã ghép nối — kiểm tra kết nối mạng.'}
                {phase === 'expired' && 'Mã đã hết hạn.'}
                {phase === 'missed' && 'Máy đã được duyệt nhưng chưa nhận được khoá. Lấy mã mới rồi thu hồi máy vừa tạo ở trang Thiết bị cửa hàng.'}
              </Typography>
              <Button variant="contained" onClick={() => start()}>
                Lấy mã mới
              </Button>
            </>
          )}

          <Button size="small" color="inherit" onClick={onLogin}>
            Chủ cửa hàng / quản lý đang ở máy này? Đăng nhập để đặt nhanh
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
