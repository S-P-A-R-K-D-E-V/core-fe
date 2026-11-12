'use client';

import { memo, useState } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';

import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableCell from '@mui/material/TableCell';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import { IProductUnits } from 'src/types/corecms-api';

import { lineNetOf } from './purchase-line';
import PurchaseNumberInput, { formatVnNumber } from './purchase-number-input';

// ----------------------------------------------------------------------
// Một dòng hàng của phiếu nhập — bố cục như KiotViet: xoá | STT | Mã | Tên (+ ghi chú dòng) | ĐVT | SL | Đơn giá |
// Giảm giá | Thành tiền. Mỗi dòng tự theo dõi giá trị của mình (useWatch) để gõ ở một dòng không vẽ lại cả bảng.
// ----------------------------------------------------------------------

/** Độ rộng cột — bảng dùng table-layout: fixed nên số không bị cắt như bảng cũ. */
export const LINE_COLUMNS = [
  { id: 'remove', label: '', width: 34 },
  { id: 'index', label: 'STT', width: 46 },
  { id: 'name', label: 'Mã · Tên hàng' },
  { id: 'unit', label: 'ĐVT', width: 76 },
  { id: 'quantity', label: 'SL', width: 76, align: 'right' as const },
  { id: 'price', label: 'Đơn giá', width: 112, align: 'right' as const },
  { id: 'discount', label: 'Giảm giá', width: 88, align: 'right' as const },
  { id: 'total', label: 'Thành tiền', width: 124, align: 'right' as const },
];

/** Bề rộng tối thiểu của bảng — dưới mức này mới cuộn ngang (màn 1440px có menu trái vẫn vừa). */
export const LINE_TABLE_MIN_WIDTH = 700;

type Props = {
  index: number;
  units?: IProductUnits;
  onRemove: (index: number) => void;
  onOpenVariants?: (index: number) => void;
  canOpenVariants: boolean;
};

function PurchaseOrderLineRow({ index, units, onRemove, onOpenVariants, canOpenVariants }: Props) {
  const { setValue } = useFormContext();
  const item = useWatch({ name: `items.${index}` }) as any;
  const [noteOpen, setNoteOpen] = useState(false);

  if (!item) return null;

  const name = `items.${index}`;
  const lineNet = lineNetOf(item);
  const lineVat = lineNet * ((Number(item.vatRate) || 0) / 100);
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discountIsPercent = item.discountType === 'percent';
  const lineDiscount = discountIsPercent
    ? quantity * unitPrice * ((Number(item.discountAmount) || 0) / 100)
    : Number(item.discountAmount) || 0;

  const factor = Number(item.conversionFactor) || 1;
  const baseName = item._baseUnitName || units?.baseUnitName || '';
  const baseQty = quantity * factor;
  const showConversion = factor !== 1 && !!baseName && baseQty > 0;
  // Hạn dùng chỉ hỏi với nguyên liệu / bán thành phẩm, hàng có nhiều đơn vị, hoặc dòng đã có hạn dùng.
  const showExpiry =
    item._itemKind === 'Ingredient' || item._itemKind === 'SemiFinished' || (units?.units.length ?? 0) > 1 || !!item.expiryDate;
  const showNote = noteOpen || !!item.note;

  const set = (field: string, value: unknown) => setValue(`${name}.${field}`, value, { shouldDirty: true });

  return (
    <TableRow hover sx={{ verticalAlign: 'top', '& td': { py: 1 } }}>
      <TableCell sx={{ px: 0.5 }}>
        <Tooltip title="Xoá dòng">
          <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: 'text.secondary', mt: 0.25 }}>
            <Iconify icon="solar:trash-bin-trash-outline" width={18} />
          </IconButton>
        </Tooltip>
      </TableCell>

      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ pt: 0.75 }}>
          {index + 1}
        </Typography>
      </TableCell>

      <TableCell>
        <Stack spacing={0.25} sx={{ pt: 0.25, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} alignItems="flex-start">
            <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}>
              {item._productName}
            </Typography>
            {canOpenVariants && onOpenVariants && (
              <Tooltip title="Thêm hàng cùng loại">
                <IconButton size="small" color="info" onClick={() => onOpenVariants(index)} sx={{ p: 0.25 }}>
                  <Iconify icon="solar:layers-bold" width={16} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {item._productCode}
          </Typography>
          {item._attributes && (
            <Typography variant="caption" color="text.secondary">
              {item._attributes}
            </Typography>
          )}
          {showConversion && (
            <Typography variant="caption" color="text.secondary">
              = {formatVnNumber(baseQty, 4)} {baseName} · {fCurrency(lineNet / baseQty)}/{baseName}
            </Typography>
          )}
          {showExpiry && (
            <TextField
              type="date"
              size="small"
              label="Hạn dùng"
              value={item.expiryDate || ''}
              onChange={(e) => set('expiryDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 0.75, maxWidth: 170 }}
            />
          )}
          {showNote ? (
            <TextField
              size="small"
              variant="standard"
              placeholder="Ghi chú dòng…"
              value={item.note || ''}
              autoFocus={noteOpen && !item.note}
              onChange={(e) => set('note', e.target.value)}
              onBlur={() => setNoteOpen(false)}
              sx={{ maxWidth: 320 }}
              InputProps={{ sx: { fontSize: 13, fontStyle: 'italic' } }}
            />
          ) : (
            <ButtonBase
              onClick={() => setNoteOpen(true)}
              sx={{ alignSelf: 'flex-start', typography: 'caption', color: 'text.disabled', fontStyle: 'italic', gap: 0.5 }}
            >
              Ghi chú… <Iconify icon="solar:pen-outline" width={12} />
            </ButtonBase>
          )}
        </Stack>
      </TableCell>

      {/* ĐVT — đổi đơn vị thì giữ giá theo đơn vị gốc */}
      <TableCell>
        {units && units.units.length > 1 ? (
          <TextField
            select
            fullWidth
            size="small"
            value={item.unitId ?? ''}
            onChange={(e) => {
              const next = units.units.find((u) => (u.unitId ?? '') === e.target.value);
              if (!next) return;
              const basePrice = unitPrice / factor;
              set('unitId', next.unitId ?? '');
              set('unitName', next.name);
              set('conversionFactor', next.factor);
              set('unitPrice', Math.round(basePrice * next.factor * 100) / 100);
              set('lineTotal', null);
            }}
          >
            {units.units.map((u) => (
              <MenuItem key={u.unitId ?? 'base'} value={u.unitId ?? ''}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ pt: 0.75 }}>
            {item.unitName || units?.baseUnitName || ''}
          </Typography>
        )}
      </TableCell>

      {/* Số lượng — số lẻ được; sửa số lượng / đơn giá thì bỏ thành tiền nhập tay */}
      <TableCell>
        <PurchaseNumberInput
          fullWidth
          size="small"
          value={item.quantity}
          maxFractionDigits={4}
          onValueChange={(v) => {
            set('quantity', v);
            set('lineTotal', null);
          }}
          inputProps={{ 'data-line-field': 'quantity', 'data-line-index': index }}
        />
      </TableCell>

      <TableCell>
        <PurchaseNumberInput
          fullWidth
          size="small"
          value={item.unitPrice}
          onValueChange={(v) => {
            set('unitPrice', v);
            set('lineTotal', null);
          }}
        />
      </TableCell>

      <TableCell>
        <PurchaseNumberInput
          fullWidth
          size="small"
          value={item.discountAmount}
          onValueChange={(v) => {
            set('discountAmount', v === '' ? 0 : v);
            set('lineTotal', null);
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end" sx={{ ml: 0.25 }}>
                <Tooltip title={discountIsPercent ? 'Đang giảm theo % — bấm để đổi sang đồng' : 'Đang giảm theo đồng — bấm để đổi sang %'}>
                  <ButtonBase
                    onClick={() => set('discountType', discountIsPercent ? 'amount' : 'percent')}
                    sx={{ typography: 'caption', fontWeight: 700, color: 'text.secondary', px: 0.5, borderRadius: 0.5 }}
                  >
                    {discountIsPercent ? '%' : 'đ'}
                  </ButtonBase>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
      </TableCell>

      {/* Thành tiền trước VAT — sửa được (hoá đơn chỉ ghi thành tiền): đơn giá tính lại */}
      <TableCell>
        <PurchaseNumberInput
          fullWidth
          size="small"
          bold
          value={Math.round(lineNet * 100) / 100}
          onValueChange={(v) => {
            const total = v === '' ? 0 : v;
            set('lineTotal', total);
            if (quantity > 0) set('unitPrice', Math.round(((total + lineDiscount) / quantity) * 100) / 100);
          }}
        />
        {lineVat > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" align="right">
            + VAT {fCurrency(lineVat)}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

export default memo(PurchaseOrderLineRow);
