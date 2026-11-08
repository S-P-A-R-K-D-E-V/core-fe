'use client';

import type { SocialImageResult } from 'src/lib/social';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { apiErrorMessage } from 'src/utils/api-error';

import { frameSocialImage, generateSocialImage, useSocialImageCatalog } from 'src/api/social';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Studio ảnh: tạo ảnh mới cho bài đăng từ một ảnh sản phẩm có sẵn.
// - "Giữ nguyên sản phẩm" (mặc định): ảnh gốc chỉ thu phóng rồi đặt lên nền màu — không qua AI, đúng 100% sản phẩm.
// - "AI vẽ lại": ảnh gốc gửi kèm cho model sửa ảnh (đổi nền, bối cảnh, cài lên tóc vài dáng). Model có thể vẽ lệch chi
//   tiết nên luôn hiện ảnh gốc cạnh ảnh mới để so sánh trước khi gắn vào bài.

type Mode = 'keep' | 'ai';

type Props = {
  sourceUrl: string;
  productId: string | null;
  aiEnabled: boolean;
  /** Bài còn chỗ thêm ảnh không (tối đa 10). */
  canAdd: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
  onReplace: (url: string) => void;
};

export function SocialImageStudioDialog({ sourceUrl, productId, aiEnabled, canAdd, onClose, onAdd, onReplace }: Props) {
  const catalog = useSocialImageCatalog();
  const [mode, setMode] = useState<Mode>('keep');
  const [background, setBackground] = useState('pink');
  const [aspect, setAspect] = useState<'square' | 'portrait'>('square');
  const [style, setStyle] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SocialImageResult[]>([]);
  const [selected, setSelected] = useState<SocialImageResult | null>(null);
  const [used, setUsed] = useState<string[]>([]);

  const styles = catalog?.items ?? [];
  const groups = [
    { id: 'product', label: 'Ảnh sản phẩm' },
    { id: 'hair', label: 'Cài lên tóc' },
  ] as const;

  const handleRun = async () => {
    if (mode === 'ai' && !style) {
      setError('Chọn một kiểu ảnh');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const result =
        mode === 'keep'
          ? await frameSocialImage({ sourceUrl, productId, background, aspect })
          : await generateSocialImage({ sourceUrl, productId, style: style!, note: note.trim() || undefined });
      setResults((prev) => [result, ...prev]);
      setSelected(result);
    } catch (err) {
      setError(apiErrorMessage(err, mode === 'ai' ? 'AI chưa vẽ được ảnh — thử lại sau ít phút' : 'Chưa tạo được ảnh'));
    } finally {
      setRunning(false);
    }
  };

  const isAi = selected ? selected.style !== 'frame' : mode === 'ai';

  return (
    <Dialog open fullWidth maxWidth="md" onClose={running ? undefined : onClose}>
      <DialogTitle>Studio ảnh</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={mode}
            onChange={(_, v: Mode | null) => {
              if (!v) return;
              setMode(v);
              setError(null);
            }}
          >
            <ToggleButton value="keep">
              <Iconify icon="solar:shield-check-bold-duotone" width={18} sx={{ mr: 1 }} />
              Giữ nguyên sản phẩm
            </ToggleButton>
            <ToggleButton value="ai" disabled={!aiEnabled}>
              <Iconify icon="solar:magic-stick-3-bold-duotone" width={18} sx={{ mr: 1 }} />
              AI vẽ lại
            </ToggleButton>
          </ToggleButtonGroup>

          {mode === 'keep' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ảnh gốc chỉ được thu phóng rồi đặt lên nền màu, không vẽ lại — đúng 100% sản phẩm.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(catalog?.backgrounds ?? []).map((b) => (
                  <Tooltip key={b.id} title={b.label}>
                    <ButtonBase
                      aria-label={`Nền ${b.label}`}
                      aria-pressed={background === b.id}
                      onClick={() => setBackground(b.id)}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: b.color,
                        border: (t) => `2px solid ${background === b.id ? t.palette.primary.main : t.palette.divider}`,
                      }}
                    />
                  </Tooltip>
                ))}
              </Stack>
              <ToggleButtonGroup exclusive size="small" value={aspect} onChange={(_, v) => v && setAspect(v)}>
                <ToggleButton value="square">Vuông 1:1</ToggleButton>
                <ToggleButton value="portrait">Dọc 4:5</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {groups.map((g) => (
                <Box key={g.id}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {g.label}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {styles
                      .filter((s) => s.group === g.id)
                      .map((s) => (
                        <Tooltip key={s.id} title={s.hint}>
                          <Chip
                            label={s.label}
                            color={style === s.id ? 'primary' : 'default'}
                            variant={style === s.id ? 'filled' : 'outlined'}
                            onClick={() => setStyle(s.id)}
                          />
                        </Tooltip>
                      ))}
                  </Stack>
                </Box>
              ))}
              <TextField
                size="small"
                label="Ghi chú cho AI (không bắt buộc)"
                placeholder="VD: dùng chiếc kẹp màu hồng; tóc nâu"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                inputProps={{ maxLength: catalog?.maxNoteLength ?? 200 }}
              />
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Figure title="Ảnh gốc" url={sourceUrl} />
            <Figure
              title={selected ? `Ảnh mới — ${selected.label}` : 'Ảnh mới'}
              url={selected?.url ?? null}
              loading={running}
              loadingText={mode === 'ai' ? 'AI đang vẽ… (10–40 giây)' : 'Đang ghép nền…'}
            />
          </Box>

          {selected && isAi && (
            <Alert severity="warning">
              AI vẽ lại nên có thể lệch chi tiết nhỏ (hình dáng, số răng lược, màu, chữ in). So kỹ với ảnh gốc — sai thì
              tạo lại hoặc dùng &quot;Giữ nguyên sản phẩm&quot;.
            </Alert>
          )}

          {results.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {results.map((r) => (
                <ButtonBase
                  key={r.url}
                  onClick={() => setSelected(r)}
                  aria-label={`Xem ${r.label}`}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 1,
                    overflow: 'hidden',
                    outline: (t) => (selected?.url === r.url ? `2px solid ${t.palette.primary.main}` : 'none'),
                  }}
                >
                  <Box component="img" src={r.url} alt="" sx={{ width: 64, height: 64, objectFit: 'cover' }} />
                </ButtonBase>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={running}>
          Đóng
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {selected && (
          <>
            <Button
              variant="outlined"
              disabled={running || used.includes(selected.url)}
              onClick={() => {
                onReplace(selected.url);
                onClose();
              }}
            >
              Thay ảnh gốc
            </Button>
            <Button
              variant="outlined"
              disabled={running || !canAdd || used.includes(selected.url)}
              onClick={() => {
                onAdd(selected.url);
                setUsed((prev) => [...prev, selected.url]);
              }}
            >
              {used.includes(selected.url) ? 'Đã thêm' : 'Thêm vào bài'}
            </Button>
          </>
        )}
        <LoadingButton variant="contained" loading={running} onClick={handleRun}>
          {results.length > 0 ? 'Tạo ảnh khác' : 'Tạo ảnh'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function Figure({
  title,
  url,
  loading,
  loadingText,
}: {
  title: string;
  url: string | null;
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '1',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.neutral',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url && <Box component="img" src={url} alt={title} sx={{ width: 1, height: 1, objectFit: 'contain' }} />}
        {loading && (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.7)' }}
          >
            <CircularProgress size={28} />
            <Typography variant="caption">{loadingText}</Typography>
          </Stack>
        )}
        {!url && !loading && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Chưa có
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
