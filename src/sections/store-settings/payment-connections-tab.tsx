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

import { normalizeBankAccount, bankAccountOptionLabel } from './bank-account/utils';
import {
  ConnectionList,
  ConnectionFormDialog,
  ConnectionResultDialog,
  type BankAccountOption,
} from './payment-connection';

// ----------------------------------------------------------------------
// Kết nối thanh toán (chỉ Admin): mọi kết nối của cửa hàng — SePay / Casso đọc biến động số dư, payOS / VNPay là cổng
// thanh toán, ACB / BIDV / MB là ngân hàng trực tiếp. Form tạo / cập nhật dựng từ danh mục nhà cung cấp
// (GET payment/settings/providers); thao tác trên từng kết nối dùng chung với tab Tài khoản ngân hàng.
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
            return { id: a.id, label: bankAccountOptionLabel(a), bin: a.bin };
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
        Dịch vụ thanh toán chưa được bật trên máy chủ. Khi được bật, cửa hàng có thể kết nối SePay,
        Casso, payOS, VNPay hoặc ngân hàng trực tiếp để tự xác nhận tiền chuyển khoản và đối soát
        giao dịch. Trong lúc chờ, thanh toán QR vẫn chạy như cũ.
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
              <Typography variant="h6">Kết nối thanh toán</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                SePay / Casso và ngân hàng trực tiếp báo tiền vào tài khoản ngân hàng của cửa hàng;
                payOS / VNPay là cổng thanh toán cho đơn online. Tiền chỉ tự khớp khi nội dung
                chuyển khoản có mã thanh toán (bắt đầu bằng &quot;{prefix}&quot;) — giao dịch không
                có mã nằm ở màn Đối soát thanh toán chờ khớp tay.
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

      <ConnectionFormDialog
        open={addOpen}
        mode="create"
        providers={providers}
        providersLoading={providersLoading}
        providersError={providersError}
        bankAccounts={bankAccounts}
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
