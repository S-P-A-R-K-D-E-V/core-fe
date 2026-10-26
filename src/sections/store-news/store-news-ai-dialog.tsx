'use client';

import type { StorePostIdea, StorePostDraft } from 'src/api/store-posts';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';

import { useDebounce } from 'src/hooks/use-debounce';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';

import { aiDraft, aiIdeas } from 'src/api/store-posts';
import { useSearchStorefrontProducts } from 'src/api/product';

import { NewsContent } from 'src/sections/news/news-content';

// ----------------------------------------------------------------------

type PickedProduct = { id: string; name: string; price: number };

const TONES = ['Thân thiện, đáng tin', 'Chuyên nghiệp', 'Trẻ trung, vui vẻ', 'Sang trọng, tinh tế'];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Đổ bản nháp vào form (tiêu đề, mô tả, nội dung, thẻ, SEO). */
  onApply: (draft: StorePostDraft) => void;
};

/**
 * Trợ lý AI viết bài: (1) gợi ý chủ đề hợp ngành / mùa / hàng đang bán, (2) viết nháp từ chủ đề — có thể chọn sản phẩm
 * của cửa hàng để AI giới thiệu kèm link. Người soạn xem trước rồi mới đổ vào form, sau đó vẫn sửa được trước khi lưu.
 */
export function StoreNewsAiDialog({ open, onClose, onApply }: Props) {
  const [tab, setTab] = useState<'ideas' | 'draft'>('ideas');
  const [hint, setHint] = useState('');
  const [ideas, setIdeas] = useState<StorePostIdea[]>([]);
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [products, setProducts] = useState<PickedProduct[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [draft, setDraft] = useState<StorePostDraft | null>(null);
  const [busy, setBusy] = useState<'ideas' | 'draft' | null>(null);
  const [error, setError] = useState('');

  const debouncedQuery = useDebounce(productQuery, 400);
  const { searchResults, searchLoading } = useSearchStorefrontProducts(debouncedQuery);

  const suggest = async () => {
    setBusy('ideas');
    setError('');
    try {
      setIdeas(await aiIdeas(hint));
    } catch (err) {
      setError(apiErrorMessage(err, 'AI chưa gợi ý được — thử lại sau ít phút'));
    } finally {
      setBusy(null);
    }
  };

  const write = async () => {
    setBusy('draft');
    setError('');
    setDraft(null);
    try {
      setDraft(
        await aiDraft({
          topic,
          keywords: keywords || undefined,
          tone,
          length,
          productIds: products.map((p) => p.id),
        })
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'AI chưa viết được — thử lại sau ít phút'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:magic-stick-3-bold-duotone" sx={{ color: 'primary.main' }} />
        Viết bài bằng AI
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="ideas" label="1. Gợi ý chủ đề" />
        <Tab value="draft" label="2. Viết nháp" />
      </Tabs>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {tab === 'ideas' && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="Muốn viết về gì? (không bắt buộc)"
                placeholder="VD: quà tặng Giáng Sinh, cách phối phụ kiện đi làm…"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
              <LoadingButton
                variant="contained"
                loading={busy === 'ideas'}
                onClick={suggest}
                sx={{ flexShrink: 0 }}
                startIcon={<Iconify icon="solar:lightbulb-bolt-bold" />}
              >
                Gợi ý chủ đề
              </LoadingButton>
            </Stack>
            {ideas.map((idea) => (
              <ListItemButton
                key={idea.title}
                onClick={() => {
                  setTopic(idea.title);
                  setTab('draft');
                }}
                sx={{
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  alignItems: 'flex-start',
                  py: 1.5,
                }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{idea.title}</Typography>
                  {idea.angle && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {idea.angle}
                    </Typography>
                  )}
                </Stack>
              </ListItemButton>
            ))}
            {ideas.length === 0 && busy !== 'ideas' && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                AI đề xuất chủ đề theo ngành hàng, dịp lễ sắp tới và hàng đang bán của cửa hàng. Bấm
                một chủ đề để sang bước viết nháp — hoặc tự nhập chủ đề ở bước 2.
              </Typography>
            )}
          </Stack>
        )}

        {tab === 'draft' && (
          <Stack spacing={2.5}>
            <TextField
              label="Chủ đề bài viết"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Từ khoá nên có (không bắt buộc)"
              placeholder="VD: bờm tóc đẹp, phụ kiện Hà Nội"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Giọng văn"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                fullWidth
              >
                {TONES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Độ dài"
                value={length}
                onChange={(e) => setLength(e.target.value as typeof length)}
                fullWidth
              >
                <MenuItem value="short">Ngắn (~350 chữ)</MenuItem>
                <MenuItem value="medium">Vừa (~700 chữ)</MenuItem>
                <MenuItem value="long">Dài (~1200 chữ)</MenuItem>
              </TextField>
            </Stack>
            <Autocomplete
              multiple
              value={products}
              onChange={(_, v) => setProducts(v.slice(0, 6))}
              options={searchResults.map((p: any) => ({ id: p.id, name: p.name, price: p.price }))}
              getOptionLabel={(p) => p.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              loading={searchLoading}
              inputValue={productQuery}
              onInputChange={(_, v) => setProductQuery(v)}
              noOptionsText={productQuery ? 'Không thấy sản phẩm' : 'Gõ tên sản phẩm để tìm'}
              renderOption={(props, p) => (
                <li {...props} key={p.id}>
                  <Stack>
                    <Typography variant="body2">{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {fCurrency(p.price)}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((p, index) => (
                  <Chip {...getTagProps({ index })} key={p.id} size="small" label={p.name} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Sản phẩm muốn giới thiệu (tối đa 6, không bắt buộc)"
                  helperText="AI nhắc đúng tên, giá và gắn link tới trang sản phẩm."
                />
              )}
            />

            {draft && (
              <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Bản nháp
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5, mb: 1 }}>
                  {draft.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  {draft.summary}
                </Typography>
                <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 1 }}>
                  <NewsContent html={draft.contentHtml} />
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={!!busy}>
          Đóng
        </Button>
        {tab === 'draft' && (
          <>
            <LoadingButton
              variant={draft ? 'outlined' : 'contained'}
              loading={busy === 'draft'}
              disabled={!topic.trim()}
              onClick={write}
              startIcon={<Iconify icon="solar:pen-new-square-bold" />}
            >
              {draft ? 'Viết lại' : 'Viết nháp'}
            </LoadingButton>
            {draft && (
              <Button
                variant="contained"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
              >
                Dùng bản nháp này
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
