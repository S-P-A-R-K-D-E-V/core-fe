'use client';

import type { IUser } from 'src/types/corecms-api';
import type { IAgentKey } from 'src/api/store-settings';
import type { AgentApprovalMode } from 'src/api/agent-actions';

import { useState, useEffect } from 'react';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage } from 'src/utils/api-error';

import { updateAgentKeySettings } from 'src/api/agent-actions';

import { useSnackbar } from 'src/components/snackbar';

import { APPROVAL_MODES } from 'src/sections/agent-approvals/agent-action-utils';

// ----------------------------------------------------------------------
// Cách duyệt lệnh ghi của một khoá agent (K3): người dùng tự xác nhận trong ứng dụng agent, hay agent tự chạy và lệnh ghi
// theo Mức tự chủ của cửa hàng (cần chọn người được làm thay — người được ghi là người thực hiện khi agent tự làm).
// ----------------------------------------------------------------------

type Props = {
  agentKey: IAgentKey | null;
  users: IUser[];
  onClose: VoidFunction;
  onSaved: VoidFunction;
};

export function userDisplayName(
  u: Pick<IUser, 'fullName' | 'firstName' | 'lastName' | 'email'>
): string {
  return (
    u.fullName?.trim() || [u.lastName, u.firstName].filter(Boolean).join(' ').trim() || u.email
  );
}

export default function AgentKeySettingsDialog({ agentKey, users, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [mode, setMode] = useState<AgentApprovalMode>('client_confirm');
  const [actsFor, setActsFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agentKey) return;
    setMode(agentKey.approvalMode === 'server_approval' ? 'server_approval' : 'client_confirm');
    setActsFor(agentKey.actsForUserId ?? null);
  }, [agentKey]);

  const selected = users.find((u) => u.id === actsFor) ?? null;
  const needsUser = mode === 'server_approval' && !actsFor;

  const handleSave = async () => {
    if (!agentKey) return;
    setSaving(true);
    try {
      await updateAgentKeySettings(agentKey.id, {
        approvalMode: mode,
        ...(actsFor ? { actsForUserId: actsFor } : {}),
      });
      enqueueSnackbar(`Đã lưu cách duyệt của khoá "${agentKey.name}"`);
      onSaved();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu cách duyệt thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!agentKey} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cách duyệt của khoá &quot;{agentKey?.name}&quot;</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as AgentApprovalMode)}>
            {(Object.keys(APPROVAL_MODES) as AgentApprovalMode[]).map((value) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio />}
                sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { mt: -0.75 } }}
                label={
                  <Stack spacing={0.25}>
                    <Typography variant="subtitle2">{APPROVAL_MODES[value].label}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {APPROVAL_MODES[value].description}
                    </Typography>
                  </Stack>
                }
              />
            ))}
          </RadioGroup>

          <Autocomplete
            options={users}
            value={selected}
            onChange={(_, u) => setActsFor(u?.id ?? null)}
            getOptionLabel={(u) => userDisplayName(u)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, u) => (
              <li {...props} key={u.id}>
                <Stack>
                  <Typography variant="body2">{userDisplayName(u)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {[u.role, u.email].filter(Boolean).join(' · ')}
                  </Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Người được làm thay"
                error={needsUser}
                helperText={
                  needsUser
                    ? '"Agent tự chạy" cần người được làm thay'
                    : 'Khi agent tự làm, người này được ghi là người thực hiện.'
                }
              />
            )}
          />

          {mode === 'server_approval' && (
            <Alert severity="info">
              Việc nào agent được tự làm, việc nào phải chờ duyệt: đặt ở{' '}
              <Link component={RouterLink} href={`${paths.dashboard.agent.approvals}?tab=autonomy`}>
                Duyệt việc agent › Mức tự chủ
              </Link>{' '}
              (chưa đặt = chờ duyệt).
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={needsUser}
          onClick={handleSave}
        >
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
