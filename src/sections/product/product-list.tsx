import Box, { BoxProps } from '@mui/material/Box';
import Pagination, { paginationClasses } from '@mui/material/Pagination';

import { IProductItem } from 'src/types/product';

import ProductItem from './product-item';
import { ProductItemSkeleton } from './product-skeleton';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  products: IProductItem[];
  loading?: boolean;
  totalPages?: number;
  page?: number;
  onPageChange?: (page: number) => void;
};

export default function ProductList({ products, loading, totalPages, page, onPageChange, ...other }: Props) {
  const renderSkeleton = (
    <>
      {[...Array(16)].map((_, index) => (
        <ProductItemSkeleton key={index} />
      ))}
    </>
  );

  const renderList = (
    <>
      {products.map((product) => (
        <ProductItem key={product.id} product={product} />
      ))}
    </>
  );

  return (
    <>
      <Box
        gap={3}
        display="grid"
        gridTemplateColumns={{
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        }}
        {...other}
      >
        {loading ? renderSkeleton : renderList}
      </Box>

      {!!totalPages && totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page ?? 1}
          onChange={(_, value) => onPageChange?.(value)}
          sx={{
            mt: 8,
            [`& .${paginationClasses.ul}`]: {
              justifyContent: 'center',
            },
          }}
        />
      )}
    </>
  );
}
