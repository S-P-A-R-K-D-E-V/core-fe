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
  const [prevRevenue, setPrevRevenue] = useState<IRevenueReport | null>(null);
  const [prevExpense, setPrevExpense] = useState<IExpenseReport | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Kỳ trước = khoảng cùng độ dài ngay trước [fromDate, toDate] (để so sánh MoM)
      const msPerDay = 86_400_000;
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const lenDays = Math.round((to.getTime() - from.getTime()) / msPerDay);
      const prevTo = new Date(from.getTime() - msPerDay);
      const prevFrom = new Date(prevTo.getTime() - lenDays * msPerDay);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const [revenueResult, expenseResult, breakEvenResult, prevRevenueResult, prevExpenseResult] =
        await Promise.all([
          getRevenueReport({ fromDate, toDate, groupBy: 'day' }),
          getExpenseReport({ fromDate, toDate, groupBy: 'day' }),
          getBreakEvenAnalysis({ period: 'month', targetDate: toDate }),
          getRevenueReport({ fromDate: iso(prevFrom), toDate: iso(prevTo), groupBy: 'day' }),
          getExpenseReport({ fromDate: iso(prevFrom), toDate: iso(prevTo), groupBy: 'day' }),
        ]);
      setRevenue(revenueResult);
      setExpense(expenseResult);
      setBreakEven(breakEvenResult);
      setPrevRevenue(prevRevenueResult);
      setPrevExpense(prevExpenseResult);
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

  // Chỉ số nâng cao: run-rate, MoM, cơ cấu chi phí, số đơn hòa vốn
  const advanced = useMemo(() => {
    if (!breakEven || !revenue) return null;

    const to = new Date(toDate);
    const daysInMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
    // Ngày đã trôi qua trong tháng của toDate (kẹp trong [1, daysInMonth])
    const isCurrentMonth =
      to.getFullYear() === new Date().getFullYear() && to.getMonth() === new Date().getMonth();
    const daysElapsed = isCurrentMonth ? Math.min(daysInMonth, to.getDate()) : daysInMonth;

    const contributionMargin = 1 - breakEven.cogsRatio; // biên đóng góp
    const monthRevenueSoFar = breakEven.actualRevenue;
    const opexMonth = breakEven.operatingCost?.total ?? breakEven.fixedCosts;

    const runRateRevenue = daysElapsed > 0 ? (monthRevenueSoFar / daysElapsed) * daysInMonth : 0;
    const projectedNetProfit = runRateRevenue * contributionMargin - opexMonth;
    const dailyBreakEvenTarget = daysInMonth > 0 ? breakEven.breakEvenRevenue / daysInMonth : 0;
    const actualDailyAvg = daysElapsed > 0 ? monthRevenueSoFar / daysElapsed : 0;

    // MoM: so kỳ hiện tại (khoảng chọn) vs kỳ trước cùng độ dài
    const curRevenue = revenue.totalRevenue;
    const curExpense = expense?.totalExpense ?? 0;
    const curNet = revenue.grossProfit - curExpense;
    const pRevenue = prevRevenue?.totalRevenue ?? 0;
    const pExpense = prevExpense?.totalExpense ?? 0;
    const pNet = (prevRevenue?.grossProfit ?? 0) - pExpense;
    const pct = (cur: number, prev: number) =>
      prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;

    // Cơ cấu chi phí
    const oc = breakEven.operatingCost;
    const costStructure = oc
      ? [
          { label: 'Cố định', value: oc.fixedCost },
          { label: 'Biến đổi', value: oc.variableCost },
          { label: 'Lương', value: oc.laborCost },
          { label: 'Khác', value: oc.otherCost },
        ].filter((s) => s.value > 0)
      : [];
    const laborRatio = runRateRevenue > 0 ? (oc?.laborCost ?? 0) / runRateRevenue : 0;
    const opexRatio = runRateRevenue > 0 ? opexMonth / runRateRevenue : 0;

    // Số đơn cần để hòa vốn
    const aov = revenue.averageOrderValue > 0 ? revenue.averageOrderValue : 0;
    const breakEvenOrders = aov > 0 ? Math.ceil(breakEven.breakEvenRevenue / aov) : 0;

    return {
      runRateRevenue,
      projectedNetProfit,
      dailyBreakEvenTarget,
      actualDailyAvg,
      daysElapsed,
      daysInMonth,
      mom: {
        revenue: { cur: curRevenue, prev: pRevenue, pct: pct(curRevenue, pRevenue) },
        expense: { cur: curExpense, prev: pExpense, pct: pct(curExpense, pExpense) },
        net: { cur: curNet, prev: pNet, pct: pct(curNet, pNet) },
      },
      costStructure,
      laborRatio,
      opexRatio,
      contributionMargin,
      breakEvenOrders,
      aov,
      currentOrders: revenue.totalOrders,
    };
  }, [breakEven, revenue, expense, prevRevenue, prevExpense, toDate]);

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

  const costStructureOptions = useChart({
    labels: advanced?.costStructure.map((s) => s.label) || [],
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: (value: number) => fCurrency(value) } },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            value: { formatter: (value: string | number) => fCurrency(Number(value)) },
            total: {
              formatter: (w: { globals: { seriesTotals: number[] } }) =>
                fCurrency(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
            },
          },
        },
      },
    },
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

        {advanced && (
          <>
            {/* Run-rate: dự phóng cuối tháng + mục tiêu/ngày */}
            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              Dự phóng cuối tháng (theo tốc độ hiện tại — {advanced.daysElapsed}/{advanced.daysInMonth} ngày)
            </Typography>
            <Grid container spacing={3} sx={{ mb: 1 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Doanh thu dự phóng</Typography>
                    <Typography variant="h5" color="primary.main">{fCurrency(advanced.runRateRevenue)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">LN ròng dự phóng</Typography>
                    <Typography variant="h5" color={advanced.projectedNetProfit >= 0 ? 'success.main' : 'error.main'}>
                      {fCurrency(advanced.projectedNetProfit)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Cần đạt/ngày (hòa vốn)</Typography>
                    <Typography variant="h5">{fCurrency(advanced.dailyBreakEvenTarget)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">TB thực tế/ngày</Typography>
                    <Typography
                      variant="h5"
                      color={advanced.actualDailyAvg >= advanced.dailyBreakEvenTarget ? 'success.main' : 'error.main'}
                    >
                      {fCurrency(advanced.actualDailyAvg)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* MoM + tỷ lệ sức khỏe + break-even units */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: 1 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>So với kỳ trước</Typography>
                    <Stack spacing={2}>
                      {([
                        { label: 'Doanh thu', item: advanced.mom.revenue, goodUp: true },
                        { label: 'Chi phí', item: advanced.mom.expense, goodUp: false },
                        { label: 'Lợi nhuận ròng', item: advanced.mom.net, goodUp: true },
                      ] as const).map((row) => {
                        const up = row.item.pct !== null && row.item.pct >= 0;
                        const good = row.item.pct === null ? undefined : row.goodUp ? up : !up;
                        return (
                          <Stack key={row.label} direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="subtitle2">{fCurrency(row.item.cur)}</Typography>
                              <Typography
                                variant="caption"
                                sx={{ minWidth: 60, textAlign: 'right' }}
                                color={good === undefined ? 'text.disabled' : good ? 'success.main' : 'error.main'}
                              >
                                {row.item.pct === null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(row.item.pct).toFixed(1)}%`}
                              </Typography>
                            </Stack>
                          </Stack>
                        );
                      })}
                    </Stack>

                    <Stack spacing={1.5} sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary">Tỷ lệ sức khỏe</Typography>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Biên đóng góp (1 − COGS%)</Typography>
                        <Typography variant="subtitle2">{fPercent(advanced.contributionMargin * 100)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Chi phí vận hành / Doanh thu</Typography>
                        <Typography variant="subtitle2">{fPercent(advanced.opexRatio * 100)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Lương / Doanh thu</Typography>
                        <Typography variant="subtitle2">{fPercent(advanced.laborRatio * 100)}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Cơ cấu chi phí */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: 1 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Cơ cấu chi phí hoạt động</Typography>
                    {advanced.costStructure.length > 0 ? (
                      <Chart
                        type="donut"
                        series={advanced.costStructure.map((s) => s.value)}
                        options={costStructureOptions}
                        height={300}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">Chưa có dữ liệu chi phí.</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Số đơn cần để hòa vốn */}
              <Grid size={{ xs: 12, md: 3 }}>
                <Card sx={{ height: 1 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Đơn hàng hòa vốn</Typography>
                    <Typography variant="subtitle2" color="text.secondary">Số đơn cần/tháng</Typography>
                    <Typography variant="h4" color="primary.main" sx={{ mb: 2 }}>
                      {advanced.breakEvenOrders > 0 ? advanced.breakEvenOrders.toLocaleString('vi-VN') : '—'}
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Giá trị đơn TB</Typography>
                        <Typography variant="subtitle2">{fCurrency(advanced.aov)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Đơn thực tế (kỳ)</Typography>
                        <Typography variant="subtitle2">{advanced.currentOrders.toLocaleString('vi-VN')}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </RoleBasedGuard>
  );
}
