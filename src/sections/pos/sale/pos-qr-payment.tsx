'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';
import { getBankAccounts, getVietQRBanks } from 'src/api/bank-accounts';
import { createQrPayment, getQrPaymentStatus, cancelQrPayment } from 'src/api/payment-qr';
import {
  IKiotVietBankAccount,
  IVietQRBank,
  IQrPaymentResponse,
  IQrPaymentStatusResponse,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  amount: number;
  salesOrderId?: string;
  orderCode?: string;
  onPaymentCompleted?: (qrOrder: IQrPaymentStatusResponse) => void;
};

type QrState = 'idle' | 'loading' | 'active' | 'polling' | 'completed' | 'cancelled' | 'error';

const STATUS_LABELS: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  INIT: { label: 'Chờ thanh toán', color: 'info' },
  PENDING: { label: 'Đang xử lý', color: 'warning' },
  COMPLETED: { label: 'Đã thanh toán', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
  ERRORCORRECTED: { label: 'Đã hoàn', color: 'error' },
};

const POLL_INTERVAL = 4000; // 4 giây — đồng bộ trạng thái từ OpsBridge report lên
const DEBOUNCE_MS = 1000; // giỏ hàng đổi giá/SL/sản phẩm → chờ 1s mới tạo lại QR

// ----------------------------------------------------------------------

export default function PosQrPayment({ amount, salesOrderId, orderCode, onPaymentCompleted }: Props) {
  const theme = useTheme();

  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [vietQRBanks, setVietQRBanks] = useState<IVietQRBank[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  const [qrState, setQrState] = useState<QrState>('idle');
  const [qrOrder, setQrOrder] = useState<IQrPaymentResponse | null>(null);
  const [statusData, setStatusData] = useState<IQrPaymentStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [createdFor, setCreatedFor] = useState<{ amount: number; bankAccountId: string } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Tải danh sách tài khoản ngân hàng + logo VietQR
  useEffect(() => {
    Promise.all([getBankAccounts(), getVietQRBanks()])
      .then(([accounts, banks]) => {
        if (!mountedRef.current) return;
        setBankAccounts(accounts);
        setVietQRBanks(banks);
        if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
      })
      .catch(() => {
        if (mountedRef.current) setError('Không tải được danh sách tài khoản ngân hàng.');
      })
      .finally(() => {
        if (mountedRef.current) setAccountsLoading(false);
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Debounce 1s trước khi tạo lại QR — giỏ hàng đổi giá/SL/sản phẩm đổi amount liên tục
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedAmount(amount), DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [amount]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (qrId: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        try {
          const status = await getQrPaymentStatus(qrId);
          if (!mountedRef.current) return;
          setStatusData(status);

          if (status.status === 'COMPLETED') {
            stopPolling();
            setQrState('completed');
            onPaymentCompleted?.(status);
          } else if (status.status === 'CANCELLED' || status.status === 'ERRORCORRECTED') {
            stopPolling();
            setQrState('cancelled');
          }
        } catch (err) {
          console.error('QR status poll error:', err);
        }
      }, POLL_INTERVAL);
    },
    [stopPolling, onPaymentCompleted]
  );

  // Tạo / tạo lại QR — "phiên kiểm tra QR" (PaymentQrOrder) để OpsBridge report lên cập nhật trạng thái
  const handleGenerateQr = useCallback(async () => {
    if (debouncedAmount <= 0 || !selectedAccountId) return;

    setQrState((prev) => (prev === 'idle' || prev === 'error' || prev === 'cancelled' ? 'loading' : prev));
    setError('');

    try {
      const result = await createQrPayment({
        salesOrderId,
        bankAccountId: selectedAccountId,
        amount: debouncedAmount,
        description: orderCode ? `Thanh toan ${orderCode}` : undefined,
      });
      if (!mountedRef.current) return;

      setQrOrder(result);
      setStatusData(null);
      setCreatedFor({ amount: debouncedAmount, bankAccountId: selectedAccountId });
      setQrState('active');
      startPolling(result.id);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setQrState('error');
      setError(err?.detail || err?.title || err?.message || 'Không thể tạo mã QR. Vui lòng thử lại.');
    }
  }, [debouncedAmount, selectedAccountId, salesOrderId, orderCode, startPolling]);

  // Tự tạo QR khi mới vào / tự tạo lại khi amount (đã debounce) hoặc tài khoản thay đổi
  useEffect(() => {
    if (debouncedAmount <= 0 || !selectedAccountId) return;
    if (qrState === 'completed') return; // đã thanh toán — không tự tạo lại
    if (createdFor && createdFor.amount === debouncedAmount && createdFor.bankAccountId === selectedAccountId) return;
    handleGenerateQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAmount, selectedAccountId]);

  const handleCheckPayment = useCallback(async () => {
    if (!qrOrder) return;
    setQrState('polling');
    try {
      const status = await getQrPaymentStatus(qrOrder.id);
      if (!mountedRef.current) return;
      setStatusData(status);

      if (status.status === 'COMPLETED') {
        stopPolling();
        setQrState('completed');
        onPaymentCompleted?.(status);
      } else if (status.status === 'CANCELLED' || status.status === 'ERRORCORRECTED') {
        stopPolling();
        setQrState('cancelled');
      } else {
        setQrState('active');
      }
    } catch {
      if (!mountedRef.current) return;
      setQrState('active');
      setError('Không thể kiểm tra trạng thái. Vui lòng thử lại.');
    }
  }, [qrOrder, stopPolling, onPaymentCompleted]);

  const handleCancelQr = useCallback(async () => {
    if (!qrOrder) return;
    stopPolling();
    try {
      await cancelQrPayment(qrOrder.id);
    } catch {
      // Ignore — có thể đã thanh toán trước khi kịp huỷ
    }
    setQrOrder(null);
    setStatusData(null);
    setCreatedFor(null);
    setQrState('cancelled');
  }, [qrOrder, stopPolling]);

  // Đang trong khung debounce hoặc đang gọi API tạo lại — vẫn giữ QR cũ hiển thị, chỉ báo nhẹ
  const isRegenerating =
    (amount !== debouncedAmount || qrState === 'loading') && qrOrder !== null && qrState !== 'completed';

  const options = useMemo(
    () =>
      bankAccounts.map((acc) => {
        const logo = vietQRBanks.find(
          (b) =>
            (acc.bin && b.bin === acc.bin) ||
            (acc.code && b.code.toLowerCase() === acc.code.toLowerCase())
        )?.logo;
        return { ...acc, logo };
      }),
    [bankAccounts, vietQRBanks]
  );

  const currentStatus = statusData?.status || qrOrder?.status || '';
  const statusInfo = STATUS_LABELS[currentStatus] || { label: currentStatus, color: 'default' as const };

  const bankSelector = (
    <TextField
      select
      fullWidth
      size="small"
      label="Tài khoản ngân hàng"
      value={selectedAccountId}
      onChange={(e) => setSelectedAccountId(e.target.value)}
      disabled={qrState === 'completed'}
    >
      {options.map((acc) => (
        <MenuItem key={acc.id} value={acc.id}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
            {acc.logo ? (
              <Box component="img" src={acc.logo} alt={acc.shortName} sx={{ width: 20, height: 20, borderRadius: 0.5 }} />
            ) : (
              <Iconify icon="solar:card-bold" width={16} />
            )}
            <span>
              {acc.shortName || acc.bankName || acc.code} - {acc.accountNumber}
            </span>
          </Stack>
        </MenuItem>
      ))}
    </TextField>
  );

  if (accountsLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Chưa có tài khoản ngân hàng. Vui lòng cấu hình trong KiotViet.
      </Typography>
    );
  }

  // Lỗi (chưa từng tạo được QR nào)
  if (qrState === 'error' && !qrOrder) {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {bankSelector}
        <Alert severity="error">{error}</Alert>
        <Button variant="outlined" onClick={handleGenerateQr}>
          Thử lại
        </Button>
      </Stack>
    );
  }

  // Loading lần đầu (chưa có QR nào để hiện tạm)
  if (qrState === 'loading' && !qrOrder) {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {bankSelector}
        <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Đang tạo mã QR...
          </Typography>
        </Stack>
      </Stack>
    );
  }

  // Completed
  if (qrState === 'completed') {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.success.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Iconify icon="eva:checkmark-circle-2-fill" width={36} sx={{ color: 'success.main' }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={700} color="success.main">
          Thanh toán thành công!
        </Typography>
        <Typography variant="h5" fontWeight={700}>
          {fCurrency(statusData?.amount || amount)}
        </Typography>
      </Stack>
    );
  }

  // Cancelled
  if (qrState === 'cancelled') {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {bankSelector}
        <Alert severity="warning">Mã QR đã bị hủy.</Alert>
        <Button variant="contained" onClick={handleGenerateQr}>
          Tạo mã QR mới
        </Button>
      </Stack>
    );
  }

  // Active / Polling — có QR để hiện (kể cả đang regenerate ngầm)
  return (
    <Stack spacing={1.5} sx={{ py: 1 }}>
      {bankSelector}

      <Stack alignItems="center" spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            label={statusInfo.label}
            color={statusInfo.color}
            size="small"
            icon={qrState === 'polling' ? <CircularProgress size={14} color="inherit" /> : undefined}
          />
          {isRegenerating && (
            <Chip
              label="Đang cập nhật QR..."
              size="small"
              variant="outlined"
              icon={<CircularProgress size={12} color="inherit" />}
            />
          )}
        </Stack>

        <Typography variant="h4" fontWeight={800} color="primary.main">
          {fCurrency(amount)}
        </Typography>

        {qrOrder?.qrDataUrl && (
          <Box
            component="img"
            src={qrOrder.qrDataUrl}
            alt="QR Code thanh toán"
            sx={{
              width: 240,
              height: 240,
              borderRadius: 1.5,
              border: `2px solid ${theme.palette.primary.main}`,
              p: 0.5,
              bgcolor: 'white',
              opacity: isRegenerating ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          />
        )}

        {(qrOrder?.bankName || qrOrder?.accountNumber) && (
          <Typography variant="caption" color="text.secondary">
            {qrOrder.bankName} - {qrOrder.accountNumber}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="info"
            size="small"
            startIcon={
              qrState === 'polling' ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:refresh-bold" />
            }
            onClick={handleCheckPayment}
            disabled={qrState === 'polling'}
          >
            Kiểm tra thanh toán
          </Button>

          <Tooltip title="Hủy QR">
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Iconify icon="solar:close-circle-bold" />}
              onClick={handleCancelQr}
            >
              Hủy
            </Button>
          </Tooltip>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Tự động kiểm tra mỗi {POLL_INTERVAL / 1000}s
        </Typography>
      </Stack>
    </Stack>
  );
}
