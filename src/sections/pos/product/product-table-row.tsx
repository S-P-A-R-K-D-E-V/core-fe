'use client';

import { useState, useCallback } from 'react';
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

import { IProduct, IProductChild } from 'src/types/corecms-api';
import { getProductById } from 'src/api/products';
import { fCurrency, fNumber } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const PRODUCT_TYPE_MAP: Record<number, { label: string; color: 'default' | 'info' | 'warning' }> = {
  1: { label: 'Combo', color: 'warning' },
  2: { label: 'Thường', color: 'default' },
  3: { label: 'Dịch vụ', color: 'info' },
};

function getTotalStock(product: IProduct): number {
  return product.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) || 0;
}

function getFirstImageUrl(product: IProduct): string | undefined {
  return product.images?.[0]?.imageUrl;
}

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
  const { name, code, categoryName, basePrice, isActive, allowsSale, createdDate, childProducts } = row;

  const confirm = useBoolean();
  const popover = usePopover();
  const expand = useBoolean();

  const [detailProduct, setDetailProduct] = useState<IProduct | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const hasChildren = (childProducts?.length || 0) > 0;
  const totalStock = getTotalStock(row);
  const imageUrl = getFirstImageUrl(row);

  const fetchDetail = useCallback(async (productId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await getProductById(productId);
      setDetailProduct(detail);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleRowClick = useCallback(() => {
    if (hasChildren) {
      // Toggle expand to show child products
      expand.onToggle();
    } else {
      // No children → toggle detail panel
      if (!expand.value) {
        fetchDetail(row.id);
      }
      expand.onToggle();
    }
  }, [hasChildren, expand, fetchDetail, row.id]);

  return (
    <>
      {/* Main row */}
      <TableRow
        hover
        selected={selected || expand.value}
        onClick={handleRowClick}
        sx={{ cursor: 'pointer', '& td': { borderBottom: expand.value ? 'none' : undefined } }}
      >
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ px: 0.5, width: 40 }}>
          <Avatar
            variant="rounded"
            src={imageUrl}
            sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.main' }}
          >
            <Iconify icon="solar:gallery-bold" width={18} />
          </Avatar>
        </TableCell>

        <TableCell>
          <Typography variant="body2" noWrap>
            {code || '—'}
          </Typography>
          {hasChildren && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ({childProducts!.length}) hàng hóa con
            </Typography>
          )}
        </TableCell>

        <TableCell>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="subtitle2" noWrap>{name}</Typography>
            {hasChildren && (
              <Iconify
                icon={expand.value ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'}
                width={16}
                sx={{ color: 'text.disabled', flexShrink: 0 }}
              />
            )}
          </Stack>
        </TableCell>

        <TableCell>
          <Typography variant="body2" noWrap>{categoryName}</Typography>
        </TableCell>

        <TableCell align="right">{fCurrency(basePrice)}</TableCell>

        <TableCell align="right">{fNumber(totalStock)}</TableCell>

        <TableCell>
          <Label variant="soft" color={isActive ? 'success' : 'default'}>
            {isActive ? 'Đang bán' : 'Ngừng bán'}
          </Label>
        </TableCell>

        <TableCell>
          {createdDate ? format(new Date(createdDate), 'dd/MM/yyyy HH:mm') : '—'}
        </TableCell>
      </TableRow>

      {/* Detail panel (for products WITHOUT children) */}
      {!hasChildren && (
        <TableRow>
          <TableCell colSpan={9} sx={{ py: 0, ...(expand.value ? {} : { borderBottom: 'none' }) }}>
            <Collapse in={expand.value} timeout="auto" unmountOnExit>
              <ProductExpandedDetail
                row={detailProduct || row}
                loading={loadingDetail}
                onEdit={onEditRow}
                onDelete={() => confirm.onTrue()}
                onAddSameCategory={onAddSameCategory}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {/* Child sub-rows (for products WITH children) */}
      {hasChildren && expand.value && childProducts!.map((child) => (
        <ChildSubRow
          key={child.id}
          child={child}
          parentCode={code}
          onFetchDetail={fetchDetail}
        />
      ))}

      {/* Detail panel for child product */}
      {hasChildren && detailProduct && (
        <TableRow>
          <TableCell colSpan={9} sx={{ py: 0 }}>
            <Collapse in={!!detailProduct} timeout="auto" unmountOnExit>
              <ProductExpandedDetail
                row={detailProduct}
                loading={loadingDetail}
                onEdit={onEditRow}
                onDelete={() => confirm.onTrue()}
                onAddSameCategory={onAddSameCategory}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}

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
  loading,
  onEdit,
  onDelete,
  onAddSameCategory,
}: {
  row: IProduct;
  loading?: boolean;
  onEdit: VoidFunction;
  onDelete: VoidFunction;
  onAddSameCategory: VoidFunction;
}) {
  const [tab, setTab] = useState(0);

  const {
    name, code, barCode, categoryName, description,
    basePrice, isActive, allowsSale, hasVariants, weight,
    unit, isRewardPoint, productType, minQuantity, maxQuantity,
    attributes, images, inventories, childProducts,
  } = row;

  const imageUrl = getFirstImageUrl(row);
  const totalStock = getTotalStock(row);
  const typeInfo = PRODUCT_TYPE_MAP[productType] || PRODUCT_TYPE_MAP[2];

  const tags: string[] = [typeInfo.label];
  if (allowsSale) tags.push('Bán trực tiếp');
  if (isRewardPoint) tags.push('Tích điểm');

  return (
    <Box sx={{ py: 2, px: 3, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
      {loading && (
        <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>Đang tải...</Typography>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: 13 } }}>
        <Tab label="Thông tin" />
        <Tab label="Mô tả" />
        {inventories && inventories.length > 0 && <Tab label="Tồn kho chi nhánh" />}
        {attributes && attributes.length > 0 && <Tab label="Thuộc tính" />}
      </Tabs>

      {/* Tab: Thông tin */}
      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2.5 }}>
            <Avatar
              variant="rounded"
              src={imageUrl}
              sx={{ width: 64, height: 64, bgcolor: 'primary.lighter', color: 'primary.main' }}
            >
              <Iconify icon="solar:gallery-bold" width={32} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1">{name}</Typography>
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

          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }}
            gap={2}
            sx={{ '& .label': { color: 'text.secondary', typography: 'caption', mb: 0.25 }, '& .value': { typography: 'body2', fontWeight: 600 } }}
          >
            <Box>
              <Box className="label">Mã hàng</Box>
              <Box className="value">{code || '—'}</Box>
            </Box>
            <Box>
              <Box className="label">Mã vạch</Box>
              <Box className="value">{barCode || 'Chưa có'}</Box>
            </Box>
            <Box>
              <Box className="label">Tồn kho</Box>
              <Box className="value">{fNumber(totalStock)}</Box>
            </Box>
            <Box>
              <Box className="label">Định mức tồn</Box>
              <Box className="value">{fNumber(minQuantity)} - {fNumber(maxQuantity)}</Box>
            </Box>
            <Box>
              <Box className="label">Giá bán</Box>
              <Box className="value">{fCurrency(basePrice)}</Box>
            </Box>
            <Box>
              <Box className="label">Đơn vị</Box>
              <Box className="value">{unit || 'Chưa có'}</Box>
            </Box>
            <Box>
              <Box className="label">Trọng lượng</Box>
              <Box className="value">{weight ? `${weight} g` : '0 g'}</Box>
            </Box>
            <Box>
              <Box className="label">Trạng thái</Box>
              <Box className="value">
                <Label variant="soft" color={isActive ? 'success' : 'default'} sx={{ mr: 0.5 }}>
                  {isActive ? 'Hoạt động' : 'Ngừng'}
                </Label>
              </Box>
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

      {/* Tab: Tồn kho chi nhánh */}
      {tab === 2 && inventories && inventories.length > 0 && (
        <Box sx={{ minHeight: 60 }}>
          <Stack spacing={0.75}>
            {inventories.map((inv) => (
              <Stack
                key={inv.id}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ px: 1.5, py: 0.75, borderRadius: 0.75, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160 }}>
                  {inv.branchName || 'Chi nhánh'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 120 }}>
                  Tồn: {fNumber(inv.onHand || 0)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 120 }}>
                  Đặt trước: {fNumber(inv.reserved)}
                </Typography>
                <Typography variant="body2" sx={{ minWidth: 120 }}>
                  Giá vốn: {inv.cost != null ? fCurrency(inv.cost) : '—'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Tab: Thuộc tính */}
      {((tab === 2 && (!inventories || inventories.length === 0)) ||
        (tab === 3 && inventories && inventories.length > 0)) &&
        attributes && attributes.length > 0 && (
        <Box sx={{ minHeight: 60 }}>
          <Stack spacing={0.75}>
            {attributes.map((attr) => (
              <Stack
                key={attr.id}
                direction="row"
                spacing={2}
                sx={{ px: 1.5, py: 0.75, borderRadius: 0.75, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160 }}>
                  {attr.attributeName}
                </Typography>
                <Typography variant="body2">{attr.attributeValue}</Typography>
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
      </Stack>
    </Box>
  );
}

// ------ Child Sub-Row ------

function ChildSubRow({
  child,
  parentCode,
  onFetchDetail,
}: {
  child: IProductChild;
  parentCode: string;
  onFetchDetail: (id: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (showDetail) {
      setShowDetail(false);
      return;
    }
    if (!detail) {
      setLoading(true);
      try {
        const { getProductById: fetchProduct } = await import('src/api/products');
        const data = await fetchProduct(child.id);
        setDetail(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    setShowDetail(true);
  }, [showDetail, detail, child.id]);

  return (
    <>
      <TableRow
        hover
        onClick={handleClick}
        sx={{ bgcolor: 'background.neutral', cursor: 'pointer', '& td': { borderBottom: showDetail ? 'none' : undefined } }}
      >
        <TableCell padding="checkbox">
          <Checkbox size="small" disabled />
        </TableCell>

        <TableCell sx={{ px: 0.5, width: 40 }}>
          <Avatar
            variant="rounded"
            sx={{ width: 28, height: 28, bgcolor: 'grey.200', color: 'grey.500' }}
          >
            <Iconify icon="solar:gallery-bold" width={14} />
          </Avatar>
        </TableCell>

        <TableCell>
          <Typography variant="body2">{child.code}</Typography>
        </TableCell>

        <TableCell>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Iconify icon="eva:corner-down-right-fill" width={14} sx={{ color: 'text.disabled' }} />
            <Typography variant="body2">{child.name}</Typography>
          </Stack>
        </TableCell>

        <TableCell>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>—</Typography>
        </TableCell>

        <TableCell align="right">{fCurrency(child.basePrice)}</TableCell>

        <TableCell align="right">—</TableCell>

        <TableCell>
          <Label variant="soft" color={child.isActive ? 'success' : 'default'}>
            {child.isActive ? 'Đang bán' : 'Ngừng bán'}
          </Label>
        </TableCell>

        <TableCell>—</TableCell>
      </TableRow>

      {/* Child detail panel */}
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, ...(showDetail ? {} : { borderBottom: 'none' }) }}>
          <Collapse in={showDetail} timeout="auto" unmountOnExit>
            {loading && (
              <Box sx={{ py: 2, px: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>Đang tải...</Typography>
              </Box>
            )}
            {detail && !loading && (
              <ChildDetailPanel product={detail} />
            )}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ------ Child Detail Panel (simplified) ------

function ChildDetailPanel({ product }: { product: IProduct }) {
  const totalStock = getTotalStock(product);
  const imageUrl = getFirstImageUrl(product);

  return (
    <Box sx={{ py: 2, px: 3, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Avatar
          variant="rounded"
          src={imageUrl}
          sx={{ width: 48, height: 48, bgcolor: 'primary.lighter', color: 'primary.main' }}
        >
          <Iconify icon="solar:gallery-bold" width={24} />
        </Avatar>
        <Box>
          <Typography variant="subtitle2">{product.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {product.code} {product.barCode ? `| ${product.barCode}` : ''}
          </Typography>
        </Box>
      </Stack>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }}
        gap={2}
        sx={{ '& .label': { color: 'text.secondary', typography: 'caption', mb: 0.25 }, '& .value': { typography: 'body2', fontWeight: 600 } }}
      >
        <Box>
          <Box className="label">Giá bán</Box>
          <Box className="value">{fCurrency(product.basePrice)}</Box>
        </Box>
        <Box>
          <Box className="label">Tồn kho</Box>
          <Box className="value">{fNumber(totalStock)}</Box>
        </Box>
        <Box>
          <Box className="label">Đơn vị</Box>
          <Box className="value">{product.unit || '—'}</Box>
        </Box>
        <Box>
          <Box className="label">Trạng thái</Box>
          <Box className="value">
            <Label variant="soft" color={product.isActive ? 'success' : 'default'}>
              {product.isActive ? 'Hoạt động' : 'Ngừng'}
            </Label>
          </Box>
        </Box>

        {/* Inventories */}
        {product.inventories && product.inventories.length > 0 && product.inventories.map((inv) => (
          <Box key={inv.id}>
            <Box className="label">{inv.branchName || 'Chi nhánh'}</Box>
            <Box className="value">Tồn: {fNumber(inv.onHand || 0)}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
