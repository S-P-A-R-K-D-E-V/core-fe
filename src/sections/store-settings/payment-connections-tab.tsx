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
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import { getBankAccounts } from 'src/api/bank-accounts';
import {
  getPaymentSettings,
  getPaymentProviders,
  getPaymentConnections,
} from 'src/api/payment-settings';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { ApiPayBankLinkCard } from './apipay-bank-link';
import { normalizeBankAccount, bankAccountOptionLabel } from './bank-account/utils';
import {
  ConnectionList,
  ConnectionWizardDialog,
  ConnectionResultDialog,
  type BankAccountOption,
} from './payment-connection';

// ----------------------------------------------------------------------
// Kết nối thanh toán qua S Payment (chỉ Admin): mọi kết nối của cửa hàng — ngân hàng trực tiếp (ACB / BIDV / MB /
// VietinBank), bên thứ ba đọc biến động số dư (ApiPay / SePay / Casso), cổng thanh toán (payOS / VNPay). Thêm kết nối
// theo trình hướng dẫn 3 bước (dịch vụ → tài khoản nhận → thông tin kết nối); cập nhật dùng form dựng từ danh mục
// (GET payment/settings/providers). Thu ngân chọn "tài khoản · dịch vụ" ở quầy để đối soát.
// ----------------------------------------------------------------------

export default function PaymentConnectionsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [settings, setSettings] = useState<IPaymentSettings | null>(null);
  const [connections, setConnections] = useState<IPaymentConnection[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<IPaymentProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [created, setCreated] = useState<IPaymentConnection | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getPaymentSettings();
      setSettings(s);
      if (s.enabled) {
        const [list, accounts] = await Promise.all([
          getPaymentConnections(),
          getBankAccounts().catch(() => []),
        ]);
        setConnections(list);
        setBankAccounts(
          accounts.map((raw) => {
            const a = normalizeBankAccount(raw);
            return {
              id: a.id,
              label: bankAccountOptionLabel(a),
              bin: a.bin,
              accountNumber: a.accountNumber,
            };
          })
        );
      }
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

  useEffect(() => {
    if (!enabled || providers.length > 0) return;
    setProvidersLoading(true);
    setProvidersError(null);
    getPaymentProviders()
      .then(setProviders)
      .catch((err) =>
        setProvidersError(apiErrorMessage(err, 'Không tải được danh mục nhà cung cấp'))
      )
      .finally(() => setProvidersLoading(false));
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
        Dịch vụ thanh toán S Payment chưa được bật trên máy chủ. Khi được bật, cửa hàng có thể kết
        nối ngân hàng trực tiếp (ACB, BIDV, MB, VietinBank), ApiPay, SePay, Casso, payOS hoặc VNPay
        để tự xác nhận tiền chuyển khoản và đối soát giao dịch. Trong lúc chờ, thanh toán QR vẫn
        chạy như cũ.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'flex-start' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6">Kết nối thanh toán qua S Payment</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Chọn dịch vụ (ngân hàng trực tiếp, ApiPay / SePay / Casso, cổng thanh toán), gắn tài
                khoản nhận và điền thông tin kết nối — S Payment báo tiền về và tự đối soát. Khi bán ở
                quầy, thu ngân chọn &quot;tài khoản · dịch vụ&quot; để xác nhận chuyển khoản. Tiền chỉ
                tự khớp khi nội dung chuyển khoản có mã thanh toán (bắt đầu bằng &quot;{prefix}&quot;)
                — giao dịch không có mã nằm ở màn Đối soát thanh toán chờ khớp tay.
              </Typography>
            </Stack>
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setAddOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              Thêm kết nối
            </Button>
          </Stack>

          {providersError && <Alert severity="warning">{providersError}</Alert>}

          <ConnectionList
            connections={connections}
            providers={providers}
            providersLoading={providersLoading}
            providersError={providersError}
            showBankAccount
            allowBankAccountChange
            bankAccounts={bankAccounts}
            paymentCodePrefix={prefix}
            emptyText="Chưa có kết nối nào."
            onChanged={load}
          />
        </Stack>
      </Card>

      <ApiPayBankLinkCard connections={connections} onChanged={load} />

      <ConnectionWizardDialog
        open={addOpen}
        providers={providers}
        providersLoading={providersLoading}
        providersError={providersError}
        bankAccounts={bankAccounts}
        onBankAccountsChanged={load}
        onClose={() => setAddOpen(false)}
        onSaved={(c) => {
          setAddOpen(false);
          setCreated(c);
          load();
        }}
      />

      <ConnectionResultDialog
        connection={created}
        providers={providers}
        reason="created"
        paymentCodePrefix={prefix}
        onClose={() => setCreated(null)}
      />
    </Stack>
  );
}
