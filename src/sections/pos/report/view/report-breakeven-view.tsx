'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';

import { useSnackbar } from 'src/components/snackbar';
import { fCurrency, fPercent } from 'src/utils/format-number';
import { AppDatePicker } from 'src/components/date-time-picker';
import Chart, { useChart } from 'src/components/chart';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { IBreakEvenAnalysis } from 'src/types/corecms-api';
import { getBreakEvenAnalysis } from 'src/api/reports';

// ----------------------------------------------------------------------

export default function ReportBreakEvenView() {
  const { enqueueSnackbar } = useSnackbar();

  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<IBreakEvenAnalysis | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getBreakEvenAnalysis({ period, targetDate });
      setData(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải điểm hòa vốn', { variant: 'error' });
    }
  }, [period, targetDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const achievedPercent = data && data.breakEvenRevenue > 0
    ? Math.min(999, (data.actualRevenue / data.breakEvenRevenue) * 100)
    : 0;

  const gaugeOptions = useChart({
    chart: { sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        hollow: { size: '60%' },
        dataLabels: {
          value: {
            formatter: (val: number) => `${val.toFixed(0)}%`,
            fontSize: '28px',
          },
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
        <Typography variant="h4" sx={{ mb: 3 }}>
          Điểm hòa vốn
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
              <TextField
                select
                label="Kỳ"
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'day' | 'month' | 'year')}
                size="small"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="day">Ngày</MenuItem>
                <MenuItem value="month">Tháng</MenuItem>
                <MenuItem value="year">Năm</MenuItem>
              </TextField>
              <AppDatePicker label="Ngày mục tiêu" value={targetDate} onChange={setTargetDate} size="small" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Tỷ lệ COGS tự tính từ dữ liệu bán hàng KiotViet (trailing). Chi phí hoạt động lấy từ tất cả danh mục chi phí (trừ khoản thu) đã nhập trong kỳ, phân bổ theo ngày với chi phí định kỳ — không cần ước lượng tay.
            </Typography>
          </CardContent>
        </Card>

        {data && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: 1 }}>
                <CardContent>
                  <Chart
                    type="radialBar"
                    series={[Math.min(100, achievedPercent)]}
                    options={gaugeOptions}
                    height={260}
                  />
                  <Typography variant="body2" align="center" color="text.secondary">
                    Doanh thu thực tế / Doanh thu hòa vốn
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Doanh thu hòa vốn
                      </Typography>
                      <Typography variant="h5">{fCurrency(data.breakEvenRevenue)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Doanh thu thực tế
                      </Typography>
                      <Typography variant="h5" color="primary.main">
                        {fCurrency(data.actualRevenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Chi phí hoạt động (kỳ)
                      </Typography>
                      <Typography variant="h5">{fCurrency(data.fixedCosts)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Tỷ lệ COGS (tự tính, trailing)
                      </Typography>
                      <Typography variant="h5">{fPercent(data.cogsRatio * 100)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        Biên độ an toàn (Margin of Safety)
                      </Typography>
                      <Typography variant="h5" color={data.gap >= 0 ? 'success.main' : 'error.main'}>
                        {data.gap >= 0 ? '+' : ''}
                        {fCurrency(data.gap)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        )}
      </Box>
    </RoleBasedGuard>
  );
}
