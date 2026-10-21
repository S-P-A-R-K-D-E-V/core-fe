'use client';

import type {
  IPaymentSettings,
  IPaymentConnection,
  IPaymentProviderInfo,
} from 'src/types/payment-service';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  getPaymentSettings,
  getPaymentProviders,
  getPaymentConnections,
} from 'src/api/payment-settings';

import { useSnackbar } from 'src/components/snackbar';

import { BankLinkCard } from './bank-link';
import { ConnectionList } from './payment-connection';
import { ApiPayBankLinkCard } from './apipay-bank-link';

// ----------------------------------------------------------------------
// Thanh toán qua S Payment (chỉ Admin), kiểu KiotViet: chủ cửa hàng chỉ đăng ký báo có cho tài khoản (ngân hàng → số TK,
// CCCD / MST, SĐT → OTP); khoá ngân hàng (Client ID, chứng thư, providerId…) do SPARK giữ ở S Payment, không nhập ở đây.
// Bên dưới là các kết nối đang chạy (kể cả kết nối cũ) để xem trạng thái, đồng bộ, tắt / bật. Thu ngân chọn
// "tài khoản · dịch vụ" ở quầy để đối soát.
// ----------------------------------------------------------------------

export default function PaymentConnectionsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [settings, setSettings] = useState<IPaymentSettings | null>(null);
  const [connections, setConnections] = useState<IPaymentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<IPaymentProviderInfo[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getPaymentSettings();
      setSettings(s);
      if (s.enabled) setConnections(await getPaymentConnections());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được cài đặt thanh toán'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const enabled = !!settings?.enabled;

  // Nhãn nhà cung cấp cho danh sách kết nối.
  useEffect(() => {
    if (!enabled || providers.length > 0) return;
    setProvidersError(null);
    getPaymentProviders()
      .then(setProviders)
      .catch((err) =>
        setProvidersError(apiErrorMessage(err, 'Không tải được danh mục nhà cung cấp'))
      );
  }, [enabled, providers.length]);

  const prefix = settings?.paymentCodePrefix || 'SP';

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 5 }}>
        <CircularProgress size={28} aria-label="Đang tải" />
      </Stack>
    );
  }

  if (!enabled) {
    return (
      <Alert severity="info">
        Dịch vụ thanh toán S Payment chưa được bật trên máy chủ. Khi được bật, cửa hàng đăng ký báo
        có cho tài khoản ngân hàng (số tài khoản, CCCD / mã số thuế, SĐT và OTP) để tự xác nhận tiền
        chuyển khoản và đối soát giao dịch. Trong lúc chờ, thanh toán QR vẫn chạy như cũ.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <BankLinkCard onChanged={load} />

      <Card sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Kết nối đang dùng</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Kết nối S Payment dùng để xác nhận chuyển khoản. Tiền chỉ tự khớp khi nội dung chuyển
              khoản có mã thanh toán (bắt đầu bằng &quot;{prefix}&quot;) — giao dịch không có mã nằm
              ở tab Đối soát chờ khớp tay. Khi bán ở quầy, thu ngân chọn &quot;tài khoản
              · dịch vụ&quot;.
            </Typography>
          </Stack>

          {providersError && <Alert severity="warning">{providersError}</Alert>}

          <ConnectionList
            connections={connections}
            providers={providers}
            providersError={providersError}
            showBankAccount
            paymentCodePrefix={prefix}
            emptyText="Chưa có kết nối nào — đăng ký báo có cho tài khoản ở trên."
            onChanged={load}
          />
        </Stack>
      </Card>

      <ApiPayBankLinkCard connections={connections} hideWhenEmpty onChanged={load} />
    </Stack>
  );
}
