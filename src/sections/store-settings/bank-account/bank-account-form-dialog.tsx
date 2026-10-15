'use client';

import type { IVietQRBank } from 'src/types/corecms-api';
import type { IBankAccountWithConnections } from 'src/types/payment-service';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { createBankAccount, updateBankAccount } from 'src/api/bank-accounts';

import { useSnackbar } from 'src/components/snackbar';

import {
  DESCRIPTION_MAX,
  matchesBankQuery,
  ACCOUNT_HOLDER_MAX,
  ACCOUNT_NUMBER_MAX,
  sanitizeAccountNumber,
  fieldErrorsFromProblem,
  normalizeAccountHolder,
  validateBankAccountForm,
} from './utils';

import type { BankAccountFormErrors, BankAccountFormValues } from './utils';

// ----------------------------------------------------------------------
// Thêm / sửa tài khoản ngân hàng cửa hàng tự khai (POST / PUT bank-accounts, Admin). Ngân hàng chọn từ danh sách VietQR
// (đặt bin + bankName + shortName). Dòng đồng bộ KiotViet không mở được form này.
// ----------------------------------------------------------------------

const EMPTY: BankAccountFormValues = {
  bin: '',
  bankName: '',
  shortName: '',
  accountNumber: '',
  accountHolder: '',
  description: '',
  isDefault: false,
  isActive: true,
};

type Props = {
  open: boolean;
  /** Có = sửa tài khoản này */
  account?: IBankAccountWithConnections | null;
  banks: IVietQRBank[];
  banksLoading: boolean;
  banksError: boolean;
  onClose: VoidFunction;
  onSaved: VoidFunction;
};

export default function BankAccountFormDialog({
  open,
  account,
  banks,
  banksLoading,
  banksError,
  onClose,
  onSaved,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const editing = !!account;
  const [values, setValues] = useState<BankAccountFormValues>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<BankAccountFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    setServerErrors({});
    setGeneralError(null);
    setSaving(false);
    setValues(
      account
        ? {
            bin: account.bin ?? '',
            bankName: account.bankName ?? '',
            shortName: account.shortName ?? '',
            accountNumber: account.accountNumber ?? '',
            accountHolder: account.accountHolder ?? '',
            description: account.description ?? '',
            isDefault: account.isDefault,
            isActive: account.isActive,
          }
        : EMPTY
    );
  }, [open, account]);

  // Danh sách VietQR không có ngân hàng đang lưu (hoặc không tải được) → vẫn hiện ngân hàng đó để sửa ô khác.
  const options = useMemo(() => {
    if (!values.bin || banks.some((b) => b.bin === values.bin)) return banks;
    const current: IVietQRBank = {
      id: -1,
      name: values.bankName || values.shortName,
      code: '',
      bin: values.bin,
      shortName: values.shortName || values.bankName,
      logo: '',
      transferSupported: 1,
      lookupSupported: 0,
    };
    return [current, ...banks];
  }, [banks, values.bin, values.bankName, values.shortName]);

  const selectedBank = options.find((b) => b.bin === values.bin) ?? null;

  const clientErrors = validateBankAccountForm(values);
  const errors: BankAccountFormErrors = { ...(showErrors ? clientErrors : {}), ...serverErrors };

  const set = <K extends keyof BankAccountFormValues>(key: K, value: BankAccountFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Sửa ô nào thì bỏ lỗi máy chủ của ô đó
    const field = key === 'bin' || key === 'bankName' || key === 'shortName' ? 'bank' : key;
    setServerErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as keyof BankAccountFormErrors];
      return next;
    });
  };

  const handleSave = async () => {
    const normalized: BankAccountFormValues = {
      ...values,
      accountNumber: sanitizeAccountNumber(values.accountNumber),
      accountHolder: normalizeAccountHolder(values.accountHolder),
    };
    setValues(normalized);
    setShowErrors(true);
    setGeneralError(null);
    if (Object.keys(validateBankAccountForm(normalized)).length > 0) return;

    setSaving(true);
    try {
      const base = {
        bin: normalized.bin.trim(),
        bankName: normalized.bankName.trim(),
        shortName: normalized.shortName.trim() || null,
        accountNumber: normalized.accountNumber,
        accountHolder: normalized.accountHolder,
        description: normalized.description.trim() || null,
      };
      if (account) {
        await updateBankAccount(account.id, {
          ...base,
          isDefault: normalized.isActive && normalized.isDefault,
          isActive: normalized.isActive,
        });
        enqueueSnackbar('Đã cập nhật tài khoản ngân hàng');
      } else {
        // Không bật "mặc định" → bỏ trống: tài khoản đầu tiên của cửa hàng tự thành mặc định.
        await createBankAccount({ ...base, isDefault: normalized.isDefault || undefined });
        enqueueSnackbar('Đã thêm tài khoản ngân hàng');
      }
      onSaved();
    } catch (err) {
      const fieldErrors = fieldErrorsFromProblem(err);
      setServerErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setGeneralError(
          apiErrorMessage(err, editing ? 'Cập nhật tài khoản thất bại' : 'Thêm tài khoản thất bại')
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={saving ? undefined : onClose}
      aria-labelledby="bank-account-form-title"
    >
      <DialogTitle id="bank-account-form-title">
        {editing ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {banksError && (
            <Alert severity="warning">
              Không tải được danh sách ngân hàng từ VietQR — kiểm tra mạng rồi mở lại hộp thoại.
            </Alert>
          )}

          <Autocomplete
            options={options}
            value={selectedBank}
            loading={banksLoading}
            disabled={saving}
            autoHighlight
            onChange={(_, bank) => {
              set('bin', bank?.bin ?? '');
              set('bankName', bank?.name ?? '');
              set('shortName', bank?.shortName ?? '');
            }}
            filterOptions={(list, state) =>
              list.filter((b) => matchesBankQuery(b, state.inputValue))
            }
            getOptionLabel={(b) =>
              b.shortName && b.name && b.shortName !== b.name
                ? `${b.shortName} — ${b.name}`
                : b.shortName || b.name
            }
            isOptionEqualToValue={(a, b) => a.bin === b.bin}
            noOptionsText="Không thấy ngân hàng"
            loadingText="Đang tải danh sách ngân hàng…"
            renderOption={(props, b) => {
              const { key, ...rest } = props as typeof props & { key?: React.Key };
              return (
                <Box component="li" key={key ?? `${b.bin}-${b.id}`} {...rest} sx={{ gap: 1.5 }}>
                  <Avatar
                    src={b.logo || undefined}
                    alt=""
                    variant="rounded"
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'common.white',
                      '& img': { objectFit: 'contain' },
                    }}
                  >
                    {b.shortName?.charAt(0)}
                  </Avatar>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {b.shortName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {b.name}
                    </Typography>
                  </Stack>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Ngân hàng"
                placeholder="Tìm theo tên, tên viết tắt hoặc mã"
                error={!!errors.bank}
                helperText={errors.bank}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: selectedBank?.logo ? (
                    <InputAdornment position="start">
                      <Box
                        component="img"
                        src={selectedBank.logo}
                        alt=""
                        sx={{ width: 48, height: 24, objectFit: 'contain' }}
                      />
                    </InputAdornment>
                  ) : (
                    params.InputProps.startAdornment
                  ),
                }}
              />
            )}
          />

          <TextField
            required
            fullWidth
            label="Số tài khoản"
            value={values.accountNumber}
            disabled={saving}
            onChange={(e) => set('accountNumber', sanitizeAccountNumber(e.target.value))}
            error={!!errors.accountNumber}
            helperText={
              errors.accountNumber ??
              'Chỉ chữ số (tài khoản định danh có thể có chữ cái), không khoảng trắng.'
            }
            inputProps={{
              inputMode: 'numeric',
              maxLength: ACCOUNT_NUMBER_MAX,
              autoComplete: 'off',
              spellCheck: false,
            }}
            InputProps={{ sx: { fontFamily: 'monospace', letterSpacing: 1 } }}
          />

          <TextField
            required
            fullWidth
            label="Chủ tài khoản"
            value={values.accountHolder}
            disabled={saving}
            onChange={(e) => set('accountHolder', e.target.value)}
            onBlur={() => set('accountHolder', normalizeAccountHolder(values.accountHolder))}
            error={!!errors.accountHolder}
            helperText={
              errors.accountHolder ??
              'Viết hoa, không dấu — đúng tên chủ tài khoản trên app ngân hàng (vd NGUYEN VAN A). Tên này in trên mã VietQR.'
            }
            inputProps={{
              maxLength: ACCOUNT_HOLDER_MAX,
              autoComplete: 'off',
              style: { textTransform: 'uppercase' },
            }}
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Ghi chú"
            placeholder="vd: Tài khoản quầy 1"
            value={values.description}
            disabled={saving}
            onChange={(e) => set('description', e.target.value)}
            error={!!errors.description}
            helperText={
              errors.description ??
              'Hiện cạnh số tài khoản khi nhân viên chọn tài khoản nhận ở quầy.'
            }
            inputProps={{ maxLength: DESCRIPTION_MAX }}
          />

          <Stack spacing={0.5}>
            <FormControlLabel
              disabled={saving || !values.isActive}
              control={
                <Switch
                  checked={values.isDefault}
                  onChange={(e) => set('isDefault', e.target.checked)}
                />
              }
              label="Tài khoản mặc định"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', pl: 6 }}>
              Màn bán hàng chọn sẵn tài khoản này khi tạo mã QR.
              {!editing && ' Không bật: tài khoản đầu tiên của cửa hàng tự thành mặc định.'}
            </Typography>
          </Stack>

          {editing && (
            <Stack spacing={0.5}>
              <FormControlLabel
                disabled={saving}
                control={
                  <Switch
                    checked={values.isActive}
                    onChange={(e) => {
                      set('isActive', e.target.checked);
                      if (!e.target.checked) set('isDefault', false);
                    }}
                  />
                }
                label="Đang dùng"
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', pl: 6 }}>
                Tắt: tài khoản không hiện ở màn bán hàng nữa (vẫn giữ lịch sử).
              </Typography>
            </Stack>
          )}

          {generalError && <Alert severity="error">{generalError}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          {editing ? 'Lưu thay đổi' : 'Thêm tài khoản'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
