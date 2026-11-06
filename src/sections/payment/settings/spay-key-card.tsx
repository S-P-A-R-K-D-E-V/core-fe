'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { getVietQRBanks } from 'src/api/bank-accounts';

import {
  disconnectSPay,
  setSPayPaymentsViaV2,
  getSPayAccounts,
  connectSPayApiKey,
  getSPayConnectStatus,
  type SPayBankAccount,
  type SPayConnectStatus,
} from 'src/api/spay-connect';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { SPayLogo } from 'src/components/spay-logo';
import { ProviderLogos } from 'src/components/provider-logo';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Kết nối S Payment bằng khoá ứng dụng: chủ cửa hàng tạo khoá ở S Payment → Ứng dụng & khoá API (Access key sp_live_… + Secret)
// rồi dán vào đây. Liên kết / gỡ tài khoản ngân hàng, xem giao dịch, đối soát đều làm trên S Payment — tab Tài khoản ngân
// hàng của S Store chỉ là dữ liệu (số TK hiện ở quầy).
// ----------------------------------------------------------------------

export default function SPayKeyCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [status, setStatus] = useState<SPayConnectStatus | null>(null);
  const [accounts, setAccounts] = useState<SPayBankAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  // Logo ngân hàng theo BIN từ danh sách VietQR (như quầy).
  const [bankLogos, setBankLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    getVietQRBanks()
      .then((banks) => setBankLogos(Object.fromEntries(banks.map((b) => [b.bin, b.logo]))))
      .catch(() => {});
  }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await getSPayAccounts());
      setAccountsError(null);
    } catch (error) {
      setAccountsError(apiErrorMessage(error, 'Không tải được tài khoản trên S Payment'));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await getSPayConnectStatus();
      setStatus(next);
      setLoadError(null);
      if (next.status === 'connected' && next.mode === 'api_key') loadAccounts();
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Không tải được trạng thái kết nối S Payment'));
    }
  }, [loadAccounts]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const next = await connectSPayApiKey(accessKey.trim(), secret.trim());
      setStatus(next);
      setSecret('');
      setEditing(false);
      enqueueSnackbar('Đã kết nối S Payment', { variant: 'success' });
      loadAccounts();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Chưa kết nối được S Payment'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleViaV2 = async (enabled: boolean) => {
    const ok = await confirm({
      title: enabled ? 'Chuyển thanh toán sang S Payment?' : 'Quay về kết nối cũ?',
      content: enabled
        ? 'QR ở quầy và đơn online sẽ tạo bằng khoá của cửa hàng; S Payment chọn tài khoản / kênh báo tiền về theo chính sách ' +
          'Chia tải & chi phí. Tài khoản chưa liên kết trên S Payment vẫn tạo được QR nhưng thu ngân tự kiểm tra tiền về.'
        : 'Thanh toán mới quay về kết nối chung như trước. Thanh toán đang chờ vẫn được cập nhật bình thường.',
      confirmText: enabled ? 'Chuyển' : 'Quay về',
      cancelText: 'Huỷ',
    });
    if (!ok) return;
    setBusy(true);
    try {
      setStatus(await setSPayPaymentsViaV2(enabled));
      enqueueSnackbar(enabled ? 'Thanh toán đã chuyển sang S Payment' : 'Đã quay về kết nối cũ', {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Chưa đổi được cách thanh toán'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Ngắt kết nối S Payment?',
      content:
        'S Store xoá khoá đã lưu. Muốn khoá hết hiệu lực hẳn, thu hồi khoá trên S Payment → Ứng dụng & khoá API.\n' +
        'Tài khoản ngân hàng và giao dịch trên S Payment giữ nguyên.',
      confirmText: 'Ngắt kết nối',
      cancelText: 'Huỷ',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disconnectSPay();
      setAccounts(null);
      enqueueSnackbar('Đã ngắt kết nối S Payment', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Chưa ngắt được kết nối'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!status) return <Skeleton variant="rounded" height={220} />;

  const connected = status.status === 'connected';
  const showForm = !connected || editing;

  return (
    <Card>
      <CardHeader
        avatar={<SPayLogo size={28} />}
        title="Kết nối S Payment"
        subheader="S Payment quản lý tài khoản ngân hàng nhận tiền, báo tiền về và đối soát cho cửa hàng."
        action={
          <Stack direction="row" spacing={1}>
            {connected && !status.livemode && <Label color="warning">Khoá thử nghiệm</Label>}
            <Label color={connected ? 'success' : 'default'}>
              {connected ? 'Đã kết nối' : 'Chưa kết nối'}
            </Label>
          </Stack>
        }
      />
      <CardContent>
        <Stack spacing={2.5}>
          {connected && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {status.accessKey ? (
                  <>
                    Khoá <b style={{ fontFamily: 'monospace' }}>{status.accessKey}</b>
                  </>
                ) : (
                  'Kết nối bằng nút Kết nối S Payment'
                )}
                {status.connectedAt ? ` · kết nối lúc ${fDateTime(status.connectedAt)}` : ''}
              </Typography>
              {!status.workspaceMatchesStore && (
                <Alert severity="warning">
                  Khoá này thuộc một workspace S Payment khác cửa hàng hiện tại. Kiểm tra lại
                  workspace khi tạo khoá trên S Payment.
                </Alert>
              )}
            </Stack>
          )}

          {connected && status.mode === 'api_key' && (
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <div>
                  <Typography variant="subtitle2">Thanh toán qua S Payment</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {status.paymentsViaV2
                      ? 'Đang bật — QR quầy và đơn online tạo bằng khoá của cửa hàng, S Payment tự chọn tài khoản và kênh báo tiền về.'
                      : 'Đang tắt — thanh toán vẫn đi qua kết nối chung như trước. Bật để S Payment quản lý theo chính sách của cửa hàng.'}
                  </Typography>
                </div>
                <Switch
                  checked={!!status.paymentsViaV2}
                  disabled={busy}
                  onChange={(e) => handleViaV2(e.target.checked)}
                  inputProps={{ 'aria-label': 'Thanh toán qua S Payment' }}
                />
              </Stack>
            </Stack>
          )}

          {connected && status.mode === 'api_key' && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Tài khoản nhận tiền trên S Payment</Typography>
              {accountsError && <Alert severity="warning">{accountsError}</Alert>}
              {!accountsError && accounts === null && <Skeleton variant="rounded" height={48} />}
              {accounts?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Chưa có tài khoản — bấm Quản lý tài khoản ngân hàng để liên kết trên S Payment.
                </Typography>
              )}
              {accounts?.map((a) => (
                <Stack
                  key={a.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography
                    variant="body2"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                  >
                    {a.bin && bankLogos[a.bin] ? (
                      <Box
                        component="img"
                        src={bankLogos[a.bin]}
                        alt={a.bankName}
                        sx={{ height: 18, maxWidth: 72, objectFit: 'contain' }}
                      />
                    ) : (
                      <b>{a.bankName}</b>
                    )}{' '}
                    · <span style={{ fontFamily: 'monospace' }}>{a.accountNumber}</span>
                    {a.accountName ? ` · ${a.accountName}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <ProviderLogos providers={a.providers ?? []} />
                    <Label color={a.autoConfirm ? 'success' : 'default'}>
                      {a.autoConfirm ? 'Tự xác nhận' : 'Xác nhận tay'}
                    </Label>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}

          {showForm && (
            <>
              {connected && <Divider />}
              <Typography variant="body2" color="text.secondary">
                1. Mở S Payment → <b>Ứng dụng &amp; khoá API</b> → Tạo khoá live. 2. Chép{' '}
                <b>Access key</b> và <b>Secret</b> (dán cả chuỗi Bearer vào ô Secret cũng được;
                Secret chỉ hiện một lần) rồi dán vào đây.
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Access key"
                  placeholder="sp_live_…"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  autoComplete="off"
                  fullWidth
                  inputProps={{ spellCheck: false }}
                />
                <TextField
                  label="Secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                />
              </Stack>
            </>
          )}

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {showForm ? (
              <>
                <LoadingButton
                  variant="contained"
                  loading={busy}
                  disabled={!accessKey.trim() || !secret.trim()}
                  onClick={handleConnect}
                  startIcon={<Iconify icon="solar:link-bold" />}
                >
                  {connected ? 'Lưu khoá mới' : 'Kết nối'}
                </LoadingButton>
                <Button
                  variant="outlined"
                  href={`${status.portalUrl}/developer`}
                  target="_blank"
                  rel="noopener"
                >
                  Tạo khoá trên S Payment
                </Button>
                {connected && (
                  <Button color="inherit" onClick={() => setEditing(false)}>
                    Huỷ
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  href={status.banksUrl}
                  target="_blank"
                  rel="noopener"
                  startIcon={<Iconify icon="solar:card-bold" />}
                >
                  Quản lý tài khoản ngân hàng
                </Button>
                <Button variant="outlined" onClick={() => setEditing(true)}>
                  Đổi khoá
                </Button>
                <LoadingButton
                  color="error"
                  variant="outlined"
                  loading={busy}
                  onClick={handleDisconnect}
                >
                  Ngắt kết nối
                </LoadingButton>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
