'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ExpenseNewEditForm from '../expense-new-edit-form';

// ----------------------------------------------------------------------
// Quyền: app/dashboard/pos/expense (layout: expense.read, page: expense.create).

export default function ExpenseCreateView() {
  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Thêm chi phí"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Chi phí', href: paths.dashboard.pos.expense.list },
          { name: 'Thêm mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <ExpenseNewEditForm />
    </Container>
  );
}
