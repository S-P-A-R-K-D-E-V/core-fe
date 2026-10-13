'use client';

import QRCode from 'qrcode';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import axios, { endpoints } from 'src/utils/axios';

import { useAuthContext } from 'src/auth/hooks';
import { sha256Hex, randomToken } from 'src/auth/utils/saas-host';

import { IQrLoginStartResponse, IQrLoginStatusResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Đăng nhập bằng mã QR ("đăng nhập từ thiết bị khác"). Trang này xin một mã ngắn hạn (2 phút, dùng một
// lần) rồi hiện thành QR; người đã đăng nhập trên app quét, xem thông tin trình duyệt và bấm Đồng ý;
// trang hỏi trạng thái định kỳ, được duyệt thì đổi mã lấy phiên.
//
// QR chỉ chứa mã — ai nhìn màn hình cũng đọc được, nên mã không đủ để lấy phiên: đổi mã còn cần
// verifier sinh ngẫu nhiên ở đây và chỉ giữ trong bộ nhớ của tab này (BE chỉ nhận SHA-256 của nó).
//
// Mã hết hạn thì tự xin mã mới, tối đa MAX_AUTO_RENEWALS lần — tab bỏ quên không hỏi BE mãi.
// ----------------------------------------------------------------------

/** App nhận ra QR đăng nhập web qua trường type (xem core-mobile: features/qr-login). */
export const QR_LOGIN_PAYLOAD_TYPE = 'corecms-web-login';

const MAX_AUTO_RENEWALS = 4;

type Phase = 'loading' | 'waiting' | 'scanned' | 'signing-in' | 'rejected' | 'expired' | 'error';

type Ticket = { code: string; verifier: string; pollMs: number; expiresAt: number };

type Props = {
  /** Đã đăng nhập xong — trang gọi chuyển tới returnTo. */
  onSuccess: () => void;
  /** Quay lại đăng nhập bằng mật khẩu. */
  onBack: () => void;
};

export default function JwtQrLogin({ onSuccess, onBack }: Props) {
  const { loginWithQr } = useAuthContext();

  const [phase, setPhase] = useState<Phase>('loading');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Mỗi lần xin mã mới tăng 1: kết quả của mã cũ về muộn thì bỏ. Rời trang cũng tăng.
  const generation = useRef(0);
  const renewals = useRef(0);

  // Trang cha truyền hàm mới mỗi lần render — giữ qua ref để không dựng lại vòng hỏi trạng thái.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const begin = useCallback(async (auto: boolean) => {
    generation.current += 1;
    const current = generation.current;
    renewals.current = auto ? renewals.current + 1 : 0;

    setPhase('loading');
    setQrDataUrl(null);
    setErrorMsg('');

    try {
      const verifier = randomToken(32);
      const res = await axios.post<IQrLoginStartResponse>(endpoints.auth.qrStart, {
        codeChallenge: await sha256Hex(verifier),
      });
      const { code, expiresInSeconds, pollIntervalSeconds } = res.data;
      const dataUrl = await QRCode.toDataURL(JSON.stringify({ type: QR_LOGIN_PAYLOAD_TYPE, code }), {
        margin: 1,
        width: 220,
      });
      if (current !== generation.current) return;

      setTicket({
        code,
        verifier,
        pollMs: Math.max(1, pollIntervalSeconds) * 1000,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      });
      setQrDataUrl(dataUrl);
      setPhase('waiting');
    } catch (error) {
      if (current !== generation.current) return;
      setTicket(null);
      setErrorMsg(
        error?.status === 429
          ? 'Bạn thao tác quá nhanh. Chờ một phút rồi thử lại.'
          : 'Không tạo được mã đăng nhập. Kiểm tra kết nối mạng rồi thử lại.'
      );
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    begin(false);
    return () => {
      generation.current += 1;
    };
  }, [begin]);

  // Hỏi trạng thái trong lúc chờ quét / chờ duyệt.
  useEffect(() => {
    if (!ticket || (phase !== 'waiting' && phase !== 'scanned')) return undefined;

    const current = generation.current;
    let busy = false;

    const expire = () => {
      if (renewals.current < MAX_AUTO_RENEWALS) begin(true);
      else setPhase('expired');
    };

    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await axios.post<IQrLoginStatusResponse>(endpoints.auth.qrStatus, { code: ticket.code });
        if (current !== generation.current) return;

        const { status } = res.data;
        if (status === 'approved') {
          clearInterval(timer);
          setPhase('signing-in');
          try {
            await loginWithQr?.(ticket.code, ticket.verifier);
            if (current === generation.current) onSuccessRef.current();
          } catch (error) {
            if (current !== generation.current) return;
            setErrorMsg(error?.title || error?.message || 'Đăng nhập thất bại. Tạo mã mới rồi quét lại.');
            setPhase('error');
          }
        } else if (status === 'rejected') {
          clearInterval(timer);
          setPhase('rejected');
        } else if (status === 'expired') {
          clearInterval(timer);
          expire();
        } else if (status === 'scanned') {
          setPhase('scanned');
        }
      } catch {
        // Lỗi mạng / quá tần suất tạm thời — lần hỏi sau tự thử lại; mã hết hạn thì nhánh dưới xử lý.
        if (current === generation.current && Date.now() > ticket.expiresAt) {
          clearInterval(timer);
          expire();
        }
      } finally {
        busy = false;
      }
    }, ticket.pollMs);

    return () => clearInterval(timer);
  }, [ticket, phase, begin, loginWithQr]);

  const renderQr = qrDataUrl && (phase === 'waiting' || phase === 'scanned' || phase === 'signing-in') && (
    <Box sx={{ position: 'relative', width: 220, height: 220 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUrl}
        alt="Mã QR đăng nhập"
        width={220}
        height={220}
        style={{ display: 'block', opacity: phase === 'waiting' ? 1 : 0.12 }}
      />
      {phase !== 'waiting' && (
        <Stack
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          sx={{ position: 'absolute', inset: 0, textAlign: 'center', px: 2 }}
        >
          <CircularProgress size={28} />
          <Typography variant="subtitle2">
            {phase === 'scanned' ? 'Đã quét — bấm Đồng ý trên điện thoại' : 'Đang đăng nhập…'}
          </Typography>
        </Stack>
      )}
    </Box>
  );

  const renderRetry = (message: string, action: string) => (
    <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        {message}
      </Typography>
      <Button variant="contained" color="inherit" onClick={() => begin(false)}>
        {action}
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={2.5} alignItems="center">
      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Mở app trên điện thoại đã đăng nhập, vào <strong>Hồ sơ → Quét mã đăng nhập web</strong> rồi quét mã
        này.
      </Typography>

      {phase === 'loading' && (
        <Stack alignItems="center" justifyContent="center" sx={{ width: 220, height: 220 }}>
          <CircularProgress />
        </Stack>
      )}

      {renderQr}

      {phase === 'rejected' && renderRetry('Yêu cầu đăng nhập đã bị từ chối trên điện thoại.', 'Tạo mã mới')}
      {phase === 'expired' && renderRetry('Mã đã hết hạn.', 'Tạo mã mới')}
      {phase === 'error' && renderRetry(errorMsg, 'Thử lại')}

      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
        Phiên đăng nhập bằng mã QR tự hết sau 12 giờ.
      </Typography>

      <Link component="button" type="button" variant="body2" color="inherit" underline="always" onClick={onBack}>
        Đăng nhập bằng mật khẩu
      </Link>
    </Stack>
  );
}
