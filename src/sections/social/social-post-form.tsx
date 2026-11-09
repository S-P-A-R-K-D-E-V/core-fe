'use client';

import type { StorefrontProduct, StorefrontProductPage } from 'src/lib/tenant-branding';
import type { SocialPost, SocialPostMode, SocialPostInput } from 'src/lib/social';

import useSWR from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import ToggleButton from '@mui/material/ToggleButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fetcher } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';
import { fDateTime, toDatetimeLocalStr, parseDatetimeLocalStr } from 'src/utils/format-time';

import { useDebounce } from 'src/hooks/use-debounce';

import { storefrontProductListKey } from 'src/api/product-keys';
import { countLinks, SOCIAL_TEXT_MAX, SOCIAL_MAX_LINKS, SOCIAL_MAX_IMAGES, SOCIAL_MAX_PRODUCTS } from 'src/lib/social';
import {
  useSocialAi,
  useSocialQueue,
  createSocialPost,
  updateSocialPost,
  useSocialChannels,
  uploadSocialImage,
  writeSocialCaption,
} from 'src/api/social';

import Iconify from 'src/components/iconify';
import { Upload } from 'src/components/upload';
import { useSnackbar } from 'src/components/snackbar';
import { AppDateTimePicker } from 'src/components/date-time-picker';

import { SocialImageStudioDialog } from './social-image-studio-dialog';

// ----------------------------------------------------------------------
// Soạn bài bán hàng: AI viết nháp từ sản phẩm (kèm ảnh + link sản phẩm), chữ ≤ 500, ≤ 10 ảnh JPEG/PNG, chọn kênh,
// lưu nháp / hẹn giờ / đăng ngay. Đăng thật do worker của core-be làm (vài giây với "Đăng ngay").

const MAX_FILE_BYTES = 8 * 1024 * 1024;

type Props = { post?: SocialPost | null };

function defaultScheduleStr() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toDatetimeLocalStr(d);
}

export function SocialPostForm({ post }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { channels, loading: channelsLoading } = useSocialChannels();
  const ai = useSocialAi();

  const [text, setText] = useState(post?.text ?? '');
  const [images, setImages] = useState<string[]>(post?.imageUrls ?? []);
  const [channelIds, setChannelIds] = useState<string[]>(post?.targets.map((t) => t.channelId) ?? []);
  // Mở từ ô trống trên Lịch đăng: ?at=<ISO> → hẹn đúng giờ đó.
  const searchParams = useSearchParams();
  const presetAt = post ? null : searchParams.get('at');
  const presetDate = presetAt && !Number.isNaN(Date.parse(presetAt)) ? new Date(presetAt) : null;
  const { queue } = useSocialQueue();
  const [mode, setMode] = useState<Exclude<SocialPostMode, 'draft'>>(() => {
    if (presetDate) return 'schedule';
    if (post?.status === 'scheduled') return post.queued ? 'queue' : 'schedule';
    return 'now';
  });
  const [schedule, setSchedule] = useState(() => {
    if (presetDate) return toDatetimeLocalStr(presetDate);
    return post?.scheduledAt ? toDatetimeLocalStr(new Date(post.scheduledAt)) : defaultScheduleStr();
  });
  // Bài đang ở hàng đợi giữ chỗ cũ khi sửa; bài mới nhận khung trống kế tiếp.
  const keptQueueSlot =
    post?.queued && post.scheduledAt && Date.parse(post.scheduledAt) > Date.now() + 10 * 60 * 1000 ? post.scheduledAt : null;
  const nextQueueSlot = keptQueueSlot ?? queue?.nextSlots[0] ?? null;
  // Sản phẩm của bài (gửi lên máy chủ). Bài cũ chỉ có productId.
  const [productIds, setProductIds] = useState<string[]>(
    post?.productIds?.length ? post.productIds : post?.productId ? [post.productId] : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<SocialPostMode | null>(null);

  // AI
  // Sản phẩm đang chọn trong ô tìm (đủ tên, giá, ảnh) — đổi ô này thì productIds đổi theo.
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const debouncedQuery = useDebounce(productQuery, 400);
  const { data: productPage } = useSWR<StorefrontProductPage>(
    storefrontProductListKey({ keyword: debouncedQuery || undefined, page: 1, pageSize: 10 }),
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );
  const [brief, setBrief] = useState('');
  const [writing, setWriting] = useState(false);
  // Studio ảnh: ảnh đang mở để tạo ảnh mới từ nó.
  const [studioUrl, setStudioUrl] = useState<string | null>(null);

  const connected = channels.filter((c) => c.status === 'connected');
  const links = countLinks(text);
  const tooLong = text.length > SOCIAL_TEXT_MAX;
  const tooManyLinks = links > SOCIAL_MAX_LINKS;

  // Bài mới: chọn sẵn mọi kênh đang kết nối.
  const [preselected, setPreselected] = useState(!!post);
  if (!preselected && !channelsLoading) {
    setPreselected(true);
    setChannelIds(connected.map((c) => c.id));
  }

  const handleWrite = async () => {
    if (products.length === 0 && !brief.trim()) {
      enqueueSnackbar('Chọn sản phẩm hoặc gõ vài ý muốn nói', { variant: 'warning' });
      return;
    }
    setWriting(true);
    try {
      const result = await writeSocialCaption({ productIds: products.map((p) => p.id), brief: brief.trim() });
      setText(result.text);
      if (products.length > 0) setProductIds(products.map((p) => p.id));
      if (images.length === 0 && result.imageUrls.length > 0)
        setImages(result.imageUrls.filter((u) => u.startsWith('https://')).slice(0, SOCIAL_MAX_IMAGES));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'AI chưa viết được, thử lại sau ít phút'), { variant: 'error' });
    } finally {
      setWriting(false);
    }
  };

  const handleDrop = async (files: File[]) => {
    const room = SOCIAL_MAX_IMAGES - images.length;
    if (room <= 0) {
      enqueueSnackbar(`Tối đa ${SOCIAL_MAX_IMAGES} ảnh`, { variant: 'warning' });
      return;
    }
    const valid = files.slice(0, room).filter((f) => {
      if (!/^image\/(jpeg|png)$/.test(f.type)) {
        enqueueSnackbar(`${f.name}: Threads chỉ nhận ảnh JPEG hoặc PNG`, { variant: 'warning' });
        return false;
      }
      if (f.size > MAX_FILE_BYTES) {
        enqueueSnackbar(`${f.name}: ảnh quá 8 MB`, { variant: 'warning' });
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const f of valid) {
        // eslint-disable-next-line no-await-in-loop
        urls.push(await uploadSocialImage(f));
      }
      setImages((prev) => [...prev, ...urls].slice(0, SOCIAL_MAX_IMAGES));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tải ảnh lên thất bại'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // Ảnh đầu của từng sản phẩm đang chọn (chưa có trong bài).
  const productImages = products.map((p) => p.imageUrl).filter((u): u is string => !!u && !images.includes(u));
  const addProductImages = () => {
    setProductIds(products.map((p) => p.id));
    setImages((prev) => Array.from(new Set([...prev, ...productImages])).slice(0, SOCIAL_MAX_IMAGES));
  };

  const handleProductsChange = (value: StorefrontProduct[]) => {
    const next = value.slice(0, SOCIAL_MAX_PRODUCTS);
    setProducts(next);
    setProductIds(next.map((p) => p.id));
  };

  // Studio kiểm ảnh nguồn thuộc sản phẩm nào: ảnh khớp ảnh đại diện của sản phẩm nào thì gửi sản phẩm đó.
  const studioProductId =
    (studioUrl && products.find((p) => p.imageUrl === studioUrl)?.id) || productIds[0] || null;

  const addStudioImage = (url: string) =>
    setImages((prev) => (prev.includes(url) ? prev : [...prev, url].slice(0, SOCIAL_MAX_IMAGES)));

  const replaceStudioImage = (source: string, url: string) =>
    setImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== source) : prev.map((u) => (u === source ? url : u))));

  const moveImage = (index: number, delta: number) => {
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const submit = async (submitMode: SocialPostMode) => {
    if (submitMode !== 'draft' && channelIds.length === 0) {
      enqueueSnackbar('Chọn ít nhất một kênh để đăng', { variant: 'warning' });
      return;
    }
    let scheduledAt: string | null = null;
    if (submitMode === 'schedule') {
      const d = parseDatetimeLocalStr(schedule);
      if (!d || d.getTime() < Date.now()) {
        enqueueSnackbar('Giờ đăng phải ở tương lai', { variant: 'warning' });
        return;
      }
      scheduledAt = d.toISOString();
    }
    const input: SocialPostInput = {
      text,
      imageUrls: images,
      channelIds,
      mode: submitMode,
      scheduledAt,
      productId: productIds[0] ?? null,
      productIds,
    };
    setSaving(submitMode);
    try {
      const saved = post ? await updateSocialPost(post.id, input) : await createSocialPost(input);
      const messages: Record<SocialPostMode, string> = {
        draft: 'Đã lưu nháp',
        now: 'Đang đăng — vài giây nữa bài sẽ lên',
        schedule: 'Đã hẹn giờ đăng',
        queue: saved?.scheduledAt ? `Đã thêm vào hàng đợi — đăng lúc ${fDateTime(saved.scheduledAt)}` : 'Đã thêm vào hàng đợi',
      };
      enqueueSnackbar(messages[submitMode]);
      router.push(paths.dashboard.social.root);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu bài thất bại'), { variant: 'error' });
      setSaving(null);
    }
  };

  const busy = !!saving || uploading || writing;
  const empty = text.trim().length === 0 && images.length === 0;

  return (
    <Stack spacing={3}>
      {ai?.enabled && (
        <Card>
          <CardHeader
            title="AI viết giúp"
            subheader={`Chọn 1–${SOCIAL_MAX_PRODUCTS} sản phẩm (AI lấy tên, giá, mô tả, ảnh và gắn link sản phẩm) hoặc gõ vài ý muốn nói.`}
          />
          <Stack spacing={2} sx={{ p: 3 }}>
            <Autocomplete
              multiple
              options={productPage?.items ?? []}
              value={products}
              onChange={(_, v) => handleProductsChange(v)}
              getOptionDisabled={(o) => products.length >= SOCIAL_MAX_PRODUCTS && !products.some((p) => p.id === o.id)}
              filterSelectedOptions
              limitTags={3}
              inputValue={productQuery}
              onInputChange={(_, v) => setProductQuery(v)}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {o.imageUrl ? (
                      <Box component="img" src={o.imageUrl} alt="" sx={{ width: 36, height: 36, borderRadius: 0.5, objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: 36, height: 36 }} />
                    )}
                    <Box>
                      <Typography variant="body2">{o.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {o.price.toLocaleString('vi-VN')}đ{o.inStock ? '' : ' · hết hàng'}
                      </Typography>
                    </Box>
                  </Stack>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sản phẩm (đang bán online)"
                  placeholder={products.length >= SOCIAL_MAX_PRODUCTS ? '' : 'Gõ tên sản phẩm…'}
                  helperText={
                    products.length === 0 && productIds.length > 0
                      ? `Bài đang gắn ${productIds.length} sản phẩm — chọn lại nếu muốn AI viết theo sản phẩm khác.`
                      : products.length > 1
                        ? `AI viết một bài cho ${products.length} sản phẩm, gắn link ${Math.min(products.length, 3)} sản phẩm đầu.`
                        : undefined
                  }
                />
              )}
            />
            <TextField
              label="Ý muốn nói thêm"
              placeholder="VD: dịp 20/11, quà tặng cô giáo; giọng vui, ngắn"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              {productImages.length > 0 && (
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={busy || images.length >= SOCIAL_MAX_IMAGES}
                  startIcon={<Iconify icon="solar:gallery-add-bold-duotone" />}
                  onClick={addProductImages}
                >
                  {productImages.length > 1 ? `Dùng ${productImages.length} ảnh sản phẩm` : 'Dùng ảnh sản phẩm'}
                </Button>
              )}
              <LoadingButton
                variant="soft"
                color="primary"
                loading={writing}
                disabled={busy && !writing}
                startIcon={<Iconify icon="solar:magic-stick-3-bold-duotone" />}
                onClick={handleWrite}
              >
                {text ? 'Viết lại' : 'Viết bài'}
              </LoadingButton>
            </Stack>
          </Stack>
        </Card>
      )}

      <Card>
        <CardHeader title="Nội dung" />
        <Stack spacing={2} sx={{ p: 3 }}>
          <TextField
            label="Nội dung bài"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={6}
            error={tooLong || tooManyLinks}
            helperText={
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <span>
                  {tooManyLinks
                    ? `Threads cho tối đa ${SOCIAL_MAX_LINKS} link (đang có ${links})`
                    : 'Viết tự nhiên, ít "bán" — người dùng Threads không thích quảng cáo lộ liễu.'}
                </span>
                <span>
                  {text.length}/{SOCIAL_TEXT_MAX}
                </span>
              </Box>
            }
          />

          <Typography variant="subtitle2">
            Ảnh ({images.length}/{SOCIAL_MAX_IMAGES}) — 2 ảnh trở lên thành bài nhiều ảnh (carousel)
          </Typography>
          {images.length > 0 && (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {images.map((url, i) => (
                <Box key={url} sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', aspectRatio: '1' }}>
                  <Box component="img" src={url} alt="" sx={{ width: 1, height: 1, objectFit: 'cover' }} />
                  <IconButton
                    size="small"
                    onClick={() => setStudioUrl(url)}
                    aria-label="Studio ảnh: tạo ảnh mới từ ảnh này"
                    title="Tạo ảnh mới từ ảnh này (đổi nền, cài lên tóc…)"
                    sx={{ position: 'absolute', top: 4, left: 4, color: 'common.white', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                  >
                    <Iconify icon="solar:magic-stick-3-bold" width={16} />
                  </IconButton>
                  <Stack
                    direction="row"
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1 }}
                  >
                    {i > 0 && (
                      <IconButton size="small" sx={{ color: 'common.white' }} onClick={() => moveImage(i, -1)} aria-label="Đưa lên trước">
                        <Iconify icon="eva:arrow-back-fill" width={16} />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      sx={{ color: 'common.white' }}
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      aria-label="Bỏ ảnh"
                    >
                      <Iconify icon="mingcute:close-line" width={16} />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
          {images.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Bấm <Iconify icon="solar:magic-stick-3-bold" width={14} sx={{ verticalAlign: 'middle' }} /> trên ảnh để tạo ảnh
              mới: đặt lên nền màu (giữ nguyên sản phẩm) hoặc AI vẽ lại (đổi nền, cài lên tóc).
            </Typography>
          )}
          {images.length < SOCIAL_MAX_IMAGES && (
            <Upload
              multiple
              accept={{ 'image/jpeg': [], 'image/png': [] }}
              disabled={uploading}
              placeholder={uploading ? 'Đang tải ảnh…' : undefined}
              onDrop={handleDrop}
              sx={{ '& > div': { py: 3 } }}
            />
          )}
        </Stack>
      </Card>

      <Card>
        <CardHeader title="Đăng lên" />
        <Stack spacing={2} sx={{ p: 3 }}>
          {!channelsLoading && channels.length === 0 && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.social.channels}>
                  Kết nối kênh
                </Button>
              }
            >
              Chưa có kênh nào — vẫn lưu nháp được.
            </Alert>
          )}
          <FormGroup row>
            {channels.map((c) => (
              <FormControlLabel
                key={c.id}
                disabled={c.status !== 'connected'}
                control={
                  <Checkbox
                    checked={channelIds.includes(c.id)}
                    onChange={(e) =>
                      setChannelIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                    }
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Iconify icon="ri:threads-fill" width={16} />
                    <span>@{c.username}</span>
                    {c.status !== 'connected' && (
                      <Typography variant="caption" sx={{ color: 'warning.main' }}>
                        (cần kết nối lại)
                      </Typography>
                    )}
                  </Stack>
                }
              />
            ))}
          </FormGroup>

          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
            <ToggleButton value="now">Đăng ngay</ToggleButton>
            <ToggleButton value="queue">Hàng đợi</ToggleButton>
            <ToggleButton value="schedule">Hẹn giờ</ToggleButton>
          </ToggleButtonGroup>
          {mode === 'queue' && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {nextQueueSlot
                ? `Bài sẽ đăng lúc ${fDateTime(nextQueueSlot)}${keptQueueSlot ? ' (giữ chỗ cũ trong hàng đợi)' : ' — khung giờ trống kế tiếp'}.`
                : 'Hàng đợi đã kín — thêm khung giờ ở trang Lịch đăng.'}{' '}
              <Link component={RouterLink} href={paths.dashboard.social.calendar}>
                Sửa khung giờ
              </Link>
            </Typography>
          )}
          {mode === 'schedule' && (
            <AppDateTimePicker
              label="Giờ đăng"
              value={schedule}
              onChange={setSchedule}
              minDateTime={toDatetimeLocalStr(new Date())}
              sx={{ maxWidth: 280 }}
            />
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Gợi ý: 1–2 bài mỗi ngày mỗi kênh, cách nhau vài giờ — đăng dày dễ bị Threads giảm hiển thị.
          </Typography>
        </Stack>
      </Card>

      {studioUrl && (
        <SocialImageStudioDialog
          sourceUrl={studioUrl}
          productId={studioProductId}
          aiEnabled={!!ai?.enabled}
          canAdd={images.length < SOCIAL_MAX_IMAGES}
          onClose={() => setStudioUrl(null)}
          onAdd={addStudioImage}
          onReplace={(url) => replaceStudioImage(studioUrl, url)}
        />
      )}

      <Stack direction="row" spacing={1.5} justifyContent="flex-end">
        <Button component={RouterLink} href={paths.dashboard.social.root} color="inherit" disabled={!!saving}>
          Huỷ
        </Button>
        <LoadingButton
          variant="outlined"
          loading={saving === 'draft'}
          disabled={busy || empty || tooLong || tooManyLinks}
          onClick={() => submit('draft')}
        >
          Lưu nháp
        </LoadingButton>
        <LoadingButton
          variant="contained"
          loading={saving === mode}
          disabled={busy || empty || tooLong || tooManyLinks || channelIds.length === 0}
          startIcon={
            <Iconify
              icon={mode === 'now' ? 'solar:plain-bold' : mode === 'queue' ? 'solar:list-check-bold' : 'solar:calendar-bold'}
            />
          }
          onClick={() => submit(mode)}
        >
          {{ now: 'Đăng bài', queue: 'Thêm vào hàng đợi', schedule: 'Hẹn giờ đăng' }[mode]}
        </LoadingButton>
      </Stack>
    </Stack>
  );
}
