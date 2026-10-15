'use client';

import type {
  IPaymentConnection,
  IPaymentProviderInfo,
  IUpdatePaymentConnectionRequest,
} from 'src/types/payment-service';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Accordion from '@mui/material/Accordion';
import FormLabel from '@mui/material/FormLabel';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';
import { paymentProviderLabel } from 'src/utils/payment-status';

import { createPaymentConnection, updatePaymentConnection } from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import CredentialFields from './credential-fields';
import {
  findProvider,
  credentialLabel,
  visibleProviders,
  connectionKindLabel,
  missingRequiredFields,
  buildCreateCredentials,
  buildUpdateCredentials,
  initialCredentialValues,
  providerUnavailableReason,
} from './utils';

import type { CredentialValues, ConnectionFormMode } from './utils';

// ----------------------------------------------------------------------
// Tạo / cập nhật kết nối đối soát, form dựng từ danh mục nhà cung cấp (GET payment/settings/providers).
// Tạo: chọn nhà cung cấp (ẩn ngân hàng giả lập) → khai khoá → POST; kết quả (webhook URL + khoá tự sinh hiện một lần)
// do nơi gọi hiện. Cập nhật: mọi ô không bắt buộc, ô bí mật trống = giữ nguyên → PUT chỉ gồm phần đã đổi.
// ----------------------------------------------------------------------

export type BankAccountOption = {
  id: string;
  label: string;
  bin?: string | null;
};

type Props = {
  open: boolean;
  mode: ConnectionFormMode;
  /** Danh mục đầy đủ (kể cả nhà bị ẩn — để cập nhật được kết nối đã có) */
  providers: IPaymentProviderInfo[];
  providersLoading?: boolean;
  providersError?: string | null;
  /** Kết nối đang cập nhật */
  connection?: IPaymentConnection | null;
  /** Tài khoản để chọn làm tài khoản nhận */
  bankAccounts?: BankAccountOption[];
  /** Tạo từ một tài khoản: gắn sẵn tài khoản này, không đổi được */
  presetBankAccount?: BankAccountOption | null;
  /** Cập nhật: cho gắn tài khoản nhận (kết nối chưa gắn tài khoản nào) */
  allowBankAccountChange?: boolean;
  onClose: VoidFunction;
  onSaved: (connection: IPaymentConnection, mode: ConnectionFormMode) => void;
};

export default function ConnectionFormDialog({
  open,
  mode,
  providers,
  providersLoading,
  providersError,
  connection,
  bankAccounts = [],
  presetBankAccount,
  allowBankAccountChange,
  onClose,
  onSaved,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [providerKey, setProviderKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [values, setValues] = useState<CredentialValues>({});
  const [initialValues, setInitialValues] = useState<CredentialValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(() => visibleProviders(providers), [providers]);
  const provider = findProvider(providers, mode === 'update' ? connection?.provider : providerKey);
  const fields = useMemo(() => provider?.fields ?? [], [provider]);

  // Mở lại hộp thoại → form mới (không giữ khoá vừa gõ trong bộ nhớ lâu hơn cần thiết)
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setBankAccountId('');
    if (mode === 'update' && connection) {
      setProviderKey(connection.provider);
      setDisplayName(connection.displayName ?? '');
    } else {
      setProviderKey('');
      setDisplayName('');
    }
  }, [open, mode, connection]);

  // Danh mục về / đổi nhà cung cấp → dựng lại giá trị ban đầu của các ô
  useEffect(() => {
    if (!open) return;
    const next = initialCredentialValues(
      fields,
      mode,
      mode === 'update' ? connection?.publicSettings : null
    );
    setValues(next);
    setInitialValues(next);
  }, [open, fields, mode, connection]);

  const missing = provider ? missingRequiredFields(fields, values, mode) : [];
  const updateCredentials =
    mode === 'update' ? buildUpdateCredentials(fields, values, initialValues) : undefined;
  const nameChanged =
    mode === 'update' &&
    !!displayName.trim() &&
    displayName.trim() !== (connection?.displayName ?? '').trim();
  const hasUpdate =
    !!updateCredentials || nameChanged || (!!allowBankAccountChange && !!bankAccountId);
  // Cập nhật kết nối mà danh mục không có nhà cung cấp đó: vẫn đổi được tên / tài khoản nhận.
  const canSave = !saving && (mode === 'create' ? !!provider && missing.length === 0 : hasUpdate);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let saved: IPaymentConnection;
      if (mode === 'create') {
        if (!provider) return;
        saved = await createPaymentConnection({
          provider: provider.key,
          displayName: displayName.trim() || provider.displayName,
          bankAccountId: presetBankAccount?.id || bankAccountId || undefined,
          credentials: buildCreateCredentials(fields, values),
        });
        enqueueSnackbar('Đã thêm kết nối');
      } else {
        if (!connection) return;
        const body: IUpdatePaymentConnectionRequest = {};
        if (nameChanged) body.displayName = displayName.trim();
        if (updateCredentials) body.credentials = updateCredentials;
        if (allowBankAccountChange && bankAccountId) body.bankAccountId = bankAccountId;
        saved = await updatePaymentConnection(connection.id, body);
        enqueueSnackbar('Đã cập nhật kết nối');
      }
      onSaved(saved, mode);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          mode === 'create' ? 'Thêm kết nối thất bại' : 'Cập nhật kết nối thất bại'
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === 'create'
      ? `Kết nối đối soát${presetBankAccount ? ` · ${presetBankAccount.label}` : ''}`
      : `Cập nhật kết nối · ${connection?.displayName ?? ''}`;

  const missingSettings = mode === 'update' ? (connection?.missingSettings ?? []) : [];

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      scroll="paper"
      open={open}
      onClose={saving ? undefined : onClose}
      aria-labelledby="payment-connection-form-title"
    >
      <DialogTitle id="payment-connection-form-title">{title}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {providersError && <Alert severity="error">{providersError}</Alert>}

          {mode === 'create' && (
            <ProviderPicker
              loading={!!providersLoading}
              providers={selectable}
              value={providerKey}
              accountBin={presetBankAccount?.bin}
              onChange={(key) => {
                setProviderKey(key);
                setError(null);
              }}
            />
          )}

          {mode === 'update' && connection && !provider && !providersLoading && (
            <Alert severity="warning">
              Không tìm thấy {paymentProviderLabel(connection.provider)} trong danh mục nhà cung cấp
              — chỉ đổi được tên kết nối.
            </Alert>
          )}

          {provider && <ProviderGuide provider={provider} defaultExpanded={mode === 'create'} />}

          {(provider || (mode === 'update' && connection)) && (
            <Stack spacing={2}>
              {mode === 'create' && <Divider />}

              <TextField
                fullWidth
                label="Tên kết nối"
                value={displayName}
                placeholder={provider ? `vd: ${provider.displayName}` : undefined}
                helperText={mode === 'create' ? 'Để trống = tên nhà cung cấp.' : undefined}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
              />

              {mode === 'create' && presetBankAccount && (
                <TextField
                  fullWidth
                  label="Tài khoản nhận"
                  value={presetBankAccount.label}
                  InputProps={{ readOnly: true }}
                  helperText="Chỉ tiền vào đúng tài khoản này mới được khớp với thanh toán."
                />
              )}

              {((mode === 'create' && !presetBankAccount) ||
                (mode === 'update' && allowBankAccountChange)) && (
                <TextField
                  select
                  fullWidth
                  label="Tài khoản nhận (không bắt buộc)"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  disabled={saving}
                  helperText={
                    bankAccounts.length === 0
                      ? 'Chưa có tài khoản ngân hàng — thêm ở tab Tài khoản ngân hàng.'
                      : 'Gắn tài khoản thì chỉ tiền vào đúng tài khoản này mới được khớp.'
                  }
                >
                  <MenuItem value="">
                    <em>{mode === 'update' ? '— Giữ nguyên —' : '— Không gắn —'}</em>
                  </MenuItem>
                  {bankAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {missingSettings.length > 0 && (
                <Alert severity="warning">
                  Còn thiếu: {missingSettings.map((k) => credentialLabel(provider, k)).join(', ')}.
                  Nhập để chạy đủ nghiệp vụ.
                </Alert>
              )}

              {provider && (
                <>
                  <Typography variant="subtitle2">Khoá kết nối</Typography>
                  <CredentialFields
                    fields={fields}
                    values={values}
                    mode={mode}
                    disabled={saving}
                    highlightKeys={missingSettings}
                    onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {mode === 'create'
                      ? 'Khoá được mã hoá trên máy chủ và không hiển thị lại. Sau khi lưu, hệ thống cấp webhook URL riêng cho kết nối này (và khoá webhook tự sinh nếu có — chỉ hiện một lần).'
                      : 'Ô khoá bí mật để trống = giữ nguyên khoá đang lưu. Chỉ phần bạn đã đổi được gửi lên.'}
                  </Typography>
                </>
              )}
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!canSave}
          onClick={handleSave}
        >
          {mode === 'create' ? 'Lưu kết nối' : 'Lưu thay đổi'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type PickerProps = {
  loading: boolean;
  providers: IPaymentProviderInfo[];
  value: string;
  accountBin?: string | null;
  onChange: (key: string) => void;
};

function ProviderPicker({ loading, providers, value, accountBin, onChange }: PickerProps) {
  if (loading) {
    return (
      <Stack spacing={1}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={64} />
        ))}
      </Stack>
    );
  }

  if (providers.length === 0) {
    return <Alert severity="info">Chưa có nhà cung cấp nào để kết nối.</Alert>;
  }

  return (
    <FormControl component="fieldset">
      <FormLabel component="legend" sx={{ mb: 1, typography: 'subtitle2', color: 'text.primary' }}>
        Chọn nguồn đối soát
      </FormLabel>
      <RadioGroup value={value} onChange={(e) => onChange(e.target.value)} sx={{ gap: 1 }}>
        {providers.map((p) => {
          const reason = providerUnavailableReason(p, accountBin);
          const selected = value === p.key;
          return (
            <Box
              key={p.key}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: (theme) =>
                  `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                opacity: reason ? 0.6 : 1,
              }}
            >
              <FormControlLabel
                value={p.key}
                disabled={!!reason}
                control={<Radio size="small" />}
                sx={{ m: 0, alignItems: 'flex-start', width: 1, '& .MuiRadio-root': { mt: -0.5 } }}
                label={
                  <Stack spacing={0.5} sx={{ pl: 0.5 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="subtitle2">{p.displayName}</Typography>
                      <Label color="info" variant="soft">
                        {connectionKindLabel(p.kind)}
                      </Label>
                      {p.free && (
                        <Label color="success" variant="soft">
                          Miễn phí
                        </Label>
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {p.summary}
                    </Typography>
                    {reason && (
                      <Typography variant="caption" sx={{ color: 'warning.main' }}>
                        {reason}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </Box>
          );
        })}
      </RadioGroup>
    </FormControl>
  );
}

// ----------------------------------------------------------------------

function ProviderGuide({
  provider,
  defaultExpanded,
}: {
  provider: IPaymentProviderInfo;
  defaultExpanded: boolean;
}) {
  const hasSteps = provider.setupSteps.length > 0;
  if (!hasSteps && !provider.portalUrl) return null;

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      variant="outlined"
      sx={{ borderRadius: 1 }}
    >
      <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
        <Typography variant="subtitle2">Các bước thiết lập {provider.displayName}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          {hasSteps && (
            <Box
              component="ol"
              sx={{ pl: 2.5, m: 0, typography: 'body2', '& li + li': { mt: 0.75 } }}
            >
              {provider.setupSteps.map((step, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}>{step}</li>
              ))}
            </Box>
          )}
          {provider.portalUrl && (
            <Link
              href={provider.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              Mở trang {paymentProviderLabel(provider.key)}
              <Iconify icon="eva:external-link-fill" width={16} />
            </Link>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
