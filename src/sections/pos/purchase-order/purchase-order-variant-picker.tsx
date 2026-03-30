'use client';

import { useState, useMemo, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Pagination from '@mui/material/Pagination';

import { fCurrency } from 'src/utils/format-number';
import Iconify from 'src/components/iconify';

import { IProductListItem, IProductVariant } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type VariantCard = {
  key: string;
  product: IProductListItem;
  variant?: IProductVariant;
  label: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  attributes: string;
  imageUrl: string;
  totalStock: number;
};

/** Selected items with quantities */
type SelectedItem = {
  key: string;
  product: IProductListItem;
  variant?: IProductVariant;
  quantity: number;
  sellingPrice: number;
  attributes: string;
  label: string;
  sku: string;
};

type Props = {
  open: boolean;
  onClose: VoidFunction;
  product: IProductListItem | null;
  allProducts: IProductListItem[];
  onSelect: (items: SelectedItem[]) => void;
};

const CARDS_PER_PAGE = 8;

export default function PurchaseOrderVariantPicker({
  open,
  onClose,
  product,
  allProducts,
  onSelect,
}: Props) {
  const [page, setPage] = useState(1);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  // Filter state: { attributeName: Set<selectedValues> }
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});

  // Build variant cards from same-category products
  const cards = useMemo<VariantCard[]>(() => {
    if (!product) return [];

    const target = product;
    const result: VariantCard[] = [];

    const addProduct = (p: IProductListItem) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const attrs =
            v.combinations?.map((c) => `${c.attributeName}: ${c.valueName}`).join(', ') || '';
          result.push({
            key: `${p.id}__${v.id}`,
            product: p,
            variant: v,
            label: p.id === target.id ? (v.name || v.sku) : `${p.name} — ${v.name || v.sku}`,
            sku: v.sku,
            costPrice: v.costPrice ?? p.costPrice ?? 0,
            sellingPrice: v.sellingPrice ?? p.sellingPrice ?? p.basePrice ?? 0,
            attributes: attrs,
            imageUrl: v.imageUrl || p.imageUrl || '',
            totalStock: v.totalStock ?? 0,
          });
        });
      } else {
        result.push({
          key: p.id,
          product: p,
          label: p.name,
          sku: p.sku || p.code,
          costPrice: p.costPrice ?? 0,
          sellingPrice: p.sellingPrice ?? p.basePrice ?? 0,
          attributes: '',
          imageUrl: p.imageUrl || '',
          totalStock: p.totalStock ?? 0,
        });
      }
    };

    // Add the target product first
    addProduct(target);

    // Add siblings in same category
    const siblings = allProducts.filter(
      (p) => p.id !== target.id && p.categoryName === target.categoryName && p.isActive
    );
    siblings.forEach(addProduct);

    return result;
  }, [product, allProducts]);

  // Grouped attributes: { attributeName → [value1, value2, ...] }
  const attributeGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    cards.forEach((c) => {
      if (!c.attributes) return;
      c.attributes.split(', ').forEach((pair) => {
        const colonIdx = pair.indexOf(': ');
        if (colonIdx < 0) return;
        const name = pair.substring(0, colonIdx).trim();
        const value = pair.substring(colonIdx + 2).trim();
        if (name && value) {
          if (!groups[name]) groups[name] = [];
          if (!groups[name].includes(value)) groups[name].push(value);
        }
      });
    });
    return groups;
  }, [cards]);

  // Toggle a filter value
  const handleToggleFilter = useCallback((attrName: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[attrName] || []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      if (set.size === 0) {
        delete next[attrName];
      } else {
        next[attrName] = set;
      }
      return next;
    });
    setPage(1);
  }, []);

  // Filter cards based on active filters
  const filteredCards = useMemo(() => {
    const filterEntries = Object.entries(activeFilters);
    if (filterEntries.length === 0) return cards;
    return cards.filter((card) => {
      // Parse card attributes into a map
      const cardAttrs: Record<string, string> = {};
      if (card.attributes) {
        card.attributes.split(', ').forEach((pair) => {
          const colonIdx = pair.indexOf(': ');
          if (colonIdx >= 0) {
            cardAttrs[pair.substring(0, colonIdx).trim()] = pair.substring(colonIdx + 2).trim();
          }
        });
      }
      // Card must match ALL active attribute groups (AND between groups, OR within a group)
      return filterEntries.every(([attrName, values]) => {
        const cardValue = cardAttrs[attrName];
        return cardValue && values.has(cardValue);
      });
    });
  }, [cards, activeFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredCards.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);

  // Total quantity across all selected
  const totalQuantity = useMemo(
    () => Object.values(selectedMap).reduce((sum, q) => sum + q, 0),
    [selectedMap]
  );

  const handleQuantityChange = useCallback((key: string, delta: number) => {
    setSelectedMap((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const handleSetQuantity = useCallback((key: string, value: number) => {
    setSelectedMap((prev) => {
      const next = Math.max(0, value);
      if (next === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const items: SelectedItem[] = [];
    Object.entries(selectedMap).forEach(([key, quantity]) => {
      if (quantity <= 0) return;
      const card = cards.find((c) => c.key === key);
      if (!card) return;
      items.push({
        key,
        product: card.product,
        variant: card.variant,
        quantity,
        sellingPrice: card.sellingPrice,
        attributes: card.attributes,
        label: card.label,
        sku: card.sku,
      });
    });
    onSelect(items);
    setSelectedMap({});
    setActiveFilters({});
    setPage(1);
    onClose();
  }, [selectedMap, cards, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setSelectedMap({});
    setActiveFilters({});
    setPage(1);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">Hàng hóa cùng loại</Typography>
          {product && (
            <Chip label={product.categoryName} size="small" color="info" variant="soft" />
          )}
        </Stack>
        <IconButton onClick={handleClose} edge="end">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {cards.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Không tìm thấy hàng hóa cùng loại</Typography>
          </Box>
        ) : (
          <Stack direction="row" sx={{ height: '100%', minHeight: 400 }}>
            {/* Left panel: attribute filter groups */}
            <Box
              sx={{
                width: 240,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                p: 2,
                overflowY: 'auto',
              }}
            >
              {Object.keys(attributeGroups).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Không có thuộc tính
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {Object.entries(attributeGroups).map(([attrName, values]) => (
                    <Box key={attrName}>
                      <Typography
                        variant="overline"
                        color="text.secondary"
                        sx={{ mb: 0.75, display: 'block' }}
                      >
                        {attrName}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {values.map((val) => {
                          const isActive = activeFilters[attrName]?.has(val) || false;
                          return (
                            <Chip
                              key={val}
                              label={val}
                              size="small"
                              variant={isActive ? 'filled' : 'outlined'}
                              color={isActive ? 'primary' : 'default'}
                              onClick={() => handleToggleFilter(attrName, val)}
                              sx={{
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Right panel: grid of product cards */}
            <Box sx={{ flex: 1, p: 2 }}>
              {/* Header row */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  Tổng số lượng nhập: <strong>{totalQuantity}</strong>
                </Typography>
                {totalPages > 1 && (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, p) => setPage(p)}
                      size="small"
                      siblingCount={0}
                    />
                  </Stack>
                )}
              </Stack>

              {/* Cards grid */}
              <Box
                display="grid"
                gridTemplateColumns={{
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                }}
                gap={2}
              >
                {paginatedCards.map((card) => {
                  const qty = selectedMap[card.key] || 0;
                  return (
                    <Box
                      key={card.key}
                      sx={{
                        border: '1px solid',
                        borderColor: qty > 0 ? 'primary.main' : 'divider',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                        '&:hover': { borderColor: 'primary.light' },
                      }}
                    >
                      {/* Image area */}
                      <Box sx={{ position: 'relative' }}>
                        {card.imageUrl ? (
                          <Box
                            component="img"
                            src={card.imageUrl}
                            alt={card.label}
                            sx={{
                              width: '100%',
                              height: 140,
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: 140,
                              bgcolor: 'background.neutral',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Iconify icon="solar:box-bold" width={48} sx={{ color: 'text.disabled' }} />
                          </Box>
                        )}
                        {/* Stock badge */}
                        <Badge
                          badgeContent={card.totalStock}
                          color="default"
                          max={9999}
                          sx={{
                            position: 'absolute',
                            bottom: 8,
                            left: 12,
                            '& .MuiBadge-badge': {
                              position: 'static',
                              transform: 'none',
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              fontSize: '0.7rem',
                              minWidth: 20,
                              height: 20,
                            },
                          }}
                        />
                      </Box>

                      {/* Info */}
                      <Stack sx={{ p: 1.5, pb: 0.5 }} spacing={0.25}>
                        <Typography variant="body2" noWrap title={card.label}>
                          {card.label}
                        </Typography>
                        <Typography variant="body2" color="primary.main" fontWeight="bold">
                          {fCurrency(card.sellingPrice)}
                        </Typography>
                      </Stack>

                      {/* Quantity controls */}
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="center"
                        spacing={0}
                        sx={{ px: 1, pb: 1.5, pt: 0.5 }}
                      >
                        <Tooltip title="Giảm">
                          <IconButton
                            size="small"
                            onClick={() => handleQuantityChange(card.key, -1)}
                            disabled={qty <= 0}
                          >
                            <Iconify icon="eva:arrow-ios-downward-fill" width={18} />
                          </IconButton>
                        </Tooltip>
                        <Box
                          component="input"
                          type="number"
                          value={qty}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleSetQuantity(card.key, parseInt(e.target.value, 10) || 0)
                          }
                          sx={{
                            width: 48,
                            textAlign: 'center',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 0.5,
                            py: 0.5,
                            fontSize: '0.875rem',
                            outline: 'none',
                            '&:focus': { borderColor: 'primary.main' },
                            MozAppearance: 'textfield',
                            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                              WebkitAppearance: 'none',
                              margin: 0,
                            },
                          }}
                        />
                        <Tooltip title="Tăng">
                          <IconButton
                            size="small"
                            onClick={() => handleQuantityChange(card.key, 1)}
                          >
                            <Iconify icon="eva:arrow-ios-upward-fill" width={18} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={handleClose} color="inherit">
          Bỏ qua
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={totalQuantity === 0}
        >
          Xong
        </Button>
      </DialogActions>
    </Dialog>
  );
}
