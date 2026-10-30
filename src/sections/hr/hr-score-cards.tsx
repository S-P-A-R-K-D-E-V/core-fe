'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useActiveHrRules } from 'src/api/hr-rules';
import { getMyViolations, getMyPerformance, getPerformanceMonth, getMyProvisionalPerformance } from 'src/api/hr';

import type { IPerformanceMonth, IPerformanceScore, IMyProvisionalPerformance } from 'src/types/hr';
import { PERFORMANCE_RATING_COLOR, PERFORMANCE_RATING_LABEL } from 'src/types/hr';

import { fPct, MonthField, monthStart, fScoreTotal, previousMonth, rankScores } from './hr-common';

// ----------------------------------------------------------------------
// Thẻ điểm ở Tổng quan nhân sự: xếp hạng cả cửa hàng (hr.performance.read) và điểm của tôi. Tháng đang chạy là điểm tạm tính:
// hệ thống tính lại mỗi ngày, số liệu tới hôm qua, nhân viên chỉ thấy điểm của mình.
// ----------------------------------------------------------------------

const fPoints = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export function MyProvisionalScoreCard({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean }) {
  const rules = useActiveHrRules();
  const enabled = !!rules?.performanceEnabled;
  const [data, setData] = useState<{
    current: IMyProvisionalPerformance;
    lastPublished: IPerformanceScore | null;
    deductions: number | null;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [current, published, violations] = await Promise.all([
          getMyProvisionalPerformance(),
          getMyPerformance().catch(() => []),
          getMyViolations(monthStart()).catch(() => null),
        ]);
        if (!cancelled)
          setData({ current, lastPublished: published[0] ?? null, deductions: violations?.summary.points ?? null });
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Không tải được điểm của bạn'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const { current, lastPublished, deductions } = data;
  // Có dòng điểm nhưng chưa làm ca nào trong tháng thì coi như chưa có điểm.
  const score = current.score && current.score.shiftCount > 0 ? current.score : null;
  if (hideWhenEmpty && !score && !lastPublished) return null;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Điểm của tôi — tháng {fDate(current.month, 'MM/yyyy')}</Typography>
          <Link component={RouterLink} href={`${paths.dashboard.hr.performance}?tab=mine`} variant="body2">
            Các tháng đã công bố
          </Link>
        </Stack>
        {score ? (
          <>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h3">{fPoints(score.total)}</Typography>
              <Typography color="text.secondary">điểm tạm tính{score.isDefaultScore ? ' (mặc định)' : ''}</Typography>
              <Chip size="small" color={PERFORMANCE_RATING_COLOR[score.rating]} label={PERFORMANCE_RATING_LABEL[score.rating]} />
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {score.shiftCount} ca · đạt target {fPct(score.targetAchievementPct)}
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary">Chưa có điểm tạm tính tháng này.</Typography>
        )}
        {deductions !== null && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Điểm trừ tháng này: <strong>{deductions}</strong>
          </Typography>
        )}
        {current.computedAt && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Số liệu tới hôm qua, cập nhật {fDateTime(current.computedAt, 'HH:mm dd/MM')}. Điểm chính thức có sau khi cửa hàng công bố.
          </Typography>
        )}
        {lastPublished && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Tháng {fDate(lastPublished.month, 'MM/yyyy')} đã công bố: <strong>{fPoints(lastPublished.total)} điểm</strong> ·{' '}
            {PERFORMANCE_RATING_LABEL[lastPublished.rating]}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function StaffRankingCard() {
  const rules = useActiveHrRules();
  const enabled = !!rules?.performanceEnabled;
  const thisMonth = monthStart();
  const [month, setMonth] = useState(thisMonth);
  const [picked, setPicked] = useState(false);
  const [data, setData] = useState<IPerformanceMonth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setData(null);
    setError('');
    getPerformanceMonth(month)
      .then((result) => {
        if (cancelled) return;
        // Ngày đầu tháng chưa có số: mở tháng trước, trừ khi người xem tự chọn tháng này.
        if (!picked && month === thisMonth && result.scores.length === 0) setMonth(previousMonth(thisMonth));
        else setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Không tải được bảng xếp hạng'));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, month, picked, thisMonth]);

  if (!enabled) return null;

  const status = () => {
    if (!data) return '';
    if (data.publishedAt) return `Đã công bố ${fDateTime(data.publishedAt, 'HH:mm dd/MM')}`;
    if (!data.computedAt) return 'Chưa tính điểm';
    if (month === thisMonth) return `Tạm tính tới hôm qua · cập nhật ${fDateTime(data.computedAt, 'HH:mm dd/MM')}`;
    return `Tính lúc ${fDateTime(data.computedAt, 'HH:mm dd/MM')} · chưa công bố`;
  };

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
          <div>
            <Typography variant="h6">Xếp hạng nhân sự</Typography>
            <Typography variant="caption" color="text.secondary">
              {status()}
            </Typography>
          </div>
          <Stack direction="row" spacing={2} alignItems="center">
            <MonthField
              value={month}
              onChange={(value) => {
                setPicked(true);
                setMonth(value);
              }}
            />
            <Link component={RouterLink} href={paths.dashboard.hr.performance} variant="body2">
              Chi tiết
            </Link>
          </Stack>
        </Stack>
      </CardContent>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      {!data && !error && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
      {data && data.scores.length === 0 && (
        <Typography color="text.secondary" sx={{ p: 3, pt: 1 }}>
          Chưa có điểm tháng này.
        </Typography>
      )}
      {data && data.scores.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hạng</TableCell>
                <TableCell>Nhân viên</TableCell>
                <TableCell align="right">Điểm</TableCell>
                <TableCell>Xếp loại</TableCell>
                <TableCell align="right">Đạt target</TableCell>
                <TableCell align="right">Ca</TableCell>
                <TableCell align="right">Điểm trừ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankScores(data.scores).map(({ score: s, rank }) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <strong>{rank ?? '—'}</strong>
                  </TableCell>
                  <TableCell>{s.fullName}</TableCell>
                  <TableCell align="right">
                    <strong>{fScoreTotal(s)}</strong>
                    {s.isDefaultScore && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        (mặc định)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={PERFORMANCE_RATING_COLOR[s.rating]} label={PERFORMANCE_RATING_LABEL[s.rating]} />
                  </TableCell>
                  <TableCell align="right">{fPct(s.targetAchievementPct)}</TableCell>
                  <TableCell align="right">{s.shiftCount}</TableCell>
                  <TableCell align="right">{s.deductionPoints ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}
