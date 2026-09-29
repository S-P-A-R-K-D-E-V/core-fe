'use client';

import { useContext, createContext } from 'react';

// ----------------------------------------------------------------------
// Thương hiệu của cửa hàng đang mở (tên, logo, màu) — lấy phía server theo tên miền trong
// app/layout.tsx rồi truyền xuống, nên không có lúc "nháy" chữ CiCi trên cửa hàng khác.
// CiCi (cici68) giữ nguyên cách gọi ngắn "CiCi" và logo tĩnh như trước.
// ----------------------------------------------------------------------

export type StoreBrand = {
  tenantCode: string | null;
  storeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

const CICI_TENANT = 'cici68';

const BrandingContext = createContext<StoreBrand | null>(null);

type Props = {
  value: StoreBrand | null;
  children: React.ReactNode;
};

export function BrandingProvider({ value, children }: Props) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useStoreBrand() {
  const brand = useContext(BrandingContext);
  const isCiCi = !brand?.tenantCode || brand.tenantCode === CICI_TENANT;

  return {
    isCiCi,
    tenantCode: brand?.tenantCode ?? null,
    /** Tên dùng trong câu chữ ("… ở đây để hỗ trợ"): CiCi giữ "CiCi", cửa hàng khác dùng tên cửa hàng. */
    brandName: isCiCi ? 'CiCi' : brand?.storeName || brand?.tenantCode || 'Cửa hàng',
    logoUrl: brand?.logoUrl ?? null,
    primaryColor: brand?.primaryColor ?? null,
  };
}
