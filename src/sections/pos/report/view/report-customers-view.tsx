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
import { ICustomerReport } from 'src/types/corecms-api';
import { getCustomerReport, downloadExport } from 'src/api/reports';

// ----------------------------------------------------------------------

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: now.toISOString().split('T')[0],
  };
}

export default function ReportCustomersView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [data, setData] = useState<ICustomerReport[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const report = await getCustomerReport({ fromDate, toDate });
      setData(report);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải báo cáo khách hàng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      await downloadExport('customers', { fromDate, toDate });
      enqueueSnackbar('Xuất Excel thành công!');
    } catch (error) {
      enqueueSnackbar('Lỗi xuất Excel', { variant: 'error' });
    }
  };

  const totalSpent = data.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = data.reduce((sum, c) => sum + c.totalOrders, 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4">Báo cáo khách hàng</Typography>
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
          Tổng: <strong>{data.length}</strong> khách hàng | Đơn hàng: <strong>{totalOrders}</strong> |
          Chi tiêu: <strong>{fCurrency(totalSpent)}</strong>
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
                  <TableCell>Khách hàng</TableCell>
                  <TableCell>SĐT</TableCell>
                  <TableCell align="right">Số đơn</TableCell>
                  <TableCell align="right">Tổng chi tiêu</TableCell>
                  <TableCell align="right">TB/đơn</TableCell>
                  <TableCell>Đơn gần nhất</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((c, index) => (
                  <TableRow key={c.customerId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{c.customerName}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell align="right">{c.totalOrders}</TableCell>
                    <TableCell align="right">{fCurrency(c.totalSpent)}</TableCell>
                    <TableCell align="right">{fCurrency(c.averageOrderValue)}</TableCell>
                    <TableCell>
                      {c.lastOrderDate
                        ? new Date(c.lastOrderDate).toLocaleDateString('vi-VN')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Không có dữ liệu</TableCell>
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
