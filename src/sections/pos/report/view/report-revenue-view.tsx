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
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import Iconify from 'src/components/iconify';
import { IRevenueReport } from 'src/types/corecms-api';
import { getRevenueReport, downloadExport } from 'src/api/reports';

// ----------------------------------------------------------------------

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = now;
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: toDate.toISOString().split('T')[0],
  };
}

export default function ReportRevenueView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState<IRevenueReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const report = await getRevenueReport({ fromDate, toDate, groupBy });
      setData(report);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải báo cáo doanh thu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, groupBy, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      await downloadExport('revenue', { fromDate, toDate, groupBy });
      enqueueSnackbar('Xuất Excel thành công!');
    } catch (error) {
      enqueueSnackbar('Lỗi xuất Excel', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4">Báo cáo doanh thu</Typography>
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
            <TextField
              select
              label="Nhóm theo"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="day">Ngày</MenuItem>
              <MenuItem value="week">Tuần</MenuItem>
              <MenuItem value="month">Tháng</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {/* Summary */}
      {data && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid xs={12} sm={4} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Tổng doanh thu</Typography>
                  <Typography variant="h5" color="primary">{fCurrency(data.totalRevenue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={4} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Tổng đơn</Typography>
                  <Typography variant="h5">{data.totalOrders}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={4} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">SP đã bán</Typography>
                  <Typography variant="h5">{data.totalItemsSold}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={4} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">TB/đơn</Typography>
                  <Typography variant="h5">{fCurrency(data.averageOrderValue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={4} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Lợi nhuận</Typography>
                  <Typography variant="h5" color="success.main">{fCurrency(data.grossProfit)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Period Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Chi tiết theo kỳ</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kỳ</TableCell>
                      <TableCell align="right">Doanh thu</TableCell>
                      <TableCell align="right">Lợi nhuận</TableCell>
                      <TableCell align="right">Số đơn</TableCell>
                      <TableCell align="right">SP bán</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.periods.map((p) => (
                      <TableRow key={p.period}>
                        <TableCell>{p.period}</TableCell>
                        <TableCell align="right">{fCurrency(p.revenue)}</TableCell>
                        <TableCell align="right">{fCurrency(p.profit)}</TableCell>
                        <TableCell align="right">{p.orderCount}</TableCell>
                        <TableCell align="right">{p.itemsSold}</TableCell>
                      </TableRow>
                    ))}
                    {data.periods.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">Không có dữ liệu trong khoảng thời gian này</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {loading && <Typography>Đang tải...</Typography>}
    </Box>
  );
}
