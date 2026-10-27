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

import { getStatutoryPaySettings, updateStatutoryPaySettings } from 'src/api/holidayPolicy';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Trả lương theo Bộ luật Lao động 2019 Điều 98 (PUT /holiday-policies/statutory-pay): kỳ lương bắt đầu từ ngày đã chọn cộng
// phụ cấp ca đêm 22:00–06:00 (+30%), làm thêm giờ ngày thường (150%), làm thêm giờ ban đêm (+20%) và bù cho đủ 300% giờ
// làm ngày lễ, Tết theo luật. Kỳ trước ngày đó giữ nguyên; bỏ ngày là tính như cũ.

/** Ngày đầu tháng sau theo giờ máy, dạng yyyy-MM-dd — gợi ý mặc định (chu kỳ lương theo tháng). */
function firstDayOfNextMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}

const RULES = [
  'Làm việc 22:00–06:00: thêm 30% lương giờ.',
  'Làm quá số giờ bình thường trong ngày: 150%.',
  'Làm thêm giờ ban đêm: thêm 20% lương giờ ban ngày.',
  'Ngày lễ, Tết theo luật: tối thiểu 300% (tự bù phần thưởng lễ còn thiếu).',
];

export function StatutoryPayCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [from, setFrom] = useState<string | null>(null);
  const [hours, setHours] = useState(8);
  const [draftFrom, setDraftFrom] = useState(firstDayOfNextMonth());
  const [draftHours, setDraftHours] = useState('8');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const settings = await getStatutoryPaySettings();
      setFrom(settings.statutoryPayFrom);
      setHours(settings.normalHoursPerDay);
      setDraftHours(String(settings.normalHoursPerDay));
      if (settings.statutoryPayFrom) setDraftFrom(settings.statutoryPayFrom);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được thiết lập trả lương theo luật'), { variant: 'error' });
    } finally {
      setLoaded(true);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const parsedHours = Number(draftHours);
  const hoursValid = Number.isFinite(parsedHours) && parsedHours >= 4 && parsedHours <= 10;
  const changed = draftFrom !== from || parsedHours !== hours;

  const save = async (value: string | null) => {
    const ok = await confirm(
      value
        ? {
            title: `Trả lương theo luật từ ${fDate(value)}?`,
            content:
              `Kỳ lương bắt đầu từ ngày này cộng phụ cấp ca đêm, làm thêm giờ (quá ${parsedHours} giờ/ngày) và bù đủ 300% ngày lễ.\n` +
              'Kỳ trước ngày này giữ nguyên. Tính lại chu kỳ lương để bảng lương áp dụng.',
            confirmText: 'Áp dụng',
            cancelText: 'Huỷ',
          }
        : {
            title: 'Bỏ trả lương theo luật?',
            content: 'Bảng lương tính lại sẽ không còn phụ cấp ca đêm, làm thêm giờ và phần bù 300% ngày lễ.',
            confirmText: 'Bỏ ngày áp dụng',
            cancelText: 'Huỷ',
            destructive: true,
          }
    );
    if (!ok) return;

    setSaving(true);
    try {
      const settings = await updateStatutoryPaySettings(value, value ? parsedHours : null);
      setFrom(settings.statutoryPayFrom);
      setHours(settings.normalHoursPerDay);
      setDraftHours(String(settings.normalHoursPerDay));
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
      <CardHeader title="Trả lương theo Bộ luật Lao động" />
      <CardContent>
        <Stack spacing={2}>
          {from ? (
            <Alert severity="success">
              Cửa hàng trả lương theo Điều 98 từ {fDate(from)}, giờ làm bình thường {hours} giờ/ngày.
            </Alert>
          ) : (
            <Alert severity="warning">
              Bộ luật Lao động 2019 (Điều 98) quy định mức trả tối thiểu cho ca đêm, làm thêm giờ và ngày lễ. Chọn ngày
              bắt đầu áp dụng.
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
              label="Áp dụng từ ngày"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { sm: 200 } }}
            />
            <TextField
              type="number"
              size="small"
              label="Giờ làm bình thường / ngày"
              value={draftHours}
              onChange={(e) => setDraftHours(e.target.value)}
              error={!hoursValid}
              helperText={hoursValid ? undefined : 'Từ 4 đến 10 giờ'}
              inputProps={{ min: 4, max: 10, step: 0.5 }}
              sx={{ width: { sm: 200 } }}
            />
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!draftFrom || !hoursValid || !changed}
              onClick={() => save(draftFrom)}
            >
              Lưu
            </LoadingButton>
            {from && (
              <Button color="error" disabled={saving} onClick={() => save(null)}>
                Bỏ ngày áp dụng
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
