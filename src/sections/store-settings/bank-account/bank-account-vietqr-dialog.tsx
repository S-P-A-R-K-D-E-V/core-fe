'use client';

import type { IVietQRBank } from 'src/types/corecms-api';
import type { IBankAccountVietQr, IBankAccountWithConnections } from 'src/types/payment-service';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { apiErrorMessage } from 'src/utils/api-error';
import { printHtmlDocument } from 'src/utils/print-html';

import { getBankAccountVietQr } from 'src/api/bank-accounts';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useQrImageSrc } from 'src/components/payment-qr-info';

import { VIETQR_CONTENT_MAX, bankAccountBankLabel } from './utils';
import {
  formatVnd,
  downloadBlob,
  preloadImages,
  vietQrFileName,
  buildVietQrCardHtml,
  renderVietQrCardPng,
} from './vietqr-card';

import type { VietQrCardData } from './vietqr-card';

// ----------------------------------------------------------------------
// Mã VietQR của một tài khoản (GET bank-accounts/{id}/vietqr). Mặc định QR tĩnh (không số tiền) để in dán quầy; nhập số
// tiền / nội dung thì tạo QR động. In thẻ khổ A6 hoặc tải ảnh PNG.
// ----------------------------------------------------------------------

type Props = {
  /** null = đóng */
  account: IBankAccountWithConnections | null;
  bank?: IVietQRBank;
  storeName?: string | null;
  onClose: VoidFunction;
};

export default function BankAccountVietQrDialog({ account, bank, storeName, onClose }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [qr, setQr] = useState<IBankAccountVietQr | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    async (id: string, params?: { amount?: number | null; content?: string | null }) => {
      setLoading(true);
      setError(null);
      try {
        setQr(await getBankAccountVietQr(id, params));
      } catch (err) {
        setQr(null);
        setError(apiErrorMessage(err, 'Không tạo được mã VietQR cho tài khoản này'));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Mở → QR tĩnh
  useEffect(() => {
    if (!account) return;
    setAmount('');
    setContent('');
    setQr(null);
    load(account.id);
  }, [account, load]);

  // Tự vẽ từ payload; ảnh img.vietqr.io chỉ khi máy chủ không trả payload.
  const drawnQr = useQrImageSrc(undefined, qr?.payload);
  const qrImage = qr?.payload ? drawnQr : (qr?.imageUrl ?? undefined);
  const amountNumber = Number(amount) || 0;
  const bankLabel = account ? bankAccountBankLabel(account, bank) : '';
  const appliedAmount = qr?.amount ?? null;
  const appliedContent = qr?.content ?? null;
  const dirty = amountNumber !== (appliedAmount ?? 0) || content.trim() !== (appliedContent ?? '');

  const cardData = (): VietQrCardData | null =>
    qr
      ? {
          storeName,
          bankLogoUrl: bank?.logo || null,
          bankLabel,
          bankName: qr.bankName || account?.bankName || bank?.name || null,
          accountNumber: qr.accountNumber,
          accountName: qr.accountName,
          amount: qr.amount,
          content: qr.content,
          payload: qr.payload,
          imageUrl: qr.imageUrl,
        }
      : null;

  const handleApply = () => {
    if (!account) return;
    load(account.id, { amount: amountNumber || null, content: content.trim() || null });
  };

  const handleStatic = () => {
    if (!account) return;
    setAmount('');
    setContent('');
    load(account.id);
  };

  const handlePrint = async () => {
    const data = cardData();
    if (!data) return;
    setPrinting(true);
    try {
      // print() không chờ ảnh mạng → nạp trước logo (và ảnh QR dự phòng) vào bộ nhớ đệm.
      await preloadImages([data.bankLogoUrl, data.payload ? null : data.imageUrl]);
      await printHtmlDocument(buildVietQrCardHtml(data), { delayMs: 300 });
    } catch {
      enqueueSnackbar('Không mở được hộp thoại in', { variant: 'error' });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    const data = cardData();
    if (!data) return;
    setDownloading(true);
    try {
      const blob = await renderVietQrCardPng(data);
      if (!blob) throw new Error('no-image');
      downloadBlob(blob, vietQrFileName(data));
    } catch {
      enqueueSnackbar('Không tạo được ảnh PNG', { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyAccount = async () => {
    if (!qr) return;
    const ok = await copy(qr.accountNumber);
    enqueueSnackbar(ok ? 'Đã sao chép số tài khoản' : 'Không sao chép được', {
      variant: ok ? 'success' : 'error',
    });
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={!!account}
      onClose={onClose}
      aria-labelledby="bank-account-vietqr-title"
    >
      <DialogTitle id="bank-account-vietqr-title">Mã VietQR · {bankLabel}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack alignItems="center" spacing={1.25}>
            {bank?.logo && (
              <Box
                component="img"
                src={bank.logo}
                alt={bankLabel}
                sx={{ height: 32, objectFit: 'contain' }}
              />
            )}

            <Box
              sx={{
                width: 260,
                height: 260,
                borderRadius: 1.5,
                bgcolor: 'common.white',
                border: (theme) => `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
              }}
            >
              {loading && <CircularProgress size={28} aria-label="Đang tạo mã" />}
              {!loading && qrImage && (
                <Box
                  component="img"
                  src={qrImage}
                  alt={`Mã VietQR chuyển khoản tới ${qr?.accountNumber ?? ''}`}
                  sx={{ width: 1, height: 1, objectFit: 'contain' }}
                />
              )}
              {!loading && !qrImage && (
                <Iconify icon="solar:qr-code-bold" width={64} sx={{ color: 'text.disabled' }} />
              )}
            </Box>

            {qr && (
              <Stack alignItems="center" spacing={0.25}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                    {qr.accountNumber}
                  </Typography>
                  <Tooltip title="Sao chép số tài khoản">
                    <IconButton
                      size="small"
                      aria-label="Sao chép số tài khoản"
                      onClick={handleCopyAccount}
                    >
                      <Iconify icon="solar:copy-bold" width={18} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {qr.accountName && <Typography variant="subtitle2">{qr.accountName}</Typography>}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {qr.bankName || account?.bankName || bank?.name}
                </Typography>
                {!!qr.amount && (
                  <Typography variant="body2">
                    Số tiền: <b>{formatVnd(qr.amount)}</b>
                  </Typography>
                )}
                {qr.content && (
                  <Typography variant="body2">
                    Nội dung: <b>{qr.content}</b>
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {qr && !qr.amount && (
            <Alert severity="info">
              Đây là <b>mã QR tĩnh</b> (không kèm số tiền): in ra dán ở quầy, khách quét rồi tự nhập
              số tiền. Tiền về theo mã này không tự gắn với hoá đơn — mã QR ở màn bán hàng mới có mã
              thanh toán để tự xác nhận.
            </Alert>
          )}

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Tạo mã kèm số tiền (không bắt buộc)</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Số tiền"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 13))}
                helperText={amountNumber ? formatVnd(amountNumber) : 'Để trống = khách tự nhập'}
                inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
              />
              <TextField
                fullWidth
                size="small"
                label="Nội dung chuyển khoản"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                helperText={`Tối đa ${VIETQR_CONTENT_MAX} ký tự, không dấu`}
                inputProps={{ maxLength: VIETQR_CONTENT_MAX, autoComplete: 'off' }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <LoadingButton
                size="small"
                variant="outlined"
                loading={loading}
                disabled={!account || !dirty}
                onClick={handleApply}
                startIcon={<Iconify icon="solar:restart-bold" />}
              >
                Cập nhật mã
              </LoadingButton>
              {(!!appliedAmount || !!appliedContent) && (
                <Button size="small" color="inherit" onClick={handleStatic} disabled={loading}>
                  Về mã QR tĩnh
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Đóng
        </Button>
        <LoadingButton
          variant="outlined"
          loading={downloading}
          disabled={!qr || loading}
          onClick={handleDownload}
          startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
        >
          Tải ảnh PNG
        </LoadingButton>
        <LoadingButton
          variant="contained"
          loading={printing}
          disabled={!qr || loading}
          onClick={handlePrint}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        >
          In
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
