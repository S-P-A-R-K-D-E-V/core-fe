'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { apiErrorMessage } from 'src/utils/api-error';

import { getAttendanceSettings, updateAttendanceSettings } from 'src/api/attendance';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Công tắc "Bắt buộc xác minh khuôn mặt" của cửa hàng (PUT /attendance/settings — quyền attendance.adjust). Bật thì
// check-in / check-out trên app và web chỉ qua quét khuôn mặt (máy chủ so với khuôn mặt đã đăng ký); chụp ảnh gửi nhóm
// chấm công (không so khuôn mặt) bị chặn. Tắt: nhân viên chưa đăng ký khuôn mặt vẫn chấm công bằng ảnh, ghi "chưa xác minh".
// ----------------------------------------------------------------------

export default function AttendanceFaceSetting() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [requireFace, setRequireFace] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAttendanceSettings().then((s) => setRequireFace(s.requireFaceVerification));
  }, []);

  const toggle = async (next: boolean) => {
    if (
      next &&
      !(await confirm({
        title: 'Bắt buộc xác minh khuôn mặt',
        content:
          'Nhân viên chỉ chấm công được bằng quét khuôn mặt. Ai chưa đăng ký khuôn mặt sẽ phải đăng ký trước mới chấm công được.\nBật?',
        confirmText: 'Bật',
      }))
    )
      return;
    setSaving(true);
    try {
      const saved = await updateAttendanceSettings({ requireFaceVerification: next });
      setRequireFace(saved.requireFaceVerification);
      enqueueSnackbar(next ? 'Đã bật bắt buộc khuôn mặt' : 'Đã tắt bắt buộc khuôn mặt');
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được thiết lập'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mb: 3, p: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1">
            <Iconify icon="mdi:face-recognition" width={20} sx={{ mr: 1, verticalAlign: 'text-bottom' }} />
            Bắt buộc xác minh khuôn mặt khi chấm công
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tắt: nhân viên chưa đăng ký khuôn mặt vẫn chấm công bằng ảnh chụp (ghi &quot;chưa xác minh&quot;). Bật: chỉ chấm công
            bằng quét khuôn mặt, máy chủ so với khuôn mặt đã đăng ký.
          </Typography>
        </Stack>
        <FormControlLabel
          sx={{ flexShrink: 0, m: 0 }}
          control={
            <Switch
              checked={!!requireFace}
              disabled={requireFace === null || saving}
              onChange={(e) => toggle(e.target.checked)}
            />
          }
          label={requireFace ? 'Đang bật' : 'Đang tắt'}
        />
      </Stack>
      {confirmDialog}
    </Card>
  );
}
