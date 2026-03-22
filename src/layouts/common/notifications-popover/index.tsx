import { m } from 'framer-motion';
import { useState, useContext, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import LinearProgress from '@mui/material/LinearProgress';

import { useBoolean } from 'src/hooks/use-boolean';
import { SyncNotificationContext } from 'src/hooks/use-sync-notification';

import { fToNow } from 'src/utils/format-time';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { varHover } from 'src/components/animate';

import type { INotification, NotificationCategory } from 'src/types/notification';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  Pending: { color: 'warning.main', icon: 'mdi:clock-outline', label: 'Đang chờ' },
  Running: { color: 'info.main', icon: 'mdi:sync', label: 'Đang chạy' },
  Completed: { color: 'success.main', icon: 'mdi:check-circle-outline', label: 'Hoàn thành' },
  Failed: { color: 'error.main', icon: 'mdi:alert-circle-outline', label: 'Thất bại' },
};

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: string; color: string; label: string }> = {
  System: { icon: 'mdi:cog-outline', color: 'text.secondary', label: 'Hệ thống' },
  Sync: { icon: 'mdi:cloud-sync-outline', color: 'info.main', label: 'Đồng bộ' },
  Attendance: { icon: 'mdi:fingerprint', color: 'success.main', label: 'Chấm công' },
  Shift: { icon: 'mdi:calendar-clock-outline', color: 'primary.main', label: 'Ca làm' },
  Payroll: { icon: 'mdi:cash-multiple', color: 'warning.main', label: 'Bảng lương' },
  Salary: { icon: 'mdi:currency-usd', color: 'error.main', label: 'Lương' },
};

const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'Attendance', label: 'Chấm công' },
  { value: 'Shift', label: 'Ca làm' },
  { value: 'Payroll', label: 'Lương' },
  { value: 'System', label: 'Hệ thống' },
];

export default function NotificationsPopover() {
  const drawer = useBoolean();
  const router = useRouter();

  const {
    // Sync (ephemeral)
    notifications: syncNotifications,
    totalUnRead,
    markAllAsRead: markSyncAllAsRead,
    removeNotification,
    // DB (persistent)
    dbNotifications,
    dbUnreadCount,
    markAsRead,
    markDbAllAsRead,
    deleteDbNotification,
    loadNotifications,
  } = useContext(SyncNotificationContext);

  const [currentTab, setCurrentTab] = useState<string>('all');

  const handleMarkAllAsRead = useCallback(() => {
    markSyncAllAsRead();
    markDbAllAsRead();
  }, [markSyncAllAsRead, markDbAllAsRead]);

  const handleRemoveSyncNotification = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification]
  );

  const handleDbNotificationClick = useCallback(
    (notification: INotification) => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
        drawer.onFalse();
      }
    },
    [markAsRead, router, drawer]
  );

  const filteredDbNotifications =
    currentTab === 'all'
      ? dbNotifications
      : dbNotifications.filter((n) => n.category === currentTab);

  const hasAnyNotifications = syncNotifications.length > 0 || dbNotifications.length > 0;

  const renderHead = (
    <Stack direction="row" alignItems="center" sx={{ py: 2, pl: 2.5, pr: 1, minHeight: 68 }}>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Thông báo
      </Typography>

      {!!totalUnRead && (
        <Tooltip title="Đánh dấu tất cả đã đọc">
          <IconButton color="primary" onClick={handleMarkAllAsRead}>
            <Iconify icon="eva:done-all-fill" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const renderTabs = (
    <Tabs
      value={currentTab}
      onChange={(_e, newValue) => setCurrentTab(newValue)}
      sx={{ px: 2.5 }}
    >
      {TABS.map((tab) => (
        <Tab key={tab.value} value={tab.value} label={tab.label} sx={{ minWidth: 'auto' }} />
      ))}
    </Tabs>
  );

  const renderEmpty = (
    <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
      <Iconify icon="solar:bell-off-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
      <Typography variant="body2" color="text.secondary">
        Không có thông báo
      </Typography>
    </Stack>
  );

  // Sync notifications (real-time ephemeral)
  const renderSyncList = syncNotifications.length > 0 && currentTab === 'all' && (
    <>
      <Typography variant="overline" sx={{ px: 2.5, py: 1, color: 'text.secondary', display: 'block' }}>
        Đồng bộ
      </Typography>
      <List disablePadding>
        {syncNotifications.map((notification) => {
          const config = STATUS_CONFIG[notification.status] || STATUS_CONFIG.Pending;
          const isRunning = notification.status === 'Running';
          const isPending = notification.status === 'Pending';

          return (
            <ListItemButton
              key={notification.id}
              sx={{
                py: 1.5,
                px: 2.5,
                ...(notification.isUnRead && { bgcolor: 'action.selected' }),
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ width: 1 }}>
                <Iconify
                  icon={config.icon}
                  width={24}
                  sx={{
                    mt: 0.5,
                    color: config.color,
                    ...(isRunning && {
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }),
                  }}
                />

                <ListItemText
                  sx={{ flex: 1 }}
                  primary={
                    <Typography variant="subtitle2" noWrap>
                      {notification.title}
                    </Typography>
                  }
                  secondary={
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {notification.message}
                      </Typography>

                      {(isRunning || isPending) && (
                        <LinearProgress
                          variant={isRunning ? 'indeterminate' : 'determinate'}
                          value={0}
                          sx={{ height: 4, borderRadius: 1 }}
                        />
                      )}

                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="caption" sx={{ color: config.color, fontWeight: 600 }}>
                          {config.label}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {fToNow(notification.createdAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />

                {(notification.status === 'Completed' || notification.status === 'Failed') && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveSyncNotification(notification.id)}
                    sx={{ mt: 0.5 }}
                  >
                    <Iconify icon="mingcute:close-line" width={16} />
                  </IconButton>
                )}
              </Stack>
            </ListItemButton>
          );
        })}
      </List>
      {filteredDbNotifications.length > 0 && <Divider sx={{ borderStyle: 'dashed' }} />}
    </>
  );

  // DB notifications (persistent)
  const renderDbList = filteredDbNotifications.length > 0 && (
    <>
      {currentTab === 'all' && (
        <Typography variant="overline" sx={{ px: 2.5, py: 1, color: 'text.secondary', display: 'block' }}>
          Thông báo
        </Typography>
      )}
      <List disablePadding>
        {filteredDbNotifications.map((notification) => {
          const catConfig = CATEGORY_CONFIG[notification.category as NotificationCategory] || CATEGORY_CONFIG.System;

          return (
            <ListItemButton
              key={notification.id}
              onClick={() => handleDbNotificationClick(notification)}
              sx={{
                py: 1.5,
                px: 2.5,
                ...(!notification.isRead && { bgcolor: 'action.selected' }),
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ width: 1 }}>
                <Iconify
                  icon={catConfig.icon}
                  width={24}
                  sx={{ mt: 0.5, color: catConfig.color }}
                />

                <ListItemText
                  sx={{ flex: 1 }}
                  primary={
                    <Typography variant="subtitle2" noWrap>
                      {notification.title}
                    </Typography>
                  }
                  secondary={
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {notification.message}
                      </Typography>

                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="caption" sx={{ color: catConfig.color, fontWeight: 600 }}>
                          {catConfig.label}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {fToNow(notification.createdAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />

                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDbNotification(notification.id);
                  }}
                  sx={{ mt: 0.5 }}
                >
                  <Iconify icon="mingcute:close-line" width={16} />
                </IconButton>
              </Stack>
            </ListItemButton>
          );
        })}
      </List>
    </>
  );

  return (
    <>
      <IconButton
        component={m.button}
        whileTap="tap"
        whileHover="hover"
        variants={varHover(1.05)}
        color={drawer.value ? 'primary' : 'default'}
        onClick={drawer.onTrue}
      >
        <Badge badgeContent={totalUnRead} color="error">
          <Iconify icon="solar:bell-bing-bold-duotone" width={24} />
        </Badge>
      </IconButton>

      <Drawer
        open={drawer.value}
        onClose={drawer.onFalse}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
        }}
        PaperProps={{
          sx: { width: 1, maxWidth: 420 },
        }}
      >
        {renderHead}

        {renderTabs}

        <Divider />

        <Scrollbar>
          {!hasAnyNotifications && currentTab === 'all' && renderEmpty}
          {filteredDbNotifications.length === 0 && syncNotifications.length === 0 && currentTab !== 'all' && renderEmpty}

          {renderSyncList}
          {renderDbList}
        </Scrollbar>

        {hasAnyNotifications && (
          <Box sx={{ p: 1 }}>
            <Button fullWidth size="large" onClick={handleMarkAllAsRead}>
              Đánh dấu tất cả đã đọc
            </Button>
          </Box>
        )}
      </Drawer>
    </>
  );
}
