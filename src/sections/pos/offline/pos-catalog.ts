import type { ICustomer, IWarehouse, IPagedResult, IProductListItem } from 'src/types/corecms-api';

import { openPosStore, type PosKvStore } from './pos-store';

// ----------------------------------------------------------------------
// Danh mục bán hàng lưu trên máy (docs/cici/plans/pos-offline-plan.md mục 3.3): toàn bộ hàng đang bán + khách + kho.
// Mở màn bán hàng hiện ngay bản đã lưu (mất mạng vẫn tra được hàng, vẫn có kho để bán), rồi tải bản mới ở nền.
// Tìm hàng / quét mã làm tại máy, không phân biệt dấu — nhanh hơn gọi API mỗi lần gõ và chạy được khi mất mạng.
// ----------------------------------------------------------------------

export type CatalogSnapshot = {
  products: IProductListItem[];
  customers: ICustomer[];
  warehouses: IWarehouse[];
  /** ISO — lúc tải xong từ máy chủ. */
  syncedAt: string;
  /** Đã tải đủ mọi trang hàng (tìm tại máy đáng tin). */
  complete: boolean;
};

type CatalogRecord = CatalogSnapshot & { id: string };

const CATALOG_ID = 'catalog';
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

let metaStore: Promise<PosKvStore<CatalogRecord>> | null = null;
const store = () => {
  if (!metaStore) metaStore = openPosStore<CatalogRecord>('meta');
  return metaStore;
};

export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    const rows = await (await store()).getAll();
    const found = rows.find((r) => r.id === CATALOG_ID);
    if (!found || !Array.isArray(found.products)) return null;
    const { id, ...snapshot } = found;
    return snapshot;
  } catch {
    return null;
  }
}

export async function saveCatalogSnapshot(snapshot: CatalogSnapshot): Promise<void> {
  try {
    await (await store()).put({ id: CATALOG_ID, ...snapshot });
  } catch (err) {
    // Hết chỗ (thường là localStorage dự phòng) — vẫn bán được khi có mạng, chỉ mất bản lưu offline.
    console.warn('Không lưu được danh mục bán hàng trên máy', err);
  }
}

type CatalogApi = {
  getAllProducts: (params: {
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<IPagedResult<IProductListItem>>;
  getAllCustomers: (params: { isActive?: boolean }) => Promise<ICustomer[]>;
  getAllWarehouses: () => Promise<IWarehouse[]>;
};

/** Tải đủ danh mục (máy chủ trả tối đa 200 hàng / trang). */
export async function fetchCatalog(api: CatalogApi, now = () => new Date()): Promise<CatalogSnapshot> {
  const [customers, warehouses] = await Promise.all([
    api.getAllCustomers({ isActive: true }),
    api.getAllWarehouses(),
  ]);

  const products: IProductListItem[] = [];
  const seen = new Set<string>();
  let complete = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api.getAllProducts({ isActive: true, page, pageSize: PAGE_SIZE });
    res.items.forEach((p) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        products.push(p);
      }
    });
    const total = typeof res.totalCount === 'number' ? res.totalCount : undefined;
    if (res.items.length < PAGE_SIZE || (total !== undefined && products.length >= total)) {
      complete = true;
      break;
    }
  }
  return { products, customers, warehouses, syncedAt: now().toISOString(), complete };
}

// ----------------------------------------------------------------------
// Tìm tại máy
// ----------------------------------------------------------------------

/** Chữ thường, bỏ dấu tiếng Việt (đ → d), gộp khoảng trắng. */
export function normalizeSearchText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

type Indexed = { product: IProductListItem; haystack: string; codes: string[]; name: string };
const indexCache = new WeakMap<IProductListItem[], Indexed[]>();

function indexOf(products: IProductListItem[]): Indexed[] {
  const cached = indexCache.get(products);
  if (cached) return cached;
  const indexed = products.map((product) => {
    const children = product.childProducts ?? [];
    const codes = [
      product.code,
      product.sku,
      product.barcode,
      product.barCode,
      ...children.flatMap((c) => [c.code, c.barCode]),
    ]
      .map(normalizeSearchText)
      .filter(Boolean);
    const name = normalizeSearchText(product.name);
    const childNames = children.map((c) => normalizeSearchText(c.fullName || c.name)).join(' ');
    return { product, codes, name, haystack: `${name} ${codes.join(' ')} ${childNames}` };
  });
  indexCache.set(products, indexed);
  return indexed;
}

/**
 * Hàng khớp từ khoá: mọi từ đều phải có (tên, mã, mã vạch, mã / tên phiên bản), không phân biệt dấu. Xếp: đúng mã /
 * mã vạch → mã bắt đầu bằng từ khoá → tên bắt đầu bằng từ khoá → còn lại (theo tên).
 */
export function searchCatalog(products: IProductListItem[], keyword: string, limit = 30): IProductListItem[] {
  const q = normalizeSearchText(keyword);
  if (!q) return [];
  const tokens = q.split(' ');
  const rank = (item: Indexed) => {
    if (item.codes.includes(q)) return 0;
    if (item.codes.some((c) => c.startsWith(q))) return 1;
    if (item.name.startsWith(q)) return 2;
    if (item.name.includes(q)) return 3;
    return 4;
  };
  return indexOf(products)
    .filter((item) => tokens.every((t) => item.haystack.includes(t)))
    .map((item) => ({ item, score: rank(item) }))
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item }) => item.product);
}
