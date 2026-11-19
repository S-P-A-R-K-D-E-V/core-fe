'use client';

import type { InboxBox, InboxSummary, ConversationStatus, ConversationSummary } from 'src/lib/inbox';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import Tabs from '@mui/material/Tabs';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListSubheader from '@mui/material/ListSubheader';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

import { fTimeShort } from 'src/utils/format-time';

import {
  INBOX_BOXES,
  STATUS_LABEL,
  holderColor,
  platformIcon,
  holderShortLabel,
  lastMessagePreview,
} from 'src/lib/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import EmptyContent from 'src/components/empty-content';

// ----------------------------------------------------------------------
// Cột danh sách hội thoại: tab theo nhóm (đếm từ conversations/summary), tìm, lọc kênh / nhãn / trạng thái, "Tải thêm".
// ----------------------------------------------------------------------

export type ListExtraFilter = {
  channelId: string | null;
  tag: string | null;
  status: ConversationStatus;
};

type Props = {
  box: InboxBox;
  onBoxChange: (box: InboxBox) => void;
  summary: InboxSummary | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  extra: ListExtraFilter;
  onExtraChange: (extra: ListExtraFilter) => void;
  items: ConversationSummary[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: VoidFunction;
  selectedId: string | null;
  onSelect: (id: string) => void;
  myUserId: string | null;
};

export default function InboxConversationList({
  box,
  onBoxChange,
  summary,
  search,
  onSearchChange,
  extra,
  onExtraChange,
  items,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  selectedId,
  onSelect,
  myUserId,
}: Props) {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  // Kênh / nhãn để lọc: lấy từ các hội thoại đã tải (giữ cả lựa chọn đang áp dụng).
  const channels = useMemo(() => {
    const map = new Map<string, { name: string; platform: string }>();
    items.forEach((c) => map.set(c.channelId, { name: c.channelName, platform: c.platform }));
    if (extra.channelId && !map.has(extra.channelId)) map.set(extra.channelId, { name: 'Kênh đang lọc', platform: '' });
    return Array.from(map.entries());
  }, [items, extra.channelId]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => c.tags.forEach((t) => set.add(t)));
    if (extra.tag) set.add(extra.tag);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [items, extra.tag]);

  const activeFilters = (extra.channelId ? 1 : 0) + (extra.tag ? 1 : 0) + (extra.status !== 'open' ? 1 : 0);

  return (
    <Stack sx={{ height: 1, minHeight: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm tên, SĐT, nội dung…"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <IconButton onClick={(e) => setFilterAnchor(e.currentTarget)} aria-label="Lọc hội thoại">
          <Badge color="error" badgeContent={activeFilters} invisible={!activeFilters}>
            <Iconify icon="solar:filter-bold" />
          </Badge>
        </IconButton>
      </Stack>

      <Tabs
        value={box}
        onChange={(_, value) => onBoxChange(value)}
        variant="scrollable"
        scrollButtons={false}
        sx={{ px: 1.5, minHeight: 40, '& .MuiTab-root': { minHeight: 40, mr: 2 } }}
      >
        {INBOX_BOXES.map((b) => {
          const count = b.countKey && summary ? summary[b.countKey] : 0;
          return (
            <Tab
              key={b.value}
              value={b.value}
              iconPosition="end"
              label={b.label}
              icon={
                count ? (
                  <Label
                    variant={b.value === box ? 'filled' : 'soft'}
                    color={b.value === 'unassigned' ? 'error' : 'default'}
                    sx={{ ml: 0.5 }}
                  >
                    {count}
                  </Label>
                ) : undefined
              }
            />
          );
        })}
      </Tabs>

      <Divider />

      <Scrollbar sx={{ flex: 1, minHeight: 0 }}>
        {loading && (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress size={24} />
          </Stack>
        )}

        {!loading && items.length === 0 && (
          <EmptyContent
            title={search.trim() ? 'Không tìm thấy hội thoại' : 'Chưa có hội thoại'}
            description={box === 'unassigned' ? 'Không có khách nào đang chờ người nhận.' : undefined}
            sx={{ py: 6 }}
          />
        )}

        {items.map((c) => (
          <ConversationRow
            key={c.id}
            conversation={c}
            selected={c.id === selectedId}
            onClick={() => onSelect(c.id)}
            myUserId={myUserId}
          />
        ))}

        {hasMore && !loading && (
          <Stack alignItems="center" sx={{ py: 1.5 }}>
            <Button size="small" color="inherit" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Đang tải…' : 'Tải thêm'}
            </Button>
          </Stack>
        )}
      </Scrollbar>

      <Menu
        anchorEl={filterAnchor}
        open={!!filterAnchor}
        onClose={() => setFilterAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 420 } } }}
      >
        <ListSubheader>Trạng thái</ListSubheader>
        {(['open', 'closed', 'spam'] as ConversationStatus[]).map((s) => (
          <MenuItem key={s} selected={extra.status === s} onClick={() => onExtraChange({ ...extra, status: s })}>
            {STATUS_LABEL[s]}
          </MenuItem>
        ))}

        <ListSubheader>Kênh</ListSubheader>
        <MenuItem selected={!extra.channelId} onClick={() => onExtraChange({ ...extra, channelId: null })}>
          Mọi kênh
        </MenuItem>
        {channels.map(([id, ch]) => (
          <MenuItem key={id} selected={extra.channelId === id} onClick={() => onExtraChange({ ...extra, channelId: id })}>
            {ch.platform && <Iconify icon={platformIcon(ch.platform)} width={16} sx={{ mr: 1 }} />}
            {ch.name}
          </MenuItem>
        ))}

        {tags.length > 0 && <ListSubheader>Nhãn</ListSubheader>}
        {tags.length > 0 && (
          <MenuItem selected={!extra.tag} onClick={() => onExtraChange({ ...extra, tag: null })}>
            Mọi nhãn
          </MenuItem>
        )}
        {tags.map((t) => (
          <MenuItem key={t} selected={extra.tag === t} onClick={() => onExtraChange({ ...extra, tag: t })}>
            {t}
          </MenuItem>
        ))}

        {activeFilters > 0 && <Divider />}
        {activeFilters > 0 && (
          <MenuItem
            onClick={() => {
              onExtraChange({ channelId: null, tag: null, status: 'open' });
              setFilterAnchor(null);
            }}
            sx={{ color: 'error.main' }}
          >
            Bỏ lọc
          </MenuItem>
        )}
      </Menu>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type RowProps = {
  conversation: ConversationSummary;
  selected: boolean;
  onClick: VoidFunction;
  myUserId: string | null;
};

function ConversationRow({ conversation: c, selected, onClick, myUserId }: RowProps) {
  const unread = c.unreadCount > 0;
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{ px: 1.5, py: 1.25, gap: 1.5, alignItems: 'flex-start' }}
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Iconify icon={platformIcon(c.platform)} width={14} />
          </Box>
        }
      >
        <Avatar src={c.customer.avatarUrl ?? undefined} alt={c.customer.name} sx={{ width: 44, height: 44 }}>
          {c.customer.name?.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>

      <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography noWrap variant="subtitle2" sx={{ flex: 1, fontWeight: unread ? 700 : 600 }}>
            {c.customer.name || 'Khách'}
          </Typography>
          <Typography variant="caption" sx={{ color: unread ? 'error.main' : 'text.disabled', flexShrink: 0 }}>
            {fTimeShort(c.lastMessageAt)}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            noWrap
            variant="body2"
            sx={{ flex: 1, color: unread ? 'text.primary' : 'text.secondary', fontWeight: unread ? 600 : 400 }}
          >
            {lastMessagePreview(c)}
          </Typography>
          {unread && (
            <Box
              sx={{
                minWidth: 20,
                height: 20,
                px: 0.5,
                borderRadius: 10,
                bgcolor: 'error.main',
                color: 'common.white',
                typography: 'caption',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {c.unreadCount > 99 ? '99+' : c.unreadCount}
            </Box>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          <Label color={holderColor(c.holder, myUserId)} variant="soft">
            {holderShortLabel(c.holder, myUserId)}
          </Label>
          {c.status !== 'open' && (
            <Label color={c.status === 'spam' ? 'error' : 'default'}>{STATUS_LABEL[c.status]}</Label>
          )}
          {c.assignedName && c.assignedUserId !== c.holder.userId && (
            <Label color="default" startIcon={<Iconify icon="solar:user-hand-up-bold" width={12} />}>
              {c.assignedName}
            </Label>
          )}
          {c.tags.slice(0, 2).map((t) => (
            <Label key={t} color="default" variant="outlined">
              {t}
            </Label>
          ))}
          {c.tags.length > 2 && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              +{c.tags.length - 2}
            </Typography>
          )}
        </Stack>
      </Stack>
    </ListItemButton>
  );
}
