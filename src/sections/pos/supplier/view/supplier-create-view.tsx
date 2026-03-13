'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import SupplierNewEditForm from '../supplier-new-edit-form';

// ----------------------------------------------------------------------

export default function SupplierCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Thêm nhà cung cấp"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Nhà cung cấp', href: paths.dashboard.pos.supplier.list },
          { name: 'Thêm mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SupplierNewEditForm />
    </Container>
  );
}
