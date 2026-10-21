'use client';

import type { IBankLink, IBankLinkBank, BankLinkAccountType } from 'src/types/payment-service';

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

import { getBankLinkBanks, confirmBankLink, registerBankLink } from 'src/api/payment-settings';

import OtpStep from './otp-step';
import { coreBankAccountText } from '../apipay-bank-link/utils';
import {
  isOtp,
  identityLabel,
  cleanIdentity,
  normalizeMobile,
  toBankAccountName,
  cleanAccountNumber,
  registerFormErrors,
  EMPTY_REGISTER_FORM,
  ACCOUNT_TYPE_LABELS,
} from './utils';

import type { RegisterFormValues } from './utils';

// ----------------------------------------------------------------------
// "Đăng ký báo có tài khoản" (như KiotViet): ngân hàng → số TK, chủ TK, loại TK, CCCD hoặc MST/ĐKKD, SĐT đã đăng ký tại
// ngân hàng, đồng ý → OTP ngân hàng gửi về SĐT đó → xong. S Payment gọi ngân hàng bằng khoá của SPARK; chủ cửa hàng
// không nhập khoá nào. CCCD / SĐT chỉ giữ trong form tới khi xong (để gửi lại mã), máy chủ không lưu.
// ----------------------------------------------------------------------

type Step = 'form' | 'otp' | 'done';

export type BankLinkPreset = {
  bank?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
};

type Props = {
  open: boolean;
  /** Điền sẵn từ tài khoản ngân hàng của cửa hàng */
  preset?: BankLinkPreset | null;
  /** Tiếp tục bản đăng ký đang chờ OTP */
  resume?: IBankLink | null;
  onClose: VoidFunction;
  /** Máy chủ đã đổi → tải lại danh sách */
  onChanged: VoidFunction;
};

export default function BankLinkRegisterDialog({
  open,
  preset,
  resume,
  onClose,
  onChanged,
}: Props) {
  const [step, setStep] = useState<Step>('form');
  const [banks, setBanks] = useState<IBankLinkBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [values, setValues] = useState<RegisterFormValues>(EMPTY_REGISTER_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<IBankLink | null>(null);

  // Mở lại → form mới (không giữ CCCD / SĐT lâu hơn cần) + tải danh mục ngân hàng.
  useEffect(() => {
    if (!open) return;
    const start = resume ?? null;
    setStep(start ? 'otp' : 'form');
    setLink(start);
    setValues({
      ...EMPTY_REGISTER_FORM,
      bank: start?.bank ?? preset?.bank ?? '',
      accountNumber: start?.accountNumber ?? preset?.accountNumber ?? '',
      accountName: start?.accountName ?? preset?.accountName ?? '',
      accountType: start?.accountType ?? '',
    });
    setShowErrors(false);
    setConsent(false);
    setOtp('');
    setBusy(false);
    setError(null);
    setBanksLoading(true);
    setBanksError(null);
    getBankLinkBanks()
      .then(setBanks)
      .catch((err) => setBanksError(apiErrorMessage(err, 'Không tải được danh sách ngân hàng')))
      .finally(() => setBanksLoading(false));
  }, [open, preset, resume]);

  const bank = banks.find((b) => b.code === values.bank);
  const types = bank?.accountTypes ?? (Object.keys(ACCOUNT_TYPE_LABELS) as BankLinkAccountType[]);
  const errors = registerFormErrors(values);
  const fieldError = (key: keyof RegisterFormValues) => (showErrors ? errors[key] : undefined);
  const canResend = !!values.identity && !!values.mobile;

  const set = (key: keyof RegisterFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const finish = (res: IBankLink) => {
    // Xong: bỏ CCCD / SĐT khỏi bộ nhớ.
    setValues((v) => ({ ...v, identity: '', mobile: '' }));
    setLink(res);
    setStep('done');
    onChanged();
  };

  const submit = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || !values.accountType || !bank?.available) return;
    setBusy(true);
    setError(null);
    try {
      const res = await registerBankLink({
        bank: values.bank,
        accountNumber: cleanAccountNumber(values.accountNumber),
        accountName: toBankAccountName(values.accountName),
        accountType: values.accountType,
        identity: cleanIdentity(values.identity),
        mobile: normalizeMobile(values.mobile),
        policyAgree: consent,
      });
      setShowErrors(false);
      setOtp('');
      if (res.status === 'otp_required') {
        setLink(res);
        setStep('otp');
        onChanged();
      } else {
        finish(res);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Ngân hàng chưa nhận đăng ký — kiểm tra lại thông tin'));
      // Lỗi khi gửi lại mã: quay về form để sửa thông tin.
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!link || !isOtp(otp)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmBankLink(link.id, otp.trim());
      setOtp('');
      finish(res);
    } catch (err) {
      setError(apiErrorMessage(err, 'Xác thực OTP thất bại'));
    } finally {
      setBusy(false);
    }
  };

  const core = coreBankAccountText(link?.coreBankAccount);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Đăng ký báo có tài khoản</DialogTitle>

      <DialogContent dividers>
        {step === 'form' && (
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ngân hàng gửi thông báo tiền về cho S Payment để màn thu ngân tự xác nhận chuyển khoản
              qua QR. Nhập đúng thông tin chủ tài khoản đã đăng ký tại ngân hàng — ngân hàng gửi OTP
              tới SĐT đó.
            </Typography>

            {banksError && <Alert severity="error">{banksError}</Alert>}

            {banksLoading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <TextField
                select
                label="Ngân hàng"
                value={values.bank}
                onChange={set('bank')}
                error={!!fieldError('bank')}
                helperText={fieldError('bank')}
                disabled={!banks.length}
              >
                {banks.map((b) => (
                  <MenuItem key={b.code} value={b.code} disabled={!b.available}>
                    {b.name}
                    {!b.available && ' — chưa mở'}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {bank && !bank.available && (
              <Alert severity="warning">{bank.unavailableReason || 'Chưa đăng ký được.'}</Alert>
            )}

            <TextField
              label="Số tài khoản"
              value={values.accountNumber}
              onChange={set('accountNumber')}
              error={!!fieldError('accountNumber')}
              helperText={fieldError('accountNumber')}
              inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            />

            <TextField
              label="Chủ tài khoản"
              value={values.accountName}
              onChange={set('accountName')}
              onBlur={() =>
                setValues((v) => ({ ...v, accountName: toBankAccountName(v.accountName) }))
              }
              error={!!fieldError('accountName')}
              helperText={
                fieldError('accountName') ?? 'In hoa không dấu, đúng như trên app ngân hàng'
              }
              inputProps={{ autoComplete: 'off' }}
            />

            <TextField
              select
              label="Loại tài khoản"
              value={values.accountType}
              onChange={set('accountType')}
              error={!!fieldError('accountType')}
              helperText={fieldError('accountType')}
            >
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={identityLabel(values.accountType)}
              value={values.identity}
              onChange={set('identity')}
              error={!!fieldError('identity')}
              helperText={fieldError('identity')}
              inputProps={{ autoComplete: 'off' }}
            />

            <TextField
              label="Số điện thoại"
              value={values.mobile}
              onChange={set('mobile')}
              error={!!fieldError('mobile')}
              helperText={fieldError('mobile') ?? 'SĐT chủ tài khoản đã đăng ký tại ngân hàng'}
              inputProps={{ inputMode: 'tel', autoComplete: 'off' }}
            />

            <FormControlLabel
              control={
                <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              }
              label={
                <Typography variant="body2">
                  {bank?.consent ??
                    'Tôi đồng ý để ngân hàng cung cấp thông tin giao dịch của tài khoản cho SPARK để thông báo tiền về khi thanh toán QR.'}{' '}
                  Hệ thống không lưu CCCD / mã số thuế và SĐT.
                </Typography>
              }
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {step === 'otp' && link && (
          <OtpStep
            intro={`Nhập mã OTP ${link.bankName || 'ngân hàng'} gửi để hoàn tất đăng ký tài khoản ${link.accountNumber}.`}
            maskedMobile={link.maskedMobile}
            otpSentAt={link.otpSentAt}
            otp={otp}
            onOtpChange={setOtp}
            onSubmit={confirm}
            onResend={canResend ? submit : () => setStep('form')}
            resendLabel={canResend ? 'Gửi lại mã' : 'Nhập lại thông tin để gửi mã mới'}
            busy={busy}
            error={error}
          />
        )}

        {step === 'done' && link && (
          <Stack spacing={2}>
            <Alert severity="success">
              Đăng ký dịch vụ thành công — tiền chuyển vào tài khoản <b>{link.accountNumber}</b> (
              {link.bankName}) qua QR sẽ tự xác nhận trên màn thu ngân.
            </Alert>
            {core && (
              <Alert severity={link.coreBankAccount?.error ? 'warning' : 'info'}>{core}</Alert>
            )}
          </Stack>
        )}
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
              disabled={!consent || banksLoading || !bank?.available}
              onClick={submit}
            >
              Đăng ký
            </LoadingButton>
          </>
        )}
        {step === 'otp' && (
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>
              Để sau
            </Button>
            <LoadingButton
              variant="contained"
              loading={busy}
              disabled={!isOtp(otp)}
              onClick={confirm}
            >
              Xác nhận
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
