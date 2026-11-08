'use client';

import type { ImageResult, ImageAnalysis } from 'src/lib/image-ai';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useResponsive } from 'src/hooks/use-responsive';

import { getStorageUrl } from 'src/utils/storage';
import { apiErrorMessage } from 'src/utils/api-error';

import { defaultPreset } from 'src/lib/image-ai';
import {
  useProductImages,
  saveProductImages,
  frameProductImage,
  uploadProductImage,
  analyzeProductImage,
  generateProductImage,
  useProductImageCatalog,
} from 'src/api/product-images';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ImageFigure } from 'src/components/image-ai/image-figure';
import { AiPresetPicker } from 'src/components/image-ai/ai-preset-picker';

import { move, append, remove, sameOrder, makePrimary, MAX_PRODUCT_IMAGES } from './gallery';

// ----------------------------------------------------------------------
// Ảnh sản phẩm (phục vụ bán online, storefront /product/[id]):
// - Bộ ảnh: ảnh đầu là ảnh chính; đặt ảnh chính, đổi thứ tự, xoá; thêm bằng tải lên hoặc chụp (điện thoại mở camera).
// - Tạo ảnh từ một ảnh nguồn (bấm ảnh trong bộ — kể cả ảnh KiotViet): "Giữ nguyên" ghép nền không qua AI (mặc định an
//   toàn) hoặc "AI tạo ảnh" 1–3 ảnh (studio / ảnh thực tế theo cách dùng của đúng món; đồ nhạy cảm → manocanh).
//   So sánh trước / sau, tích ảnh muốn giữ rồi thêm vào bộ ảnh.
// - Mô tả bán online (trống = dùng mô tả KiotViet). Chỉ ghi vào sản phẩm khi bấm Lưu.

type Mode = 'keep' | 'ai';

type Props = {
  productId: string;
  aiEnabled?: boolean;
  onClose: () => void;
  /** Bộ ảnh vừa lưu (ảnh đầu = ảnh chính). */
  onSaved?: (images: string[]) => void;
};

export function ProductImagesDialog({ productId, aiEnabled = true, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const smUp = useResponsive('up', 'sm');
  const { data, error: loadError, mutate } = useProductImages(productId);
  const catalog = useProductImageCatalog(productId);

  const [gallery, setGallery] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('keep');
  const [background, setBackground] = useState('white');
  const [aspect, setAspect] = useState<'square' | 'portrait'>('square');
  const [analyses, setAnalyses] = useState<Record<string, ImageAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [count, setCount] = useState(2);
  const [running, setRunning] = useState(0);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [viewing, setViewing] = useState<ImageResult | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Nạp bộ ảnh đang lưu một lần khi mở.
  const loaded = useRef(false);
  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    setGallery(data.images);
    setDescription(data.onlineDescription ?? '');
    setSource(data.images[0] ?? null);
  }, [data]);

  const analysis = source ? (analyses[source] ?? null) : null;
  const dirty =
    !!data &&
    (!sameOrder(gallery, data.images) ||
      description.trim() !== (data.onlineDescription ?? '').trim());

  const analyze = async (url = source) => {
    if (!url) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeProductImage(productId, url);
      setAnalyses((prev) => ({ ...prev, [url]: result }));
      setPreset(defaultPreset(result.presets));
      setTags([]);
    } catch (err) {
      setError(apiErrorMessage(err, 'AI chưa đọc được ảnh — thử lại sau ít phút'));
    } finally {
      setAnalyzing(false);
    }
  };

  // Chuyển sang AI hoặc đổi ảnh nguồn: tự phân tích nếu ảnh đó chưa phân tích.
  useEffect(() => {
    if (mode !== 'ai' || !source) return;
    const known = analyses[source];
    if (known) setPreset(defaultPreset(known.presets));
    else if (!analyzing) analyze(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const added: string[] = [];
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const file of Array.from(files)) {
        // eslint-disable-next-line no-await-in-loop
        added.push(await uploadProductImage(productId, file));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Tải ảnh lên thất bại'));
    } finally {
      setUploading(false);
    }
    if (added.length === 0) return;
    const next = append(gallery, added);
    setGallery(next.urls);
    setSource(added[0]);
    if (next.dropped > 0)
      enqueueSnackbar(`Bộ ảnh tối đa ${MAX_PRODUCT_IMAGES} ảnh — bỏ ${next.dropped} ảnh`, {
        variant: 'warning',
      });
  };

  const handleRun = async () => {
    if (!source) return;
    if (mode === 'ai' && !preset) {
      setError('Chọn một kiểu ảnh');
      return;
    }
    setError(null);
    const n = mode === 'ai' ? count : 1;
    setRunning(n);
    const jobs = Array.from({ length: n }, () =>
      mode === 'keep'
        ? frameProductImage(productId, { sourceUrl: source, background, aspect })
        : generateProductImage(productId, {
            sourceUrl: source,
            preset: preset!,
            tags: tags.length > 0 ? tags : undefined,
            note: note.trim() || undefined,
          })
    ).map((job) =>
      job.then((r) => {
        setResults((prev) => [r, ...prev]);
        setViewing(r);
        setPicked((prev) => [...prev, r.url]);
        return r;
      })
    );
    const settled = await Promise.allSettled(jobs);
    setRunning(0);
    const failed = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      setError(
        apiErrorMessage(
          failed[0].reason,
          mode === 'ai' ? 'AI chưa vẽ được ảnh — thử lại sau ít phút' : 'Chưa tạo được ảnh'
        ) + (failed.length < n ? ` (${n - failed.length}/${n} ảnh xong)` : '')
      );
    }
  };

  const addPicked = () => {
    const toAdd = results
      .map((r) => r.url)
      .filter((u) => picked.includes(u) && !gallery.includes(u))
      .reverse();
    const next = append(gallery, toAdd);
    setGallery(next.urls);
    setPicked([]);
    if (next.dropped > 0)
      enqueueSnackbar(`Bộ ảnh tối đa ${MAX_PRODUCT_IMAGES} ảnh — bỏ ${next.dropped} ảnh`, {
        variant: 'warning',
      });
    else enqueueSnackbar(`Đã thêm ${toAdd.length} ảnh vào bộ ảnh — bấm Lưu để cập nhật sản phẩm`);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProductImages(productId, {
        urls: sameOrder(gallery, data.images) ? undefined : gallery,
        onlineDescription: description.trim(),
      });
      await mutate(saved, { revalidate: false });
      enqueueSnackbar('Đã lưu ảnh sản phẩm');
      onSaved?.(saved.images);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Chưa lưu được ảnh sản phẩm'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (running || saving) return;
    // eslint-disable-next-line no-alert
    if (dirty && !window.confirm('Bộ ảnh / mô tả chưa lưu. Đóng và bỏ thay đổi?')) return;
    onClose();
  };

  const busy = running > 0 || uploading || saving;
  const pickedNew = picked.filter((u) => !gallery.includes(u));

  return (
    <Dialog open fullWidth maxWidth="lg" fullScreen={!smUp} onClose={handleClose}>
      <DialogTitle>
        Ảnh sản phẩm{data ? ` — ${data.name}` : ''}
        {data && (
          <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
            {data.code}
            {data.kiotVietLinked &&
              (data.imagesCustomized
                ? ' · Bộ ảnh đang tự quản trên hệ thống (đồng bộ KiotViet không thay ảnh)'
                : ' · Ảnh đang lấy từ KiotViet — lưu bộ ảnh ở đây thì đồng bộ KiotViet sẽ không thay nữa')}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loadError && (
          <Alert severity="error">
            {apiErrorMessage(loadError, 'Không tải được ảnh sản phẩm')}
          </Alert>
        )}
        {!data && !loadError && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {data && (
          <Stack spacing={3}>
            {/* ---------- Bộ ảnh ---------- */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Bộ ảnh ({gallery.length}/{MAX_PRODUCT_IMAGES})
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}
              >
                Ảnh đầu tiên là ảnh chính. Bấm một ảnh để dùng làm ảnh nguồn tạo ảnh mới.
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {gallery.map((url, index) => (
                  <GalleryTile
                    key={url}
                    url={url}
                    index={index}
                    last={index === gallery.length - 1}
                    isSource={url === source}
                    disabled={busy}
                    onSelect={() => setSource(url)}
                    onPrimary={() => setGallery((g) => makePrimary(g, url))}
                    onMove={(delta) => setGallery((g) => move(g, url, delta))}
                    onRemove={() => {
                      setGallery((g) => remove(g, url));
                      if (source === url) setSource(gallery.find((u) => u !== url) ?? null);
                    }}
                  />
                ))}
                <AddTile
                  icon="solar:upload-bold-duotone"
                  label="Tải ảnh lên"
                  loading={uploading}
                  disabled={busy || gallery.length >= MAX_PRODUCT_IMAGES}
                  onClick={() => uploadRef.current?.click()}
                />
                <AddTile
                  icon="solar:camera-bold-duotone"
                  label="Chụp ảnh"
                  disabled={busy || gallery.length >= MAX_PRODUCT_IMAGES}
                  onClick={() => cameraRef.current?.click()}
                />
              </Stack>
              <input
                ref={uploadRef}
                hidden
                multiple
                type="file"
                accept="image/jpeg,image/png,image/webp"
                data-testid="product-image-upload"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraRef}
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                data-testid="product-image-camera"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </Box>

            {/* ---------- Tạo ảnh mới ---------- */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                Tạo ảnh mới từ ảnh nguồn
              </Typography>
              {!source ? (
                <Alert severity="info">
                  Sản phẩm chưa có ảnh — tải ảnh lên hoặc chụp ảnh trước.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={mode}
                    disabled={busy}
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
                      AI tạo ảnh
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {mode === 'keep' ? (
                    <Stack spacing={1.5}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Ảnh gốc chỉ được thu phóng rồi đặt lên nền màu, không vẽ lại — đúng 100% sản
                        phẩm.
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
                                border: (t) =>
                                  `2px solid ${background === b.id ? t.palette.primary.main : t.palette.divider}`,
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={aspect}
                        onChange={(_, v) => v && setAspect(v)}
                      >
                        <ToggleButton value="square">Vuông 1:1</ToggleButton>
                        <ToggleButton value="portrait">Dọc 4:5</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      <AiPresetPicker
                        analysis={analysis}
                        analyzing={analyzing}
                        onAnalyze={() => analyze()}
                        preset={preset}
                        onPreset={setPreset}
                        tags={tags}
                        onTags={setTags}
                        note={note}
                        onNote={setNote}
                        maxNoteLength={catalog?.maxNoteLength}
                        disabled={busy}
                      />
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="body2">Số ảnh</Typography>
                        <ToggleButtonGroup
                          exclusive
                          size="small"
                          value={count}
                          disabled={busy}
                          onChange={(_, v: number | null) => v && setCount(v)}
                        >
                          {[1, 2, 3].map((n) => (
                            <ToggleButton key={n} value={n} aria-label={`${n} ảnh`}>
                              {n}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </Stack>
                    </Stack>
                  )}

                  {error && <Alert severity="error">{error}</Alert>}

                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr' } }}>
                    <ImageFigure title="Ảnh gốc" url={getStorageUrl(source)} />
                    <ImageFigure
                      title={viewing ? `Ảnh mới — ${viewing.label}` : 'Ảnh mới'}
                      url={viewing?.url ?? null}
                      loading={running > 0}
                      loadingText={
                        mode === 'ai' ? `AI đang vẽ ${running} ảnh… (10–60 giây)` : 'Đang ghép nền…'
                      }
                    />
                  </Box>

                  {viewing && viewing.style !== 'frame' && (
                    <Alert severity="warning">
                      AI vẽ lại nên có thể lệch chi tiết nhỏ (hình dáng, màu, chữ in). So kỹ với ảnh
                      gốc — chỉ tích những ảnh đúng sản phẩm.
                    </Alert>
                  )}

                  {results.length > 0 && (
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                        {results.map((r) => {
                          const inGallery = gallery.includes(r.url);
                          return (
                            <Box key={r.url} sx={{ position: 'relative', flexShrink: 0 }}>
                              <ButtonBase
                                onClick={() => setViewing(r)}
                                aria-label={`Xem ${r.label}`}
                                sx={{
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  outline: (t) =>
                                    viewing?.url === r.url
                                      ? `2px solid ${t.palette.primary.main}`
                                      : 'none',
                                }}
                              >
                                <Box
                                  component="img"
                                  src={r.url}
                                  alt=""
                                  sx={{ width: 88, height: 88, objectFit: 'cover' }}
                                />
                              </ButtonBase>
                              <Checkbox
                                size="small"
                                disabled={inGallery}
                                checked={inGallery || picked.includes(r.url)}
                                inputProps={{ 'aria-label': `Chọn ${r.label}` }}
                                onChange={(e) =>
                                  setPicked((prev) =>
                                    e.target.checked
                                      ? [...prev, r.url]
                                      : prev.filter((u) => u !== r.url)
                                  )
                                }
                                sx={{
                                  position: 'absolute',
                                  top: -6,
                                  right: -6,
                                  bgcolor: 'background.paper',
                                  p: 0.25,
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                      <Box>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Iconify icon="mingcute:add-line" />}
                          disabled={busy || pickedNew.length === 0}
                          onClick={addPicked}
                        >
                          Thêm {pickedNew.length || ''} ảnh đã chọn vào bộ ảnh
                        </Button>
                      </Box>
                    </Stack>
                  )}
                </Stack>
              )}
            </Box>

            {/* ---------- Mô tả bán online ---------- */}
            <TextField
              multiline
              minRows={3}
              label="Mô tả bán online"
              helperText={
                data.description
                  ? 'Để trống thì trang bán online dùng mô tả KiotViet.'
                  : 'Hiện trên trang sản phẩm của cửa hàng online.'
              }
              placeholder={data.description ?? 'Chất liệu, kích thước, cách dùng…'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              inputProps={{ maxLength: 4000 }}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={running > 0 || saving}>
          Đóng
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {source && (
          <LoadingButton
            variant="outlined"
            loading={running > 0}
            disabled={uploading || saving || (mode === 'ai' && (analyzing || !analysis))}
            onClick={handleRun}
          >
            {mode === 'ai' ? `Tạo ${count} ảnh` : 'Ghép nền'}
          </LoadingButton>
        )}
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!dirty || running > 0 || uploading}
          onClick={handleSave}
        >
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function GalleryTile({
  url,
  index,
  last,
  isSource,
  disabled,
  onSelect,
  onPrimary,
  onMove,
  onRemove,
}: {
  url: string;
  index: number;
  last: boolean;
  isSource: boolean;
  disabled: boolean;
  onSelect: () => void;
  onPrimary: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <Stack spacing={0.5} sx={{ width: 112 }}>
      <ButtonBase
        onClick={onSelect}
        aria-label={`Ảnh ${index + 1}${isSource ? ' (ảnh nguồn)' : ''}`}
        aria-pressed={isSource}
        sx={{
          position: 'relative',
          width: 112,
          height: 112,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.neutral',
          outline: (t) =>
            isSource ? `3px solid ${t.palette.primary.main}` : `1px solid ${t.palette.divider}`,
        }}
      >
        <Box
          component="img"
          src={getStorageUrl(url)}
          alt=""
          sx={{ width: 1, height: 1, objectFit: 'cover' }}
        />
        {index === 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: 4,
              top: 4,
              px: 0.75,
              borderRadius: 0.5,
              typography: 'caption',
              fontWeight: 700,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            Ảnh chính
          </Box>
        )}
      </ButtonBase>
      <Stack direction="row" justifyContent="space-between">
        <Tooltip title="Đặt làm ảnh chính">
          <span>
            <IconButton
              size="small"
              aria-label="Đặt làm ảnh chính"
              disabled={disabled || index === 0}
              onClick={onPrimary}
            >
              <Iconify icon="solar:star-bold" width={16} />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton
          size="small"
          aria-label="Lên trước"
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        >
          <Iconify icon="eva:arrow-ios-back-fill" width={16} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Ra sau"
          disabled={disabled || last}
          onClick={() => onMove(1)}
        >
          <Iconify icon="eva:arrow-ios-forward-fill" width={16} />
        </IconButton>
        <IconButton
          size="small"
          color="error"
          aria-label="Xoá ảnh"
          disabled={disabled}
          onClick={onRemove}
        >
          <Iconify icon="solar:trash-bin-trash-bold" width={16} />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function AddTile({
  icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled || loading}
      sx={{
        width: 112,
        height: 112,
        borderRadius: 1,
        border: (t) => `1px dashed ${t.palette.divider}`,
        flexDirection: 'column',
        gap: 0.5,
        color: 'text.secondary',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? <CircularProgress size={24} /> : <Iconify icon={icon} width={28} />}
      <Typography variant="caption">{label}</Typography>
    </ButtonBase>
  );
}
