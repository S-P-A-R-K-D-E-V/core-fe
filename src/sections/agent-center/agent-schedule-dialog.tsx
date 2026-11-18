import type { IAgentSchedule, IAgentDefinition } from 'src/api/agent-center';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import {
  createAgentSchedule,
  deleteAgentSchedule,
  updateAgentSchedule,
} from 'src/api/agent-center';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { CRON_PRESETS, describeCron } from './agent-center-utils';

// ----------------------------------------------------------------------
// Thêm / sửa / xoá lịch chạy (agent.manage); người chỉ có agent.approve xem ở chế độ chỉ đọc. Cron 5 trường theo giờ Việt
// Nam; máy chủ kiểm lại — sai thì 400 { message } hiện ngay trong hộp.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  /** null = thêm mới. */
  schedule: IAgentSchedule | null;
  agents: IAgentDefinition[];
  canManage: boolean;
  onClose: VoidFunction;
  onSaved: VoidFunction;
  onOpenTask?: (taskId: string) => void;
};

export default function AgentScheduleDialog({
  open,
  schedule,
  agents,
  canManage,
  onClose,
  onSaved,
  onOpenTask,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = !!schedule;
  const readOnly = !canManage;

  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [cron, setCron] = useState(CRON_PRESETS[0].cron);
  const [instruction, setInstruction] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [deliverTelegram, setDeliverTelegram] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAgentId(schedule?.agentId ?? agents[0]?.id ?? '');
    setName(schedule?.name ?? '');
    setCron(schedule?.cron ?? CRON_PRESETS[0].cron);
    setInstruction(schedule?.instruction ?? '');
    setEnabled(schedule?.enabled ?? true);
    setDeliverTelegram(schedule?.deliverTelegram ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule]);

  const preview = describeCron(cron);
  const valid = !!agentId && !!name.trim() && preview.ok && !!instruction.trim();

  const handleSave = async () => {
    if (!valid) return;
    const body = {
      agentId,
      name: name.trim(),
      cron: cron.trim(),
      instruction: instruction.trim(),
      enabled,
      deliverTelegram,
    };
    setSaving(true);
    setError(null);
    try {
      if (schedule) await updateAgentSchedule(schedule.id, body);
      else await createAgentSchedule(body);
      enqueueSnackbar(isEdit ? 'Đã lưu lịch chạy' : 'Đã thêm lịch chạy');
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu lịch chạy thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      await deleteAgentSchedule(schedule.id);
      enqueueSnackbar('Đã xoá lịch chạy');
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(apiErrorMessage(err, 'Xoá lịch chạy thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {isEdit ? (readOnly ? 'Lịch chạy' : 'Sửa lịch chạy') : 'Thêm lịch chạy'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              select
              label="Agent"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={readOnly}
            >
              {agents.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                  {!a.enabled && ' (đang tắt)'}
                </MenuItem>
              ))}
              {schedule && !agents.some((a) => a.id === schedule.agentId) && (
                <MenuItem value={schedule.agentId}>{schedule.agentName}</MenuItem>
              )}
            </TextField>

            <TextField
              label="Tên lịch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Báo cáo sáng"
              InputProps={{ readOnly }}
            />

            <Stack spacing={1}>
              {!readOnly && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {CRON_PRESETS.map((p) => (
                    <Chip
                      key={p.cron}
                      label={p.label}
                      size="small"
                      color={cron.trim() === p.cron ? 'primary' : 'default'}
                      variant={cron.trim() === p.cron ? 'filled' : 'outlined'}
                      onClick={() => setCron(p.cron)}
                    />
                  ))}
                </Stack>
              )}
              <TextField
                label="Cron (phút giờ ngày tháng thứ)"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                error={!preview.ok}
                helperText={preview.ok ? `${preview.text} (giờ Việt Nam)` : preview.error}
                InputProps={{ readOnly, sx: { fontFamily: 'monospace' } }}
              />
            </Stack>

            <TextField
              label="Chỉ dẫn mỗi lần chạy"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              multiline
              minRows={3}
              maxRows={10}
              InputProps={{ readOnly }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={readOnly}
                />
              }
              label="Đang bật"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={deliverTelegram}
                  onChange={(e) => setDeliverTelegram(e.target.checked)}
                  disabled={readOnly}
                />
              }
              label={
                <Stack spacing={0}>
                  <Typography variant="body2">Gửi kết quả qua Telegram</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Gửi vào chat báo cáo riêng (Cài đặt → Thông báo, loại &quot;Telegram – báo cáo riêng&quot;), không
                    vào nhóm nhân viên. Lỗi cũng báo một dòng.
                  </Typography>
                </Stack>
              }
            />

            {schedule && (
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Lần chạy tới: {schedule.nextRunAt ? fDateTime(schedule.nextRunAt) : '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Lần chạy trước: {schedule.lastRunAt ? fDateTime(schedule.lastRunAt) : '—'}
                  {schedule.lastTaskId && onOpenTask && (
                    <Button
                      size="small"
                      sx={{ ml: 1, py: 0 }}
                      onClick={() => onOpenTask(schedule.lastTaskId as string)}
                    >
                      Xem việc
                    </Button>
                  )}
                </Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          {isEdit && canManage && (
            <Button
              color="error"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              sx={{ mr: 'auto' }}
            >
              Xoá
            </Button>
          )}
          <Button color="inherit" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          {canManage && (
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!valid}
              onClick={handleSave}
            >
              {isEdit ? 'Lưu' : 'Thêm lịch'}
            </LoadingButton>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xoá lịch chạy?"
        content={`Lịch "${schedule?.name ?? ''}" sẽ không chạy nữa. Các việc đã chạy vẫn giữ trên bảng.`}
        cancelText="Không"
        action={
          <LoadingButton variant="contained" color="error" loading={saving} onClick={handleDelete}>
            Xoá
          </LoadingButton>
        }
      />
    </>
  );
}
