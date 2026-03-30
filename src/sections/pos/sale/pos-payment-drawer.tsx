'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';
import LoadingButton from '@mui/lab/LoadingButton';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';
import { ICustomer } from 'src/types/corecms-api';

import PosQrPayment from './pos-qr-payment';

// ----------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Tiền mặt', icon: 'solar:wallet-money-bold' },
  { value: 'BankTransfer', label: 'Chuyển khoản', icon: 'solar:card-transfer-bold' },
  { value: 'Card', label: 'Thẻ', icon: 'solar:card-bold' },
  { value: 'EWallet', label: 'Ví', icon: 'solar:smartphone-bold' },
];

export interface PaymentLine {
  method: string;
  amount: number;
  transactionRef?: string;
  note?: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  totalItems: number;
  subTotal: number;
  orderDiscount: number;
  couponCode: string;
  customerId?: string;
  customerName?: string;
  customers: ICustomer[];
  warehouseName?: string;
  sellerName?: string;
  onCustomerChange: (customer: ICustomer | null) => void;
  onDiscountChange: (discount: number) => void;
  onCouponChange: (coupon: string) => void;
  onConfirm: (payments: PaymentLine[]) => Promise<void>;
};

// ----------------------------------------------------------------------

export default function PosPaymentDrawer({
  open,
  onClose,
  totalAmount,
  totalItems,
  subTotal,
  orderDiscount,
  couponCode,
  customerId,
  customerName,
  customers,
  warehouseName,
  sellerName,
  onCustomerChange,
  onDiscountChange,
  onCouponChange,
  onConfirm,
}: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['Cash']);
  const [methodAmounts, setMethodAmounts] = useState<Record<string, number>>({});
  const [methodRefs, setMethodRefs] = useState<Record<string, string>>({});
  const [customerPayment, setCustomerPayment] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState<string>('');

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedMethods(['Cash']);
      setMethodAmounts({ Cash: totalAmount });
      setMethodRefs({});
      setCustomerPayment(totalAmount);
      setLoading(false);
      setDiscountInput(orderDiscount > 0 ? String(orderDiscount) : '');
    }
  }, [open, totalAmount, orderDiscount]);

  const handleToggleMethod = useCallback(
    (method: string) => {
      setSelectedMethods((prev) => {
        if (prev.includes(method)) {
          const newMethods = prev.filter((m) => m !== method);
          if (newMethods.length === 0) return prev; // Must have at least 1
          // Clear removed method amount
          setMethodAmounts((a) => {
            const copy = { ...a };
            delete copy[method];
            return copy;
          });
          return newMethods;
        }
        // Adding a new method — auto-fill its amount with remaining
        const currentPaid = prev.reduce((s, m) => s + (methodAmounts[m] || 0), 0);
        const remaining = Math.max(0, totalAmount - currentPaid);
        setMethodAmounts((a) => ({ ...a, [method]: remaining }));
        return [...prev, method];
      });
    },
    [methodAmounts, totalAmount]
  );

  const handleAmountChange = useCallback((method: string, amount: number) => {
    setMethodAmounts((prev) => ({ ...prev, [method]: amount }));
  }, []);

  const handleRefChange = useCallback((method: string, ref: string) => {
    setMethodRefs((prev) => ({ ...prev, [method]: ref }));
  }, []);

  const paidTotal = useMemo(
    () => selectedMethods.reduce((sum, m) => sum + (methodAmounts[m] || 0), 0),
    [selectedMethods, methodAmounts]
  );

  const changeAmount = paidTotal - totalAmount;

  const handleDiscountApply = useCallback(() => {
    const numVal = Number(discountInput) || 0;
    if (discountMode === 'percent') {
      onDiscountChange(Math.round((subTotal * numVal) / 100));
    } else {
      onDiscountChange(numVal);
    }
  }, [discountInput, discountMode, subTotal, onDiscountChange]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const payments: PaymentLine[] = selectedMethods
        .filter((m) => (methodAmounts[m] || 0) > 0)
        .map((m) => ({
          method: m,
          amount: methodAmounts[m] || 0,
          transactionRef: methodRefs[m] || undefined,
        }));
      await onConfirm(payments);
    } finally {
      setLoading(false);
    }
  }, [selectedMethods, methodAmounts, methodRefs, onConfirm]);

  // Quick amount buttons
  const quickAmounts = useMemo(() => {
    const amounts = [
      totalAmount,
      Math.ceil(totalAmount / 10000) * 10000,
      Math.ceil(totalAmount / 50000) * 50000,
      Math.ceil(totalAmount / 100000) * 100000,
    ];
    return amounts.filter((v, i, arr) => arr.indexOf(v) === i && v >= totalAmount).slice(0, 4);
  }, [totalAmount]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: theme.palette.primary.main,
          color: 'white',
        }}
      >
        <Typography variant="h6">Thanh toán</Typography>
        <IconButton sx={{ color: 'white' }} onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {/* Seller & Time */}
        <Stack spacing={1} sx={{ px: 2, py: 1.5, bgcolor: theme.palette.grey[50] }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Người bán
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {sellerName || 'Admin'}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Thời gian
            </Typography>
            <Typography variant="body2">
              {now.toLocaleDateString('vi-VN')} {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Kênh bán
            </Typography>
            <Typography variant="body2">{warehouseName || '—'}</Typography>
          </Stack>
        </Stack>

        <Divider />

        {/* Customer */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Autocomplete
            size="small"
            options={customers}
            getOptionLabel={(option) =>
              `${option.name}${option.phone ? ` (${option.phone})` : ''}`
            }
            value={customers.find((c) => c.id === customerId) || null}
            onChange={(_, v) => onCustomerChange(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Tìm khách hàng (F4)"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {!customerId && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Mặc định: Khách lẻ
            </Typography>
          )}
        </Box>

        <Divider />

        {/* Order summary */}
        <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Tổng tiền hàng
            </Typography>
            <Stack direction="row" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {totalItems} SP
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {fCurrency(subTotal)}
              </Typography>
            </Stack>
          </Stack>

          {/* Discount */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Giảm giá
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Button
                size="small"
                variant={discountMode === 'percent' ? 'contained' : 'outlined'}
                onClick={() => setDiscountMode('percent')}
                sx={{ minWidth: 30, px: 0.5, fontSize: '0.7rem' }}
              >
                %
              </Button>
              <Button
                size="small"
                variant={discountMode === 'amount' ? 'contained' : 'outlined'}
                onClick={() => setDiscountMode('amount')}
                sx={{ minWidth: 38, px: 0.5, fontSize: '0.7rem' }}
              >
                VNĐ
              </Button>
              <TextField
                size="small"
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onBlur={handleDiscountApply}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscountApply()}
                sx={{ width: 100 }}
                inputProps={{ min: 0, style: { textAlign: 'right' } }}
              />
            </Stack>
          </Stack>

          {orderDiscount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ textAlign: 'right' }}>
              -{fCurrency(orderDiscount)}
            </Typography>
          )}

          {/* Coupon */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Mã coupon
            </Typography>
            <TextField
              size="small"
              placeholder="Nhập mã"
              value={couponCode}
              onChange={(e) => onCouponChange(e.target.value)}
              sx={{ width: 140 }}
              inputProps={{ style: { textAlign: 'right' } }}
            />
          </Stack>

          <Divider />

          {/* Grand total */}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>
              Khách cần trả
            </Typography>
            <Typography variant="h5" fontWeight={700} color="error.main">
              {fCurrency(totalAmount > 0 ? totalAmount : 0)}
            </Typography>
          </Stack>

          {/* Customer payment */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Khách thanh toán
            </Typography>
            <TextField
              size="small"
              type="number"
              value={customerPayment || ''}
              onChange={(e) => setCustomerPayment(Number(e.target.value) || 0)}
              sx={{ width: 140 }}
              inputProps={{ min: 0, style: { textAlign: 'right', fontWeight: 600 } }}
            />
          </Stack>

          {/* Quick amounts */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                size="small"
                variant={customerPayment === amt ? 'contained' : 'outlined'}
                onClick={() => {
                  setCustomerPayment(amt);
                  if (selectedMethods.length === 1) {
                    setMethodAmounts({ [selectedMethods[0]]: amt });
                  }
                }}
                sx={{ minWidth: 0, px: 1, fontSize: '0.7rem' }}
              >
                {fCurrency(amt)}
              </Button>
            ))}
          </Stack>
        </Stack>

        <Divider />

        {/* Payment methods */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Phương thức thanh toán
          </Typography>

          <Stack spacing={1}>
            {PAYMENT_METHODS.map((pm) => {
              const isSelected = selectedMethods.includes(pm.value);
              return (
                <Box key={pm.value}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleMethod(pm.value)}
                      />
                    }
                    label={
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Iconify icon={pm.icon} width={18} />
                        <span>{pm.label}</span>
                      </Stack>
                    }
                  />

                  {isSelected && (
                    <Box sx={{ pl: 4, pb: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Số tiền"
                        value={methodAmounts[pm.value] || ''}
                        onChange={(e) => handleAmountChange(pm.value, Number(e.target.value) || 0)}
                        inputProps={{ min: 0 }}
                        sx={{ mb: 1 }}
                      />

                      {pm.value !== 'Cash' && (
                        <TextField
                          fullWidth
                          size="small"
                          label="Mã giao dịch"
                          value={methodRefs[pm.value] || ''}
                          onChange={(e) => handleRefChange(pm.value, e.target.value)}
                          sx={{ mb: 1 }}
                        />
                      )}

                      {pm.value === 'BankTransfer' && (
                        <PosQrPayment
                          amount={methodAmounts[pm.value] || totalAmount}
                        />
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Divider />

        {/* Summary */}
        <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
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
      </Box>

      {/* Action buttons */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <LoadingButton
          fullWidth
          variant="contained"
          size="large"
          loading={loading}
          onClick={handleConfirm}
          disabled={paidTotal < totalAmount}
          sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 1.5 }}
        >
          THANH TOÁN
        </LoadingButton>
      </Box>
    </Drawer>
  );
}
