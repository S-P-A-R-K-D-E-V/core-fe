'use client';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fNumber, fCurrency } from 'src/utils/format-number';

import type {
  IPurchaseImportLine,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import { parseAmount, piecesPerPack } from './purchase-import-utils';

// ----------------------------------------------------------------------
// "Giá theo gói": đơn giá trên hoá đơn là giá CẢ GÓI (vd 1 bọc lô dính 90.000). Tích ô rồi nhập số chiếc mỗi gói kho
// đếm được (20) → phiếu ghi SL gói × chiếc/gói chiếc (2 × 20 = 40), giá mỗi chiếc = đơn giá ÷ chiếc/gói (4.500đ).
// Lưu lên dòng là tổng số chiếc (countedQuantity) — Core-be chia thành tiền dòng cho số này.
// ----------------------------------------------------------------------

type Props = {
  line: IPurchaseImportLine;
  disabled?: boolean;
  /** Gọn (một hàng, không nhãn dài) cho ô trong bảng. */
  dense?: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
};

export default function PurchaseImportPackField({ line, disabled, dense, onSave }: Props) {
  const saved = piecesPerPack(line);
  const [checked, setChecked] = useState(saved != null);
  const [text, setText] = useState(saved != null ? String(saved) : '');

  useEffect(() => {
    setChecked(saved != null);
    setText(saved != null ? String(saved) : '');
  }, [saved]);

  const perPack = parseAmount(text);
  const quantity = line.quantity && line.quantity > 0 ? line.quantity : null;
  const pieces = perPack && quantity ? Math.round(quantity * perPack * 1000) / 1000 : null;
  const pieceCost =
    perPack && line.unitPrice ? Math.round((line.unitPrice / perPack) * 100) / 100 : null;

  const commit = () => {
    if (!perPack || !quantity) return;
    const total = Math.round(quantity * perPack * 1000) / 1000;
    if (total !== line.countedQuantity) onSave({ countedQuantity: total });
  };

  const toggle = (next: boolean) => {
    setChecked(next);
    if (!next) {
      setText('');
      if (line.countedQuantity) onSave({ countedQuantity: 0 });
    }
  };

  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControlLabel
          sx={{ mr: 0 }}
          disabled={disabled || !quantity}
          control={
            <Checkbox size="small" checked={checked} onChange={(e) => toggle(e.target.checked)} />
          }
          label={
            <Typography variant={dense ? 'caption' : 'body2'} noWrap>
              Giá theo gói
            </Typography>
          }
        />
        {checked && (
          <TextField
            size="small"
            label="Chiếc / gói"
            value={text}
            disabled={disabled}
            autoFocus={saved == null}
            error={text.trim() !== '' && perPack == null}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            inputProps={{ inputMode: 'decimal' }}
            sx={{ width: dense ? 92 : 110 }}
          />
        )}
      </Stack>
      {checked && pieces != null && pieceCost != null && (
        <Typography variant="caption" sx={{ color: 'info.dark' }}>
          = {fNumber(pieces)} chiếc · {fCurrency(pieceCost)}/chiếc
        </Typography>
      )}
    </Stack>
  );
}
