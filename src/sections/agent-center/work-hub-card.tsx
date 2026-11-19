import type { LabelColor } from 'src/components/label';
import type { IWorkHubItem } from 'src/api/work-hub';

import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { fDateTime } from 'src/utils/format-time';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import { shortAgo, ENTRY_KINDS } from './agent-center-utils';

// ----------------------------------------------------------------------
// Thẻ việc giao một người (CV-) / vệ sinh theo ca (VS-) trên bảng chung (T2). Không kéo được — bấm thẻ mở hộp duyệt / chấm
// sẵn có của từng nguồn.
// ----------------------------------------------------------------------

type Props = {
  item: IWorkHubItem;
  index: number;
  now: number;
  draggableId: string;
  onOpen: (item: IWorkHubItem) => void;
};

function statusColor(item: IWorkHubItem): LabelColor {
  switch (item.column) {
    case 'waiting':
      return 'warning';
    case 'done':
      return 'success';
    case 'ended':
      return item.status === 'Cancelled' ? 'default' : 'error';
    default:
      return 'default';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

function WorkHubCard({ item, index, now, draggableId, onOpen }: Props) {
  const theme = useTheme();
  const kind = ENTRY_KINDS.find((k) => k.value === item.kind);
  const cleaning = item.kind === 'cleaning';
  const passedPct = item.total > 0 ? Math.round((item.passed / item.total) * 100) : 0;

  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled>
      {(provided) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(item)}
          data-testid="work-hub-card"
          sx={{
            width: 1,
            borderRadius: 1.5,
            cursor: 'pointer',
            bgcolor: 'background.paper',
            boxShadow: theme.customShadows.z1,
            '&:hover': { boxShadow: theme.customShadows.z8 },
          }}
        >
          <Stack spacing={0.75} sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                {item.code}
              </Typography>
              <Tooltip title={kind?.label ?? ''}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                  <Iconify icon={kind?.icon ?? 'solar:document-bold'} width={14} />
                </Box>
              </Tooltip>
              <Box sx={{ flexGrow: 1 }} />
              <Label color={statusColor(item)} variant="soft" sx={{ height: 20, fontSize: 11 }}>
                {item.statusLabel}
              </Label>
            </Stack>

            <Typography
              variant="subtitle2"
              sx={{
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {item.title}
            </Typography>

            {cleaning && item.total > 0 && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <LinearProgress
                  variant="determinate"
                  value={passedPct}
                  color={item.failed > 0 ? 'error' : 'success'}
                  sx={{ flexGrow: 1, height: 4, borderRadius: 1 }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                >
                  {item.subtitle}
                </Typography>
              </Stack>
            )}
            {!cleaning && item.subtitle && (
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                {item.subtitle}
              </Typography>
            )}

            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ typography: 'caption', color: 'text.disabled' }}
            >
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: 11,
                  bgcolor: cleaning ? 'success.lighter' : 'warning.lighter',
                  color: cleaning ? 'success.dark' : 'warning.dark',
                }}
              >
                {cleaning || !item.assigneeName ? (
                  <Iconify
                    icon={cleaning ? 'solar:users-group-rounded-bold' : 'solar:user-bold'}
                    width={12}
                  />
                ) : (
                  initials(item.assigneeName)
                )}
              </Avatar>
              <Box component="span" sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ color: 'text.secondary' }}
                >
                  {item.assigneeName ?? (cleaning ? 'Nhân viên trong ca' : '—')}
                </Typography>
              </Box>
              {item.photoCount > 0 && (
                <>
                  <Iconify icon="solar:camera-bold" width={13} />
                  <span>{item.photoCount}</span>
                </>
              )}
              {item.dueAt && item.column !== 'done' ? (
                <Tooltip title={`Hạn ${fDateTime(item.dueAt, 'HH:mm dd/MM')}`}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      whiteSpace: 'nowrap',
                      color: item.overdue ? 'error.main' : 'inherit',
                    }}
                  >
                    <Iconify icon="solar:calendar-bold" width={13} />
                    {fDateTime(item.dueAt, 'HH:mm dd/MM')}
                  </Box>
                </Tooltip>
              ) : (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Iconify icon="solar:clock-circle-outline" width={13} />
                  {shortAgo(item.finishedAt || item.createdAt, now)}
                </Box>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Draggable>
  );
}

export default memo(WorkHubCard);
