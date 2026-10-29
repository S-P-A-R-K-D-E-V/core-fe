'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { getMonetaryPenaltySettings, updateMonetaryPenaltySettings } from 'src/api/penaltyPolicy';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Ngừng phạt tiền (PUT /penalty-policies/monetary-settings): kỳ lương bắt đầu từ ngày đã chọn vẫn đếm vi phạm chấm công,
// phạt vệ sinh, phạt thủ công (dòng 0đ) nhưng không trừ lương, và không tạo được khoản phạt tiền mới thuộc kỳ đó. Kỳ trước
// ngày đó giữ nguyên. Bỏ ngày là phạt lại như cũ.

/** Ngày đầu tháng sau theo giờ máy, dạng yyyy-MM-dd — gợi ý mặc định (chu kỳ lương theo tháng). */
function firstDayOfNextMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}

export function MonetaryPenaltyCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [disabledFrom, setDisabledFrom] = useState<string | null>(null);
  const [draft, setDraft] = useState(firstDayOfNextMonth());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const settings = await getMonetaryPenaltySettings();
      setDisabledFrom(settings.monetaryPenaltiesDisabledFrom);
      if (settings.monetaryPenaltiesDisabledFrom) setDraft(settings.monetaryPenaltiesDisabledFrom);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được thiết lập phạt tiền'), { variant: 'error' });
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
            title: `Ngừng phạt tiền từ ${fDate(value)}?`,
            content:
              'Kỳ lương bắt đầu từ ngày này chỉ ghi nhận vi phạm (0đ), không trừ lương; không thêm được phạt việc theo ca không đạt hay phạt thủ công có tiền cho kỳ đó.\n' +
              'Kỳ trước ngày này giữ nguyên. Tính lại chu kỳ lương để bảng lương áp dụng.',
            confirmText: 'Ngừng phạt tiền',
            cancelText: 'Huỷ',
          }
        : {
            title: 'Phạt tiền lại như cũ?',
            content: 'Bảng lương tính lại sẽ trừ tiền theo chính sách chế tài bên dưới, phạt việc theo ca không đạt và phạt thủ công.',
            confirmText: 'Bỏ ngày ngừng',
            cancelText: 'Huỷ',
            destructive: true,
          }
    );
    if (!ok) return;

    setSaving(true);
    try {
      const settings = await updateMonetaryPenaltySettings(value);
      setDisabledFrom(settings.monetaryPenaltiesDisabledFrom);
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
      <CardHeader title="Ngừng phạt tiền" />
      <CardContent>
        <Stack spacing={2}>
          {disabledFrom ? (
            <Alert severity="success">
              Cửa hàng không phạt tiền từ {fDate(disabledFrom)}. Kỳ lương bắt đầu từ ngày này chỉ ghi nhận vi phạm
              (0đ); các chính sách bên dưới chỉ còn dùng để đếm vi phạm.
            </Alert>
          ) : (
            <Alert severity="info">Chọn ngày bắt đầu ngừng trừ tiền — vi phạm vẫn được ghi nhận.</Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              type="date"
              size="small"
              label="Ngừng phạt tiền từ ngày"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { sm: 220 } }}
            />
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!draft || draft === disabledFrom}
              onClick={() => save(draft)}
            >
              Lưu
            </LoadingButton>
            {disabledFrom && (
              <Button color="error" disabled={saving} onClick={() => save(null)}>
                Bỏ ngày ngừng
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
