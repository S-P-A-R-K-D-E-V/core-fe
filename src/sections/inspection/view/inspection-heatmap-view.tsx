'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getInspectionStats } from 'src/api/inspection';

import Chart, { useChart } from 'src/components/chart';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IInspectionStats, IInspectionStatCell } from 'src/types/inspection';

import { toDateInput } from '../inspection-common';

// ----------------------------------------------------------------------
// Bản đồ lỗi: số lần không đạt theo tuần — khu × tuần và mục × tuần (chỉ các mục có lỗi). Lỗi của mục gắn nhiều khu tính
// cho mọi khu của mục; mục không gắn khu ở dòng "Chung".
// ----------------------------------------------------------------------

type HeatSeries = { name: string; data: { x: string; y: number; pass: number }[] }[];

/** Mỗi khoá (khu / mục) một dòng, mỗi tuần một ô = số lần không đạt. */
export function toHeatSeries(weeks: string[], cells: IInspectionStatCell[], onlyWithFails: boolean): HeatSeries {
  const keys = Array.from(new Set(cells.map((c) => c.key)));
  return keys
    .map((key) => {
      const own = cells.filter((c) => c.key === key);
      return {
        name: own[own.length - 1]?.label ?? key,
        key,
        data: weeks.map((w) => {
          const cell = own.find((c) => c.weekStart === w);
          return { x: fDate(w, 'dd/MM'), y: cell?.fail ?? 0, pass: cell?.pass ?? 0 };
        }),
      };
    })
    .filter((s) => !onlyWithFails || s.data.some((d) => d.y > 0))
    .map(({ name, data }) => ({ name, data }))
    .reverse(); // ApexCharts vẽ dòng đầu ở dưới cùng
}

function Heatmap({ title, series, emptyText }: { title: string; series: HeatSeries; emptyText: string }) {
  const options = useChart({
    chart: { type: 'heatmap' },
    dataLabels: { enabled: true },
    legend: { show: false },
    plotOptions: {
      heatmap: {
        shadeIntensity: 0.4,
        colorScale: {
          ranges: [
            { from: 0, to: 0, color: '#22C55E', name: 'Không lỗi' },
            { from: 1, to: 2, color: '#FFAB00', name: '1–2 lỗi' },
            { from: 3, to: 1000, color: '#FF5630', name: 'Từ 3 lỗi' },
          ],
        },
      },
    },
    tooltip: {
      y: {
        formatter: (value: number, { seriesIndex, dataPointIndex, w }: any) => {
          const point = w.config.series[seriesIndex].data[dataPointIndex];
          return `${value} không đạt / ${value + (point?.pass ?? 0)} lượt`;
        },
      },
    },
  });

  return (
    <Card>
      <CardHeader title={title} />
      <Box sx={{ p: 2 }}>
        {series.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {emptyText}
          </Typography>
        ) : (
          <Chart dir="ltr" type="heatmap" series={series} options={options} width="100%" height={Math.max(220, series.length * 34 + 80)} />
        )}
      </Box>
    </Card>
  );
}

export default function InspectionHeatmapView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [weeks, setWeeks] = useState(8);
  const [stats, setStats] = useState<IInspectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - (weeks * 7 - 1) * 86400000);
      setStats(await getInspectionStats(toDateInput(from), toDateInput(to)));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được bản đồ lỗi'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [weeks, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const zoneSeries = useMemo(() => (stats ? toHeatSeries(stats.weeks, stats.byZone, false) : []), [stats]);
  const itemSeries = useMemo(() => (stats ? toHeatSeries(stats.weeks, stats.byItem, true) : []), [stats]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bản đồ lỗi"
        links={[{ name: 'Kiểm tra cửa hàng', href: paths.dashboard.inspection.root }, { name: 'Bản đồ lỗi' }]}
        action={
          <TextField select size="small" label="Khoảng" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            <MenuItem value={8}>8 tuần</MenuItem>
            <MenuItem value={12}>12 tuần</MenuItem>
            <MenuItem value={26}>26 tuần</MenuItem>
          </TextField>
        }
        sx={{ mb: 3 }}
      />
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Heatmap title="Khu × tuần" series={zoneSeries} emptyText="Chưa có lượt kiểm nào đã nộp." />
          <Heatmap title="Mục × tuần (mục có lỗi)" series={itemSeries} emptyText="Không có mục nào không đạt." />
        </Stack>
      )}
    </Container>
  );
}
