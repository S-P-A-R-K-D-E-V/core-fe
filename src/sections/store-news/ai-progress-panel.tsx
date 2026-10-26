'use client';

import type { AiProgress } from 'src/api/store-posts-stream';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

/** Chữ thuần từ HTML đang viết dở (bỏ thẻ, kể cả thẻ chưa đóng ở cuối). */
function plain(html: string) {
  return html
    .replace(/<[^>]*>?/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bản nháp viết theo nhãn (TITLE: / SUMMARY: / … / CONTENT:) — tách ra để hiện từng phần khi đang viết. */
export function parseDraftText(text: string) {
  const field = (name: string) => text.match(new RegExp(`^\\**${name}\\**\\s*:\\s*\\**(.*)$`, 'mi'))?.[1]?.trim() ?? '';
  const contentAt = text.search(/^\**CONTENT\**\s*:/im);
  return {
    title: field('TITLE'),
    summary: field('SUMMARY'),
    content: contentAt >= 0 ? text.slice(contentAt).replace(/^\**CONTENT\**\s*:/i, '') : '',
  };
}

type Props = {
  progress: AiProgress;
  /** "draft": tách tiêu đề / mô tả / nội dung đang viết; "text": chữ thường; "none": chỉ các bước. */
  preview?: 'draft' | 'text' | 'none';
  onCancel?: () => void;
};

/**
 * Tiến trình của một lệnh AI: các bước (đã xong / đang làm), suy nghĩ của model nếu model có gửi, và chữ AI đang viết hiện
 * dần — thay cho vòng xoay đứng yên.
 */
export function AiProgressPanel({ progress, preview = 'text', onCancel }: Props) {
  const [showThinking, setShowThinking] = useState(false);
  const { busy, steps, thinking, text, error } = progress;
  if (!busy && !error && steps.length === 0) return null;

  const draft = preview === 'draft' ? parseDraftText(text) : null;
  const live = draft ? plain(draft.content) : plain(text);

  return (
    <Stack spacing={1.5} sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.neutral' }}>
      <Stack spacing={0.75}>
        {steps.map((step, i) => {
          const current = busy && !step.done && i === steps.length - 1;
          return (
            <Stack key={`${step.key}-${i}`} direction="row" alignItems="center" spacing={1}>
              {current ? (
                <CircularProgress size={16} thickness={5} />
              ) : (
                <Iconify
                  icon={error && i === steps.length - 1 ? 'solar:close-circle-bold' : 'solar:check-circle-bold'}
                  width={18}
                  sx={{ color: error && i === steps.length - 1 ? 'error.main' : 'success.main' }}
                />
              )}
              <Typography variant="body2" sx={{ fontWeight: current ? 600 : 400 }}>
                {step.text}
                {current && step.key === 'write' && live && (
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                    {` — ${live.length.toLocaleString('vi-VN')} ký tự`}
                  </Box>
                )}
              </Typography>
            </Stack>
          );
        })}
        {busy && steps.length === 0 && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={16} thickness={5} />
            <Typography variant="body2">Đang gửi yêu cầu…</Typography>
          </Stack>
        )}
      </Stack>

      {thinking && (
        <Box>
          <Button
            size="small"
            color="inherit"
            onClick={() => setShowThinking((v) => !v)}
            startIcon={<Iconify icon="solar:lightbulb-minimalistic-bold" />}
            endIcon={<Iconify icon={showThinking ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />}
            sx={{ color: 'text.secondary' }}
          >
            {busy && !text ? 'AI đang suy nghĩ…' : 'Suy nghĩ của AI'}
          </Button>
          <Collapse in={showThinking}>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                m: 0,
                mt: 0.5,
                p: 1.5,
                maxHeight: 160,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                color: 'text.secondary',
                borderLeft: (theme) => `3px solid ${theme.palette.divider}`,
              }}
            >
              {thinking.slice(-2000)}
            </Typography>
          </Collapse>
        </Box>
      )}

      {preview !== 'none' && (draft?.title || live) && (
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper' }}>
          {draft?.title && (
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              {draft.title}
            </Typography>
          )}
          {draft?.summary && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              {draft.summary}
            </Typography>
          )}
          {live && (
            <Typography variant="body2" sx={{ color: 'text.secondary', maxHeight: 140, overflow: 'hidden' }}>
              {live.length > 600 ? `…${live.slice(-600)}` : live}
              {busy && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.25,
                    width: 8,
                    height: 16,
                    display: 'inline-block',
                    verticalAlign: 'text-bottom',
                    bgcolor: 'primary.main',
                    animation: 'aiCaret 1s steps(1) infinite',
                    '@keyframes aiCaret': { '50%': { opacity: 0 } },
                  }}
                />
              )}
            </Typography>
          )}
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {busy && onCancel && (
        <Box>
          <Button size="small" color="inherit" onClick={onCancel}>
            Dừng
          </Button>
        </Box>
      )}
    </Stack>
  );
}
