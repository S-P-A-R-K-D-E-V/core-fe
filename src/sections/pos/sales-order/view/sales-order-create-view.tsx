'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import SalesOrderNewForm from '../sales-order-new-form';

// ----------------------------------------------------------------------

export default function SalesOrderCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Tạo đơn bán hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng', href: paths.dashboard.pos.salesOrder.list },
          { name: 'Tạo đơn' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SalesOrderNewForm />
    </Container>
  );
}
