import { useId, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { CHATBOT_MAX_CONTENT_LENGTH } from 'src/api/chatbot';

import Iconify from 'src/components/iconify';

import {
  findCommand,
  commandsFor,
  commandUsage,
  expandCommand,
  filterCommands,
  parseSlashInput,
  type ChatbotCommand,
  type ChatbotLocalCommandId,
} from './chatbot-commands';

import type { ChatbotAudience } from './chatbot-quick-actions';

// ----------------------------------------------------------------------
// Ô soạn tin: hàng chip câu hỏi nhanh (cuộn ngang), danh sách lệnh "/…" neo phía trên ô nhập (vẽ
// NGAY TRONG khung chat — khung ở zIndex 1400, popover của MUI ở 1300 sẽ bị che), ô nhập nhiều dòng.
//
// Bàn phím: Enter gửi, Shift+Enter xuống dòng. Khi danh sách lệnh mở: ↑/↓ chọn, Enter hoặc Tab lấy
// lệnh đang chọn, Esc đóng. Gõ chữ vẫn được trong lúc trợ lý đang trả lời — chỉ nút gửi bị khoá.
// ----------------------------------------------------------------------

/** Hiện bộ đếm ký tự khi vượt mốc này. */
const COUNTER_FROM = 1800;

export type ChatbotChip = {
  key: string;
  label: string;
  /** Chú thích khi rê chuột (vd câu thật sự gửi đi nếu khác nhãn). */
  title?: string;
  icon?: string;
  onClick: () => void;
};

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  audience: ChatbotAudience;
  /** Đã có phiên — chưa có thì chưa gửi được. */
  ready: boolean;
  /** Trợ lý đang trả lời — khoá gửi, vẫn cho gõ. */
  busy: boolean;
  autoFocus?: boolean;
  chips: ChatbotChip[];
  chipsLabel: string;
  /** Gửi một câu hỏi (lệnh "/…" đã được đổi thành câu hỏi đầy đủ). */
  onSend: (text: string) => void;
  onLocalCommand: (id: Exclude<ChatbotLocalCommandId, 'help'>) => void;
};

export default function ChatbotComposer({
  draft,
  onDraftChange,
  inputRef,
  audience,
  ready,
  busy,
  autoFocus,
  chips,
  chipsLabel,
  onSend,
  onLocalCommand,
}: Props) {
  const baseId = useId();
  const listId = `${baseId}-commands`;
  const optionId = (index: number) => `${baseId}-command-${index}`;

  /** Danh sách đầy đủ mở bằng nút "/" hoặc lệnh /trogiup (không phụ thuộc chữ đang gõ). */
  const [showAll, setShowAll] = useState(false);
  /** Chữ đang có lúc người dùng bấm Esc — danh sách đóng cho tới khi chữ đổi. */
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const parsed = parseSlashInput(draft);
  const typingCommand = !!parsed && !parsed.hasArg;

  let matches: ChatbotCommand[] = [];
  if (showAll) matches = commandsFor(audience);
  else if (typingCommand) matches = filterCommands(draft, audience);

  const menuOpen = matches.length > 0 && (showAll || dismissedAt !== draft);
  const index = Math.min(activeIndex, Math.max(matches.length - 1, 0));

  // Đang gõ tham số của một lệnh câu hỏi ("/doanhthu tuần trước") → gợi ý tham số + câu sẽ gửi.
  const argCommand = parsed?.hasArg ? findCommand(draft, audience) : null;
  const preview = argCommand?.kind === 'prompt' ? argCommand.build(parsed?.arg ?? '') : null;

  const trimmed = draft.trim();
  const isLocalCommand = expandCommand(trimmed, audience)?.kind === 'local';
  const canSubmit = trimmed.length > 0 && (isLocalCommand || (ready && !busy));

  const activeOptionId = menuOpen ? optionId(index) : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    // jsdom không có scrollIntoView.
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);

  const focusInput = (value?: string) => {
    // Chờ React ghi value mới rồi mới đặt con trỏ về cuối.
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (typeof value === 'string') el.setSelectionRange(value.length, value.length);
    }, 0);
  };

  const closeMenu = () => {
    setShowAll(false);
    setDismissedAt(draft);
  };

  const runLocal = (id: ChatbotLocalCommandId) => {
    if (id === 'help') {
      setShowAll(true);
      setActiveIndex(0);
      focusInput();
      return;
    }
    onLocalCommand(id);
  };

  const submit = () => {
    if (!trimmed) return;
    const result = expandCommand(trimmed, audience);

    if (result?.kind === 'local') {
      onDraftChange('');
      setShowAll(false);
      runLocal(result.id);
      return;
    }

    // Chưa có phiên / trợ lý đang trả lời: chưa gửi — chữ vẫn nằm trong ô.
    if (!ready || busy) return;

    const text = result?.kind === 'prompt' ? result.text : trimmed;
    if (text.length > CHATBOT_MAX_CONTENT_LENGTH) {
      setNotice(`Câu hỏi dài quá ${CHATBOT_MAX_CONTENT_LENGTH} ký tự — bạn rút gọn bớt nhé.`);
      return;
    }
    onDraftChange('');
    setShowAll(false);
    onSend(text);
  };

  const choose = (command: ChatbotCommand) => {
    setShowAll(false);
    setDismissedAt(null);
    setActiveIndex(0);

    if (command.kind === 'local') {
      // Xoá chữ "/…" đang gõ; câu thường đang gõ dở (mở danh sách bằng nút "/") thì giữ nguyên.
      if (parsed) onDraftChange('');
      runLocal(command.id);
      return;
    }

    // Lệnh câu hỏi: điền "/tên " để gõ tiếp tham số — Enter mới gửi. Câu thường đang gõ dở trở
    // thành tham số của lệnh.
    const carry = parsed ? parsed.arg : trimmed;
    const next = `/${command.name} ${carry}`;
    onDraftChange(next);
    focusInput(next);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setShowAll(false);
    setActiveIndex(0);
    setNotice(null);
    onDraftChange(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Đang gõ dở bằng bộ gõ (IME): Enter là chốt chữ, không phải gửi.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        const active = matches[index];
        // Đã gõ đủ đúng tên lệnh đang chọn rồi bấm Enter → chạy / gửi luôn, khỏi bấm hai lần.
        if (event.key === 'Enter' && !showAll && findCommand(draft, audience) === active) {
          submit();
        } else {
          choose(active);
        }
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleToggleAll = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      setShowAll(true);
      setActiveIndex(0);
    }
    focusInput();
  };

  const handleClickAway = () => {
    if (menuOpen) closeMenu();
  };

  const overCounter = draft.length > COUNTER_FROM;
  const chipsDisabled = !ready || busy;

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        sx={{ position: 'relative', flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
      >
        {menuOpen && (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: '100%',
              mb: 0.5,
              zIndex: 2,
              maxHeight: 288,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 1.5,
            }}
          >
            <Box
              id={listId}
              role="listbox"
              aria-label="Danh sách lệnh"
              sx={{ p: 0.5, minHeight: 0, overflowY: 'auto' }}
            >
              {matches.map((command, i) => {
                const selected = i === index;
                return (
                  <Stack
                    key={command.name}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    // Giữ focus ở ô nhập khi bấm chuột vào danh sách.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(command)}
                    sx={{
                      px: 1,
                      py: 0.75,
                      minWidth: 0,
                      cursor: 'pointer',
                      borderRadius: 1,
                      bgcolor: selected ? 'action.selected' : 'transparent',
                    }}
                  >
                    <Iconify
                      icon={command.icon}
                      width={20}
                      sx={{ flexShrink: 0, color: selected ? 'primary.main' : 'text.secondary' }}
                    />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {command.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: 'block' }}
                      >
                        {command.description}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        flexShrink: 0,
                        maxWidth: '50%',
                        fontFamily: 'monospace',
                        color: selected ? 'primary.main' : 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {commandUsage(command)}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
            <Typography
              variant="caption"
              color="text.disabled"
              noWrap
              sx={{
                display: 'block',
                flexShrink: 0,
                px: 1.5,
                py: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              ↑ ↓ để chọn · Enter hoặc Tab để lấy lệnh · Esc để đóng
            </Typography>
          </Paper>
        )}

        {chips.length > 0 && (
          <Stack
            // Bộ chip đổi (gợi ý theo ngữ cảnh ↔ mặc định) → dựng lại để vị trí cuộn về đầu hàng.
            key={chips[0].key}
            direction="row"
            spacing={0.75}
            role="group"
            aria-label={chipsLabel}
            // Chuột thường không cuộn ngang được → đổi lăn dọc thành cuộn ngang trên hàng chip.
            onWheel={(event) => {
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.currentTarget.scrollLeft += event.deltaY;
              }
            }}
            sx={{
              px: 1.5,
              pt: 1,
              overflowX: 'auto',
              // Cuộn ngang được nhưng không hiện thanh cuộn; mép phải mờ dần báo còn chip phía sau.
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
            }}
          >
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                size="small"
                variant="outlined"
                color="primary"
                label={chip.label}
                title={chip.title}
                disabled={chipsDisabled}
                onClick={chip.onClick}
                icon={chip.icon ? <Iconify icon={chip.icon} width={16} /> : undefined}
                sx={{ flexShrink: 0 }}
              />
            ))}
            {/* Khoảng đệm cuối hàng để chip cuối không nằm dưới mép mờ. */}
            <Box aria-hidden sx={{ flex: '0 0 16px' }} />
          </Stack>
        )}

        {argCommand && (
          <Box sx={{ px: 1.5, pt: 0.75, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              <Box component="span" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                {commandUsage(argCommand)}
              </Box>
              {argCommand.kind === 'prompt' ? ' — Enter để gửi' : ' — Enter để chạy'}
            </Typography>
            {preview && (
              <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                Sẽ gửi: “{preview}”
              </Typography>
            )}
          </Box>
        )}

        <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ p: 1.5, pt: 1 }}>
          <Tooltip title="Lệnh nhanh">
            <IconButton
              size="small"
              aria-label="Mở danh sách lệnh"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? listId : undefined}
              onClick={handleToggleAll}
              sx={{
                mb: '2px',
                width: 30,
                height: 30,
                flexShrink: 0,
                color: menuOpen ? 'primary.main' : 'text.secondary',
              }}
            >
              <Box
                component="span"
                sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
              >
                /
              </Box>
            </IconButton>
          </Tooltip>

          <InputBase
            fullWidth
            multiline
            maxRows={5}
            autoFocus={autoFocus}
            value={draft}
            inputRef={inputRef}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn… gõ / để xem lệnh"
            inputProps={{
              maxLength: CHATBOT_MAX_CONTENT_LENGTH,
              'aria-label': 'Nhập tin nhắn',
              'aria-autocomplete': 'list',
              'aria-controls': menuOpen ? listId : undefined,
              'aria-activedescendant': activeOptionId,
            }}
            sx={{
              px: 1.25,
              py: 0.75,
              fontSize: 14,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: (theme) => theme.transitions.create(['border-color', 'box-shadow']),
              '&.Mui-focused': {
                borderColor: 'primary.main',
                boxShadow: (theme) => `0 0 0 2px ${alpha(theme.palette.primary.main, 0.16)}`,
              },
            }}
          />

          <Tooltip title={busy ? 'Trợ lý đang trả lời…' : 'Gửi (Enter)'}>
            {/* span: Tooltip không nhận sự kiện từ nút đang disabled */}
            <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
              <IconButton
                color="primary"
                aria-label="Gửi tin nhắn"
                disabled={!canSubmit}
                onClick={submit}
                sx={{ width: 34, height: 34 }}
              >
                <Iconify icon="solar:plain-bold" />
              </IconButton>
            </Box>
          </Tooltip>
        </Stack>

        {(overCounter || notice) && (
          <Stack
            direction="row"
            justifyContent="space-between"
            spacing={1}
            sx={{ px: 1.75, pb: 1, mt: -0.75 }}
          >
            <Typography variant="caption" color="error" role={notice ? 'alert' : undefined}>
              {notice}
            </Typography>
            {overCounter && (
              <Typography
                variant="caption"
                sx={{
                  flexShrink: 0,
                  color:
                    draft.length >= CHATBOT_MAX_CONTENT_LENGTH ? 'error.main' : 'text.secondary',
                }}
              >
                {draft.length}/{CHATBOT_MAX_CONTENT_LENGTH}
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </ClickAwayListener>
  );
}
