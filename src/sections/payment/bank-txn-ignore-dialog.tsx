'use client';

import type { IBankTxn } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { ignoreBankTransaction } from 'src/api/payment-reconciliation';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Bỏ qua giao dịch không phải tiền bán hàng (chuyển nội bộ, hoàn tiền, lãi…) — không còn nằm trong "Chưa khớp".
// ----------------------------------------------------------------------

type Props = {
  txn: IBankTxn | null;
  onClose: VoidFunction;
  onIgnored: (txn: IBankTxn) => void;
};

export default function BankTxnIgnoreDialog({ txn, onClose, onIgnored }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (txn) setReason('');
  }, [txn]);

  const handleIgnore = async () => {
    if (!txn || !reason.trim()) return;
    setSaving(true);
    try {
      const res = await ignoreBankTransaction(txn.id, reason.trim());
      enqueueSnackbar('Đã bỏ qua giao dịch');
      onIgnored(res);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Bỏ qua giao dịch thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={!!txn} onClose={saving ? undefined : onClose}>
      <DialogTitle>Bỏ qua giao dịch</DialogTitle>
      <DialogContent>
        {txn && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {fCurrency(txn.amount)} · {fDateTime(txn.bookedAt)} — {txn.content || 'không có nội dung'}
            </Typography>
            <TextField
              autoFocus
              multiline
              minRows={2}
              label="Lý do"
              placeholder="vd: chuyển tiền nội bộ, hoàn tiền nhà cung cấp…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!reason.trim()} onClick={handleIgnore}>
          Bỏ qua
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
