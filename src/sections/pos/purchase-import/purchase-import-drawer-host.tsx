'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';

import {
  PURCHASE_IMPORT_OPEN_EVENT,
  type PurchaseImportOpenDetail,
} from './purchase-import-events';

// Drawer chỉ tải khi mở lần đầu (khung chat có ở mọi trang).
const PurchaseImportDrawer = dynamic(() => import('./purchase-import-drawer'), { ssr: false });

// ----------------------------------------------------------------------
// Gắn một lần ở nơi có thẻ hoá đơn (khung trợ lý): nghe "purchase-import:open" để mở drawer duyệt nhanh. Mở trang từ
// drawer thì đóng drawer rồi chuyển trang qua `onNavigate` của nơi gắn (đóng khung chat trên màn nhỏ).
// ----------------------------------------------------------------------

type Props = {
  onNavigate: (href: string) => void;
};

export default function PurchaseImportDrawerHost({ onNavigate }: Props) {
  const [importId, setImportId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const { detail } = event as CustomEvent<PurchaseImportOpenDetail>;
      if (!detail?.importId) return;
      setLoaded(true);
      setImportId(detail.importId);
    };
    window.addEventListener(PURCHASE_IMPORT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PURCHASE_IMPORT_OPEN_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setImportId(null), []);
  const navigate = useCallback(
    (href: string) => {
      setImportId(null);
      onNavigate(href);
    },
    [onNavigate]
  );

  if (!loaded) return null;
  return <PurchaseImportDrawer importId={importId} onClose={close} onNavigate={navigate} />;
}
