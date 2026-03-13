'use client';

import { useState, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LoadingButton from '@mui/lab/LoadingButton';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Tiền mặt', icon: 'solar:wallet-money-bold' },
  { value: 'BankTransfer', label: 'Chuyển khoản', icon: 'solar:card-transfer-bold' },
  { value: 'QRCode', label: 'QR Code', icon: 'solar:qr-code-bold' },
];

interface PaymentLine {
  method: string;
  amount: number;
  transactionRef?: string;
  note?: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (payments: PaymentLine[]) => Promise<void>;
};

// ----------------------------------------------------------------------

export default function PosPaymentDialog({ open, onClose, totalAmount, onConfirm }: Props) {
  const theme = useTheme();
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: 'Cash', amount: totalAmount }]);
  const [loading, setLoading] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPayments([{ method: 'Cash', amount: totalAmount }]);
      setLoading(false);
    }
  }, [open, totalAmount]);

  const paidTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const changeAmount = paidTotal - totalAmount;

  const handleMethodChange = useCallback((index: number, method: string) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, method } : p)));
  }, []);

  const handleAmountChange = useCallback((index: number, amount: number) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, amount } : p)));
  }, []);

  const handleRefChange = useCallback((index: number, transactionRef: string) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, transactionRef } : p)));
  }, []);

  const handleAddPayment = useCallback(() => {
    const remaining = totalAmount - payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    setPayments((prev) => [...prev, { method: 'Cash', amount: remaining > 0 ? remaining : 0 }]);
  }, [payments, totalAmount]);

  const handleRemovePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm(payments);
    } finally {
      setLoading(false);
    }
  }, [payments, onConfirm]);

  // Quick amount buttons
  const quickAmounts = [
    totalAmount,
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= totalAmount);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Thanh toán</Typography>
          <IconButton onClick={onClose}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {/* Total amount */}
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Khách cần trả
          </Typography>
          <Typography variant="h3" color="primary.main" sx={{ fontWeight: 700 }}>
            {fCurrency(totalAmount)}
          </Typography>
        </Box>

        {/* Payment methods */}
        {payments.map((payment, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            {index > 0 && <Divider sx={{ mb: 2 }} />}

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">
                Phương thức {payments.length > 1 ? index + 1 : ''}
              </Typography>
              {payments.length > 1 && (
                <IconButton size="small" color="error" onClick={() => handleRemovePayment(index)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              )}
            </Stack>

            <ToggleButtonGroup
              exclusive
              value={payment.method}
              onChange={(_, val) => val && handleMethodChange(index, val)}
              sx={{ mb: 1.5, width: '100%' }}
            >
              {PAYMENT_METHODS.map((m) => (
                <ToggleButton
                  key={m.value}
                  value={m.value}
                  sx={{ flex: 1, py: 1 }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon={m.icon} width={20} />
                    <span>{m.label}</span>
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <TextField
              fullWidth
              size="small"
              label="Số tiền"
              type="number"
              value={payment.amount || ''}
              onChange={(e) => handleAmountChange(index, Number(e.target.value) || 0)}
              inputProps={{ min: 0 }}
              sx={{ mb: 1 }}
            />

            {/* Quick amount buttons */}
            {index === 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    size="small"
                    variant={payment.amount === amt ? 'contained' : 'outlined'}
                    onClick={() => handleAmountChange(index, amt)}
                    sx={{ minWidth: 0, px: 1.5, fontSize: '0.75rem' }}
                  >
                    {fCurrency(amt)}
                  </Button>
                ))}
              </Stack>
            )}

            {payment.method !== 'Cash' && (
              <TextField
                fullWidth
                size="small"
                label="Mã giao dịch"
                value={payment.transactionRef || ''}
                onChange={(e) => handleRefChange(index, e.target.value)}
              />
            )}
          </Box>
        ))}

        <Button
          size="small"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={handleAddPayment}
          sx={{ mb: 2 }}
        >
          Thêm phương thức thanh toán
        </Button>

        <Divider sx={{ mb: 2 }} />

        {/* Summary */}
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Tổng thanh toán
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {fCurrency(paidTotal)}
            </Typography>
          </Stack>

          {changeAmount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Tiền thừa trả khách
              </Typography>
              <Typography variant="body2" fontWeight={600} color="success.main">
                {fCurrency(changeAmount)}
              </Typography>
            </Stack>
          )}

          {changeAmount < 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Còn thiếu
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                {fCurrency(Math.abs(changeAmount))}
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Hủy
        </Button>
        <LoadingButton
          variant="contained"
          loading={loading}
          onClick={handleConfirm}
          disabled={paidTotal < totalAmount}
          sx={{ minWidth: 160, fontWeight: 700 }}
        >
          Xác nhận thanh toán
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
