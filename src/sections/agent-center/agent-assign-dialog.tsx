import type { IAgentTask, IAgentDefinition } from 'src/api/agent-center';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { apiErrorMessage } from 'src/utils/api-error';

import { createAgentTask } from 'src/api/agent-center';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Giao việc cho một agent → POST agent-center/tasks, việc vào cột Chờ chạy.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  agents: IAgentDefinition[];
  onClose: VoidFunction;
  onCreated: (task: IAgentTask) => void;
};

export default function AgentAssignDialog({ open, agents, onClose, onCreated }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledAgents = agents.filter((a) => a.enabled);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setInstruction('');
    setError(null);
    setAgentId((prev) =>
      enabledAgents.some((a) => a.id === prev) ? prev : (enabledAgents[0]?.id ?? '')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = !!agentId && !!title.trim() && !!instruction.trim();

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const task = await createAgentTask({
        agentId,
        title: title.trim(),
        instruction: instruction.trim(),
      });
      enqueueSnackbar('Đã giao việc — việc nằm ở cột Chờ chạy');
      onCreated(task);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Giao việc thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Giao việc cho agent</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {enabledAgents.length === 0 && (
            <Alert severity="info">
              Chưa có agent nào đang bật. Thêm hoặc bật agent ở tab Agent.
            </Alert>
          )}
          <TextField
            select
            label="Agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={enabledAgents.length === 0}
          >
            {enabledAgents.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Tên việc"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 200 }}
            placeholder="Vd: Kiểm hàng sắp hết ở chi nhánh 1"
          />
          <TextField
            label="Chỉ dẫn"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            multiline
            minRows={4}
            maxRows={12}
            placeholder="Nói rõ agent cần làm gì, dùng số liệu nào, kết quả trả về ra sao."
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!valid}
          onClick={handleSubmit}
        >
          Giao việc
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
