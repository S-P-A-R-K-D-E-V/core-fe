'use client';

import { useState } from 'react';
import { format } from 'date-fns';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import MenuItem from '@mui/material/MenuItem';

import { useBoolean } from 'src/hooks/use-boolean';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { IProduct, IProductVariant } from 'src/types/corecms-api';
import { fCurrency, fNumber } from 'src/utils/format-number';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  row: IProduct;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onEditRow: VoidFunction;
  onAddSameCategory: VoidFunction;
};

export default function ProductTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onEditRow,
  onAddSameCategory,
}: Props) {
  const {
    name, sku, categoryName, sellingPrice, costPrice,
    totalStock, hasVariants, createdAt, variants, imageUrl,
  } = row;

  const confirm = useBoolean();
  const popover = usePopover();
  const expand = useBoolean();

  const variantCount = variants?.length || 0;
  const hasSubs = hasVariants && variantCount > 0;

  return (
    <>
      {/* Main row */}
      <TableRow
        hover
        selected={selected || expand.value}
        onClick={expand.onToggle}
        sx={{ cursor: 'pointer', '& td': { borderBottom: expand.value ? 'none' : undefined } }}
      >
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ pl: 1, pr: 0, width: 40 }} onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" sx={{ color: 'text.disabled' }}>
            <Iconify icon="eva:star-outline" width={18} />
          </IconButton>
        </TableCell>

        <TableCell sx={{ px: 0.5, width: 40 }}>
          <Avatar
            variant="rounded"
            src={imageUrl || undefined}
            sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.main' }}
          >
            <Iconify icon="solar:gallery-bold" width={18} />
          </Avatar>
        </TableCell>

        <TableCell>
          <Typography variant="body2" noWrap>
            {sku || '—'}
          </Typography>
          {hasSubs && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ({variantCount}) Mã hàng
            </Typography>
          )}
        </TableCell>

        <TableCell>
          <Typography variant="subtitle2" noWrap>{name}</Typography>
        </TableCell>

        <TableCell>
          <Typography variant="body2" noWrap>{categoryName}</Typography>
        </TableCell>

        <TableCell align="right">{fCurrency(sellingPrice)}</TableCell>
        <TableCell align="right">{fCurrency(costPrice)}</TableCell>

        <TableCell align="right">{fNumber(totalStock)}</TableCell>

        <TableCell align="right">0</TableCell>

        <TableCell>
          {createdAt ? format(new Date(createdAt), 'dd/MM/yyyy HH:mm') : '—'}
        </TableCell>
      </TableRow>

      {/* Expanded inline detail */}
      <TableRow>
        <TableCell colSpan={11} sx={{ py: 0, ...(expand.value ? {} : { borderBottom: 'none' }) }}>
          <Collapse in={expand.value} timeout="auto" unmountOnExit>
            <ProductExpandedDetail
              row={row}
              onEdit={onEditRow}
              onDelete={() => confirm.onTrue()}
              onAddSameCategory={onAddSameCategory}
            />
          </Collapse>
        </TableCell>
      </TableRow>

      {/* Variant sub-rows (show only when expanded) */}
      {hasSubs && expand.value && variants!.map((v) => (
        <VariantSubRow key={v.id} variant={v} parentName={name} />
      ))}

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 200 }}>
        <MenuItem onClick={() => { onEditRow(); popover.onClose(); }}>
          <Iconify icon="solar:pen-bold" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={() => { popover.onClose(); }}>
          <Iconify icon="solar:copy-bold" />
          Sao chép
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

// ------ Expanded Detail Panel ------

function ProductExpandedDetail({
  row,
  onEdit,
  onDelete,
  onAddSameCategory,
}: {
  row: IProduct;
  onEdit: VoidFunction;
  onDelete: VoidFunction;
  onAddSameCategory: VoidFunction;
}) {
  const [tab, setTab] = useState(0);

  const {
    name, sku, barcode, categoryName, imageUrl, description,
    costPrice, sellingPrice, totalStock, lowStockThreshold, highStockThreshold,
    isLoyaltyPoints, weight, weightUnit, location, hasVariants, variants,
  } = row;

  const variantCount = variants?.length || 0;

  const tags: string[] = ['Hàng hóa thường', 'Bán trực tiếp'];
  if (isLoyaltyPoints) tags.push('Tích điểm');

  return (
    <Box sx={{ py: 2, px: 3, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: 13 } }}>
        <Tab label="Thông tin" />
        <Tab label="Mô tả, ghi chú" />
        <Tab label="Tồn kho" />
        {hasVariants && <Tab label="Hàng hóa cùng loại" />}
      </Tabs>

      {/* Tab: Thông tin */}
      {tab === 0 && (
        <Box>
          {/* Header with image + name + category + tags */}
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2.5 }}>
            <Avatar
              variant="rounded"
              src={imageUrl || undefined}
              sx={{ width: 64, height: 64, bgcolor: 'primary.lighter', color: 'primary.main' }}
            >
              <Iconify icon="solar:gallery-bold" width={32} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1">
                {name}
                {hasVariants && variantCount > 0 && (
                  <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                    {variantCount}
                  </Typography>
                )}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Nhóm hàng: {categoryName}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                {tags.map((t) => (
                  <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 24, fontSize: 12 }} />
                ))}
              </Stack>
            </Box>
          </Stack>

          {/* Info grid */}
          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }}
            gap={2}
            sx={{ '& .label': { color: 'text.secondary', typography: 'caption', mb: 0.25 }, '& .value': { typography: 'body2', fontWeight: 600 } }}
          >
            <Box>
              <Box className="label">Mã hàng</Box>
              <Box className="value">{sku || '—'}</Box>
            </Box>
            <Box>
              <Box className="label">Mã vạch</Box>
              <Box className="value">{barcode || 'Chưa có'}</Box>
            </Box>
            <Box>
              <Box className="label">Tồn kho</Box>
              <Box className="value">{fNumber(totalStock)}</Box>
            </Box>
            <Box>
              <Box className="label">Định mức tồn</Box>
              <Box className="value">{fNumber(lowStockThreshold)} - {fNumber(highStockThreshold)}</Box>
            </Box>
            <Box>
              <Box className="label">Giá vốn</Box>
              <Box className="value">{fCurrency(costPrice)}</Box>
            </Box>
            <Box>
              <Box className="label">Giá bán</Box>
              <Box className="value">{fCurrency(sellingPrice)}</Box>
            </Box>
            <Box>
              <Box className="label">Vị trí</Box>
              <Box className="value">{location || 'Chưa có'}</Box>
            </Box>
            <Box>
              <Box className="label">Trọng lượng</Box>
              <Box className="value">{weight ? `${weight} ${weightUnit || 'g'}` : '0 g'}</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab: Mô tả */}
      {tab === 1 && (
        <Box sx={{ minHeight: 60 }}>
          {description ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{description}</Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>Chưa có mô tả</Typography>
          )}
        </Box>
      )}

      {/* Tab: Tồn kho */}
      {tab === 2 && (
        <Box sx={{ minHeight: 60 }}>
          <Box
            display="grid"
            gridTemplateColumns="1fr 1fr 1fr"
            gap={2}
            sx={{ '& .label': { color: 'text.secondary', typography: 'caption', mb: 0.25 }, '& .value': { typography: 'body2', fontWeight: 600 } }}
          >
            <Box>
              <Box className="label">Tổng tồn kho</Box>
              <Box className="value">{fNumber(totalStock)}</Box>
            </Box>
            <Box>
              <Box className="label">Định mức tồn tối thiểu</Box>
              <Box className="value">{fNumber(lowStockThreshold)}</Box>
            </Box>
            <Box>
              <Box className="label">Định mức tồn tối đa</Box>
              <Box className="value">{fNumber(highStockThreshold)}</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab: Hàng hóa cùng loại */}
      {tab === (hasVariants ? 3 : -1) && hasVariants && variants && variants.length > 0 && (
        <Box sx={{ minHeight: 60 }}>
          <Stack spacing={0.75}>
            {variants.map((v) => (
              <Stack
                key={v.id}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ px: 1.5, py: 0.75, borderRadius: 0.75, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160 }}>{v.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 100 }}>SKU: {v.sku}</Typography>
                <Typography variant="body2" sx={{ minWidth: 90, textAlign: 'right' }}>{v.costPrice != null ? fCurrency(v.costPrice) : '—'}</Typography>
                <Typography variant="body2" sx={{ minWidth: 90, textAlign: 'right' }}>{v.sellingPrice != null ? fCurrency(v.sellingPrice) : '—'}</Typography>
                <Label variant="soft" color={v.totalStock <= 0 ? 'error' : 'success'} sx={{ minWidth: 50 }}>{v.totalStock}</Label>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Action bar */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button size="small" color="error" startIcon={<Iconify icon="solar:trash-bin-trash-bold" width={18} />} onClick={onDelete}>
          Xóa
        </Button>
        <Button size="small" color="inherit" startIcon={<Iconify icon="solar:copy-bold" width={18} />}>
          Sao chép
        </Button>

        <Box sx={{ flex: 1 }} />

        <Button size="small" variant="contained" startIcon={<Iconify icon="solar:pen-bold" width={18} />} onClick={onEdit}>
          Chỉnh sửa
        </Button>
        <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:printer-bold" width={18} />}>
          In tem mã
        </Button>
        <Button size="small" variant="outlined" startIcon={<Iconify icon="mingcute:add-line" width={18} />} onClick={onAddSameCategory}>
          Thêm hàng hóa cùng loại
        </Button>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); }}>
          <Iconify icon="eva:more-horizontal-fill" />
        </IconButton>
      </Stack>
    </Box>
  );
}

// ------ Variant Sub-Row ------

function VariantSubRow({ variant, parentName }: { variant: IProductVariant; parentName: string }) {
  return (
    <TableRow sx={{ bgcolor: 'background.neutral' }}>
      <TableCell padding="checkbox">
        <Checkbox size="small" />
      </TableCell>

      <TableCell sx={{ pl: 1, pr: 0, width: 40 }}>
        <IconButton size="small" sx={{ color: 'text.disabled' }}>
          <Iconify icon="eva:star-outline" width={18} />
        </IconButton>
      </TableCell>

      <TableCell sx={{ px: 0.5, width: 40 }}>
        <Avatar
          variant="rounded"
          src={variant.imageUrl || undefined}
          sx={{ width: 32, height: 32, bgcolor: 'grey.200', color: 'grey.500' }}
        >
          <Iconify icon="solar:gallery-bold" width={18} />
        </Avatar>
      </TableCell>

      <TableCell>
        <Typography variant="body2">{variant.sku}</Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2">{variant.name}</Typography>
      </TableCell>

      <TableCell>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>—</Typography>
      </TableCell>

      <TableCell align="right">{variant.sellingPrice != null ? fCurrency(variant.sellingPrice) : '—'}</TableCell>
      <TableCell align="right">{variant.costPrice != null ? fCurrency(variant.costPrice) : '—'}</TableCell>

      <TableCell align="right">{fNumber(variant.totalStock)}</TableCell>

      <TableCell align="right">0</TableCell>

      <TableCell>
        {variant.createdAt ? format(new Date(variant.createdAt), 'dd/MM/yyyy HH:mm') : '—'}
      </TableCell>
    </TableRow>
  );
}
