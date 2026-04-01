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

import { IProduct, IProductChild, IProductListItem, IProductInventory, IProductAttribute } from 'src/types/corecms-api';
import { getProductById } from 'src/api/products';
import { fCurrency, fNumber } from 'src/utils/format-number';
import { ColumnKey } from './view/product-list-view';

// ----------------------------------------------------------------------

const PRODUCT_TYPE_MAP: Record<number, { label: string; color: 'default' | 'info' | 'warning' }> = {
  1: { label: 'Combo', color: 'warning' },
  2: { label: 'Thường', color: 'default' },
  3: { label: 'Dịch vụ', color: 'info' },
};

function getTotalStock(product: { inventories?: IProductInventory[] }): number {
  return product.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) || 0;
}

function getTotalReserved(product: { inventories?: IProductInventory[] }): number {
  return product.inventories?.reduce((sum, inv) => sum + (inv.reserved || 0), 0) || 0;
}

function getTotalCost(product: { inventories?: IProductInventory[] }): number {
  const invs = product.inventories?.filter((inv) => inv.cost != null) || [];
  if (invs.length === 0) return 0;
  return invs.reduce((sum, inv) => sum + (inv.cost || 0), 0) / invs.length;
}

function getChildTotalStock(child: IProductChild): number {
  return child.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) || 0;
}

function getChildTotalReserved(child: IProductChild): number {
  return child.inventories?.reduce((sum, inv) => sum + (inv.reserved || 0), 0) || 0;
}

function getChildAvgCost(child: IProductChild): number {
  const invs = child.inventories?.filter((inv) => inv.cost != null) || [];
  if (invs.length === 0) return 0;
  return invs.reduce((sum, inv) => sum + (inv.cost || 0), 0) / invs.length;
}

function getAggregateStock(product: IProductListItem): number {
  const parentStock = getTotalStock(product);
  const childrenStock = (product.childProducts || []).reduce((sum, c) => sum + getChildTotalStock(c), 0);
  return parentStock + childrenStock;
}

function getAggregateReserved(product: IProductListItem): number {
  const parentReserved = getTotalReserved(product);
  const childrenReserved = (product.childProducts || []).reduce((sum, c) => sum + getChildTotalReserved(c), 0);
  return parentReserved + childrenReserved;
}

function getAveragePrice(product: IProductListItem): number {
  const children = product.childProducts || [];
  if (children.length === 0) return product.basePrice;
  const all = [product.basePrice, ...children.map((c) => c.basePrice)];
  return all.reduce((sum, p) => sum + p, 0) / all.length;
}

function getAverageCost(product: IProductListItem): number {
  const parentCost = getTotalCost(product);
  const childCosts = (product.childProducts || []).map((c) => getChildAvgCost(c)).filter((c) => c > 0);
  const allCosts = parentCost > 0 ? [parentCost, ...childCosts] : childCosts;
  if (allCosts.length === 0) return 0;
  return allCosts.reduce((sum, c) => sum + c, 0) / allCosts.length;
}

type SubRowItem = {
  code: string;
  displayName: string;
  barCode?: string;
  basePrice: number;
  isActive: boolean;
  inventories?: IProductInventory[];
  attributes?: IProductAttribute[];
};

function getFirstImageUrl(product: IProduct): string | undefined {
  return product.images?.[0]?.imageUrl;
}

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  row: IProductListItem;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onEditRow: (id: string) => void;
  onAddSameCategory: VoidFunction;
  visibleColumns: ColumnKey[];
  totalColSpan: number;
};

export default function ProductTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onEditRow,
  onAddSameCategory,
  visibleColumns,
  totalColSpan,
}: Props) {
  const { name, code, basePrice, isActive, createdDate } = row;

  const confirm = useBoolean();
  const expand = useBoolean();

  const [detailProduct, setDetailProduct] = useState<IProduct | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // For parent with children: expanded children list with their details
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [childDetail, setChildDetail] = useState<IProduct | null>(null);
  const [loadingChildDetail, setLoadingChildDetail] = useState(false);

  const childProducts = row.childProducts || [];
  const hasChildren = childProducts.length > 0;

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

  const fetchChildDetail = useCallback(async (childId: string) => {
    setLoadingChildDetail(true);
    try {
      const detail = await getProductById(childId);
      setChildDetail(detail);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingChildDetail(false);
    }
  }, []);

  const handleRowClick = useCallback(() => {
    if (hasChildren) {
      // Toggle expand to show parent + child sub-rows
      if (expand.value) {
        expand.onFalse();
        setExpandedChildId(null);
        setChildDetail(null);
        setDetailProduct(null);
      } else {
        expand.onTrue();
      }
    } else {
      // No children → toggle detail panel
      if (!expand.value) {
        fetchDetail(row.id);
      }
      expand.onToggle();
    }
  }, [hasChildren, expand, fetchDetail, row.id]);

  const handleChildRowClick = useCallback((childId: string) => {
    if (expandedChildId === childId) {
      setExpandedChildId(null);
      setChildDetail(null);
    } else {
      setExpandedChildId(childId);
      fetchChildDetail(childId);
    }
  }, [expandedChildId, fetchChildDetail]);

  // Handle parent row click in expanded children view
  const handleParentSubRowClick = useCallback(() => {
    if (expandedChildId === row.id) {
      setExpandedChildId(null);
      setDetailProduct(null);
    } else {
      setExpandedChildId(row.id);
      fetchDetail(row.id);
    }
  }, [expandedChildId, row.id, fetchDetail]);

  // Render cell value based on column key for list item
  const renderCell = (colKey: ColumnKey, product: IProductListItem) => {
    switch (colKey) {
      case 'image':
        return (
          <Avatar
            variant="rounded"
            sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.main' }}
          >
            <Iconify icon="solar:gallery-bold" width={18} />
          </Avatar>
        );
      case 'code':
        if (hasChildren) {
          return (
            <Box>
              <Typography variant="body2" noWrap>
                ({childProducts.length + 1}) Mã hàng
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {product.code}
              </Typography>
            </Box>
          );
        }
        return <Typography variant="body2" noWrap>{product.code || '—'}</Typography>;
      case 'barCode':
        return <Typography variant="body2" noWrap>{product.barCode || '—'}</Typography>;
      case 'name':
        if (hasChildren) {
          const baseName = product.name.split(' - ')[0];
          return (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="subtitle2" noWrap>{baseName}</Typography>
              <Iconify
                icon={expand.value ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'}
                width={16}
                sx={{ color: 'text.disabled', flexShrink: 0 }}
              />
            </Stack>
          );
        }
        return <Typography variant="subtitle2" noWrap>{product.name}</Typography>;
      case 'category':
        return <Typography variant="body2" noWrap>{product.categoryName}</Typography>;
      case 'productType': {
        const typeInfo = PRODUCT_TYPE_MAP[product.productType] || PRODUCT_TYPE_MAP[2];
        return <Label variant="soft" color={typeInfo.color}>{typeInfo.label}</Label>;
      }
      case 'basePrice':
        return hasChildren ? fCurrency(getAveragePrice(product)) : fCurrency(product.basePrice);
      case 'cost':
        return hasChildren ? fCurrency(getAverageCost(product)) : fCurrency(getTotalCost(product));
      case 'tradeMarkName':
        return <Typography variant="body2" noWrap>{product.tradeMarkName || '—'}</Typography>;
      case 'stock':
        return hasChildren ? fNumber(getAggregateStock(product)) : fNumber(getTotalStock(product));
      case 'reserved':
        return hasChildren ? fNumber(getAggregateReserved(product)) : fNumber(getTotalReserved(product));
      case 'createdDate':
        return product.createdDate
          ? format(new Date(product.createdDate), 'dd/MM/yyyy HH:mm')
          : '—';
      case 'estimatedOutOfStock':
        return '---';
      case 'minQuantity':
        return fNumber(product.minQuantity);
      case 'maxQuantity':
        return fNumber(product.maxQuantity);
      case 'status':
        return (
          <Label variant="soft" color={product.isActive ? 'success' : 'default'}>
            {product.isActive ? 'Đang bán' : 'Ngừng bán'}
          </Label>
        );
      case 'isRewardPoint':
        return product.isRewardPoint ? 'Có' : '—';
      default:
        return '—';
    }
  };

  // Render cell for sub-row items (both parent and child in expanded view)
  const renderSubRowCell = (colKey: ColumnKey, item: SubRowItem) => {
    switch (colKey) {
      case 'image':
        return (
          <Avatar
            variant="rounded"
            sx={{ width: 28, height: 28, bgcolor: 'grey.200', color: 'grey.500' }}
          >
            <Iconify icon="solar:gallery-bold" width={14} />
          </Avatar>
        );
      case 'code':
        return <Typography variant="body2">{item.code}</Typography>;
      case 'barCode':
        return <Typography variant="body2">{item.barCode || '—'}</Typography>;
      case 'name':
        return (
          <Stack spacing={0.5}>
            <Typography variant="body2">{item.displayName}</Typography>
            {item.attributes && item.attributes.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {item.attributes.map((attr) => (
                  <Chip
                    key={attr.id}
                    label={`${attr.attributeName}: ${attr.attributeValue}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        );
      case 'category':
        return '—';
      case 'basePrice':
        return fCurrency(item.basePrice);
      case 'cost':
        return fCurrency(getTotalCost(item));
      case 'stock':
        return fNumber(getTotalStock(item));
      case 'reserved':
        return fNumber(getTotalReserved(item));
      case 'status':
        return (
          <Label variant="soft" color={item.isActive ? 'success' : 'default'}>
            {item.isActive ? 'Đang bán' : 'Ngừng bán'}
          </Label>
        );
      case 'productType':
      case 'tradeMarkName':
      case 'createdDate':
      case 'estimatedOutOfStock':
      case 'minQuantity':
      case 'maxQuantity':
      case 'isRewardPoint':
        return '—';
      default:
        return '—';
    }
  };

  const getAlignForColumn = (colKey: ColumnKey): 'left' | 'right' | 'center' | undefined => {
    if (['basePrice', 'cost', 'stock', 'reserved', 'minQuantity', 'maxQuantity'].includes(colKey)) return 'right';
    return undefined;
  };

  return (
    <>
      {/* Main row - aggregated for parent with children, or normal for standalone */}
      <TableRow
        hover
        selected={selected || expand.value}
        onClick={handleRowClick}
        sx={{ cursor: 'pointer', '& td': { borderBottom: expand.value ? 'none' : undefined } }}
      >
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        {visibleColumns.map((colKey) => (
          <TableCell
            key={colKey}
            align={getAlignForColumn(colKey)}
            sx={colKey === 'image' ? { px: 0.5, width: 40 } : undefined}
          >
            {renderCell(colKey, row)}
          </TableCell>
        ))}
      </TableRow>

      {/* === CASE 1: Product WITHOUT children → show detail panel === */}
      {!hasChildren && (
        <TableRow>
          <TableCell colSpan={totalColSpan} sx={{ py: 0, ...(expand.value ? {} : { borderBottom: 'none' }) }}>
            <Collapse in={expand.value} timeout="auto" unmountOnExit>
              {detailProduct && (
                <ProductExpandedDetail
                  row={detailProduct}
                  loading={loadingDetail}
                  onEdit={onEditRow}
                  onDelete={() => confirm.onTrue()}
                  onAddSameCategory={onAddSameCategory}
                />
              )}
              {!detailProduct && loadingDetail && (
                <Box sx={{ py: 2, px: 3 }}>
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>Đang tải...</Typography>
                </Box>
              )}
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {/* === CASE 2: Product WITH children → show parent + child sub-rows === */}
      {hasChildren && expand.value && (
        <>
          {/* Parent sub-row */}
          <ExpandedSubRow
            isExpanded={expandedChildId === row.id}
            isLoadingDetail={expandedChildId === row.id && loadingDetail}
            detail={expandedChildId === row.id ? detailProduct : null}
            onClick={handleParentSubRowClick}
            visibleColumns={visibleColumns}
            totalColSpan={totalColSpan}
            renderCellFn={(colKey) => renderSubRowCell(colKey, { ...row, displayName: row.fullName || row.name })}
            getAlignForColumn={getAlignForColumn}
            onEditRow={onEditRow}
            onDelete={() => confirm.onTrue()}
            onAddSameCategory={onAddSameCategory}
          />

          {/* Child sub-rows */}
          {childProducts.map((child) => (
            <ExpandedSubRow
              key={child.id}
              isExpanded={expandedChildId === child.id}
              isLoadingDetail={expandedChildId === child.id && loadingChildDetail}
              detail={expandedChildId === child.id ? childDetail : null}
              onClick={() => handleChildRowClick(child.id)}
              visibleColumns={visibleColumns}
              totalColSpan={totalColSpan}
              renderCellFn={(colKey) => renderSubRowCell(colKey, { ...child, displayName: child.fullName || child.name })}
              getAlignForColumn={getAlignForColumn}
              onEditRow={onEditRow}
              onDelete={() => confirm.onTrue()}
              onAddSameCategory={onAddSameCategory}
            />
          ))}
        </>
      )}

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

// ------ Expanded Sub-Row (unified for both parent & child) ------

function ExpandedSubRow({
  isExpanded,
  isLoadingDetail,
  detail,
  onClick,
  visibleColumns,
  totalColSpan,
  renderCellFn,
  getAlignForColumn,
  onEditRow,
  onDelete,
  onAddSameCategory,
}: {
  isExpanded: boolean;
  isLoadingDetail: boolean;
  detail: IProduct | null;
  onClick: VoidFunction;
  visibleColumns: ColumnKey[];
  totalColSpan: number;
  renderCellFn: (colKey: ColumnKey) => React.ReactNode;
  getAlignForColumn: (colKey: ColumnKey) => 'left' | 'right' | 'center' | undefined;
  onEditRow: (id: string) => void;
  onDelete: VoidFunction;
  onAddSameCategory: VoidFunction;
}) {
  return (
    <>
      <TableRow
        hover
        onClick={onClick}
        sx={{
          bgcolor: 'background.neutral',
          cursor: 'pointer',
          '& td': { borderBottom: isExpanded ? 'none' : undefined },
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox size="small" disabled />
        </TableCell>
        {visibleColumns.map((colKey) => (
          <TableCell key={colKey} align={getAlignForColumn(colKey)} sx={colKey === 'image' ? { px: 0.5, width: 40 } : undefined}>
            {renderCellFn(colKey)}
          </TableCell>
        ))}
      </TableRow>

      {/* Detail panel */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={totalColSpan} sx={{ py: 0 }}>
            <Collapse in timeout="auto" unmountOnExit>
              {isLoadingDetail && (
                <Box sx={{ py: 2, px: 3 }}>
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>Đang tải...</Typography>
                </Box>
              )}
              {detail && !isLoadingDetail && (
                <ProductExpandedDetail
                  row={detail}
                  loading={false}
                  onEdit={onEditRow}
                  onDelete={onDelete}
                  onAddSameCategory={onAddSameCategory}
                />
              )}
            </Collapse>
          </TableCell>
        </TableRow>
      )}
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
  onEdit: (id: string) => void;
  onDelete: VoidFunction;
  onAddSameCategory: VoidFunction;
}) {
  const [tab, setTab] = useState(0);

  const {
    name, code, barCode, categoryName, description,
    basePrice, isActive, allowsSale, weight,
    unit, isRewardPoint, productType, minQuantity, maxQuantity,
    attributes, inventories,
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

        <Button size="small" variant="contained" startIcon={<Iconify icon="solar:pen-bold" width={18} />} onClick={() => onEdit(row.id)}>
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
