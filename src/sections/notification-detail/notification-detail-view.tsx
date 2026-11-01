'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';
import { isInternalActionUrl } from 'src/utils/notification-links';

import { getNotification, markNotificationAsRead } from 'src/api/notifications';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { INotification } from 'src/types/notification';

// ----------------------------------------------------------------------
// Chi tiết thông báo: toàn bộ nội dung và nút tới trang tính năng nếu có. Mở trang này là đã đọc.
// ----------------------------------------------------------------------

export default function NotificationDetailView({ id }: { id: string }) {
  const settings = useSettingsContext();
  const router = useRouter();
  const [item, setItem] = useState<INotification | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getNotification(id)
      .then((result) => {
        if (cancelled) return;
        setItem(result);
        if (!result.isRead) markNotificationAsRead(id).catch(() => {});
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Không tải được thông báo'));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const link = item?.actionUrl && isInternalActionUrl(item.actionUrl) ? item.actionUrl : null;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs heading="Chi tiết thông báo" links={[{ name: 'Thông báo' }, { name: 'Chi tiết' }]} sx={{ mb: 2 }} />
      {error && <Typography color="error">{error}</Typography>}
      {!item && !error && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}
      {item && (
        <Card>
          <CardContent>
            <Typography variant="h5">{item.title}</Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, mb: 2 }}>
              {fDateTime(item.createdAt, 'HH:mm dd/MM/yyyy')}
              {item.createdByName ? ` · ${item.createdByName}` : ''}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</Typography>
            {link && (
              <Button
                variant="contained"
                endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
                onClick={() => router.push(link)}
                sx={{ mt: 3 }}
              >
                Mở trang liên quan
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
