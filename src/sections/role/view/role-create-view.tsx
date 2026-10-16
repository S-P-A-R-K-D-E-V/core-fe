'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import CustomRoleForm from '../custom-role-form';

// ----------------------------------------------------------------------

export default function RoleCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Thêm vai trò"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vai trò', href: paths.dashboard.role.list },
          { name: 'Thêm mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <CustomRoleForm />
    </Container>
  );
}
