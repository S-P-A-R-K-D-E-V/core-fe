import type { IUser } from 'src/types/corecms-api';
import type { IAgentTool, IAgentDefinition, IAgentDefinitionInput } from 'src/api/agent-center';

import { useMemo, useState, useEffect } from 'react';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  DEFAULT_AGENT_MODEL,
  createAgentDefinition,
  updateAgentDefinition,
} from 'src/api/agent-center';

import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';

import { permissionDomain } from 'src/sections/agent-approvals/agent-action-utils';
import { userDisplayName } from 'src/sections/store-settings/agent-key-settings-dialog';

// ----------------------------------------------------------------------
// Thêm / sửa agent (agent.manage). Tạo agent = máy chủ tự tạo khoá `ck_` chế độ "Agent tự chạy" làm danh tính; lệnh ghi
// đi qua cổng K3 theo Mức tự chủ. Đổi system prompt → máy chủ tăng promptVersion.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  /** null = thêm mới. */
  agent: IAgentDefinition | null;
  tools: IAgentTool[];
  toolsLoading: boolean;
  users: IUser[];
  onClose: VoidFunction;
  onSaved: VoidFunction;
};

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Phân tích – Điều phối" → "phan-tich-dieu-phoi". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toNumberOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export default function AgentDefinitionDialog({
  open,
  agent,
  tools,
  toolsLoading,
  users,
  onClose,
  onSaved,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = !!agent;

  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState(DEFAULT_AGENT_MODEL);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [actsFor, setActsFor] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [maxToolCalls, setMaxToolCalls] = useState('20');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setKey(agent?.key ?? '');
    setKeyTouched(!!agent);
    setName(agent?.name ?? '');
    setDescription(agent?.description ?? '');
    setSystemPrompt(agent?.systemPrompt ?? '');
    setModel(agent?.model || DEFAULT_AGENT_MODEL);
    setToolNames(agent?.toolNames ?? []);
    setActsFor(agent?.actsForUserId ?? null);
    setBudget(agent?.dailyTokenBudget != null ? String(agent.dailyTokenBudget) : '');
    setMaxToolCalls(String(agent?.maxToolCallsPerTask ?? 20));
  }, [open, agent]);

  // Tool sắp theo nhóm quyền rồi theo tên để Autocomplete gom nhóm liền mạch.
  const sortedTools = useMemo(
    () =>
      [...tools].sort(
        (a, b) =>
          permissionDomain(a.permission).localeCompare(permissionDomain(b.permission)) ||
          a.name.localeCompare(b.name)
      ),
    [tools]
  );
  // Tool đã chọn mà danh mục không còn (bị gỡ / khoá mất quyền) vẫn hiện để bỏ chọn được.
  const toolOptions = useMemo(() => {
    const known = new Set(sortedTools.map((t) => t.name));
    const missing: IAgentTool[] = toolNames
      .filter((n) => !known.has(n))
      .map((n) => ({
        name: n,
        title: n,
        description: null,
        permission: 'khác',
        method: '',
        readOnly: true,
      }));
    return [...sortedTools, ...missing];
  }, [sortedTools, toolNames]);
  const selectedTools = toolOptions.filter((t) => toolNames.includes(t.name));
  const writeCount = selectedTools.filter((t) => !t.readOnly).length;

  const selectedUser = users.find((u) => u.id === actsFor) ?? null;
  const keyError = key && !KEY_PATTERN.test(key) ? 'Chỉ chữ thường, số và dấu gạch ngang' : null;
  const valid = !!key && !keyError && !!name.trim() && !!systemPrompt.trim() && !!actsFor;

  const handleSave = async () => {
    if (!valid) return;
    const body: IAgentDefinitionInput = {
      key,
      name: name.trim(),
      description: description.trim() || null,
      systemPrompt,
      model: model.trim() || DEFAULT_AGENT_MODEL,
      toolNames,
      actsForUserId: actsFor,
      dailyTokenBudget: toNumberOrNull(budget),
      maxToolCallsPerTask: toNumberOrNull(maxToolCalls) ?? 20,
    };
    setSaving(true);
    setError(null);
    try {
      if (agent) await updateAgentDefinition(agent.id, body);
      else await createAgentDefinition(body);
      enqueueSnackbar(isEdit ? `Đã lưu agent "${body.name}"` : `Đã thêm agent "${body.name}"`);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu agent thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? `Sửa agent "${agent?.name}"` : 'Thêm agent'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Tên agent"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value));
              }}
            />
            <TextField
              fullWidth
              label="Mã (key)"
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value.toLowerCase());
              }}
              error={!!keyError}
              helperText={keyError ?? 'Duy nhất trong cửa hàng, vd phan-tich'}
            />
          </Stack>

          <TextField
            label="Mô tả"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={1}
            maxRows={3}
          />

          <TextField
            label="System prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            multiline
            minRows={6}
            maxRows={18}
            helperText={
              isEdit
                ? `Đang ở phiên bản ${agent?.promptVersion ?? 1} — đổi prompt thì máy chủ tăng phiên bản.`
                : 'Vai trò, việc được làm, giọng văn, khi nào phải hỏi người.'
            }
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
          />

          <Autocomplete
            multiple
            disableCloseOnSelect
            loading={toolsLoading}
            options={toolOptions}
            value={selectedTools}
            onChange={(_, list) => setToolNames(list.map((t) => t.name))}
            groupBy={(t) => permissionDomain(t.permission)}
            getOptionLabel={(t) => t.title || t.name}
            isOptionEqualToValue={(a, b) => a.name === b.name}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter((t) =>
                [t.name, t.title, t.permission, t.description ?? ''].some((s) =>
                  s.toLowerCase().includes(q)
                )
              );
            }}
            renderOption={(props, t, { selected }) => (
              <li {...props} key={t.name}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" noWrap>
                      {t.title || t.name}
                    </Typography>
                    <Label color={t.readOnly ? 'info' : 'warning'} variant="soft">
                      {t.readOnly ? 'Đọc' : 'Ghi'}
                    </Label>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {t.name} · {t.permission}
                  </Typography>
                </Stack>
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((t, index) => {
                const { key: tagKey, ...tagProps } = getTagProps({ index });
                return (
                  <Label
                    key={tagKey}
                    {...(tagProps as object)}
                    color={t.readOnly ? 'default' : 'warning'}
                    variant="soft"
                    sx={{ m: 0.25 }}
                  >
                    {t.name}
                  </Label>
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tool được dùng"
                placeholder="Tìm tool…"
                helperText={`${toolNames.length} tool, ${writeCount} tool ghi. Chỉ chọn được tool trong quyền của cửa hàng.`}
              />
            )}
          />

          <Alert severity="info">
            Lệnh ghi của agent theo{' '}
            <Link component={RouterLink} href={`${paths.dashboard.agent.approvals}?tab=autonomy`}>
              Mức tự chủ ở trang Duyệt việc agent
            </Link>{' '}
            (chưa đặt = chờ duyệt).
          </Alert>

          <Autocomplete
            options={users}
            value={selectedUser}
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
                label="Làm thay cho"
                error={!actsFor}
                helperText="Khi agent tự làm, người này được ghi là người thực hiện."
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              helperText={`Route MotKey, mặc định ${DEFAULT_AGENT_MODEL}`}
            />
            <TextField
              fullWidth
              label="Ngân sách token / ngày"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
              inputProps={{ inputMode: 'numeric' }}
              helperText="Để trống = không giới hạn"
            />
            <TextField
              fullWidth
              label="Tối đa lần gọi tool / việc"
              value={maxToolCalls}
              onChange={(e) => setMaxToolCalls(e.target.value.replace(/[^\d]/g, ''))}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!valid} onClick={handleSave}>
          {isEdit ? 'Lưu' : 'Thêm agent'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
