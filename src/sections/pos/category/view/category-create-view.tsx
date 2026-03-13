'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import CategoryNewEditForm from '../category-new-edit-form';

// ----------------------------------------------------------------------

export default function CategoryCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Tạo danh mục mới"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Danh mục', href: paths.dashboard.pos.category.list },
          { name: 'Tạo mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <CategoryNewEditForm />
    </Container>
  );
}
