'use client';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';

import { counterDeviceOfToken } from './counter-device';

// ----------------------------------------------------------------------
// Máy quầy chỉ phục vụ bán hàng (owner chốt 2026-10-16): ai đăng nhập ở máy quầy — kể cả chủ cửa hàng / quản lý —
// chỉ có bán hàng (bán lẻ + F&B, máy in phiếu), hoá đơn / in / trả hàng, hàng hoá (xem), khách hàng, kiểm tiền ca.
// Server chặn cùng phạm vi (core-be CounterScopeMiddleware) — ở đây chỉ để giao diện không mở ra trang sẽ bị từ chối.
// ----------------------------------------------------------------------

export const COUNTER_LOCK_PATH = '/counter';

const ALLOWED_PREFIXES = [
  paths.dashboard.pos.sale.root,
  paths.dashboard.fnb.pos,
  paths.dashboard.fnb.printStation,
  paths.dashboard.pos.salesOrder.root,
  paths.dashboard.pos.product.list,
  paths.dashboard.pos.customer.root,
  paths.dashboard.shiftCash.root,
];

// Trong các tiền tố trên vẫn chặn: sửa hoá đơn, sửa / thêm sản phẩm.
const BLOCKED_SUFFIXES = ['/edit'];

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function isCounterPathAllowed(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const path = normalize(pathname);
  if (path.startsWith(paths.dashboard.pos.salesOrder.root) && BLOCKED_SUFFIXES.some((s) => path.endsWith(s))) return false;
  return ALLOWED_PREFIXES.some((prefix) => {
    const p = normalize(prefix);
    return path === p || path.startsWith(`${p}/`);
  });
}

/** Trang đầu sau khi đăng nhập ở máy quầy: bán lẻ nếu cửa hàng bật, không thì bán hàng F&B. */
export function counterHome(enabledFeatures?: readonly string[] | null): string {
  if (enabledFeatures && !enabledFeatures.includes('commerce.retail.pos') && enabledFeatures.includes('commerce.fnb.pos')) {
    return paths.dashboard.fnb.pos;
  }
  return paths.dashboard.pos.sale.root;
}

/** Phiên đang đăng nhập được mở ở máy quầy (token mang claim counter_device). */
export function useCounterSession(): boolean {
  const { user } = useAuthContext();
  return !!counterDeviceOfToken(user?.accessToken);
}
