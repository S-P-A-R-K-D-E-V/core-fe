import { useEffect } from 'react';
import type { INotification } from 'src/types/notification';

/**
 * Gọi `onRefresh()` mỗi khi có SignalR NewNotification với category === 'Shift'.
 * Dùng trong bất kỳ view nào cần real-time update khi có thao tác ca liên quan.
 *
 * Đảm bảo `onRefresh` là stable reference (useCallback) để tránh effect loop.
 */
export function useShiftNotificationRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handler = (ev: Event) => {
      const notification = (ev as CustomEvent<INotification>).detail;
      if (notification.category === 'Shift') {
        onRefresh();
      }
    };
    window.addEventListener('shift-notification', handler);
    return () => window.removeEventListener('shift-notification', handler);
  }, [onRefresh]);
}
