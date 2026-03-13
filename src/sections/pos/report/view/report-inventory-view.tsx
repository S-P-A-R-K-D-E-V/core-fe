'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import Iconify from 'src/components/iconify';
import { IInventoryReport } from 'src/types/corecms-api';
import { getInventoryReport, downloadExport } from 'src/api/reports';

// ----------------------------------------------------------------------

export default function ReportInventoryView() {
  const { enqueueSnackbar } = useSnackbar();

  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [data, setData] = useState<IInventoryReport[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const report = await getInventoryReport({
        lowStockOnly: lowStockOnly || undefined,
      });
      setData(report);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải báo cáo tồn kho', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (lowStockOnly) params.lowStockOnly = 'true';
      await downloadExport('inventory', params);
      enqueueSnackbar('Xuất Excel thành công!');
    } catch (error) {
      enqueueSnackbar('Lỗi xuất Excel', { variant: 'error' });
    }
  };

  const totalValue = data.reduce((sum, i) => sum + i.stockValue, 0);
  const totalStock = data.reduce((sum, i) => sum + i.currentStock, 0);
  const lowStockCount = data.filter((i) => i.isLowStock).length;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4">Báo cáo tồn kho</Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="vscode-icons:file-type-excel" />}
          onClick={handleExport}
          color="success"
        >
          Xuất Excel
        </Button>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                />
              }
              label="Chỉ hiện sắp hết hàng"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Summary */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="body1">
          Tổng: <strong>{data.length}</strong> mặt hàng | Tồn kho: <strong>{totalStock}</strong> |
          Giá trị: <strong>{fCurrency(totalValue)}</strong> |
          Sắp hết: <strong style={{ color: lowStockCount > 0 ? 'red' : 'green' }}>{lowStockCount}</strong>
        </Typography>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Sản phẩm</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Barcode</TableCell>
                  <TableCell>Danh mục</TableCell>
                  <TableCell>Kho</TableCell>
                  <TableCell align="right">Tồn kho</TableCell>
                  <TableCell align="right">Ngưỡng</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Giá trị</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={`${item.productId}-${item.warehouseName}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productSKU}</TableCell>
                    <TableCell>{item.barcode || '-'}</TableCell>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell>{item.warehouseName}</TableCell>
                    <TableCell align="right">{item.currentStock}</TableCell>
                    <TableCell align="right">{item.lowStockThreshold}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.isLowStock ? 'Sắp hết' : 'Đủ hàng'}
                        size="small"
                        color={item.isLowStock ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="right">{fCurrency(item.stockValue)}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">Không có dữ liệu</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {loading && <Typography sx={{ mt: 2 }}>Đang tải...</Typography>}
    </Box>
  );
}
