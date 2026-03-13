'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import { IDashboardSummary } from 'src/types/corecms-api';
import { getDashboardSummary } from 'src/api/reports';

// ----------------------------------------------------------------------

export default function ReportDashboardView() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await getDashboardSummary();
      setData(summary);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải dữ liệu tổng quan', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return <Typography>Đang tải...</Typography>;
  }

  const statusColors: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
    Draft: 'default',
    Confirmed: 'info',
    Completed: 'success',
    Cancelled: 'error',
    Returned: 'warning',
  };

  const paymentStatusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
    Pending: 'default',
    Paid: 'success',
    PartiallyPaid: 'warning',
    Refunded: 'error',
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Tổng quan POS
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Doanh thu hôm nay
              </Typography>
              <Typography variant="h4" color="primary">
                {fCurrency(data.todayRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data.todayOrders} đơn hàng
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Doanh thu tháng này
              </Typography>
              <Typography variant="h4" color="info.main">
                {fCurrency(data.monthRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data.monthOrders} đơn hàng
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Sản phẩm / Khách hàng
              </Typography>
              <Typography variant="h4" color="success.main">
                {data.totalProducts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data.totalCustomers} khách hàng
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Sắp hết hàng
              </Typography>
              <Typography variant="h4" color={data.lowStockCount > 0 ? 'error.main' : 'success.main'}>
                {data.lowStockCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                sản phẩm dưới ngưỡng
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Selling Products & Recent Orders */}
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Top sản phẩm bán chạy (tháng)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sản phẩm</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">SL bán</TableCell>
                      <TableCell align="right">Doanh thu</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topSellingProducts.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>{p.productName}</TableCell>
                        <TableCell>{p.productSKU}</TableCell>
                        <TableCell align="right">{p.quantitySold}</TableCell>
                        <TableCell align="right">{fCurrency(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {data.topSellingProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Chưa có dữ liệu
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Đơn hàng gần đây
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mã đơn</TableCell>
                      <TableCell>Khách hàng</TableCell>
                      <TableCell align="right">Tổng tiền</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.orderNumber}</TableCell>
                        <TableCell>{o.customerName || 'Khách lẻ'}</TableCell>
                        <TableCell align="right">{fCurrency(o.totalAmount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={o.status}
                            size="small"
                            color={statusColors[o.status] || 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recentOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Chưa có đơn hàng
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
