'use client';

import type { InboxBox, InboxSummary, ConversationStatus, ConversationSummary } from 'src/lib/inbox';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
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
  isPriority,
  INBOX_BOXES,
  PRIORITY_TAG,
  STATUS_LABEL,
  holderColor,
  platformIcon,
  holderShortLabel,
  lastMessagePreview,
  conversationKindLabel,
  conversationBadgeIcon,
} from 'src/lib/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import EmptyContent from 'src/components/empty-content';

// ----------------------------------------------------------------------
// Cột danh sách hội thoại (kiểu Meta Business Suite): ô tìm, chọn nhóm người giữ (Chưa ai nhận / Của tôi / Agent / Trên
// Facebook / Tất cả — đếm từ conversations/summary), chip lọc nhanh Chưa đọc / Ưu tiên / AI, menu lọc trạng thái / kênh /
// nhãn; dòng: ảnh đại diện có dấu kênh, tên đậm khi chưa đọc, tin cuối ("Bạn: …"), giờ, chip Ưu tiên + "Giao: …".
// Loại hội thoại (tin nhắn / bình luận) là tab trên cùng của trang.
// ----------------------------------------------------------------------

export type ListExtraFilter = {
  channelId: string | null;
  tag: string | null;
  status: ConversationStatus;
  /** Chỉ hội thoại còn tin chưa đọc. */
  unread: boolean;
};

export const DEFAULT_LIST_EXTRA: ListExtraFilter = { channelId: null, tag: null, status: 'open', unread: false };

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
    set.delete(PRIORITY_TAG);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [items, extra.tag]);

  const priorityOn = extra.tag === PRIORITY_TAG;
  const aiOn = box === 'agent';
  const menuFilters =
    (extra.channelId ? 1 : 0) + (extra.tag && !priorityOn ? 1 : 0) + (extra.status !== 'open' ? 1 : 0);

  const boxCount = (value: InboxBox) => {
    const key = INBOX_BOXES.find((b) => b.value === value)?.countKey;
    return key && summary ? summary[key] : 0;
  };

  const quickChip = (label: string, icon: string, active: boolean, onClick: VoidFunction) => (
    <Chip
      size="small"
      label={label}
      icon={<Iconify icon={icon} width={14} />}
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      onClick={onClick}
      sx={{ fontWeight: 600 }}
    />
  );

  return (
    <Stack sx={{ height: 1, minHeight: 0 }}>
      <Stack spacing={1} sx={{ p: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
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
              sx: { borderRadius: 5 },
            }}
          />
          <Tooltip title="Lọc theo trạng thái / kênh / nhãn">
            <IconButton onClick={(e) => setFilterAnchor(e.currentTarget)} aria-label="Lọc hội thoại">
              <Badge color="error" badgeContent={menuFilters} invisible={!menuFilters}>
                <Iconify icon="solar:filter-bold" />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          <Select
            size="small"
            value={box}
            onChange={(e) => onBoxChange(e.target.value as InboxBox)}
            variant="standard"
            disableUnderline
            renderValue={(value) => {
              const b = INBOX_BOXES.find((x) => x.value === value);
              const count = boxCount(value as InboxBox);
              return (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="subtitle2">{b?.label ?? 'Tất cả'}</Typography>
                  {!!count && (
                    <Label color={value === 'unassigned' ? 'error' : 'default'} sx={{ height: 18 }}>
                      {count}
                    </Label>
                  )}
                </Stack>
              );
            }}
            sx={{ mr: 0.5, '& .MuiSelect-select': { py: 0.25 } }}
            inputProps={{ 'aria-label': 'Nhóm người giữ' }}
          >
            {INBOX_BOXES.map((b) => {
              const count = boxCount(b.value);
              return (
                <MenuItem key={b.value} value={b.value}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {b.label}
                  </Typography>
                  {!!count && (
                    <Label color={b.value === 'unassigned' ? 'error' : 'default'} sx={{ ml: 1.5 }}>
                      {count}
                    </Label>
                  )}
                </MenuItem>
              );
            })}
          </Select>

          {quickChip('Chưa đọc', 'solar:letter-unread-bold', extra.unread, () =>
            onExtraChange({ ...extra, unread: !extra.unread })
          )}
          {quickChip('Ưu tiên', 'solar:star-bold', priorityOn, () =>
            onExtraChange({ ...extra, tag: priorityOn ? null : PRIORITY_TAG })
          )}
          {quickChip('AI', 'solar:cpu-bolt-bold', aiOn, () => onBoxChange(aiOn ? 'all' : 'agent'))}
        </Stack>
      </Stack>

      <Divider />

      <Scrollbar sx={{ flex: 1, minHeight: 0 }}>
        {loading && (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress size={24} />
          </Stack>
        )}

        {!loading && items.length === 0 && (
          <EmptyContent
            title={search.trim() ? 'Không tìm thấy hội thoại' : extra.unread ? 'Đã đọc hết' : 'Chưa có hội thoại'}
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

        {menuFilters > 0 && <Divider />}
        {menuFilters > 0 && (
          <MenuItem
            onClick={() => {
              onExtraChange({ ...DEFAULT_LIST_EXTRA, unread: extra.unread, tag: priorityOn ? PRIORITY_TAG : null });
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
  const priority = isPriority(c);
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1.25,
        gap: 1.5,
        alignItems: 'flex-start',
        borderRadius: 1,
        mx: 0.5,
        my: 0.25,
        '&.Mui-selected': { bgcolor: 'action.selected' },
      }}
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <Tooltip title={c.platform === 'test' ? 'Kênh thử' : conversationKindLabel(c.kind)}>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                boxShadow: (theme) => `0 0 0 1px ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Iconify icon={conversationBadgeIcon(c)} width={14} />
            </Box>
          </Tooltip>
        }
      >
        <Avatar src={c.customer.avatarUrl ?? undefined} alt={c.customer.name} sx={{ width: 48, height: 48 }}>
          {c.customer.name?.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>

      <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.25}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            noWrap
            variant="subtitle2"
            sx={{ flex: 1, fontWeight: unread ? 700 : 500, color: unread ? 'text.primary' : 'text.secondary' }}
          >
            {c.customer.name || 'Khách'}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: unread ? 'primary.main' : 'text.disabled', fontWeight: unread ? 700 : 400, flexShrink: 0 }}
          >
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
                bgcolor: 'primary.main',
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

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, pt: 0.25 }}>
          {priority && (
            <Label color="warning" variant="soft" startIcon={<Iconify icon="solar:star-bold" width={12} />}>
              Ưu tiên
            </Label>
          )}
          <Label color={holderColor(c.holder, myUserId)} variant="soft">
            {holderShortLabel(c.holder, myUserId)}
          </Label>
          {c.assignedName && (
            <Label color="default" startIcon={<Iconify icon="solar:user-hand-up-bold" width={12} />}>
              Giao: {c.assignedName}
            </Label>
          )}
          {c.status !== 'open' && (
            <Label color={c.status === 'spam' ? 'error' : 'default'}>{STATUS_LABEL[c.status]}</Label>
          )}
        </Stack>
      </Stack>
    </ListItemButton>
  );
}
