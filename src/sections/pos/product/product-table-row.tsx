'use client';

import { format } from 'date-fns';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { useBoolean } from 'src/hooks/use-boolean';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { IProduct } from 'src/types/corecms-api';
import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  row: IProduct;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onEditRow: VoidFunction;
};

export default function ProductTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onEditRow,
}: Props) {
  const { name, sku, categoryName, sellingPrice, costPrice, isActive, totalStock, hasVariants, createdAt } = row;

  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ fontWeight: 'bold' }}>{name}</TableCell>

        <TableCell>{sku}</TableCell>

        <TableCell>{categoryName}</TableCell>

        <TableCell align="right">{fCurrency(costPrice)}</TableCell>

        <TableCell align="right">{fCurrency(sellingPrice)}</TableCell>

        <TableCell align="center">
          <Label variant="soft" color={totalStock <= 0 ? 'error' : totalStock <= 10 ? 'warning' : 'success'}>
            {totalStock}
          </Label>
        </TableCell>

        <TableCell>
          {hasVariants && <Label variant="soft" color="info" sx={{ mr: 0.5 }}>Biến thể</Label>}
          <Label variant="soft" color={isActive ? 'success' : 'error'}>
            {isActive ? 'Hoạt động' : 'Ẩn'}
          </Label>
        </TableCell>

        <TableCell>
          {createdAt ? format(new Date(createdAt), 'dd/MM/yyyy') : '—'}
        </TableCell>

        <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 140 }}>
        <MenuItem onClick={() => { onEditRow(); popover.onClose(); }}>
          <Iconify icon="solar:pen-bold" />
          Sửa
        </MenuItem>
        <MenuItem onClick={() => { confirm.onTrue(); popover.onClose(); }} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" />
          Xóa
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Xóa"
        content={`Bạn có chắc muốn xóa sản phẩm "${name}"?`}
        action={<Button variant="contained" color="error" onClick={onDeleteRow}>Xóa</Button>}
      />
    </>
  );
}
