'use client';

import { useEffect } from 'react';

import { getStorageUrl } from 'src/utils/storage';

import { getCustomerDisplayConfig } from 'src/api/customer-display';

import { useStoreBrand } from 'src/components/branding';

import { customerDisplay, type CustomerDisplayCart } from './customer-display-bus';

// ----------------------------------------------------------------------
// Trang bán hàng: đẩy giỏ hàng đang bán + quảng cáo của chi nhánh sang màn hình khách. Rời trang bán hàng → màn khách
// về quảng cáo.

export function useCustomerDisplaySync(cart: CustomerDisplayCart | null, branchId: string | null | undefined) {
  const { brandName } = useStoreBrand();

  useEffect(() => {
    const id = setTimeout(() => customerDisplay.setCart(cart), 120);
    return () => clearTimeout(id);
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    getCustomerDisplayConfig(branchId)
      .then((config) => {
        if (cancelled) return;
        customerDisplay.setAds(
          {
            intervalSeconds: config.intervalSeconds,
            slides: config.slides.map((s) => ({ url: getStorageUrl(s.key), kind: s.kind, title: s.title ?? null })),
          },
          brandName
        );
      })
      .catch(() => {
        if (!cancelled) customerDisplay.setAds(null, brandName);
      });
    return () => {
      cancelled = true;
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
