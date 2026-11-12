'use client';

import { useState, forwardRef } from 'react';

import TextField, { type TextFieldProps } from '@mui/material/TextField';

// ----------------------------------------------------------------------
// Ô số của màn nhập hàng: hiện "27.500" (dấu chấm ngăn nghìn, dấu phẩy thập phân như KiotViet), khi đang gõ thì hiện
// số trần để sửa. Số lẻ được (0,5 thùng). Xoá trắng → '' (để gõ lại), không ép về 0.
// ----------------------------------------------------------------------

/** "1.234,5" / "1234.5" / "1234,5" → 1234.5; chuỗi rỗng / không phải số → ''. */
export function parseVnNumber(text: string): number | '' {
  const raw = text.trim().replace(/\s/g, '');
  if (raw === '') return '';
  // Có cả "." và "," → "." là ngăn nghìn. Chỉ "," → thập phân. Chỉ "." mà sau nó đúng 3 chữ số → ngăn nghìn.
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : '';
}

export function formatVnNumber(value: number | '' | null | undefined, maxFractionDigits = 2): string {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: maxFractionDigits });
}

type Props = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | '' | null | undefined;
  onValueChange: (value: number | '') => void;
  maxFractionDigits?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
};

const PurchaseNumberInput = forwardRef<HTMLInputElement, Props>(function PurchaseNumberInput(
  { value, onValueChange, maxFractionDigits = 2, align = 'right', bold, inputProps, onFocus, onBlur, sx, ...other },
  ref
) {
  // Đang gõ: giữ đúng chữ người dùng gõ (vd "12," chưa xong); rời ô thì hiện số đã định dạng.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <TextField
      {...other}
      // Đệm trong ô hẹp hơn mặc định để số dài (13.333,33) không bị cắt ở cột hẹp.
      sx={[{ '& .MuiInputBase-input': { px: 1 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      inputRef={ref}
      value={draft ?? formatVnNumber(value, maxFractionDigits)}
      onFocus={(event) => {
        setDraft(value === '' || value === null || value === undefined ? '' : String(value).replace('.', ','));
        event.target.select();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        if (!/^[\d.,\s]*$/.test(text)) return;
        setDraft(text);
        onValueChange(parseVnNumber(text));
      }}
      inputProps={{
        inputMode: 'decimal',
        autoComplete: 'off',
        ...inputProps,
        style: { textAlign: align, fontWeight: bold ? 600 : undefined, ...(inputProps?.style ?? {}) },
      }}
    />
  );
});

export default PurchaseNumberInput;
