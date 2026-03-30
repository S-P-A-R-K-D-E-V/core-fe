'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';
import { getProductById } from 'src/api/products';
import { IProduct } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
};

export default function PosProductDetailDrawer({ open, onClose, productId }: Props) {
  const theme = useTheme();
  const [product, setProduct] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (open && productId) {
      setLoading(true);
      getProductById(productId)
        .then(setProduct)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, productId]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Typography variant="h6">Chi tiết sản phẩm</Typography>
        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : !product ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8, opacity: 0.5 }}>
          <Typography>Không tìm thấy sản phẩm</Typography>
        </Stack>
      ) : (
        <>
          {/* Product image */}
          {product.imageUrl && (
            <Box sx={{ px: 2, pt: 2 }}>
              <Box
                component="img"
                src={product.imageUrl}
                alt={product.name}
                sx={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'contain',
                  borderRadius: 1,
                  bgcolor: theme.palette.grey[100],
                }}
              />
            </Box>
          )}

          {/* Product name & code */}
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography variant="h6">{product.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Mã: {product.sku || product.code}
            </Typography>
            {product.barcode && (
              <Typography variant="body2" color="text.secondary">
                Barcode: {product.barcode}
              </Typography>
            )}

            {/* Attributes */}
            {product.attributes && product.attributes.length > 0 && (
              <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 1 }}>
                {product.attributes.map((attr) => (
                  <Chip
                    key={attr.id}
                    size="small"
                    label={`${attr.attributeName}: ${attr.attributeValue}`}
                    variant="outlined"
                    color="info"
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Tabs */}
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }}>
            <Tab label="Thông tin chung" />
            <Tab label="Mô tả sản phẩm" />
          </Tabs>

          <Divider />

          <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2, py: 2 }}>
            {tabValue === 0 && (
              <Stack spacing={1.5}>
                <InfoRow label="Danh mục" value={product.categoryName || '—'} />
                <InfoRow label="Đơn vị" value={product.unitOfMeasureName || product.unit || '—'} />
                <InfoRow
                  label="Tồn kho"
                  value={String(product.totalStock ?? 0)}
                  color={
                    (product.totalStock ?? 0) <= (product.lowStockThreshold ?? 0)
                      ? 'error.main'
                      : 'text.primary'
                  }
                />
                <InfoRow label="Loại sản phẩm" value={getProductTypeName(product.productType)} />
                {product.weight && <InfoRow label="Trọng lượng" value={`${product.weight} g`} />}
                <InfoRow
                  label="Cho phép bán"
                  value={product.allowsSale !== false ? 'Có' : 'Không'}
                />
                <InfoRow
                  label="Có biến thể"
                  value={product.hasVariants ? 'Có' : 'Không'}
                />

                {/* Variants */}
                {product.variants && product.variants.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Biến thể ({product.variants.length})
                    </Typography>
                    <Stack spacing={0.5}>
                      {product.variants.map((v) => (
                        <Stack
                          key={v.id}
                          direction="row"
                          justifyContent="space-between"
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 0.75,
                            bgcolor: theme.palette.grey[50],
                          }}
                        >
                          <Box>
                            <Typography variant="body2">{v.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {v.sku}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2">
                              {fCurrency(v.sellingPrice || 0)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Tồn: {v.totalStock ?? 0}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Inventories by warehouse */}
                {product.inventories && product.inventories.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Tồn kho theo chi nhánh
                    </Typography>
                    <Stack spacing={0.5}>
                      {product.inventories.map((inv) => (
                        <Stack
                          key={inv.id || inv.branchName}
                          direction="row"
                          justifyContent="space-between"
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 0.75,
                            bgcolor: theme.palette.grey[50],
                          }}
                        >
                          <Typography variant="body2">{inv.branchName || 'Kho chính'}</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {inv.onHand ?? 0}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {tabValue === 1 && (
              <Box>
                {product.description ? (
                  <Typography
                    variant="body2"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                    sx={{
                      '& img': { maxWidth: '100%', borderRadius: 1 },
                      '& p': { mb: 1 },
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Chưa có mô tả sản phẩm
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------

function InfoRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} color={color || 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}

function getProductTypeName(type?: number): string {
  switch (type) {
    case 1:
      return 'Combo';
    case 2:
      return 'Hàng hoá';
    case 3:
      return 'Dịch vụ';
    default:
      return 'Hàng hoá';
  }
}
