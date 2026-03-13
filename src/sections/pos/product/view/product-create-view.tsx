'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ProductNewEditForm from '../product-new-edit-form';

// ----------------------------------------------------------------------

export default function ProductCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Tạo sản phẩm mới"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sản phẩm', href: paths.dashboard.pos.product.list },
          { name: 'Tạo mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ProductNewEditForm />
    </Container>
  );
}
