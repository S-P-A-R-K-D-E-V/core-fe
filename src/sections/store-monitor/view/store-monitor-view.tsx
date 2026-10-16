'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fTime, fDateTime } from 'src/utils/format-time';

import { getTodayBoard, getStoreMonitor } from 'src/api/store-monitor';

import Iconify from 'src/components/iconify';
import Chart, { useChart } from 'src/components/chart';

import { StatCard, STAFF_STATUS } from '../store-monitor-shared';

import type { ITodayBoard, IStoreMonitor, IStoreMonitorDevice } from 'src/types/store-monitor';

// ----------------------------------------------------------------------
// Giám sát cửa hàng: lượt khách qua camera cửa (spark-camera-agent), số khách đang ở trong, hoá đơn,
// tỉ lệ chuyển đổi, nhân sự hôm nay và trạng thái thiết bị. Tự làm mới 30 giây khi xem hôm nay.

const REFRESH_MS = 30_000;

const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');
const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('vi-VN')}%`);

function todayVn() {
  // yyyy-MM-dd theo giờ Việt Nam, không phụ thuộc múi giờ máy xem.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// ----------------------------------------------------------------------

function HourlyChart({ data }: { data: IStoreMonitor }) {
  // Chỉ hiện khung giờ có số liệu (tối thiểu 7h–22h) để cột không bị ép mỏng.
  const hours = useMemo(() => {
    const active = data.hourly.filter((h) => h.in || h.out || h.orders).map((h) => h.hour);
    const from = Math.min(7, ...active);
    const to = Math.max(22, ...active);
    return data.hourly.filter((h) => h.hour >= from && h.hour <= to);
  }, [data.hourly]);

  const options = useChart({
    xaxis: { categories: hours.map((h) => `${h.hour}h`) },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
    stroke: { width: [0, 0, 3] },
    legend: { show: true, position: 'top', horizontalAlign: 'right' },
    tooltip: { shared: true, intersect: false },
    yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
  });

  return (
    <Chart
      dir="ltr"
      type="line"
      series={[
        { name: 'Khách vào', type: 'column', data: hours.map((h) => h.in) },
        { name: 'Khách ra', type: 'column', data: hours.map((h) => h.out) },
        { name: 'Hoá đơn', type: 'line', data: hours.map((h) => h.orders) },
      ]}
      options={options}
      width="100%"
      height={320}
    />
  );
}

// ----------------------------------------------------------------------

function DeviceRow({ device }: { device: IStoreMonitorDevice }) {
  const isAgent = device.kind === 'camera-agent';
  let chip: { label: string; color: 'success' | 'error' | 'default' };
  if (!isAgent) chip = { label: 'Kiosk chấm công', color: 'default' };
  else if (device.online) chip = { label: 'Đang chạy', color: 'success' };
  else chip = { label: 'Mất kết nối', color: 'error' };

  return (
    <Stack spacing={1} sx={{ py: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Iconify icon={isAgent ? 'solar:videocamera-record-bold' : 'solar:monitor-smartphone-bold'} width={20} />
        <Typography variant="subtitle2">{device.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {device.branchName}
          {device.agentVersion ? ` · agent ${device.agentVersion}` : ''}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" variant="soft" color={chip.color} label={chip.label} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Hoạt động gần nhất: {device.lastSeenAt ? fDateTime(device.lastSeenAt) : '—'}
      </Typography>
      {device.cameras.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {device.cameras.map((c) => (
            <Chip
              key={c.key}
              size="small"
              variant="outlined"
              color={c.online && device.online ? 'success' : 'error'}
              icon={<Iconify icon="solar:camera-bold" width={16} />}
              label={`${c.name || c.key}${c.online && c.fps ? ` · ${c.fps.toFixed(1)} fps` : ' · mất hình'}`}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function StoreMonitorView() {
  const [date, setDate] = useState(todayVn);
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<IStoreMonitor | null>(null);
  const [board, setBoard] = useState<ITodayBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isToday = date === todayVn();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [monitor, today] = await Promise.all([
          getStoreMonitor({ date, branchId }),
          isToday ? getTodayBoard().catch(() => null) : Promise.resolve(null),
        ]);
        setData(monitor);
        setBoard(today);
        setError(null);
      } catch (err: any) {
        setError(err?.title || err?.message || 'Không tải được số liệu giám sát.');
      } finally {
        setLoading(false);
      }
    },
    [date, branchId, isToday]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isToday) return undefined;
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [isToday, load]);

  const hasCameraData = !!data && (data.totals.in > 0 || data.branches.some((b) => b.hasCamera));
  const staffWorking = board?.counts.working ?? null;

  return (
    <Container maxWidth="xl">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">Giám sát cửa hàng</Typography>
          <Typography variant="body2" color="text.secondary">
            Lượt khách qua camera cửa, hoá đơn và nhân sự
            {data ? ` · cập nhật ${fTime(data.generatedAt, 'HH:mm:ss')}` : ''}
            {isToday ? ' · tự làm mới 30 giây' : ''}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            id="store-monitor-date"
            type="date"
            size="small"
            label="Ngày"
            value={date}
            onChange={(e) => setDate(e.target.value || todayVn())}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: todayVn() }}
          />
          <TextField
            id="store-monitor-branch"
            select
            size="small"
            label="Chi nhánh"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả chi nhánh</MenuItem>
            {(data?.branches ?? []).map((b) => (
              <MenuItem key={b.branchId} value={b.branchId}>
                {b.branchName}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:refresh-bold" />}
            onClick={() => load()}
            disabled={loading}
          >
            Làm mới
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && !data ? (
        <Stack alignItems="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      ) : (
        data && (
          <Stack spacing={3}>
            {!hasCameraData && (
              <Alert severity="info">
                Chưa có camera đếm khách nào gửi số liệu. Cài <strong>Spark Camera Agent</strong> trên máy tính ở
                quầy (cùng mạng Wi-Fi với camera), rồi nhập mã 6 số agent hiện ra ở trang{' '}
                <Link component={RouterLink} href={paths.dashboard.storeSettings.devices}>
                  Thiết bị cửa hàng
                </Link>. Hoá đơn và nhân sự vẫn hiện
                bên dưới.
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <StatCard
                  title="Khách vào"
                  value={num(data.totals.in)}
                  caption={`${num(data.totals.out)} lượt ra`}
                  icon="solar:login-3-bold"
                  color="primary"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <StatCard
                  title="Đang trong cửa hàng"
                  value={data.totals.occupancy === null ? '—' : num(data.totals.occupancy)}
                  caption={data.isToday ? 'Ước tính: vào − ra' : 'Chỉ có khi xem hôm nay'}
                  icon="solar:users-group-rounded-bold"
                  color="info"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <StatCard
                  title="Hoá đơn"
                  value={num(data.totals.orders)}
                  caption={money(data.totals.revenue)}
                  icon="solar:bill-list-bold"
                  color="success"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <StatCard
                  title="Tỉ lệ chuyển đổi"
                  value={pct(data.totals.conversionRate)}
                  caption="Hoá đơn / lượt khách vào"
                  icon="solar:chart-2-bold"
                  color="warning"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <StatCard
                  title="Nhân viên đang làm"
                  value={staffWorking === null ? '—' : num(staffWorking)}
                  caption={
                    board
                      ? `${num(board.counts.late)} đi muộn · ${num(board.counts.notIn)} chưa vào`
                      : 'Chỉ có khi xem hôm nay'
                  }
                  icon="solar:user-id-bold"
                  color="secondary"
                />
              </Grid>
            </Grid>

            <Card>
              <CardHeader title="Theo giờ" subheader="Lượt khách vào/ra qua camera và số hoá đơn mỗi giờ" />
              <Box sx={{ p: 2 }}>
                <HourlyChart data={data} />
              </Box>
            </Card>

            <Card>
              <CardHeader title="Theo chi nhánh" />
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Chi nhánh</TableCell>
                      <TableCell align="right">Vào</TableCell>
                      <TableCell align="right">Ra</TableCell>
                      <TableCell align="right">Đang trong</TableCell>
                      <TableCell align="right">Hoá đơn</TableCell>
                      <TableCell align="right">Doanh thu</TableCell>
                      <TableCell align="right">Chuyển đổi</TableCell>
                      <TableCell>Camera</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.branches.map((b) => (
                      <TableRow key={b.branchId} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{b.branchName}</Typography>
                          {b.lastEventAt && (
                            <Typography variant="caption" color="text.secondary">
                              Lượt gần nhất {fTime(b.lastEventAt)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{num(b.in)}</TableCell>
                        <TableCell align="right">{num(b.out)}</TableCell>
                        <TableCell align="right">{b.occupancy === null ? '—' : num(b.occupancy)}</TableCell>
                        <TableCell align="right">{num(b.orders)}</TableCell>
                        <TableCell align="right">{money(b.revenue)}</TableCell>
                        <TableCell align="right">{pct(b.conversionRate)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="soft"
                            color={b.hasCamera ? 'success' : 'default'}
                            label={b.hasCamera ? 'Có' : 'Chưa lắp'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card sx={{ height: 1 }}>
                  <CardHeader
                    title="Nhân sự hôm nay"
                    subheader={board ? 'Toàn cửa hàng, theo ca được phân' : 'Chỉ xem được cho ngày hôm nay'}
                  />
                  {board && board.items.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
                      Hôm nay chưa phân ca cho ai.
                    </Typography>
                  )}
                  {board && board.items.length > 0 && (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 520 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Nhân viên</TableCell>
                            <TableCell>Ca</TableCell>
                            <TableCell>Trạng thái</TableCell>
                            <TableCell>Vào / Ra</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {board.items.map((s) => (
                            <TableRow key={s.assignmentId}>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                  <Avatar src={s.avatarUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                                    {s.staffName.charAt(0)}
                                  </Avatar>
                                  <Typography variant="body2">{s.staffName}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{s.shiftName}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {s.startTime}–{s.endTime}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  <Chip
                                    size="small"
                                    variant="soft"
                                    color={STAFF_STATUS[s.status]?.color ?? 'default'}
                                    label={STAFF_STATUS[s.status]?.label ?? s.status}
                                  />
                                  {s.lateMinutes > 0 && (
                                    <Chip size="small" variant="soft" color="error" label={`Muộn ${s.lateMinutes}′`} />
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {s.checkInTime ? fTime(s.checkInTime) : '—'} / {s.checkOutTime ? fTime(s.checkOutTime) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: 1 }}>
                  <CardHeader title="Thiết bị" subheader="Agent camera và kiosk chấm công" />
                  <Stack sx={{ px: 3, pb: 2 }} divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                    {data.devices.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Chưa có thiết bị nào.
                      </Typography>
                    ) : (
                      data.devices.map((d) => <DeviceRow key={d.id} device={d} />)
                    )}
                  </Stack>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        )
      )}
    </Container>
  );
}
