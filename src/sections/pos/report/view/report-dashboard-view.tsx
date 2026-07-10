'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency, fPercent, fShortenNumber } from 'src/utils/format-number';
import { AppDatePicker } from 'src/components/date-time-picker';
import Chart, { useChart } from 'src/components/chart';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { IRevenueReport, IExpenseReport, IBreakEvenAnalysis } from 'src/types/corecms-api';
import { getRevenueReport, getExpenseReport, getBreakEvenAnalysis } from 'src/api/reports';

// ----------------------------------------------------------------------

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function ReportDashboardView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [revenue, setRevenue] = useState<IRevenueReport | null>(null);
  const [expense, setExpense] = useState<IExpenseReport | null>(null);
  const [breakEven, setBreakEven] = useState<IBreakEvenAnalysis | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [revenueResult, expenseResult, breakEvenResult] = await Promise.all([
        getRevenueReport({ fromDate, toDate, groupBy: 'day' }),
        getExpenseReport({ fromDate, toDate, groupBy: 'day' }),
        getBreakEvenAnalysis({ period: 'month', targetDate: toDate }),
      ]);
      setRevenue(revenueResult);
      setExpense(expenseResult);
      setBreakEven(breakEvenResult);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải dashboard tài chính', { variant: 'error' });
    }
  }, [fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const netProfit = revenue && expense ? revenue.grossProfit - expense.totalExpense : 0;

  const achievedPercent = breakEven && breakEven.breakEvenRevenue > 0
    ? Math.min(999, (breakEven.actualRevenue / breakEven.breakEvenRevenue) * 100)
    : 0;

  const chartData = useMemo(() => {
    if (!revenue || !expense) return { categories: [] as string[], revenueSeries: [] as number[], costSeries: [] as number[], expenseSeries: [] as number[] };

    const periods = Array.from(
      new Set([...revenue.periods.map((p) => p.period), ...expense.periods.map((p) => p.period)])
    ).sort();

    const revenueByPeriod = new Map(revenue.periods.map((p) => [p.period, p]));
    const expenseByPeriod = new Map(expense.periods.map((p) => [p.period, p.amount]));

    return {
      categories: periods,
      revenueSeries: periods.map((p) => revenueByPeriod.get(p)?.revenue ?? 0),
      costSeries: periods.map((p) => revenueByPeriod.get(p)?.cost ?? 0),
      expenseSeries: periods.map((p) => expenseByPeriod.get(p) ?? 0),
    };
  }, [revenue, expense]);

  const trendChartOptions = useChart({
    xaxis: { categories: chartData.categories },
    yaxis: { labels: { formatter: (value: number) => (value ? fShortenNumber(value) : '0') } },
    tooltip: { y: { formatter: (value: number) => fCurrency(value) } },
  });

  const gaugeOptions = useChart({
    chart: { sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        hollow: { size: '60%' },
        dataLabels: {
          value: { formatter: (val: number) => `${val.toFixed(0)}%`, fontSize: '28px' },
          total: {
            show: true,
            label: 'Đạt hòa vốn',
            formatter: () => `${Math.min(100, achievedPercent).toFixed(0)}%`,
          },
        },
      },
    },
    colors: [achievedPercent >= 100 ? '#22C55E' : '#FF5630'],
    labels: ['Đạt hòa vốn'],
  });

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography variant="h4">Dashboard tài chính</Typography>
          <Button component={RouterLink} href={paths.dashboard.pos.report.breakEven} variant="outlined">
            Xem chi tiết điểm hòa vốn
          </Button>
        </Stack>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={2}>
              <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
              <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
            </Stack>
          </CardContent>
        </Card>

        {revenue && expense && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Doanh thu</Typography>
                  <Typography variant="h5" color="primary.main">{fCurrency(revenue.totalRevenue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Giá vốn (COGS)</Typography>
                  <Typography variant="h5">{fCurrency(revenue.totalCost)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Lợi nhuận gộp</Typography>
                  <Typography variant="h5" color="success.main">{fCurrency(revenue.grossProfit)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Chi phí vận hành</Typography>
                  <Typography variant="h5" color="error.main">{fCurrency(expense.totalExpense)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Lợi nhuận ròng</Typography>
                  <Typography variant="h5" color={netProfit >= 0 ? 'success.main' : 'error.main'}>
                    {fCurrency(netProfit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ height: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Doanh thu — Giá vốn — Chi phí theo ngày</Typography>
                <Chart
                  type="line"
                  series={[
                    { name: 'Doanh thu', data: chartData.revenueSeries },
                    { name: 'Giá vốn', data: chartData.costSeries },
                    { name: 'Chi phí vận hành', data: chartData.expenseSeries },
                  ]}
                  options={trendChartOptions}
                  height={360}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>Điểm hòa vốn (tháng)</Typography>
                {breakEven && (
                  <>
                    <Chart
                      type="radialBar"
                      series={[Math.min(100, achievedPercent)]}
                      options={gaugeOptions}
                      height={220}
                    />
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Cần đạt</Typography>
                        <Typography variant="subtitle2">{fCurrency(breakEven.breakEvenRevenue)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Thực tế</Typography>
                        <Typography variant="subtitle2">{fCurrency(breakEven.actualRevenue)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">%Giá vốn tự tính</Typography>
                        <Typography variant="subtitle2">{fPercent(breakEven.cogsRatio * 100)}</Typography>
                      </Stack>
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </RoleBasedGuard>
  );
}
