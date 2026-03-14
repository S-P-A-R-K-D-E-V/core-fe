'use client';

import { format } from 'date-fns';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { fCurrency } from 'src/utils/format-number';

import { IProduct } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  product: IProduct | null;
  open: boolean;
  onClose: VoidFunction;
  onEdit: (id: string) => void;
};

export default function ProductQuickView({ product, open, onClose, onEdit }: Props) {
  if (!product) return null;

  const {
    id,
    name,
    sku,
    barcode,
    description,
    categoryName,
    unitOfMeasureName,
    costPrice,
    sellingPrice,
    vatRate,
    isActive,
    hasVariants,
    lowStockThreshold,
    totalStock,
    createdAt,
    updatedAt,
    variants,
  } = product;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { invisible: true } }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 560 } } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2.5 }}>
        <Typography variant="h6">Chi tiết sản phẩm</Typography>
        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Stack>

      <Divider />

      <Scrollbar sx={{ p: 2.5 }}>
        {/* Basic Info */}
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">{name}</Typography>
            <Stack direction="row" spacing={0.5}>
              {hasVariants && <Label color="info">Biến thể</Label>}
              <Label color={isActive ? 'success' : 'error'}>
                {isActive ? 'Hoạt động' : 'Ẩn'}
              </Label>
            </Stack>
          </Stack>

          <Box
            display="grid"
            gridTemplateColumns="1fr 1fr"
            gap={1.5}
            sx={{
              '& .info-label': { color: 'text.secondary', typography: 'caption' },
              '& .info-value': { typography: 'body2', fontWeight: 600 },
            }}
          >
            <Box>
              <Box className="info-label">SKU</Box>
              <Box className="info-value">{sku}</Box>
            </Box>
            <Box>
              <Box className="info-label">Barcode</Box>
              <Box className="info-value">{barcode || '—'}</Box>
            </Box>
            <Box>
              <Box className="info-label">Danh mục</Box>
              <Box className="info-value">{categoryName}</Box>
            </Box>
            <Box>
              <Box className="info-label">Đơn vị tính</Box>
              <Box className="info-value">{unitOfMeasureName}</Box>
            </Box>
            <Box>
              <Box className="info-label">Giá nhập</Box>
              <Box className="info-value" sx={{ color: 'warning.main' }}>
                {fCurrency(costPrice)}
              </Box>
            </Box>
            <Box>
              <Box className="info-label">Giá bán</Box>
              <Box className="info-value" sx={{ color: 'success.main' }}>
                {fCurrency(sellingPrice)}
              </Box>
            </Box>
            <Box>
              <Box className="info-label">VAT</Box>
              <Box className="info-value">{vatRate}%</Box>
            </Box>
            <Box>
              <Box className="info-label">Tồn kho</Box>
              <Box className="info-value">
                <Label
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
              </Box>
            </Box>
            <Box>
              <Box className="info-label">Cảnh báo tồn kho</Box>
              <Box className="info-value">{lowStockThreshold}</Box>
            </Box>
            <Box>
              <Box className="info-label">Ngày tạo</Box>
              <Box className="info-value">
                {createdAt ? format(new Date(createdAt), 'dd/MM/yyyy HH:mm') : '—'}
              </Box>
            </Box>
          </Box>

          {description && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Mô tả
              </Typography>
              <Typography variant="body2">{description}</Typography>
            </Box>
          )}
        </Stack>

        {/* Variants section */}
        {hasVariants && variants && variants.length > 0 && (
          <>
            <Divider sx={{ my: 2.5 }} />

            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Biến thể ({variants.length})
            </Typography>

            <TableContainer sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tên biến thể</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Barcode</TableCell>
                    <TableCell align="right">Giá nhập</TableCell>
                    <TableCell align="right">Giá bán</TableCell>
                    <TableCell align="center">Tồn kho</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" fontWeight={600}>
                            {v.name}
                          </Typography>
                          {v.combinations && v.combinations.length > 0 && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {v.combinations.map((c) => (
                                <Chip
                                  key={c.valueId}
                                  label={`${c.attributeName}: ${c.valueName}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: 11 }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{v.sku}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{v.barcode || '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {v.costPrice != null ? fCurrency(v.costPrice) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {v.sellingPrice != null ? fCurrency(v.sellingPrice) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Label
                          color={
                            v.totalStock <= 0 ? 'error' : v.totalStock <= 10 ? 'warning' : 'success'
                          }
                        >
                          {v.totalStock}
                        </Label>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Iconify icon="solar:pen-bold" />}
            onClick={() => {
              onEdit(id);
              onClose();
            }}
          >
            Chỉnh sửa
          </Button>
        </Stack>
      </Scrollbar>
    </Drawer>
  );
}
