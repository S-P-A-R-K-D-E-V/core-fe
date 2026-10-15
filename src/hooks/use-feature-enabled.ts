'use client';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Khoá tính năng (core-be PlanFeatureKeys). Ba khoá dưới đây không gói mặc định nào chứa — chỉ bật riêng cho cửa hàng
// được cấp (hiện là CiCi); cửa hàng khác không thấy menu, trang và các trường liên quan.

export const FEATURE = {
  /** Tích hợp camera cửa hàng: Giám sát cửa hàng, Chấm công trực tiếp, Spark Camera Agent, chụp ảnh từ camera quầy. */
  storeCamera: 'store.camera',
  /** Hoạch toán cổ đông + "Ai chi hộ" trên chi phí / đơn nhập / thu chi quầy. */
  shareholders: 'finance.shareholders',
  /** Công nợ đối tác (phiếu đối tác). */
  partnerDebt: 'finance.partner-debt',
} as const;

/** Cửa hàng hiện tại có bật tính năng này không (enabledFeatures của /users/me). Chưa tải xong = chưa bật. */
export function useFeatureEnabled(key: string): boolean {
  const { user } = useAuthContext();
  return ((user?.enabledFeatures as string[] | undefined) ?? []).includes(key);
}
