'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { getWeeklyBonusPaySettings, updateWeeklyBonusPaySettings } from 'src/api/holidayPolicy';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Thưởng doanh số tuần vào lương (Quy chế Đ5; PUT /holiday-policies/weekly-bonus-pay): từ tuần đã chọn, thưởng của các tuần
// kết thúc trong tháng được cộng vào kỳ lương cuối tháng. Chưa chọn = chỉ tính thử ở Nhân sự › Target (giai đoạn thử 11–12).

const RULES = [
  'Quỹ thưởng: 3% phần vượt target tới 110%, 5% phần trên 110%; chia theo giờ làm thực tế trong tuần.',
  'Doanh thu tính thưởng bỏ đơn online và dòng hàng được giảm từ 30% (hàng xả).',
  'Tuần thuộc tháng của ngày Chủ nhật; trả ở kỳ lương có ngày cuối tháng (kỳ 2).',
];

export function WeeklyBonusPayCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [from, setFrom] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const settings = await getWeeklyBonusPaySettings();
      setFrom(settings.weeklyBonusPayFrom);
      setDraft(settings.weeklyBonusPayFrom ?? '');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được thiết lập thưởng tuần'), { variant: 'error' });
    } finally {
      setLoaded(true);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (value: string | null) => {
    const ok = await confirm(
      value
        ? {
            title: `Trả thưởng tuần vào lương từ tuần ${fDate(value)}?`,
            content:
              'Thưởng của các tuần từ tuần này sẽ cộng vào kỳ lương cuối tháng (ngày bất kỳ được đưa về thứ Hai).\n' +
              'Tính lại chu kỳ lương để bảng lương áp dụng.',
            confirmText: 'Áp dụng',
            cancelText: 'Huỷ',
          }
        : {
            title: 'Chỉ tính thử thưởng tuần?',
            content: 'Bảng lương tính lại sẽ không còn dòng thưởng doanh số tuần.',
            confirmText: 'Chỉ tính thử',
            cancelText: 'Huỷ',
            destructive: true,
          }
    );
    if (!ok) return;

    setSaving(true);
    try {
      const settings = await updateWeeklyBonusPaySettings(value);
      setFrom(settings.weeklyBonusPayFrom);
      setDraft(settings.weeklyBonusPayFrom ?? '');
      enqueueSnackbar('Đã lưu. Tính lại chu kỳ lương để áp dụng.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <Card sx={{ mb: 3 }}>
      {confirmDialog}
      <CardHeader title="Thưởng doanh số tuần vào lương" />
      <CardContent>
        <Stack spacing={2}>
          {from ? (
            <Alert severity="success">Thưởng doanh số tuần được trả vào lương từ tuần {fDate(from)}.</Alert>
          ) : (
            <Alert severity="info">
              Đang chỉ tính thử (xem ở Nhân sự › Target). Chọn tuần bắt đầu trả khi hết giai đoạn thử.
            </Alert>
          )}

          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {RULES.map((rule) => (
              <Typography key={rule} component="li" variant="body2" color="text.secondary">
                {rule}
              </Typography>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              type="date"
              size="small"
              label="Trả từ tuần có ngày"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { sm: 220 } }}
            />
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!draft || draft === from}
              onClick={() => save(draft)}
            >
              Áp dụng
            </LoadingButton>
            {from ? (
              <Button color="inherit" disabled={saving} onClick={() => save(null)}>
                Chỉ tính thử
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
