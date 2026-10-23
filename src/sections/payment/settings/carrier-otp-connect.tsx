'use client';

import type { IShippingCarrier, ILinkedCarrierAccount } from 'src/types/online-shop';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { useCountdownSeconds } from 'src/hooks/use-countdown';

import { apiErrorMessage } from 'src/utils/api-error';

import { sendCarrierOtp, getCarrierAccounts, linkCarrierAccount, createShippingConnection } from 'src/api/online-shop';

import { useSnackbar } from 'src/components/snackbar';

import { isShopRef, normalizeVnPhone } from './shipping-connect-utils';

// ----------------------------------------------------------------------
// Kết nối hãng mà nền tảng giữ khoá (GHN): chọn shop đã liên kết / được nền tảng gán, hoặc liên kết shop mới bằng SĐT chủ
// shop + mã OTP hãng gửi về SĐT đó. Cửa hàng không bao giờ nhập token; một shop chỉ thuộc một cửa hàng.
// ----------------------------------------------------------------------

type Props = {
  carrier: IShippingCarrier;
  environment: string;
  displayName: string;
  settings: Record<string, string>;
  onSaved: () => void;
};

export default function CarrierOtpConnect({ carrier, environment, displayName, settings, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const resend = useCountdownSeconds(60);

  const [accounts, setAccounts] = useState<ILinkedCarrierAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** "otp" | "link" | mã shop đang kết nối */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [shopRef, setShopRef] = useState('');

  const accountKey = carrier.credentials[0]?.key ?? 'shopId';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAccounts(await getCarrierAccounts(carrier.code, environment));
    } catch (err) {
      setAccounts([]);
      setLoadError(apiErrorMessage(err, 'Không tải được danh sách shop'));
    }
  }, [carrier.code, environment]);

  useEffect(() => {
    setAccounts(null);
    load();
  }, [load]);

  const connect = async (account: ILinkedCarrierAccount) => {
    await createShippingConnection({
      carrier: carrier.code,
      environment,
      displayName: displayName.trim() || `${carrier.label} — ${account.name}`,
      credentials: { [accountKey]: account.accountRef },
      settings,
    });
    enqueueSnackbar('Đã kết nối hãng vận chuyển');
    onSaved();
  };

  const connectExisting = async (account: ILinkedCarrierAccount) => {
    setBusy(account.accountRef);
    setError(null);
    try {
      await connect(account);
    } catch (err) {
      setError(apiErrorMessage(err, 'Kết nối thất bại'));
    } finally {
      setBusy(null);
    }
  };

  const sendOtp = async () => {
    const normalized = normalizeVnPhone(phone);
    if (!normalized) {
      setError('SĐT không hợp lệ (10 số, bắt đầu bằng 0)');
      return;
    }
    setBusy('otp');
    setError(null);
    try {
      await sendCarrierOtp(carrier.code, { environment, phone: normalized });
      setOtpSent(true);
      resend.startCountdown();
      enqueueSnackbar(`Đã gửi mã OTP tới ${normalized}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Gửi OTP thất bại'));
    } finally {
      setBusy(null);
    }
  };

  const linkAndConnect = async () => {
    const normalized = normalizeVnPhone(phone);
    if (!normalized || !otp.trim() || !isShopRef(shopRef)) return;
    setBusy('link');
    setError(null);
    try {
      const account = await linkCarrierAccount(carrier.code, {
        environment,
        phone: normalized,
        otp: otp.trim(),
        accountRef: shopRef.trim(),
      });
      await connect(account);
    } catch (err) {
      setError(apiErrorMessage(err, 'Liên kết shop thất bại'));
      // Liên kết xong mà kết nối lỗi: shop đã nằm trong danh sách, bấm Kết nối lại được.
      await load();
    } finally {
      setBusy(null);
    }
  };

  const shopInvalid = !!shopRef.trim() && !isShopRef(shopRef);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Shop của cửa hàng</Typography>
      {accounts === null && <CircularProgress size={20} />}
      {loadError && <Alert severity="warning">{loadError}</Alert>}
      {accounts?.length === 0 && !loadError && (
        <Typography variant="body2" color="text.secondary">
          Chưa có shop nào — liên kết shop của cửa hàng bằng SĐT chủ shop ở bên dưới.
        </Typography>
      )}
      {accounts?.map((a) => (
        <Stack
          key={a.accountRef}
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ p: 1.5, borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {a.name}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                #{a.accountRef}
              </Typography>
            </Typography>
            {a.address && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {a.address}
              </Typography>
            )}
            {!a.available && (
              <Typography variant="caption" color="error.main" display="block">
                Nền tảng không còn thấy shop này — liên kết lại bằng OTP
              </Typography>
            )}
          </Box>
          {a.source === 'assigned' && <Chip size="small" variant="outlined" label="Nền tảng gán" />}
          {a.connectionIds.length > 0 ? (
            <Chip size="small" color="success" variant="soft" label="Đã kết nối" />
          ) : (
            <LoadingButton
              size="small"
              variant="contained"
              loading={busy === a.accountRef}
              disabled={!a.available || (!!busy && busy !== a.accountRef)}
              onClick={() => connectExisting(a)}
            >
              Kết nối
            </LoadingButton>
          )}
        </Stack>
      ))}

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Typography variant="subtitle2">Liên kết shop bằng SĐT chủ shop</Typography>
      <Typography variant="body2" color="text.secondary">
        Nhập SĐT đăng nhập {carrier.label} của chủ shop. Hãng gửi mã OTP về SĐT đó; nhập mã OTP và mã shop để liên kết — không cần
        token. Cước vẫn trừ vào tài khoản hãng của cửa hàng.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          label="SĐT chủ shop"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
          disabled={busy === 'link'}
        />
        <LoadingButton
          variant="outlined"
          loading={busy === 'otp'}
          disabled={!phone.trim() || resend.counting || (!!busy && busy !== 'otp')}
          onClick={sendOtp}
          sx={{ flexShrink: 0, height: 56 }}
        >
          {resend.counting ? `Gửi lại (${resend.countdown}s)` : otpSent ? 'Gửi lại OTP' : 'Gửi OTP'}
        </LoadingButton>
      </Stack>
      {otpSent && (
        <>
          <TextField
            label="Mã OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
            helperText="Mã OTP có hiệu lực 10 phút"
          />
          <TextField
            label="Mã shop (ShopId)"
            value={shopRef}
            onChange={(e) => setShopRef(e.target.value)}
            inputProps={{ inputMode: 'numeric' }}
            error={shopInvalid}
            helperText={
              shopInvalid
                ? 'Mã shop là số'
                : 'khachhang.ghn.vn → Quản lý cửa hàng → mã (ID) của shop dùng làm kho lấy hàng'
            }
          />
          <LoadingButton
            variant="contained"
            loading={busy === 'link'}
            disabled={!otp.trim() || !isShopRef(shopRef) || (!!busy && busy !== 'link')}
            onClick={linkAndConnect}
          >
            Liên kết &amp; kết nối
          </LoadingButton>
        </>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
