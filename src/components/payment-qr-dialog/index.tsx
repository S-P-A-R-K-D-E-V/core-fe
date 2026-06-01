'use client';

import { useState, useEffect, useCallback } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import type {
  IPayrollPaymentDetail,
  IPayrollRecord,
  IPreparePayrollPaymentResponse,
} from 'src/types/corecms-api';
import { markPayrollPaid, preparePayrollPayment } from 'src/api/payroll';

// ──────────────────────────────────────────────────────────────────────────
// VietQR spec: https://www.vietqr.io/danh-sach-api/link-tao-ma-nhanh/
//   BANK_ID-ACCOUNT_NO-TEMPLATE.png?amount=N&addInfo=DESC&accountName=NAME
//   • addInfo: ASCII only, no diacritics, no special chars, max 50 chars
//   • amount: positive integer, max 13 digits
//   • template: compact2 (540×640) recommended for popups

/** Strip Vietnamese diacritics and reduce to [a-zA-Z0-9 -], max 50 chars. */
function sanitizeAddInfo(text: string): string {
  const noAccents = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/đ/gi, 'd');             // đ / Đ → d
  const ascii = noAccents
    .replace(/[^a-zA-Z0-9 \-]/g, ' ') // keep alphanumeric, space, hyphen
    .replace(/ {2,}/g, ' ')            // collapse spaces
    .trim();
  return ascii.length > 50 ? ascii.slice(0, 50).trimEnd() : ascii;
}

function buildVietQRUrl(
  bankCode: string,
  bankAccount: string,
  amount: number,
  content: string,
  accountName: string
): string {
  const safeAmount = Math.round(Math.abs(amount));
  // Guard: amount must be ≤ 13 digits per VietQR spec
  const amountStr = String(safeAmount).slice(0, 13);
  const safeContent = sanitizeAddInfo(content);
  const params = new URLSearchParams({
    amount: amountStr,
    addInfo: safeContent,
    accountName,
  });
  return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.jpg?${params.toString()}`;
}

// ──────────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  record: IPayrollRecord | null;
  onClose: VoidFunction;
  onPaid: (detail: IPayrollPaymentDetail) => void; // called after mark-paid succeeds
};

export default function PaymentQRDialog({ open, record, onClose, onPaid }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [prepare, setPrepare] = useState<IPreparePayrollPaymentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  // Editable fields for mark-paid
  const [transactionRef, setTransactionRef] = useState('');
  const [note, setNote] = useState('');
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);

  const fetch = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setQrError(false);
    try {
      const data = await preparePayrollPayment(record.id);
      setPrepare(data);
    } catch {
      enqueueSnackbar('Không tải được thông tin thanh toán', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [record, enqueueSnackbar]);

  useEffect(() => {
    if (open && record) {
      setPrepare(null);
      setTransactionRef('');
      setNote('');
      setQrLoading(true);
      setQrError(false);
      fetch();
    }
  }, [open, record, fetch]);

  const handleMarkPaid = async () => {
    if (!record || !prepare) return;
    try {
      setMarking(true);
      const detail = await markPayrollPaid(record.id, {
        amount: prepare.amount,
        content: prepare.suggestedContent,
        transactionRef: transactionRef.trim() || undefined,
        note: note.trim() || undefined,
      });
      enqueueSnackbar('Đã đánh dấu thanh toán thành công!', { variant: 'success' });
      onPaid(detail);
      onClose();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Đánh dấu thanh toán thất bại', { variant: 'error' });
    } finally {
      setMarking(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(`Đã sao chép ${label}!`);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  const isPaid = record?.payment?.status === 'Paid';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify icon="solar:wallet-money-bold-duotone" width={28} sx={{ color: 'primary.main' }} />
          <Box>
            <Typography variant="h6" lineHeight={1.3}>
              {isPaid ? 'Chi tiết thanh toán lương' : 'Trả lương'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {record?.userName} — kỳ {record?.periodMonth}
            </Typography>
          </Box>
          {isPaid && (
            <Chip
              label="Đã thanh toán"
              color="success"
              size="small"
              icon={<Iconify icon="solar:check-circle-bold" width={14} />}
              sx={{ ml: 'auto' }}
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : !prepare ? null : !prepare.canPay ? (
          <Alert
            severity="warning"
            icon={<Iconify icon="solar:danger-bold" width={20} />}
            sx={{ mb: 1 }}
          >
            {prepare.missingInfoReason}
          </Alert>
        ) : (
          <Stack spacing={2.5}>
            {/* Already paid info */}
            {isPaid && record?.payment && (
              <Alert severity="success" icon={<Iconify icon="solar:check-circle-bold" width={20} />}>
                Đã thanh toán{' '}
                <strong>{formatCurrency(record.payment.amount)}</strong> vào{' '}
                {new Date(record.payment.paidAt).toLocaleString('vi-VN')}
                {record.payment.transactionRef && (
                  <span> · Mã GD: <strong>{record.payment.transactionRef}</strong></span>
                )}
              </Alert>
            )}

            {/* Amount */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Số tiền cần trả
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight={700}>
                {formatCurrency(prepare.amount)}
              </Typography>
            </Stack>

            {/* QR code */}
            <Box textAlign="center">
              {qrError ? (
                <Box
                  sx={{
                    width: 240,
                    height: 240,
                    mx: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.neutral',
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Stack alignItems="center" spacing={1}>
                    <Iconify icon="solar:qr-code-bold-duotone" width={44} sx={{ color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled">
                      Không tạo được QR, vui lòng thử lại
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => { setQrError(false); setQrLoading(true); }}
                    >
                      Thử lại
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box sx={{ position: 'relative', width: 240, height: 240, mx: 'auto' }}>
                  {/* Skeleton shown while image is loading */}
                  {qrLoading && (
                    <Skeleton
                      variant="rectangular"
                      width={240}
                      height={240}
                      sx={{ borderRadius: 2, position: 'absolute', top: 0, left: 0 }}
                    />
                  )}
                  <Box
                    component="img"
                    src={buildVietQRUrl(
                      prepare.bankCode!,
                      prepare.bankAccount!,
                      prepare.amount,
                      prepare.suggestedContent,
                      prepare.accountName!
                    )}
                    alt="VietQR payment"
                    onLoad={() => setQrLoading(false)}
                    onError={() => { setQrLoading(false); setQrError(true); }}
                    sx={{
                      width: 240,
                      height: 240,
                      borderRadius: 2,
                      objectFit: 'cover',
                      display: qrLoading ? 'none' : 'block',
                    }}
                  />
                </Box>
              )}
              <Typography variant="caption" color="text.disabled" display="block" mt={0.75}>
                Quét mã QR để chuyển khoản (compact2 · 540×640)
              </Typography>
            </Box>

            <Divider />

            {/* Bank info */}
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Ngân hàng</Typography>
                <Typography variant="body2" fontWeight={600}>{prepare.bankCode}</Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Số tài khoản</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>{prepare.bankAccount}</Typography>
                  <Tooltip title="Sao chép STK">
                    <IconButton size="small" onClick={() => copyToClipboard(prepare.bankAccount!, 'số tài khoản')}>
                      <Iconify icon="solar:copy-bold" width={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Tên tài khoản</Typography>
                <Typography variant="body2" fontWeight={600}>{prepare.accountName}</Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Nội dung CK</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" fontWeight={600} sx={{ maxWidth: 220, textAlign: 'right' }}>
                    {prepare.suggestedContent}
                  </Typography>
                  <Tooltip title="Sao chép nội dung">
                    <IconButton size="small" onClick={() => copyToClipboard(prepare.suggestedContent, 'nội dung')}>
                      <Iconify icon="solar:copy-bold" width={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>

            {/* Mark paid fields — only show if not already paid */}
            {!isPaid && (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">
                    Xác nhận thanh toán
                  </Typography>
                  <TextField
                    label="Mã giao dịch (tùy chọn)"
                    size="small"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Nhập mã giao dịch ngân hàng nếu có"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Iconify icon="solar:hashtag-bold" width={16} sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Ghi chú (tùy chọn)"
                    size="small"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    multiline
                    rows={2}
                  />
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          {isPaid ? 'Đóng' : 'Huỷ'}
        </Button>
        {!isPaid && prepare?.canPay && (
          <LoadingButton
            variant="contained"
            color="success"
            loading={marking}
            onClick={handleMarkPaid}
            startIcon={<Iconify icon="solar:check-circle-bold" width={18} />}
          >
            Đánh dấu đã thanh toán
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
