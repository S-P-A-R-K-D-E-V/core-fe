'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';
import { getChildProducts } from 'src/api/products';
import { IProductChild, IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  product: IProductListItem | null;
  onSelectVariant: (product: IProductListItem, child: IProductChild) => void;
};

export default function PosVariantPickerDrawer({ open, onClose, product, onSelectVariant }: Props) {
  const theme = useTheme();
  const [children, setChildren] = useState<IProductChild[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      // Use childProducts if already loaded otherwise fetch
      if (product.childProducts && product.childProducts.length > 0) {
        setChildren(product.childProducts);
        setLoading(false);
      } else {
        setLoading(true);
        getChildProducts(product.id)
          .then(setChildren)
          .catch(console.error)
          .finally(() => setLoading(false));
      }
    } else {
      setChildren([]);
    }
  }, [open, product]);

  const handleSelect = (child: IProductChild) => {
    if (product) {
      onSelectVariant(product, child);
      onClose();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Box>
          <Typography variant="h6">Chọn thuộc tính</Typography>
          {product && (
            <Typography variant="body2" color="text.secondary">
              {product.name}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : children.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8, opacity: 0.5 }}>
            <Iconify icon="solar:box-minimalistic-bold-duotone" width={60} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Không có biến thể
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {children.map((child) => {
              const stock =
                child.inventories?.reduce((s, inv) => s + (inv.onHand || 0), 0) ?? 0;
              const isOutOfStock = stock <= 0;

              return (
                <Card
                  key={child.id}
                  onClick={() => !isOutOfStock && handleSelect(child)}
                  sx={{
                    p: 1.5,
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    opacity: isOutOfStock ? 0.5 : 1,
                    transition: 'all 0.15s',
                    border: `1px solid ${theme.palette.divider}`,
                    '&:hover': isOutOfStock
                      ? {}
                      : {
                          borderColor: theme.palette.primary.main,
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                        },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {child.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {child.code}
                      </Typography>

                      {/* Attributes */}
                      {child.attributes && child.attributes.length > 0 && (
                        <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>
                          {child.attributes.map((attr) => (
                            <Chip
                              key={attr.id}
                              size="small"
                              label={`${attr.attributeName}: ${attr.attributeValue}`}
                              variant="filled"
                              color="info"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>

                    <Box sx={{ textAlign: 'right', ml: 1 }}>
                      <Typography variant="subtitle2" color="primary.main">
                        {fCurrency(child.basePrice)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={isOutOfStock ? 'error.main' : 'text.secondary'}
                      >
                        Tồn: {stock}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
