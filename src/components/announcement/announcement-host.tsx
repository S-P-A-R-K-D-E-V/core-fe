'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import { useRouter, usePathname } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { markAnnouncementSeen, acknowledgeAnnouncement, getPendingAnnouncements } from 'src/api/announcements';

import { useSnackbar } from 'src/components/snackbar';

import type { IPendingAnnouncement } from 'src/types/announcement';

import AnnouncementDialog from './announcement-dialog';
import { mergeQueue, shouldCheck, isInternalPath } from './utils';

// ----------------------------------------------------------------------
// Đặt ở dashboard layout. Hỏi API khi đăng nhập và khi chuyển trang, có giãn cách (CHECK_INTERVAL_MS), không hỏi theo lần render. Hiện lần
// lượt từng thông báo. Lỗi tải (cửa hàng không có gói, mạng) bỏ qua: popup không được cản việc đang làm.
// ----------------------------------------------------------------------

export default function AnnouncementHost() {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const userId: string | undefined = user?.id;
  const [queue, setQueue] = useState<IPendingAnnouncement[]>([]);
  const [busy, setBusy] = useState(false);
  const lastCheckAt = useRef(0);
  const handled = useRef(new Set<string>());
  const seenSent = useRef(new Set<string>());

  useEffect(() => {
    lastCheckAt.current = 0;
    handled.current = new Set();
    seenSent.current = new Set();
    setQueue([]);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const now = Date.now();
    if (!shouldCheck(lastCheckAt.current, now)) return;
    lastCheckAt.current = now;
    getPendingAnnouncements()
      .then((list) => setQueue((current) => mergeQueue(current, list, handled.current)))
      .catch(() => {});
  }, [userId, pathname]);

  const current = queue[0] ?? null;
  const currentId = current?.id;

  useEffect(() => {
    if (!currentId || seenSent.current.has(currentId)) return;
    seenSent.current.add(currentId);
    markAnnouncementSeen(currentId).catch(() => {});
  }, [currentId]);

  const finish = useCallback((id: string) => {
    handled.current.add(id);
    setQueue((list) => list.filter((a) => a.id !== id));
  }, []);

  /** true = xong, đi tiếp được. Thông báo đã bị xoá (404) coi như xong. */
  const acknowledge = useCallback(
    async (announcement: IPendingAnnouncement): Promise<boolean> => {
      setBusy(true);
      try {
        await acknowledgeAnnouncement(announcement.id);
        finish(announcement.id);
        return true;
      } catch (err: any) {
        if (!announcement.requireAck || err?.status === 404) {
          finish(announcement.id);
          return true;
        }
        enqueueSnackbar(apiErrorMessage(err, 'Chưa xác nhận được, thử lại nhé.'), { variant: 'error' });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [finish, enqueueSnackbar]
  );

  if (!current) return null;

  return (
    <AnnouncementDialog
      key={current.id}
      announcement={current}
      remaining={queue.length - 1}
      busy={busy}
      onDismiss={() => finish(current.id)}
      onAcknowledge={() => acknowledge(current)}
      onCta={async () => {
        const url = current.ctaUrl;
        if (await acknowledge(current)) {
          if (isInternalPath(url)) router.push(url);
        }
      }}
    />
  );
}
