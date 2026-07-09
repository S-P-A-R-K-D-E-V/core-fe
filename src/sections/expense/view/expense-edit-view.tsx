'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { IExpense } from 'src/types/corecms-api';
import { getExpenseById } from 'src/api/expenses';
import ExpenseNewEditForm from '../expense-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function ExpenseEditView({ id }: Props) {
  const [currentExpense, setCurrentExpense] = useState<IExpense>();

  useEffect(() => {
    getExpenseById(id).then(setCurrentExpense);
  }, [id]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Sửa chi phí"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Chi phí', href: paths.dashboard.pos.expense.list },
            { name: 'Sửa' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {currentExpense && <ExpenseNewEditForm currentExpense={currentExpense} />}
      </Container>
    </RoleBasedGuard>
  );
}
