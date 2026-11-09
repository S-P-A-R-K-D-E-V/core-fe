'use client';

import type { ImageAnalysis } from 'src/lib/image-ai';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { toggleTag, MAX_IMAGE_TAGS, IMAGE_PRESET_GROUPS } from 'src/lib/image-ai';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Bộ chọn gợi ý AI dùng chung (Studio ảnh bài đăng + trang ảnh sản phẩm): kết quả phân tích ảnh (loại hàng, đồ nhạy
// cảm → manocanh), gợi ý studio / cách dùng hợp đúng món, tag prompt bấm chọn và ghi chú.

type Props = {
  analysis: ImageAnalysis | null;
  analyzing: boolean;
  onAnalyze: () => void;
  preset: string | null;
  onPreset: (id: string) => void;
  tags: string[];
  onTags: (ids: string[]) => void;
  note: string;
  onNote: (note: string) => void;
  maxNoteLength?: number;
  disabled?: boolean;
};

export function AiPresetPicker({
  analysis,
  analyzing,
  onAnalyze,
  preset,
  onPreset,
  tags,
  onTags,
  note,
  onNote,
  maxNoteLength = 200,
  disabled,
}: Props) {
  if (analyzing && !analysis) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          AI đang xem ảnh để gợi ý cách chụp hợp với sản phẩm… (5–30 giây)
        </Typography>
      </Stack>
    );
  }

  if (!analysis) {
    return (
      <Button
        variant="outlined"
        startIcon={<Iconify icon="solar:eye-scan-bold-duotone" />}
        onClick={onAnalyze}
        disabled={disabled}
      >
        Phân tích ảnh để gợi ý
      </Button>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          color="info"
          variant="soft"
          icon={<Iconify icon="solar:tag-bold" width={16} />}
          label={analysis.category}
        />
        {analysis.sensitive && (
          <Chip
            size="small"
            color="warning"
            variant="soft"
            label="Đồ nhạy cảm — dựng trên manocanh, không dùng người thật"
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" color="inherit" onClick={onAnalyze} disabled={disabled || analyzing}>
          {analyzing ? 'Đang phân tích…' : 'Phân tích lại'}
        </Button>
      </Stack>

      {analysis.fallback && (
        <Alert severity="info" sx={{ py: 0 }}>
          AI chưa đọc được ảnh lúc này — dùng tạm các gợi ý chung, hoặc bấm &quot;Phân tích
          lại&quot; sau ít phút.
        </Alert>
      )}

      {IMAGE_PRESET_GROUPS.map((g) => {
        const items = analysis.presets.filter((p) => p.group === g.id);
        if (items.length === 0) return null;
        return (
          <Box key={g.id}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {g.label}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {items.map((p) => (
                <Tooltip key={p.id} title={p.hint}>
                  <Chip
                    label={p.label}
                    disabled={disabled}
                    color={preset === p.id ? 'primary' : 'default'}
                    variant={preset === p.id ? 'filled' : 'outlined'}
                    onClick={() => onPreset(p.id)}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>
        );
      })}

      {analysis.tags.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tag cho ảnh chuyên nghiệp hơn{' '}
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
              (tối đa {MAX_IMAGE_TAGS})
            </Typography>
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {analysis.tags.map((t) => {
              const on = tags.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  size="small"
                  label={t.label}
                  disabled={disabled}
                  color={on ? 'secondary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  icon={on ? <Iconify icon="eva:checkmark-fill" width={14} /> : undefined}
                  onClick={() => onTags(toggleTag(tags, t.id))}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      <TextField
        size="small"
        label="Prompt thêm cho AI (không bắt buộc)"
        placeholder="VD: dùng chiếc kẹp màu hồng; tóc nâu; nền xanh mint"
        value={note}
        disabled={disabled}
        onChange={(e) => onNote(e.target.value)}
        inputProps={{ maxLength: maxNoteLength }}
      />
    </Stack>
  );
}
