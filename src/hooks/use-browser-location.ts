'use client';

import { useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// Vị trí trình duyệt để xem camera chấm công khi không phải Admin: máy chủ chỉ cho xem nếu đang ở cửa hàng có camera
// (StoreCameraAccess phía Core-be — cùng ngưỡng sai số GPS 200 m với chấm công). Theo dõi liên tục để lần gia hạn
// quyền xem (mỗi phút) dùng vị trí mới nhất.

export type BrowserPosition = { latitude: number; longitude: number; accuracy: number };

export type BrowserLocationState = {
  position: BrowserPosition | null;
  /** Lý do không lấy được vị trí (bị từ chối quyền, trình duyệt không hỗ trợ…). */
  error: string | null;
};

export function useBrowserLocation(enabled: boolean): BrowserLocationState {
  const [position, setPosition] = useState<BrowserPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError(null);
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị — dùng điện thoại hoặc máy có GPS/Wi-Fi.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy });
        setError(null);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Bạn đã chặn quyền định vị — cho phép vị trí cho trang này để xem camera khi ở cửa hàng.'
            : 'Chưa lấy được vị trí — bật định vị (GPS/Wi-Fi) rồi thử lại.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { position, error };
}
