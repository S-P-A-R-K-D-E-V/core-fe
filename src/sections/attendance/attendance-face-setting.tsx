'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { apiErrorMessage } from 'src/utils/api-error';

import { type AttendanceSettings, getAttendanceSettings, updateAttendanceSettings } from 'src/api/attendance';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Thiết lập khuôn mặt của cửa hàng (PUT /attendance/settings — quyền attendance.adjust):
// - "Chấm công bằng khuôn mặt" — mỗi lúc chỉ MỘT luồng cho cả cửa hàng: bật thì check-in / check-out trên app và web
//   chỉ qua quét khuôn mặt (máy chủ so với khuôn mặt đã đăng ký); tắt thì chỉ chụp ảnh gửi nhóm chấm công (không quét
//   khuôn mặt, kể cả người đã đăng ký). Máy chủ chặn luồng còn lại.
// - "Duyệt đăng ký khuôn mặt" (mặc định bật): nhân viên đăng ký lần đầu / đăng ký lại khác khuôn mặt đang dùng thì chờ quản
//   lý duyệt (Duyệt khuôn mặt) — chặn đăng ký hộ mặt người khác để chấm công thay.
// ----------------------------------------------------------------------

type Key = keyof AttendanceSettings;

export default function AttendanceFaceSetting() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [saving, setSaving] = useState<Key | null>(null);

  useEffect(() => {
    getAttendanceSettings()
      .then(setSettings)
      .catch((error) => enqueueSnackbar(apiErrorMessage(error, 'Không tải được thiết lập chấm công'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (key: Key, next: boolean, onMsg: string, offMsg: string) => {
    setSaving(key);
    try {
      setSettings(await updateAttendanceSettings({ [key]: next }));
      enqueueSnackbar(next ? onMsg : offMsg);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được thiết lập'), { variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const toggleRequireFace = async (next: boolean) => {
    if (
      next &&
      !(await confirm({
        title: 'Chấm công bằng khuôn mặt',
        content:
          'Cả cửa hàng chuyển sang chấm công bằng quét khuôn mặt — chụp ảnh gửi nhóm sẽ bị tắt. Ai chưa đăng ký khuôn mặt phải đăng ký trước mới chấm công được.\nBật?',
        confirmText: 'Bật',
      }))
    )
      return;
    if (
      !next &&
      !(await confirm({
        title: 'Tắt chấm công bằng khuôn mặt',
        content:
          'Cả cửa hàng chuyển sang chụp ảnh gửi nhóm chấm công — không quét khuôn mặt nữa, kể cả người đã đăng ký (lượt chấm công ghi "chưa xác minh").\nTắt?',
        confirmText: 'Tắt',
        destructive: true,
      }))
    )
      return;
    await save(
      'requireFaceVerification',
      next,
      'Đã chuyển sang chấm công bằng khuôn mặt',
      'Đã chuyển sang chấm công bằng chụp ảnh gửi nhóm'
    );
  };

  const toggleApproval = async (next: boolean) => {
    if (
      !next &&
      !(await confirm({
        title: 'Tắt duyệt đăng ký khuôn mặt',
        content:
          'Nhân viên tự đăng ký / đăng ký lại khuôn mặt sẽ dùng được ngay, không cần bạn duyệt — kể cả khi khuôn mặt mới khác hẳn khuôn mặt cũ.\nTắt?',
        confirmText: 'Tắt',
        destructive: true,
      }))
    )
      return;
    await save('requireFaceEnrollmentApproval', next, 'Đã bật duyệt đăng ký khuôn mặt', 'Đã tắt duyệt đăng ký khuôn mặt');
  };

  const row = (
    key: Key,
    icon: string,
    title: string,
    description: React.ReactNode,
    onToggle: (next: boolean) => void
  ) => (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1">
          <Iconify icon={icon} width={20} sx={{ mr: 1, verticalAlign: 'text-bottom' }} />
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
      <FormControlLabel
        sx={{ flexShrink: 0, m: 0 }}
        control={
          <Switch
            checked={!!settings?.[key]}
            disabled={settings === null || saving !== null}
            onChange={(e) => onToggle(e.target.checked)}
          />
        }
        label={settings?.[key] ? 'Đang bật' : 'Đang tắt'}
      />
    </Stack>
  );

  return (
    <Card sx={{ mb: 3, p: 2.5 }}>
      <Stack spacing={2.5} divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
        {row(
          'requireFaceVerification',
          'mdi:face-recognition',
          'Chấm công bằng khuôn mặt',
          <>
            Mỗi lúc cả cửa hàng chỉ dùng một cách chấm công. Bật: chỉ quét khuôn mặt, máy chủ so với khuôn mặt đã đăng ký.
            Tắt: chỉ chụp ảnh gửi nhóm chấm công (không quét khuôn mặt, ghi &quot;chưa xác minh&quot;).
          </>,
          toggleRequireFace
        )}
        {row(
          'requireFaceEnrollmentApproval',
          'mdi:account-check-outline',
          'Duyệt đăng ký khuôn mặt',
          <>
            Bật: nhân viên đăng ký lần đầu, hoặc đăng ký lại mà khuôn mặt mới khác khuôn mặt đang dùng, phải chờ bạn duyệt ở{' '}
            <Link component={RouterLink} href={paths.dashboard.attendance.faceApprovals} sx={{ fontWeight: 600 }}>
              Duyệt khuôn mặt
            </Link>{' '}
            — trong lúc chờ vẫn chấm công bằng khuôn mặt cũ. Đăng ký lại cùng một người được duyệt tự động.
          </>,
          toggleApproval
        )}
      </Stack>
      {confirmDialog}
    </Card>
  );
}
