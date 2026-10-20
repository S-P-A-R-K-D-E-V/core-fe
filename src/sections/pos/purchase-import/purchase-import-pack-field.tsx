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

import {
  parseAmount,
  lineTotalOf,
  perPieceCost,
  implausiblePieceCost,
} from './purchase-import-utils';

// ----------------------------------------------------------------------
// "Giá theo gói" (chi tiết dòng trong drawer): dòng là một túi / gói lớn — đơn giá trên hoá đơn là giá CẢ TÚI. Tích ô rồi
// nhập tổng số chiếc kho kiểm được → giá sản phẩm mỗi chiếc = thành tiền dòng ÷ số chiếc (1 túi 90.000, 20 chiếc →
// 4.500đ/chiếc). Lưu lên dòng là số chiếc (countedQuantity); phiếu nhập ghi số chiếc × giá mỗi chiếc.
// ----------------------------------------------------------------------

type Props = {
  line: IPurchaseImportLine;
  disabled?: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
};

export default function PurchaseImportPackField({ line, disabled, onSave }: Props) {
  const saved = line.countedQuantity && line.countedQuantity > 0 ? line.countedQuantity : null;
  const [checked, setChecked] = useState(saved != null);
  const [text, setText] = useState(saved != null ? String(saved) : '');

  useEffect(() => {
    setChecked(saved != null);
    setText(saved != null ? String(saved) : '');
  }, [saved]);

  const pieces = parseAmount(text);
  const total = lineTotalOf(line);
  const pieceCost = perPieceCost(line, pieces);

  const commit = () => {
    if (pieces && pieces !== line.countedQuantity) onSave({ countedQuantity: pieces });
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
          disabled={disabled || !total}
          control={
            <Checkbox size="small" checked={checked} onChange={(e) => toggle(e.target.checked)} />
          }
          label={<Typography variant="body2">Giá theo gói (đơn giá là giá cả túi)</Typography>}
        />
        {checked && (
          <TextField
            size="small"
            label="Số chiếc kiểm được"
            value={text}
            disabled={disabled}
            autoFocus={saved == null}
            error={text.trim() !== '' && pieces == null}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            inputProps={{ inputMode: 'decimal' }}
            sx={{ width: 150 }}
          />
        )}
      </Stack>
      {checked && pieces != null && pieceCost != null && total != null && (
        <Typography
          variant="caption"
          sx={{ color: implausiblePieceCost(pieceCost) ? 'error.main' : 'info.dark' }}
        >
          Giá SP {fCurrency(pieceCost)}/chiếc = thành tiền {fCurrency(total)} ÷ {fNumber(pieces)}{' '}
          chiếc
          {implausiblePieceCost(pieceCost)
            ? ' — quá thấp, số chiếc có bị nhập nhầm giá không?'
            : ''}
        </Typography>
      )}
    </Stack>
  );
}
