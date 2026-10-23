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
import PaymentQrInfo, { useQrImageSrc, useExpirySeconds } from 'src/components/payment-qr-info';
import PaymentConnectionSelect, {
  usePosPaymentConnections,
} from 'src/components/payment-connection-select';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import { qrTarget } from 'src/utils/payment-connection';
import { qrOutcome, isEventForQr, paymentProviderLabel } from 'src/utils/payment-status';
import { usePaymentStatusEvents } from 'src/hooks/use-payment-status-events';
import { getBankAccounts, getVietQRBanks } from 'src/api/bank-accounts';
import { createQrPayment, getQrPaymentStatus, cancelQrPayment } from 'src/api/payment-qr';
import {
  IKiotVietBankAccount,
  IVietQRBank,
  IQrPaymentResponse,
  IQrPaymentStatusResponse,
} from 'src/types/corecms-api';
import { customerDisplay } from 'src/sections/customer-display/customer-display-bus';

// ----------------------------------------------------------------------

type Props = {
  amount: number;
  salesOrderId?: string;
  orderCode?: string;
  onPaymentCompleted?: (qrOrder: IQrPaymentStatusResponse) => void;
};

type QrState = 'idle' | 'loading' | 'active' | 'polling' | 'completed' | 'cancelled' | 'expired' | 'error';

const STATUS_LABELS: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  INIT: { label: 'Chờ thanh toán', color: 'info' },
  PENDING: { label: 'Đang xử lý', color: 'warning' },
  COMPLETED: { label: 'Đã thanh toán', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
  ERRORCORRECTED: { label: 'Đã hoàn', color: 'error' },
  EXPIRED: { label: 'Hết hạn', color: 'default' },
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
  // Nguồn xác nhận chuyển khoản: '' = theo tài khoản (như cũ); kết nối (vd ApiPay — VA) = QR vào tài khoản của kết nối.
  const {
    connections,
    selectionKey,
    connectionId,
    connection,
    setSelectionKey,
    loaded: connectionsLoaded,
    allowBankAccount,
  } = usePosPaymentConnections();

  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  const [qrState, setQrState] = useState<QrState>('idle');
  const [qrOrder, setQrOrder] = useState<IQrPaymentResponse | null>(null);
  const [statusData, setStatusData] = useState<IQrPaymentStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [createdFor, setCreatedFor] = useState<{
    amount: number;
    bankAccountId: string;
    selectionKey: string;
  } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Poll và SignalR có thể cùng báo COMPLETED — chỉ gọi onPaymentCompleted một lần cho mỗi mã.
  const completedQrIdRef = useRef<string | null>(null);

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

  // Trạng thái mới (poll, bấm kiểm tra hoặc SignalR) → cùng một đường xử lý
  const applyStatus = useCallback(
    (status: IQrPaymentStatusResponse) => {
      setStatusData(status);
      const outcome = qrOutcome(status.status);

      if (outcome === 'completed') {
        stopPolling();
        setQrState('completed');
        if (completedQrIdRef.current !== status.id) {
          completedQrIdRef.current = status.id;
          onPaymentCompleted?.(status);
        }
      } else if (outcome === 'cancelled') {
        stopPolling();
        setQrState('cancelled');
      } else if (outcome === 'expired') {
        // Hết hạn: dừng hỏi; tiền về trễ theo mã này vẫn báo qua SignalR (qrOrder giữ nguyên)
        stopPolling();
        setQrState('expired');
      }
      return outcome;
    },
    [stopPolling, onPaymentCompleted]
  );

  const startPolling = useCallback(
    (qrId: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        try {
          const status = await getQrPaymentStatus(qrId);
          if (!mountedRef.current) return;
          applyStatus(status);
        } catch (err) {
          console.error('QR status poll error:', err);
        }
      }, POLL_INTERVAL);
    },
    [stopPolling, applyStatus]
  );

  // Tạo / tạo lại QR — "phiên kiểm tra QR" (PaymentQrOrder) để OpsBridge report lên cập nhật trạng thái
  const handleGenerateQr = useCallback(async () => {
    if (debouncedAmount <= 0 || (!selectedAccountId && !connectionId)) return;

    setQrState((prev) =>
      prev === 'idle' || prev === 'error' || prev === 'cancelled' || prev === 'expired' ? 'loading' : prev
    );
    setError('');

    try {
      const result = await createQrPayment({
        salesOrderId,
        // Theo kết nối: QR vào tài khoản / VA của kết nối; tài khoản chỉ gửi khi kết nối trùng tài khoản của cửa hàng.
        ...qrTarget(connectionId, connection ? connection.bankAccountId : selectedAccountId),
        amount: debouncedAmount,
        description: orderCode ? `Thanh toan ${orderCode}` : undefined,
      });
      if (!mountedRef.current) return;

      setQrOrder(result);
      setStatusData(null);
      setCreatedFor({ amount: debouncedAmount, bankAccountId: selectedAccountId, selectionKey });
      setQrState('active');
      startPolling(result.id);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setQrState('error');
      // Đổi nguồn xác nhận mà mã mới lỗi: bỏ mã đang hiện — mã đó không thuộc nguồn đang chọn, thu ngân dễ nhầm.
      if (createdFor && createdFor.selectionKey !== selectionKey) {
        stopPolling();
        setQrOrder(null);
        setStatusData(null);
        setCreatedFor(null);
      }
      setError(apiErrorMessage(err, 'Không thể tạo mã QR. Vui lòng thử lại.'));
    }
  }, [
    debouncedAmount,
    selectedAccountId,
    connectionId,
    selectionKey,
    connection,
    createdFor,
    salesOrderId,
    orderCode,
    startPolling,
    stopPolling,
  ]);

  // Tự tạo QR khi mới vào / tự tạo lại khi amount (đã debounce), tài khoản hoặc nguồn xác nhận thay đổi. Chờ tải xong
  // danh sách kết nối — tránh tạo mã theo tài khoản rồi lại đổi sang kết nối thu ngân đã chọn lần trước.
  useEffect(() => {
    if (!connectionsLoaded) return;
    if (debouncedAmount <= 0 || (!selectedAccountId && !connectionId)) return;
    if (qrState === 'completed') return; // đã thanh toán — không tự tạo lại
    if (
      createdFor &&
      createdFor.amount === debouncedAmount &&
      createdFor.bankAccountId === selectedAccountId &&
      createdFor.selectionKey === selectionKey
    )
      return;
    handleGenerateQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAmount, selectedAccountId, selectionKey, connectionsLoaded]);

  const handleCheckPayment = useCallback(async () => {
    if (!qrOrder) return;
    setQrState('polling');
    try {
      const status = await getQrPaymentStatus(qrOrder.id);
      if (!mountedRef.current) return;
      if (applyStatus(status) === 'pending') setQrState('active');
    } catch {
      if (!mountedRef.current) return;
      setQrState('active');
      setError('Không thể kiểm tra trạng thái. Vui lòng thử lại.');
    }
  }, [qrOrder, applyStatus]);

  // SignalR PaymentStatusChanged của mã đang hiện: hỏi lại máy chủ để có đủ dữ liệu như khi poll; máy chủ chưa kịp
  // đổi trạng thái hoặc lỗi mạng → dùng trạng thái của sự kiện. Polling 4 s vẫn chạy làm dự phòng.
  usePaymentStatusEvents((event) => {
    if (!qrOrder || !isEventForQr(event, qrOrder.id) || qrState === 'completed') return;
    const base: IQrPaymentStatusResponse = statusData ?? { ...qrOrder, updatedAt: qrOrder.createdAt };
    const fromEvent = (data: IQrPaymentStatusResponse): IQrPaymentStatusResponse => ({
      ...data,
      status: event.status,
      amountReceived: event.amountReceived,
      paymentCode: event.paymentCode ?? data.paymentCode,
      updatedAt: new Date().toISOString(),
    });
    getQrPaymentStatus(qrOrder.id)
      .then((status) => {
        if (!mountedRef.current) return;
        const fetched = qrOutcome(status.status);
        applyStatus(fetched !== 'pending' || fetched === qrOutcome(event.status) ? status : fromEvent(status));
      })
      .catch(() => {
        if (mountedRef.current) applyStatus(fromEvent(base));
      });
  });

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

  // QR hết hạn → bỏ mã cũ khỏi màn rồi tạo mã mới (cùng số tiền / tài khoản)
  const handleRenewExpired = useCallback(() => {
    setQrOrder(null);
    setStatusData(null);
    handleGenerateQr();
  }, [handleGenerateQr]);

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

  const qrImageSrc = useQrImageSrc(qrOrder?.qrDataUrl, qrOrder?.qrPayload);
  const paymentCode = statusData?.paymentCode ?? qrOrder?.paymentCode;
  const secondsLeft = useExpirySeconds(
    qrState === 'active' || qrState === 'polling' ? statusData?.expiresAt ?? qrOrder?.expiresAt : null
  );
  const amountReceived = statusData?.amountReceived ?? 0;
  const expectedAmount = statusData?.amount ?? qrOrder?.amount ?? amount;

  // Màn hình khách: QR lớn cho khách quét trên màn phụ; nhận đủ tiền → "Cảm ơn quý khách".
  const qrShowing = (qrState === 'active' || qrState === 'polling') && !!qrImageSrc;
  const qrExpiresAt = statusData?.expiresAt ?? qrOrder?.expiresAt ?? null;
  useEffect(() => {
    if (qrShowing && qrImageSrc) {
      customerDisplay.setQr({
        amount: expectedAmount,
        imageSrc: qrImageSrc,
        bankName: qrOrder?.bankName ?? null,
        accountNumber: qrOrder?.accountNumber ?? null,
        paymentCode: paymentCode ?? null,
        expiresAt: qrExpiresAt,
      });
    } else if (qrState === 'completed') {
      customerDisplay.paid(amountReceived || expectedAmount);
    } else {
      customerDisplay.setQr(null);
    }
  }, [qrShowing, qrImageSrc, qrState, expectedAmount, qrOrder?.bankName, qrOrder?.accountNumber, paymentCode, qrExpiresAt, amountReceived]);
  useEffect(() => () => customerDisplay.setQr(null), []);

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

  // Chọn kết nối thì QR vào tài khoản của kết nối — ô tài khoản không còn tác dụng, ẩn đi.
  const sourceSelectors = (
    <>
      <PaymentConnectionSelect
        connections={connections}
        value={selectionKey}
        onChange={setSelectionKey}
        disabled={qrState === 'completed'}
        allowBankAccount={allowBankAccount}
      />
      {!connection && allowBankAccount && bankAccounts.length > 0 && bankSelector}
    </>
  );

  // Kết nối của mã đang hiện (mã tạo theo kết nối) — để ghi "xác nhận qua ApiPay" dưới QR.
  const qrConnection = qrOrder?.connectionId
    ? (connection?.id === qrOrder.connectionId
        ? connection
        : connections.find((c) => c.id === qrOrder.connectionId))
    : undefined;

  if (accountsLoading || !connectionsLoaded) {
    return (
      <Stack alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (bankAccounts.length === 0 && connections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Chưa có tài khoản ngân hàng. Vui lòng cấu hình trong KiotViet.
      </Typography>
    );
  }

  // Chủ cửa hàng tắt VietQR theo tài khoản cho quầy mà chưa bật nguồn chuyển khoản nào qua kết nối.
  if (!allowBankAccount && connections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Chưa bật nguồn chuyển khoản cho quầy — chủ cửa hàng bật ở Thanh toán → Cài đặt → Phương thức theo kênh.
      </Typography>
    );
  }

  // Có kết nối nhưng chưa khai tài khoản ngân hàng, đang để "theo tài khoản"
  if (!connection && bankAccounts.length === 0) {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {sourceSelectors}
        <Typography variant="body2" color="text.secondary">
          Chưa có tài khoản ngân hàng — chọn nguồn xác nhận chuyển khoản ở trên để tạo mã QR.
        </Typography>
      </Stack>
    );
  }

  // Lỗi (chưa từng tạo được QR nào)
  if (qrState === 'error' && !qrOrder) {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {sourceSelectors}
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
        {sourceSelectors}
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
        {sourceSelectors}
        <Alert severity="warning">Mã QR đã bị hủy.</Alert>
        <Button variant="contained" onClick={handleGenerateQr}>
          Tạo mã QR mới
        </Button>
      </Stack>
    );
  }

  // Expired (chỉ khi bật dịch vụ thanh toán)
  if (qrState === 'expired') {
    return (
      <Stack spacing={1.5} sx={{ py: 1 }}>
        {sourceSelectors}
        <Alert severity="warning">
          Mã QR đã hết hạn{paymentCode ? ` (${paymentCode})` : ''}. Tạo mã mới để khách chuyển khoản.
        </Alert>
        <Button variant="contained" onClick={handleRenewExpired}>
          Tạo mã QR mới
        </Button>
      </Stack>
    );
  }

  // Active / Polling — có QR để hiện (kể cả đang regenerate ngầm)
  return (
    <Stack spacing={1.5} sx={{ py: 1 }}>
      {sourceSelectors}

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

        {qrImageSrc && (
          <Box
            component="img"
            src={qrImageSrc}
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

        {qrConnection && (
          <Typography variant="caption" color="text.secondary">
            Tiền về qua {paymentProviderLabel(qrConnection.provider)} là đơn tự xác nhận
            {qrConnection.environment === 'test' ? ' (thử nghiệm)' : ''}
          </Typography>
        )}

        <PaymentQrInfo paymentCode={paymentCode} secondsLeft={secondsLeft} />

        {amountReceived > 0 && amountReceived < expectedAmount && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            Đã nhận {fCurrency(amountReceived)} / {fCurrency(expectedAmount)} — khách chuyển thiếu.
          </Alert>
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
