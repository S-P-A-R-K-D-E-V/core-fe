'use client';

import type { IAgentAction } from 'src/api/agent-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { fDateTime } from 'src/utils/format-time';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import {
  timeLeft,
  queryParams,
  resultSnippet,
  isSuccessStatus,
  agentActionStatus,
  parseActionParams,
} from './agent-action-utils';

// ----------------------------------------------------------------------
// Một phiếu agent xin làm: agent nào, làm thay ai, lệnh gì (quyền, method + đường dẫn), tham số đọc được, hạn duyệt.
// Phiếu đã xử lý thì hiện thêm ai quyết định, ghi chú, kết quả chạy.
// ----------------------------------------------------------------------

const METHOD_COLOR: Record<string, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  POST: 'success',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
};

export function ParamList({ fields }: { fields: { key: string; value: string }[] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, max-content) 1fr' },
        columnGap: 2,
        rowGap: { xs: 0, sm: 0.75 },
      }}
    >
      {fields.map((f, i) => (
        <Box key={`${f.key}-${i}`} sx={{ display: 'contents' }}>
          <Typography
            component="dt"
            variant="body2"
            sx={{ color: 'text.secondary', wordBreak: 'break-word' }}
          >
            {f.key}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, mb: { xs: 1, sm: 0 }, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function CodeText({ text, maxHeight = 240 }: { text: string; maxHeight?: number }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        maxHeight,
        overflow: 'auto',
        borderRadius: 1,
        bgcolor: 'background.neutral',
        typography: 'caption',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </Box>
  );
}

type Props = {
  action: IAgentAction;
  /** Mốc thời gian để tính "còn bao lâu" — trang truyền vào và cập nhật định kỳ. */
  now?: number;
  busy?: boolean;
  onApprove?: (action: IAgentAction) => void;
  onReject?: (action: IAgentAction) => void;
};

export default function AgentActionCard({ action, now, busy, onApprove, onReject }: Props) {
  const status = agentActionStatus(action.status);
  const params = parseActionParams(action.bodyJson);
  const query = queryParams(action.pathAndQuery);
  const isPending = action.status === 'pending';
  const expired = isPending && new Date(action.expiresAt).getTime() <= (now ?? Date.now());
  const left = timeLeft(action.expiresAt, now);
  const soon =
    isPending &&
    !expired &&
    new Date(action.expiresAt).getTime() - (now ?? Date.now()) < 15 * 60_000;
  const hasResult = action.resultStatusCode != null || !!action.resultBody;

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 1.25,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'background.neutral',
            }}
          >
            <Iconify icon="solar:cpu-bolt-bold-duotone" width={24} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {action.agentName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {action.actsForName
                ? `làm thay ${action.actsForName}`
                : 'không gắn người được làm thay'}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Label color={expired ? 'default' : status.color}>
              {expired ? 'Hết hạn' : status.label}
            </Label>
            {isPending && (
              <Typography
                variant="caption"
                sx={{ color: soon || expired ? 'error.main' : 'text.secondary' }}
              >
                {left}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Typography variant="subtitle2" sx={{ whiteSpace: 'pre-wrap' }}>
          {action.summary}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Label variant="soft" color={METHOD_COLOR[action.method.toUpperCase()] ?? 'default'}>
            {action.method.toUpperCase()}
          </Label>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              color: 'text.secondary',
              wordBreak: 'break-all',
              flex: 1,
              minWidth: 0,
            }}
          >
            {action.pathAndQuery.split('?')[0]}
          </Typography>
          <Tooltip title="Quyền của lệnh — mức tự chủ đặt theo quyền này">
            <Label variant="outlined" sx={{ fontFamily: 'monospace', textTransform: 'none' }}>
              {action.permission}
            </Label>
          </Tooltip>
        </Stack>

        {(params.kind !== 'none' || query.length > 0) && (
          <Box>
            <Typography variant="overline" component="div" sx={{ color: 'text.disabled', mb: 0.5 }}>
              Tham số
            </Typography>
            {query.length > 0 && <ParamList fields={query} />}
            {params.kind === 'fields' && <ParamList fields={params.fields} />}
            {params.kind === 'raw' && <CodeText text={params.text} />}
          </Box>
        )}

        {!isPending && (action.decidedAt || action.decisionNote) && (
          <>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Stack spacing={0.5}>
              <Typography variant="body2">
                {action.status === 'rejected' ? 'Từ chối' : 'Duyệt'} bởi{' '}
                <strong>{action.decidedByName ?? 'không rõ'}</strong>
                {action.decidedAt ? ` lúc ${fDateTime(action.decidedAt)}` : ''}
              </Typography>
              {action.decisionNote && (
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}
                >
                  Ghi chú: {action.decisionNote}
                </Typography>
              )}
            </Stack>
          </>
        )}

        {!isPending && hasResult && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Kết quả chạy
                {action.executedAt ? ` (${fDateTime(action.executedAt)})` : ''}:
              </Typography>
              {action.resultStatusCode != null && (
                <Label color={isSuccessStatus(action.resultStatusCode) ? 'success' : 'error'}>
                  HTTP {action.resultStatusCode}
                </Label>
              )}
            </Stack>
            {action.resultBody && (
              <CodeText text={resultSnippet(action.resultBody)} maxHeight={180} />
            )}
          </Stack>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Gửi lúc {fDateTime(action.createdAt)}
            {isPending ? ` · hạn duyệt ${fDateTime(action.expiresAt)}` : ''}
          </Typography>

          {isPending && (onApprove || onReject) && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {onReject && (
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={busy}
                  onClick={() => onReject(action)}
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                >
                  Từ chối
                </Button>
              )}
              {onApprove && (
                <Button
                  variant="contained"
                  disabled={busy || expired}
                  onClick={() => onApprove(action)}
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                >
                  Duyệt
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
