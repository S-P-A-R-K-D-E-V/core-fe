import type { IAgentDefinition } from 'src/api/agent-center';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import Iconify from 'src/components/iconify';

import {
  TASK_SOURCE,
  ENTRY_KINDS,
  type BoardMode,
  type EntryKindFilter,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Thanh trên bảng việc: Đang phải làm / Tất cả, tìm, lọc agent + nguồn, đổi chế độ Kanban / Danh sách / Lịch.
// ----------------------------------------------------------------------

export type TaskView = 'kanban' | 'list' | 'calendar';

export const TASK_VIEWS: { value: TaskView; label: string; icon: string }[] = [
  { value: 'kanban', label: 'Kanban', icon: 'solar:widget-4-bold' },
  { value: 'list', label: 'Danh sách', icon: 'solar:list-bold' },
  { value: 'calendar', label: 'Lịch', icon: 'solar:calendar-bold' },
];

export type TaskFilterState = {
  mode: BoardMode;
  q: string;
  agentId: string;
  source: string;
  /** '' = mọi loại; agent / work / cleaning. */
  kind: EntryKindFilter;
};

type Props = {
  view: TaskView;
  onView: (view: TaskView) => void;
  filter: TaskFilterState;
  onFilter: (patch: Partial<TaskFilterState>) => void;
  agents: IAgentDefinition[];
  onRefresh: VoidFunction;
};

export default function AgentTaskToolbar({
  view,
  onView,
  filter,
  onFilter,
  agents,
  onRefresh,
}: Props) {
  const filtered = !!(filter.q || filter.agentId || filter.source || filter.kind);

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'stretch', md: 'center' }}
      sx={{ mb: 2 }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ flexGrow: 1 }}
      >
        {view === 'kanban' && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter.mode}
            onChange={(_, v: BoardMode | null) => v && onFilter({ mode: v })}
          >
            <ToggleButton value="active" sx={{ px: 1.5 }}>
              Đang phải làm
            </ToggleButton>
            <ToggleButton value="all" sx={{ px: 1.5 }}>
              Tất cả
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <TextField
          size="small"
          value={filter.q}
          onChange={(e) => onFilter({ q: e.target.value })}
          placeholder="Tìm tên việc, mã, người làm…"
          sx={{ width: { xs: 1, sm: 240 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          select
          size="small"
          label="Loại"
          value={filter.kind}
          onChange={(e) => onFilter({ kind: e.target.value as EntryKindFilter })}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Mọi loại việc</MenuItem>
          {ENTRY_KINDS.map((k) => (
            <MenuItem key={k.value} value={k.value}>
              {k.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Agent"
          value={filter.agentId}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => onFilter({ agentId: e.target.value })}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Tất cả agent</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Nguồn"
          value={filter.source}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => onFilter({ source: e.target.value })}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">Mọi nguồn</MenuItem>
          {Object.entries(TASK_SOURCE).map(([value, meta]) => (
            <MenuItem key={value} value={value}>
              {meta.label}
            </MenuItem>
          ))}
        </TextField>

        {filtered && (
          <Button
            size="small"
            color="error"
            onClick={() => onFilter({ q: '', agentId: '', source: '', kind: '' })}
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" width={16} />}
          >
            Bỏ lọc
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v: TaskView | null) => v && onView(v)}
        >
          {TASK_VIEWS.map((v) => (
            <ToggleButton
              key={v.value}
              value={v.value}
              aria-label={v.label}
              sx={{ px: 1.25, gap: 0.75 }}
            >
              <Iconify icon={v.icon} width={18} />
              {v.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Tooltip title="Tải lại">
          <IconButton onClick={onRefresh}>
            <Iconify icon="solar:restart-bold" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
