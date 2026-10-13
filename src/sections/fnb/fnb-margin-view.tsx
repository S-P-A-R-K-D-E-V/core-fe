'use client';

import type { IFnbDishMarginRow, IFnbDishMarginReport } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TableSortLabel from '@mui/material/TableSortLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { getFnbDishMargin } from 'src/api/fnb';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import FnbBranchNotice from 'src/sections/fnb-pos/fnb-branch-notice';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import {
  fPercent,
  marginTone,
  MARGIN_FILTERS,
  sortMarginRows,
  filterMarginRows,
  MARGIN_KIND_LABELS,
  type MarginFilter,
  type MarginSortKey,
} from './lib/margin';

// ----------------------------------------------------------------------
// Báo cáo lãi gộp theo món (chủ / quản lý): theo kỳ, mỗi mặt hàng đã bán có số lượng, doanh thu sau giảm giá, giá vốn
// theo định lượng lưu trên hoá đơn lúc bán, lãi gộp và tỷ lệ. Dòng chưa có giá vốn không tính vào lãi gộp.
// ----------------------------------------------------------------------

/** Ngày theo giờ máy (Việt Nam) dạng yyyy-MM-dd. */
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};

const money = (value: number) => fCurrency(value) || '0 đ';

const COLUMNS: { key: MarginSortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Mặt hàng' },
  { key: 'quantity', label: 'Số lượng', align: 'right' },
  { key: 'revenue', label: 'Doanh thu', align: 'right' },
  { key: 'cost', label: 'Giá vốn', align: 'right' },
  { key: 'profit', label: 'Lãi gộp', align: 'right' },
  { key: 'marginRate', label: 'Tỷ lệ', align: 'right' },
];

export default function FnbMarginView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { branchId } = useFnbBranches();

  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(isoDay(new Date()));
  const [report, setReport] = useState<IFnbDishMarginReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<MarginFilter>('all');
  const [sort, setSort] = useState<{ key: MarginSortKey; direction: 'asc' | 'desc' }>({
    key: 'profit',
    direction: 'desc',
  });

  const load = useCallback(async () => {
    if (!branchId || !from || !to) return;
    setLoading(true);
    try {
      setReport(await getFnbDishMargin(branchId, from, to));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được báo cáo lãi gộp'), {
        variant: 'error',
      });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, from, to, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => sortMarginRows(filterMarginRows(report?.rows ?? [], filter), sort.key, sort.direction),
    [report, filter, sort]
  );

  const totals = report?.totals;

  const preset = (start: string, end = isoDay(new Date())) => {
    setFrom(start);
    setTo(end);
  };
  const monthStart = () => {
    const d = new Date();
    return isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Bấm lại cột đang sắp thì đảo chiều; cột mới: tên tăng dần, số giảm dần.
  const sortBy = (key: MarginSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' }
    );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lãi gộp theo món"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Lãi gộp theo món' },
        ]}
        sx={{ mb: 3 }}
      />

      <FnbBranchNotice sx={{ mb: 2 }} />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            type="date"
            label="Từ ngày"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="Đến ngày"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button size="small" variant="outlined" onClick={() => preset(isoDay(new Date()))}>
            Hôm nay
          </Button>
          <Button size="small" variant="outlined" onClick={() => preset(daysAgo(6))}>
            7 ngày
          </Button>
          <Button size="small" variant="outlined" onClick={() => preset(daysAgo(29))}>
            30 ngày
          </Button>
          <Button size="small" variant="outlined" onClick={() => preset(monthStart())}>
            Tháng này
          </Button>
          {loading && <CircularProgress size={20} />}
        </Stack>
      </Card>

      {totals && report && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <Summary title="Doanh thu" value={money(totals.revenue)} detail={`${report.invoiceCount} hoá đơn`} />
          <Summary title="Giá vốn" value={money(totals.cost)} />
          <Summary title="Lãi gộp" value={money(totals.profit)} tone={totals.profit < 0 ? 'error' : 'success'} />
          <Summary
            title="Tỷ lệ lãi gộp"
            value={fPercent(totals.marginRate)}
            detail="trên doanh thu có giá vốn"
          />
          <Summary
            title="Chưa có giá vốn"
            value={money(totals.uncostedRevenue)}
            detail="doanh thu không tính vào lãi gộp"
            tone={totals.uncostedRevenue > 0 ? 'warning' : undefined}
          />
        </Stack>
      )}

      {totals && totals.uncostedRevenue > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.fnb.root}>
              Khai định lượng
            </Button>
          }
        >
          {money(totals.uncostedRevenue)} doanh thu đến từ món chưa có giá vốn: món chưa khai định lượng, món tự do, hoặc
          nguyên liệu chưa nhập lần nào. Phần này không tính vào lãi gộp.
        </Alert>
      )}

      <Card>
        <Stack direction="row" spacing={1} sx={{ p: 2, pb: 1 }} flexWrap="wrap" useFlexGap>
          {MARGIN_FILTERS.map((f) => (
            <Chip
              key={f.value}
              size="small"
              label={f.label}
              color={filter === f.value ? 'primary' : 'default'}
              variant={filter === f.value ? 'filled' : 'outlined'}
              onClick={() => setFilter(f.value)}
            />
          ))}
        </Stack>

        {!report ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            {loading ? (
              <CircularProgress />
            ) : (
              <Typography color="text.secondary">Chọn kỳ báo cáo.</Typography>
            )}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align}
                      sortDirection={sort.key === column.key ? sort.direction : false}
                    >
                      <TableSortLabel
                        active={sort.key === column.key}
                        direction={sort.key === column.key ? sort.direction : 'desc'}
                        onClick={() => sortBy(column.key)}
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <MarginRow key={row.id} row={row} />
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 3, textAlign: 'center' }}
                      >
                        {report.rows.length === 0
                          ? 'Chưa có hoá đơn nào trong kỳ.'
                          : 'Không có mặt hàng nào khớp bộ lọc.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Alert severity="info" sx={{ mt: 2 }}>
        Doanh thu = tiền thực thu của món sau giảm giá dòng và giảm giá toàn đơn (không gồm hoá đơn đã huỷ). Giá vốn =
        nguyên liệu trừ theo định lượng lúc gửi bar, tính theo giá vốn tại thời điểm bán và lưu trên hoá đơn — đổi định
        lượng hay giá nhập sau này không làm đổi số của kỳ cũ. Lãi gộp chưa trừ hao hụt, xuất huỷ và món đã pha rồi huỷ
        (xem báo cáo Hao hụt).
      </Alert>
    </Container>
  );
}

// ----------------------------------------------------------------------

function Summary({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail?: string;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <Card sx={{ p: 2, flex: 1, minWidth: 0, ...(tone && { bgcolor: `${tone}.lighter` }) }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h6" color={tone ? `${tone}.dark` : 'text.primary'}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          {detail}
        </Typography>
      )}
    </Card>
  );
}

function MarginRow({ row }: { row: IFnbDishMarginRow }) {
  const tone = marginTone(row.marginRate);
  const hasCost = row.unitCost != null;

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{row.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {[row.code, MARGIN_KIND_LABELS[row.kind]].filter(Boolean).join(' · ')}
        </Typography>
        {row.uncostedQuantity > 0 && (
          <Typography variant="caption" color="warning.main" display="block">
            {hasCost ? `${fQty(row.uncostedQuantity)} phần chưa có giá vốn` : 'Chưa có giá vốn'}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{fQty(row.quantity)}</TableCell>
      <TableCell align="right">
        <Typography variant="body2">{money(row.revenue)}</Typography>
        <Typography variant="caption" color="text.secondary">
          {row.averagePrice != null ? `${money(row.averagePrice)} / phần` : ''}
          {row.revenueShare != null ? ` · ${fPercent(row.revenueShare)}` : ''}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {hasCost ? (
          <>
            <Typography variant="body2">{money(row.cost)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {money(Math.round(row.unitCost ?? 0))} / phần
            </Typography>
          </>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        {hasCost ? (
          <Typography variant="body2" color={row.profit < 0 ? 'error.main' : 'text.primary'}>
            {money(row.profit)}
          </Typography>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        {row.marginRate != null ? (
          <Chip size="small" variant="soft" color={tone} label={fPercent(row.marginRate)} />
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}
