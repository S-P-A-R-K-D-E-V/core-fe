'use client';

import QRCode from 'qrcode';
import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { secondsUntil, formatCountdown } from 'src/utils/payment-status';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Phần thêm của mã QR khi core-be bật dịch vụ thanh toán: nội dung chuyển khoản (mã thanh toán) + đếm ngược hết hạn.
// Dùng chung cho POS bán lẻ và F&B. Không có paymentCode / expiresAt (dịch vụ tắt) → không hiện gì.
// ----------------------------------------------------------------------

/** Số giây còn lại tới expiresAt, cập nhật mỗi giây; null khi không có expiresAt. */
export function useExpirySeconds(expiresAt: string | null | undefined): number | null {
  const [left, setLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setLeft(secondsUntil(expiresAt));
    if (!expiresAt) return undefined;
    const timer = setInterval(() => setLeft(secondsUntil(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return left;
}

/** Ảnh QR: ưu tiên qrDataUrl máy chủ trả; chỉ có chuỗi EMVCo (qrPayload) thì tự vẽ. */
export function useQrImageSrc(qrDataUrl?: string | null, qrPayload?: string | null): string | undefined {
  const [generated, setGenerated] = useState<string | undefined>(undefined);

  useEffect(() => {
    setGenerated(undefined);
    if (qrDataUrl || !qrPayload) return undefined;
    let cancelled = false;
    QRCode.toDataURL(qrPayload, { margin: 1, width: 480 })
      .then((url) => {
        if (!cancelled) setGenerated(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qrDataUrl, qrPayload]);

  return qrDataUrl || generated;
}

// ----------------------------------------------------------------------

type Props = {
  paymentCode?: string | null;
  /** Từ useExpirySeconds — null = không đếm ngược */
  secondsLeft: number | null;
};

export default function PaymentQrInfo({ paymentCode, secondsLeft }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();

  if (!paymentCode && secondsLeft === null) return null;

  const handleCopy = async () => {
    if (!paymentCode) return;
    const ok = await copy(paymentCode);
    enqueueSnackbar(ok ? 'Đã sao chép nội dung chuyển khoản' : 'Không sao chép được', {
      variant: ok ? 'success' : 'error',
    });
  };

  return (
    <Stack alignItems="center" spacing={0.75}>
      {paymentCode && (
        <Stack alignItems="center" spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            Nội dung chuyển khoản (bắt buộc)
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
              {paymentCode}
            </Typography>
            <Tooltip title="Sao chép">
              <IconButton size="small" onClick={handleCopy}>
                <Iconify icon="solar:copy-bold" width={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      {secondsLeft !== null && (
        <Chip
          size="small"
          variant="outlined"
          color={secondsLeft === 0 ? 'error' : secondsLeft <= 60 ? 'warning' : 'default'}
          icon={<Iconify icon="solar:clock-circle-bold" width={16} />}
          label={secondsLeft === 0 ? 'Mã QR đã hết hạn' : `Hết hạn sau ${formatCountdown(secondsLeft)}`}
        />
      )}
    </Stack>
  );
}
