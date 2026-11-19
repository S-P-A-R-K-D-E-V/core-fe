'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';
import { useSnackbar } from 'src/components/snackbar';
import Iconify from 'src/components/iconify';

import {
  IZaloBotChat,
  checkZaloBotToken,
  getZaloBotUpdates,
  testSendZaloBot,
} from 'src/api/zalo-bot';

import { uniqueZaloChats, zaloChatTypeLabel } from './notification-types';

// ----------------------------------------------------------------------
// Trợ giúp cấu hình Zalo Bot (A3): kiểm tra token, lấy chat id từ tin người nhận đã nhắn bot, gửi thử.
// ----------------------------------------------------------------------

type Props = {
  token: string;
  chatId: string;
  /** Bấm một chat trong danh sách → điền chat id (+ tên nếu đang trống). */
  onPickChat: (chat: IZaloBotChat) => void;
};

export default function ZaloBotHelper({ token, chatId, onPickChat }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [loadingChats, setLoadingChats] = useState(false);
  const [chats, setChats] = useState<IZaloBotChat[] | null>(null);
  const [chatsMessage, setChatsMessage] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  const trimmedToken = token.trim();
  const trimmedChatId = chatId.trim();

  const requireToken = () => {
    if (trimmedToken) return true;
    enqueueSnackbar('Dán Bot Token trước', { variant: 'warning' });
    return false;
  };

  const handleCheck = async () => {
    if (!requireToken()) return;
    setChecking(true);
    try {
      const res = await checkZaloBotToken(trimmedToken);
      const text = res.ok
        ? `Token dùng được${res.botName ? ` — bot "${res.botName}"` : ''}${res.message ? `. ${res.message}` : ''}`
        : res.message || 'Token không dùng được';
      setCheckResult({ ok: res.ok, text });
    } catch (error) {
      setCheckResult({ ok: false, text: apiErrorMessage(error, 'Không kiểm tra được token') });
    } finally {
      setChecking(false);
    }
  };

  const handleUpdates = async () => {
    if (!requireToken()) return;
    setLoadingChats(true);
    try {
      const res = await getZaloBotUpdates(trimmedToken);
      setChats(uniqueZaloChats(res.chats));
      setChatsMessage(res.message || null);
    } catch (error) {
      setChats([]);
      setChatsMessage(apiErrorMessage(error, 'Không lấy được danh sách chat'));
    } finally {
      setLoadingChats(false);
    }
  };

  const handleTestSend = async () => {
    if (!requireToken()) return;
    if (!trimmedChatId) {
      enqueueSnackbar('Chưa có Chat ID — bấm "Lấy chat id" rồi chọn người nhận', {
        variant: 'warning',
      });
      return;
    }
    setSending(true);
    try {
      const res = await testSendZaloBot(trimmedToken, trimmedChatId);
      enqueueSnackbar(res.message || (res.ok ? 'Đã gửi tin thử' : 'Gửi thử thất bại'), {
        variant: res.ok ? 'success' : 'error',
      });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Gửi thử thất bại'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        <Typography variant="body2" component="div">
          1. Trong app Zalo, mở OA <b>Zalo Bot Manager</b> → <b>Tạo bot</b> (tên bắt đầu bằng
          &quot;Bot&quot;), chép Bot Token dán vào ô trên.
          <br />
          2. Mỗi người nhận nhắn bot một tin bất kỳ, rồi bấm <b>Lấy chat id</b> và chọn đúng người.
          <br />
          Mỗi người nhận là một dòng cấu hình (dùng chung token được). Bot chỉ báo &quot;có việc cần
          quyết&quot; kèm link mở app, không gửi số liệu.
        </Typography>
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <LoadingButton
          size="small"
          variant="outlined"
          loading={checking}
          onClick={handleCheck}
          startIcon={<Iconify icon="solar:shield-check-bold" />}
        >
          Kiểm tra token
        </LoadingButton>
        <LoadingButton
          size="small"
          variant="outlined"
          loading={loadingChats}
          onClick={handleUpdates}
          startIcon={<Iconify icon="solar:users-group-rounded-bold" />}
        >
          Lấy chat id
        </LoadingButton>
        <LoadingButton
          size="small"
          variant="outlined"
          loading={sending}
          onClick={handleTestSend}
          startIcon={<Iconify icon="solar:plain-bold" />}
        >
          Gửi thử
        </LoadingButton>
      </Stack>

      {checkResult && (
        <Alert severity={checkResult.ok ? 'success' : 'error'} onClose={() => setCheckResult(null)}>
          {checkResult.text}
        </Alert>
      )}

      {chats !== null && chats.length === 0 && (
        <Alert severity="warning" onClose={() => setChats(null)}>
          {chatsMessage || 'Chưa thấy tin nhắn nào.'} Nhắn một tin cho bot trong app Zalo rồi bấm
          lại &quot;Lấy chat id&quot;.
        </Alert>
      )}

      {chats !== null && chats.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Bấm vào người nhận để điền Chat ID{chatsMessage ? ` — ${chatsMessage}` : ''}
          </Typography>
          <List dense disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {chats.map((chat) => {
              const typeLabel = zaloChatTypeLabel(chat.chatType);
              return (
                <ListItemButton
                  key={chat.chatId}
                  selected={chat.chatId === trimmedChatId}
                  onClick={() => onPickChat(chat)}
                >
                  <ListItemText
                    primary={`${chat.name || 'Không rõ tên'}${typeLabel ? ` · ${typeLabel}` : ''}`}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ fontFamily: 'monospace', display: 'block' }}
                        >
                          {chat.chatId}
                        </Typography>
                        {chat.text && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ display: 'block' }}
                          >
                            &quot;{chat.text}&quot;
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Stack>
      )}
    </Stack>
  );
}
