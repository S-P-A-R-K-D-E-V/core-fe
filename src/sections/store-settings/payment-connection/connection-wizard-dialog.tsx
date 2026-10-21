'use client';

import type { IVietQRBank } from 'src/types/corecms-api';
import type { IPaymentConnection, IPaymentProviderInfo } from 'src/types/payment-service';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Step from '@mui/material/Step';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stepper from '@mui/material/Stepper';
import Skeleton from '@mui/material/Skeleton';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CardActionArea from '@mui/material/CardActionArea';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { getVietQRBanks } from 'src/api/bank-accounts';
import { createPaymentConnection } from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import CredentialFields from './credential-fields';
import { ProviderGuide } from './connection-form-dialog';
import BankAccountFormDialog from '../bank-account/bank-account-form-dialog';
import {
  findProvider,
  bankDirectName,
  groupProviders,
  needsReceivingAccount,
  missingRequiredFields,
  buildCreateCredentials,
  initialCredentialValues,
  suggestedConnectionName,
  providerUnavailableReason,
} from './utils';

import type { CredentialValues } from './utils';
import type { BankAccountOption } from './connection-form-dialog';

// ----------------------------------------------------------------------
// Thêm kết nối qua S Payment theo 3 bước: (1) chọn dịch vụ (gom nhóm: ngân hàng trực tiếp / bên thứ ba / cổng thanh toán)
// → (2) tài khoản nhận: chọn tài khoản của cửa hàng, thêm tài khoản mới ngay tại đây, hoặc để trống (ngân hàng trực tiếp:
// dùng cho mọi tài khoản cùng ngân hàng — thu ngân chọn tài khoản ở quầy) → (3) thông tin kết nối theo danh mục của
// S Payment. Cổng thanh toán bỏ bước 2; tạo từ một tài khoản (presetBankAccount) cũng bỏ bước 2.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  providers: IPaymentProviderInfo[];
  providersLoading?: boolean;
  providersError?: string | null;
  bankAccounts?: BankAccountOption[];
  /** Tạo từ một tài khoản: gắn sẵn tài khoản này, bỏ bước chọn tài khoản */
  presetBankAccount?: BankAccountOption | null;
  /** Đã thêm tài khoản mới trong trình hướng dẫn → nơi gọi tải lại danh sách tài khoản */
  onBankAccountsChanged?: () => Promise<void> | void;
  onClose: VoidFunction;
  onSaved: (connection: IPaymentConnection) => void;
};

type StepKey = 'service' | 'account' | 'details';

const STEP_LABEL: Record<StepKey, string> = {
  service: 'Chọn dịch vụ',
  account: 'Tài khoản nhận',
  details: 'Thông tin kết nối',
};

export default function ConnectionWizardDialog({
  open,
  providers,
  providersLoading,
  providersError,
  bankAccounts = [],
  presetBankAccount,
  onBankAccountsChanged,
  onClose,
  onSaved,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState<StepKey>('service');
  const [providerKey, setProviderKey] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [values, setValues] = useState<CredentialValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [banks, setBanks] = useState<IVietQRBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState(false);

  const groups = useMemo(() => groupProviders(providers), [providers]);
  const provider = findProvider(providers, providerKey);
  const fields = useMemo(() => provider?.fields ?? [], [provider]);
  const steps: StepKey[] =
    provider && (!needsReceivingAccount(provider) || presetBankAccount)
      ? ['service', 'details']
      : ['service', 'account', 'details'];
  const stepIndex = Math.max(0, steps.indexOf(step));

  const account = presetBankAccount ?? bankAccounts.find((a) => a.id === bankAccountId) ?? null;

  // Mở lại → làm từ đầu (không giữ khoá vừa gõ lâu hơn cần thiết)
  useEffect(() => {
    if (!open) return;
    setStep('service');
    setProviderKey('');
    setBankAccountId('');
    setDisplayName('');
    setValues({});
    setError(null);
    setSaving(false);
  }, [open]);

  // Đổi dịch vụ → ô khoá về giá trị ban đầu của dịch vụ đó
  useEffect(() => {
    if (!open) return;
    setValues(initialCredentialValues(fields, 'create'));
  }, [open, fields]);

  const pickProvider = (p: IPaymentProviderInfo) => {
    setProviderKey(p.key);
    setError(null);
    // Tài khoản đã chọn không dùng được với ngân hàng trực tiếp khác → bỏ chọn.
    const chosen = bankAccounts.find((a) => a.id === bankAccountId);
    if (chosen && providerUnavailableReason(p, chosen.bin)) setBankAccountId('');
  };

  const openAccountForm = () => {
    setAccountFormOpen(true);
    if (banks.length > 0 || banksLoading) return;
    setBanksLoading(true);
    setBanksError(false);
    getVietQRBanks()
      .then(setBanks)
      .catch(() => setBanksError(true))
      .finally(() => setBanksLoading(false));
  };

  const missing = provider ? missingRequiredFields(fields, values, 'create') : [];
  const providerReason = provider
    ? providerUnavailableReason(provider, presetBankAccount?.bin)
    : null;
  const canNext = step === 'account' || (step === 'service' && !!provider && !providerReason);
  const canSave = !!provider && missing.length === 0 && !saving;

  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (!next) return;
    if (next === 'details' && provider && !displayName.trim())
      setDisplayName(suggestedConnectionName(provider, account?.accountNumber));
    setStep(next);
  };

  const goBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await createPaymentConnection({
        provider: provider.key,
        displayName: displayName.trim() || provider.displayName,
        bankAccountId: needsReceivingAccount(provider) ? account?.id || undefined : undefined,
        credentials: buildCreateCredentials(fields, values),
      });
      enqueueSnackbar('Đã thêm kết nối qua S Payment');
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Thêm kết nối thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        fullWidth
        maxWidth="md"
        scroll="paper"
        open={open}
        onClose={saving ? undefined : onClose}
        aria-labelledby="payment-connection-wizard-title"
      >
        <DialogTitle id="payment-connection-wizard-title">
          Kết nối thanh toán qua S Payment
          {presetBankAccount ? ` · ${presetBankAccount.label}` : ''}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            <Stepper activeStep={stepIndex} alternativeLabel>
              {steps.map((s) => (
                <Step key={s}>
                  <StepLabel>{STEP_LABEL[s]}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {providersError && <Alert severity="error">{providersError}</Alert>}

            {step === 'service' && (
              <ServiceStep
                loading={!!providersLoading}
                groups={groups}
                value={providerKey}
                accountBin={presetBankAccount?.bin}
                onPick={pickProvider}
              />
            )}

            {step === 'account' && provider && (
              <AccountStep
                provider={provider}
                accounts={bankAccounts}
                value={bankAccountId}
                onChange={setBankAccountId}
                onAdd={openAccountForm}
              />
            )}

            {step === 'details' && provider && (
              <Stack spacing={2.5}>
                <ProviderGuide provider={provider} defaultExpanded />

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Tài khoản nhận:
                  </Typography>
                  <Typography variant="subtitle2">
                    {!needsReceivingAccount(provider)
                      ? 'Không cần (cổng thanh toán)'
                      : account
                        ? account.label
                        : provider.kind === 'bank_direct'
                          ? `Mọi tài khoản ${bankDirectName(provider)} của cửa hàng`
                          : 'Chưa gắn — gắn sau ở danh sách kết nối'}
                  </Typography>
                </Stack>

                <TextField
                  fullWidth
                  label="Tên kết nối"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={saving}
                  helperText="Tên thu ngân thấy khi chọn nguồn xác nhận chuyển khoản ở quầy."
                />

                <Typography variant="subtitle2">Thông tin kết nối</Typography>
                <CredentialFields
                  fields={fields}
                  values={values}
                  mode="create"
                  disabled={saving}
                  onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Khoá được mã hoá trên máy chủ S Payment và không hiển thị lại. Ô không bắt buộc có
                  thể bổ sung sau bằng Cập nhật khi ngân hàng cấp. Lưu xong sẽ có webhook URL riêng
                  cho kết nối này (và khoá webhook tự sinh nếu có — chỉ hiện một lần).
                </Typography>
                {missing.length > 0 && (
                  <Alert severity="info">
                    Còn thiếu: {missing.map((f) => f.label).join(', ')}.
                  </Alert>
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
          {stepIndex > 0 && (
            <Button variant="outlined" onClick={goBack} disabled={saving}>
              Quay lại
            </Button>
          )}
          {step !== 'details' ? (
            <Button variant="contained" onClick={goNext} disabled={!canNext}>
              Tiếp tục
            </Button>
          ) : (
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!canSave}
              onClick={handleSave}
            >
              Lưu kết nối
            </LoadingButton>
          )}
        </DialogActions>
      </Dialog>

      <BankAccountFormDialog
        open={accountFormOpen}
        banks={banks}
        banksLoading={banksLoading}
        banksError={banksError}
        onClose={() => setAccountFormOpen(false)}
        onSaved={async (createdId) => {
          setAccountFormOpen(false);
          await onBankAccountsChanged?.();
          if (createdId) setBankAccountId(createdId);
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------------

type ServiceStepProps = {
  loading: boolean;
  groups: ReturnType<typeof groupProviders>;
  value: string;
  accountBin?: string | null;
  onPick: (provider: IPaymentProviderInfo) => void;
};

function ServiceStep({ loading, groups, value, accountBin, onPick }: ServiceStepProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Box>
    );
  }

  if (groups.length === 0) {
    return <Alert severity="info">S Payment chưa có dịch vụ nào để kết nối.</Alert>;
  }

  return (
    <Stack spacing={3}>
      {groups.map((group) => (
        <Stack key={group.kind} spacing={1.5}>
          <Stack spacing={0.25}>
            <Typography variant="subtitle1">{group.title}</Typography>
            {group.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {group.description}
              </Typography>
            )}
          </Stack>
          <Box
            sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
          >
            {group.providers.map((p) => {
              const reason = providerUnavailableReason(p, accountBin);
              const selected = value === p.key;
              return (
                <Card
                  key={p.key}
                  variant="outlined"
                  sx={{
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderWidth: selected ? 2 : 1,
                    opacity: reason ? 0.55 : 1,
                  }}
                >
                  <CardActionArea
                    disabled={!!reason}
                    onClick={() => onPick(p)}
                    aria-pressed={selected}
                    sx={{ p: 2, height: 1, alignItems: 'flex-start', display: 'flex' }}
                  >
                    <Stack spacing={0.75} sx={{ width: 1 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {selected && (
                          <Iconify
                            icon="eva:checkmark-circle-2-fill"
                            sx={{ color: 'primary.main' }}
                          />
                        )}
                        <Typography variant="subtitle2">{p.displayName}</Typography>
                        {p.free && (
                          <Label color="success" variant="soft">
                            Miễn phí
                          </Label>
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {p.summary}
                      </Typography>
                      {reason && (
                        <Typography variant="caption" sx={{ color: 'warning.main' }}>
                          {reason}
                        </Typography>
                      )}
                    </Stack>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------

type AccountStepProps = {
  provider: IPaymentProviderInfo;
  accounts: BankAccountOption[];
  value: string;
  onChange: (id: string) => void;
  onAdd: VoidFunction;
};

function AccountStep({ provider, accounts, value, onChange, onAdd }: AccountStepProps) {
  const bankDirect = provider.kind === 'bank_direct';
  const usable = accounts.filter((a) => !providerUnavailableReason(provider, a.bin));
  const others = accounts.filter((a) => !!providerUnavailableReason(provider, a.bin));

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {bankDirect
          ? `QR động của ${bankDirectName(provider)} chỉ thu vào tài khoản mở tại ${bankDirectName(provider)}. Gắn một tài khoản, hoặc để trống để kết nối dùng cho mọi tài khoản ${bankDirectName(provider)} của cửa hàng — thu ngân chọn tài khoản ở quầy.`
          : 'Gắn tài khoản thì chỉ tiền vào đúng tài khoản này mới được khớp, và thu ngân chọn được kết nối này ở quầy.'}
      </Typography>

      <RadioGroup value={value} onChange={(e) => onChange(e.target.value)} sx={{ gap: 1 }}>
        {usable.map((a) => (
          <AccountOption key={a.id} value={a.id} selected={value === a.id} label={a.label} />
        ))}
        <AccountOption
          value=""
          selected={value === ''}
          label={
            bankDirect
              ? `Không gắn — mọi tài khoản ${bankDirectName(provider)} của cửa hàng`
              : 'Chưa gắn — gắn sau (ApiPay: liên kết ngân hàng bằng OTP sau khi tạo)'
          }
        />
      </RadioGroup>

      {others.length > 0 && bankDirect && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {others.length} tài khoản ngân hàng khác không dùng được với {bankDirectName(provider)}.
        </Typography>
      )}

      <Box>
        <Button variant="outlined" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onAdd}>
          Thêm tài khoản mới
        </Button>
      </Box>
    </Stack>
  );
}

function AccountOption({
  value,
  selected,
  label,
}: {
  value: string;
  selected: boolean;
  label: string;
}) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        border: (theme) =>
          `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
      }}
    >
      <FormControlLabel
        value={value}
        control={<Radio size="small" />}
        label={<Typography variant="body2">{label}</Typography>}
        sx={{ m: 0, width: 1 }}
      />
    </Box>
  );
}
