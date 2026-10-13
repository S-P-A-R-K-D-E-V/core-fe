'use client';

import type { IFnbVarianceRow, IFnbVarianceReport } from 'src/types/fnb';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { getFnbVariance } from 'src/api/fnb';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import FnbBranchNotice from 'src/sections/fnb-pos/fnb-branch-notice';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import { fDay } from './lib/documents';

// ----------------------------------------------------------------------
// Báo cáo hao hụt nguyên liệu (chủ / quản lý): theo kỳ, mỗi nguyên liệu tồn đầu + nhập − dùng theo định lượng ± pha mẻ
// − xuất huỷ ± chênh kiểm kê ± khác = tồn cuối. Hao hụt = xuất huỷ + món đã pha rồi huỷ + thiếu khi kiểm.
// ----------------------------------------------------------------------

/** Ngày theo giờ máy (Việt Nam) dạng yyyy-MM-dd. */
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};

const percent = (rate: number | null) =>
  rate == null ? '—' : `${(rate * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

/** Số có dấu: "+15", "−15". */
const signed = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${fQty(Math.abs(n))}`);

export default function FnbVarianceView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { branchId } = useFnbBranches();

  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(isoDay(new Date()));
  const [report, setReport] = useState<IFnbVarianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!branchId || !from || !to) return;
    setLoading(true);
    try {
      setReport(await getFnbVariance(branchId, from, to));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được báo cáo hao hụt'), {
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

  const lastCount = report?.lastCountAt ? isoDay(new Date(report.lastCountAt)) : null;
  const totals = report?.totals;

  const preset = (start: string, end = isoDay(new Date())) => {
    setFrom(start);
    setTo(end);
  };
  const monthStart = () => {
    const d = new Date();
    return isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Hao hụt nguyên liệu"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Hao hụt' },
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
          <Button size="small" variant="outlined" onClick={() => preset(daysAgo(6))}>
            7 ngày
          </Button>
          <Button size="small" variant="outlined" onClick={() => preset(daysAgo(29))}>
            30 ngày
          </Button>
          <Button size="small" variant="outlined" onClick={() => preset(monthStart())}>
            Tháng này
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!lastCount}
            onClick={() => lastCount && preset(lastCount)}
          >
            Từ lần kiểm trước{lastCount ? ` (${fDay(lastCount)})` : ''}
          </Button>
          {loading && <CircularProgress size={20} />}
        </Stack>
      </Card>

      {totals && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <Summary title="Nhập hàng" value={totals.purchasedValue} />
          <Summary title="Dùng theo định lượng" value={totals.usedValue} />
          <Summary
            title="Xuất huỷ"
            value={totals.disposedValue}
            detail={totals.disposedByReason
              .map((r) => `${r.label} ${fCurrency(r.value)}`)
              .join(' · ')}
          />
          <Summary title="Pha rồi huỷ" value={totals.madeVoidedValue} />
          <Summary
            title="Kiểm kho thiếu / thừa"
            value={totals.shortageValue}
            detail={totals.surplusValue > 0 ? `Thừa ${fCurrency(totals.surplusValue)}` : undefined}
          />
          <Summary title="Tổng hao hụt" value={totals.lossValue} strong />
        </Stack>
      )}

      <Card>
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
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell align="right">Tồn đầu</TableCell>
                  <TableCell align="right">Nhập</TableCell>
                  <TableCell align="right">Dùng</TableCell>
                  <TableCell align="right">Pha mẻ</TableCell>
                  <TableCell align="right">Xuất huỷ</TableCell>
                  <TableCell align="right">Chênh kiểm</TableCell>
                  <TableCell align="right">Khác</TableCell>
                  <TableCell align="right">Tồn cuối</TableCell>
                  <TableCell align="right">Hao hụt</TableCell>
                  <TableCell align="right">Tỷ lệ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.rows.map((row) => (
                  <VarianceRow key={row.id} row={row} />
                ))}
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 3, textAlign: 'center' }}
                      >
                        Không có nguyên liệu nào có tồn hay biến động trong kỳ.
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
        Dùng = nguyên liệu trừ theo định lượng khi gửi bar (đã cộng lại món huỷ chưa pha). Pha mẻ = bán thành phẩm pha ra
        (+) hoặc nguyên liệu dùng pha mẻ (−). Hao hụt =
        xuất huỷ + món đã pha rồi huỷ + phần thiếu khi kiểm kho (hao hụt không giải thích được). Giá
        trị theo giá vốn hiện tại; tỷ lệ = hao hụt / tổng tiêu hao (dùng + dùng pha mẻ + xuất huỷ
        + thiếu khi kiểm).
      </Alert>
    </Container>
  );
}

// ----------------------------------------------------------------------

function Summary({
  title,
  value,
  detail,
  strong,
}: {
  title: string;
  value: number;
  detail?: string;
  strong?: boolean;
}) {
  return (
    <Card sx={{ p: 2, flex: 1, minWidth: 0, ...(strong && { bgcolor: 'error.lighter' }) }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h6" color={strong ? 'error.dark' : 'text.primary'}>
        {fCurrency(value) || '0 đ'}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          {detail}
        </Typography>
      )}
    </Card>
  );
}

function VarianceRow({ row }: { row: IFnbVarianceRow }) {
  const unit = row.unit ?? '';
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{row.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {row.code}
          {unit ? ` · ${unit}` : ''}
        </Typography>
      </TableCell>
      <TableCell align="right">{fQty(row.opening)}</TableCell>
      <TableCell align="right">{row.purchased ? fQty(row.purchased) : '—'}</TableCell>
      <TableCell align="right">
        {row.used ? fQty(row.used) : '—'}
        {row.madeVoided > 0 && (
          <Typography variant="caption" color="warning.main" display="block">
            pha rồi huỷ {fQty(row.madeVoided)}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {row.produced || row.batchUsed ? (
          <Tooltip
            title={[
              row.produced ? `Pha ra ${fQty(row.produced)} ${unit}` : '',
              row.batchUsed ? `Dùng pha mẻ ${fQty(row.batchUsed)} ${unit}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <span>{signed(row.produced - row.batchUsed)}</span>
          </Tooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        {row.disposed ? (
          <Tooltip
            title={row.disposedByReason
              .map((r) => `${r.label}: ${fQty(r.quantity)} ${unit}`)
              .join(' · ')}
          >
            <span>{fQty(row.disposed)}</span>
          </Tooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        {row.countVariance ? (
          <Typography variant="body2" color={row.countVariance < 0 ? 'error.main' : 'success.main'}>
            {signed(row.countVariance)}
          </Typography>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">{row.other ? signed(row.other) : '—'}</TableCell>
      <TableCell align="right">{fQty(row.closing)}</TableCell>
      <TableCell align="right">
        {row.loss > 0 ? (
          <>
            <Typography variant="body2">{fQty(row.loss)}</Typography>
            <Typography variant="caption" color="error.main">
              {fCurrency(row.lossValue)}
            </Typography>
          </>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell align="right">
        {row.lossRate != null && row.lossRate > 0 ? (
          <Chip
            size="small"
            variant="soft"
            color={row.lossRate >= 0.05 ? 'error' : row.lossRate >= 0.02 ? 'warning' : 'default'}
            label={percent(row.lossRate)}
          />
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}
