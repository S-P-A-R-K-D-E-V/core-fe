'use client';

import type { IAgentAction } from 'src/api/agent-actions';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import { CodeText, ParamList, ActionPreview, PreviousVersion } from './agent-action-preview';
import {
  timeLeft,
  queryParams,
  resultSnippet,
  isSuccessStatus,
  agentActionStatus,
  parseActionParams,
} from './agent-action-utils';

export { CodeText, ParamList } from './agent-action-preview';

// ----------------------------------------------------------------------
// Một phiếu agent xin làm: agent nào, làm thay ai, làm gì (tên thao tác + bản xem trước dễ đọc — bài đăng như thật hoặc
// bảng tham số), thuộc việc nào, bản thứ mấy (kèm bản trước để so), hạn duyệt. Thông tin kỹ thuật (quyền, method +
// đường dẫn, JSON) để trong "Chi tiết kỹ thuật". Phiếu đã xử lý thì hiện thêm ai quyết định, ghi chú, kết quả chạy.
// ----------------------------------------------------------------------

const METHOD_COLOR: Record<string, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  POST: 'success',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
};

const DECISION_VERB: Record<string, string> = {
  rejected: 'Từ chối',
  revision_requested: 'Yêu cầu sửa',
};

type Props = {
  action: IAgentAction;
  /** Mốc thời gian để tính "còn bao lâu" — trang truyền vào và cập nhật định kỳ. */
  now?: number;
  busy?: boolean;
  onApprove?: (action: IAgentAction) => void;
  onReject?: (action: IAgentAction) => void;
  onRequestRevision?: (action: IAgentAction) => void;
};

function TechnicalDetails({
  action,
  defaultExpanded,
}: {
  action: IAgentAction;
  defaultExpanded: boolean;
}) {
  const params = parseActionParams(action.bodyJson);
  const query = queryParams(action.pathAndQuery);

  return (
    <Accordion
      disableGutters
      defaultExpanded={defaultExpanded}
      sx={{
        borderRadius: 1.5,
        bgcolor: 'transparent',
        border: (theme) => `1px dashed ${theme.palette.divider}`,
        boxShadow: 'none',
        '&::before': { display: 'none' },
        '&.Mui-expanded': { boxShadow: 'none', bgcolor: 'transparent' },
      }}
    >
      <AccordionSummary
        expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
        sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 1 } }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:code-bold" width={18} sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chi tiết kỹ thuật
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
              <Typography
                variant="overline"
                component="div"
                sx={{ color: 'text.disabled', mb: 0.5 }}
              >
                Tham số
              </Typography>
              {query.length > 0 && <ParamList fields={query} />}
              {params.kind === 'fields' && <ParamList fields={params.fields} />}
              {params.kind === 'raw' && <CodeText text={params.text} />}
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default function AgentActionCard({
  action,
  now,
  busy,
  onApprove,
  onReject,
  onRequestRevision,
}: Props) {
  const status = agentActionStatus(action.status);
  const isPending = action.status === 'pending';
  const expired = isPending && new Date(action.expiresAt).getTime() <= (now ?? Date.now());
  const left = timeLeft(action.expiresAt, now);
  const soon =
    isPending &&
    !expired &&
    new Date(action.expiresAt).getTime() - (now ?? Date.now()) < 15 * 60_000;
  const hasResult = action.resultStatusCode != null || !!action.resultBody;

  const title = action.title?.trim() || action.summary;
  const { preview } = action;
  const hasPreview =
    !!preview &&
    ((preview.kind === 'social_post' && !!preview.socialPost) || (preview.fields?.length ?? 0) > 0);
  const currentImages =
    preview?.kind === 'social_post' ? (preview.socialPost?.imageUrls ?? []) : [];
  const version = action.version ?? null;
  const revisionsLeft = action.revisionsLeft ?? null;
  const revisionLocked = revisionsLeft !== null && revisionsLeft <= 0;

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
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" sx={{ wordBreak: 'break-word' }}>
                {title}
              </Typography>
              {version !== null && version > 1 && (
                <Label color="info" variant="soft">
                  Bản {version}
                </Label>
              )}
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {action.agentName}
              {action.actsForName
                ? ` · làm thay ${action.actsForName}`
                : ' · không gắn người được làm thay'}
            </Typography>
            {action.taskTitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Thuộc việc:{' '}
                {action.taskId ? (
                  <Link
                    component={RouterLink}
                    href={`${paths.dashboard.agent.center}?task=${encodeURIComponent(action.taskId)}`}
                    underline="hover"
                  >
                    {action.taskTitle}
                  </Link>
                ) : (
                  action.taskTitle
                )}
              </Typography>
            )}
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

        {hasPreview && <ActionPreview preview={preview} />}

        {action.previous && version !== null && version > 1 && (
          <PreviousVersion previous={action.previous} currentImages={currentImages} />
        )}

        <TechnicalDetails action={action} defaultExpanded={!hasPreview} />

        {!isPending && (action.decidedAt || action.decisionNote) && (
          <>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Stack spacing={0.5}>
              <Typography variant="body2">
                {DECISION_VERB[action.status] ?? 'Duyệt'} bởi{' '}
                <strong>{action.decidedByName ?? 'không rõ'}</strong>
                {action.decidedAt ? ` lúc ${fDateTime(action.decidedAt)}` : ''}
              </Typography>
              {action.decisionNote && (
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
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
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Gửi lúc {fDateTime(action.createdAt)}
              {isPending ? ` · hạn duyệt ${fDateTime(action.expiresAt)}` : ''}
            </Typography>
            {isPending && onRequestRevision && revisionsLeft !== null && (
              <Typography
                variant="caption"
                sx={{ color: revisionLocked ? 'warning.main' : 'text.secondary' }}
              >
                {revisionLocked
                  ? 'Đã hết lượt yêu cầu sửa'
                  : `Còn ${revisionsLeft} lần yêu cầu sửa`}
              </Typography>
            )}
          </Stack>

          {isPending && (onApprove || onReject || onRequestRevision) && (
            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
              {onReject && (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() => onReject(action)}
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                >
                  Từ chối
                </Button>
              )}
              {onRequestRevision && (
                <Tooltip
                  title={
                    revisionLocked
                      ? 'Việc này đã yêu cầu sửa đủ số lần cho phép — hãy Duyệt, Từ chối hoặc nhắn cho agent trên bảng việc'
                      : ''
                  }
                >
                  {/* span để Tooltip vẫn hiện khi nút bị khoá */}
                  <span>
                    <Button
                      variant="outlined"
                      color="inherit"
                      disabled={busy || expired || revisionLocked}
                      onClick={() => onRequestRevision(action)}
                      startIcon={<Iconify icon="solar:pen-bold" />}
                    >
                      Yêu cầu sửa
                    </Button>
                  </span>
                </Tooltip>
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
