'use client';

import type { IBankLink, IBankLinkBank } from 'src/types/payment-service';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { apiErrorMessage } from 'src/utils/api-error';

import { getBankLinks, revokeBankLink, getBankLinkBanks } from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import BankLinkRevokeDialog from './bank-link-revoke-dialog';
import { sortBankLinks, bankLinkStatus, ACCOUNT_TYPE_LABELS } from './utils';
import ConfirmActionDialog from '../payment-connection/confirm-action-dialog';
import BankLinkRegisterDialog, { type BankLinkPreset } from './bank-link-register-dialog';

// ----------------------------------------------------------------------
// "Đăng ký dịch vụ thông báo thanh toán QR" (như KiotViet): mỗi tài khoản đã đăng ký một thẻ — chủ TK, số TK, ngân hàng,
// trạng thái, Huỷ đăng ký; "Đăng ký" mở form theo ngân hàng + OTP. Khoá ngân hàng do SPARK giữ ở S Payment.
// ----------------------------------------------------------------------

type Props = {
  /** Đăng ký / huỷ xong → tải lại phần khác của trang (kết nối, tài khoản ngân hàng) */
  onChanged?: VoidFunction;
};

export default function BankLinkCard({ onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [links, setLinks] = useState<IBankLink[]>([]);
  const [banks, setBanks] = useState<IBankLinkBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [preset, setPreset] = useState<BankLinkPreset | null>(null);
  const [resume, setResume] = useState<IBankLink | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IBankLink | null>(null);
  const [dropTarget, setDropTarget] = useState<IBankLink | null>(null);
  const [dropping, setDropping] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, catalog] = await Promise.all([
        getBankLinks(),
        getBankLinkBanks().catch(() => []),
      ]);
      setLinks(sortBankLinks(list));
      setBanks(catalog);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tải được tài khoản đăng ký báo có'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const openRegister = (p: BankLinkPreset | null, r: IBankLink | null) => {
    setPreset(p);
    setResume(r);
    setRegisterOpen(true);
  };

  const handleDrop = async () => {
    if (!dropTarget) return;
    setDropping(true);
    try {
      // Chưa xác thực OTP thì ngân hàng chưa đăng ký — máy chủ chỉ bỏ bản ghi chờ.
      await revokeBankLink(dropTarget.id, { identity: '', mobile: '' });
      setDropTarget(null);
      changed();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không bỏ được đăng ký'), { variant: 'error' });
    } finally {
      setDropping(false);
    }
  };

  const available = banks.filter((b) => b.available);
  const waiting = banks.filter((b) => !b.available);

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">Đăng ký dịch vụ thông báo thanh toán QR</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ngân hàng báo tiền về cho S Payment — khách quét QR chuyển khoản là màn thu ngân tự
              xác nhận. Chỉ cần số tài khoản, CCCD hoặc mã số thuế, SĐT chủ tài khoản và mã OTP ngân
              hàng gửi.
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => openRegister(null, null)}
            disabled={loading || (banks.length > 0 && available.length === 0)}
            sx={{ flexShrink: 0 }}
          >
            Đăng ký
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {waiting.length > 0 && (
          <Alert severity="info">
            {waiting.map((b) => `${b.name}: ${b.unavailableReason || 'chưa mở'}`).join(' · ')}
          </Alert>
        )}

        {loading && <Skeleton variant="rounded" height={120} />}

        {!loading && links.length === 0 && !error && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chưa có tài khoản nào đăng ký báo có.
            {available.length > 0 && ` Đăng ký được: ${available.map((b) => b.name).join(', ')}.`}
          </Typography>
        )}

        {links.length > 0 && (
          <Grid container spacing={2}>
            {links.map((l) => (
              <Grid key={l.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <BankLinkItem
                  link={l}
                  onOtp={() =>
                    l.status === 'revoking' ? setRevokeTarget(l) : openRegister(null, l)
                  }
                  onRevoke={() => setRevokeTarget(l)}
                  onDrop={() => setDropTarget(l)}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {links.length > 0 && available.length > 0 && (
          <Button
            size="small"
            onClick={() => openRegister(null, null)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Bạn có tài khoản khác? Đăng ký
          </Button>
        )}
      </Stack>

      <BankLinkRegisterDialog
        open={registerOpen}
        preset={preset}
        resume={resume}
        onClose={() => setRegisterOpen(false)}
        onChanged={changed}
      />

      <BankLinkRevokeDialog
        link={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onChanged={changed}
      />

      <ConfirmActionDialog
        open={!!dropTarget}
        title="Bỏ đăng ký đang chờ OTP?"
        confirmLabel="Bỏ đăng ký"
        loading={dropping}
        onClose={() => setDropTarget(null)}
        onConfirm={handleDrop}
        content={
          <>
            Tài khoản <b>{dropTarget?.accountNumber}</b> chưa xác thực OTP nên ngân hàng chưa đăng
            ký. Bỏ để đăng ký lại từ đầu.
          </>
        }
      />
    </Card>
  );
}

// ----------------------------------------------------------------------

type ItemProps = {
  link: IBankLink;
  onOtp: VoidFunction;
  onRevoke: VoidFunction;
  onDrop: VoidFunction;
};

function BankLinkItem({ link: l, onOtp, onRevoke, onDrop }: ItemProps) {
  const status = bankLinkStatus(l);
  return (
    <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack spacing={1} sx={{ height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" noWrap>
            {l.bankName}
          </Typography>
          <Label color={status.color}>{status.label}</Label>
        </Stack>
        <Typography variant="body2" noWrap title={l.accountName}>
          {l.accountName}
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'monospace', letterSpacing: 1, wordBreak: 'break-all' }}
        >
          {l.accountNumber}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {ACCOUNT_TYPE_LABELS[l.accountType] ?? l.accountType}
          {l.maskedMobile ? ` · OTP tới ${l.maskedMobile}` : ''}
        </Typography>
        {!!l.lastError && (
          <Alert severity="warning" sx={{ py: 0 }}>
            {l.lastError}
          </Alert>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 'auto', pt: 1 }}>
          {l.status === 'active' && (
            <Button size="small" color="error" onClick={onRevoke}>
              Huỷ đăng ký
            </Button>
          )}
          {l.status === 'otp_required' && (
            <>
              <Button size="small" variant="outlined" onClick={onOtp}>
                Nhập OTP
              </Button>
              <Button size="small" color="inherit" onClick={onDrop}>
                Bỏ
              </Button>
            </>
          )}
          {l.status === 'revoking' && (
            <Button size="small" variant="outlined" color="error" onClick={onOtp}>
              Nhập OTP huỷ
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
