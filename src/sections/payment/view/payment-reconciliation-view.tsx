'use client';

import type { IReconciliationSummary } from 'src/types/payment-service';

import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { toDateStr } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { getReconciliationSummary } from 'src/api/payment-reconciliation';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import { AppDatePicker } from 'src/components/date-time-picker';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import BankTxnPanel from '../bank-txn-panel';
import PaymentIntentPanel from '../payment-intent-panel';

// ----------------------------------------------------------------------
// Đối soát thanh toán: giao dịch tiền vào (SePay/Casso/cổng) ↔ thanh toán (mã QR, đơn online). Giao dịch không có mã
// thanh toán không tự khớp theo số tiền — nằm ở "Chưa khớp" chờ khớp tay hoặc bỏ qua.
// ----------------------------------------------------------------------

type SummaryCardProps = {
  title: string;
  value: string;
  caption?: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'info';
};

function SummaryCard({ title, value, caption, icon, color }: SummaryCardProps) {
  return (
    <Card sx={{ p: 2.5, height: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Iconify icon={icon} width={40} sx={{ color: `${color}.main`, flexShrink: 0 }} />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
          <Typography variant="h5" noWrap>
            {value}
          </Typography>
          {caption && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {caption}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

export default function PaymentReconciliationView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const today = toDateStr(new Date());

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [view, setView] = useState<'transactions' | 'intents'>('transactions');
  const [summary, setSummary] = useState<IReconciliationSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    if (!from || !to) return;
    try {
      setSummary(await getReconciliationSummary({ from, to }));
    } catch (err) {
      setSummary(null);
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được tổng hợp đối soát'), { variant: 'error' });
    }
  }, [from, to, enqueueSnackbar]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  const tx = summary?.transactions;
  const it = summary?.intents;

  return (
    <RoleBasedGuard hasContent roles={['Admin', 'Manager']}>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Đối soát thanh toán"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Đối soát thanh toán' }]}
          action={
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Làm mới
            </Button>
          }
          sx={{ mb: 3 }}
        />

        <Card sx={{ p: 2.5, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AppDatePicker label="Từ ngày" value={from} onChange={setFrom} maxDate={to} size="small" />
            <AppDatePicker label="Đến ngày" value={to} onChange={setTo} minDate={from} size="small" />
          </Stack>
        </Card>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard
              title="Tiền vào"
              value={tx ? fCurrency(tx.amountIn) : '—'}
              caption={tx ? `${tx.total} giao dịch` : undefined}
              icon="solar:card-recive-bold-duotone"
              color="primary"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard
              title="Đã khớp"
              value={tx ? fCurrency(tx.amountMatched) : '—'}
              caption={tx ? `${tx.matched} giao dịch · ${tx.ignored} bỏ qua` : undefined}
              icon="solar:check-circle-bold-duotone"
              color="success"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard
              title="Chưa khớp"
              value={tx ? fCurrency(tx.amountUnmatched) : '—'}
              caption={tx ? `${tx.unmatched} giao dịch cần xử lý` : undefined}
              icon="solar:danger-triangle-bold-duotone"
              color="warning"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard
              title="Thanh toán đã nhận"
              value={it ? fCurrency(it.amountPaid) : '—'}
              caption={
                it
                  ? `${it.paid}/${it.total} đã trả · ${it.pending} chờ · ${it.partiallyPaid} trả thiếu · ${it.expired} hết hạn`
                  : undefined
              }
              icon="solar:wallet-money-bold-duotone"
              color="info"
            />
          </Grid>
        </Grid>

        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ mb: 2 }}>
          <Tab value="transactions" label="Giao dịch ngân hàng" icon={<Iconify icon="solar:card-transfer-bold" />} />
          <Tab value="intents" label="Thanh toán" icon={<Iconify icon="solar:bill-list-bold" />} />
        </Tabs>

        {view === 'transactions' ? (
          <BankTxnPanel
            from={from}
            to={to}
            summary={summary}
            refreshKey={refreshKey}
            onChanged={loadSummary}
          />
        ) : (
          <PaymentIntentPanel from={from} to={to} refreshKey={refreshKey} />
        )}
      </Container>
    </RoleBasedGuard>
  );
}
