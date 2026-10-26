'use client';

import type { StorePostDetail } from 'src/lib/store-posts';
import type { NewsEditorImage } from 'src/components/news-editor';
import type { PickedImage, ImagePickerTab } from './store-news-image-picker';
import type { StorePostSeo, StorePostDraft, StorePostInput } from 'src/api/store-posts';

import { z } from 'zod';
import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Switch from '@mui/material/Switch';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { apiErrorMessage } from 'src/utils/api-error';

import { Upload } from 'src/components/upload';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { NewsEditor } from 'src/components/news-editor';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

import { useAiStream } from 'src/api/store-posts-stream';
import {
  createStorePost,
  updateStorePost,
  useStorePostAi,
  uploadStorePostImage,
} from 'src/api/store-posts';

import { NewsContent } from 'src/sections/news/news-content';

import { AiProgressPanel } from './ai-progress-panel';
import { StoreNewsAiDialog } from './store-news-ai-dialog';
import { StoreNewsImagePicker } from './store-news-image-picker';

// ----------------------------------------------------------------------

// Giới hạn = cột của core-be (StorePost).
const Schema = z.object({
  title: z.string().trim().min(1, 'Nhập tiêu đề bài').max(200, 'Tiêu đề tối đa 200 ký tự'),
  slug: z.string().max(200, 'Đường dẫn tối đa 200 ký tự'),
  summary: z.string().max(500, 'Mô tả ngắn tối đa 500 ký tự'),
  contentHtml: z.string(),
  coverUrl: z.string(),
  // Dòng ghi nguồn của ảnh bìa (HTML đã lọc) — ảnh lấy từ web / dán link của người khác.
  coverCredit: z.string(),
  tags: z.array(z.string()).max(10, 'Tối đa 10 thẻ'),
  metaTitle: z.string().max(70, 'Tiêu đề SEO tối đa 70 ký tự'),
  metaDescription: z.string().max(300, 'Mô tả SEO tối đa 300 ký tự'),
  metaKeywords: z.string().max(300, 'Từ khoá tối đa 300 ký tự'),
  publish: z.boolean(),
});

type FormValues = z.infer<typeof Schema>;

const AI_ACTIONS = [
  { key: 'improve', label: 'Hay hơn', icon: 'solar:stars-bold' },
  { key: 'shorten', label: 'Ngắn lại', icon: 'solar:minimize-square-bold' },
  { key: 'expand', label: 'Dài hơn', icon: 'solar:maximize-square-bold' },
  { key: 'friendly', label: 'Thân thiện', icon: 'solar:smile-circle-bold' },
  { key: 'professional', label: 'Chuyên nghiệp', icon: 'solar:case-round-bold' },
  { key: 'fix', label: 'Sửa chính tả', icon: 'solar:check-read-bold' },
];

function toValues(post?: StorePostDetail): FormValues {
  return {
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    summary: post?.summary ?? '',
    contentHtml: post?.contentHtml ?? '',
    coverUrl: post?.coverUrl ?? '',
    coverCredit: post?.coverCredit ?? '',
    tags: post?.tags ?? [],
    metaTitle: post?.metaTitle ?? '',
    metaDescription: post?.metaDescription ?? '',
    metaKeywords: post?.metaKeywords ?? '',
    publish: post?.status === 'published',
  };
}

function toInput(v: FormValues): StorePostInput {
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  return {
    title: v.title.trim(),
    slug: orNull(v.slug),
    summary: orNull(v.summary),
    contentHtml: v.contentHtml,
    coverUrl: orNull(v.coverUrl),
    coverCredit: v.coverUrl.trim() ? orNull(v.coverCredit) : null,
    tags: v.tags,
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    metaKeywords: orNull(v.metaKeywords),
    publish: v.publish,
  };
}

function SectionCard({
  title,
  subheader,
  children,
}: {
  title: string;
  subheader: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader
        title={title}
        subheader={subheader}
        action={
          <IconButton onClick={() => setOpen((v) => !v)} aria-label={open ? 'Thu gọn' : 'Mở rộng'}>
            <Iconify icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />
          </IconButton>
        }
        sx={{ mb: 3 }}
      />
      <Collapse in={open}>
        <Divider />
        <Stack spacing={3} sx={{ p: 3 }}>
          {children}
        </Stack>
      </Collapse>
    </Card>
  );
}

const COVER_SOURCES: { tab: ImagePickerTab; label: string; icon: string; ai?: boolean }[] = [
  { tab: 'ai', label: 'Tạo bằng AI', icon: 'solar:magic-stick-3-bold', ai: true },
  { tab: 'web', label: 'Tìm trên web', icon: 'solar:global-bold' },
  { tab: 'products', label: 'Ảnh sản phẩm', icon: 'solar:bag-4-bold' },
  { tab: 'upload', label: 'Dán link', icon: 'solar:link-bold' },
];

/** Bước đang làm + số ký tự AI đã viết — dòng nhỏ dưới menu AI của trình soạn. */
function aiStatusLine(progress: { steps: { text: string }[]; text: string }) {
  const step = progress.steps[progress.steps.length - 1]?.text ?? 'Đang gửi yêu cầu…';
  const chars = progress.text.replace(/<[^>]*>?/g, '').length;
  return chars ? `${step} — ${chars.toLocaleString('vi-VN')} ký tự` : `${step}…`;
}

type PickerState = { purpose: 'cover' | 'inline'; tab?: ImagePickerTab; suggestion: string };

type Props = { post?: StorePostDetail };

/** Soạn / sửa bài tin tức (bố cục form của template Minimal v6) — có trợ lý AI viết nháp, sửa đoạn chọn, gợi ý SEO. */
export function StoreNewsForm({ post }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const ai = useStorePostAi();
  const [aiOpen, setAiOpen] = useState(false);
  const rewriteAi = useAiStream();
  const seoAi = useAiStream();
  const [preview, setPreview] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Ảnh chèn trong bài: trình soạn chờ Promise này tới khi chọn xong / đóng hộp.
  const pickResolve = useRef<((image: NewsEditorImage | null) => void) | null>(null);

  const methods = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: toValues(post),
  });
  const {
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const values = watch();

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = post
        ? await updateStorePost(post.id, toInput(v))
        : await createStorePost(toInput(v));
      enqueueSnackbar(v.publish ? 'Đã lưu và đăng bài' : 'Đã lưu bản nháp');
      if (!post) router.replace(paths.dashboard.news.edit(saved.id));
      else methods.reset(toValues(saved));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu bài thất bại'), { variant: 'error' });
    }
  });

  const applyDraft = async (draft: StorePostDraft) => {
    const hasContent = !!getValues('title').trim() || !!getValues('contentHtml').trim();
    if (
      hasContent &&
      !(await confirm({ content: 'Thay tiêu đề, mô tả và nội dung đang có bằng bản nháp của AI?' }))
    )
      return;
    setValue('title', draft.title, { shouldDirty: true });
    setValue('summary', draft.summary, { shouldDirty: true });
    setValue('contentHtml', draft.contentHtml, { shouldDirty: true });
    if (draft.tags.length) setValue('tags', draft.tags, { shouldDirty: true });
    if (draft.metaTitle) setValue('metaTitle', draft.metaTitle, { shouldDirty: true });
    if (draft.metaDescription)
      setValue('metaDescription', draft.metaDescription, { shouldDirty: true });
    enqueueSnackbar('Đã đổ bản nháp vào bài — xem lại trước khi đăng');
  };

  const suggestSeo = async () => {
    const seo = await seoAi.run<StorePostSeo>('ai/seo/stream', {
      title: getValues('title'),
      contentHtml: getValues('contentHtml'),
    });
    if (!seo) return;
    setValue('metaTitle', seo.metaTitle, { shouldDirty: true });
    setValue('metaDescription', seo.metaDescription, { shouldDirty: true });
    setValue('metaKeywords', seo.metaKeywords, { shouldDirty: true });
    if (!getValues('slug').trim() && seo.slug) setValue('slug', seo.slug, { shouldDirty: true });
    if (!getValues('summary').trim() && seo.summary)
      setValue('summary', seo.summary, { shouldDirty: true });
    seoAi.reset();
  };

  const rewrite = async (html: string, action: string) => {
    const result = await rewriteAi.run<{ html: string }>('ai/rewrite/stream', { html, action }, true);
    if (!result) throw new Error('Đã dừng AI');
    return result.html;
  };

  const pickInlineImage = (selected: string) =>
    new Promise<NewsEditorImage | null>((resolve) => {
      pickResolve.current = resolve;
      setPicker({ purpose: 'inline', suggestion: selected || getValues('title') });
    });

  const onImagePicked = (image: PickedImage) => {
    if (picker?.purpose === 'cover') {
      setValue('coverUrl', image.url, { shouldDirty: true });
      setValue('coverCredit', image.creditHtml ?? '', { shouldDirty: true });
    } else {
      pickResolve.current?.(image);
      pickResolve.current = null;
    }
  };

  const closePicker = () => {
    pickResolve.current?.(null);
    pickResolve.current = null;
    setPicker(null);
  };

  const uploadCover = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      enqueueSnackbar('Ảnh bìa phải là JPEG / PNG / WebP / GIF, tối đa 5 MB', { variant: 'error' });
      return;
    }
    setCoverUploading(true);
    try {
      setValue('coverUrl', await uploadStorePostImage(file), { shouldDirty: true });
      setValue('coverCredit', '', { shouldDirty: true });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tải ảnh bìa thất bại'), { variant: 'error' });
    } finally {
      setCoverUploading(false);
    }
  };

  const aiEnabled = !!ai?.enabled;
  const counter = (text: string, max: number) => `${text.length}/${max} ký tự`;

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={{ xs: 3, md: 5 }} sx={{ mx: 'auto', maxWidth: { xs: 720, xl: 880 } }}>
        {aiEnabled && (
          <Card
            sx={{
              p: 2.5,
              display: 'flex',
              gap: 2,
              alignItems: { sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              bgcolor: 'primary.lighter',
              color: 'primary.darker',
            }}
          >
            <Iconify icon="solar:magic-stick-3-bold-duotone" width={40} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1">Trợ lý AI viết bài</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Gợi ý chủ đề, viết nháp có giới thiệu sản phẩm của cửa hàng. Bôi đen đoạn văn trong
                bài để AI viết lại.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => setAiOpen(true)}
              startIcon={<Iconify icon="solar:pen-new-square-bold" />}
            >
              Viết bằng AI
            </Button>
          </Card>
        )}

        <SectionCard title="Nội dung" subheader="Tiêu đề, mô tả ngắn, nội dung bài và ảnh bìa">
          <RHFTextField name="title" label="Tiêu đề bài" />
          <RHFTextField
            name="summary"
            label="Mô tả ngắn"
            multiline
            minRows={2}
            helperText={`${counter(values.summary, 500)} — hiện ở danh sách bài; để trống thì lấy đoạn đầu của bài`}
          />
          <Stack spacing={1}>
            <Typography variant="subtitle2">Nội dung</Typography>
            <Controller
              name="contentHtml"
              control={control}
              render={({ field }) => (
                <NewsEditor
                  value={field.value}
                  onChange={field.onChange}
                  onUploadImage={uploadStorePostImage}
                  onPickImage={pickInlineImage}
                  aiActions={aiEnabled ? AI_ACTIONS : undefined}
                  onAiRewrite={rewrite}
                  aiStatus={aiStatusLine(rewriteAi.progress)}
                  onError={(message) => enqueueSnackbar(message, { variant: 'error' })}
                />
              )}
            />
          </Stack>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                Ảnh bìa
              </Typography>
              {COVER_SOURCES.filter((s) => !s.ai || aiEnabled).map((s) => (
                <Button
                  key={s.tab}
                  size="small"
                  variant="soft"
                  color={s.ai ? 'primary' : 'inherit'}
                  startIcon={<Iconify icon={s.icon} width={16} />}
                  onClick={() => setPicker({ purpose: 'cover', tab: s.tab, suggestion: values.title })}
                >
                  {s.label}
                </Button>
              ))}
            </Stack>
            <Upload
              accept={{ 'image/*': [] }}
              file={values.coverUrl || null}
              disabled={coverUploading}
              placeholder={coverUploading ? 'Đang tải ảnh…' : undefined}
              onDrop={(files) => files[0] && uploadCover(files[0])}
              onDelete={() => {
                setValue('coverUrl', '', { shouldDirty: true });
                setValue('coverCredit', '', { shouldDirty: true });
              }}
            />
            {values.coverUrl && values.coverCredit && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', '& a': { color: 'inherit' } }}
                // Dòng ghi nguồn do core-be tạo (đã lọc) hoặc do hộp chọn ảnh dựng (đã escape).
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: values.coverCredit }}
              />
            )}
          </Stack>
        </SectionCard>

        <SectionCard
          title="Thuộc tính & SEO"
          subheader="Thẻ, đường dẫn, tiêu đề và mô tả trên Google"
        >
          <Controller
            name="tags"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={field.value}
                onChange={(_, v) =>
                  field.onChange((v as string[]).map((t) => t.trim()).filter(Boolean))
                }
                renderTags={(value, getTagProps) =>
                  value.map((tag, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={tag}
                      size="small"
                      color="info"
                      variant="soft"
                      label={tag}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Thẻ"
                    placeholder="Gõ rồi Enter"
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ?? 'Khách bấm thẻ để xem các bài cùng chủ đề'
                    }
                  />
                )}
              />
            )}
          />
          <RHFTextField
            name="slug"
            label="Đường dẫn"
            placeholder="tự tạo từ tiêu đề"
            helperText="Chữ thường không dấu, nối bằng gạch ngang; để trống thì tạo từ tiêu đề"
            InputProps={{
              startAdornment: <InputAdornment position="start">/tin-tuc/</InputAdornment>,
            }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">Hiển thị trên Google</Typography>
            {aiEnabled && (
              <LoadingButton
                size="small"
                variant="soft"
                color="primary"
                loading={seoAi.progress.busy}
                onClick={suggestSeo}
                startIcon={<Iconify icon="solar:magic-stick-3-bold" />}
              >
                AI gợi ý SEO
              </LoadingButton>
            )}
          </Stack>
          <AiProgressPanel progress={seoAi.progress} preview="none" onCancel={seoAi.cancel} />
          <RHFTextField
            name="metaTitle"
            label="Tiêu đề SEO"
            placeholder={values.title}
            helperText={`${counter(values.metaTitle, 70)} — nên dưới 65; để trống thì dùng tiêu đề bài`}
          />
          <RHFTextField
            name="metaDescription"
            label="Mô tả SEO"
            multiline
            minRows={2}
            placeholder={values.summary}
            helperText={`${counter(values.metaDescription, 300)} — Google thường hiện khoảng 160 ký tự đầu`}
          />
          <RHFTextField name="metaKeywords" label="Từ khoá" placeholder="cách nhau bằng dấu phẩy" />
        </SectionCard>

        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2}>
          <Controller
            name="publish"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label={field.value ? 'Đăng lên trang' : 'Lưu nháp (chưa đăng)'}
                sx={{ flexGrow: 1, pl: 1 }}
              />
            )}
          />
          {post?.status === 'published' && (
            <Button
              color="inherit"
              href={paths.news.details(post.slug)}
              target="_blank"
              rel="noopener"
              startIcon={<Iconify icon="solar:square-top-up-bold" />}
            >
              Xem trên trang
            </Button>
          )}
          <Button color="inherit" variant="outlined" size="large" onClick={() => setPreview(true)}>
            Xem trước
          </Button>
          <LoadingButton type="submit" variant="contained" size="large" loading={isSubmitting}>
            {post ? 'Lưu thay đổi' : 'Tạo bài'}
          </LoadingButton>
        </Stack>
      </Stack>

      <StoreNewsAiDialog open={aiOpen} onClose={() => setAiOpen(false)} onApply={applyDraft} />

      <StoreNewsImagePicker
        open={!!picker}
        purpose={picker?.purpose ?? 'cover'}
        initialTab={picker?.tab}
        suggestion={picker?.suggestion}
        aiEnabled={aiEnabled}
        onPick={onImagePicked}
        onClose={closePicker}
      />

      <Dialog fullScreen open={preview} onClose={() => setPreview(false)}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Xem trước
          </Typography>
          <Button variant="contained" onClick={() => setPreview(false)}>
            Đóng
          </Button>
        </Stack>
        {values.coverUrl && (
          <Box
            component="img"
            src={values.coverUrl}
            alt=""
            sx={{ width: 1, maxHeight: 420, objectFit: 'cover' }}
          />
        )}
        {values.coverUrl && values.coverCredit && (
          <Typography
            variant="caption"
            sx={{ display: 'block', px: 3, pt: 1, color: 'text.secondary', textAlign: 'right' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: values.coverCredit }}
          />
        )}
        <Box sx={{ maxWidth: 880, mx: 'auto', px: 3, py: 5 }}>
          <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
            {values.title || 'Chưa có tiêu đề'}
          </Typography>
          {values.summary && (
            <Typography
              variant="h6"
              component="p"
              sx={{ mb: 4, color: 'text.secondary', fontWeight: 500 }}
            >
              {values.summary}
            </Typography>
          )}
          <NewsContent html={values.contentHtml} />
        </Box>
      </Dialog>

      {confirmDialog}
    </FormProvider>
  );
}
