'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------
// Ảnh đính kèm của thông báo: rộng bằng khung, giữ tỉ lệ, không cắt, cuộn cùng nội dung. Link ký có hạn nên popup mở lâu có thể gặp link
// hết hạn: lỗi lần đầu thì xin link mới một lần (nếu có onRefresh). Vẫn lỗi thì báo và cho thử lại, chữ và nút "Đã hiểu" không bị ảnh hưởng.
// ----------------------------------------------------------------------

type Props = {
  src: string;
  alt: string;
  /** Xin link mới, trả về null nếu không còn ảnh. */
  onRefresh?: () => Promise<string | null>;
};

export default function AnnouncementImage({ src, alt, onRefresh }: Props) {
  const [shown, setShown] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const refreshed = useRef(false);

  useEffect(() => {
    setShown(src);
    setFailed(false);
    refreshed.current = false;
  }, [src]);

  const handleError = async () => {
    if (onRefresh && !refreshed.current) {
      refreshed.current = true;
      const fresh = await onRefresh().catch(() => null);
      if (fresh && fresh !== shown) {
        setShown(fresh);
        return;
      }
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <Alert
        severity="warning"
        sx={{ mt: 2 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              refreshed.current = false;
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Thử lại
          </Button>
        }
      >
        Không tải được ảnh đính kèm.
      </Alert>
    );
  }

  return (
    <Box
      key={attempt}
      component="img"
      src={shown}
      alt={alt}
      onError={handleError}
      sx={{ mt: 2, width: 1, height: 'auto', display: 'block', borderRadius: 1 }}
    />
  );
}
