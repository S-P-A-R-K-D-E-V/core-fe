'use client';

import type { IKiotVietBankAccount } from 'src/types/corecms-api';
import type { PaymentProvider, IPaymentSettings, IPaymentConnection } from 'src/types/payment-service';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';
import { PAYMENT_PROVIDER_LABEL } from 'src/utils/payment-status';

import { getBankAccounts } from 'src/api/bank-accounts';
import {
  getPaymentSettings,
  syncPaymentConnection,
  getPaymentConnections,
  createPaymentConnection,
  deletePaymentConnection,
} from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// Kết nối thanh toán (chỉ Admin): SePay / Casso đọc biến động số dư tài khoản ngân hàng, payOS / VNPay là cổng thanh
// toán. Mỗi kết nối có webhook URL riêng (chứa routing token) để dán vào trang nhà cung cấp. Khoá được mã hoá trên máy
// chủ và không bao giờ trả lại — ở đây chỉ nhập, không hiển thị.
// ----------------------------------------------------------------------

type CredentialField =
  | { key: string; label: string; kind: 'secret'; helper?: string }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[]; initial: string }
  | { key: string; label: string; kind: 'switch'; initial: boolean; helper?: string };

const PROVIDER_FIELDS: Record<PaymentProvider, CredentialField[]> = {
  sepay: [
    { key: 'apiToken', label: 'API Token', kind: 'secret', helper: 'Dùng để kéo giao dịch đối soát định kỳ.' },
    {
      key: 'webhookAuth',
      label: 'Kiểu chứng thực webhook',
      kind: 'select',
      initial: 'hmac',
      options: [
        { value: 'hmac', label: 'HMAC (chữ ký) — khuyên dùng' },
        { value: 'apikey', label: 'API Key' },
      ],
    },
    { key: 'webhookSecret', label: 'Khoá bí mật webhook', kind: 'secret' },
  ],
  casso: [
    { key: 'apiKey', label: 'API Key', kind: 'secret' },
    { key: 'checksumKey', label: 'Khoá bảo mật webhook (checksum key)', kind: 'secret' },
  ],
  payos: [
    { key: 'clientId', label: 'Client ID', kind: 'secret' },
    { key: 'apiKey', label: 'API Key', kind: 'secret' },
    { key: 'checksumKey', label: 'Checksum Key', kind: 'secret' },
  ],
  vnpay: [
    { key: 'tmnCode', label: 'Mã website (vnp_TmnCode)', kind: 'secret' },
    { key: 'hashSecret', label: 'Chuỗi bí mật (vnp_HashSecret)', kind: 'secret' },
    { key: 'sandbox', label: 'Môi trường thử nghiệm (sandbox)', kind: 'switch', initial: true },
  ],
};

const PROVIDERS: PaymentProvider[] = ['sepay', 'casso', 'payos', 'vnpay'];

/** Kéo giao dịch ngay chỉ có ở nguồn đọc tài khoản ngân hàng. */
const SYNCABLE: PaymentProvider[] = ['sepay', 'casso'];

function setupHint(provider: PaymentProvider, prefix: string): string {
  switch (provider) {
    case 'sepay':
      return `Trên SePay: thêm webhook với URL này, chọn kiểu chứng thực (HMAC hoặc API Key) và khoá bí mật giống hệt ở đây. Cấu hình mã thanh toán: tiền tố "${prefix}", hậu tố 7 ký tự chữ và số — SePay mới nhận ra mã trong nội dung chuyển khoản.`;
    case 'casso':
      return 'Trên Casso: thiết lập Webhook v2 với URL này và nhập khoá bảo mật (checksum key) giống hệt ở đây.';
    case 'payos':
      return 'Trên payOS: mở Kênh thanh toán → chỉnh sửa kênh, dán URL này vào ô Webhook URL rồi lưu.';
    case 'vnpay':
      return 'Gửi URL này cho VNPay làm IPN URL của website (mã website ở trên).';
    default:
      return '';
  }
}

function initialCredentials(provider: PaymentProvider): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  PROVIDER_FIELDS[provider].forEach((f) => {
    values[f.key] = f.kind === 'secret' ? '' : f.initial;
  });
  return values;
}

function bankAccountLabel(a: IKiotVietBankAccount): string {
  return [a.shortName || a.bankName, a.accountNumber, a.description].filter(Boolean).join(' · ');
}

// ----------------------------------------------------------------------

export default function PaymentConnectionsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [settings, setSettings] = useState<IPaymentSettings | null>(null);
  const [connections, setConnections] = useState<IPaymentConnection[]>([]);
  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [created, setCreated] = useState<IPaymentConnection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IPaymentConnection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getPaymentSettings();
      setSettings(s);
      if (s.enabled) {
        const [list, accounts] = await Promise.all([getPaymentConnections(), getBankAccounts().catch(() => [])]);
        setConnections(list);
        setBankAccounts(accounts);
      }
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được cài đặt thanh toán'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const prefix = settings?.paymentCodePrefix || 'SP';

  const handleSync = async (c: IPaymentConnection) => {
    setSyncingId(c.id);
    try {
      const res = await syncPaymentConnection(c.id);
      enqueueSnackbar(`Đã kéo ${res.fetched} giao dịch: ${res.inserted} mới, ${res.matched} khớp thanh toán`);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Đồng bộ thất bại'), { variant: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePaymentConnection(deleteTarget.id);
      enqueueSnackbar('Đã xoá kết nối');
      setDeleteTarget(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá kết nối thất bại'), { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 5 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  if (!settings?.enabled) {
    return (
      <Alert severity="info">
        Dịch vụ thanh toán chưa được bật trên máy chủ. Khi được bật, cửa hàng có thể kết nối SePay, Casso, payOS hoặc
        VNPay để tự xác nhận tiền chuyển khoản và đối soát giao dịch. Trong lúc chờ, thanh toán QR vẫn chạy như cũ.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Kết nối thanh toán</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                SePay / Casso báo tiền vào tài khoản ngân hàng của cửa hàng; payOS / VNPay là cổng thanh toán cho đơn
                online. Tiền chỉ tự khớp khi nội dung chuyển khoản có mã thanh toán (bắt đầu bằng &quot;{prefix}&quot;)
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

          {connections.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              Chưa có kết nối nào.
            </Typography>
          )}

          {connections.map((c, idx) => (
            <Stack key={c.id} spacing={1.5}>
              {idx > 0 && <Divider sx={{ borderStyle: 'dashed' }} />}

              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{c.displayName}</Typography>
                <Label color="info">{PAYMENT_PROVIDER_LABEL[c.provider] ?? c.provider}</Label>
                <Label color={c.status === 'active' ? 'success' : 'default'}>
                  {c.status === 'active' ? 'Đang dùng' : 'Đã tắt'}
                </Label>
                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                  {SYNCABLE.includes(c.provider) && (
                    <LoadingButton
                      size="small"
                      variant="outlined"
                      loading={syncingId === c.id}
                      startIcon={<Iconify icon="solar:refresh-bold" />}
                      onClick={() => handleSync(c)}
                    >
                      Đồng bộ ngay
                    </LoadingButton>
                  )}
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                    onClick={() => setDeleteTarget(c)}
                  >
                    Xoá
                  </Button>
                </Stack>
              </Stack>

              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {c.bankAccount
                  ? `Tài khoản nhận: ${c.bankAccount.accountNumber} · ${c.bankAccount.accountName} (BIN ${c.bankAccount.bin})`
                  : 'Không gắn tài khoản nhận'}
                {' · '}
                Webhook gần nhất: {c.lastWebhookAt ? fDateTime(c.lastWebhookAt) : 'chưa nhận'}
                {SYNCABLE.includes(c.provider) &&
                  ` · Đồng bộ gần nhất: ${c.lastSyncedAt ? fDateTime(c.lastSyncedAt) : 'chưa có'}`}
              </Typography>

              <WebhookUrlField url={c.webhookUrl} />

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {setupHint(c.provider, prefix)}
              </Typography>

              {!!c.lastError && <Alert severity="warning">{c.lastError}</Alert>}
            </Stack>
          ))}
        </Stack>
      </Card>

      <AddConnectionDialog
        open={addOpen}
        bankAccounts={bankAccounts}
        onClose={() => setAddOpen(false)}
        onCreated={(c) => {
          setAddOpen(false);
          setCreated(c);
          load();
        }}
      />

      <Dialog fullWidth maxWidth="sm" open={!!created} onClose={() => setCreated(null)}>
        <DialogTitle>Đã thêm kết nối {created ? PAYMENT_PROVIDER_LABEL[created.provider] : ''}</DialogTitle>
        <DialogContent>
          {created && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2">
                Bước cuối: dán webhook URL dưới đây vào trang quản trị của{' '}
                {PAYMENT_PROVIDER_LABEL[created.provider]} để tiền về được báo ngay.
              </Typography>
              <WebhookUrlField url={created.webhookUrl} />
              <Alert severity="info">{setupHint(created.provider, prefix)}</Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreated(null)}>
            Xong
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xoá kết nối thanh toán?"
        content={
          <>
            Ngừng nhận webhook và đồng bộ từ <b>{deleteTarget?.displayName}</b>. Giao dịch đã nhận vẫn được giữ ở màn
            Đối soát. Nhớ xoá webhook bên {deleteTarget ? PAYMENT_PROVIDER_LABEL[deleteTarget.provider] : ''}.
          </>
        }
        action={
          <LoadingButton variant="contained" color="error" loading={deleting} onClick={handleDelete}>
            Xoá
          </LoadingButton>
        }
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

function WebhookUrlField({ url }: { url: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();

  const handleCopy = async () => {
    const ok = await copy(url);
    enqueueSnackbar(ok ? 'Đã sao chép webhook URL' : 'Không sao chép được', { variant: ok ? 'success' : 'error' });
  };

  return (
    <TextField
      fullWidth
      size="small"
      label="Webhook URL"
      value={url}
      InputProps={{
        readOnly: true,
        sx: { fontFamily: 'monospace', fontSize: 13 },
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title="Sao chép">
              <IconButton edge="end" onClick={handleCopy}>
                <Iconify icon="solar:copy-bold" width={20} />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  );
}

// ----------------------------------------------------------------------

type AddDialogProps = {
  open: boolean;
  bankAccounts: IKiotVietBankAccount[];
  onClose: VoidFunction;
  onCreated: (connection: IPaymentConnection) => void;
};

function AddConnectionDialog({ open, bankAccounts, onClose, onCreated }: AddDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [provider, setProvider] = useState<PaymentProvider>('sepay');
  const [displayName, setDisplayName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string | boolean>>(() => initialCredentials('sepay'));
  const [saving, setSaving] = useState(false);

  // Mở lại hộp thoại → form trống (không giữ khoá vừa gõ trong bộ nhớ lâu hơn cần thiết)
  useEffect(() => {
    if (!open) return;
    setProvider('sepay');
    setDisplayName('');
    setBankAccountId('');
    setCredentials(initialCredentials('sepay'));
  }, [open]);

  const changeProvider = (next: PaymentProvider) => {
    setProvider(next);
    setCredentials(initialCredentials(next));
  };

  const fields = PROVIDER_FIELDS[provider];
  const missing = fields.some((f) => f.kind === 'secret' && !String(credentials[f.key] ?? '').trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed: Record<string, string | boolean> = {};
      Object.entries(credentials).forEach(([k, v]) => {
        trimmed[k] = typeof v === 'string' ? v.trim() : v;
      });
      const res = await createPaymentConnection({
        provider,
        displayName: displayName.trim() || PAYMENT_PROVIDER_LABEL[provider],
        bankAccountId: bankAccountId || undefined,
        credentials: trimmed,
      });
      enqueueSnackbar('Đã thêm kết nối');
      onCreated(res);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Thêm kết nối thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Thêm kết nối thanh toán</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={provider}
            onChange={(_, v) => v && changeProvider(v)}
          >
            {PROVIDERS.map((p) => (
              <ToggleButton key={p} value={p}>
                {PAYMENT_PROVIDER_LABEL[p]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            label="Tên kết nối"
            placeholder={`vd: ${PAYMENT_PROVIDER_LABEL[provider]} — tài khoản chính`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <TextField
            select
            label="Tài khoản nhận (không bắt buộc)"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            helperText="Gắn tài khoản thì chỉ tiền vào đúng tài khoản này mới được khớp."
          >
            <MenuItem value="">— Không chọn —</MenuItem>
            {bankAccounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {bankAccountLabel(a)}
              </MenuItem>
            ))}
          </TextField>

          {fields.map((f) => {
            if (f.kind === 'switch') {
              return (
                <FormControlLabel
                  key={f.key}
                  label={f.label}
                  control={
                    <Switch
                      checked={!!credentials[f.key]}
                      onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.checked }))}
                    />
                  }
                />
              );
            }
            if (f.kind === 'select') {
              return (
                <TextField
                  key={f.key}
                  select
                  label={f.label}
                  value={String(credentials[f.key] ?? f.initial)}
                  onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
                >
                  {f.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }
            return (
              <TextField
                key={f.key}
                label={f.label}
                type="password"
                autoComplete="new-password"
                value={String(credentials[f.key] ?? '')}
                helperText={f.helper}
                onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            );
          })}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Khoá được mã hoá trên máy chủ và không hiển thị lại. Sau khi lưu, hệ thống cấp webhook URL riêng cho kết nối
            này để dán vào trang {PAYMENT_PROVIDER_LABEL[provider]}.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={missing} onClick={handleSave}>
          Lưu kết nối
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
