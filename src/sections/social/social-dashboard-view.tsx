'use client';

import type {
  SocialDashboardDay,
  SocialDashboardDays,
  SocialDashboardPost,
  SocialDashboardChannel,
} from 'src/lib/social';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';
import { fNumber, fCurrency } from 'src/utils/format-number';

import { engagementRate, SOCIAL_DASHBOARD_DAYS } from 'src/lib/social';
import { useSocialDashboard } from 'src/api/social';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import EmptyContent from 'src/components/empty-content';
import Chart, { useChart } from 'src/components/chart';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Tổng quan Bán hàng online: tương tác trên Threads + đơn / doanh thu đến từ link trong bài, theo kênh và theo bài.
// Doanh thu = tiền hàng của đơn online đã thanh toán có mã nguồn bài (khách bấm link, trình duyệt nhớ 30 ngày).

const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : fNumber(v) || '0');
const money = (v: number) => (v ? fCurrency(v) : '0 ₫');

type Kpi = { label: string; value: string; icon: string; hint?: string };

export function SocialDashboardView() {
  const settings = useSettingsContext();
  const [days, setDays] = useState<SocialDashboardDays>(7);
  const { dashboard, loading, error } = useSocialDashboard(days);

  const totals = dashboard?.totals;
  const kpis: Kpi[] = totals
    ? [
        { label: 'Bài đã đăng', value: num(totals.posts), icon: 'solar:document-text-bold-duotone' },
        {
          label: 'Lượt xem bài',
          value: num(totals.views),
          icon: 'solar:eye-bold-duotone',
          hint: 'Tổng lượt xem các bài đăng từ đây trong kỳ (Threads cập nhật vài giờ một lần).',
        },
        {
          label: 'Tương tác',
          value: num(totals.interactions),
          icon: 'solar:heart-bold-duotone',
          hint: `Thích + trả lời + đăng lại + trích dẫn + chia sẻ${
            engagementRate(totals.interactions, totals.views) !== null
              ? ` · ${engagementRate(totals.interactions, totals.views)}% lượt xem`
              : ''
          }`,
        },
        {
          label: 'Bấm link',
          value: num(totals.clicks),
          icon: 'solar:cursor-bold-duotone',
          hint: 'Lượt bấm link trong bài của các tài khoản Threads (số của Threads).',
        },
        { label: 'Đơn hàng', value: num(totals.orders), icon: 'solar:cart-large-2-bold-duotone' },
        {
          label: 'Doanh thu',
          value: money(totals.revenue),
          icon: 'solar:wallet-money-bold-duotone',
          hint: 'Tiền hàng của đơn online đã thanh toán đến từ link trong bài (không gồm phí ship).',
        },
      ]
    : [];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Tổng quan"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: 'Tổng quan' },
        ]}
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={days}
            onChange={(_, v: SocialDashboardDays | null) => v && setDays(v)}
            aria-label="Khoảng thời gian"
          >
            {SOCIAL_DASHBOARD_DAYS.map((d) => (
              <ToggleButton key={d} value={d}>
                {d} ngày
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {error && <Alert severity="error">{apiErrorMessage(error, 'Không tải được số liệu')}</Alert>}

      {loading && (
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={110} />
          <Skeleton variant="rounded" height={340} />
        </Stack>
      )}

      {dashboard && dashboard.channels.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có kênh nào"
          description="Kết nối tài khoản Threads của cửa hàng để theo dõi tương tác và doanh thu."
          action={
            <Button component={RouterLink} href={paths.dashboard.social.channels} variant="contained" sx={{ mt: 2 }}>
              Tới Kênh kết nối
            </Button>
          }
          sx={{ py: 8 }}
        />
      )}

      {dashboard && dashboard.channels.length > 0 && (
        <Stack spacing={3}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {fDate(dashboard.from)} – {fDate(dashboard.to)}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
            }}
          >
            {kpis.map((k) => (
              <Card key={k.label} sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: 'text.secondary' }}>
                  <Iconify icon={k.icon} width={20} />
                  <Typography variant="subtitle2" noWrap>
                    {k.label}
                  </Typography>
                  {k.hint && (
                    <Tooltip title={k.hint}>
                      <Iconify icon="eva:info-outline" width={16} sx={{ ml: 'auto', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Stack>
                <Typography variant="h4" noWrap>
                  {k.value}
                </Typography>
              </Card>
            ))}
          </Box>

          <DailyChart daily={dashboard.daily} />

          <ChannelsTable channels={dashboard.channels} />

          <TopPostsTable posts={dashboard.topPosts} />

          <Alert severity="info" variant="outlined">
            Doanh thu chỉ tính đơn đặt trên web của cửa hàng sau khi khách bấm link trong bài (link tới tên miền cửa hàng
            được tự gắn mã nguồn khi đăng). Khách xem bài rồi nhắn tin hoặc mua tại quầy thì chưa đo được.
          </Alert>
        </Stack>
      )}
    </Container>
  );
}

// ----------------------------------------------------------------------

function DailyChart({ daily }: { daily: SocialDashboardDay[] }) {
  const options = useChart({
    labels: daily.map((d) => d.date),
    xaxis: { type: 'datetime' },
    stroke: { width: [0, 3] },
    plotOptions: { bar: { columnWidth: daily.length > 31 ? '70%' : '40%' } },
    yaxis: [
      { title: { text: 'Doanh thu' }, labels: { formatter: (v: number) => fCurrency(v) || '0' } },
      { opposite: true, title: { text: 'Lượt xem' }, labels: { formatter: (v: number) => fNumber(v) || '0' } },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      x: { format: 'dd/MM/yyyy' },
    },
  });

  return (
    <Card>
      <CardHeader title="Theo ngày" subheader="Doanh thu từ link bài (cột) và lượt xem bài đăng trong ngày (đường)" />
      <Box sx={{ p: 3, pb: 1 }}>
        <Chart
          dir="ltr"
          type="line"
          series={[
            { name: 'Doanh thu', type: 'column', data: daily.map((d) => d.revenue) },
            { name: 'Lượt xem bài', type: 'line', data: daily.map((d) => d.views) },
          ]}
          options={options}
          width="100%"
          height={320}
        />
      </Box>
    </Card>
  );
}

function ChannelsTable({ channels }: { channels: SocialDashboardChannel[] }) {
  return (
    <Card>
      <CardHeader
        title="Theo kênh"
        subheader="Người theo dõi, lượt xem trang, thích, bấm link là số của cả tài khoản Threads trong kỳ"
      />
      <TableContainer sx={{ mt: 2 }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Kênh</TableCell>
              <TableCell align="right">Người theo dõi</TableCell>
              <TableCell align="right">Xem trang</TableCell>
              <TableCell align="right">Thích</TableCell>
              <TableCell align="right">Trả lời</TableCell>
              <TableCell align="right">Bấm link</TableCell>
              <TableCell align="right">Bài đăng</TableCell>
              <TableCell align="right">Xem bài</TableCell>
              <TableCell align="right">Đơn</TableCell>
              <TableCell align="right">Doanh thu</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels.map((c) => (
              <TableRow key={c.channelId} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar src={c.avatarUrl ?? undefined} alt={c.username} sx={{ width: 32, height: 32 }}>
                      {c.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack sx={{ minWidth: 0 }}>
                      <Link
                        href={`https://www.threads.com/@${c.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtitle2"
                        color="inherit"
                        noWrap
                      >
                        @{c.username}
                      </Link>
                      {c.insightsError && (
                        <Label color="warning" sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
                          {c.insightsError}
                        </Label>
                      )}
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell align="right">{num(c.followers)}</TableCell>
                <TableCell align="right">{num(c.profileViews)}</TableCell>
                <TableCell align="right">{num(c.likes)}</TableCell>
                <TableCell align="right">{num(c.replies)}</TableCell>
                <TableCell align="right">{num(c.clicks)}</TableCell>
                <TableCell align="right">{num(c.posts)}</TableCell>
                <TableCell align="right">{num(c.postViews)}</TableCell>
                <TableCell align="right">{num(c.orders)}</TableCell>
                <TableCell align="right">{money(c.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function TopPostsTable({ posts }: { posts: SocialDashboardPost[] }) {
  return (
    <Card>
      <CardHeader title="Bài hiệu quả nhất" subheader="Bài đăng trong kỳ, xếp theo doanh thu rồi lượt xem" />
      {posts.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', p: 3 }}>
          Chưa có bài nào đăng trong kỳ này.
        </Typography>
      ) : (
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Bài</TableCell>
                <TableCell>Kênh</TableCell>
                <TableCell align="right">Xem</TableCell>
                <TableCell align="right">Tương tác</TableCell>
                <TableCell align="right">Bấm link</TableCell>
                <TableCell align="right">Đơn</TableCell>
                <TableCell align="right">Doanh thu</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {posts.map((p) => {
                const rate = engagementRate(p.interactions, p.views);
                return (
                  <TableRow key={p.targetId} hover>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography
                        variant="body2"
                        sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {p.text}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary' }}>
                        {p.publishedAt && <span>{fDateTime(p.publishedAt)}</span>}
                        {p.permalink && (
                          <Link href={p.permalink} target="_blank" rel="noopener noreferrer">
                            Xem trên Threads
                          </Link>
                        )}
                        <Link component={RouterLink} href={paths.dashboard.social.edit(p.postId)}>
                          Chi tiết
                        </Link>
                      </Stack>
                    </TableCell>
                    <TableCell>@{p.channelUsername}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={p.insightsAt ? `Cập nhật ${fDateTime(p.insightsAt)}` : 'Chưa có số liệu từ Threads'}>
                        <span>{num(p.views)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      {num(p.interactions)}
                      {rate !== null && (
                        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                          ({rate}%)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{num(p.clicks)}</TableCell>
                    <TableCell align="right">{num(p.orders)}</TableCell>
                    <TableCell align="right">{money(p.revenue)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}
