'use client';

import type { IOpenOrder, FnbPaymentMethod } from 'src/types/fnb';
import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fCurrency } from 'src/utils/format-number';

import { getBankAccounts } from 'src/api/bank-accounts';

import { changeDue, quickCashOptions } from './lib/checkout';

import type { PaymentInput } from './lib/checkout';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  order: IOpenOrder | null;
  /** Tổng sẽ thanh toán (đơn trên máy chủ + món đang chọn chưa gửi, xem trước). */
  total: number;
  /** Còn món đang chọn chưa gửi — sẽ gửi bar cùng lúc thanh toán. */
  hasDrafts: boolean;
  busy: boolean;
  onClose: VoidFunction;
  onPay: (payment: PaymentInput) => void;
};

export default function FnbCheckoutDialog({ open, order, total, hasDrafts, busy, onClose, onPay }: Props) {
  const [method, setMethod] = useState<FnbPaymentMethod>('Cash');
  const [cash, setCash] = useState('');
  const [accounts, setAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [transferRef, setTransferRef] = useState('');

  useEffect(() => {
    if (!open) return;
    setMethod('Cash');
    setCash('');
    setTransferRef(order ? `${order.tableName ?? 'Mang ve'} ${order.displayNo}` : '');
    getBankAccounts()
      .then((list) => {
        setAccounts(list);
        setAccountId((current) => current || list[0]?.id || '');
      })
      .catch(() => setAccounts([]));
  }, [open, order]);

  const cashGiven = cash === '' ? null : Number(cash);
  const tooLow = method === 'Cash' && cashGiven !== null && cashGiven < total;

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Thanh toán · {fCurrency(total)}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {hasDrafts && <Alert severity="info">Món đang chọn sẽ được gửi bar cùng lúc thanh toán.</Alert>}

          <ToggleButtonGroup exclusive fullWidth value={method} onChange={(_, v) => v && setMethod(v)}>
            <ToggleButton value="Cash">Tiền mặt</ToggleButton>
            <ToggleButton value="Transfer">Chuyển khoản</ToggleButton>
            <ToggleButton value="Card">Thẻ</ToggleButton>
          </ToggleButtonGroup>

          {method === 'Cash' && (
            <Stack spacing={1.5}>
              <TextField
                type="number"
                label="Khách đưa"
                value={cash}
                placeholder={String(total)}
                onChange={(e) => setCash(e.target.value)}
                inputProps={{ min: 0, step: 1000 }}
                error={tooLow}
                helperText={tooLow ? 'Khách đưa ít hơn tổng tiền.' : 'Để trống = khách đưa vừa đủ.'}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickCashOptions(total).map((amount) => (
                  <Chip key={amount} label={fCurrency(amount)} onClick={() => setCash(String(amount))} />
                ))}
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1">Tiền thối</Typography>
                <Typography variant="subtitle1" color="primary.main">
                  {fCurrency(changeDue(total, cashGiven))}
                </Typography>
              </Stack>
            </Stack>
          )}

          {method === 'Transfer' && (
            <Stack spacing={1.5}>
              <TextField
                select
                label="Tài khoản nhận"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                helperText={accounts.length === 0 ? 'Chưa khai tài khoản ngân hàng của cửa hàng — vẫn ghi nhận được.' : undefined}
              >
                <MenuItem value="">— Không chọn —</MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {[a.shortName || a.bankName, a.accountNumber, a.description].filter(Boolean).join(' · ')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Nội dung chuyển khoản" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} />
              <Typography variant="caption" color="text.secondary">
                Bấm thanh toán khi đã thấy tiền về tài khoản.
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={busy}
          disabled={tooLow}
          onClick={() =>
            onPay({
              method,
              cashGiven: method === 'Cash' ? cashGiven : null,
              bankAccountId: method === 'Transfer' ? accountId || null : null,
              transferRef: method === 'Transfer' ? transferRef : null,
            })
          }
        >
          Thanh toán
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
