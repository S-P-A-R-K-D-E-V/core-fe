'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import CustomerNewEditForm from '../customer-new-edit-form';

// ----------------------------------------------------------------------

export default function CustomerCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Thêm khách hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Khách hàng', href: paths.dashboard.pos.customer.list },
          { name: 'Thêm mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <CustomerNewEditForm />
    </Container>
  );
}
