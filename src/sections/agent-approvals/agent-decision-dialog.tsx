'use client';

import type { IAgentAction } from 'src/api/agent-actions';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { CodeText } from './agent-action-preview';
import { resultSnippet, isSuccessStatus } from './agent-action-utils';

// ----------------------------------------------------------------------
// Hộp xác nhận Duyệt / Từ chối (ghi chú tuỳ chọn) và hộp kết quả sau khi duyệt (máy chủ đã chạy lệnh).
// ----------------------------------------------------------------------

export type DecisionMode = 'approve' | 'reject';

type DecisionProps = {
  action: IAgentAction | null;
  mode: DecisionMode;
  submitting: boolean;
  onClose: VoidFunction;
  onSubmit: (note: string) => void;
};

export function AgentDecisionDialog({
  action,
  mode,
  submitting,
  onClose,
  onSubmit,
}: DecisionProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (action) setNote('');
  }, [action, mode]);

  const approve = mode === 'approve';

  return (
    <Dialog open={!!action} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{approve ? 'Duyệt việc agent xin làm?' : 'Từ chối hẳn việc này?'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {action && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">{action.title?.trim() || action.summary}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {action.agentName}
                {action.actsForName ? ` · làm thay ${action.actsForName}` : ''}
              </Typography>
            </Stack>
          )}
          {approve ? (
            <Alert severity="warning">
              Bấm Duyệt là máy chủ chạy ngay đúng lệnh này trên dữ liệu thật, bạn được ghi là người
              thực hiện. Không hoàn tác tự động được.
            </Alert>
          ) : (
            <Alert severity="warning">
              <strong>Agent sẽ dừng việc này, không làm lại.</strong> Lệnh không chạy; phiếu chuyển
              sang tab Đã xử lý kèm lý do bạn ghi. Nếu chỉ muốn agent sửa rồi gửi lại, hãy đóng hộp
              này và bấm <strong>Yêu cầu sửa</strong>.
            </Alert>
          )}
          <TextField
            label={approve ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối (không bắt buộc)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={submitting}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          color={approve ? 'primary' : 'error'}
          loading={submitting}
          onClick={() => onSubmit(note)}
        >
          {approve ? 'Duyệt và chạy ngay' : 'Từ chối, dừng việc'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

export function AgentResultDialog({
  action,
  onClose,
}: {
  action: IAgentAction | null;
  onClose: VoidFunction;
}) {
  const ok =
    action?.status === 'executed' &&
    (action.resultStatusCode == null || isSuccessStatus(action.resultStatusCode));
  const running = action?.status === 'executing' || action?.status === 'approved';

  return (
    <Dialog open={!!action} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Kết quả chạy lệnh</DialogTitle>
      <DialogContent>
        {action && (
          <Stack spacing={2}>
            <Typography variant="subtitle2">{action.title?.trim() || action.summary}</Typography>
            {running && (
              <Alert severity="info">
                Lệnh đang chạy — xem kết quả ở tab Đã xử lý sau ít phút.
              </Alert>
            )}
            {!running && ok && (
              <Alert severity="success">
                Đã chạy xong
                {action.resultStatusCode != null ? ` (HTTP ${action.resultStatusCode})` : ''}.
              </Alert>
            )}
            {!running && !ok && (
              <Alert severity="error">
                Lệnh trả lỗi
                {action.resultStatusCode != null ? ` (HTTP ${action.resultStatusCode})` : ''} — xem
                phản hồi bên dưới.
              </Alert>
            )}
            {action.resultBody && (
              <CodeText text={resultSnippet(action.resultBody, 1500)} maxHeight={320} />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
