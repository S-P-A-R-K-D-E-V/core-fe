'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getCostForecast, getCostSettings, saveCostSettings } from 'src/api/cost-forecast';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { ICostForecast, CostForecastPeriod } from 'src/types/cost-forecast';

import { fVnd } from '../hr/hr-common';

// ----------------------------------------------------------------------
// Chi phí nhân sự dự kiến — chỉ Admin: từng khoản, tỷ lệ chi phí / doanh thu so với trần, chi tiết theo nhân viên, so với kỳ trước.
// ----------------------------------------------------------------------

const QUARTER_STATUS: Record<string, string> = { Eligible: 'Đủ', AtRisk: 'Rủi ro', Lost: 'Mất' };

function periodOptions(period: CostForecastPeriod, now = new Date()): { value: string; label: string }[] {
  const step = period === 'Quarter' ? 3 : 1;
  return [0, 1, 2, 3].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i * step, 1);
    return {
      value: fDate(d, 'yyyy-MM-dd') as string,
      label: period === 'Quarter' ? `Quý ${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}` : (fDate(d, 'MM/yyyy') as string),
    };
  });
}

/** Thanh tỷ lệ chi phí / doanh thu với vạch trần: đổi sang màu cảnh báo khi vượt, và luôn có nhãn số. */
function CapMeter({ data }: { data: ICostForecast }) {
  const ratio = data.costRatioPct ?? 0;
  const cap = data.capPct ?? null;
  const scale = Math.max(cap != null ? cap * 1.5 : 30, ratio * 1.1, 1);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography variant="h3">{data.costRatioPct != null ? `${data.costRatioPct}%` : '—'}</Typography>
        <Typography variant="body2" color="text.secondary">
          chi phí / doanh thu{cap != null ? `, trần ${cap}%` : ''}
        </Typography>
        {data.overCap && <Chip size="small" color="error" label="Vượt trần" />}
      </Stack>
      <Box sx={{ position: 'relative', height: 12, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Box
          sx={{
            height: 1,
            width: `${Math.min(100, (ratio / scale) * 100)}%`,
            bgcolor: data.overCap ? 'error.main' : 'primary.main',
            borderRadius: 1,
          }}
        />
        {cap != null && (
          <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${(cap / scale) * 100}%`, width: 2, bgcolor: 'text.primary' }} />
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Chi phí tính vào trần {fVnd(data.capCost)}
        {data.capAmount != null ? ` / trần ${fVnd(data.capAmount)}` : ''}. Không gồm BHXH phần chủ và thưởng quý đã mất.
      </Typography>
    </Stack>
  );
}

function SettingsCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({ pct: '', min: '', from: fDate(new Date(), 'yyyy-MM-dd') as string });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCostSettings()
      .then((s) =>
        setForm((f) => ({
          pct: s.employerInsurancePct != null ? String(s.employerInsurancePct) : '',
          min: s.insuranceMinMonthlyWage != null ? String(s.insuranceMinMonthlyWage) : '',
          from: s.effectiveFrom ?? f.from,
        }))
      )
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được tham số BHXH'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  const save = async () => {
    setSaving(true);
    try {
      await saveCostSettings({
        employerInsurancePct: Number(form.pct),
        insuranceMinMonthlyWage: form.min.trim() === '' ? null : Number(form.min),
        effectiveFrom: form.from,
      });
      enqueueSnackbar('Đã lưu, tải lại trang để thấy số mới');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="BHXH phần chủ" subheader="Chỉ dùng để dự báo chi phí, không vào phiếu lương." />
      <CardContent>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField size="small" type="number" label="Tỷ lệ (%)" value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} sx={{ width: 120 }} />
          <TextField
            size="small"
            type="number"
            label="Lương tháng tối thiểu để đóng (đ)"
            value={form.min}
            onChange={(e) => setForm({ ...form, min: e.target.value })}
            sx={{ width: 260 }}
          />
          <TextField
            size="small"
            type="date"
            label="Hiệu lực từ"
            InputLabelProps={{ shrink: true }}
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
          <LoadingButton variant="outlined" loading={saving} disabled={!form.pct || !form.from} onClick={save}>
            Lưu
          </LoadingButton>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function CostForecastView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [period, setPeriod] = useState<CostForecastPeriod>('Month');
  const options = useMemo(() => periodOptions(period), [period]);
  const [date, setDate] = useState(options[0].value);
  const [data, setData] = useState<ICostForecast | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getCostForecast(period, date)
      .then(setData)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được chi phí dự kiến'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [period, date, enqueueSnackbar]);

  useEffect(load, [load]);

  const items = data?.items;
  const lines = items
    ? [
        { label: 'Lương giờ', value: items.hourlyPay },
        // Chỉ cửa hàng có phụ cấp làm đêm mới có khoản này (CiCi không có).
        ...(items.nightPremium ? [{ label: 'Phụ cấp làm đêm', value: items.nightPremium }] : []),
        { label: 'Làm thêm giờ', value: items.overtimePremium },
        { label: 'Phụ trội ngày lễ', value: items.holidayPremium },
        { label: 'Làm hộ', value: items.coverPay },
        { label: 'Thưởng tuần dự kiến', value: items.weeklyBonus },
        { label: 'Hoa hồng', value: items.commission },
        { label: 'Thưởng quý: đủ điều kiện', value: items.quarterEligible },
        { label: 'Thưởng quý: rủi ro', value: items.quarterAtRisk },
        { label: 'BHXH phần chủ', value: items.employerInsurance },
      ]
    : [];
  const changePct =
    data?.previous && data.previous.totalCost > 0
      ? Math.round(((data.totalCost - data.previous.totalCost) / data.previous.totalCost) * 1000) / 10
      : null;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs heading="Chi phí dự kiến" links={[{ name: 'Lương' }, { name: 'Chi phí dự kiến' }]} sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          onChange={(_, value: CostForecastPeriod | null) => {
            if (!value) return;
            setPeriod(value);
            setDate(periodOptions(value)[0].value);
          }}
        >
          <ToggleButton value="Month">Tháng</ToggleButton>
          <ToggleButton value="Quarter">Quý</ToggleButton>
        </ToggleButtonGroup>
        <TextField select size="small" value={date} onChange={(e) => setDate(e.target.value)} sx={{ minWidth: 140 }}>
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      )}

      {!loading && data && (
        <Stack spacing={2}>
          {data.overCap && (
            <Alert severity="error">Chi phí dự kiến vượt trần {data.capPct}% doanh thu. Thưởng quý sẽ bị giảm đều khi đóng quý.</Alert>
          )}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
            <Card>
              <CardContent>
                <CapMeter data={data} />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Tổng chi phí
                  </Typography>
                  <Typography variant="h4">{fVnd(data.totalCost)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Doanh thu {fVnd(data.revenue)}
                    {data.revenueForecast > 0 ? `, gồm ${fVnd(data.revenueForecast)} dự báo` : ''}
                  </Typography>
                  {data.previous && (
                    <Typography variant="body2" color="text.secondary">
                      Kỳ trước {fVnd(data.previous.totalCost)}
                      {data.previous.costRatioPct != null ? ` (${data.previous.costRatioPct}% doanh thu)` : ''}
                      {changePct != null ? `, ${changePct >= 0 ? 'tăng' : 'giảm'} ${Math.abs(changePct)}%` : ''}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
            <Card>
              <CardHeader title="Từng khoản" titleTypographyProps={{ variant: 'subtitle1' }} />
              <Table size="small">
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.label}>
                      <TableCell>{l.label}</TableCell>
                      <TableCell align="right">{fVnd(l.value)}</TableCell>
                    </TableRow>
                  ))}
                  {(items?.quarterLost ?? 0) > 0 && (
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary' }}>Thưởng quý đã mất (không tính)</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        {fVnd(items?.quarterLost)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
            <Card>
              <CardHeader title="Theo nhân viên" titleTypographyProps={{ variant: 'subtitle1' }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nhân viên</TableCell>
                      <TableCell align="right">Giờ thực / lịch</TableCell>
                      <TableCell align="right">Lương, phụ cấp</TableCell>
                      <TableCell align="right">Thưởng tuần</TableCell>
                      <TableCell align="right">Thưởng quý</TableCell>
                      <TableCell align="right">BHXH</TableCell>
                      <TableCell align="right">Tổng</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.employees.map((e) => (
                      <TableRow key={e.userId}>
                        <TableCell>{e.name}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {e.actualHours} / {e.scheduledHours}
                        </TableCell>
                        <TableCell align="right">{fVnd(e.pay)}</TableCell>
                        <TableCell align="right">{fVnd(e.weeklyBonus)}</TableCell>
                        <TableCell align="right">
                          {fVnd(e.quarterBonus)}
                          {e.quarterStatus && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {QUARTER_STATUS[e.quarterStatus] ?? e.quarterStatus}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{fVnd(e.employerInsurance)}</TableCell>
                        <TableCell align="right">
                          <strong>{fVnd(e.total)}</strong>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>

          {data.notes.map((n) => (
            <Typography key={n} variant="caption" color="text.secondary">
              {n}
            </Typography>
          ))}
          <SettingsCard />
        </Stack>
      )}
    </Container>
  );
}
