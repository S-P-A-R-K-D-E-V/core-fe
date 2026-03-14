'use client';

import { format } from 'date-fns';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

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
  onQuickView: VoidFunction;
};

export default function ProductTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onEditRow,
  onQuickView,
}: Props) {
  const { name, sku, barcode, categoryName, unitOfMeasureName, sellingPrice, costPrice, isActive, totalStock, hasVariants, lowStockThreshold, createdAt, variants } = row;

  const confirm = useBoolean();
  const popover = usePopover();
  const expand = useBoolean();

  const variantCount = variants?.length || 0;

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            {hasVariants && variantCount > 0 && (
              <IconButton size="small" onClick={expand.onToggle} sx={{ width: 24, height: 24 }}>
                <Iconify
                  icon={expand.value ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
                  width={16}
                />
              </IconButton>
            )}
            <Box>
              <Typography variant="subtitle2" noWrap>
                {name}
              </Typography>
              {barcode && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {barcode}
                </Typography>
              )}
            </Box>
          </Stack>
        </TableCell>

        <TableCell>{sku}</TableCell>

        <TableCell>{categoryName}</TableCell>

        <TableCell>
          <Typography variant="body2">{unitOfMeasureName}</Typography>
        </TableCell>

        <TableCell align="right">{fCurrency(costPrice)}</TableCell>

        <TableCell align="right">{fCurrency(sellingPrice)}</TableCell>

        <TableCell align="center">
          <Label
            variant="soft"
            color={
              totalStock <= 0
                ? 'error'
                : totalStock <= lowStockThreshold
                  ? 'warning'
                  : 'success'
            }
          >
            {totalStock}
          </Label>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {hasVariants && (
              <Label variant="soft" color="info">
                {variantCount} biến thể
              </Label>
            )}
            <Label variant="soft" color={isActive ? 'success' : 'error'}>
              {isActive ? 'Hoạt động' : 'Ẩn'}
            </Label>
          </Stack>
        </TableCell>

        <TableCell>
          {createdAt ? format(new Date(createdAt), 'dd/MM/yyyy') : '—'}
        </TableCell>

        <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
          <Tooltip title="Xem nhanh">
            <IconButton onClick={onQuickView} sx={{ mr: 0.5 }}>
              <Iconify icon="solar:eye-bold" width={20} />
            </IconButton>
          </Tooltip>

          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      {/* Expandable variant rows */}
      {hasVariants && variantCount > 0 && (
        <TableRow>
          <TableCell colSpan={11} sx={{ py: 0, borderBottom: expand.value ? undefined : 'none' }}>
            <Collapse in={expand.value} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, pl: 6 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Danh sách biến thể
                </Typography>
                <Stack spacing={0.75}>
                  {variants!.map((v) => (
                    <Stack
                      key={v.id}
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 0.75,
                        bgcolor: 'background.neutral',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 140 }}>
                        {v.name}
                      </Typography>

                      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 100 }}>
                        SKU: {v.sku}
                      </Typography>

                      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 100 }}>
                        {v.barcode || '—'}
                      </Typography>

                      {v.combinations && v.combinations.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ flex: 1 }}>
                          {v.combinations.map((c) => (
                            <Chip
                              key={c.valueId}
                              label={`${c.attributeName}: ${c.valueName}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: 11 }}
                            />
                          ))}
                        </Stack>
                      )}

                      <Typography variant="body2" sx={{ color: 'warning.main', minWidth: 90, textAlign: 'right' }}>
                        {v.costPrice != null ? fCurrency(v.costPrice) : '—'}
                      </Typography>

                      <Typography variant="body2" sx={{ color: 'success.main', minWidth: 90, textAlign: 'right' }}>
                        {v.sellingPrice != null ? fCurrency(v.sellingPrice) : '—'}
                      </Typography>

                      <Label
                        variant="soft"
                        color={v.totalStock <= 0 ? 'error' : v.totalStock <= 10 ? 'warning' : 'success'}
                        sx={{ minWidth: 50 }}
                      >
                        {v.totalStock}
                      </Label>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 160 }}>
        <MenuItem onClick={() => { onQuickView(); popover.onClose(); }}>
          <Iconify icon="solar:eye-bold" />
          Xem nhanh
        </MenuItem>
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
