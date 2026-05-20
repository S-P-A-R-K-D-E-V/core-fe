import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

import { IProductItem } from 'src/types/product';

// ----------------------------------------------------------------------

/** Map backend ProductListItemResponse → IProductItem for shop list */
function mapListItem(item: any): IProductItem {
  const onHand = (item.inventories as any[] | null)?.reduce(
    (sum: number, inv: any) => sum + (inv.onHand ?? 0),
    0
  ) ?? 0;

  return {
    id: item.id,
    name: item.fullName || item.name,
    code: item.code,
    sku: item.code,
    price: item.basePrice ?? 0,
    priceSale: 0,
    coverUrl: item.coverImageUrl || '/assets/images/product/product_placeholder.jpg',
    images: item.coverImageUrl ? [item.coverImageUrl] : [],
    category: item.categoryName ?? '',
    available: onHand,
    quantity: onHand,
    inventoryType: onHand > 0 ? 'in_stock' : 'out_of_stock',
    publish: item.isActive ? 'published' : 'draft',
    description: '',
    subDescription: '',
    createdAt: new Date(item.createdDate),
    // fields not available in list response — safe defaults
    gender: 'Men',
    tags: [],
    colors: [],
    sizes: [],
    taxes: 0,
    totalSold: 0,
    totalRatings: 0,
    totalReviews: 0,
    ratings: [],
    reviews: [],
    saleLabel: { enabled: false, content: '' },
    newLabel: { enabled: false, content: '' },
  };
}

/** Map backend ProductResponse (full detail) → IProductItem */
function mapDetailItem(item: any): IProductItem {
  const images: string[] = (item.images as any[] | null)
    ?.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((i: any) => i.imageUrl)
    .filter(Boolean) ?? [];

  const onHand = (item.inventories as any[] | null)?.reduce(
    (sum: number, inv: any) => sum + (inv.onHand ?? 0),
    0
  ) ?? 0;

  return {
    id: item.id,
    name: item.fullName || item.name,
    code: item.code,
    sku: item.code,
    price: item.basePrice ?? 0,
    priceSale: 0,
    coverUrl: images[0] || '/assets/images/product/product_placeholder.jpg',
    images,
    category: item.categoryName ?? '',
    available: onHand,
    quantity: onHand,
    inventoryType: onHand > 0 ? 'in_stock' : 'out_of_stock',
    publish: item.isActive ? 'published' : 'draft',
    description: item.description ?? '',
    subDescription: '',
    createdAt: new Date(item.createdDate),
    gender: 'Men',
    tags: [],
    colors: [],
    sizes: [],
    taxes: 0,
    totalSold: 0,
    totalRatings: 0,
    totalReviews: 0,
    ratings: [],
    reviews: [],
    saleLabel: { enabled: false, content: '' },
    newLabel: { enabled: false, content: '' },
  };
}

// ----------------------------------------------------------------------

export type ProductListParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export function useGetProducts(params?: ProductListParams) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 24;

  const searchParams = new URLSearchParams({
    isActive: 'true',
    page: String(page),
    pageSize: String(pageSize),
  });
  if (params?.keyword) searchParams.set('keyword', params.keyword);

  const URL = `${endpoints.product.list}?${searchParams.toString()}`;

  const { data, isLoading, error, isValidating } = useSWR(URL, fetcher);

  const memoizedValue = useMemo(
    () => ({
      products: ((data?.items as any[]) ?? []).map(mapListItem),
      totalCount: (data?.totalCount as number) ?? 0,
      page: (data?.page as number) ?? page,
      pageSize: (data?.pageSize as number) ?? pageSize,
      productsLoading: isLoading,
      productsError: error,
      productsValidating: isValidating,
      productsEmpty: !isLoading && !data?.items?.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, error, isLoading, isValidating, page, pageSize]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetProduct(id: string) {
  const URL = id ? (endpoints.product.details as (id: string) => string)(id) : null;

  const { data, isLoading, error, isValidating } = useSWR(URL, fetcher);

  const memoizedValue = useMemo(
    () => ({
      product: data ? mapDetailItem(data) : (undefined as IProductItem | undefined),
      productLoading: isLoading,
      productError: error,
      productValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useSearchProducts(query: string) {
  const URL = query
    ? `${endpoints.product.search}?isActive=true&keyword=${encodeURIComponent(query)}&pageSize=8`
    : null;

  const { data, isLoading, error, isValidating } = useSWR(URL, fetcher, {
    keepPreviousData: true,
  });

  const memoizedValue = useMemo(
    () => ({
      searchResults: ((data?.items as any[]) ?? []).map(mapListItem),
      searchLoading: isLoading,
      searchError: error,
      searchValidating: isValidating,
      searchEmpty: !isLoading && !data?.items?.length,
    }),
    [data?.items, error, isLoading, isValidating]
  );

  return memoizedValue;
}
