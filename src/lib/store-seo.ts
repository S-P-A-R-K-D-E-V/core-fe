import type { TenantBranding, StorefrontProduct, StorefrontProductDetail } from './tenant-branding';

import { storeIndustry } from './store-industry';

// ----------------------------------------------------------------------
// SEO trang chủ công khai của từng cửa hàng: tiêu đề, mô tả, dữ liệu có cấu trúc (schema.org) dựng từ dữ liệu
// thật của cửa hàng (tên, mô tả, địa chỉ, số điện thoại, nhóm hàng đang bán) — mỗi tên miền một nội dung riêng,
// không dùng chung câu chữ cố định. Chủ cửa hàng đặt Tiêu đề / Mô tả SEO trong Cài đặt cửa hàng thì dùng đúng
// bản đó. Hàm thuần (không đọc request) để test được.
// ----------------------------------------------------------------------

export const CICI_TENANT = 'cici68';

/** Cửa hàng mẫu (dữ liệu tự reset mỗi đêm) — không cho công cụ tìm kiếm lập chỉ mục. */
export const DEMO_TENANTS = ['demo'];

export const TITLE_MAX = 65;
export const DESCRIPTION_MAX = 160;

export function storeDisplayName(branding: Pick<TenantBranding, 'storeName' | 'tenantCode'> | null | undefined): string {
  return branding?.storeName?.trim() || branding?.tenantCode || 'Cửa hàng';
}

/** Cắt ở ranh giới từ, thêm "…" khi phải cắt. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const kept = t[max - 1] === ' ' || space <= max * 0.6 ? cut : cut.slice(0, space);
  return `${kept.replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Vế đầu của câu mô tả: "Phụ kiện thời trang nữ — trang sức, kẹp tóc…" → "Phụ kiện thời trang nữ". */
export function firstClause(text: string | null | undefined): string {
  if (!text) return '';
  return (text.split(/[.!?\n]|\s[—–-]\s|[,;:]/).find((s) => s.trim()) ?? '').trim();
}

/** Tên nhóm hàng VIẾT HOA TOÀN BỘ (dữ liệu KiotViet) → viết hoa chữ đầu: "PHỤ KIỆN TÓC" → "Phụ kiện tóc". */
export function displayCategory(name: string): string {
  const t = name.replace(/\s+/g, ' ').trim();
  if (t !== t.toLocaleUpperCase('vi') || t === t.toLocaleLowerCase('vi')) return t;
  const lower = t.toLocaleLowerCase('vi');
  return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
}

/** Các nhóm hàng có nhiều sản phẩm nhất (giữ thứ tự xuất hiện khi bằng nhau). */
export function topCategories(products: Pick<StorefrontProduct, 'categoryName'>[], max = 4): string[] {
  const counts = new Map<string, { name: string; count: number; order: number }>();
  products.forEach((p, order) => {
    const raw = p.categoryName?.trim();
    if (!raw) return;
    const key = raw.toLocaleLowerCase('vi');
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { name: displayCategory(raw), count: 1, order });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, max)
    .map((c) => c.name);
}

/** Thẻ <title> trang chủ: SEO chủ cửa hàng đặt → "Tên — vế đầu mô tả" → "Tên — nhóm hàng" → "Tên — địa chỉ" → "Tên". */
export function storeHomeTitle(branding: TenantBranding | null | undefined, categories: string[] = []): string {
  const custom = branding?.seoTitle?.trim();
  if (custom) return custom;

  const name = storeDisplayName(branding);
  const tail =
    firstClause(branding?.shortDescription) || categories.slice(0, 3).join(', ') || branding?.address?.trim() || '';
  if (!tail || name.toLocaleLowerCase('vi').includes(tail.toLocaleLowerCase('vi'))) return name;

  const room = TITLE_MAX - name.length - 3;
  if (room < 12) return name;
  return `${name} — ${clip(tail, room)}`;
}

/** Thẻ meta description trang chủ: SEO chủ cửa hàng đặt → mô tả ngắn → câu dựng từ địa chỉ, nhóm hàng, số điện thoại. */
export function storeHomeDescription(
  branding: TenantBranding | null | undefined,
  categories: string[] = [],
  productCount = 0
): string {
  const custom = branding?.seoDescription?.trim();
  if (custom) return custom;
  if (branding?.shortDescription?.trim()) return clip(branding.shortDescription, DESCRIPTION_MAX);

  const name = storeDisplayName(branding);
  const { words } = storeIndustry(branding);
  const address = branding?.address?.trim();
  const phone = branding?.phone?.trim();

  const intro = address ? `${name} tại ${address}` : name;
  const parts = [
    categories.length ? `${intro}: ${words.collection} gồm ${categories.slice(0, 4).join(', ')}.` : `${intro}.`,
    productCount > 0 ? `Xem ${productCount} ${words.item} đang bán kèm giá.` : `Xem ${words.collection}, giá và thông tin liên hệ.`,
    phone ? `Liên hệ ${phone}.` : '',
  ];
  return clip(parts.filter(Boolean).join(' '), DESCRIPTION_MAX);
}

export function absoluteUrl(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, `${origin}/`).toString();
  } catch {
    return undefined;
  }
}

/** Dữ liệu có cấu trúc schema.org cho trang chủ: WebSite + loại cửa hàng theo ngành (ClothingStore, CafeOrCoffeeShop…). */
export function storeJsonLd(params: {
  branding: TenantBranding;
  origin: string;
  description: string;
  products?: Pick<StorefrontProduct, 'imageUrl'>[];
}) {
  const { branding, origin, description, products = [] } = params;
  const name = storeDisplayName(branding);
  const url = `${origin}/`;
  const logo = absoluteUrl(branding.logoUrl, origin);
  const image = logo ?? absoluteUrl(products.find((p) => p.imageUrl)?.imageUrl, origin);
  const sameAs = [branding.messengerLink, branding.zaloLink].filter((l): l is string => !!l && /^https?:\/\//.test(l));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url,
        name,
        // Câu chữ trang chủ hiện chỉ có tiếng Việt.
        inLanguage: 'vi',
        publisher: { '@id': `${origin}/#store` },
      },
      {
        '@type': storeIndustry(branding).schemaType,
        '@id': `${origin}/#store`,
        name,
        url,
        description,
        ...(logo && { logo }),
        ...(image && { image }),
        ...(branding.phone?.trim() && { telephone: branding.phone.trim() }),
        ...(branding.address?.trim() && {
          address: { '@type': 'PostalAddress', streetAddress: branding.address.trim(), addressCountry: 'VN' },
        }),
        ...(sameAs.length && { sameAs }),
      },
    ],
  };
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} đ`;
}

/** Meta description của trang một sản phẩm: mô tả của sản phẩm, không có thì "Tên – nhóm. Giá … tại cửa hàng. Còn hàng." */
export function productDescription(product: StorefrontProductDetail, storeName: string): string {
  if (product.description?.trim()) return clip(product.description, DESCRIPTION_MAX);
  const category = product.categoryName ? ` – ${displayCategory(product.categoryName)}` : '';
  const stock = product.inStock ? 'Còn hàng.' : 'Tạm hết hàng.';
  return clip(`${product.name}${category}. Giá ${formatVnd(product.price)} tại ${storeName}. ${stock}`, DESCRIPTION_MAX);
}

/** schema.org Product + Offer cho trang một sản phẩm. */
export function productJsonLd(params: {
  product: StorefrontProductDetail;
  origin: string;
  storeName: string;
  description: string;
}) {
  const { product, origin, storeName, description } = params;
  const url = `${origin}/product/${product.id}/`;
  const images = product.imageUrls.map((u) => absoluteUrl(u, origin)).filter((u): u is string => !!u);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    sku: product.code,
    description,
    ...(images.length && { image: images }),
    ...(product.categoryName && { category: displayCategory(product.categoryName) }),
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: 'VND',
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: storeName, url: `${origin}/` },
    },
  };
}

/** Chữ đưa vào link Markdown: bỏ ngoặc vuông / xuống dòng để không vỡ cú pháp. */
function mdText(text: string): string {
  return text.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * /llms.txt của cửa hàng (llmstxt.org): tên, mô tả, thông tin liên hệ và danh sách sản phẩm có link — để trợ lý AI /
 * công cụ tìm kiếm AI hiểu cửa hàng mà không phải chạy JavaScript.
 */
export function storeLlmsTxt(params: {
  branding: TenantBranding;
  origin: string;
  products: Pick<StorefrontProduct, 'id' | 'name' | 'price' | 'categoryName'>[];
  total: number;
}): string {
  const { branding, origin, products, total } = params;
  const industry = storeIndustry(branding);
  const name = storeDisplayName(branding);
  const categories = topCategories(products, 6);
  const contact = [
    branding.address?.trim() && `- Địa chỉ: ${branding.address.trim()}`,
    branding.phone?.trim() && `- Điện thoại: ${branding.phone.trim()}`,
    branding.messengerLink && `- Messenger: ${branding.messengerLink}`,
    branding.zaloLink && `- Zalo: ${branding.zaloLink}`,
  ].filter(Boolean) as string[];

  return [
    `# ${mdText(name)}`,
    '',
    `> ${mdText(storeHomeDescription(branding, categories, total))}`,
    '',
    '## Thông tin',
    `- Ngành: ${industry.label}`,
    ...contact,
    `- [Trang chủ](${origin}/)`,
    '',
    `## ${industry.words.items}`,
    `- [Tất cả ${industry.words.collection}](${origin}/product/)${total ? `: ${total} ${industry.words.item} đang bán` : ''}`,
    ...products.map(
      (p) =>
        `- [${mdText(p.name)}](${origin}/product/${p.id}/): ${formatVnd(p.price)}` +
        (p.categoryName ? ` — ${displayCategory(p.categoryName)}` : '')
    ),
    '',
    '## Khác',
    `- [Hỗ trợ](${origin}/support/)`,
    `- [Chính sách quyền riêng tư](${origin}/privacy-policy/)`,
    '',
  ].join('\n');
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * Chuỗi JSON an toàn để đặt trong <script type="application/ld+json">: tên / mô tả cửa hàng do người dùng nhập,
 * nên thoát "<" (chặn "</script>") và U+2028/2029.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}

/** Cho phép lập chỉ mục: không với trang đăng nhập tập trung và cửa hàng mẫu. */
export function isIndexable(params: { isAuthHost: boolean; tenantCode?: string | null }): boolean {
  if (params.isAuthHost) return false;
  return !(params.tenantCode && DEMO_TENANTS.includes(params.tenantCode));
}

/** Đường dẫn không cho công cụ tìm kiếm vào: trang quản trị, đăng nhập, API, màn hình quầy, trang mẫu của template. */
export const ROBOTS_DISALLOW = [
  '/api/',
  '/hubs/',
  '/dashboard',
  '/auth',
  '/auth-demo',
  '/sso',
  '/agent-chat',
  '/kiosk-checkin',
  '/counter',
  '/customer-display',
  '/payment',
  '/product/checkout',
  // Trang đơn online của khách (link có khoá bí mật) — không bao giờ lập chỉ mục.
  '/order',
  '/error',
];
