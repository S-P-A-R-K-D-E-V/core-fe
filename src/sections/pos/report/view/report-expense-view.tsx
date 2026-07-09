'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import { AppDatePicker } from 'src/components/date-time-picker';
import Chart, { useChart } from 'src/components/chart';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { IExpenseReport } from 'src/types/corecms-api';
import { getExpenseReport } from 'src/api/reports';

// ----------------------------------------------------------------------

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function ReportExpenseView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState<IExpenseReport | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const report = await getExpenseReport({ fromDate, toDate, groupBy });
      setData(report);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải báo cáo chi phí', { variant: 'error' });
    }
  }, [fromDate, toDate, groupBy, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodChartOptions = useChart({
    xaxis: { categories: data?.periods.map((p) => p.period) || [] },
    tooltip: { y: { formatter: (value: number) => fCurrency(value) } },
  });

  const categoryChartOptions = useChart({
    labels: data?.byCategory.map((c) => c.categoryName) || [],
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: (value: number) => fCurrency(value) } },
  });

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Báo cáo chi phí
        </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
            <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
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

      {data && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng chi phí
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {fCurrency(data.totalExpense)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Chi phí theo kỳ
                  </Typography>
                  <Chart
                    type="bar"
                    series={[{ name: 'Chi phí', data: data.periods.map((p) => p.amount) }]}
                    options={periodChartOptions}
                    height={320}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Theo danh mục
                  </Typography>
                  <Chart
                    type="pie"
                    series={data.byCategory.map((c) => c.amount)}
                    options={categoryChartOptions}
                    height={320}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Chi tiết theo kỳ
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kỳ</TableCell>
                      <TableCell align="right">Chi phí</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.periods.map((p) => (
                      <TableRow key={p.period}>
                        <TableCell>{p.period}</TableCell>
                        <TableCell align="right">{fCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {data.periods.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          Không có dữ liệu trong khoảng thời gian này
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
      </Box>
    </RoleBasedGuard>
  );
}
