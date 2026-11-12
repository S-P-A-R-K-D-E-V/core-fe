import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import { getAllSalesOrders } from 'src/api/sales-orders';

import type { OutboxEntry } from '../offline/pos-outbox';

// ----------------------------------------------------------------------
// Nút trên thanh trên cùng của màn bán hàng: hoá đơn chờ đồng bộ, in lại hoá đơn gần đây, vào trang quản lý.
// ----------------------------------------------------------------------

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const dayHhmm = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? hhmm(iso) : `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${hhmm(iso)}`;
};

/** Nút nền trong suốt trên thanh màu cửa hàng (chữ + viền theo màu chữ của thanh). */
const barButtonSx = (fg: string) => ({
  color: fg,
  borderColor: alpha(fg, 0.5),
  whiteSpace: 'nowrap' as const,
  '&:hover': { borderColor: fg, bgcolor: alpha(fg, 0.12) },
});

// ----------------------------------------------------------------------
// Hoá đơn chờ đồng bộ — chỉ hiện khi có
// ----------------------------------------------------------------------

type SyncProps = {
  online: boolean;
  /** false = máy này không mở được IndexedDB, hàng chờ đang ở localStorage (kém bền hơn). */
  durable: boolean;
  /** Hoá đơn chưa lên hệ thống (chờ gửi / đang gửi / lỗi). */
  pendingSales: OutboxEntry[];
  syncing: boolean;
  onSync: () => void;
  onRetry: (sale: OutboxEntry) => void;
  onReopen: (sale: OutboxEntry) => void;
  onDiscard: (sale: OutboxEntry) => void;
};

function pendingStatusText(sale: OutboxEntry): string {
  if (sale.status === 'sending') return 'Đang gửi…';
  const tried = sale.attempts > 1 ? ` · đã thử ${sale.attempts} lần` : '';
  const next = sale.nextAttemptAt ? ` · thử lại lúc ${hhmm(sale.nextAttemptAt)}` : '';
  return `Chờ gửi${tried}${next}`;
}

export function PosSyncButton({
  online,
  durable,
  pendingSales,
  syncing,
  onSync,
  onRetry,
  onReopen,
  onDiscard,
}: SyncProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Bỏ hoá đơn lỗi: bấm 2 lần (lần đầu đổi thành "Chắc chắn bỏ?").
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const failed = pendingSales.filter((s) => s.status === 'failed').length;

  const offlineChip = online ? null : (
    <Tooltip title="Không tới được máy chủ. Vẫn bán được: hoá đơn lưu trên máy này và tự gửi lên khi có mạng lại.">
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.error.main, 0.9), color: '#fff' }}
      >
        <Iconify icon="solar:wi-fi-router-minimalistic-bold" width={16} />
        <Typography variant="caption" fontWeight={700} noWrap>
          Mất mạng
          <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
            {' '}— bán offline
          </Box>
        </Typography>
      </Stack>
    </Tooltip>
  );

  const notDurableIcon = durable ? null : (
    <Tooltip title="Trình duyệt này không cho lưu bền (IndexedDB bị chặn) — hoá đơn chờ gửi đang để ở bộ nhớ tạm của trình duyệt. Nên dùng Chrome thường, không ẩn danh.">
      <Box component="span" sx={{ display: 'inline-flex', color: theme.palette.warning.light }}>
        <Iconify icon="solar:danger-triangle-bold" width={20} />
      </Box>
    </Tooltip>
  );

  if (pendingSales.length === 0) {
    return (
      <>
        {notDurableIcon}
        {offlineChip}
      </>
    );
  }

  return (
    <>
      {notDurableIcon}
      {offlineChip}
      <Button
        size="small"
        variant="contained"
        color={failed > 0 ? 'error' : 'warning'}
        aria-label={failed > 0 ? `${failed} hoá đơn lỗi` : `Chờ đồng bộ (${pendingSales.length})`}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={
          syncing ? <CircularProgress size={14} color="inherit" /> : <Iconify icon="solar:cloud-upload-bold" />
        }
        sx={{ whiteSpace: 'nowrap', boxShadow: 'none', minWidth: 0 }}
      >
        {/* Màn hẹp: chỉ số lượng (aria-label giữ đủ chữ). */}
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {failed > 0 ? `${failed} hoá đơn lỗi` : `Chờ đồng bộ (${pendingSales.length})`}
        </Box>
        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
          {failed > 0 ? failed : pendingSales.length}
        </Box>
      </Button>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1">Hoá đơn chờ đồng bộ</Typography>
          <Typography variant="caption" color="text.secondary">
            Bán lúc mất mạng / máy chủ lỗi, đang lưu trên máy này. Có mạng lại hệ thống tự gửi; gửi lại không tạo trùng
            hoá đơn.
          </Typography>
        </Box>
        <Divider />
        <Stack divider={<Divider />} sx={{ maxHeight: 320, overflow: 'auto' }}>
          {pendingSales.map((sale) => (
            <Box key={sale.id} sx={{ px: 2, py: 1.25 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography variant="subtitle2" noWrap>
                  {sale.label}
                  {sale.customerName ? ` · ${sale.customerName}` : ''}
                </Typography>
                <Typography variant="subtitle2">{fCurrency(sale.total)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Bán lúc {dayHhmm(sale.createdAt)} · {sale.itemCount} SP
              </Typography>
              {sale.status === 'failed' ? (
                <>
                  <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
                    Máy chủ từ chối: {sale.lastError}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" disabled={syncing} onClick={() => onRetry(sale)}>
                      Gửi lại
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        onReopen(sale);
                        setAnchorEl(null);
                      }}
                    >
                      Mở lại để sửa
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant={confirmDiscardId === sale.id ? 'contained' : 'text'}
                      onClick={() => {
                        if (confirmDiscardId === sale.id) {
                          setConfirmDiscardId(null);
                          onDiscard(sale);
                        } else setConfirmDiscardId(sale.id);
                      }}
                    >
                      {confirmDiscardId === sale.id ? 'Chắc chắn bỏ?' : 'Bỏ hoá đơn'}
                    </Button>
                  </Stack>
                </>
              ) : (
                <Typography variant="caption" color="warning.dark" display="block">
                  {pendingStatusText(sale)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <Button
            fullWidth
            variant="contained"
            disabled={syncing || pendingSales.every((s) => s.status === 'failed')}
            onClick={onSync}
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:refresh-bold" />}
          >
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
          </Button>
        </Box>
      </Popover>
    </>
  );
}

// ----------------------------------------------------------------------
// In lại hoá đơn gần đây
// ----------------------------------------------------------------------

type RecentRow = { id: string; code?: string; total: number; customerName?: string; at: string };

type PrintProps = {
  fg: string;
  lastSaleId: string | null;
  /** Hoá đơn đã gửi lên từ máy này (hàng chờ, giữ 7 ngày) — dùng khi không tải được danh sách. */
  deviceSales: OutboxEntry[];
  /** Hoá đơn chưa lên hệ thống — chưa in được (chưa có trên máy chủ). */
  unsentCount: number;
  onPrint: (salesOrderId: string) => void;
};

export function PosRecentSalesButton({ fg, lastSaleId, deviceSales, unsentCount, onPrint }: PrintProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<RecentRow[] | null>(null);
  const [fromDevice, setFromDevice] = useState(false);

  const open = useCallback(
    async (target: HTMLElement) => {
      setAnchorEl(target);
      setRows(null);
      try {
        const res = await getAllSalesOrders({ pageNumber: 1, pageSize: 8 });
        setFromDevice(false);
        setRows(
          res.items.map((o) => ({
            id: o.id,
            code: o.orderNumber,
            total: o.totalAmount,
            customerName: o.customerName,
            at: o.createdAt,
          }))
        );
      } catch {
        // Không đọc được danh sách (mất mạng / không có quyền): dùng hoá đơn đã gửi lên từ máy này.
        setFromDevice(true);
        setRows(
          deviceSales.slice(0, 8).map((sale) => ({
            id: sale.serverId as string,
            total: sale.total,
            customerName: sale.customerName,
            at: sale.createdAt,
          }))
        );
      }
    },
    [deviceSales]
  );

  return (
    <>
      <Tooltip title="In lại hoá đơn gần đây">
        <IconButton aria-label="In lại hoá đơn" sx={{ color: fg }} onClick={(e) => open(e.currentTarget)}>
          <Badge color="warning" variant="dot" invisible={!lastSaleId}>
            <Iconify icon="solar:printer-bold" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 340 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <Typography variant="subtitle2">In lại hoá đơn</Typography>
          <Typography variant="caption" color="text.secondary">
            {fromDevice ? 'Không tải được danh sách — hoá đơn vừa bán trên máy này' : 'Hoá đơn gần đây'}
          </Typography>
          {unsentCount > 0 && (
            <Typography variant="caption" color="warning.dark" display="block">
              {unsentCount} hoá đơn chưa lên hệ thống — in được sau khi đồng bộ
            </Typography>
          )}
        </Box>
        {rows === null && (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={20} />
          </Stack>
        )}
        {rows?.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
            Chưa có hoá đơn nào.
          </Typography>
        )}
        {rows?.map((row) => (
          <MenuItem
            key={row.id}
            onClick={() => {
              setAnchorEl(null);
              onPrint(row.id);
            }}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <Iconify icon="solar:printer-minimalistic-bold" width={18} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ fontFamily: 'monospace' }}>
                    {row.code || 'Vừa bán'}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {fCurrency(row.total)}
                  </Typography>
                </Stack>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" noWrap component="span" display="block">
                  {dayHhmm(row.at)}
                  {row.customerName ? ` · ${row.customerName}` : ''}
                  {row.id === lastSaleId ? ' · vừa bán' : ''}
                </Typography>
              }
            />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem component={RouterLink} href={paths.dashboard.pos.salesOrder.root} onClick={() => setAnchorEl(null)}>
          <ListItemIcon>
            <Iconify icon="solar:list-bold" width={18} />
          </ListItemIcon>
          <ListItemText primary="Xem tất cả đơn bán hàng" primaryTypographyProps={{ variant: 'body2' }} />
        </MenuItem>
      </Menu>
    </>
  );
}

// ----------------------------------------------------------------------
// Vào trang quản lý
// ----------------------------------------------------------------------

const MANAGE_LINKS = [
  { label: 'Trang quản lý', icon: 'solar:home-2-bold', href: paths.dashboard.root },
  { label: 'Đơn bán hàng', icon: 'solar:bill-list-bold', href: paths.dashboard.pos.salesOrder.root },
  { label: 'Hàng hoá', icon: 'solar:box-bold', href: paths.dashboard.pos.product.root },
  { label: 'Tồn kho', icon: 'solar:archive-bold', href: paths.dashboard.pos.inventory.root },
  { label: 'Khách hàng', icon: 'solar:users-group-rounded-bold', href: paths.dashboard.pos.customer.root },
];

export function PosManageMenu({ fg, unsentCount = 0 }: { fg: string; unsentCount?: number }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        aria-label="Vào trang quản lý"
        startIcon={<Iconify icon="solar:widget-5-bold" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          ...barButtonSx(fg),
          minWidth: 0,
          px: { xs: 0.75, lg: 1.25 },
          '& .MuiButton-startIcon': { mr: { xs: 0, lg: 1 }, ml: 0 },
        }}
      >
        {/* Màn hẹp chỉ còn biểu tượng */}
        <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
          Quản lý
        </Box>
      </Button>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
          Đơn tạm vẫn được giữ trên máy
        </Typography>
        {unsentCount > 0 && (
          <Typography variant="caption" color="warning.dark" sx={{ px: 2, pb: 0.5, display: 'block', maxWidth: 260 }}>
            Còn {unsentCount} hoá đơn chưa gửi — chỉ gửi khi màn bán hàng đang mở. Quay lại màn này để đồng bộ.
          </Typography>
        )}
        {MANAGE_LINKS.map((link) => (
          <MenuItem key={link.href} component={RouterLink} href={link.href} onClick={() => setAnchorEl(null)}>
            <ListItemIcon>
              <Iconify icon={link.icon} width={18} />
            </ListItemIcon>
            <ListItemText primary={link.label} primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
