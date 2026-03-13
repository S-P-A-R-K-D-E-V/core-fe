'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import WarehouseNewEditForm from '../warehouse-new-edit-form';

export default function WarehouseCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Tạo kho mới"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.warehouse.list },
          { name: 'Tạo mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <WarehouseNewEditForm />
    </Container>
  );
}
