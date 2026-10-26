'use client';

import { useState, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useGetStorefrontProduct } from 'src/api/product';

import Iconify from 'src/components/iconify';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import CartIcon from '../common/cart-icon';
import { useCheckoutContext } from '../../checkout/context';
import ProductDetailsReview from '../product-details-review';
import { ProductDetailsSkeleton } from '../product-skeleton';
import ProductDetailsSummary from '../product-details-summary';
import ProductDetailsCarousel from '../product-details-carousel';
import ProductDetailsDescription from '../product-details-description';
import type { StoreHighlight } from '../store-highlights';

// ----------------------------------------------------------------------

type Props = {
  id: string;
  /** Ô cam kết dưới ảnh — dựng phía server theo dữ liệu cửa hàng (src/sections/product/store-highlights.ts). */
  highlights?: StoreHighlight[];
};

export default function ProductShopDetailsView({ id, highlights = [] }: Props) {
  const settings = useSettingsContext();

  const checkout = useCheckoutContext();

  const [currentTab, setCurrentTab] = useState('description');

  const { product, productLoading, productError } = useGetStorefrontProduct(id);

  const handleChangeTab = useCallback((event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  }, []);

  const renderSkeleton = <ProductDetailsSkeleton />;

  const renderError = (
    <EmptyContent
      filled
      title="Không tìm thấy sản phẩm"
      description="Sản phẩm có thể đã ngừng bán hoặc đường dẫn không đúng."
      action={
        <Button
          component={RouterLink}
          href={paths.product.root}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" width={16} />}
          sx={{ mt: 3 }}
        >
          Quay lại danh sách
        </Button>
      }
      sx={{ py: 10 }}
    />
  );

  // Chưa có đánh giá nào thì bỏ hẳn tab "Đánh giá" (khung đánh giá mẫu không có dữ liệu thật phía sau).
  const hasReviews = !!product && (product.totalReviews > 0 || product.reviews.length > 0);

  const renderProduct = product && (
    <>
      <CustomBreadcrumbs
        links={[
          { name: 'Trang chủ', href: '/' },
          {
            name: 'Sản phẩm',
            href: paths.product.root,
          },
          { name: product?.name },
        ]}
        sx={{ mb: 5 }}
      />

      <Grid container spacing={{ xs: 3, md: 5, lg: 8 }}>
        <Grid size={{ xs: 12, md: 6, lg: 7 }}>
          <ProductDetailsCarousel product={product} />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 5 }}>
          <ProductDetailsSummary
            product={product}
            items={checkout.items}
            onAddCart={checkout.onAddToCart}
            onGotoStep={checkout.onGotoStep}
          />
        </Grid>
      </Grid>

      {highlights.length > 0 && (
        <Box
          gap={5}
          display="grid"
          gridTemplateColumns={{
            xs: 'repeat(1, 1fr)',
            md: `repeat(${highlights.length}, 1fr)`,
          }}
          sx={{ my: 10 }}
        >
          {highlights.map((item) => (
            <Box key={item.title} sx={{ textAlign: 'center', px: 5 }}>
              <Iconify icon={item.icon} width={32} sx={{ color: 'primary.main' }} />

              <Typography variant="subtitle1" sx={{ mb: 1, mt: 2 }}>
                {item.title}
              </Typography>

              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {item.description}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Card sx={{ ...(!highlights.length && { mt: 10 }) }}>
        <Tabs
          value={currentTab}
          onChange={handleChangeTab}
          sx={{
            px: 3,
            boxShadow: (theme) => `inset 0 -2px 0 0 ${alpha(theme.palette.grey[500], 0.08)}`,
          }}
        >
          {[
            {
              value: 'description',
              label: 'Mô tả sản phẩm',
            },
            ...(hasReviews
              ? [
                  {
                    value: 'reviews',
                    label: `Đánh giá (${product.reviews.length})`,
                  },
                ]
              : []),
          ].map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>

        {currentTab === 'description' &&
          (product.description ? (
            <ProductDetailsDescription description={product.description} />
          ) : (
            <Typography variant="body2" sx={{ p: 3, color: 'text.secondary' }}>
              Chưa có mô tả cho sản phẩm này.
            </Typography>
          ))}

        {hasReviews && currentTab === 'reviews' && (
          <ProductDetailsReview
            ratings={product.ratings}
            reviews={product.reviews}
            totalRatings={product.totalRatings}
            totalReviews={product.totalReviews}
          />
        )}
      </Card>
    </>
  );

  return (
    <Container
      maxWidth={settings.themeStretch ? false : 'lg'}
      sx={{
        mt: 5,
        mb: 15,
      }}
    >
      <CartIcon totalItems={checkout.totalItems} />

      {productLoading && renderSkeleton}

      {productError && renderError}

      {product && renderProduct}
    </Container>
  );
}
