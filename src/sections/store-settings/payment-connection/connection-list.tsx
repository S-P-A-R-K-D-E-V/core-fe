'use client';

import type {
  IPaymentConnection,
  IPaymentProviderInfo,
  IPaymentConnectionTestResult,
} from 'src/types/payment-service';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';
import { fToNow, fDateTime } from 'src/utils/format-time';
import { paymentProviderLabel } from 'src/utils/payment-status';

import {
  syncPaymentConnection,
  testPaymentConnection,
  deletePaymentConnection,
  updatePaymentConnection,
  rotatePaymentWebhookSecret,
} from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import CopyField from './copy-field';
import ApiPayQuotaUsage from './apipay-quota-usage';
import ConnectionTestDialog from './connection-test-dialog';
import ConfirmActionDialog from './confirm-action-dialog';
import ConnectionFormDialog from './connection-form-dialog';
import ConnectionResultDialog from './connection-result-dialog';
import {
  canSync,
  hasQuota,
  isBankDirect,
  findProvider,
  credentialLabel,
  webhookUrlEntries,
  connectionKindLabel,
  hasGeneratedSecrets,
} from './utils';

import type { BankAccountOption } from './connection-form-dialog';

// ----------------------------------------------------------------------
// Danh sách kết nối đối soát kèm thao tác — dùng chung cho tab "Tài khoản ngân hàng" (theo từng tài khoản, kết nối
// chưa gắn tài khoản) và tab "Báo có & kết nối" (mọi kết nối) của mục Thanh toán:
//   Kiểm tra kết nối (ngân hàng trực tiếp) · Đồng bộ (SePay / Casso) · Tắt / Bật lại; manageKeys thêm Cập nhật (form
//   khoá), Tạo lại khoá webhook và webhook URL — chủ cửa hàng không dùng (khoá ngân hàng do SPARK giữ ở S Payment).
// Kết nối tạo từ đăng ký báo có (publicSettings.bankLinkId) quản lý ở thẻ Đăng ký báo có — không tắt / kiểm tra ở đây.
// ----------------------------------------------------------------------

const isBankLinked = (c: IPaymentConnection) => !!c.publicSettings?.bankLinkId;

type Props = {
  connections: IPaymentConnection[];
  /** Danh mục đầy đủ từ GET payment/settings/providers */
  providers: IPaymentProviderInfo[];
  providersLoading?: boolean;
  providersError?: string | null;
  /** Hiện dòng "Tài khoản nhận" (khi kết nối không nằm dưới thẻ tài khoản) */
  showBankAccount?: boolean;
  /** "Cập nhật" cho gắn tài khoản nhận — chỉ với kết nối chưa gắn tài khoản nào */
  allowBankAccountChange?: boolean;
  bankAccounts?: BankAccountOption[];
  /** Webhook URL thu gọn, bấm mới hiện (thẻ tài khoản có nhiều kết nối) */
  collapseWebhooks?: boolean;
  /** Hiện form khoá (Cập nhật), Tạo lại khoá webhook, webhook URL — mặc định ẩn */
  manageKeys?: boolean;
  paymentCodePrefix?: string;
  emptyText?: string;
  /** Có thay đổi trên máy chủ → tải lại danh sách */
  onChanged: VoidFunction;
};

export default function ConnectionList({
  connections,
  providers,
  providersLoading,
  providersError,
  showBankAccount,
  allowBankAccountChange,
  bankAccounts,
  collapseWebhooks,
  manageKeys,
  paymentCodePrefix,
  emptyText,
  onChanged,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [editTarget, setEditTarget] = useState<IPaymentConnection | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: 'test' | 'sync' | 'enable' } | null>(null);
  const [testResult, setTestResult] = useState<{
    name: string;
    result: IPaymentConnectionTestResult;
  } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<IPaymentConnection | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState<IPaymentConnection | null>(null);
  const [disableTarget, setDisableTarget] = useState<IPaymentConnection | null>(null);
  const [disabling, setDisabling] = useState(false);

  const runBusy = async (
    c: IPaymentConnection,
    action: 'test' | 'sync' | 'enable',
    fn: () => Promise<void>
  ) => {
    setBusy({ id: c.id, action });
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const handleTest = (c: IPaymentConnection) =>
    runBusy(c, 'test', async () => {
      try {
        const result = await testPaymentConnection(c.id);
        setTestResult({ name: c.displayName, result });
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Không kiểm tra được kết nối'), { variant: 'error' });
      }
      // Máy chủ ghi / xoá lastError theo kết quả kiểm tra.
      onChanged();
    });

  const handleSync = (c: IPaymentConnection) =>
    runBusy(c, 'sync', async () => {
      try {
        const res = await syncPaymentConnection(c.id);
        enqueueSnackbar(
          `Đã kéo ${res.fetched} giao dịch: ${res.inserted} mới, ${res.matched} khớp thanh toán`
        );
        onChanged();
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Đồng bộ thất bại'), { variant: 'error' });
      }
    });

  const handleEnable = (c: IPaymentConnection) =>
    runBusy(c, 'enable', async () => {
      try {
        await updatePaymentConnection(c.id, { active: true });
        enqueueSnackbar('Đã bật lại kết nối');
        onChanged();
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Bật lại kết nối thất bại'), { variant: 'error' });
      }
    });

  const handleRotate = async () => {
    if (!rotateTarget) return;
    setRotating(true);
    try {
      const res = await rotatePaymentWebhookSecret(rotateTarget.id);
      setRotateTarget(null);
      setRotated(res);
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tạo lại khoá webhook thất bại'), { variant: 'error' });
    } finally {
      setRotating(false);
    }
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await deletePaymentConnection(disableTarget.id);
      enqueueSnackbar('Đã tắt kết nối');
      setDisableTarget(null);
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tắt kết nối thất bại'), { variant: 'error' });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      {connections.length === 0 && emptyText && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {emptyText}
        </Typography>
      )}

      <Stack spacing={2} divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
        {connections.map((c) => (
          <ConnectionItem
            key={c.id}
            connection={c}
            provider={findProvider(providers, c.provider)}
            showBankAccount={showBankAccount}
            collapseWebhooks={collapseWebhooks}
            manageKeys={!!manageKeys}
            busyAction={busy?.id === c.id ? busy.action : null}
            disabled={!!busy && busy.id !== c.id}
            onEdit={() => setEditTarget(c)}
            onTest={() => handleTest(c)}
            onSync={() => handleSync(c)}
            onEnable={() => handleEnable(c)}
            onRotate={() => setRotateTarget(c)}
            onDisable={() => setDisableTarget(c)}
          />
        ))}
      </Stack>

      <ConnectionFormDialog
        open={!!editTarget}
        mode="update"
        providers={providers}
        providersLoading={providersLoading}
        providersError={providersError}
        connection={editTarget}
        bankAccounts={bankAccounts}
        allowBankAccountChange={!!allowBankAccountChange && !editTarget?.bankAccount?.accountNumber}
        onClose={() => setEditTarget(null)}
        onSaved={(saved) => {
          setEditTarget(null);
          if (hasGeneratedSecrets(saved)) setRotated(saved);
          onChanged();
        }}
      />

      <ConnectionTestDialog
        result={testResult?.result ?? null}
        connectionName={testResult?.name}
        onClose={() => setTestResult(null)}
      />

      <ConnectionResultDialog
        connection={rotated}
        providers={providers}
        reason="rotated"
        paymentCodePrefix={paymentCodePrefix}
        onClose={() => setRotated(null)}
      />

      <ConfirmActionDialog
        open={!!rotateTarget}
        title="Tạo lại khoá webhook?"
        color="warning"
        confirmLabel="Tạo khoá mới"
        loading={rotating}
        onClose={() => setRotateTarget(null)}
        onConfirm={handleRotate}
        content={
          <>
            Khoá webhook hiện tại của <b>{rotateTarget?.displayName}</b> hết hiệu lực ngay: ngân
            hàng gọi webhook bằng khoá cũ sẽ bị từ chối cho tới khi bạn gửi khoá mới cho{' '}
            {rotateTarget ? paymentProviderLabel(rotateTarget.provider) : 'ngân hàng'}. Khoá mới chỉ
            hiện một lần.
          </>
        }
      />

      <ConfirmActionDialog
        open={!!disableTarget}
        title="Tắt kết nối đối soát?"
        confirmLabel="Tắt kết nối"
        loading={disabling}
        onClose={() => setDisableTarget(null)}
        onConfirm={handleDisable}
        content={
          <>
            Ngừng nhận webhook và đồng bộ từ <b>{disableTarget?.displayName}</b> — tiền về không tự
            xác nhận nữa. Giao dịch đã nhận vẫn giữ ở màn Đối soát. Nhớ xoá webhook bên{' '}
            {disableTarget ? paymentProviderLabel(disableTarget.provider) : 'nhà cung cấp'}.
          </>
        }
      />
    </>
  );
}

// ----------------------------------------------------------------------

function RelativeTime({ value, empty }: { value?: string | null; empty: string }) {
  if (!value) return <>{empty}</>;
  return (
    <Tooltip title={fDateTime(value)}>
      <span>{fToNow(value)}</span>
    </Tooltip>
  );
}

type ItemProps = {
  connection: IPaymentConnection;
  provider?: IPaymentProviderInfo;
  showBankAccount?: boolean;
  collapseWebhooks?: boolean;
  manageKeys: boolean;
  busyAction: 'test' | 'sync' | 'enable' | null;
  disabled: boolean;
  onEdit: VoidFunction;
  onTest: VoidFunction;
  onSync: VoidFunction;
  onEnable: VoidFunction;
  onRotate: VoidFunction;
  onDisable: VoidFunction;
};

function ConnectionItem({
  connection: c,
  provider,
  showBankAccount,
  collapseWebhooks,
  manageKeys,
  busyAction,
  disabled,
  onEdit,
  onTest,
  onSync,
  onEnable,
  onRotate,
  onDisable,
}: ItemProps) {
  const [webhooksOpen, setWebhooksOpen] = useState(!collapseWebhooks);
  const active = c.status === 'active';
  const linked = isBankLinked(c);
  const urls = manageKeys ? webhookUrlEntries(c) : [];
  const missing = manageKeys ? (c.missingSettings ?? []) : [];
  const anyBusy = !!busyAction || disabled;

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2">{c.displayName}</Typography>
        <Label color="info">{paymentProviderLabel(c.provider)}</Label>
        {c.kind && <Label variant="soft">{connectionKindLabel(c.kind)}</Label>}
        <Label color={active ? 'success' : 'default'}>{active ? 'Đang dùng' : 'Đã tắt'}</Label>
        {linked && <Label variant="soft">Đăng ký báo có</Label>}
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {showBankAccount && (
          <>
            {c.bankAccount?.accountNumber
              ? `Tài khoản nhận: ${c.bankAccount.accountNumber}${c.bankAccount.accountName ? ` · ${c.bankAccount.accountName}` : ''}`
              : 'Chưa gắn tài khoản nhận'}
            {' · '}
          </>
        )}
        Webhook gần nhất: <RelativeTime value={c.lastWebhookAt} empty="chưa nhận" />
        {canSync(c) && (
          <>
            {' · '}Đồng bộ gần nhất: <RelativeTime value={c.lastSyncedAt} empty="chưa có" />
          </>
        )}
      </Typography>

      {missing.length > 0 && (
        <Alert severity="warning">
          Còn thiếu {missing.map((k) => credentialLabel(provider, k)).join(', ')} — bấm Cập nhật để
          bổ sung.
        </Alert>
      )}

      {!!c.lastError && <Alert severity="error">{c.lastError}</Alert>}

      {hasQuota(c) && (
        <ApiPayQuotaUsage connection={c} onEdit={anyBusy || !manageKeys ? undefined : onEdit} />
      )}

      {urls.length > 0 && (
        <>
          {collapseWebhooks && (
            <Button
              size="small"
              color="inherit"
              onClick={() => setWebhooksOpen((o) => !o)}
              aria-expanded={webhooksOpen}
              endIcon={
                <Iconify
                  icon={webhooksOpen ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                />
              }
              sx={{ alignSelf: 'flex-start', px: 0.5 }}
            >
              {webhooksOpen
                ? 'Ẩn webhook URL'
                : `Xem webhook URL${urls.length > 1 ? ` (${urls.length})` : ''}`}
            </Button>
          )}
          <Collapse in={webhooksOpen} unmountOnExit>
            <Stack spacing={1.5}>
              {urls.map((u) => (
                <CopyField
                  key={u.key}
                  label={u.label}
                  value={u.url}
                  copiedMessage="Đã sao chép webhook URL"
                />
              ))}
            </Stack>
          </Collapse>
        </>
      )}

      {linked ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Huỷ hoặc đăng ký lại ở mục Đăng ký dịch vụ thông báo thanh toán QR (Thanh toán → Báo có & kết nối).
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {manageKeys && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:pen-bold" />}
              onClick={onEdit}
              disabled={anyBusy}
            >
              Cập nhật
            </Button>
          )}
          {isBankDirect(c) && active && (
            <LoadingButton
              size="small"
              variant="outlined"
              loading={busyAction === 'test'}
              disabled={anyBusy && busyAction !== 'test'}
              startIcon={<Iconify icon="solar:shield-check-bold" />}
              onClick={onTest}
            >
              Kiểm tra kết nối
            </LoadingButton>
          )}
          {manageKeys && isBankDirect(c) && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<Iconify icon="solar:key-bold" />}
              onClick={onRotate}
              disabled={anyBusy}
            >
              Tạo lại khoá webhook
            </Button>
          )}
          {canSync(c) && active && (
            <LoadingButton
              size="small"
              variant="outlined"
              loading={busyAction === 'sync'}
              disabled={anyBusy && busyAction !== 'sync'}
              startIcon={<Iconify icon="solar:refresh-bold" />}
              onClick={onSync}
            >
              Đồng bộ
            </LoadingButton>
          )}
          {active ? (
            <Button
              size="small"
              color="error"
              startIcon={<Iconify icon="solar:close-circle-bold" />}
              onClick={onDisable}
              disabled={anyBusy}
            >
              Tắt
            </Button>
          ) : (
            <LoadingButton
              size="small"
              color="success"
              loading={busyAction === 'enable'}
              disabled={anyBusy && busyAction !== 'enable'}
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={onEnable}
            >
              Bật lại
            </LoadingButton>
          )}
        </Stack>
      )}
    </Stack>
  );
}
