'use client';

import type {
  IApiPayLinkResult,
  IPaymentConnection,
  IApiPayAvailableBank,
} from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  linkApiPayBank,
  confirmApiPayBankOtp,
  getApiPayAvailableBanks,
} from 'src/api/payment-settings';

import {
  BIN,
  isOtp,
  identityLabel,
  needsAcbUserId,
  normalizeMobile,
  accountTypesFor,
  EMPTY_LINK_FORM,
  linkFormErrors,
  toBankAccountName,
  isManualActivation,
  coreBankAccountText,
  issuesVirtualAccount,
  ACCOUNT_TYPE_OPTIONS,
} from './utils';

import type { LinkFormValues } from './utils';

// ----------------------------------------------------------------------
// Liên kết tài khoản ngân hàng vào tài khoản ApiPay của một kết nối — thay cho my.apipay.vn:
//   form (ngân hàng từ danh mục ApiPay, loại TK, số TK, tên in hoa không dấu, SĐT, CCCD/MST, ACB OneBiz) → OTP →
//   kết quả: số VA in trên QR + tài khoản đã thêm cho POS, hoặc "chờ ApiPay kích hoạt thủ công".
// SĐT / CCCD / OTP chỉ gửi đi một lần rồi xoá khỏi form; máy chủ không lưu.
// ----------------------------------------------------------------------

type Step = 'form' | 'otp' | 'done';

type Props = {
  open: boolean;
  connection: IPaymentConnection | null;
  onClose: VoidFunction;
  /** Máy chủ đã đổi (kết nối nhận tài khoản mới / chờ kích hoạt) → tải lại danh sách */
  onChanged: VoidFunction;
};

export default function ApiPayBankLinkDialog({ open, connection, onClose, onChanged }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [banks, setBanks] = useState<IApiPayAvailableBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [values, setValues] = useState<LinkFormValues>(EMPTY_LINK_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IApiPayLinkResult | null>(null);
  const [linking, setLinking] = useState<{ bankBin: string; accountNumber: string } | null>(null);

  const connectionId = connection?.id;

  // Mở lại → form trống (không giữ SĐT / CCCD trong bộ nhớ lâu hơn cần thiết) + tải danh mục ngân hàng của kết nối.
  useEffect(() => {
    if (!open || !connectionId) return;
    setStep('form');
    setValues(EMPTY_LINK_FORM);
    setShowErrors(false);
    setConsent(false);
    setOtp('');
    setBusy(false);
    setError(null);
    setResult(null);
    setLinking(null);
    setBanksLoading(true);
    setBanksError(null);
    getApiPayAvailableBanks(connectionId)
      .then(setBanks)
      .catch((err) =>
        setBanksError(apiErrorMessage(err, 'Không tải được danh sách ngân hàng ApiPay'))
      )
      .finally(() => setBanksLoading(false));
  }, [open, connectionId]);

  const errors = linkFormErrors(values);
  const bank = banks.find((b) => b.bin === values.bankBin);
  const types = accountTypesFor(values.bankBin);
  const idLabel = identityLabel(values.bankBin, values.accountType);
  const normalizedName = toBankAccountName(values.accountName);

  const set = (key: keyof LinkFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bin = e.target.value;
    setValues((v) => ({
      ...v,
      bankBin: bin,
      accountType:
        v.accountType && accountTypesFor(bin).includes(v.accountType) ? v.accountType : '',
    }));
  };

  const finish = (res: IApiPayLinkResult) => {
    setResult(res);
    setStep('done');
    onChanged();
  };

  const handleSubmit = async () => {
    if (!connectionId) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || !values.accountType) return;
    setBusy(true);
    setError(null);
    const accountNumber = values.accountNumber.replace(/\s/g, '');
    try {
      const res = await linkApiPayBank(connectionId, {
        bankBin: values.bankBin,
        bankName: bank?.name ?? '',
        accountType: values.accountType,
        accountNumber,
        accountName: normalizedName,
        mobile: normalizeMobile(values.mobile),
        ...(idLabel !== null && { identity: values.identity.replace(/\s/g, '') }),
        ...(needsAcbUserId(values.bankBin, values.accountType) && {
          acbUserId: values.acbUserId.trim(),
        }),
        ...(values.nickname.trim() && { nickname: values.nickname.trim() }),
      });
      // Đã gửi xong: bỏ SĐT / CCCD khỏi form.
      setValues((v) => ({ ...v, mobile: '', identity: '' }));
      setShowErrors(false);
      if (res.status === 'otp_required') {
        setLinking({ bankBin: values.bankBin, accountNumber });
        setResult(res);
        setStep('otp');
      } else {
        finish(res);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'ApiPay chưa nhận liên kết — kiểm tra lại thông tin'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!connectionId || !linking || !isOtp(otp)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmApiPayBankOtp(connectionId, { ...linking, otp: otp.trim() });
      setOtp('');
      finish(res);
    } catch (err) {
      setError(apiErrorMessage(err, 'Xác nhận OTP thất bại'));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: keyof LinkFormValues) => (showErrors ? errors[key] : undefined);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Liên kết ngân hàng qua ApiPay</DialogTitle>

      <DialogContent dividers>
        {step === 'form' && (
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Kết nối <b>{connection?.displayName}</b>
              {connection?.publicSettings?.environment === 'test' && ' (khoá thử nghiệm ak_test_)'}.
              Tài khoản liên kết xong sẽ là tài khoản nhận tiền của kết nối này và được thêm vào Tài
              khoản ngân hàng để màn bán hàng in QR đúng số.
            </Typography>

            {banksError && <Alert severity="error">{banksError}</Alert>}

            {banksLoading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <TextField
                select
                label="Ngân hàng"
                value={values.bankBin}
                onChange={handleBankChange}
                error={!!fieldError('bankBin')}
                helperText={fieldError('bankBin')}
                disabled={!banks.length}
              >
                {banks.map((b) => (
                  <MenuItem key={b.bin} value={b.bin}>
                    {b.name}
                    {b.shortName && b.shortName !== b.name ? ` (${b.shortName})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="Loại tài khoản"
              value={values.accountType}
              onChange={set('accountType')}
              error={!!fieldError('accountType')}
              helperText={fieldError('accountType')}
            >
              {ACCOUNT_TYPE_OPTIONS.filter((o) => types.includes(o.value)).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>

            {values.bankBin === BIN.VIETINBANK && (
              <Alert severity="warning">
                Giao dịch VietinBank qua ApiPay không có nội dung chuyển khoản — hệ thống không đọc
                được mã thanh toán nên tiền về không tự xác nhận. Nên chọn ngân hàng khác.
              </Alert>
            )}
            {isManualActivation(values.bankBin, values.accountType) && (
              <Alert severity="info">
                Ngân hàng / loại tài khoản này kích hoạt thủ công: không có OTP, ApiPay liên hệ chủ
                tài khoản và kích hoạt trong tối đa 24 giờ.
              </Alert>
            )}

            <TextField
              label="Số tài khoản"
              value={values.accountNumber}
              onChange={set('accountNumber')}
              error={!!fieldError('accountNumber')}
              helperText={
                fieldError('accountNumber') ??
                (issuesVirtualAccount(values.bankBin)
                  ? 'Số tài khoản gốc — ApiPay cấp tài khoản ảo (VA), QR sẽ in số VA'
                  : undefined)
              }
              inputProps={{ autoComplete: 'off' }}
            />

            <TextField
              label="Tên chủ tài khoản"
              value={values.accountName}
              onChange={set('accountName')}
              onBlur={() =>
                setValues((v) => ({ ...v, accountName: toBankAccountName(v.accountName) }))
              }
              error={!!fieldError('accountName')}
              helperText={
                fieldError('accountName') ??
                (normalizedName && normalizedName !== values.accountName
                  ? `Gửi ApiPay: ${normalizedName}`
                  : 'In hoa không dấu, đúng như trên app ngân hàng')
              }
              inputProps={{ autoComplete: 'off' }}
            />

            <TextField
              label="SĐT đăng ký với ngân hàng"
              value={values.mobile}
              onChange={set('mobile')}
              error={!!fieldError('mobile')}
              helperText={fieldError('mobile') ?? 'Ngân hàng gửi OTP tới số này'}
              inputProps={{ inputMode: 'tel', autoComplete: 'off' }}
            />

            {idLabel !== null && (
              <TextField
                label={idLabel}
                value={values.identity}
                onChange={set('identity')}
                error={!!fieldError('identity')}
                helperText={fieldError('identity')}
                inputProps={{ autoComplete: 'off' }}
              />
            )}

            {needsAcbUserId(values.bankBin, values.accountType) && (
              <TextField
                label="Tên đăng nhập ACB OneBiz"
                value={values.acbUserId}
                onChange={set('acbUserId')}
                error={!!fieldError('acbUserId')}
                helperText={fieldError('acbUserId')}
                inputProps={{ autoComplete: 'off' }}
              />
            )}

            <TextField
              label="Tên gợi nhớ (tuỳ chọn)"
              value={values.nickname}
              onChange={set('nickname')}
              error={!!fieldError('nickname')}
              helperText={fieldError('nickname') ?? 'Chỉ hiện trên ApiPay, khách không thấy'}
            />

            <FormControlLabel
              control={
                <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              }
              label={
                <Typography variant="body2">
                  Tôi là chủ tài khoản (hoặc được uỷ quyền) và đồng ý gửi các thông tin trên cho
                  ApiPay để ngân hàng xác minh. Hệ thống cửa hàng không lưu SĐT, CCCD / mã số thuế.
                </Typography>
              }
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {step === 'otp' && (
          <Stack spacing={2.5}>
            <Alert severity="info">
              {result?.message || 'Ngân hàng đã gửi mã OTP tới SĐT đăng ký.'} Nhập mã để hoàn tất
              liên kết tài khoản {linking?.accountNumber}.
            </Alert>
            <TextField
              autoFocus
              label="Mã OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmOtp();
              }}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {step === 'done' && result && <LinkResult result={result} />}
      </DialogContent>

      <DialogActions>
        {step === 'form' && (
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>
              Huỷ
            </Button>
            <LoadingButton
              variant="contained"
              loading={busy}
              disabled={!consent || banksLoading || !banks.length}
              onClick={handleSubmit}
            >
              Gửi liên kết
            </LoadingButton>
          </>
        )}
        {step === 'otp' && (
          <>
            <Button
              color="inherit"
              disabled={busy}
              onClick={() => {
                setOtp('');
                setError(null);
                setStep('form');
              }}
            >
              Nhập lại thông tin
            </Button>
            <LoadingButton
              variant="contained"
              loading={busy}
              disabled={!isOtp(otp)}
              onClick={handleConfirmOtp}
            >
              Xác nhận OTP
            </LoadingButton>
          </>
        )}
        {step === 'done' && (
          <Button variant="contained" onClick={onClose}>
            Xong
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function LinkResult({ result }: { result: IApiPayLinkResult }) {
  const { applied } = result;
  const core = coreBankAccountText(result.coreBankAccount);

  if (result.status !== 'active' || !applied) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">{result.message || 'ApiPay đang kích hoạt tài khoản.'}</Alert>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Khi ApiPay kích hoạt xong, bấm <b>Kiểm tra lại</b> ở mục Liên kết ngân hàng qua ApiPay: hệ
          thống tự gắn tài khoản (số VA nếu có) vào kết nối và thêm vào Tài khoản ngân hàng.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Alert severity="success">
        Đã liên kết {applied.bankName || applied.bankShortName || 'ngân hàng'} — kết nối{' '}
        <b>{result.connection.displayName}</b> nhận tiền qua tài khoản này.
      </Alert>
      <Stack spacing={0.5}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Số in trên QR
        </Typography>
        <Typography variant="h5" sx={{ fontFamily: 'monospace' }}>
          {applied.accountNumber}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {applied.virtualAccount
            ? `Tài khoản ảo (VA) ApiPay của TK ${applied.originalAccountNumber} — khách phải chuyển vào số VA thì tiền về mới tự xác nhận.`
            : 'Ngân hàng không cấp tài khoản ảo — QR in số tài khoản gốc.'}
          {applied.accountName ? ` Chủ tài khoản: ${applied.accountName}.` : ''}
        </Typography>
      </Stack>
      {core && <Alert severity={result.coreBankAccount?.error ? 'warning' : 'info'}>{core}</Alert>}
    </Stack>
  );
}
