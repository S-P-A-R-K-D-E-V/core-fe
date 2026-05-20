'use client';

import orderBy from 'lodash/orderBy';
import { useState, useCallback, useMemo } from 'react';

import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useDebounce } from 'src/hooks/use-debounce';
import { useBoolean } from 'src/hooks/use-boolean';

import { useGetProducts, useSearchProducts } from 'src/api/product';

import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';

import { IProductItem } from 'src/types/product';

import ProductList from '../product-list';
import ProductSort from '../product-sort';
import CartIcon from '../common/cart-icon';
import ProductSearch from '../product-search';
import { useCheckoutContext } from '../../checkout/context';

// ----------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'priceAsc', label: 'Giá: Thấp → Cao' },
  { value: 'priceDesc', label: 'Giá: Cao → Thấp' },
];

const PAGE_SIZE = 24;

// ----------------------------------------------------------------------

export default function ProductShopView() {
  const settings = useSettingsContext();
  const checkout = useCheckoutContext();
  const openFilters = useBoolean();

  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebounce(searchQuery);

  // Reset to page 1 when search changes
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleSortBy = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fetch from real backend — server-side keyword search + pagination
  const { products, totalCount, productsLoading, productsEmpty } = useGetProducts({
    keyword: debouncedQuery || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const { searchResults, searchLoading } = useSearchProducts(debouncedQuery);

  // Client-side sort on the fetched page
  const dataFiltered = useMemo(
    () => applySortFilter(products, sortBy),
    [products, sortBy]
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const renderFilters = (
    <Stack
      spacing={3}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-end', sm: 'center' }}
      direction={{ xs: 'column', sm: 'row' }}
    >
      <ProductSearch
        query={debouncedQuery}
        results={searchResults}
        onSearch={handleSearch}
        loading={searchLoading}
        hrefItem={(id: string) => paths.product.details(id)}
      />

      <ProductSort
        sort={sortBy}
        onSort={handleSortBy}
        sortOptions={SORT_OPTIONS}
      />
    </Stack>
  );

  const renderEmpty = (
    <EmptyContent
      filled
      title="Không tìm thấy sản phẩm"
      description={debouncedQuery ? `Không có kết quả cho "${debouncedQuery}"` : 'Chưa có sản phẩm nào.'}
      sx={{ py: 10 }}
    />
  );

  return (
    <Container
      maxWidth={settings.themeStretch ? false : 'lg'}
      sx={{ mb: 15 }}
    >
      <CartIcon totalItems={checkout.totalItems} />

      <Typography variant="h4" sx={{ my: { xs: 3, md: 5 } }}>
        Sản phẩm
      </Typography>

      <Stack spacing={2.5} sx={{ mb: { xs: 3, md: 5 } }}>
        {renderFilters}
      </Stack>

      {(productsEmpty && !productsLoading) && renderEmpty}

      <ProductList
        products={dataFiltered}
        loading={productsLoading}
        totalPages={totalPages}
        page={page}
        onPageChange={handlePageChange}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

function applySortFilter(products: IProductItem[], sortBy: string): IProductItem[] {
  if (sortBy === 'newest') return orderBy(products, ['createdAt'], ['desc']);
  if (sortBy === 'priceAsc') return orderBy(products, ['price'], ['asc']);
  if (sortBy === 'priceDesc') return orderBy(products, ['price'], ['desc']);
  return products;
}
