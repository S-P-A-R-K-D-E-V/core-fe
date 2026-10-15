import { useRef, useEffect } from 'react';

import type { IPaymentStatusChangedEvent } from 'src/types/payment-service';

import { PAYMENT_STATUS_EVENT } from 'src/utils/payment-status';

/**
 * Gọi `onEvent` mỗi khi hub /hubs/notifications gửi `PaymentStatusChanged` (tiền về / QR hết hạn / huỷ). Dùng chung
 * kết nối của SyncNotificationProvider (phát lại thành window event), không mở kết nối thứ hai.
 *
 * Không cần useCallback cho `onEvent` — luôn gọi bản mới nhất.
 */
export function usePaymentStatusEvents(onEvent: (event: IPaymentStatusChangedEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<IPaymentStatusChangedEvent>).detail;
      if (detail) handlerRef.current(detail);
    };
    window.addEventListener(PAYMENT_STATUS_EVENT, listener);
    return () => window.removeEventListener(PAYMENT_STATUS_EVENT, listener);
  }, []);
}
