import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Header của khung chat: tên trợ lý theo đối tượng (do widget tính từ phiên của server), dòng trạng
// thái kết nối, và 3 nút: Trò chuyện mới · Mở rộng / Thu nhỏ · Đóng.
// ----------------------------------------------------------------------

export type ChatbotHeaderStatus = 'connecting' | 'ready' | 'replying' | 'offline';

const STATUS_TEXT: Record<ChatbotHeaderStatus, string> = {
  connecting: 'Đang kết nối…',
  ready: 'Sẵn sàng',
  replying: 'Đang trả lời…',
  offline: 'Mất kết nối',
};

const STATUS_COLOR: Record<ChatbotHeaderStatus, string> = {
  connecting: 'warning.light',
  ready: 'success.light',
  replying: 'info.light',
  offline: 'error.light',
};

type Props = {
  title: string;
  icon: string;
  status: ChatbotHeaderStatus;
  /** Mã phiên — chỉ hiện (rút gọn) trong tooltip của dòng trạng thái. */
  sessionId?: string | null;
  /** Chưa sẵn sàng thì chưa bắt đầu trò chuyện mới được. */
  canStartNew: boolean;
  expanded: boolean;
  /** Màn nhỏ: khung luôn toàn màn hình nên không có nút mở rộng. */
  showExpand: boolean;
  onNewSession: () => void;
  onToggleExpand: () => void;
  onClose: () => void;
};

export default function ChatbotHeader({
  title,
  icon,
  status,
  sessionId,
  canStartNew,
  expanded,
  showExpand,
  onNewSession,
  onToggleExpand,
  onClose,
}: Props) {
  const expandLabel = expanded ? 'Thu nhỏ' : 'Mở rộng';

  const statusLine = (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{ width: 'fit-content', maxWidth: 1 }}
    >
      <Box
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          flexShrink: 0,
          borderRadius: '50%',
          bgcolor: STATUS_COLOR[status],
        }}
      />
      <Typography variant="caption" noWrap sx={{ opacity: 0.85 }}>
        {STATUS_TEXT[status]}
      </Typography>
    </Stack>
  );

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        px: 1.5,
        py: 1.25,
        flexShrink: 0,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.dark', color: 'inherit' }}>
        <Iconify icon={icon} width={20} />
      </Avatar>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" component="h2" noWrap sx={{ lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Box role="status" aria-live="polite">
          {sessionId ? (
            // describeChild: tooltip chỉ mô tả thêm, không thay chữ trạng thái bằng aria-label.
            <Tooltip
              describeChild
              title={`Mã phiên: ${sessionId.slice(0, 8)}…`}
              placement="bottom-start"
            >
              {statusLine}
            </Tooltip>
          ) : (
            statusLine
          )}
        </Box>
      </Box>

      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
        <Tooltip title="Trò chuyện mới">
          {/* span: Tooltip không nhận sự kiện từ nút đang disabled */}
          <span>
            <IconButton
              size="small"
              aria-label="Trò chuyện mới"
              disabled={!canStartNew}
              onClick={onNewSession}
              sx={{ color: 'inherit', '&.Mui-disabled': { color: 'inherit', opacity: 0.4 } }}
            >
              <Iconify icon="solar:pen-new-square-bold" />
            </IconButton>
          </span>
        </Tooltip>

        {showExpand && (
          <Tooltip title={expandLabel}>
            <IconButton
              size="small"
              aria-label={expandLabel}
              onClick={onToggleExpand}
              sx={{ color: 'inherit' }}
            >
              <Iconify icon={expanded ? 'eva:collapse-fill' : 'eva:expand-fill'} />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Đóng">
          <IconButton size="small" aria-label="Đóng" onClick={onClose} sx={{ color: 'inherit' }}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
