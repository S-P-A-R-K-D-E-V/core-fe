'use client';

import type { StorePostImage, StorePostImageCandidate } from 'src/api/store-posts';

import useSWR from 'swr';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useDebounce } from 'src/hooks/use-debounce';

import { fetcher } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { Upload } from 'src/components/upload';

import { useAiStream } from 'src/api/store-posts-stream';
import { mapStorefrontProduct } from 'src/api/product';
import { searchStorePostImages, importStorePostImage, uploadStorePostImage } from 'src/api/store-posts';

import { AiProgressPanel } from './ai-progress-panel';

// ----------------------------------------------------------------------

export type PickedImage = StorePostImage & { alt: string };

export type ImagePickerTab = 'ai' | 'web' | 'products' | 'upload';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (image: PickedImage) => void;
  /** Ảnh bìa (mặc định khung ngang) hay ảnh trong bài. */
  purpose: 'cover' | 'inline';
  /** Gợi ý sẵn cho ô mô tả / tìm kiếm (vd tiêu đề bài, đoạn đang bôi đen). */
  suggestion?: string;
  /** Tab mở sẵn (nút "Tạo bằng AI" / "Tìm trên web"… cạnh ảnh bìa). */
  initialTab?: ImagePickerTab;
  /** Cửa hàng có trợ lý AI — không có thì ẩn tab tạo ảnh. */
  aiEnabled?: boolean;
};

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "Ảnh: <a href=link>tên nguồn</a>" cho ảnh dán link — core-be lọc lại trước khi lưu. */
function linkCredit(name: string, link: string) {
  const label = escape(name.trim() || (() => { try { return new URL(link).hostname; } catch { return 'nguồn'; } })());
  return /^https?:\/\//i.test(link.trim())
    ? `Ảnh: <a href="${escape(link.trim())}" target="_blank" rel="noopener">${label}</a>`
    : `Ảnh: ${label}`;
}

/**
 * Chọn ảnh cho bài: AI tạo ảnh (có tiến trình), tìm ảnh web có giấy phép dùng thương mại (Openverse / Pexels — tự ghi
 * nguồn), ảnh sản phẩm của cửa hàng, hoặc tải lên / dán link (kèm nguồn nếu ảnh của người khác).
 */
export function StoreNewsImagePicker({
  open,
  onClose,
  onPick,
  purpose,
  suggestion = '',
  initialTab,
  aiEnabled = true,
}: Props) {
  const [tab, setTab] = useState<ImagePickerTab>('ai');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'landscape' | 'square' | 'portrait'>('landscape');
  const [generated, setGenerated] = useState<StorePostImage | null>(null);
  const ai = useAiStream();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StorePostImageCandidate[] | null>(null);
  const [searchedAs, setSearchedAs] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [webError, setWebError] = useState('');

  const [productQuery, setProductQuery] = useState('');
  const debouncedProductQuery = useDebounce(productQuery, 400);
  const productKey =
    open && tab === 'products'
      ? `/public/storefront/products?pageSize=24&sort=newest${debouncedProductQuery ? `&q=${encodeURIComponent(debouncedProductQuery)}` : ''}`
      : null;
  const { data: productPage, isLoading: productsLoading } = useSWR(productKey, fetcher, { keepPreviousData: true });
  const products = ((productPage?.items as any[]) ?? []).map(mapStorefrontProduct).filter((p) => p.images.length > 0);

  const [link, setLink] = useState('');
  const [linkSource, setLinkSource] = useState('');
  const [linkSourceUrl, setLinkSourceUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab(initialTab && (initialTab !== 'ai' || aiEnabled) ? initialTab : aiEnabled ? 'ai' : 'web');
    setPrompt(suggestion);
    setQuery(suggestion);
    setAspect(purpose === 'cover' ? 'landscape' : 'square');
    setGenerated(null);
    setResults(null);
    ai.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    ai.cancel();
    onClose();
  };

  const pick = (image: PickedImage) => {
    onPick(image);
    close();
  };

  const generate = async () => {
    setGenerated(null);
    const result = await ai.run<StorePostImage>('images/generate/stream', { prompt, aspect });
    if (result) setGenerated(result);
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setWebError('');
    try {
      const data = await searchStorePostImages(query.trim());
      setResults(data.items);
      setSearchedAs(data.query);
    } catch (err) {
      setWebError(apiErrorMessage(err, 'Chưa tìm được ảnh — thử lại'));
    } finally {
      setSearching(false);
    }
  };

  const importImage = async (item: StorePostImageCandidate) => {
    setImporting(`${item.provider}:${item.id}`);
    setWebError('');
    try {
      const image = await importStorePostImage(item.provider, item.id);
      pick({ ...image, alt: item.title ?? query });
    } catch (err) {
      setWebError(apiErrorMessage(err, 'Không lấy được ảnh này — chọn ảnh khác'));
    } finally {
      setImporting(null);
    }
  };

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('Ảnh phải là JPEG / PNG / WebP / GIF, tối đa 5 MB');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      pick({ url: await uploadStorePostImage(file), creditHtml: null, alt: file.name.replace(/\.[^.]+$/, '') });
    } catch (err) {
      setUploadError(apiErrorMessage(err, 'Tải ảnh lên thất bại'));
    } finally {
      setUploading(false);
    }
  };

  const linkValid = /^https:\/\/\S+$/i.test(link.trim());

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>{purpose === 'cover' ? 'Chọn ảnh bìa' : 'Chèn ảnh vào bài'}</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {aiEnabled && (
          <Tab value="ai" label="Tạo bằng AI" icon={<Iconify icon="solar:magic-stick-3-bold" width={18} />} iconPosition="start" />
        )}
        <Tab value="web" label="Tìm trên web" icon={<Iconify icon="solar:global-bold" width={18} />} iconPosition="start" />
        <Tab value="products" label="Ảnh sản phẩm" icon={<Iconify icon="solar:bag-4-bold" width={18} />} iconPosition="start" />
        <Tab value="upload" label="Tải lên / dán link" icon={<Iconify icon="solar:upload-bold" width={18} />} iconPosition="start" />
      </Tabs>

      <DialogContent sx={{ pt: 3, minHeight: 420 }}>
        {tab === 'ai' && (
          <Stack spacing={2}>
            <TextField
              label="Mô tả ảnh muốn tạo"
              placeholder="VD: bờm tóc ngọc trai trên nền vải lụa hồng, ánh sáng tự nhiên"
              multiline
              minRows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={aspect}
                onChange={(_, v) => v && setAspect(v)}
              >
                <ToggleButton value="landscape">Ngang</ToggleButton>
                <ToggleButton value="square">Vuông</ToggleButton>
                <ToggleButton value="portrait">Dọc</ToggleButton>
              </ToggleButtonGroup>
              <LoadingButton
                variant="contained"
                loading={ai.progress.busy}
                disabled={!prompt.trim()}
                onClick={generate}
                startIcon={<Iconify icon="solar:magic-stick-3-bold" />}
              >
                {generated ? 'Tạo ảnh khác' : 'Tạo ảnh'}
              </LoadingButton>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Mỗi ảnh mất khoảng 10–30 giây; ảnh ghi chú &quot;tạo bằng AI&quot;.
              </Typography>
            </Stack>
            <AiProgressPanel progress={ai.progress} preview="none" onCancel={ai.cancel} />
            {generated && (
              <Stack spacing={1.5} alignItems="flex-start">
                <Box
                  component="img"
                  src={generated.url}
                  alt=""
                  sx={{ maxWidth: 1, maxHeight: 360, borderRadius: 1.5, objectFit: 'contain' }}
                />
                <Button variant="contained" onClick={() => pick({ ...generated, alt: prompt.trim() })}>
                  Dùng ảnh này
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        {tab === 'web' && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5}>
              <TextField
                fullWidth
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
                placeholder="Từ khoá ảnh, vd: kẹp tóc, quà Giáng Sinh…"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <LoadingButton variant="contained" loading={searching} onClick={search} sx={{ flexShrink: 0 }}>
                Tìm
              </LoadingButton>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Chỉ hiện ảnh có giấy phép cho phép dùng thương mại (Openverse
              {results && searchedAs !== query.trim() ? ` — đã tìm với "${searchedAs}"` : ''}). Chọn ảnh thì ảnh được
              chép về kho của cửa hàng và tự ghi tác giả, nguồn, giấy phép dưới ảnh.
            </Typography>
            {webError && <Alert severity="error">{webError}</Alert>}
            {results && results.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Không có ảnh phù hợp — thử từ khoá khác (tiếng Anh thường nhiều ảnh hơn).
              </Typography>
            )}
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' } }}>
              {(results ?? []).map((item) => {
                const key = `${item.provider}:${item.id}`;
                return (
                  <ButtonBase
                    key={key}
                    onClick={() => importImage(item)}
                    disabled={!!importing}
                    sx={{ display: 'block', textAlign: 'left', borderRadius: 1.5, overflow: 'hidden', position: 'relative' }}
                  >
                    <Box
                      component="img"
                      src={item.thumbnailUrl}
                      alt={item.title ?? ''}
                      loading="lazy"
                      sx={{ width: 1, aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', bgcolor: 'background.neutral' }}
                    />
                    <Typography variant="caption" noWrap sx={{ display: 'block', px: 1, py: 0.5, color: 'text.secondary' }}>
                      {[item.creator, item.license].filter(Boolean).join(' · ') || item.provider}
                    </Typography>
                    {importing === key && (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.7)' }}
                      >
                        <CircularProgress size={28} />
                      </Stack>
                    )}
                  </ButtonBase>
                );
              })}
            </Box>
          </Stack>
        )}

        {tab === 'products' && (
          <Stack spacing={2}>
            <TextField
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Tìm sản phẩm của cửa hàng…"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
            {productsLoading && products.length === 0 && <CircularProgress size={24} />}
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' } }}>
              {products.flatMap((p) =>
                p.images.slice(0, 2).map((src) => (
                  <ButtonBase
                    key={`${p.id}-${src}`}
                    onClick={() => pick({ url: src, creditHtml: null, alt: p.name })}
                    sx={{ display: 'block', textAlign: 'left', borderRadius: 1.5, overflow: 'hidden' }}
                  >
                    <Box
                      component="img"
                      src={src}
                      alt={p.name}
                      loading="lazy"
                      sx={{ width: 1, aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                    />
                    <Typography variant="caption" noWrap sx={{ display: 'block', px: 1, py: 0.5 }}>
                      {p.name}
                    </Typography>
                  </ButtonBase>
                ))
              )}
            </Box>
            {!productsLoading && products.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Không có sản phẩm có ảnh.
              </Typography>
            )}
          </Stack>
        )}

        {tab === 'upload' && (
          <Stack spacing={3}>
            <Upload
              accept={{ 'image/*': [] }}
              disabled={uploading}
              placeholder={uploading ? 'Đang tải ảnh…' : undefined}
              onDrop={(files) => files[0] && upload(files[0])}
            />
            {uploadError && <Alert severity="error">{uploadError}</Alert>}
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Hoặc dán link ảnh</Typography>
              <TextField
                label="Link ảnh (https://…)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                error={!!link && !linkValid}
                helperText={link && !linkValid ? 'Link phải bắt đầu bằng https://' : undefined}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="Tên nguồn / tác giả"
                  placeholder="VD: Unsplash — Nguyễn A"
                  value={linkSource}
                  onChange={(e) => setLinkSource(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Link trang nguồn"
                  placeholder="https://…"
                  value={linkSourceUrl}
                  onChange={(e) => setLinkSourceUrl(e.target.value)}
                  fullWidth
                />
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Ảnh của người khác: ghi nguồn và chỉ dùng khi giấy phép cho phép. Ảnh dán link được hiển thị từ trang
                gốc (trang gốc xoá ảnh thì bài mất ảnh) — nên tải ảnh lên nếu có thể.
              </Typography>
              <Box>
                <Button
                  variant="contained"
                  disabled={!linkValid}
                  onClick={() =>
                    pick({
                      url: link.trim(),
                      alt: linkSource.trim(),
                      creditHtml: linkSource.trim() || linkSourceUrl.trim() ? linkCredit(linkSource, linkSourceUrl || link) : null,
                    })
                  }
                >
                  Dùng link này
                </Button>
              </Box>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={close}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
