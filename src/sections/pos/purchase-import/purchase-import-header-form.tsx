'use client';

import { useState, useEffect } from 'react';

import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

import { getAllWarehouses } from 'src/api/warehouses';
import { updatePurchaseImport } from 'src/api/purchase-imports';

import type { IWarehouse } from 'src/types/corecms-api';
import type { IPurchaseImport, IUpdatePurchaseImportRequest } from 'src/types/purchase-import';

import { parseAmount, importErrorMessage } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Phần đầu phiếu của lần nhập (như form phiếu nhập): kho nhập, số / ngày / tổng ghi trên hoá đơn — lưu khi rời ô. Ngày
// hoá đơn dùng để đối chiếu phiếu cũ cùng ngày. NCC chọn ở thẻ NCC phía trên.
// ----------------------------------------------------------------------

type Props = {
  item: IPurchaseImport;
  editable: boolean;
  onChanged: (next: IPurchaseImport) => void;
  onError: (message: string) => void;
  /** Danh sách chọn kho nổi trên drawer (zIndex cao). */
  popperZIndex?: number;
};

export default function PurchaseImportHeaderForm({
  item,
  editable,
  onChanged,
  onError,
  popperZIndex,
}: Props) {
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllWarehouses()
      .then(setWarehouses)
      .catch(() => {});
  }, []);

  const save = async (patch: IUpdatePurchaseImportRequest) => {
    setSaving(true);
    try {
      onChanged(await updatePurchaseImport(item.id, patch));
    } catch (error) {
      onError(importErrorMessage(error, 'Không lưu được thông tin hoá đơn.'));
    } finally {
      setSaving(false);
    }
  };

  const disabled = !editable || saving;

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Kho nhập"
          value={item.warehouseId ?? ''}
          disabled={disabled}
          onChange={(e) => save({ warehouseId: e.target.value })}
          SelectProps={popperZIndex ? { MenuProps: { sx: { zIndex: popperZIndex } } } : undefined}
        >
          {warehouses
            .filter((w) => w.isActive || w.id === item.warehouseId)
            .map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <BlurTextField
          label="Số hoá đơn"
          value={item.invoiceNumber ?? ''}
          disabled={disabled}
          onCommit={(invoiceNumber) => save({ invoiceNumber })}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <BlurTextField
          label="Ngày hoá đơn"
          type="date"
          value={item.invoiceDate ?? ''}
          disabled={disabled}
          onCommit={(invoiceDate) => invoiceDate && save({ invoiceDate })}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <BlurTextField
          label="Tổng trên hoá đơn"
          value={item.invoiceTotal != null ? String(item.invoiceTotal) : ''}
          disabled={disabled}
          inputMode="decimal"
          onCommit={(text) => {
            const total = parseAmount(text);
            if (total !== null) save({ invoiceTotal: total });
          }}
        />
      </Grid>
    </Grid>
  );
}

// ----------------------------------------------------------------------

type BlurTextFieldProps = {
  label: string;
  value: string;
  disabled: boolean;
  type?: string;
  inputMode?: 'decimal' | 'text';
  onCommit: (value: string) => void;
};

/** Ô chữ lưu khi rời ô / Enter (mỗi lần gõ không gọi API). */
function BlurTextField({ label, value, disabled, type, inputMode, onCommit }: BlurTextFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      type={type}
      value={text}
      disabled={disabled}
      InputLabelProps={type === 'date' ? { shrink: true } : undefined}
      inputProps={inputMode ? { inputMode } : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onCommit(text.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
