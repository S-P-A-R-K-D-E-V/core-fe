'use client';

import { memo, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog, { dialogClasses } from '@mui/material/Dialog';

import { useRouter } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import { normalizeSearch } from '../../dashboard/nav/nav-filter';
import { useNavTree } from '../../dashboard/config-navigation';
import { useNavPins } from '../../dashboard/nav/use-nav-state';
import { useCommandPalette } from '../../dashboard/nav/command-palette-store';

import type { NavFlatPage } from '../../dashboard/nav/nav-types';

// ----------------------------------------------------------------------
// Ô tìm nhanh (Ctrl K / ⌘K, hoặc "/"): mọi trang người đó có quyền + lệnh tạo mới. Gõ không dấu ("nhap hang", "luong"),
// tìm trên tên trang, module, nhóm và từ khoá. Ô trống: Gần đây, Đã ghim, vài lệnh. ↑ ↓ chọn, Enter mở.
// Mục chủ cửa hàng ẩn khỏi menu theo vai trò vẫn tìm được (trừ khi chọn ẩn cả tìm kiếm) — người đó vẫn có quyền.
// ----------------------------------------------------------------------

type Entry = {
  id: string;
  kind: 'page' | 'command';
  title: string;
  path: string;
  caption: string;
  icon: string;
  haystack: string;
};

function pageEntry(page: NavFlatPage): Entry {
  return {
    id: `p:${page.key}`,
    kind: 'page',
    title: page.title,
    path: page.path,
    caption: `${page.moduleTitle} › ${page.groupTitle}`,
    icon: page.moduleIcon,
    haystack: normalizeSearch(
      `${page.title} ${page.moduleTitle} ${page.groupTitle} ${page.keywords ?? ''}`
    ),
  };
}

function commandEntries(page: NavFlatPage): Entry[] {
  return page.actions.map((action) => ({
    id: `c:${page.key}:${action.path}`,
    kind: 'command' as const,
    title: action.title,
    path: action.path,
    caption: `${page.moduleTitle} › ${page.title}`,
    icon: 'solar:add-circle-bold-duotone',
    haystack: normalizeSearch(
      `${action.title} ${page.title} ${action.keywords ?? ''} ${page.keywords ?? ''}`
    ),
  }));
}

/** Tô phần khớp — tên đã chuẩn hoá NFC nên vị trí ký tự sau khi bỏ dấu trùng vị trí trong tên gốc. */
function Highlight({ text, query }: { text: string; query: string }) {
  const idx = query ? normalizeSearch(text).indexOf(query) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="span" sx={{ color: 'primary.main', fontWeight: 'fontWeightBold' }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function Searchbar() {
  const theme = useTheme();
  const router = useRouter();
  const lgUp = useResponsive('up', 'lg');

  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const toggle = useCommandPalette((s) => s.toggle);

  const tree = useNavTree();
  const pins = useNavPins(tree);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  // Ctrl K (Windows) / ⌘K (Mac) mở / đóng; "/" mở khi không đang gõ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggle();
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  const all = useMemo(() => {
    const pages = tree.searchable.map(pageEntry);
    const commands = tree.searchable.flatMap(commandEntries);
    return { pages, commands };
  }, [tree.searchable]);

  const q = normalizeSearch(query);

  const sections = useMemo(() => {
    if (!q) {
      const recent = pins.recent.map(pageEntry);
      const recentIds = new Set(recent.map((e) => e.id));
      const pinned = pins.pinned.map(pageEntry).filter((e) => !recentIds.has(e.id));
      return [
        { title: 'Gần đây', items: recent.slice(0, 5) },
        { title: 'Đã ghim', items: pinned },
        { title: 'Lệnh', items: all.commands.slice(0, 4) },
      ].filter((s) => s.items.length);
    }
    const words = q.split(/\s+/).filter(Boolean);
    const matches = (e: Entry) => words.every((w) => e.haystack.includes(w));
    const score = (e: Entry) => {
      const title = normalizeSearch(e.title);
      if (title.startsWith(q)) return 0;
      if (title.includes(q)) return 1;
      return 2;
    };
    const rank = (list: Entry[]) => list.filter(matches).sort((a, b) => score(a) - score(b));
    return [
      { title: 'Trang', items: rank(all.pages).slice(0, 10) },
      { title: 'Lệnh', items: rank(all.commands).slice(0, 6) },
    ].filter((s) => s.items.length);
  }, [q, all, pins.recent, pins.pinned]);

  const flat = sections.flatMap((s) => s.items);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    router.push(entry.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[selected]);
    }
  };

  if (tree.counter) return null;

  let index = -1;

  return (
    <>
      {lgUp ? (
        <ButtonBase
          onClick={() => setOpen(true)}
          aria-label="Tìm nhanh"
          sx={{
            gap: 1,
            px: 1.5,
            height: 38,
            width: 300,
            maxWidth: '28vw',
            borderRadius: 1.5,
            justifyContent: 'flex-start',
            color: 'text.disabled',
            bgcolor: 'background.neutral',
            typography: 'body2',
          }}
        >
          <Iconify icon="eva:search-fill" width={18} />
          <Box
            component="span"
            sx={{
              flex: 1,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Tìm trang, lệnh…
          </Box>
          <Label sx={{ px: 0.75, fontSize: 11, color: 'text.secondary' }}>Ctrl K</Label>
        </ButtonBase>
      ) : (
        <IconButton onClick={() => setOpen(true)} aria-label="Tìm nhanh">
          <Iconify icon="eva:search-fill" />
        </IconButton>
      )}

      <Dialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={() => setOpen(false)}
        transitionDuration={{ enter: theme.transitions.duration.shortest, exit: 0 }}
        PaperProps={{ sx: { mt: { xs: 8, md: 15 }, overflow: 'unset' } }}
        sx={{ [`& .${dialogClasses.container}`]: { alignItems: 'flex-start' } }}
      >
        <Box sx={{ px: 2.5, py: 2, borderBottom: `solid 1px ${theme.palette.divider}` }}>
          <InputBase
            fullWidth
            autoFocus
            placeholder="Gõ tên trang hoặc việc cần làm — không cần dấu"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={handleKeyDown}
            startAdornment={
              <Iconify icon="eva:search-fill" width={22} sx={{ color: 'text.disabled', mr: 1.5 }} />
            }
            endAdornment={<Label sx={{ letterSpacing: 1, color: 'text.secondary' }}>esc</Label>}
            inputProps={{ 'aria-label': 'Tìm trang, lệnh', sx: { typography: 'subtitle1' } }}
          />
        </Box>

        <Scrollbar sx={{ px: 1, py: 1, maxHeight: '55vh' }}>
          {flat.length === 0 ? (
            <Typography variant="body2" sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
              {query
                ? `Không thấy "${query}". Thử từ khác, vd "nhap", "luong", "ca".`
                : 'Gõ để tìm trang.'}
            </Typography>
          ) : (
            sections.map((section) => (
              <List key={section.title} disablePadding>
                <Typography
                  variant="overline"
                  component="div"
                  sx={{ px: 1.5, pt: 1, color: 'text.disabled', fontSize: 11 }}
                >
                  {section.title}
                </Typography>
                {section.items.map((entry) => {
                  index += 1;
                  const i = index;
                  return (
                    <ButtonBase
                      key={entry.id}
                      onClick={() => go(entry)}
                      onMouseMove={() => setSelected(i)}
                      sx={{
                        width: 1,
                        gap: 1.5,
                        px: 1.5,
                        py: 1,
                        borderRadius: 1,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        ...(i === selected && { bgcolor: 'action.selected' }),
                      }}
                    >
                      <Iconify
                        icon={entry.icon}
                        width={20}
                        sx={{ color: 'text.secondary', flexShrink: 0 }}
                      />
                      <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          <Highlight text={entry.title} query={q} />
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }} noWrap>
                          {entry.caption}
                        </Typography>
                      </Stack>
                      {entry.kind === 'command' && <Label color="info">lệnh</Label>}
                    </ButtonBase>
                  );
                })}
              </List>
            ))
          )}
        </Scrollbar>

        <Stack
          direction="row"
          spacing={2}
          sx={{
            px: 2.5,
            py: 1,
            borderTop: `solid 1px ${theme.palette.divider}`,
            color: 'text.disabled',
          }}
        >
          <Typography variant="caption">↑ ↓ chọn</Typography>
          <Typography variant="caption">Enter mở</Typography>
          <Typography variant="caption">Chỉ hiện trang bạn có quyền</Typography>
        </Stack>
      </Dialog>
    </>
  );
}

export default memo(Searchbar);
