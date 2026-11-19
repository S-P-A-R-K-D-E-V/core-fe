'use client';

import type { InboxBox, ConversationListFilter } from 'src/lib/inbox';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { useDebounce } from 'src/hooks/use-debounce';
import { useResponsive } from 'src/hooks/use-responsive';

import { isInboxBox, upsertConversationPages } from 'src/lib/inbox';
import {
  useQuickReplies,
  useInboxSummary,
  useConversationList,
  useConversationSettings,
} from 'src/api/inbox';

import Iconify from 'src/components/iconify';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import InboxThread from '../inbox-thread';
import InboxConversationList from '../inbox-conversation-list';
import { useInboxPermissions } from '../hooks/use-inbox-permissions';
import { useInboxEvents, useInboxRealtime, InboxRealtimeProvider } from '../inbox-realtime';

import type { ListExtraFilter } from '../inbox-conversation-list';

// ----------------------------------------------------------------------
// Hộp thư khách (F2): danh sách · hội thoại · thông tin khách. URL: ?c={conversationId} mở hội thoại (thông báo "tin khách
// mới" của core-be mở thẳng đường này), ?box=unassigned|mine|agent|external|all. Cập nhật trực tiếp qua hub /hubs/inbox;
// hub mất kết nối → hỏi lại mỗi 30 giây.
// ----------------------------------------------------------------------

export function InboxView() {
  const { read } = useInboxPermissions();
  return (
    <InboxRealtimeProvider enabled={read}>
      <InboxViewInner />
    </InboxRealtimeProvider>
  );
}

function InboxViewInner() {
  const settings = useSettingsContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mdUp = useResponsive('up', 'md');
  const lgUp = useResponsive('up', 'lg');

  const { myUserId, reply, manage } = useInboxPermissions();
  const { live } = useInboxRealtime();
  const poll = !live;

  const boxParam = searchParams.get('box');
  const box: InboxBox = isInboxBox(boxParam) ? boxParam : 'all';
  const selectedId = searchParams.get('c') || null;

  const setQuery = useCallback(
    (patch: { box?: InboxBox; c?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.box !== undefined) {
        if (patch.box === 'all') params.delete('box');
        else params.set('box', patch.box);
      }
      if (patch.c !== undefined) {
        if (patch.c) params.set('c', patch.c);
        else params.delete('c');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const [search, setSearch] = useState('');
  const q = useDebounce(search, 400);
  const [extra, setExtra] = useState<ListExtraFilter>({ channelId: null, tag: null, status: 'open' });

  const filter: ConversationListFilter = useMemo(
    () => ({ box, q, channelId: extra.channelId, tag: extra.tag, status: extra.status }),
    [box, q, extra]
  );

  const { summary } = useInboxSummary({ poll });
  const list = useConversationList(filter, poll);
  const { replies } = useQuickReplies();
  const { settings: inboxSettings } = useConversationSettings();

  useInboxEvents({
    onConversationUpdated: (c) => {
      list.mutate((pages) => upsertConversationPages(pages, c, filter, myUserId), { revalidate: false });
    },
    onResync: () => {
      list.mutate();
    },
  });

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    list.items.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [list.items]);

  const showList = mdUp || !selectedId;
  const showThread = mdUp || !!selectedId;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'} sx={{ pb: 3 }}>
      <CustomBreadcrumbs
        heading="Hộp thư khách"
        links={[
          { name: 'Bán online', href: paths.dashboard.social.overview },
          { name: 'Hộp thư khách' },
        ]}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={live ? 'Đang cập nhật trực tiếp' : 'Mất kết nối trực tiếp — tự tải lại mỗi 30 giây'}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: live ? 'success.main' : 'warning.main',
                }}
              />
            </Tooltip>
            {reply && (
              <Button
                component={RouterLink}
                href={paths.dashboard.inbox.test}
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<Iconify icon="solar:test-tube-bold" />}
              >
                Kênh thử
              </Button>
            )}
            <Button
              component={RouterLink}
              href={paths.dashboard.inbox.settings}
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<Iconify icon="solar:settings-bold" />}
            >
              Mẫu trả lời & cấu hình
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      <Card
        sx={{
          display: 'flex',
          height: { xs: 'calc(100vh - 170px)', md: 'calc(100vh - 210px)' },
          minHeight: 520,
          overflow: 'hidden',
        }}
      >
        {showList && (
          <Box
            sx={{
              width: { xs: 1, md: 340 },
              flexShrink: 0,
              minHeight: 0,
              borderRight: (theme) => (mdUp ? `solid 1px ${theme.palette.divider}` : 'none'),
            }}
          >
            <InboxConversationList
              box={box}
              onBoxChange={(b) => setQuery({ box: b })}
              summary={summary}
              search={search}
              onSearchChange={setSearch}
              extra={extra}
              onExtraChange={setExtra}
              items={list.items}
              loading={list.loading}
              hasMore={list.hasMore}
              loadingMore={list.loadingMore}
              onLoadMore={list.loadMore}
              selectedId={selectedId}
              onSelect={(id) => setQuery({ c: id })}
              myUserId={myUserId}
            />
          </Box>
        )}

        {showThread &&
          (selectedId ? (
            <InboxThread
              key={selectedId}
              conversationId={selectedId}
              myUserId={myUserId}
              permissions={{ reply, manage }}
              agentMode={inboxSettings?.agentMode ?? null}
              quickReplies={replies}
              tagOptions={tagOptions}
              panelMode={lgUp ? 'inline' : 'drawer'}
              onBack={mdUp ? undefined : () => setQuery({ c: null })}
              poll={poll}
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
              <EmptyContent
                title="Chọn một hội thoại"
                description="Tin nhắn khách từ fanpage hiện ở cột bên trái. Bấm “Tôi trả lời” để nhận khách."
                imgUrl="/assets/icons/empty/ic_mail.svg"
              />
            </Stack>
          ))}
      </Card>
    </Container>
  );
}
