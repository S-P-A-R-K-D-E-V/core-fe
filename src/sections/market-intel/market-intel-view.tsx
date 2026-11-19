'use client';

import type { Competitor, MarketReport, CompetitorNote } from 'src/api/market-intel';

import { mutate } from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import {
  addMarketNote,
  useCompetitors,
  rateSuggestion,
  saveCompetitor,
  useMarketNotes,
  deleteCompetitor,
  deleteMarketNote,
  marketNotesKey,
  useMarketReports,
  marketReportsKey,
  marketCompetitorsKey,
} from 'src/api/market-intel';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Đối thủ & thị trường (K11): kho đối thủ, ghi chú dán link + giá, báo cáo tuần của agent Thị trường – Đối thủ (chấm
// từng đề xuất "dùng được / không" để đo chất lượng).
// ----------------------------------------------------------------------

const AREA_LABEL: Record<string, string> = {
  marketing: 'Marketing',
  sales: 'Bán hàng',
  purchasing: 'Nhập hàng',
  other: 'Khác',
};

const fVnd = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v).toLocaleString('vi-VN')}đ`;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function LinkChips({ urls }: { urls: string[] | null | undefined }) {
  if (!urls?.length) return null;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {urls.map((u) => (
        <Chip
          key={u}
          size="small"
          variant="outlined"
          component="a"
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          clickable
          icon={<Iconify icon="eva:external-link-fill" width={14} />}
          label={hostOf(u)}
        />
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------- Đối thủ

function CompetitorDialog({
  open,
  competitor,
  onClose,
}: {
  open: boolean;
  competitor: Competitor | null;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(competitor?.name ?? '');
  const [links, setLinks] = useState((competitor?.links ?? []).join('\n'));
  const [area, setArea] = useState(competitor?.area ?? '');
  const [note, setNote] = useState(competitor?.note ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await saveCompetitor(competitor?.id ?? null, {
        name,
        links: links
          .split(/\s+/)
          .map((l) => l.trim())
          .filter(Boolean),
        area: area || null,
        note: note || null,
        isActive: competitor?.isActive ?? true,
      });
      await mutate(marketCompetitorsKey);
      enqueueSnackbar(competitor ? 'Đã lưu đối thủ' : 'Đã thêm đối thủ');
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu không được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{competitor ? 'Sửa đối thủ' : 'Thêm đối thủ'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Tên shop" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <TextField
            label="Link các kênh (mỗi dòng 1 link)"
            placeholder="https://www.facebook.com/…&#10;https://shopee.vn/…"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            multiline
            minRows={3}
            helperText="Web, Facebook, Instagram, TikTok, Shopee, Threads… (tối đa 10)"
          />
          <TextField label="Khu vực / đặc điểm" value={area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!name.trim()} onClick={submit}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function CompetitorsTab() {
  const { items, loading } = useCompetitors();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [editing, setEditing] = useState<Competitor | null | undefined>(undefined);

  const toggle = async (c: Competitor) => {
    try {
      await saveCompetitor(c.id, { name: c.name, links: c.links, area: c.area, note: c.note, isActive: !c.isActive });
      await mutate(marketCompetitorsKey);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu không được'), { variant: 'error' });
    }
  };

  const remove = async (c: Competitor) => {
    if (!(await confirm(`Xoá đối thủ "${c.name}"? Ghi chú vẫn giữ lại.`))) return;
    try {
      await deleteCompetitor(c.id);
      await mutate(marketCompetitorsKey);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá không được'), { variant: 'error' });
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setEditing(null)}>
          Thêm đối thủ
        </Button>
      </Stack>
      {loading && <Skeleton variant="rounded" height={120} />}
      {!loading && items.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có đối thủ nào"
          description="Thêm vài shop cùng ngành để agent Thị trường theo dõi giá và mẫu hot mỗi tuần."
          sx={{ py: 6 }}
        />
      )}
      {items.map((c) => (
        <Card key={c.id} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{c.name}</Typography>
                {!c.isActive && <Label color="default">Đã tắt</Label>}
                {c.noteCount > 0 && (
                  <Label color="info">
                    {c.noteCount} ghi chú{c.lastNoteAt ? ` · gần nhất ${fDateTime(c.lastNoteAt)}` : ''}
                  </Label>
                )}
              </Stack>
              {c.area && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {c.area}
                </Typography>
              )}
              {c.note && (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {c.note}
                </Typography>
              )}
              <Box sx={{ mt: 1 }}>
                <LinkChips urls={c.links} />
              </Box>
            </Box>
            <IconButton onClick={() => setEditing(c)} aria-label="Sửa">
              <Iconify icon="solar:pen-bold" />
            </IconButton>
            <IconButton onClick={() => toggle(c)} aria-label={c.isActive ? 'Tắt theo dõi' : 'Bật theo dõi'}>
              <Iconify icon={c.isActive ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />
            </IconButton>
            <IconButton onClick={() => remove(c)} aria-label="Xoá" color="error">
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Stack>
        </Card>
      ))}
      {editing !== undefined && (
        <CompetitorDialog open competitor={editing} onClose={() => setEditing(undefined)} />
      )}
      {confirmDialog}
    </Stack>
  );
}

// ---------------------------------------------------------------------- Ghi chú

function NotesTab() {
  const { items, loading } = useMarketNotes(60);
  const { items: competitors } = useCompetitors();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [competitorId, setCompetitorId] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await addMarketNote({
        competitorId: competitorId || null,
        url: url.trim() || null,
        title: title.trim() || null,
        price: price.trim() ? Number(price.replace(/[^\d]/g, '')) : null,
        note: note.trim() || null,
      });
      await mutate(marketNotesKey(60));
      await mutate(marketCompetitorsKey);
      setUrl('');
      setTitle('');
      setPrice('');
      setNote('');
      enqueueSnackbar('Đã lưu ghi chú');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu không được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: CompetitorNote) => {
    if (!(await confirm('Xoá ghi chú này?'))) return;
    try {
      await deleteMarketNote(n.id);
      await mutate(marketNotesKey(60));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá không được'), { variant: 'error' });
    }
  };

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Dán link bài / sản phẩm đối thủ
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Trang Facebook / TikTok / Shopee thường cần đăng nhập nên agent không tự đọc được — ghi kèm giá và mô tả.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <TextField
            select
            label="Đối thủ"
            value={competitorId}
            onChange={(e) => setCompetitorId(e.target.value)}
          >
            <MenuItem value="">Thị trường chung</MenuItem>
            {competitors.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <TextField label="Tiêu đề / tên món" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField
            label="Giá thấy (đ)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
          />
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            sx={{ gridColumn: { md: '1 / -1' } }}
          />
        </Box>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!url.trim() && !title.trim() && !note.trim()}
            onClick={submit}
          >
            Lưu ghi chú
          </LoadingButton>
        </Stack>
      </Card>

      {loading && <Skeleton variant="rounded" height={120} />}
      {!loading && items.length === 0 && (
        <EmptyContent filled title="Chưa có ghi chú trong 60 ngày" sx={{ py: 6 }} />
      )}
      {items.map((n) => (
        <Card key={n.id} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2">{n.title || n.competitorName || 'Ghi chú'}</Typography>
                {n.competitorName && <Label color="primary">{n.competitorName}</Label>}
                {n.price !== null && <Label color="warning">{fVnd(n.price)}</Label>}
                <Label color={n.source === 'agent' ? 'secondary' : 'default'}>
                  {n.source === 'agent' ? 'Agent ghi' : (n.createdByName ?? 'Người dán')}
                </Label>
              </Stack>
              {n.note && (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {n.note}
                </Typography>
              )}
              {n.url && (
                <Link href={n.url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {n.url}
                </Link>
              )}
              <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 0.5 }}>
                {fDateTime(n.createdAt)}
              </Typography>
            </Box>
            <IconButton onClick={() => remove(n)} aria-label="Xoá" color="error">
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Stack>
        </Card>
      ))}
      {confirmDialog}
    </Stack>
  );
}

// ---------------------------------------------------------------------- Báo cáo tuần

function ReportCard({ report }: { report: MarketReport }) {
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState<number | null>(null);
  const useful = report.suggestions.filter((s) => s.rating === 'useful').length;

  const rate = async (index: number, rating: string | null) => {
    setBusy(index);
    try {
      await rateSuggestion(report.id, index, rating);
      await mutate(marketReportsKey);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chấm không được'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6">Tuần {report.weekStart.split('-').reverse().join('/')}</Typography>
          <Label color={useful >= 3 ? 'success' : 'default'}>
            {useful}/{report.suggestions.length} đề xuất dùng được
          </Label>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {report.agentName ?? 'Agent'} · {fDateTime(report.createdAt)}
          </Typography>
        </Stack>

        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {report.summary}
        </Typography>

        {report.trends.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Xu hướng
            </Typography>
            <Stack spacing={1.25}>
              {report.trends.map((t, i) => (
                <Box key={i}>
                  <Typography variant="body2">
                    <strong>{t.topic}</strong>
                    {t.category ? ` · ${t.category}` : ''}
                    {t.detail ? ` — ${t.detail}` : ''}
                  </Typography>
                  <LinkChips urls={t.evidence} />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {report.prices.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              So giá
            </Typography>
            <Stack spacing={0.75}>
              {report.prices.map((p, i) => (
                <Typography key={i} variant="body2">
                  {p.ciciProduct ?? '—'} (CiCi {fVnd(p.ciciPrice)}) ↔ {p.competitor ?? 'đối thủ'} {fVnd(p.competitorPrice)}
                  {p.note ? ` — ${p.note}` : ''}{' '}
                  {p.url && (
                    <Link href={p.url} target="_blank" rel="noopener noreferrer">
                      {hostOf(p.url)}
                    </Link>
                  )}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Đề xuất
          </Typography>
          <Stack spacing={1.5}>
            {report.suggestions.map((s, i) => (
              <Box
                key={i}
                sx={{ p: 1.5, borderRadius: 1.5, border: (theme) => `1px solid ${theme.palette.divider}` }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Label color="info">{AREA_LABEL[s.area ?? 'other'] ?? s.area}</Label>
                  {s.rating && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {s.ratedBy ?? ''} chấm {s.rating === 'useful' ? '“dùng được”' : '“không dùng”'}
                    </Typography>
                  )}
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {s.text}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  <LinkChips urls={s.evidence} />
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant={s.rating === 'useful' ? 'contained' : 'outlined'}
                    color="success"
                    disabled={busy === i}
                    startIcon={<Iconify icon="solar:like-bold" />}
                    onClick={() => rate(i, s.rating === 'useful' ? null : 'useful')}
                  >
                    Dùng được
                  </Button>
                  <Button
                    size="small"
                    variant={s.rating === 'not_useful' ? 'contained' : 'outlined'}
                    color="inherit"
                    disabled={busy === i}
                    startIcon={<Iconify icon="solar:dislike-bold" />}
                    onClick={() => rate(i, s.rating === 'not_useful' ? null : 'not_useful')}
                  >
                    Không dùng
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}

function ReportsTab() {
  const { items, loading } = useMarketReports();
  if (loading) return <Skeleton variant="rounded" height={200} />;
  if (items.length === 0)
    return (
      <EmptyContent
        filled
        title="Chưa có báo cáo"
        description="Agent Thị trường – Đối thủ gửi báo cáo tối Chủ nhật hằng tuần."
        sx={{ py: 6 }}
      />
    );
  return (
    <Stack spacing={3}>
      {items.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function MarketIntelView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState<'reports' | 'competitors' | 'notes'>('reports');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Đối thủ & thị trường"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: 'Đối thủ & thị trường' },
        ]}
        sx={{ mb: { xs: 2, md: 3 } }}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab value="reports" label="Báo cáo tuần" />
        <Tab value="competitors" label="Đối thủ" />
        <Tab value="notes" label="Ghi chú" />
      </Tabs>
      {tab === 'reports' && <ReportsTab />}
      {tab === 'competitors' && <CompetitorsTab />}
      {tab === 'notes' && <NotesTab />}
    </Container>
  );
}
