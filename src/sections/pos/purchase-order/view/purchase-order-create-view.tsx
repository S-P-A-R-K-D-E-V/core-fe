'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import PurchaseOrderNewForm from '../purchase-order-new-form';

// ----------------------------------------------------------------------

export default function PurchaseOrderCreateView() {
  return (
    <Container maxWidth="xl">
      <CustomBreadcrumbs
        heading="Tạo đơn nhập hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đơn nhập hàng', href: paths.dashboard.pos.purchaseOrder.list },
          { name: 'Tạo mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <PurchaseOrderNewForm />
    </Container>
  );
}
