'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { getStorageUrl } from 'src/utils/storage';
import { apiErrorMessage } from 'src/utils/api-error';
import { fDateTime, fToNow } from 'src/utils/format-time';

import {
  getFaceEnrollmentRequests,
  rejectFaceEnrollmentRequest,
  approveFaceEnrollmentRequest,
} from 'src/api/faceEnrollment';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IFaceEnrollmentRequest } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Duyệt đăng ký khuôn mặt (quyền user.update): nhân viên tự đăng ký lần đầu, hoặc đăng ký lại mà khuôn mặt mới không giống
// khuôn mặt đang dùng, thì chờ ở đây — xem ảnh mới cạnh ảnh đang dùng + % giống. Duyệt → khuôn mặt mới thay khuôn mặt cũ;
// từ chối → bỏ khuôn mặt mới (khuôn mặt cũ vẫn dùng), nhân viên được báo kèm lý do. Chờ quá 7 ngày thì tự hết hạn.
// ----------------------------------------------------------------------

/** Ngưỡng nhận diện của máy chủ (KioskSettings.SimilarityThreshold). */
const MATCH_THRESHOLD = 0.55;

function FacePhoto({ url, caption }: { url: string | null; caption: string }) {
  return (
    <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          aspectRatio: '3 / 4',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'background.neutral',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          <Box component="img" src={getStorageUrl(url)} alt={caption} sx={{ width: 1, height: 1, objectFit: 'cover' }} />
        ) : (
          <Typography variant="caption" color="text.disabled" sx={{ px: 1, textAlign: 'center' }}>
            Chưa có khuôn mặt
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        {caption}
      </Typography>
    </Stack>
  );
}

export function FaceApprovalsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<IFaceEnrollmentRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<IFaceEnrollmentRequest | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await getFaceEnrollmentRequests());
    } catch (error) {
      setItems([]);
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được danh sách chờ duyệt'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (item: IFaceEnrollmentRequest) => {
    setBusyId(item.id);
    try {
      await approveFaceEnrollmentRequest(item.id);
      enqueueSnackbar(`Đã duyệt khuôn mặt của ${item.staffName}`);
      setItems((prev) => (prev ?? []).filter((x) => x.id !== item.id));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không duyệt được'), { variant: 'error' });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    const item = rejecting;
    setBusyId(item.id);
    try {
      await rejectFaceEnrollmentRequest(item.id, reason.trim() || undefined);
      enqueueSnackbar(`Đã từ chối — ${item.staffName} sẽ được báo đăng ký lại`);
      setItems((prev) => (prev ?? []).filter((x) => x.id !== item.id));
      setRejecting(null);
      setReason('');
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không từ chối được'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Duyệt khuôn mặt"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Chấm công', href: paths.dashboard.attendance.root },
          { name: 'Duyệt khuôn mặt' },
        ]}
        action={
          <Button variant="outlined" startIcon={<Iconify icon="eva:refresh-fill" />} onClick={load}>
            Tải lại
          </Button>
        }
        sx={{ mb: 3 }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Nhân viên đăng ký lần đầu, hoặc đăng ký lại mà khuôn mặt mới không giống khuôn mặt đang dùng, cần bạn duyệt. Trong lúc
        chờ, họ vẫn chấm công bằng khuôn mặt cũ. Đăng ký lại cùng một người (giống từ {Math.round(MATCH_THRESHOLD * 100)}%) được
        duyệt tự động.
      </Typography>

      {items === null ? (
        <Typography color="text.secondary">Đang tải…</Typography>
      ) : items.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <Iconify icon="mdi:face-recognition" width={56} sx={{ color: 'text.disabled', mb: 1 }} />
          <Typography variant="subtitle1">Không có khuôn mặt nào chờ duyệt</Typography>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {items.map((item) => {
            const first = item.similarityToCurrent == null;
            const pct = first ? null : Math.round((item.similarityToCurrent ?? 0) * 100);
            return (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>
                        {item.staffName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" title={fDateTime(item.createdAt)}>
                        {fToNow(item.createdAt)}
                      </Typography>
                    </Stack>
                    {first ? (
                      <Label color="info">Lần đầu</Label>
                    ) : (
                      <Label color={pct! >= 40 ? 'warning' : 'error'}>Giống {pct}%</Label>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1.5}>
                    <FacePhoto url={item.currentPhotoUrl} caption="Đang dùng" />
                    <FacePhoto url={item.newPhotoUrl} caption="Mới đăng ký" />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                    {first
                      ? 'Chưa có khuôn mặt để so — kiểm tra đúng là nhân viên này.'
                      : `Khác khuôn mặt đang dùng (nhận ra cùng người từ ${Math.round(MATCH_THRESHOLD * 100)}%). Duyệt nếu đúng là nhân viên này (vd lần đăng ký cũ nhầm người).`}
                  </Typography>

                  <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      disabled={busyId === item.id}
                      onClick={() => {
                        setReason('');
                        setRejecting(item);
                      }}
                    >
                      Từ chối
                    </Button>
                    <LoadingButton
                      fullWidth
                      variant="contained"
                      color="success"
                      loading={busyId === item.id}
                      onClick={() => approve(item)}
                    >
                      Duyệt
                    </LoadingButton>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Từ chối khuôn mặt của {rejecting?.staffName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Khuôn mặt mới bị bỏ, khuôn mặt đang dùng giữ nguyên. Nhân viên được báo đăng ký lại.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label="Lý do (không bắt buộc)"
            placeholder="vd: Không phải bạn / ảnh tối"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Huỷ</Button>
          <LoadingButton variant="contained" color="error" loading={!!rejecting && busyId === rejecting.id} onClick={reject}>
            Từ chối
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
