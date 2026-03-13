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
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import Iconify from 'src/components/iconify';
import { IProductSalesReport } from 'src/types/corecms-api';
import { getProductSalesReport, downloadExport } from 'src/api/reports';

// ----------------------------------------------------------------------

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: now.toISOString().split('T')[0],
  };
}

export default function ReportProductSalesView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [data, setData] = useState<IProductSalesReport[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const report = await getProductSalesReport({ fromDate, toDate });
      setData(report);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải báo cáo sản phẩm', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      await downloadExport('product-sales', { fromDate, toDate });
      enqueueSnackbar('Xuất Excel thành công!');
    } catch (error) {
      enqueueSnackbar('Lỗi xuất Excel', { variant: 'error' });
    }
  };

  const totalRevenue = data.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalProfit = data.reduce((sum, p) => sum + p.profit, 0);
  const totalQty = data.reduce((sum, p) => sum + p.quantitySold, 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4">SP bán chạy</Typography>
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
          <Stack direction="row" spacing={2}>
            <TextField
              type="date"
              label="Từ ngày"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              type="date"
              label="Đến ngày"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Summary */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="body1">
          Tổng: <strong>{data.length}</strong> sản phẩm | SL bán: <strong>{totalQty}</strong> |
          Doanh thu: <strong>{fCurrency(totalRevenue)}</strong> |
          Lợi nhuận: <strong>{fCurrency(totalProfit)}</strong>
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
                  <TableCell align="right">SL bán</TableCell>
                  <TableCell align="right">Doanh thu</TableCell>
                  <TableCell align="right">Chi phí</TableCell>
                  <TableCell align="right">Lợi nhuận</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((p, index) => (
                  <TableRow key={p.productId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{p.productName}</TableCell>
                    <TableCell>{p.productSKU}</TableCell>
                    <TableCell>{p.barcode || '-'}</TableCell>
                    <TableCell>{p.categoryName}</TableCell>
                    <TableCell align="right">{p.quantitySold}</TableCell>
                    <TableCell align="right">{fCurrency(p.totalRevenue)}</TableCell>
                    <TableCell align="right">{fCurrency(p.totalCost)}</TableCell>
                    <TableCell align="right" sx={{ color: p.profit >= 0 ? 'success.main' : 'error.main' }}>
                      {fCurrency(p.profit)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">Không có dữ liệu</TableCell>
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
