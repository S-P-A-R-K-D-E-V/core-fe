'use client';

import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  fixInspectionResult,
  getMyInspectionFaults,
  uploadInspectionPhotos,
  getOpenInspectionFaults,
} from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IInspectionFault } from 'src/types/inspection';
import { INSPECTION_TYPE_LABEL } from 'src/types/inspection';

import { LevelChip, PhotoPicker, InspectionPhotoRules } from '../inspection-common';

// ----------------------------------------------------------------------
// Lỗi kiểm tra cửa hàng mình phụ trách: đang mở (đánh dấu đã sửa kèm ảnh sau khi sửa) và lịch sử trong tháng. Quản lý có
// thêm tab lỗi đang mở của mọi người. Lỗi chỉ dùng để kèm cặp — không trừ tiền.
// ----------------------------------------------------------------------

type TabValue = 'open' | 'month' | 'all';

export function FaultCard({ fault, onFix }: { fault: IInspectionFault; onFix?: (fault: IInspectionFault) => void }) {
  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <LevelChip level={fault.level} />
          <Typography variant="subtitle2">
            {fault.itemCode} · {fault.itemTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {INSPECTION_TYPE_LABEL[fault.inspectionType]} · {fault.shiftName} {fDate(fault.date)}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Đạt khi: {fault.passCriteria}
        </Typography>
        {fault.note && <Typography variant="body2">Ghi chú: {fault.note}</Typography>}
        <PhotoPicker photos={fault.photos} files={[]} disabled onAdd={() => {}} onRemove={() => {}} />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {fault.fixedAt ? (
            <Chip
              size="small"
              color="success"
              label={`Đã sửa ${fDateTime(fault.fixedAt, 'HH:mm dd/MM')}${fault.isOverdue ? ' (trễ hạn)' : ''}`}
            />
          ) : (
            fault.fixDeadlineAt && (
              <Chip
                size="small"
                color={fault.isOverdue ? 'error' : 'warning'}
                label={`${fault.isOverdue ? 'Quá hạn' : 'Hạn sửa'} ${fDateTime(fault.fixDeadlineAt, 'HH:mm dd/MM')}`}
              />
            )
          )}
          {!fault.fixDeadlineAt && !fault.fixedAt && <Chip size="small" variant="outlined" label="Chỉ ghi nhận" />}
          {fault.fixNote && (
            <Typography variant="caption" color="text.secondary">
              {fault.fixNote}
            </Typography>
          )}
          {onFix && fault.fixDeadlineAt && !fault.fixedAt && (
            <Button size="small" variant="contained" sx={{ ml: 'auto' }} onClick={() => onFix(fault)}>
              Đánh dấu đã sửa
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export default function InspectionMyFaultsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const canRead = hasPermission(user, PERMISSIONS.inspection.read);
  const canManage = hasPermission(user, PERMISSIONS.inspection.manage);

  const [tab, setTab] = useState<TabValue>('open');
  const [faults, setFaults] = useState<IInspectionFault[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<IInspectionFault | null>(null);
  const [fixNote, setFixNote] = useState('');
  const [fixFiles, setFixFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'month') setFaults(await getMyInspectionFaults());
      else setFaults(await getOpenInspectionFaults(tab === 'all' ? 'all' : 'mine'));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách lỗi'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const openFix = (fault: IInspectionFault) => {
    setFixing(fault);
    setFixNote('');
    setFixFiles([]);
  };

  const needPhoto = !!fixing?.requiresPhotoOnFail && fixFiles.length === 0;

  const submitFix = async () => {
    if (!fixing) return;
    setSaving(true);
    try {
      const keys = await uploadInspectionPhotos(fixing.inspectionId, fixFiles);
      await fixInspectionResult(fixing.resultId, fixNote.trim() || null, keys);
      enqueueSnackbar('Đã đánh dấu đã sửa', { variant: 'success' });
      setFixing(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Tab "mọi lỗi": chỉ người có quyền sửa lượt kiểm mới đánh dấu thay được.
  const mayFix = tab === 'open' || (tab === 'all' && canManage);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Lỗi tôi phụ trách"
        links={[{ name: 'Kiểm tra cửa hàng', href: paths.dashboard.inspection.root }, { name: 'Lỗi tôi phụ trách' }]}
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lỗi của khu bạn phụ trách trong ca. Mục B sửa trong 15 phút, mục T sửa trong ca hoặc trước giao ca. Kết quả dùng để kèm
        cặp, không trừ tiền.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="open" label="Đang mở" />
        <Tab value="month" label="Tháng này" />
        {canRead && <Tab value="all" label="Mọi lỗi đang mở" />}
      </Tabs>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : faults.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {tab === 'month' ? 'Tháng này chưa có lỗi nào ghi cho bạn.' : 'Không có lỗi nào đang mở.'}
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mb: 4 }}>
          {faults.map((f) => (
            <FaultCard key={f.resultId} fault={f} onFix={mayFix ? openFix : undefined} />
          ))}
        </Stack>
      )}

      <Dialog open={!!fixing} onClose={() => !saving && setFixing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Đánh dấu đã sửa</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="subtitle2">
              {fixing?.itemCode} · {fixing?.itemTitle}
            </Typography>
            <InspectionPhotoRules />
            <PhotoPicker
              photos={[]}
              files={fixFiles}
              disabled={saving}
              onAdd={(files) => setFixFiles((prev) => [...prev, ...files])}
              onRemove={(i) => setFixFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
            {fixing?.requiresPhotoOnFail && (
              <Typography variant="caption" color={needPhoto ? 'warning.main' : 'text.secondary'}>
                Cần ít nhất 1 ảnh sau khi sửa.
              </Typography>
            )}
            <TextField label="Ghi chú" value={fixNote} onChange={(e) => setFixNote(e.target.value)} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixing(null)} disabled={saving}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={needPhoto} onClick={submitFix}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
