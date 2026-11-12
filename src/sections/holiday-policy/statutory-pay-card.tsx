'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { getStatutoryPaySettings, updateStatutoryPaySettings } from 'src/api/holidayPolicy';

import { useSnackbar } from 'src/components/snackbar';

import type { IStatutoryPaySettings } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Phụ cấp giờ làm (PUT /holiday-policies/statutory-pay): kỳ lương bắt đầu từ ngày đã chọn bù cho đủ 300% giờ làm ngày lễ,
// Tết. Làm thêm giờ ngày thường (150%) chỉ tính khi bật công tắc (overtimePremiumEnabled; CiCi không có). Phụ cấp làm đêm
// 22:00–06:00 chỉ hiện và chỉ tính khi cửa hàng có (nightPremiumEnabled; CiCi không có). Kỳ trước ngày đó giữ nguyên; bỏ
// ngày là tính như cũ.

/** Ngày đầu tháng sau theo giờ máy, dạng yyyy-MM-dd — gợi ý mặc định (chu kỳ lương theo tháng). */
function firstDayOfNextMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}

/** Các dòng giải thích; dòng làm thêm giờ / làm đêm chỉ có khi cửa hàng có khoản đó. */
export function statutoryRules(nightPremium: boolean, overtimePremium = true): string[] {
  return [
    ...(overtimePremium ? ['Làm quá số giờ bình thường trong ngày: 150%.'] : []),
    ...(nightPremium
      ? ['Làm việc 22:00–06:00: thêm 30% lương giờ.', 'Làm thêm giờ ban đêm: thêm 20% lương giờ ban ngày.']
      : []),
    'Ngày lễ, Tết: tối thiểu 300% (tự bù phần thưởng lễ còn thiếu).',
  ];
}

/** Câu mô tả các khoản được cộng, dùng trong hộp xác nhận. */
function addedItems(nightPremium: boolean, overtimePremium: boolean, hours: number): string {
  return [
    nightPremium ? 'phụ cấp làm đêm' : null,
    overtimePremium ? `làm thêm giờ (quá ${hours} giờ/ngày)` : null,
    'bù đủ 300% ngày lễ',
  ]
    .filter(Boolean)
    .join(', ');
}

export function StatutoryPayCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [from, setFrom] = useState<string | null>(null);
  const [hours, setHours] = useState(8);
  const [nightPremium, setNightPremium] = useState(false);
  const [overtimePremium, setOvertimePremium] = useState(true);
  const [draftFrom, setDraftFrom] = useState(firstDayOfNextMonth());
  const [draftHours, setDraftHours] = useState('8');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((settings: IStatutoryPaySettings) => {
    setFrom(settings.statutoryPayFrom);
    setHours(settings.normalHoursPerDay);
    setNightPremium(settings.nightPremiumEnabled === true);
    setOvertimePremium(settings.overtimePremiumEnabled !== false);
    setDraftHours(String(settings.normalHoursPerDay));
  }, []);

  const load = useCallback(async () => {
    try {
      const settings = await getStatutoryPaySettings();
      apply(settings);
      if (settings.statutoryPayFrom) setDraftFrom(settings.statutoryPayFrom);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được thiết lập phụ cấp giờ làm'), { variant: 'error' });
    } finally {
      setLoaded(true);
    }
  }, [apply, enqueueSnackbar]);

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
            title: `Áp dụng phụ cấp giờ làm từ ${fDate(value)}?`,
            content:
              `Kỳ lương bắt đầu từ ngày này cộng ${addedItems(nightPremium, overtimePremium, parsedHours)}.\n` +
              'Kỳ trước ngày này giữ nguyên. Tính lại chu kỳ lương để bảng lương áp dụng.',
            confirmText: 'Áp dụng',
            cancelText: 'Huỷ',
          }
        : {
            title: 'Bỏ phụ cấp giờ làm?',
            content: `Bảng lương tính lại sẽ không còn ${addedItems(nightPremium, overtimePremium, hours).replace('bù đủ 300%', 'phần bù 300%')}.`,
            confirmText: 'Bỏ ngày áp dụng',
            cancelText: 'Huỷ',
            destructive: true,
          }
    );
    if (!ok) return;

    setSaving(true);
    try {
      apply(await updateStatutoryPaySettings(value, value ? parsedHours : null));
      enqueueSnackbar('Đã lưu. Tính lại chu kỳ lương để áp dụng.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleOvertime = async (next: boolean) => {
    const ok = await confirm({
      title: next ? 'Bật phụ cấp làm thêm giờ?' : 'Tắt phụ cấp làm thêm giờ?',
      content: next
        ? `Giờ làm quá ${hours} giờ/ngày được cộng thêm 50% lương giờ (tổng 150%).\nTính lại chu kỳ lương để bảng lương áp dụng.`
        : `Giờ làm quá ${hours} giờ/ngày chỉ tính lương giờ bình thường, không cộng thêm 50%. Ngày lễ vẫn bù đủ 300%.\n` +
          'Tính lại chu kỳ lương để bảng lương áp dụng.',
      confirmText: next ? 'Bật' : 'Tắt',
      cancelText: 'Huỷ',
    });
    if (!ok) return;

    setSaving(true);
    try {
      apply(await updateStatutoryPaySettings(from, from ? hours : null, next));
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
      <CardHeader title="Phụ cấp giờ làm" />
      <CardContent>
        <Stack spacing={2}>
          {from ? (
            <Alert severity="success">
              Áp dụng từ {fDate(from)}, giờ làm bình thường {hours} giờ/ngày
              {overtimePremium ? ', có phụ cấp làm thêm giờ' : ', không có phụ cấp làm thêm giờ'}
              {nightPremium ? ', có phụ cấp làm đêm' : ', không có phụ cấp làm đêm'}.
            </Alert>
          ) : (
            <Alert severity="info">Chưa áp dụng. Chọn ngày bắt đầu áp dụng.</Alert>
          )}

          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {statutoryRules(nightPremium, overtimePremium).map((rule) => (
              <Typography key={rule} component="li" variant="body2" color="text.secondary">
                {rule}
              </Typography>
            ))}
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={overtimePremium}
                disabled={saving}
                onChange={(e) => toggleOvertime(e.target.checked)}
              />
            }
            label={`Phụ cấp làm thêm giờ (giờ làm quá ${hours} giờ/ngày: 150%)`}
          />

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
