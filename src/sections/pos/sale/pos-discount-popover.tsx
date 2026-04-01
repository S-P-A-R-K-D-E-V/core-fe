'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

type Props = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  unitPrice: number;
  currentDiscount: number;
  onApply: (discountAmount: number) => void;
};

export default function PosDiscountPopover({
  anchorEl,
  open,
  onClose,
  unitPrice,
  currentDiscount,
  onApply,
}: Props) {
  const [mode, setMode] = useState<'percent' | 'amount'>('amount');
  const [value, setValue] = useState<string>(currentDiscount > 0 ? String(currentDiscount) : '');

  const handleApply = useCallback(() => {
    const numVal = Number(value) || 0;
    let discountAmount = 0;
    if (mode === 'percent') {
      discountAmount = Math.round((unitPrice * numVal) / 100);
    } else {
      discountAmount = numVal;
    }
    onApply(Math.min(discountAmount, unitPrice));
    onClose();
  }, [value, mode, unitPrice, onApply, onClose]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{ paper: { sx: { p: 2, width: 260 } } }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Giảm giá sản phẩm
      </Typography>

      <Typography variant="caption" color="text.secondary">
        Giá bán: {fCurrency(unitPrice)}
      </Typography>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, v) => v && setMode(v)}
        sx={{ my: 1.5, width: '100%' }}
      >
        <ToggleButton value="percent" sx={{ flex: 1 }}>
          Giảm %
        </ToggleButton>
        <ToggleButton value="amount" sx={{ flex: 1 }}>
          Giảm VNĐ
        </ToggleButton>
      </ToggleButtonGroup>

      <TextField
        fullWidth
        size="small"
        type="number"
        autoFocus
        placeholder={mode === 'percent' ? 'Nhập % giảm giá' : 'Nhập số tiền giảm'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        inputProps={{ min: 0, max: mode === 'percent' ? 100 : unitPrice }}
        sx={{ mb: 1 }}
      />

      {value && (
        <Typography variant="caption" color="primary.main" sx={{ mb: 1, display: 'block' }}>
          Giảm:{' '}
          {fCurrency(
            mode === 'percent'
              ? Math.round((unitPrice * (Number(value) || 0)) / 100)
              : Number(value) || 0
          )}
        </Typography>
      )}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button size="small" variant="outlined" onClick={onClose}>
          Hủy
        </Button>
        <Button size="small" variant="contained" onClick={handleApply}>
          Áp dụng
        </Button>
      </Stack>
    </Popover>
  );
}
