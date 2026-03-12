'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import RoleNewEditForm from '../role-new-edit-form';

// ----------------------------------------------------------------------

export default function RoleCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Create a new role"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Role', href: paths.dashboard.role.list },
          { name: 'New role' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleNewEditForm />
    </Container>
  );
}
