import type { TenantBranding } from './tenant-branding';

// ----------------------------------------------------------------------
// Ngành hàng của cửa hàng (TenantBranding.industry — khớp StoreIndustries của core-be và spark-console): trang chủ công
// khai đổi câu chữ, màu, biểu tượng, loại schema.org theo ngành, thay vì cửa hàng nào cũng như một tiệm phụ kiện.
// Chưa chọn ngành → bộ trung tính theo loại hình (bán lẻ / F&B). CiCi chưa có ngành vẫn là thời trang như trước.
// ----------------------------------------------------------------------

export const INDUSTRY_KEYS = [
  'fashion',
  'beauty',
  'grocery',
  'electronics',
  'household',
  'cafe',
  'restaurant',
  'service',
  'other',
] as const;

export type IndustryKey = (typeof INDUSTRY_KEYS)[number];

export type IndustryPreset = {
  key: IndustryKey | 'retail' | 'fnb';
  label: string;
  /** Loại schema.org của cửa hàng. */
  schemaType: string;
  /** Món / thực đơn, dịch vụ, sản phẩm. */
  words: { item: string; items: string; collection: string; cta: string; order: string };
  /** Dòng nhỏ trên tên cửa hàng ở đầu trang chủ. */
  heroLead: string;
  /** Khối kêu gọi cuối trang: dòng 1 + dòng 2 (có tên cửa hàng). */
  outro: (storeName: string) => [string, string];
  /** Biểu tượng khi sản phẩm chưa có ảnh. */
  icon: string;
  /** Biểu tượng của các thẻ danh mục. */
  categoryIcons: string[];
  palette: {
    /** Màu chữ chuyển sắc của tên cửa hàng ở đầu trang. */
    headline: string[];
    /** Nền thẻ sản phẩm / danh mục. */
    cards: { from: string; to: string }[];
    /** Lớp nền đầu trang (rgba) và hai quầng sáng. */
    heroTint: string;
    glow: [string, string];
    grid: string;
  };
  ai: { lookupTitle: string; lookup: (ai: string) => string; secondTitle: string; second: (ai: string) => string };
};

const PRODUCT_WORDS = { item: 'sản phẩm', items: 'Sản phẩm', collection: 'sản phẩm', cta: 'Xem sản phẩm', order: 'đặt hàng' };
const MENU_WORDS = { item: 'món', items: 'Thực đơn', collection: 'thực đơn', cta: 'Xem thực đơn', order: 'đặt món' };

const PRODUCT_AI: IndustryPreset['ai'] = {
  lookupTitle: 'Tra cứu sản phẩm tức thì',
  lookup: (ai) => `Hỏi tên hoặc mã sản phẩm — ${ai} trả lời ngay về giá, mẫu mã, biến thể mà không cần tìm thủ công.`,
  secondTitle: 'Kiểm tra tồn kho',
  second: (ai) => `Muốn biết còn hàng không trước khi ghé cửa hàng? Chỉ cần hỏi ${ai}, biết ngay không cần chờ nhân viên.`,
};

const MENU_AI: IndustryPreset['ai'] = {
  lookupTitle: 'Tra cứu thực đơn tức thì',
  lookup: (ai) => `Hỏi tên món — ${ai} trả lời ngay về giá và các lựa chọn mà không cần lật thực đơn.`,
  secondTitle: 'Món nào đang có',
  second: (ai) => `Muốn biết món còn không trước khi ghé quán? Chỉ cần hỏi ${ai}.`,
};

const shop = (lead: string) => (name: string): [string, string] => [lead, `tại ${name}`];

const CARDS_PINK = [
  { from: '#FADADD', to: '#F4A0C0' },
  { from: '#FDE8D8', to: '#FBBFA0' },
  { from: '#E8D5F5', to: '#C4A0E8' },
  { from: '#D4F0E8', to: '#A0D4C4' },
];

const PRESETS: Record<IndustryPreset['key'], IndustryPreset> = {
  fashion: {
    key: 'fashion',
    label: 'Thời trang & phụ kiện',
    schemaType: 'ClothingStore',
    words: { ...PRODUCT_WORDS, cta: 'Xem bộ sưu tập' },
    heroLead: 'Khám phá thế giới',
    outro: shop('Bắt đầu mua sắm'),
    icon: 'solar:bag-heart-bold-duotone',
    categoryIcons: ['solar:bag-smile-bold-duotone', 'solar:t-shirt-bold-duotone', 'solar:star-bold-duotone', 'solar:bag-4-bold-duotone'],
    palette: {
      headline: ['#F43F5E', '#EC4899', '#A855F7'],
      cards: CARDS_PINK,
      heroTint: 'rgba(255, 245, 248, 0.94)',
      glow: ['rgba(248, 200, 220, 0.35)', 'rgba(200, 220, 255, 0.2)'],
      grid: '#F472B6',
    },
    ai: PRODUCT_AI,
  },
  beauty: {
    key: 'beauty',
    label: 'Mỹ phẩm & làm đẹp',
    schemaType: 'HealthAndBeautyBusiness',
    words: PRODUCT_WORDS,
    heroLead: 'Làm đẹp cùng',
    outro: shop('Chọn sản phẩm làm đẹp'),
    icon: 'solar:cosmetic-bold-duotone',
    categoryIcons: ['solar:cosmetic-bold-duotone', 'solar:magic-stick-3-bold-duotone', 'solar:mirror-bold-duotone', 'solar:hand-heart-bold-duotone'],
    palette: {
      headline: ['#E11D48', '#F472B6', '#FB923C'],
      cards: [
        { from: '#FFE4E6', to: '#FDA4AF' },
        { from: '#FFEDD5', to: '#FDBA74' },
        { from: '#FCE7F3', to: '#F9A8D4' },
        { from: '#FEF3C7', to: '#FCD34D' },
      ],
      heroTint: 'rgba(255, 247, 245, 0.94)',
      glow: ['rgba(253, 186, 186, 0.35)', 'rgba(254, 215, 170, 0.25)'],
      grid: '#FB7185',
    },
    ai: PRODUCT_AI,
  },
  grocery: {
    key: 'grocery',
    label: 'Tạp hoá & siêu thị mini',
    schemaType: 'GroceryStore',
    words: PRODUCT_WORDS,
    heroLead: 'Mua sắm tại',
    outro: shop('Đi chợ tiện lợi'),
    icon: 'solar:cart-large-2-bold-duotone',
    categoryIcons: ['solar:cart-large-2-bold-duotone', 'solar:leaf-bold-duotone', 'solar:bottle-bold-duotone', 'solar:box-bold-duotone'],
    palette: {
      headline: ['#15803D', '#22C55E', '#84CC16'],
      cards: [
        { from: '#DCFCE7', to: '#86EFAC' },
        { from: '#FEF9C3', to: '#FDE047' },
        { from: '#ECFCCB', to: '#BEF264' },
        { from: '#D1FAE5', to: '#6EE7B7' },
      ],
      heroTint: 'rgba(245, 253, 247, 0.94)',
      glow: ['rgba(134, 239, 172, 0.35)', 'rgba(253, 224, 71, 0.2)'],
      grid: '#22C55E',
    },
    ai: PRODUCT_AI,
  },
  electronics: {
    key: 'electronics',
    label: 'Điện thoại & điện tử',
    schemaType: 'ElectronicsStore',
    words: PRODUCT_WORDS,
    heroLead: 'Công nghệ tại',
    outro: shop('Chọn thiết bị'),
    icon: 'solar:smartphone-bold-duotone',
    categoryIcons: ['solar:smartphone-bold-duotone', 'solar:laptop-bold-duotone', 'solar:headphones-round-bold-duotone', 'solar:tv-bold-duotone'],
    palette: {
      headline: ['#2563EB', '#4F46E5', '#06B6D4'],
      cards: [
        { from: '#DBEAFE', to: '#93C5FD' },
        { from: '#E0E7FF', to: '#A5B4FC' },
        { from: '#CFFAFE', to: '#67E8F9' },
        { from: '#E0F2FE', to: '#7DD3FC' },
      ],
      heroTint: 'rgba(245, 248, 255, 0.94)',
      glow: ['rgba(147, 197, 253, 0.35)', 'rgba(103, 232, 249, 0.2)'],
      grid: '#3B82F6',
    },
    ai: PRODUCT_AI,
  },
  household: {
    key: 'household',
    label: 'Gia dụng & nội thất',
    schemaType: 'HomeGoodsStore',
    words: PRODUCT_WORDS,
    heroLead: 'Gia dụng tại',
    outro: shop('Sắm sửa cho nhà'),
    icon: 'solar:home-smile-bold-duotone',
    categoryIcons: ['solar:sofa-2-bold-duotone', 'solar:lamp-bold-duotone', 'solar:washing-machine-bold-duotone', 'solar:chair-bold-duotone'],
    palette: {
      headline: ['#0F766E', '#14B8A6', '#F59E0B'],
      cards: [
        { from: '#CCFBF1', to: '#5EEAD4' },
        { from: '#FEF3C7', to: '#FCD34D' },
        { from: '#F5F5F4', to: '#D6D3D1' },
        { from: '#E0F2F1', to: '#99D5CF' },
      ],
      heroTint: 'rgba(246, 252, 251, 0.94)',
      glow: ['rgba(94, 234, 212, 0.3)', 'rgba(252, 211, 77, 0.2)'],
      grid: '#14B8A6',
    },
    ai: PRODUCT_AI,
  },
  cafe: {
    key: 'cafe',
    label: 'Cà phê & trà sữa',
    schemaType: 'CafeOrCoffeeShop',
    words: MENU_WORDS,
    heroLead: 'Chào mừng đến',
    outro: shop('Ghé thưởng thức'),
    icon: 'solar:cup-hot-bold-duotone',
    categoryIcons: ['solar:cup-hot-bold-duotone', 'solar:tea-cup-bold-duotone', 'solar:cup-star-bold-duotone', 'solar:donut-bold-duotone'],
    palette: {
      headline: ['#92400E', '#B45309', '#D97706'],
      cards: [
        { from: '#F5E6D3', to: '#E0C3A0' },
        { from: '#FDE8D8', to: '#F6C59F' },
        { from: '#EADBC8', to: '#C8A27C' },
        { from: '#F3E9DC', to: '#D6BFA7' },
      ],
      heroTint: 'rgba(253, 248, 243, 0.94)',
      glow: ['rgba(214, 167, 120, 0.3)', 'rgba(251, 191, 36, 0.18)'],
      grid: '#B45309',
    },
    ai: MENU_AI,
  },
  restaurant: {
    key: 'restaurant',
    label: 'Nhà hàng & quán ăn',
    schemaType: 'Restaurant',
    words: MENU_WORDS,
    heroLead: 'Thưởng thức tại',
    outro: shop('Ghé thưởng thức'),
    icon: 'solar:chef-hat-bold-duotone',
    categoryIcons: ['solar:chef-hat-bold-duotone', 'solar:plate-bold-duotone', 'solar:wineglass-bold-duotone', 'solar:cup-hot-bold-duotone'],
    palette: {
      headline: ['#B91C1C', '#EA580C', '#F59E0B'],
      cards: [
        { from: '#FEE2E2', to: '#FCA5A5' },
        { from: '#FFEDD5', to: '#FDBA74' },
        { from: '#FEF3C7', to: '#FCD34D' },
        { from: '#FCE7F3', to: '#F9A8D4' },
      ],
      heroTint: 'rgba(255, 248, 244, 0.94)',
      glow: ['rgba(253, 186, 116, 0.35)', 'rgba(252, 165, 165, 0.2)'],
      grid: '#EA580C',
    },
    ai: MENU_AI,
  },
  service: {
    key: 'service',
    label: 'Dịch vụ',
    schemaType: 'ProfessionalService',
    words: { item: 'dịch vụ', items: 'Dịch vụ', collection: 'dịch vụ', cta: 'Xem dịch vụ', order: 'đặt dịch vụ' },
    heroLead: 'Dịch vụ của',
    outro: (name) => ['Cần tư vấn?', `Liên hệ ${name}`],
    icon: 'solar:case-bold-duotone',
    categoryIcons: ['solar:case-bold-duotone', 'solar:document-text-bold-duotone', 'solar:calculator-bold-duotone', 'solar:users-group-rounded-bold-duotone'],
    palette: {
      headline: ['#1D4ED8', '#4338CA', '#0EA5E9'],
      cards: [
        { from: '#E0E7FF', to: '#A5B4FC' },
        { from: '#DBEAFE', to: '#93C5FD' },
        { from: '#E0F2FE', to: '#7DD3FC' },
        { from: '#F1F5F9', to: '#CBD5E1' },
      ],
      heroTint: 'rgba(246, 248, 252, 0.94)',
      glow: ['rgba(165, 180, 252, 0.3)', 'rgba(125, 211, 252, 0.2)'],
      grid: '#6366F1',
    },
    ai: {
      lookupTitle: 'Hỏi về dịch vụ',
      lookup: (ai) => `Hỏi tên dịch vụ — ${ai} trả lời ngay về nội dung và giá dịch vụ.`,
      secondTitle: 'Báo giá nhanh',
      second: (ai) => `Muốn biết chi phí trước khi liên hệ? Hỏi ${ai} theo bảng giá của cửa hàng.`,
    },
  },
  other: {
    key: 'other',
    label: 'Khác',
    schemaType: 'Store',
    words: PRODUCT_WORDS,
    heroLead: 'Chào mừng đến',
    outro: shop('Ghé thăm'),
    icon: 'solar:shop-bold-duotone',
    categoryIcons: ['solar:shop-bold-duotone', 'solar:box-bold-duotone', 'solar:star-bold-duotone', 'solar:bag-smile-bold-duotone'],
    palette: {
      headline: ['#4F46E5', '#7C3AED', '#0891B2'],
      cards: [
        { from: '#EDE9FE', to: '#C4B5FD' },
        { from: '#E0E7FF', to: '#A5B4FC' },
        { from: '#CFFAFE', to: '#67E8F9' },
        { from: '#F1F5F9', to: '#CBD5E1' },
      ],
      heroTint: 'rgba(247, 247, 253, 0.94)',
      glow: ['rgba(196, 181, 253, 0.3)', 'rgba(103, 232, 249, 0.18)'],
      grid: '#7C3AED',
    },
    ai: PRODUCT_AI,
  },
  // Chưa chọn ngành: trung tính theo loại hình, không mang chất thời trang.
  retail: {
    key: 'retail',
    label: 'Bán lẻ',
    schemaType: 'Store',
    words: PRODUCT_WORDS,
    heroLead: 'Chào mừng đến',
    outro: shop('Ghé thăm'),
    icon: 'solar:shop-bold-duotone',
    categoryIcons: ['solar:shop-bold-duotone', 'solar:box-bold-duotone', 'solar:star-bold-duotone', 'solar:bag-smile-bold-duotone'],
    palette: {
      headline: ['#4F46E5', '#7C3AED', '#0891B2'],
      cards: [
        { from: '#EDE9FE', to: '#C4B5FD' },
        { from: '#E0E7FF', to: '#A5B4FC' },
        { from: '#CFFAFE', to: '#67E8F9' },
        { from: '#F1F5F9', to: '#CBD5E1' },
      ],
      heroTint: 'rgba(247, 247, 253, 0.94)',
      glow: ['rgba(196, 181, 253, 0.3)', 'rgba(103, 232, 249, 0.18)'],
      grid: '#7C3AED',
    },
    ai: PRODUCT_AI,
  },
  fnb: {
    key: 'fnb',
    label: 'Ăn uống',
    schemaType: 'FoodEstablishment',
    words: MENU_WORDS,
    heroLead: 'Chào mừng đến',
    outro: shop('Ghé thưởng thức'),
    icon: 'solar:cup-hot-bold-duotone',
    categoryIcons: ['solar:cup-hot-bold-duotone', 'solar:plate-bold-duotone', 'solar:tea-cup-bold-duotone', 'solar:donut-bold-duotone'],
    palette: {
      headline: ['#92400E', '#C2410C', '#D97706'],
      cards: [
        { from: '#F5E6D3', to: '#E0C3A0' },
        { from: '#FFEDD5', to: '#FDBA74' },
        { from: '#EADBC8', to: '#C8A27C' },
        { from: '#FEF3C7', to: '#FCD34D' },
      ],
      heroTint: 'rgba(253, 248, 243, 0.94)',
      glow: ['rgba(214, 167, 120, 0.3)', 'rgba(251, 191, 36, 0.18)'],
      grid: '#C2410C',
    },
    ai: MENU_AI,
  },
};

export function isIndustryKey(value: string | null | undefined): value is IndustryKey {
  return !!value && (INDUSTRY_KEYS as readonly string[]).includes(value);
}

/** Lựa chọn cho ô chọn ngành (Cài đặt cửa hàng). */
export const INDUSTRY_OPTIONS = INDUSTRY_KEYS.map((key) => ({ value: key, label: PRESETS[key].label }));

/**
 * Bộ hiển thị theo ngành của cửa hàng: ngành đã chọn → bộ của ngành; chưa chọn → CiCi (hoặc không đọc được branding)
 * là thời trang như trước, cửa hàng khác trung tính theo loại hình.
 */
export function storeIndustry(
  branding: Pick<TenantBranding, 'industry' | 'businessType' | 'tenantCode'> | null | undefined
): IndustryPreset {
  if (isIndustryKey(branding?.industry)) return PRESETS[branding.industry];
  if (!branding || branding.tenantCode === 'cici68') return PRESETS.fashion;
  return branding.businessType === 'fnb' ? PRESETS.fnb : PRESETS.retail;
}
