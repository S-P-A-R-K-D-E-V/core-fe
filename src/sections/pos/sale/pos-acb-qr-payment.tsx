'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';
import { createQrPayment, getQrPaymentStatus, cancelQrPayment } from 'src/api/payment-qr';
import { IQrPaymentResponse, IQrPaymentStatusResponse } from 'src/types/corecms-api';

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

const POLL_INTERVAL = 4000; // 4 seconds

// ----------------------------------------------------------------------

export default function PosAcbQrPayment({
  amount,
  salesOrderId,
  orderCode,
  onPaymentCompleted,
}: Props) {
  const theme = useTheme();

  const [qrState, setQrState] = useState<QrState>('idle');
  const [qrOrder, setQrOrder] = useState<IQrPaymentResponse | null>(null);
  const [statusData, setStatusData] = useState<IQrPaymentStatusResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [lastAmount, setLastAmount] = useState<number>(0);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Start polling for payment status
  const startPolling = useCallback(
    (qrId: string) => {
      stopPolling();
      setQrState('active');

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

  // Generate QR
  const handleGenerateQr = useCallback(async () => {
    if (amount <= 0) return;

    setQrState('loading');
    setError('');

    try {
      const result = await createQrPayment({
        salesOrderId,
        amount,
        description: orderCode ? `Thanh toan ${orderCode}` : undefined,
      });

      if (!mountedRef.current) return;

      setQrOrder(result);
      setLastAmount(amount);
      setStatusData(null);
      startPolling(result.id);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setQrState('error');
      setError(err?.message || err?.title || 'Không thể tạo mã QR. Vui lòng thử lại.');
    }
  }, [amount, salesOrderId, orderCode, startPolling]);

  // Manual check payment
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
    } catch (err: any) {
      if (!mountedRef.current) return;
      setQrState('active');
      setError('Không thể kiểm tra trạng thái. Vui lòng thử lại.');
    }
  }, [qrOrder, stopPolling, onPaymentCompleted]);

  // Cancel QR — use 'cancelled' state to prevent auto-regenerate
  const handleCancelQr = useCallback(async () => {
    if (!qrOrder) return;
    stopPolling();
    try {
      await cancelQrPayment(qrOrder.id);
    } catch (err) {
      // Ignore cancel errors — might already be paid
    }
    setQrOrder(null);
    setStatusData(null);
    setQrState('cancelled');
  }, [qrOrder, stopPolling]);

  // Auto-generate when idle and amount > 0 (initial mount or after amount-change reset)
  useEffect(() => {
    if (amount > 0 && qrState === 'idle') {
      handleGenerateQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, qrState]);

  // Auto re-generate when amount changes while QR is active
  useEffect(() => {
    if (
      qrOrder &&
      amount > 0 &&
      amount !== lastAmount &&
      qrState === 'active'
    ) {
      // Cancel old QR silently, reset to idle → auto-generate effect will fire
      stopPolling();
      cancelQrPayment(qrOrder.id).catch(() => {});
      setQrOrder(null);
      setStatusData(null);
      setQrState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // Current display status
  const currentStatus = statusData?.status || qrOrder?.status || '';
  const statusInfo = STATUS_LABELS[currentStatus] || { label: currentStatus, color: 'default' as const };

  // ===== RENDER =====

  // Idle — show Generate button
  if (qrState === 'idle') {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
        <Iconify
          icon="solar:qr-code-bold-duotone"
          width={48}
          sx={{ color: theme.palette.primary.main, opacity: 0.7 }}
        />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Tạo mã QR động ACB
        </Typography>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          {fCurrency(amount)}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:qr-code-bold" />}
          onClick={handleGenerateQr}
          disabled={amount <= 0}
          sx={{ borderRadius: 1.5 }}
        >
          Tạo mã QR
        </Button>
      </Stack>
    );
  }

  // Loading
  if (qrState === 'loading') {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Đang tạo mã QR...
        </Typography>
      </Stack>
    );
  }

  // Error
  if (qrState === 'error') {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={handleGenerateQr}>
          Thử lại
        </Button>
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
        {statusData?.traceNumber && (
          <Typography variant="caption" color="text.secondary">
            Mã GD: {statusData.traceNumber}
          </Typography>
        )}
      </Stack>
    );
  }

  // Cancelled
  if (qrState === 'cancelled') {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
        <Alert severity="warning" sx={{ width: '100%' }}>
          Mã QR đã bị hủy hoặc hoàn tiền.
        </Alert>
        <Button variant="contained" onClick={handleGenerateQr}>
          Tạo mã QR mới
        </Button>
      </Stack>
    );
  }

  // Active — showing QR code with polling
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 1 }}>
      {/* Status chip */}
      <Chip
        label={statusInfo.label}
        color={statusInfo.color}
        size="small"
        icon={
          qrState === 'polling' ? (
            <CircularProgress size={14} color="inherit" />
          ) : undefined
        }
      />

      {/* Amount (bold, large) */}
      <Typography variant="h4" fontWeight={800} color="error.main">
        {fCurrency(amount)}
      </Typography>

      {/* Warning text (ACB requirement) */}
      <Typography
        variant="caption"
        color="warning.main"
        textAlign="center"
        sx={{ fontStyle: 'italic', px: 2 }}
      >
        Quý khách vui lòng kiểm tra thông tin thanh toán trước khi thực hiện giao dịch
      </Typography>

      {/* QR Image */}
      {qrOrder?.qrDataUrl && (
        <Box
          component="img"
          src={qrOrder.qrDataUrl}
          alt="QR Code ACB"
          sx={{
            width: 240,
            height: 240,
            borderRadius: 1.5,
            border: `2px solid ${theme.palette.primary.main}`,
            p: 0.5,
            bgcolor: 'white',
          }}
        />
      )}

      {/* Info */}
      {qrOrder?.virtualAccount && (
        <Typography variant="caption" color="text.secondary">
          VA: {qrOrder.virtualAccount}
        </Typography>
      )}

      {/* Amount changed warning */}
      {amount !== lastAmount && amount > 0 && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          Số tiền đã thay đổi ({fCurrency(lastAmount)} → {fCurrency(amount)}).
          <Button size="small" onClick={handleGenerateQr} sx={{ ml: 1 }}>
            Tạo QR mới
          </Button>
        </Alert>
      )}

      {/* Action buttons */}
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="info"
          size="small"
          startIcon={
            qrState === 'polling' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Iconify icon="solar:refresh-bold" />
            )
          }
          onClick={handleCheckPayment}
          disabled={qrState === 'polling'}
        >
          Kiểm tra thanh toán
        </Button>

        <Tooltip title="Hủy QR và tạo lại">
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

      {/* Auto-polling indicator */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'success.main',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.3 },
              '100%': { opacity: 1 },
            },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Tự động kiểm tra mỗi {POLL_INTERVAL / 1000}s
        </Typography>
      </Stack>
    </Stack>
  );
}
