'use client';

import { useEffect } from 'react';

import { getStorageUrl } from 'src/utils/storage';

import { getCustomerDisplayConfig } from 'src/api/customer-display';

import { useStoreBrand } from 'src/components/branding';

import { customerDisplay, type CustomerDisplayCart } from './customer-display-bus';

// ----------------------------------------------------------------------
// Trang bán hàng: đẩy giỏ hàng đang bán + quảng cáo của chi nhánh sang màn hình khách. Rời trang bán hàng → màn khách
// về quảng cáo.

const REFRESH_MS = 60 * 60_000;

export function useCustomerDisplaySync(cart: CustomerDisplayCart | null, branchId: string | null | undefined) {
  const { brandName } = useStoreBrand();

  useEffect(() => {
    const id = setTimeout(() => customerDisplay.setCart(cart), 120);
    return () => clearTimeout(id);
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getCustomerDisplayConfig(branchId)
        .then((config) => {
          if (cancelled) return;
          customerDisplay.setAds(
            {
              intervalSeconds: config.intervalSeconds,
              // url: link tải có chữ ký (Range — video phát được trên Safari); thiếu thì qua /media/<key>.
              slides: config.slides.map((s) => ({ url: s.url || getStorageUrl(s.key), kind: s.kind, title: s.title ?? null })),
            },
            brandName
          );
        })
        .catch(() => {
          if (!cancelled) customerDisplay.setAds(null, brandName);
        });
    load();
    // Link có chữ ký sống 24 giờ — trang bán hàng mở cả ngày thì nạp lại mỗi giờ.
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [branchId, brandName]);

  useEffect(
    () => () => {
      customerDisplay.setQr(null);
      customerDisplay.setCart(null);
    },
    []
  );
}
