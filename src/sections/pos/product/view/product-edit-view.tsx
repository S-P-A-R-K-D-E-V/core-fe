'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IProduct } from 'src/types/corecms-api';
import { getProductById } from 'src/api/products';
import ProductNewEditForm from '../product-new-edit-form';

// ----------------------------------------------------------------------

type Props = { id: string };

export default function ProductEditView({ id }: Props) {
  const [currentProduct, setCurrentProduct] = useState<IProduct | null>(null);

  useEffect(() => {
    getProductById(id).then(setCurrentProduct).catch(console.error);
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa sản phẩm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sản phẩm', href: paths.dashboard.pos.product.list },
          { name: currentProduct?.name || '' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {currentProduct && <ProductNewEditForm currentProduct={currentProduct} />}
    </Container>
  );
}
