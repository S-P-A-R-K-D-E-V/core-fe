import type { TenantBranding } from './tenant-branding';

// ----------------------------------------------------------------------
// Giao diện theo mùa lễ của trang chủ công khai. Ngày lễ quyết định ở đây (giờ Việt Nam); cửa hàng tắt được bằng
// TenantBranding.seasonalTheme (Cài đặt cửa hàng). Thêm mùa mới (Tết…) = thêm một preset + khoảng ngày.
// ----------------------------------------------------------------------

export type SeasonKey = 'christmas';

export type SeasonPreset = {
  key: SeasonKey;
  /** Huy hiệu trên tiêu đề đầu trang. */
  badge: string;
  /** Biểu tượng dùng ở huy hiệu và khối cuối trang (emoji — không phải tải ảnh / icon). */
  emoji: string;
  /** Màu chữ chuyển sắc (tiêu đề đầu trang, chữ nhấn ở tiêu đề các mục) — thay màu ngành hàng. */
  headline: [string, string, string];
  /** Nền đầu trang + hai quầng sáng. */
  heroTint: string;
  glow: [string, string];
  /** Màu dây đèn. */
  lights: string[];
  /** Khối cuối trang: nền chuyển sắc và hai dòng chào. */
  outro: { from: string; to: string; lines: (storeName: string) => [string, string] };
};

export const SEASONS: Record<SeasonKey, SeasonPreset> = {
  christmas: {
    key: 'christmas',
    badge: 'Mùa Giáng Sinh',
    emoji: '🎄',
    headline: ['#DC2626', '#D97706', '#15803D'],
    heroTint: 'rgba(255, 246, 243, 0.94)',
    glow: ['rgba(252, 165, 165, 0.35)', 'rgba(134, 239, 172, 0.25)'],
    lights: ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#EC4899'],
    outro: {
      from: '#B91C1C',
      to: '#14532D',
      lines: (storeName) => ['Giáng Sinh an lành', `cùng ${storeName}`],
    },
  },
};

/** Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) — máy chủ chạy UTC. */
function vietnamDate(now: Date): { month: number; day: number } {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/** Mùa lễ theo ngày: Giáng Sinh từ 1/12 đến hết 26/12. */
export function seasonOnDate(now: Date): SeasonKey | null {
  const { month, day } = vietnamDate(now);
  if (month === 12 && day <= 26) return 'christmas';
  return null;
}

/**
 * Mùa lễ hiện trên trang chủ của cửa hàng. `preview` là tham số ?season= của URL: "christmas" xem trước bất kể ngày và
 * công tắc (để chủ cửa hàng duyệt trước), "off" tắt hẳn.
 */
export function activeSeason({
  branding,
  now = new Date(),
  preview,
}: {
  branding: Pick<TenantBranding, 'seasonalTheme'> | null;
  now?: Date;
  preview?: string | string[] | null;
}): SeasonKey | null {
  const wanted = Array.isArray(preview) ? preview[0] : preview;
  if (wanted === 'off') return null;
  if (wanted && Object.prototype.hasOwnProperty.call(SEASONS, wanted)) return wanted as SeasonKey;
  if (branding?.seasonalTheme === false) return null;
  return seasonOnDate(now);
}
