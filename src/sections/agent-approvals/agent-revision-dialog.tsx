'use client';

import type { IAgentAction } from 'src/api/agent-actions';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import Iconify from 'src/components/iconify';

import { previewImages } from './agent-action-preview';
import { appendNote, REVISION_QUICK_NOTES } from './agent-action-utils';

// ----------------------------------------------------------------------
// Hộp "Yêu cầu sửa": lệnh không chạy, agent nhận ghi chú (+ ảnh cần làm lại) rồi gửi phiếu bản mới để duyệt lại. Cần ghi
// chú hoặc ít nhất 1 ảnh. Lỗi của máy chủ (vd hết lượt sửa) hiện ngay trong hộp.
// ----------------------------------------------------------------------

type Props = {
  action: IAgentAction | null;
  submitting: boolean;
  /** Câu lỗi của máy chủ lần gửi trước (ProblemDetails detail / title). */
  error?: string | null;
  onClose: VoidFunction;
  onSubmit: (data: { note: string; imageUrls: string[] }) => void;
};

export function AgentRevisionDialog({ action, submitting, error, onClose, onSubmit }: Props) {
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (action) {
      setNote('');
      setSelected([]);
    }
  }, [action]);

  const images = previewImages(action?.preview);
  const revisionsLeft = action?.revisionsLeft ?? null;
  const canSubmit = note.trim().length > 0 || selected.length > 0;

  const toggleImage = (url: string) =>
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));

  return (
    <Dialog open={!!action} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Yêu cầu agent sửa</DialogTitle>
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

          <Alert severity="info">
            Lệnh chưa chạy. Agent nhận ghi chú của bạn, sửa đúng phần đó rồi gửi lại phiếu mới để
            bạn duyệt.
            {revisionsLeft !== null && (
              <>
                {' '}
                <strong>Còn {revisionsLeft} lần yêu cầu sửa</strong> cho việc này.
              </>
            )}
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography
              variant="caption"
              component="div"
              sx={{ color: 'text.secondary', mb: 0.75 }}
            >
              Chọn nhanh
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {REVISION_QUICK_NOTES.map((text) => (
                <Chip
                  key={text}
                  label={text}
                  size="small"
                  variant="outlined"
                  icon={<Iconify icon="mingcute:add-line" width={14} />}
                  onClick={() => setNote((prev) => appendNote(prev, text))}
                  disabled={submitting}
                />
              ))}
            </Stack>
          </Box>

          <TextField
            label="Cần sửa gì?"
            placeholder="Vd: Ảnh 2 tối quá, chụp lại nền trắng; caption bỏ bớt hashtag"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 500 }}
            disabled={submitting}
            autoFocus
            fullWidth
          />

          {images.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                component="div"
                sx={{ color: 'text.secondary', mb: 0.75 }}
              >
                Ảnh cần làm lại (bấm để chọn)
                {selected.length > 0 ? ` — đã chọn ${selected.length}` : ''}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                }}
              >
                {images.map((url, i) => {
                  const checked = selected.includes(url);
                  return (
                    <ButtonBase
                      key={`${url}-${i}`}
                      onClick={() => toggleImage(url)}
                      disabled={submitting}
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Ảnh ${i + 1}`}
                      sx={{
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        bgcolor: 'background.neutral',
                        outline: (theme) =>
                          checked
                            ? `3px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                        outlineOffset: checked ? -3 : -1,
                      }}
                    >
                      <Box
                        component="img"
                        src={url}
                        alt={`Ảnh ${i + 1}`}
                        loading="lazy"
                        sx={{
                          width: 1,
                          height: 1,
                          objectFit: 'cover',
                          opacity: checked ? 0.75 : 1,
                        }}
                      />
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          p: 0.25,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          pointerEvents: 'none',
                          '&:hover': { bgcolor: 'background.paper' },
                        }}
                      />
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={submitting}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onSubmit({ note, imageUrls: selected })}
          startIcon={<Iconify icon="solar:pen-bold" />}
        >
          Gửi yêu cầu sửa
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
