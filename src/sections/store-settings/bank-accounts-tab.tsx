'use client';

import type { IVietQRBank } from 'src/types/corecms-api';
import type {
  IPaymentConnection,
  IPaymentProviderInfo,
  IBankAccountWithConnections,
} from 'src/types/payment-service';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { getStoreBranding } from 'src/api/store-settings';
import {
  getPaymentSettings,
  getPaymentProviders,
  getPaymentBankAccounts,
} from 'src/api/payment-settings';
import {
  getVietQRBanks,
  getBankAccounts,
  updateBankAccount,
  deactivateBankAccount,
} from 'src/api/bank-accounts';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { ApiPayBankLinkCard } from './apipay-bank-link';
import BankAccountFormDialog from './bank-account/bank-account-form-dialog';
import BankAccountVietQrDialog from './bank-account/bank-account-vietqr-dialog';
import {
  findVietQRBank,
  normalizeBankAccount,
  bankAccountBankLabel,
  bankAccountOptionLabel,
} from './bank-account/utils';
import {
  ConnectionList,
  ConfirmActionDialog,
  ConnectionWizardDialog,
  ConnectionResultDialog,
  type BankAccountOption,
} from './payment-connection';

// ----------------------------------------------------------------------
// Tài khoản ngân hàng của cửa hàng (chỉ Admin, mục 7c): danh sách tài khoản nhận tiền, thêm / sửa / tắt dòng cửa hàng
// tự khai (dòng KiotViet chỉ đọc), mã VietQR (in dán quầy / tải ảnh) và kết nối đối soát theo từng tài khoản.
// Dịch vụ thanh toán bật → GET payment/bank-accounts (kèm kết nối); tắt → GET /bank-accounts?includeInactive=true.
// ----------------------------------------------------------------------

export default function BankAccountsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [paymentCodePrefix, setPaymentCodePrefix] = useState('SP');
  const [accounts, setAccounts] = useState<IBankAccountWithConnections[]>([]);
  const [unassigned, setUnassigned] = useState<IPaymentConnection[]>([]);

  const [providers, setProviders] = useState<IPaymentProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const [banks, setBanks] = useState<IVietQRBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState(false);
  const [storeName, setStoreName] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IBankAccountWithConnections | null>(null);
  const [qrTarget, setQrTarget] = useState<IBankAccountWithConnections | null>(null);
  const [connectTarget, setConnectTarget] = useState<IBankAccountWithConnections | null>(null);
  const [created, setCreated] = useState<IPaymentConnection | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<IBankAccountWithConnections | null>(
    null
  );
  const [deactivating, setDeactivating] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setConnectionsError(null);
    try {
      // Backend cũ / dịch vụ lỗi → coi như tắt: vẫn quản lý được tài khoản.
      const settings = await getPaymentSettings().catch(() => null);
      if (settings?.paymentCodePrefix) setPaymentCodePrefix(settings.paymentCodePrefix);

      if (settings?.enabled) {
        try {
          const data = await getPaymentBankAccounts();
          setEnabled(!!data.enabled);
          setAccounts((data.accounts ?? []).map(normalizeBankAccount));
          setUnassigned(data.unassignedConnections ?? []);
          return;
        } catch (err) {
          setConnectionsError(apiErrorMessage(err, 'Không tải được kết nối đối soát'));
        }
      }

      const rows = await getBankAccounts({ includeInactive: true });
      setEnabled(false);
      setAccounts(rows.map(normalizeBankAccount));
      setUnassigned([]);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Không tải được danh sách tài khoản ngân hàng'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Danh sách ngân hàng VietQR (logo, tên) + tên cửa hàng (in thẻ QR) — không chặn màn hình.
  useEffect(() => {
    getVietQRBanks()
      .then((list) => {
        setBanks(list);
        setBanksError(list.length === 0);
      })
      .catch(() => setBanksError(true))
      .finally(() => setBanksLoading(false));
    getStoreBranding()
      .then((b) => setStoreName(b.storeName))
      .catch(() => {});
  }, []);

  // Danh mục nhà cung cấp chỉ cần khi dịch vụ bật.
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

  const bankOf = useCallback((a: IBankAccountWithConnections) => findVietQRBank(banks, a), [banks]);

  const accountOptions: BankAccountOption[] = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive)
        .map((a) => ({ id: a.id, label: bankAccountOptionLabel(a), bin: a.bin })),
    [accounts]
  );

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await deactivateBankAccount(deactivateTarget.id);
      enqueueSnackbar('Đã tắt tài khoản ngân hàng');
      setDeactivateTarget(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tắt tài khoản thất bại'), { variant: 'error' });
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async (a: IBankAccountWithConnections) => {
    setReactivatingId(a.id);
    try {
      await updateBankAccount(a.id, {
        bin: a.bin ?? '',
        bankName: a.bankName ?? '',
        shortName: a.shortName ?? null,
        accountNumber: a.accountNumber ?? '',
        accountHolder: a.accountHolder ?? '',
        description: a.description ?? null,
        isActive: true,
      });
      enqueueSnackbar('Đã bật lại tài khoản ngân hàng');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Bật lại tài khoản thất bại'), { variant: 'error' });
    } finally {
      setReactivatingId(null);
    }
  };

  if (loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={96} />
        <Skeleton variant="rounded" height={160} />
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            Thử lại
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">Tài khoản ngân hàng</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Tài khoản nhận tiền chuyển khoản của cửa hàng: hiện mã VietQR ở quầy, in mã dán quầy,
              và kết nối đối soát để tiền về được tự xác nhận. Tài khoản đồng bộ từ KiotViet chỉ xem
              — sửa trên KiotViet.
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            sx={{ flexShrink: 0 }}
          >
            Thêm tài khoản
          </Button>
        </Stack>
      </Card>

      {!enabled && !connectionsError && (
        <Alert severity="info">
          Dịch vụ thanh toán chưa bật trên máy chủ nên chưa kết nối đối soát được. Mã VietQR và quản
          lý tài khoản vẫn dùng bình thường.
        </Alert>
      )}
      {connectionsError && (
        <Alert severity="warning">
          {connectionsError} — đang hiện danh sách tài khoản không kèm kết nối.
        </Alert>
      )}

      {accounts.length === 0 && (
        <Card sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center' }}>
            <Iconify icon="solar:card-transfer-bold" width={48} sx={{ color: 'text.disabled' }} />
            <Typography variant="subtitle1">Chưa có tài khoản ngân hàng nào</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
              Thêm tài khoản nhận tiền để nhân viên hiện mã VietQR cho khách chuyển khoản ở quầy.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              Thêm tài khoản
            </Button>
          </Stack>
        </Card>
      )}

      {accounts.map((a) => (
        <BankAccountCard
          key={a.id}
          account={a}
          bank={bankOf(a)}
          enabled={enabled}
          providers={providers}
          providersLoading={providersLoading}
          providersError={providersError}
          paymentCodePrefix={paymentCodePrefix}
          reactivating={reactivatingId === a.id}
          onQr={() => setQrTarget(a)}
          onConnect={() => setConnectTarget(a)}
          onEdit={() => {
            setEditTarget(a);
            setFormOpen(true);
          }}
          onDeactivate={() => setDeactivateTarget(a)}
          onReactivate={() => handleReactivate(a)}
          onChanged={load}
        />
      ))}

      {enabled && (
        <ApiPayBankLinkCard
          connections={[...accounts.flatMap((a) => a.connections ?? []), ...unassigned]}
          hideWhenEmpty
          onChanged={load}
        />
      )}

      {enabled && unassigned.length > 0 && (
        <Card sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Kết nối chưa gắn tài khoản</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Kết nối đối soát không gắn tài khoản nhận nào. Ngân hàng trực tiếp chưa gắn tài
                khoản chỉ dùng cho tài khoản cùng ngân hàng — bấm Cập nhật để gắn tài khoản nhận.
              </Typography>
            </Stack>
            <ConnectionList
              connections={unassigned}
              providers={providers}
              providersLoading={providersLoading}
              providersError={providersError}
              showBankAccount
              allowBankAccountChange
              bankAccounts={accountOptions}
              paymentCodePrefix={paymentCodePrefix}
              onChanged={load}
            />
          </Stack>
        </Card>
      )}

      <BankAccountFormDialog
        open={formOpen}
        account={editTarget}
        banks={banks}
        banksLoading={banksLoading}
        banksError={banksError}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <BankAccountVietQrDialog
        account={qrTarget}
        bank={qrTarget ? bankOf(qrTarget) : undefined}
        storeName={storeName}
        onClose={() => setQrTarget(null)}
      />

      <ConnectionWizardDialog
        open={!!connectTarget}
        providers={providers}
        providersLoading={providersLoading}
        providersError={providersError}
        presetBankAccount={
          connectTarget
            ? {
                id: connectTarget.id,
                label: bankAccountOptionLabel(connectTarget),
                bin: connectTarget.bin,
                accountNumber: connectTarget.accountNumber,
              }
            : null
        }
        onClose={() => setConnectTarget(null)}
        onSaved={(c) => {
          setConnectTarget(null);
          setCreated(c);
          load();
        }}
      />

      <ConnectionResultDialog
        connection={created}
        providers={providers}
        reason="created"
        paymentCodePrefix={paymentCodePrefix}
        onClose={() => setCreated(null)}
      />

      <ConfirmActionDialog
        open={!!deactivateTarget}
        title="Tắt tài khoản ngân hàng?"
        confirmLabel="Tắt tài khoản"
        loading={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        content={
          <>
            Tài khoản <b>{deactivateTarget ? bankAccountOptionLabel(deactivateTarget) : ''}</b>{' '}
            không hiện ở màn bán hàng nữa (lịch sử thu tiền vẫn giữ). Bật lại được bất cứ lúc nào.
            {!!deactivateTarget?.connections.length &&
              ' Kết nối đối soát của tài khoản vẫn chạy — tắt riêng nếu không dùng nữa.'}
          </>
        }
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

type CardProps = {
  account: IBankAccountWithConnections;
  bank?: IVietQRBank;
  enabled: boolean;
  providers: IPaymentProviderInfo[];
  providersLoading: boolean;
  providersError: string | null;
  paymentCodePrefix: string;
  reactivating: boolean;
  onQr: VoidFunction;
  onConnect: VoidFunction;
  onEdit: VoidFunction;
  onDeactivate: VoidFunction;
  onReactivate: VoidFunction;
  onChanged: VoidFunction;
};

function BankAccountCard({
  account: a,
  bank,
  enabled,
  providers,
  providersLoading,
  providersError,
  paymentCodePrefix,
  reactivating,
  onQr,
  onConnect,
  onEdit,
  onDeactivate,
  onReactivate,
  onChanged,
}: CardProps) {
  const label = bankAccountBankLabel(a, bank);
  const editable = !a.isManagedByKiotViet;

  return (
    <Card sx={{ p: 3, ...(a.isActive ? {} : { bgcolor: 'background.neutral' }) }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'flex-start' }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            sx={{ flex: 1, minWidth: 0, opacity: a.isActive ? 1 : 0.7 }}
          >
            <Avatar
              src={bank?.logo || undefined}
              alt={label}
              variant="rounded"
              sx={{
                width: 64,
                height: 40,
                bgcolor: 'common.white',
                border: (theme) => `1px solid ${theme.palette.divider}`,
                color: 'text.secondary',
                '& img': { objectFit: 'contain' },
              }}
            >
              <Iconify icon="solar:card-transfer-bold" />
            </Avatar>

            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{label}</Typography>
                {a.isDefault && <Label color="primary">Mặc định</Label>}
                {!a.isActive && <Label color="default">Đang tắt</Label>}
                {a.isManagedByKiotViet && (
                  <Label color="secondary">Đồng bộ KiotViet (chỉ đọc)</Label>
                )}
                {enabled && (
                  <Label color={a.qrMode === 'bank_direct' ? 'success' : 'info'} variant="soft">
                    {a.qrMode === 'bank_direct' ? 'QR qua ngân hàng' : 'VietQR'}
                  </Label>
                )}
              </Stack>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'monospace', letterSpacing: 1, wordBreak: 'break-all' }}
              >
                {a.accountNumber || '—'}
              </Typography>
              {a.accountHolder && <Typography variant="body2">{a.accountHolder}</Typography>}
              {(a.bankName || bank?.name) && (a.bankName || bank?.name) !== label && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {a.bankName || bank?.name}
                </Typography>
              )}
              {a.description && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {a.description}
                </Typography>
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:qr-code-bold" />}
              onClick={onQr}
              disabled={!a.accountNumber}
            >
              Mã VietQR
            </Button>
            {enabled && a.isActive && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Iconify icon="solar:link-bold" />}
                onClick={onConnect}
                disabled={!a.accountNumber}
              >
                Kết nối đối soát
              </Button>
            )}
            {editable && (
              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:pen-bold" />}
                onClick={onEdit}
              >
                Sửa
              </Button>
            )}
            {editable && a.isActive && (
              <Button
                size="small"
                color="error"
                startIcon={<Iconify icon="solar:close-circle-bold" />}
                onClick={onDeactivate}
              >
                Tắt
              </Button>
            )}
            {editable && !a.isActive && (
              <LoadingButton
                size="small"
                color="success"
                loading={reactivating}
                startIcon={<Iconify icon="solar:restart-bold" />}
                onClick={onReactivate}
              >
                Bật lại
              </LoadingButton>
            )}
          </Stack>
        </Stack>

        {enabled && (
          <>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Kết nối đối soát
              </Typography>
              {a.connections.length === 0 ? (
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Chưa kết nối — tiền vào tài khoản này chưa được tự xác nhận
                    {a.isActive ? '. Bấm "Kết nối đối soát" để thêm.' : '.'}
                  </Typography>
                </Box>
              ) : (
                <ConnectionList
                  connections={a.connections}
                  providers={providers}
                  providersLoading={providersLoading}
                  providersError={providersError}
                  collapseWebhooks
                  paymentCodePrefix={paymentCodePrefix}
                  onChanged={onChanged}
                />
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}
