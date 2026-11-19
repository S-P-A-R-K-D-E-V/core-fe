'use client';

import { useRef, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSearchParams } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  flattenMessages,
  addMessageToPages,
  MESSAGE_MAX_IMAGES,
  updateMessageInPages,
  upsertConversationPages,
} from 'src/lib/inbox';
import {
  sendTestInbound,
  useTestChannel,
  useQuickReplies,
  useConversationList,
  uploadConversationImage,
  useConversationSettings,
  useConversationMessages,
} from 'src/api/inbox';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import InboxThread from '../inbox-thread';
import InboxMessageList from '../inbox-message-list';
import { useInboxPermissions } from '../hooks/use-inbox-permissions';
import { useInboxEvents, useInboxRealtime, InboxRealtimeProvider } from '../inbox-realtime';

// ----------------------------------------------------------------------
// Kênh thử: nhân viên đóng vai khách (ô chat bên trái gửi POST conversations/test-channel/inbound — tin vào hộp thư như
// từ Facebook), bên phải là đúng khung hội thoại của Hộp thư khách để trả lời / giành quyền / ghi chú. Không cần fanpage.
// ----------------------------------------------------------------------

export function InboxTestView() {
  const { read } = useInboxPermissions();
  return (
    <InboxRealtimeProvider enabled={read}>
      <InboxTestViewInner />
    </InboxRealtimeProvider>
  );
}

const DEFAULT_NAME = 'Khách thử';

function InboxTestViewInner() {
  const settings = useSettingsContext();
  const searchParams = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { myUserId, reply, manage } = useInboxPermissions();
  const { live, applyConversation } = useInboxRealtime();
  const poll = !live;

  const { channelId, loading: channelLoading, error: channelError } = useTestChannel(reply);
  const filter = useMemo(() => ({ box: 'all' as const, channelId }), [channelId]);
  const list = useConversationList(filter, poll, !!channelId);
  const { replies } = useQuickReplies();
  const { settings: inboxSettings } = useConversationSettings();

  const [conversationId, setConversationId] = useState<string | null>(searchParams.get('c'));
  const [customerName, setCustomerName] = useState(DEFAULT_NAME);

  const msgs = useConversationMessages(conversationId, poll);
  const messages = useMemo(() => flattenMessages(msgs.pages), [msgs.pages]);

  useInboxEvents({
    onConversationUpdated: (c) => {
      if (channelId && c.channelId === channelId) {
        list.mutate((pages) => upsertConversationPages(pages, c, filter, myUserId), { revalidate: false });
      }
    },
    onMessageAdded: (m) => {
      if (m.conversationId === conversationId) msgs.mutate((pages) => addMessageToPages(pages, m), { revalidate: false });
    },
    onMessageUpdated: (m) => {
      if (m.conversationId === conversationId)
        msgs.mutate((pages) => updateMessageInPages(pages, m), { revalidate: false });
    },
  });

  const selected = list.items.find((c) => c.id === conversationId) ?? null;

  const pickConversation = (id: string) => {
    setConversationId(id || null);
    const conv = list.items.find((c) => c.id === id);
    if (conv) setCustomerName(conv.customer.name || DEFAULT_NAME);
  };

  const newCustomer = () => {
    setConversationId(null);
    setCustomerName(`${DEFAULT_NAME} ${list.items.length + 1}`);
  };

  const handleCustomerSend = async (text: string, imageUrls: string[]) => {
    const res = await sendTestInbound({
      customerName: customerName.trim() || DEFAULT_NAME,
      text: text || undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      conversationId: conversationId ?? undefined,
    });
    applyConversation(res);
    setConversationId(res.id);
    msgs.mutate();
  };

  if (!reply) {
    return (
      <Container>
        <Alert severity="warning">Kênh thử cần quyền “Trả lời khách” (conversation.reply).</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pb: 3, maxWidth: settings.themeStretch ? 'none' : 1600, mx: 'auto' }}>
      <CustomBreadcrumbs
        heading="Kênh thử hộp thư"
        links={[
          { name: 'Hộp thư khách', href: paths.dashboard.inbox.root },
          { name: 'Kênh thử' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={conversationId ? paths.dashboard.inbox.conversation(conversationId) : paths.dashboard.inbox.root}
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<Iconify icon="solar:inbox-bold" />}
          >
            Mở trong hộp thư
          </Button>
        }
        sx={{ mb: 2 }}
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Bạn đóng vai khách ở ô bên trái: tin gửi vào hộp thư như tin từ fanpage (kênh “Kênh thử”, không gửi gì lên
        Facebook). Trả lời ở bên phải sẽ hiện lại ở ô của khách.
      </Alert>

      {channelError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(channelError, 'Không mở được Kênh thử')}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {/* Ô chat của khách */}
        <Card
          sx={{
            width: { xs: 1, md: 380 },
            flexShrink: 0,
            height: { xs: 520, md: 'calc(100vh - 290px)' },
            minHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.neutral',
          }}
        >
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:user-rounded-bold" sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ flex: 1 }}>
                Khách (giả lập)
              </Typography>
              <Button size="small" onClick={newCustomer} startIcon={<Iconify icon="mingcute:add-line" />}>
                Khách mới
              </Button>
            </Stack>
            <TextField
              select
              size="small"
              label="Hội thoại thử"
              value={conversationId ?? ''}
              onChange={(e) => pickConversation(e.target.value)}
              disabled={channelLoading || list.loading}
            >
              <MenuItem value="">
                <em>— Khách mới (tin đầu tiên tạo hội thoại) —</em>
              </MenuItem>
              {list.items.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.customer.name}
                  {c.unreadCount ? ` (${c.unreadCount})` : ''}
                </MenuItem>
              ))}
              {conversationId && !selected && <MenuItem value={conversationId}>Hội thoại đang mở</MenuItem>}
            </TextField>
            <TextField
              size="small"
              label="Tên khách"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              helperText="Tên “khách” gửi kèm mỗi tin"
            />
          </Stack>
          <Divider />

          {conversationId ? (
            <InboxMessageList
              conversationId={conversationId}
              messages={messages}
              loading={msgs.loading}
              hasOlder={msgs.hasOlder}
              loadingOlder={msgs.loadingOlder}
              onLoadOlder={msgs.loadOlder}
              perspective="customer"
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 3, color: 'text.disabled' }}>
              <Iconify icon="solar:chat-round-dots-bold" width={40} />
              <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                Gõ tin đầu tiên của khách — hộp thư sẽ có hội thoại mới “Chưa ai nhận”.
              </Typography>
            </Stack>
          )}

          <CustomerComposer
            disabled={!channelId}
            onSend={handleCustomerSend}
            onError={(msg) => enqueueSnackbar(msg, { variant: 'error' })}
          />
        </Card>

        {/* Hộp thư của shop */}
        <Card
          sx={{
            flex: 1,
            minWidth: 0,
            height: { xs: 640, md: 'calc(100vh - 290px)' },
            minHeight: 480,
            display: 'flex',
          }}
        >
          {conversationId ? (
            <InboxThread
              key={conversationId}
              conversationId={conversationId}
              myUserId={myUserId}
              permissions={{ reply, manage }}
              agentMode={inboxSettings?.agentMode ?? null}
              quickReplies={replies}
              tagOptions={[]}
              panelMode="drawer"
              poll={poll}
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, color: 'text.disabled', p: 3 }}>
              {channelLoading ? (
                <CircularProgress size={28} />
              ) : (
                <Typography variant="body2">Hội thoại sẽ hiện ở đây sau khi “khách” gửi tin đầu tiên.</Typography>
              )}
            </Stack>
          )}
        </Card>
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

function Container({ children }: { children: React.ReactNode }) {
  return <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>{children}</Box>;
}

type ComposerProps = {
  disabled: boolean;
  onSend: (text: string, imageUrls: string[]) => Promise<void>;
  onError: (message: string) => void;
};

function CustomerComposer({ disabled, onSend, onError }: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (disabled || sending || uploading || (!text.trim() && !images.length)) return;
    setSending(true);
    try {
      await onSend(text.trim(), images);
      setText('');
      setImages([]);
    } catch (err) {
      onError(apiErrorMessage(err, 'Không gửi được tin của khách'));
    } finally {
      setSending(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const list = Array.from(files)
        .filter((f) => f.type === 'image/jpeg' || f.type === 'image/png')
        .slice(0, MESSAGE_MAX_IMAGES - images.length);
      const urls = await Promise.all(list.map((f) => uploadConversationImage(f)));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      onError(apiErrorMessage(err, 'Tải ảnh lên thất bại'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Box sx={{ borderTop: (theme) => `solid 1px ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
      {images.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ px: 1.5, pt: 1, flexWrap: 'wrap', rowGap: 1 }}>
          {images.map((url) => (
            <Box
              key={url}
              component="img"
              src={url}
              alt="Ảnh"
              onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
              title="Bấm để bỏ ảnh"
              sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
            />
          ))}
        </Stack>
      )}
      <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ p: 1 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <IconButton onClick={() => fileRef.current?.click()} disabled={disabled || uploading}>
          <Iconify icon={uploading ? 'svg-spinners:8-dots-rotate' : 'solar:gallery-add-bold'} />
        </IconButton>
        <InputBase
          fullWidth
          multiline
          maxRows={5}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Khách nhắn… (vd: Kẹp này còn màu hồng không?)"
          sx={{ typography: 'body2', py: 1 }}
        />
        <LoadingButton
          variant="contained"
          size="small"
          loading={sending}
          disabled={disabled || uploading || (!text.trim() && !images.length)}
          onClick={send}
          sx={{ minWidth: 0, px: 1.5, mb: 0.5 }}
        >
          <Iconify icon="solar:plain-2-bold" width={18} />
        </LoadingButton>
      </Stack>
    </Box>
  );
}
