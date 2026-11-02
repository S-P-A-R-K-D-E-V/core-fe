'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getWeeklyBonusRates, saveWeeklyBonusRate } from 'src/api/quarter-bonus';

import { useSnackbar } from 'src/components/snackbar';

import type { IWeeklyBonusRate } from 'src/types/quarter-bonus';

// ----------------------------------------------------------------------
// Tỷ lệ thưởng doanh số tuần theo ngày hiệu lực: tuần dùng dòng mới nhất có ngày hiệu lực không sau thứ Hai của tuần, nên đổi tỷ lệ
// không làm đổi số của các tuần trước.
// ----------------------------------------------------------------------

const toNumber = (text: string) => (text.trim() === '' ? null : Number(text));

export function WeeklyBonusRatesCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [rates, setRates] = useState<IWeeklyBonusRate[]>([]);
  const [form, setForm] = useState({ effectiveFrom: '', tier1FromPct: '100', tier1RatePct: '', tier2FromPct: '110', tier2RatePct: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getWeeklyBonusRates()
      .then(setRates)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được tỷ lệ thưởng'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await saveWeeklyBonusRate({
        effectiveFrom: form.effectiveFrom,
        tier1FromPct: Number(form.tier1FromPct),
        tier1RatePct: Number(form.tier1RatePct),
        tier2FromPct: toNumber(form.tier2FromPct),
        tier2RatePct: toNumber(form.tier2FromPct) == null ? null : toNumber(form.tier2RatePct),
      });
      enqueueSnackbar('Đã lưu');
      setForm({ ...form, effectiveFrom: '', tier1RatePct: '', tier2RatePct: '' });
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, width: number) => (
    <TextField
      size="small"
      type="number"
      label={label}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      sx={{ width }}
    />
  );

  return (
    <Card>
      <CardHeader
        title="Tỷ lệ thưởng doanh số tuần theo ngày hiệu lực"
        subheader="Các tuần trước dòng đầu tiên dùng tỷ lệ ở mục trên. Nhập lại cùng ngày hiệu lực để sửa dòng đó."
      />
      <CardContent>
        <Stack spacing={2}>
          {rates.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hiệu lực từ</TableCell>
                  <TableCell align="right">Bậc 1 từ</TableCell>
                  <TableCell align="right">Thưởng bậc 1</TableCell>
                  <TableCell align="right">Bậc 2 từ</TableCell>
                  <TableCell align="right">Thưởng bậc 2</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fDate(r.effectiveFrom, 'dd/MM/yyyy')}</TableCell>
                    <TableCell align="right">{r.tier1FromPct}%</TableCell>
                    <TableCell align="right">{r.tier1RatePct}%</TableCell>
                    <TableCell align="right">{r.tier2FromPct != null ? `${r.tier2FromPct}%` : '—'}</TableCell>
                    <TableCell align="right">{r.tier2RatePct != null ? `${r.tier2RatePct}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa có dòng nào, thưởng tuần dùng tỷ lệ ở mục trên.
            </Typography>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              type="date"
              label="Hiệu lực từ"
              InputLabelProps={{ shrink: true }}
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
            {field('tier1FromPct', 'Bậc 1 từ (% target)', 140)}
            {field('tier1RatePct', 'Thưởng bậc 1 (%)', 130)}
            {field('tier2FromPct', 'Bậc 2 từ (% target)', 140)}
            {field('tier2RatePct', 'Thưởng bậc 2 (%)', 130)}
            <LoadingButton variant="outlined" loading={saving} disabled={!form.effectiveFrom || !form.tier1RatePct} onClick={save}>
              Lưu tỷ lệ
            </LoadingButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
